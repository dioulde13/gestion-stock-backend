const Produit = require('../models/produit');
const Categorie = require('../models/categorie');
const Utilisateur = require('../models/utilisateur');
const Caisse = require('../models/caisse');
const sequelize = require('../models/sequelize');
const jwt = require('jsonwebtoken');
const Boutique = require('../models/boutique');

const { Op } = require('sequelize'); // Assure-toi que c'est bien importé

const ajouterProduit = async (req, res) => {
  try {
    const {
      nom,
      prix_achat,
      prix_vente,
      stock_actuel = 0,
      stock_minimum = 0,
      categorieId,
      utilisateurId, // admin qui ajoute
      boutiqueId
    } = req.body;

    if (!nom || !prix_achat || !prix_vente || !utilisateurId || !boutiqueId) {
      return res.status(400).json({
        message: 'Les champs nom, prix_achat, prix_vente, utilisateurId et boutiqueId sont obligatoires.'
      });
    }

    // ✅ Vérification de l'admin
    const admin = await Utilisateur.findByPk(utilisateurId);
    if (!admin) return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    if (admin.roleId !== 1) return res.status(403).json({ message: 'Seul l’admin peut ajouter des produits.' });

    // ✅ Récupérer la boutique avec Admin et Vendeurs
    const boutique = await Boutique.findByPk(boutiqueId, {
      include: [
        { model: Utilisateur, as: "Admin" },
        { model: Utilisateur, as: "Vendeurs" }
      ]
    });

    if (!boutique || boutique.Admin.id !== admin.id) {
      return res.status(403).json({ message: "Vous ne pouvez pas ajouter de produit à cette boutique." });
    }

    const valeurStock = prix_achat * stock_actuel;

    // ✅ Transaction sécurisée
    const result = await sequelize.transaction(async (t) => {
      // 1️⃣ Créer le produit
      const produit = await Produit.create({
        nom,
        prix_achat,
        prix_vente,
        stock_actuel,
        stock_minimum,
        categorieId,
        boutiqueId,
        utilisateurId: admin.id
      }, { transaction: t });

      // 2️⃣ Mettre à jour la caisse VALEUR_STOCK_PUR de l'admin
      let caisseAdmin = await Caisse.findOne({
        where: { utilisateurId: admin.id, type: "VALEUR_STOCK_PUR" },
        transaction: t
      });

      if (caisseAdmin) {
        caisseAdmin.solde_actuel += valeurStock;
        await caisseAdmin.save({ transaction: t });
      } else {
        caisseAdmin = await Caisse.create({
          utilisateurId: admin.id,
          type: "VALEUR_STOCK_PUR",
          solde_actuel: valeurStock
        }, { transaction: t });
      }

      // 3️⃣ Mettre à jour la caisse VALEUR_STOCK_PUR de TOUS les vendeurs de la boutique
      if (boutique.Vendeurs && boutique.Vendeurs.length > 0) {
        const vendeursIds = boutique.Vendeurs.map(v => v.id);

        // On récupère toutes leurs caisses VALEUR_STOCK_PUR
        const caissesVendeurs = await Caisse.findAll({
          where: {
            utilisateurId: { [Op.in]: vendeursIds },
            type: "VALEUR_STOCK_PUR"
          },
          transaction: t
        });

        // Mise à jour du solde pour chaque vendeur existant
        for (const caisse of caissesVendeurs) {
          caisse.solde_actuel += valeurStock;
          await caisse.save({ transaction: t });
        }

        // Vérifier s’il y a des vendeurs sans caisse (cas rare)
        const vendeursSansCaisse = vendeursIds.filter(
          id => !caissesVendeurs.some(c => c.utilisateurId === id)
        );

        for (const vendeurId of vendeursSansCaisse) {
          await Caisse.create({
            utilisateurId: vendeurId,
            type: "VALEUR_STOCK_PUR",
            solde_actuel: valeurStock
          }, { transaction: t });
        }
      }

      return {
        produit,
        soldeCaisseAdmin: caisseAdmin.solde_actuel
      };
    });

    // ✅ Réponse finale
    res.status(201).json({
      message: 'Produit créé avec succès.',
      produit: result.produit,
      soldeCaisseAdmin: result.soldeCaisseAdmin
    });

  } catch (error) {
    console.error("Erreur lors de l'ajout du produit :", error);
    res.status(500).json({ message: 'Erreur interne du serveur.', error: error.message });
  }
};





