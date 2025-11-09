const Produit = require("../models/produit");
const Categorie = require("../models/categorie");
const Utilisateur = require("../models/utilisateur");
const Caisse = require("../models/caisse");
const sequelize = require("../models/sequelize");
const jwt = require("jsonwebtoken");
const Boutique = require("../models/boutique");
const { getCaisseByType } = require("../utils/caisseUtils");

const { Op } = require("sequelize"); // Assure-toi que c'est bien importé

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
      boutiqueId,
    } = req.body;

    if (!nom || !prix_achat || !prix_vente || !utilisateurId || !boutiqueId) {
      return res.status(400).json({
        message:
          "Les champs nom, prix_achat, prix_vente, utilisateurId et boutiqueId sont obligatoires.",
      });
    }

    // ✅ Vérification de l'admin
    const admin = await Utilisateur.findByPk(utilisateurId);
    if (!admin)
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    if (admin.roleId !== 1)
      return res
        .status(403)
        .json({ message: "Seul l’admin peut ajouter des produits." });

    // ✅ Récupérer la boutique avec Admin et Vendeurs
    const boutique = await Boutique.findByPk(boutiqueId, {
      include: [
        { model: Utilisateur, as: "Admin" },
        { model: Utilisateur, as: "Vendeurs" },
      ],
    });

    if (!boutique || boutique.Admin.id !== admin.id) {
      return res.status(403).json({
        message: "Vous ne pouvez pas ajouter de produit à cette boutique.",
      });
    }

    const valeurStock = prix_achat * stock_actuel;

    // ✅ Transaction sécurisée
    const result = await sequelize.transaction(async (t) => {
      // 1️⃣ Créer le produit
      const produit = await Produit.create(
        {
          nom,
          prix_achat,
          prix_vente,
          stock_actuel,
          stock_minimum,
          categorieId,
          boutiqueId,
          status:"VALIDER",
          utilisateurId: admin.id,
        },
        { transaction: t }
      );

      // 2️⃣ Mettre à jour la caisse VALEUR_STOCK_PUR de l'admin
      let caisseAdmin = await Caisse.findOne({
        where: { utilisateurId: admin.id, type: "VALEUR_STOCK_PUR" },
        transaction: t,
      });

      if (caisseAdmin) {
        caisseAdmin.solde_actuel += valeurStock;
        await caisseAdmin.save({ transaction: t });
      } else {
        caisseAdmin = await Caisse.create(
          {
            utilisateurId: admin.id,
            type: "VALEUR_STOCK_PUR",
            solde_actuel: valeurStock,
          },
          { transaction: t }
        );
      }

      // 3️⃣ Mettre à jour la caisse VALEUR_STOCK_PUR de TOUS les vendeurs de la boutique
      if (boutique.Vendeurs && boutique.Vendeurs.length > 0) {
        const vendeursIds = boutique.Vendeurs.map((v) => v.id);

        // On récupère toutes leurs caisses VALEUR_STOCK_PUR
        const caissesVendeurs = await Caisse.findAll({
          where: {
            utilisateurId: { [Op.in]: vendeursIds },
            type: "VALEUR_STOCK_PUR",
          },
          transaction: t,
        });

        // Mise à jour du solde pour chaque vendeur existant
        for (const caisse of caissesVendeurs) {
          caisse.solde_actuel += valeurStock;
          await caisse.save({ transaction: t });
        }

        // Vérifier s’il y a des vendeurs sans caisse (cas rare)
        const vendeursSansCaisse = vendeursIds.filter(
          (id) => !caissesVendeurs.some((c) => c.utilisateurId === id)
        );

        for (const vendeurId of vendeursSansCaisse) {
          await Caisse.create(
            {
              utilisateurId: vendeurId,
              type: "VALEUR_STOCK_PUR",
              solde_actuel: valeurStock,
            },
            { transaction: t }
          );
        }
      }

      return {
        produit,
        soldeCaisseAdmin: caisseAdmin.solde_actuel,
      };
    });

    // ✅ Réponse finale
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

