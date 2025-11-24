const Produit = require("../models/produit");
const Categorie = require("../models/categorie");
const Utilisateur = require("../models/utilisateur");
const Caisse = require("../models/caisse");
const Role = require("../models/role");
const TypeMvt = require("../models/typeMvt");
const sequelize = require("../models/sequelize");
const jwt = require("jsonwebtoken");
const Boutique = require("../models/boutique");
const { getCaisseByType } = require("../utils/caisseUtils");
const { Op } = require("sequelize");

// ===========================
// AJOUTER UN PRODUIT
// ===========================
const ajouterProduit = async (req, res) => {
  try {
    const {
      nom,
      prix_achat,
      prix_vente,
      stock_actuel = 0,
      stock_minimum = 0,
      categorieId,
      boutiqueId,
    } = req.body;

    if (!nom || !prix_achat || !prix_vente || !boutiqueId) {
      return res.status(400).json({
        message:
          "Les champs nom, prix_achat, prix_vente et boutiqueId sont obligatoires.",
      });
    }

    // 🚫 Empêcher prix_vente < prix_achat
    if (prix_vente < prix_achat) {
      return res.status(400).json({
        message: "Le prix de vente ne peut pas être inférieur au prix d'achat.",
      });
    }

    // 🚫 Empêcher stock_actuel < stock_minimum
    if (stock_actuel < stock_minimum) {
      return res.status(400).json({
        message:
          "Le stock actuel doit être supérieur ou égal au stock minimum.",
      });
    }

    // Récupération de l'utilisateur connecté
    const authHeader = req.headers["authorization"];
    if (!authHeader)
      return res
        .status(403)
        .json({ message: "Accès refusé. Aucun token trouvé." });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const utilisateur = await Utilisateur.findByPk(decoded.id, {
      include: [{ model: Role }, { model: Boutique, as: "Boutique" }],
    });
    if (!utilisateur)
      return res.status(404).json({ message: "Utilisateur non trouvé." });

    // Vérifier que l'utilisateur peut ajouter un produit
    const boutique = await Boutique.findByPk(boutiqueId, {
      include: [{ model: Utilisateur, as: "Vendeurs" }],
    });
    if (!boutique)
      return res.status(404).json({ message: "Boutique non trouvée." });

    const estAdmin = utilisateur.Role?.nom.toLowerCase() === "admin";
    const estVendeurBoutique =
      utilisateur.Role?.nom.toLowerCase() === "vendeur" &&
      utilisateur.Boutique?.id === boutiqueId;

    if (!estAdmin && !estVendeurBoutique) {
      return res.status(403).json({
        message: "Vous n'avez pas la permission d'ajouter un produit ici.",
      });
    }

    const valeurStock = prix_achat * stock_actuel;

    // Empêcher d'ajouter deux produits avec le même nom dans la même catégorie
    const produitExistant = await Produit.findOne({
      where: {
        nom,
        categorieId,
        boutiqueId,
      },
    });

    if (produitExistant) {
      return res.status(400).json({
        message:
          "Un produit avec ce nom existe déjà dans cette catégorie pour cette boutique.",
      });
    }

    const result = await sequelize.transaction(async (t) => {
      // Création produit
      const produit = await Produit.create(
        {
          nom,
          prix_achat,
          prix_vente,
          stock_actuel,
          stock_minimum,
          categorieId,
          boutiqueId,
          status: "VALIDER",
          utilisateurId: utilisateur.id, // celui qui ajoute le produit
        },
        { transaction: t }
      );

      // Mise à jour caisse admin
      const adminId = boutique.utilisateurId; // propriétaire
      let caisseAdmin = await Caisse.findOne({
        where: { utilisateurId: adminId, type: "VALEUR_STOCK_PUR" },
        transaction: t,
      });
      if (caisseAdmin) {
        caisseAdmin.solde_actuel += valeurStock;
        await caisseAdmin.save({ transaction: t });
      } else {
        caisseAdmin = await Caisse.create(
          {
            utilisateurId: adminId,
            type: "VALEUR_STOCK_PUR",
            solde_actuel: valeurStock,
          },
          { transaction: t }
        );
      }

      // Mise à jour caisses des vendeurs
      if (boutique.Vendeurs?.length) {
        for (const vendeur of boutique.Vendeurs) {
          let caisseVendeur = await Caisse.findOne({
            where: { utilisateurId: vendeur.id, type: "VALEUR_STOCK_PUR" },
            transaction: t,
          });
          if (caisseVendeur) {
            caisseVendeur.solde_actuel += valeurStock;
            await caisseVendeur.save({ transaction: t });
          } else {
            await Caisse.create(
              {
                utilisateurId: vendeur.id,
                type: "VALEUR_STOCK_PUR",
                solde_actuel: valeurStock,
              },
              { transaction: t }
            );
          }
        }
      }
      await sequelize.transaction(async (t) => {
        // Vérifier si les types existent déjà
        const typesExistants = await TypeMvt.findAll({
          where: { type: ["ENTRE", "SORTIE"] },
          transaction: t,
        });

        const typesAAjouter = [];

        if (!typesExistants.find((t) => t.type === "ENTRE")) {
          typesAAjouter.push({ type: "ENTRE" });
        }
        if (!typesExistants.find((t) => t.type === "SORTIE")) {
          typesAAjouter.push({ type: "SORTIE" });
        }

        // Créer seulement ceux qui manquent
        if (typesAAjouter.length > 0) {
          await TypeMvt.bulkCreate(typesAAjouter, { transaction: t });
        }
      });

      return { produit, soldeCaisseAdmin: caisseAdmin.solde_actuel };
    });

    res.status(201).json({
      message: "Produit créé avec succès.",
      produit: result.produit,
      soldeCaisseAdmin: result.soldeCaisseAdmin,
    });
  } catch (error) {
    console.error("Erreur lors de l'ajout du produit :", error);
    res
      .status(500)
      .json({ message: "Erreur interne du serveur.", error: error.message });
  }
};