const recupererProduitsBoutique = async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(403).json({ message: "Accès refusé. Aucun token trouvé." });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const utilisateur = await Utilisateur.findByPk(decoded.id);
    if (!utilisateur) return res.status(404).json({ message: 'Utilisateur non trouvé.' });

    let produits = [];

    if (utilisateur.roleId === 1) {
      // ADMIN → Voir tous ses produits, toutes boutiques confondues
      produits = await Produit.findAll({
        where: { utilisateurId: utilisateur.id },
        include: [
          { model: Categorie, attributes: ['id', 'nom'] },
          { model: Boutique, attributes: ['id', 'nom'] }
        ]
      });

    } else {
      // VENDEUR → Voir uniquement les produits de sa boutique
      const boutique = await Boutique.findByPk(utilisateur.boutiqueId, {
        include: [{ model: Utilisateur, as: 'Admin' }]
      });

      if (!boutique || !boutique.Admin) {
        return res.status(403).json({ message: 'Aucun administrateur trouvé pour cette boutique.' });
      }

      produits = await Produit.findAll({
        where: {
          utilisateurId: boutique.Admin.id,
          boutiqueId: boutique.id  // ✅ Filtre par la boutique du vendeur
        },
        include: [
          { model: Categorie, attributes: ['id', 'nom'] },
          { model: Boutique, attributes: ['id', 'nom'] }
        ]
      });
    }

    res.status(200).json(produits);

  } catch (error) {
    console.error('Erreur lors de la récupération des produits :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

const produitsEnAlerteStock = async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(403).json({ message: "Accès refusé. Aucun token trouvé." });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const utilisateur = await Utilisateur.findByPk(decoded.id);
    if (!utilisateur) return res.status(404).json({ message: 'Utilisateur non trouvé.' });

    let produits = [];

    if (utilisateur.roleId === 1) {
      // ADMIN → tous ses produits, toutes boutiques confondues
      const boutiquesAdmin = await Boutique.findAll({ where: { utilisateurId: utilisateur.id } });
      const boutiqueIds = boutiquesAdmin.map(b => b.id);

      produits = await Produit.findAll({
        where: {
          utilisateurId: utilisateur.id,
          boutiqueId: boutiqueIds
        },
        include: [
          { model: Categorie, attributes: ['id', 'nom'] },
          { model: Boutique, attributes: ['id', 'nom', 'stock_minimum'] }
        ]
      });

      // Filtrer ensuite selon le stock minimum propre à chaque boutique
      produits = produits.filter(p => p.stock_actuel <= (p.Boutique.stock_minimum || 0));

    } else {
      // VENDEUR → uniquement les produits de sa boutique
      const boutique = await Boutique.findByPk(utilisateur.boutiqueId, {
        include: [{ model: Utilisateur, as: 'Admin' }]
      });

      if (!boutique || !boutique.Admin) {
        return res.status(403).json({ message: 'Aucun administrateur trouvé pour cette boutique.' });
      }

      produits = await Produit.findAll({
        where: {
          utilisateurId: boutique.Admin.id,
          boutiqueId: boutique.id
        },
        include: [
          { model: Categorie, attributes: ['id', 'nom'] },
          { model: Boutique, attributes: ['id', 'nom', 'stock_minimum'] }
        ]
      });

      produits = produits.filter(p => p.stock_actuel <= (p.Boutique.stock_minimum || 0));
    }

    res.status(200).json(produits);

  } catch (error) {
    console.error("Erreur lors de la récupération des produits en alerte stock :", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};




// ✅ Produits en alerte de stock
// const produitsEnAlerteStock = async (req, res) => {
//   try {
//     const authHeader = req.headers["authorization"];
//     if (!authHeader) return res.status(403).json({ message: "Accès refusé. Aucun token trouvé." });

//     const token = authHeader.split(" ")[1];
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const utilisateur = await Utilisateur.findByPk(decoded.id);
//     if (!utilisateur) return res.status(404).json({ message: 'Utilisateur non trouvé.' });

//     let boutiqueIds = [];

//     if (utilisateur.roleId === 1) {
//       const boutiquesAdmin = await Boutique.findAll({ where: { utilisateurId: utilisateur.id } });
//       boutiqueIds = boutiquesAdmin.map(b => b.id);
//     } else {
//       boutiqueIds = [utilisateur.boutiqueId];
//     }

//     const produits = await Produit.findAll({
//       where: {
//         boutiqueId: boutiqueIds,
//         stock_actuel: { [Sequelize.Op.lte]: Sequelize.col('stock_minimum') }
//       },
//       attributes: ['id', 'nom', 'prix_achat', 'prix_vente', 'stock_actuel', 'stock_minimum']
//     });

//     res.status(200).json(produits);

//   } catch (error) {
//     console.error("Erreur lors de la récupération des produits en alerte stock :", error);
//     res.status(500).json({ message: 'Erreur interne du serveur.' });
//   }
// };

// ✅ Modifier un produit (uniquement par admin)
const modifierProduit = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, prix_achat, prix_vente, stock_actuel, stock_minimum, categorieId, utilisateurId } = req.body;

    const produit = await Produit.findByPk(id);
    if (!produit) return res.status(404).json({ message: 'Produit non trouvé.' });

    const utilisateur = await Utilisateur.findByPk(utilisateurId);
    if (!utilisateur || utilisateur.roleId !== 1) {
      return res.status(403).json({ message: 'Seul l’admin peut modifier les produits.' });
    }

    const ancien_prix_achat = produit.prix_achat;
    const ancien_stock = produit.stock_actuel;
    const nouveau_prix_achat = prix_achat ?? ancien_prix_achat;
    const nouveau_stock = stock_actuel ?? ancien_stock;

    const result = await sequelize.transaction(async (t) => {
      let caisse = await Caisse.findOne({ where: { utilisateurId, type: "VALEUR_STOCK_PUR" }, transaction: t });
      if (!caisse) {
        caisse = await Caisse.create({ utilisateurId, type: "VALEUR_STOCK_PUR", solde_actuel: 0 }, { transaction: t });
      }

      const difference = (nouveau_prix_achat * nouveau_stock) - (ancien_prix_achat * ancien_stock);
      caisse.solde_actuel += difference;
      await caisse.save({ transaction: t });

      await produit.update({
        nom: nom ?? produit.nom,
        prix_achat: prix_achat ?? produit.prix_achat,
        prix_vente: prix_vente ?? produit.prix_vente,
        stock_actuel: stock_actuel ?? produit.stock_actuel,
        stock_minimum: stock_minimum ?? produit.stock_minimum,
        categorieId: categorieId ?? produit.categorieId
      }, { transaction: t });

      return { produit, solde_caisse: caisse.solde_actuel };
    });

    res.status(200).json({
      message: 'Produit mis à jour avec succès.',
      produit: result.produit,
      solde_caisse: result.solde_caisse
    });

  } catch (error) {
    console.error("Erreur lors de la mise à jour du produit :", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

module.exports = {
  ajouterProduit,
  recupererProduitsBoutique,
  produitsEnAlerteStock,
  modifierProduit
};