const recupererProduitsBoutique = async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader)
      return res
        .status(403)
        .json({ message: "Accès refusé. Aucun token trouvé." });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const utilisateur = await Utilisateur.findByPk(decoded.id);
    if (!utilisateur)
      return res.status(404).json({ message: "Utilisateur non trouvé." });

    let produits = [];

    if (utilisateur.roleId === 1) {
      // ADMIN → Voir tous ses produits, toutes boutiques confondues
      produits = await Produit.findAll({
        where: { utilisateurId: utilisateur.id },
        include: [
          { model: Categorie, attributes: ["id", "nom"] },
          { model: Boutique, attributes: ["id", "nom"] },
        ],
      });
    } else {
      // VENDEUR → Voir uniquement les produits de sa boutique
      const boutique = await Boutique.findByPk(utilisateur.boutiqueId, {
        include: [{ model: Utilisateur, as: "Admin" }],
      });

      if (!boutique || !boutique.Admin) {
        return res.status(403).json({
          message: "Aucun administrateur trouvé pour cette boutique.",
        });
      }

      produits = await Produit.findAll({
        where: {
          utilisateurId: boutique.Admin.id,
          boutiqueId: boutique.id, // ✅ Filtre par la boutique du vendeur
        },
        include: [
          { model: Categorie, attributes: ["id", "nom"] },
          { model: Boutique, attributes: ["id", "nom"] },
        ],
      });
    }

    res.status(200).json(produits);
  } catch (error) {
    console.error("Erreur lors de la récupération des produits :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

const produitsEnAlerteStock = async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader)
      return res
        .status(403)
        .json({ message: "Accès refusé. Aucun token trouvé." });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const utilisateur = await Utilisateur.findByPk(decoded.id);
    if (!utilisateur)
      return res.status(404).json({ message: "Utilisateur non trouvé." });

    let produits = [];

    if (utilisateur.roleId === 1) {
      // 👑 ADMIN : tous les produits de ses boutiques
      const boutiquesAdmin = await Boutique.findAll({
        where: { utilisateurId: utilisateur.id },
      });
      const boutiqueIds = boutiquesAdmin.map((b) => b.id);

      produits = await Produit.findAll({
        where: {
          utilisateurId: utilisateur.id,
          boutiqueId: boutiqueIds,
        },
        include: [
          { model: Categorie, attributes: ["id", "nom"] },
          { model: Boutique, attributes: ["id", "nom"] },
        ],
      });
    } else {
      // 🧑‍💼 VENDEUR : uniquement les produits de sa boutique
      const boutique = await Boutique.findByPk(utilisateur.boutiqueId, {
        include: [{ model: Utilisateur, as: "Admin" }],
      });

      if (!boutique || !boutique.Admin) {
        return res.status(403).json({
          message: "Aucun administrateur trouvé pour cette boutique.",
        });
      }

      produits = await Produit.findAll({
        where: {
          utilisateurId: boutique.Admin.id,
          boutiqueId: boutique.id,
        },
        include: [
          { model: Categorie, attributes: ["id", "nom"] },
          { model: Boutique, attributes: ["id", "nom"] },
        ],
      });
    }

    // ✅ Filtrage selon le stock minimum du PRODUIT
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

// ✅ Modifier un produit (uniquement par admin)
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
      utilisateurId,
      boutiqueId,
    } = req.body;

    // Vérifier existence du produit
    const produit = await Produit.findByPk(id);
    if (!produit) {
      return res.status(404).json({ message: "Produit non trouvé." });
    }

    // Vérifier utilisateur admin
    const utilisateur = await Utilisateur.findByPk(utilisateurId);
    if (!utilisateur || utilisateur.roleId !== 1) {
      return res
        .status(403)
        .json({ message: "Seul l’administrateur peut modifier un produit." });
    }

    console.log(utilisateur);

    // Anciennes valeurs
    const ancienPrixAchat = produit.prix_achat;
    const ancienStock = produit.stock_actuel;

    // Nouvelles valeurs (ou anciennes si non modifiées)
    const nouveauPrixAchat =
      prix_achat !== undefined ? prix_achat : ancienPrixAchat;
    const nouveauStock =
      stock_actuel !== undefined ? stock_actuel : ancienStock;

    // Calcul de la différence de valeur stock
    const ancienneValeur = ancienPrixAchat * ancienStock;
    const nouvelleValeur = nouveauPrixAchat * nouveauStock;
    const difference = nouvelleValeur - ancienneValeur;

    // ✅ Transaction globale
    const result = await sequelize.transaction(async (t) => {
      console.log("id boutique ", boutiqueId);

      // 🏬 Trouver la boutique de l’admin
      const boutique = await Boutique.findByPk(boutiqueId, {
        transaction: t,
      });

      console.log("boutique ", boutique);

      if (boutique) {
        // Récupérer tous les vendeurs de la boutique
        const vendeurs = await Utilisateur.findAll({
          where: { boutiqueId: boutique.id },
          transaction: t,
        });

        // 🧾 Mettre à jour VALEUR_STOCK_PUR pour chaque vendeur
        for (const vendeur of vendeurs) {
          const caisseVendeur = await getCaisseByType(
            "VALEUR_STOCK_PUR",
            vendeur.id,
            t
          );
          if (caisseVendeur) {
            caisseVendeur.solde_actuel += difference;
            await caisseVendeur.save({ transaction: t });
          }
        }
        console.log("admin ", boutique.utilisateurId);
        // 👨‍💼 Mettre à jour la caisse de l’admin de la boutique
        if (boutique.utilisateurId) {
          const adminBoutique = await Utilisateur.findByPk(
            boutique.utilisateurId,
            { transaction: t }
          );

          if (adminBoutique) {
            const caisseAdmin = await getCaisseByType(
              "VALEUR_STOCK_PUR",
              adminBoutique.id,
              t
            );
            if (caisseAdmin) {
              caisseAdmin.solde_actuel += difference;
              await caisseAdmin.save({ transaction: t });
            }
          }
        }
      }

      // ✅ Mise à jour du produit
      await produit.update(
        {
          nom: nom ?? produit.nom,
          prix_achat: prix_achat ?? produit.prix_achat,
          prix_vente: prix_vente ?? produit.prix_vente,
          stock_actuel: stock_actuel ?? produit.stock_actuel,
          stock_minimum: stock_minimum ?? produit.stock_minimum,
          categorieId: categorieId ?? produit.categorieId,
        },
        { transaction: t }
      );

      return produit;
    });

    // ✅ Réponse finale
    res.status(200).json({
      message: "Produit mis à jour avec succès.",
      produit: result,
    });
  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour du produit :", error);
    res.status(500).json({
      message: "Erreur interne du serveur.",
      error: error.message,
    });
  }
};