// ===========================
// RECUPERER LES PRODUITS
// ===========================
const recupererProduitsBoutique = async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader)
      return res
        .status(403)
        .json({ message: "Accès refusé. Aucun token trouvé." });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const utilisateurConnecte = await Utilisateur.findByPk(decoded.id, {
      include: [
        { model: Role, attributes: ["nom"] },
        { model: Boutique, as: "Boutique" },
      ],
    });
    if (!utilisateurConnecte)
      return res.status(404).json({ message: "Utilisateur non trouvé." });

    let idsUtilisateurs = [];

    if (utilisateurConnecte.Role.nom.toUpperCase() === "ADMIN") {
      // Admin : récupérer toutes les boutiques qu'il a créées
      const boutiques = await Boutique.findAll({
        where: { utilisateurId: utilisateurConnecte.id },
        include: [{ model: Utilisateur, as: "Vendeurs", attributes: ["id"] }],
      });

      for (const boutique of boutiques) {
        // Ajouter tous les utilisateurs (admin + vendeurs) de cette boutique
        idsUtilisateurs.push(boutique.utilisateurId); // admin
        if (boutique.Vendeurs && boutique.Vendeurs.length > 0) {
          boutique.Vendeurs.forEach((v) => idsUtilisateurs.push(v.id));
        }
      }
    } else if (utilisateurConnecte.Role.nom.toUpperCase() === "VENDEUR") {
      // Vendeur : récupérer tous les utilisateurs de sa boutique
      const boutique = await Boutique.findByPk(utilisateurConnecte.boutiqueId, {
        include: [{ model: Utilisateur, as: "Vendeurs", attributes: ["id"] }],
      });

      if (boutique) {
        idsUtilisateurs.push(boutique.utilisateurId); // admin
        if (boutique.Vendeurs && boutique.Vendeurs.length > 0) {
          boutique.Vendeurs.forEach((v) => idsUtilisateurs.push(v.id));
        }
      }
    } else {
      return res.status(403).json({ message: "Rôle non autorisé." });
    }

    const produits = await Produit.findAll({
      where: { utilisateurId: idsUtilisateurs },
      include: [
        { model: Categorie, attributes: ["id", "nom"] },
        { model: Boutique, attributes: ["id", "nom"] },
        {
          model: Utilisateur,
          attributes: ["id", "nom"],
          include: [{ model: Role, attributes: ["nom"] }],
        },
      ],
      order: [["id", "DESC"]],
    });

    res.status(200).json(produits);
  } catch (error) {
    console.error("Erreur lors de la récupération des produits :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

// ===========================
// PRODUITS EN ALERTE STOCK
// ===========================
const produitsEnAlerteStock = async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader)
      return res
        .status(403)
        .json({ message: "Accès refusé. Aucun token trouvé." });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const utilisateur = await Utilisateur.findByPk(decoded.id, {
      include: [{ model: Role }],
    });

    if (!utilisateur)
      return res.status(404).json({ message: "Utilisateur non trouvé." });

    let produits = [];

    if (utilisateur.Role.nom.toUpperCase() === "ADMIN") {
      // Récupérer tous les vendeurs de la boutique de l'admin
      const boutique = await Boutique.findOne({
        where: { utilisateurId: utilisateur.id },
        include: [{ model: Utilisateur, as: "Vendeurs", attributes: ["id"] }],
      });

      if (!boutique)
        return res
          .status(404)
          .json({ message: "Aucune boutique trouvée pour cet admin." });

      const utilisateurIds = [utilisateur.id]; // inclure l'admin lui-même
      if (boutique.Vendeurs && boutique.Vendeurs.length > 0) {
        utilisateurIds.push(...boutique.Vendeurs.map((v) => v.id));
      }

      produits = await Produit.findAll({
        where: { utilisateurId: utilisateurIds },
        include: [
          { model: Categorie, attributes: ["id", "nom"] },
          { model: Boutique, attributes: ["id", "nom"] },
        ],
        order: [["id", "DESC"]],
      });
    } else if (utilisateur.Role.nom.toUpperCase() === "VENDEUR") {
      if (!utilisateur.boutiqueId)
        return res
          .status(403)
          .json({ message: "Aucune boutique associée à ce vendeur." });

      produits = await Produit.findAll({
        where: { boutiqueId: utilisateur.boutiqueId },
        include: [
          { model: Categorie, attributes: ["id", "nom"] },
          { model: Boutique, attributes: ["id", "nom"] },
        ],
        order: [["id", "DESC"]],
      });
    } else {
      return res.status(403).json({ message: "Rôle non autorisé." });
    }

    // Filtrage selon stock minimum
    produits = produits.filter((p) => p.stock_actuel <= (p.stock_minimum || 0));

    res.status(200).json(produits);
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des produits en alerte stock :",
      error
    );
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

// ===========================
// MODIFIER UN PRODUIT
// ===========================
const modifierProduit = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nom,
      prix_achat,
      prix_vente,
      stock_actuel,
      stock_minimum,
      categorieId,
      // boutiqueId,
    } = req.body;

    // Vérification token
    const authHeader = req.headers["authorization"];
    if (!authHeader)
      return res
        .status(403)
        .json({ message: "Accès refusé. Aucun token trouvé." });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Récupération utilisateur + rôle + boutique
    const utilisateur = await Utilisateur.findByPk(decoded.id, {
      include: [{ model: Role }, { model: Boutique, as: "Boutique" }],
    });

    if (!utilisateur)
      return res.status(404).json({ message: "Utilisateur non trouvé." });

    // Récupération produit
    const produit = await Produit.findByPk(id);
    if (!produit)
      return res.status(404).json({ message: "Produit non trouvé." });

    // 🚫 Empêcher prix_vente < prix_achat **avec les nouvelles valeurs**
    const newPrixAchat = prix_achat ?? produit.prix_achat;
    const newPrixVente = prix_vente ?? produit.prix_vente;
    if (newPrixVente < newPrixAchat) {
      return res.status(400).json({
        message: "Le prix de vente ne peut pas être inférieur au prix d'achat.",
      });
    }

    // 🚫 Empêcher stock_actuel < stock_minimum **avec les nouvelles valeurs**
    const newStockActuel = stock_actuel ?? produit.stock_actuel;
    const newStockMin = stock_minimum ?? produit.stock_minimum;
    if (newStockActuel < newStockMin) {
      return res.status(400).json({
        message:
          "Le stock actuel doit être supérieur ou égal au stock minimum.",
      });
    }

    // Récupération boutique du produit
    const boutique = await Boutique.findByPk(produit.boutiqueId, {
      include: [{ model: Utilisateur, as: "Vendeurs" }],
    });

    if (!boutique)
      return res.status(404).json({ message: "Boutique non trouvée." });

    // Vérifier permissions
    const estAdmin = utilisateur.Role?.nom.toLowerCase() === "admin";
    const estVendeurBoutique =
      utilisateur.Role?.nom.toLowerCase() === "vendeur" &&
      utilisateur.Boutique?.id === boutique.id;

    if (!estAdmin && !estVendeurBoutique) {
      return res.status(403).json({
        message: "Vous n'avez pas la permission de modifier ce produit.",
      });
    }

    // Calcul nouvelle valeur stock
    const ancienneValeur = produit.prix_achat * produit.stock_actuel;

    const nouvelleValeur = newPrixAchat * newStockActuel;
    const difference = nouvelleValeur - ancienneValeur;

    const adminId = boutique.utilisateurId;

    await sequelize.transaction(async (t) => {
      // Mise à jour caisse admin
      let caisseAdmin = await Caisse.findOne({
        where: { utilisateurId: adminId, type: "VALEUR_STOCK_PUR" },
        transaction: t,
      });

      if (caisseAdmin) {
        caisseAdmin.solde_actuel += difference;
        await caisseAdmin.save({ transaction: t });
      }

      // Mise à jour caisses vendeurs
      if (boutique.Vendeurs?.length) {
        for (const vendeur of boutique.Vendeurs) {
          let caisseVendeur = await Caisse.findOne({
            where: { utilisateurId: vendeur.id, type: "VALEUR_STOCK_PUR" },
            transaction: t,
          });

          if (caisseVendeur) {
            caisseVendeur.solde_actuel += difference;
            await caisseVendeur.save({ transaction: t });
          }
        }
      }

      // Mise à jour produit
      await produit.update(
        {
          nom: nom ?? produit.nom,
          prix_achat: newPrixAchat,
          prix_vente: newPrixVente,
          stock_actuel: newStockActuel,
          stock_minimum: newStockMin,
          categorieId: categorieId ?? produit.categorieId,
        },
        { transaction: t }
      );
    });

    res.status(200).json({
      message: "Produit mis à jour avec succès.",
      produit,
    });
  } catch (error) {
    console.error("Erreur lors de la modification du produit :", error);
    res.status(500).json({
      message: "Erreur interne du serveur.",
      error: error.message,
    });
  }
};