const annulerProduit = async (req, res) => {
  try {
    const { id } = req.params;
    const { utilisateurId, boutiqueId } = req.body;

    // console.log(req.body);

    // 🔹 Vérifier existence du produit
    const produit = await Produit.findByPk(id);
    if (!produit) {
      return res.status(404).json({ message: "Produit non trouvé." });
    }

    // 🔹 Vérifier utilisateur admin
    const utilisateur = await Utilisateur.findByPk(utilisateurId);
    if (!utilisateur || utilisateur.roleId !== 1) {
      return res
        .status(403)
        .json({ message: "Seul l’administrateur peut annuler un produit." });
    }

    // 🔹 Vérifier si le produit est déjà annulé
    if (produit.status === "ANNULER") {
      return res.status(400).json({ message: "Ce produit est déjà annulé." });
    }

    // 💰 Ancienne valeur du stock
    const ancienneValeur = produit.prix_achat * produit.stock_actuel;

    await sequelize.transaction(async (t) => {
      const boutique = await Boutique.findByPk(boutiqueId, { transaction: t });

      if (boutique) {
        // 🔹 Tous les vendeurs de la boutique
        const vendeurs = await Utilisateur.findAll({
          where: { boutiqueId: boutique.id },
          transaction: t,
        });

        // 🔄 Déduire VALEUR_STOCK_PUR pour chaque vendeur
        for (const vendeur of vendeurs) {
          const caisseVendeur = await getCaisseByType(
            "VALEUR_STOCK_PUR",
            vendeur.id,
            t
          );
          if (caisseVendeur) {
            caisseVendeur.solde_actuel -= ancienneValeur;
            await caisseVendeur.save({ transaction: t });
          }
        }

        // 🔹 Déduire aussi la caisse de l’admin boutique
        if (boutique.utilisateurId) {
          const adminBoutique = await Utilisateur.findByPk(
            boutique.utilisateurId,
            { transaction: t }
          );

          if (adminBoutique) {
            const caisseAdmin = await getCaisseByType(
              "VALEUR_STOCK_PUR",
              adminBoutique.id,
              t
            );
            if (caisseAdmin) {
              caisseAdmin.solde_actuel -= ancienneValeur;
              await caisseAdmin.save({ transaction: t });
            }
          }
        }
      }

      // ⚠️ Ne pas supprimer — on marque comme annulé
      produit.status = "ANNULER";
      produit.commentaire =
        "Produit annulé par " +
        utilisateur.vcFirstname +
        " " +
        utilisateur.vcLastname +
        " le " +
        new Date().toLocaleString("fr-FR");
      await produit.save({ transaction: t });
    });

    res.status(200).json({ message: "Produit annulé avec succès." });
  } catch (error) {
    console.error("❌ Erreur lors de l'annulation du produit :", error);
    res.status(500).json({
      message: "Erreur interne du serveur.",
      error: error.message,
    });
  }
};