// ===========================
// ANNULER UN PRODUIT
// ===========================
const annulerProduit = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérification token
    const authHeader = req.headers["authorization"];
    if (!authHeader)
      return res
        .status(403)
        .json({ message: "Accès refusé. Aucun token trouvé." });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Récupération utilisateur + rôle + boutique
    const utilisateur = await Utilisateur.findByPk(decoded.id, {
      include: [{ model: Role }, { model: Boutique, as: "Boutique" }],
    });

    if (!utilisateur)
      return res.status(404).json({ message: "Utilisateur non trouvé." });

    // Récupération du produit
    const produit = await Produit.findByPk(id);
    if (!produit)
      return res.status(404).json({ message: "Produit non trouvé." });

    if (produit.status === "ANNULER")
      return res.status(400).json({ message: "Ce produit est déjà annulé." });

    // Récupération de la boutique du produit
    const boutique = await Boutique.findByPk(produit.boutiqueId, {
      include: [{ model: Utilisateur, as: "Vendeurs" }],
    });

    if (!boutique)
      return res.status(404).json({ message: "Boutique non trouvée." });

    // Vérification permissions (admin OU vendeur de la boutique)
    const estAdmin = utilisateur.Role?.nom.toLowerCase() === "admin";
    const estVendeurBoutique =
      utilisateur.Role?.nom.toLowerCase() === "vendeur" &&
      utilisateur.Boutique?.id === boutique.id;

    if (!estAdmin && !estVendeurBoutique) {
      return res.status(403).json({
        message: "Vous n'avez pas la permission d'annuler ce produit.",
      });
    }

    // Calcul valeur stock
    const valeurStock = produit.prix_achat * produit.stock_actuel;
    const adminId = boutique.utilisateurId;

    await sequelize.transaction(async (t) => {
      // Mise à jour caisse admin
      let caisseAdmin = await Caisse.findOne({
        where: { utilisateurId: adminId, type: "VALEUR_STOCK_PUR" },
        transaction: t,
      });

      if (caisseAdmin) {
        caisseAdmin.solde_actuel -= valeurStock;
        await caisseAdmin.save({ transaction: t });
      }

      // Mise à jour caisses vendeurs
      if (boutique.Vendeurs?.length) {
        for (const vendeur of boutique.Vendeurs) {
          let caisseVendeur = await Caisse.findOne({
            where: { utilisateurId: vendeur.id, type: "VALEUR_STOCK_PUR" },
            transaction: t,
          });

          if (caisseVendeur) {
            caisseVendeur.solde_actuel -= valeurStock;
            await caisseVendeur.save({ transaction: t });
          }
        }
      }

      // Mise à jour du produit
      produit.status = "ANNULER";
      produit.commentaire = `Produit annulé par ${
        utilisateur.nom
      } le ${new Date().toLocaleString("fr-FR")}`;

      await produit.save({ transaction: t });
    });

    res.status(200).json({ message: "Produit annulé avec succès." });
  } catch (error) {
    console.error("Erreur lors de l'annulation du produit :", error);
    res.status(500).json({
      message: "Erreur interne du serveur.",
      error: error.message,
    });
  }
};

// ===========================
// SUPPRIMER UN PRODUIT
// ===========================
const supprimerProduit = async (req, res) => {
  try {
    const { id } = req.params;

    const authHeader = req.headers["authorization"];
    if (!authHeader)
      return res
        .status(403)
        .json({ message: "Accès refusé. Aucun token trouvé." });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const utilisateur = await Utilisateur.findByPk(decoded.id);
    if (!utilisateur || utilisateur.role !== "ADMIN")
      return res
        .status(403)
        .json({ message: "Seul l’administrateur peut supprimer un produit." });

    const produit = await Produit.findByPk(id);
    if (!produit)
      return res.status(404).json({ message: "Produit non trouvé." });

    const boutique = await Boutique.findByPk(produit.boutiqueId, {
      include: [{ model: Utilisateur, as: "Vendeurs" }],
    });
    if (!boutique)
      return res.status(404).json({ message: "Boutique non trouvée." });

    const adminId = boutique.utilisateurId;
    const ancienneValeur = produit.prix_achat * produit.stock_actuel;

    await sequelize.transaction(async (t) => {
      // Caisse admin
      let caisseAdmin = await getCaisseByType("VALEUR_STOCK_PUR", adminId, t);
      if (caisseAdmin) {
        caisseAdmin.solde_actuel -= ancienneValeur;
        await caisseAdmin.save({ transaction: t });
      }

      // Caisses vendeurs
      if (boutique.Vendeurs?.length) {
        for (const vendeur of boutique.Vendeurs) {
          let caisseVendeur = await getCaisseByType(
            "VALEUR_STOCK_PUR",
            vendeur.id,
            t
          );
          if (caisseVendeur) {
            caisseVendeur.solde_actuel -= ancienneValeur;
            await caisseVendeur.save({ transaction: t });
          }
        }
      }

      // Supprimer produit
      await produit.destroy({ transaction: t });
    });

    res.status(200).json({ message: "Produit supprimé avec succès." });
  } catch (error) {
    console.error("Erreur lors de la suppression du produit :", error);
    res
      .status(500)
      .json({ message: "Erreur interne du serveur.", error: error.message });
  }
};

module.exports = {
  ajouterProduit,
  recupererProduitsBoutique,
  produitsEnAlerteStock,
  modifierProduit,
  annulerProduit,
  supprimerProduit,
};