// ✅ Supprimer un produit (uniquement par admin)
const supprimerProduit = async (req, res) => {
  try {
    const { id } = req.params;
    const { utilisateurId, boutiqueId } = req.body;

    console.log(req.body);

    // Vérifier existence du produit
    const produit = await Produit.findByPk(id);
    if (!produit) {
      return res.status(404).json({ message: "Produit non trouvé." });
    }

    // Vérifier utilisateur admin
    const utilisateur = await Utilisateur.findByPk(utilisateurId);
    if (!utilisateur || utilisateur.roleId !== 1) {
      return res
        .status(403)
        .json({ message: "Seul l’administrateur peut supprimer un produit." });
    }

    // Ancienne valeur du stock
    const ancienneValeur = produit.prix_achat * produit.stock_actuel;

    // ✅ Transaction globale
    await sequelize.transaction(async (t) => {
      const boutique = await Boutique.findByPk(boutiqueId, { transaction: t });
      if (boutique) {
        // Récupérer tous les vendeurs de la boutique
        const vendeurs = await Utilisateur.findAll({
          where: { boutiqueId: boutique.id },
          transaction: t,
        });

        // 🧾 Déduire VALEUR_STOCK_PUR pour chaque vendeur
        for (const vendeur of vendeurs) {
          const caisseVendeur = await getCaisseByType(
            "VALEUR_STOCK_PUR",
            vendeur.id,
            t
          );
          if (caisseVendeur) {
            caisseVendeur.solde_actuel -= ancienneValeur;
            await caisseVendeur.save({ transaction: t });
          }
        }

        // 👨‍💼 Déduire la caisse de l’admin
        if (boutique.utilisateurId) {
          const adminBoutique = await Utilisateur.findByPk(
            boutique.utilisateurId,
            { transaction: t }
          );

          if (adminBoutique) {
            const caisseAdmin = await getCaisseByType(
              "VALEUR_STOCK_PUR",
              adminBoutique.id,
              t
            );
            if (caisseAdmin) {
              caisseAdmin.solde_actuel -= ancienneValeur;
              await caisseAdmin.save({ transaction: t });
            }
          }
        }
      }

      // 🗑️ Supprimer le produit
      await produit.destroy({ transaction: t });
    });

    res.status(200).json({ message: "Produit supprimé avec succès." });
  } catch (error) {
    console.error("❌ Erreur lors de la suppression du produit :", error);
    res.status(500).json({
      message: "Erreur interne du serveur.",
      error: error.message,
    });
  }
};

module.exports = {
  ajouterProduit,
  recupererProduitsBoutique,
  produitsEnAlerteStock,
  modifierProduit,
  supprimerProduit,
  annulerProduit,
};
