const jwt = require("jsonwebtoken");
const sequelize = require("../models/sequelize");
const { Op } = require("sequelize");
const MouvementStock = require("../models/mouvementStock");
const Produit = require("../models/produit");
const TypeMvt = require("../models/typeMvt");
const Utilisateur = require("../models/utilisateur");
const Role = require("../models/role");
const Boutique = require("../models/boutique");
const { getCaisseByType } = require("../utils/caisseUtils");

// Middleware pour récupérer l'utilisateur connecté depuis le token
async function getUserFromToken(req, res) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    res.status(403).json({ message: "Accès refusé. Aucun token trouvé." });
    return { status: true };
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    res.status(403).json({ message: "Accès refusé. Token manquant." });
    return { status: true };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const utilisateur = await Utilisateur.findByPk(decoded.id, {
      include: [{ model: Role }],
    });
    if (!utilisateur) {
      res.status(404).json({ message: "Utilisateur non trouvé." });
      return { status: true };
    }
    return utilisateur;
  } catch (error) {
    console.error("Erreur token :", error);
    res.status(401).json({ message: "Token invalide ou expiré." });
    return { status: true };
  }
}

const modifierMouvementStock = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur || utilisateur.status) return;

    const { id } = req.params;
    const { quantite, motif } = req.body;

    const mouvement = await MouvementStock.findByPk(id, { include: Produit });
    if (!mouvement)
      return res.status(404).json({ message: "Mouvement non trouvé." });

    // Vérification des droits
    if (
      utilisateur.Role.nom === "VENDEUR" &&
      mouvement.utilisateurId !== utilisateur.id
    )
      return res
        .status(403)
        .json({ message: "Vous ne pouvez modifier que vos mouvements." });

    if (utilisateur.Role.nom === "ADMIN") {
      // Admin peut modifier mouvements de ses boutiques uniquement
      const boutiquesAdmin = await Boutique.findAll({
        where: { utilisateurId: utilisateur.id },
      });
      const boutiqueIds = boutiquesAdmin.map((b) => b.id);
      if (!boutiqueIds.includes(mouvement.boutiqueId))
        return res
          .status(403)
          .json({ message: "Accès refusé pour ce mouvement." });
    }

    const typeMvt = await TypeMvt.findByPk(mouvement.typeMvtId);
    const produit = mouvement.Produit;
    const ancienneQuantite = mouvement.quantite;
    const prixAchat = produit.prix_achat || 0;

    const ancienneValeur = ancienneQuantite * prixAchat;
    const nouvelleValeur = quantite * prixAchat;

    // Vérification du stock si sortie
    if (typeMvt.type === "SORTIE") {
      const stockApresModification =
        produit.stock_actuel + ancienneQuantite - quantite;
      if (stockApresModification < 0)
        return res
          .status(400)
          .json({ message: "Stock insuffisant pour cette modification." });
    }

    await sequelize.transaction(async (t) => {
      // Ajustement du stock
      if (typeMvt.type === "ENTREE") {
        produit.stock_actuel =
          produit.stock_actuel - ancienneQuantite + quantite;
      } else if (typeMvt.type === "SORTIE") {
        produit.stock_actuel =
          produit.stock_actuel + ancienneQuantite - quantite;
      }
      await produit.save({ transaction: t });

      // Ajustement VALEUR_STOCK_PUR pour tous les utilisateurs concernés
      const boutique = await Boutique.findByPk(produit.boutiqueId, {
        transaction: t,
      });
      if (boutique) {
        let utilisateurs = await Utilisateur.findAll({
          where: { boutiqueId: boutique.id },
          transaction: t,
        });
        const admin = await Utilisateur.findByPk(boutique.utilisateurId, {
          transaction: t,
        });
        if (admin && !utilisateurs.some((u) => u.id === admin.id))
          utilisateurs.push(admin);

        const differenceValeur =
          typeMvt.type === "ENTREE"
            ? nouvelleValeur - ancienneValeur
            : ancienneValeur - nouvelleValeur;

        for (const u of utilisateurs) {
          const caisseVSP = await getCaisseByType("VALEUR_STOCK_PUR", u.id, t);
          if (caisseVSP) {
            caisseVSP.solde_actuel += differenceValeur;
            await caisseVSP.save({ transaction: t });
          }
        }
      }

      // Mise à jour du mouvement
      mouvement.quantite = quantite;
      mouvement.motif = motif;
      await mouvement.save({ transaction: t });
    });

    res
      .status(200)
      .json({ message: "Mouvement modifié avec succès.", mouvement });
  } catch (error) {
    console.error("Erreur lors de la modification du mouvement :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/**
 * Ajouter un mouvement de stock
 */
const ajouterMouvementStock = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur || utilisateur.status) return;

    const { produitId, quantite, motif, typeMvtId } = req.body;
    if (!produitId || quantite == null || !motif || !typeMvtId) {
      return res
        .status(400)
        .json({ message: "Tous les champs sont obligatoires." });
    }

    const produit = await Produit.findByPk(produitId, { include: Boutique });
    if (!produit)
      return res.status(404).json({ message: "Produit non trouvé." });

    const typeMvt = await TypeMvt.findByPk(typeMvtId);
    if (!typeMvt)
      return res.status(404).json({ message: "Type de mouvement non trouvé." });

    // Vérification de la boutique
    if (
      utilisateur.Role.nom === "VENDEUR" &&
      produit.boutiqueId !== utilisateur.boutiqueId
    ) {
      return res
        .status(403)
        .json({ message: "Ce produit n'appartient pas à votre boutique." });
    }

    const result = await sequelize.transaction(async (t) => {
      const prixAchat = produit.prix_achat || 0;
      const montant = quantite * prixAchat;

      // Mise à jour du stock
      if (typeMvt.type === "ENTRE") produit.stock_actuel += quantite;
      else if (typeMvt.type === "SORTIE") {
        if (produit.stock_actuel < quantite)
          throw new Error("Stock insuffisant pour cette sortie.");
        produit.stock_actuel -= quantite;
      } else throw new Error("Type de mouvement inconnu.");

      await produit.save({ transaction: t });

      // Mise à jour VALEUR_STOCK_PUR pour tous les utilisateurs concernés
      const boutique = await Boutique.findByPk(produit.boutiqueId, {
        transaction: t,
      });
      if (boutique) {
        const utilisateursBoutique = await Utilisateur.findAll({
          where: { boutiqueId: boutique.id },
          transaction: t,
        });
        // Ajouter admin si pas déjà dans la liste
        const admin = await Utilisateur.findByPk(boutique.utilisateurId, {
          transaction: t,
        });
        if (admin && !utilisateursBoutique.some((u) => u.id === admin.id))
          utilisateursBoutique.push(admin);

        for (const u of utilisateursBoutique) {
          const caisseVSP = await getCaisseByType("VALEUR_STOCK_PUR", u.id, t);
          if (caisseVSP) {
            caisseVSP.solde_actuel +=
              typeMvt.type === "ENTRE" ? montant : -montant;
            await caisseVSP.save({ transaction: t });
          }
        }
      }

      const mouvement = await MouvementStock.create(
        {
          produitId,
          quantite,
          motif,
          typeMvtId,
          status: "VALIDER",
          utilisateurId: utilisateur.id,
          boutiqueId: produit.boutiqueId,
          date: new Date(),
        },
        { transaction: t }
      );

      return { mouvement, produit };
    });

    res.status(201).json({
      message: "Mouvement de stock ajouté avec succès.",
      mouvement: result.mouvement,
      stock_actuel: result.produit.stock_actuel,
    });
  } catch (error) {
    console.error("Erreur lors de l'ajout du mouvement de stock :", error);
    if (error.message.includes("Stock insuffisant"))
      return res.status(400).json({ message: error.message });
    return res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/**
 * Récupérer les mouvements de stock
 */
const recupererMouvementsStock = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur || utilisateur.status) return;

    const { produitId } = req.query;
    const where = {};

    if (produitId) where.produitId = produitId;

    const utilisateurConnecte = await Utilisateur.findByPk(utilisateur.id, {
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

    const mouvements = await MouvementStock.findAll({
      where: { utilisateurId: idsUtilisateurs },
      order: [["date", "DESC"]],
      include: [
        { model: Produit, attributes: ["id", "nom", "boutiqueId"] },
        { model: TypeMvt, attributes: ["id", "type"] },
        {
          model: Utilisateur,
          attributes: ["id", "nom", "email"],
          include: Role,
        },
      ],
    });

    res.json(mouvements);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * Consulter un mouvement spécifique
 */
const consulterMouvementStock = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur || utilisateur.status) return;

    const { id } = req.params;
    const mouvement = await MouvementStock.findByPk(id, {
      include: [
        { model: Produit, attributes: ["id", "nom", "boutiqueId"] },
        { model: TypeMvt, attributes: ["id", "nom", "type"] },
        { model: Utilisateur, attributes: ["id", "nom"], include: Role },
      ],
    });
    if (!mouvement)
      return res.status(404).json({ message: "Mouvement non trouvé." });

    if (
      utilisateur.Role.nom === "VENDEUR" &&
      mouvement.boutiqueId !== utilisateur.boutiqueId
    ) {
      return res
        .status(403)
        .json({ message: "Accès refusé à cette ressource." });
    }

    res.status(200).json(mouvement);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/**
 * Annuler un mouvement
 */
const annulerMouvementStock = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur || utilisateur.status) return;

    const { id } = req.params;
    const mouvement = await MouvementStock.findByPk(id, { include: Produit });
    if (!mouvement)
      return res.status(404).json({ message: "Mouvement non trouvé." });

    if (
      utilisateur.Role.nom === "VENDEUR" &&
      mouvement.boutiqueId !== utilisateur.boutiqueId
    )
      return res
        .status(403)
        .json({ message: "Accès refusé à cette ressource." });

    if (mouvement.status === "ANNULER")
      return res
        .status(400)
        .json({ message: "Ce mouvement a déjà été annulé." });

    const typeMvt = await TypeMvt.findByPk(mouvement.typeMvtId);
    const produit = mouvement.Produit;
    const montant = mouvement.quantite * (produit.prix_achat || 0);

    await sequelize.transaction(async (t) => {
      produit.stock_actuel +=
        typeMvt.type === "ENTRE" ? -mouvement.quantite : mouvement.quantite;
      await produit.save({ transaction: t });

      const boutique = await Boutique.findByPk(produit.boutiqueId, {
        transaction: t,
      });
      if (boutique) {
        const utilisateurs = await Utilisateur.findAll({
          where: { boutiqueId: boutique.id },
          transaction: t,
        });
        const admin = await Utilisateur.findByPk(boutique.utilisateurId, {
          transaction: t,
        });
        if (admin && !utilisateurs.some((u) => u.id === admin.id))
          utilisateurs.push(admin);

        for (const u of utilisateurs) {
          const caisseVSP = await getCaisseByType("VALEUR_STOCK_PUR", u.id, t);
          if (caisseVSP) {
            caisseVSP.solde_actuel +=
              typeMvt.type === "ENTRE" ? -montant : montant;
            await caisseVSP.save({ transaction: t });
          }
        }
      }

      mouvement.status = "ANNULER";
      mouvement.nomPersonneAnnuler = utilisateur.nom;
      mouvement.commentaire = `Mouvement annulé par ${
        utilisateur.nom
      } le ${new Date().toLocaleString()}`;
      await mouvement.save({ transaction: t });
    });

    res.status(200).json({ message: "Mouvement annulé avec succès." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/**
 * Supprimer un mouvement
 */
const supprimerMouvementStock = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur || utilisateur.status) return;

    const { id } = req.params;
    const mouvement = await MouvementStock.findByPk(id, { include: Produit });
    if (!mouvement)
      return res.status(404).json({ message: "Mouvement non trouvé." });

    if (
      utilisateur.Role.nom === "VENDEUR" &&
      mouvement.boutiqueId !== utilisateur.boutiqueId
    )
      return res
        .status(403)
        .json({ message: "Accès refusé à cette ressource." });

    const typeMvt = await TypeMvt.findByPk(mouvement.typeMvtId);
    const produit = mouvement.Produit;
    const montant = mouvement.quantite * (produit.prix_achat || 0);

    await sequelize.transaction(async (t) => {
      produit.stock_actuel +=
        typeMvt.type === "ENTREE" ? -mouvement.quantite : mouvement.quantite;
      await produit.save({ transaction: t });

      const boutique = await Boutique.findByPk(produit.boutiqueId, {
        transaction: t,
      });
      if (boutique) {
        const utilisateurs = await Utilisateur.findAll({
          where: { boutiqueId: boutique.id },
          transaction: t,
        });
        const admin = await Utilisateur.findByPk(boutique.utilisateurId, {
          transaction: t,
        });
        if (admin && !utilisateurs.some((u) => u.id === admin.id))
          utilisateurs.push(admin);

        for (const u of utilisateurs) {
          const caisseVSP = await getCaisseByType("VALEUR_STOCK_PUR", u.id, t);
          if (caisseVSP) {
            caisseVSP.solde_actuel +=
              typeMvt.type === "ENTREE" ? -montant : montant;
            await caisseVSP.save({ transaction: t });
          }
        }
      }

      await mouvement.destroy({ transaction: t });
    });

    res.status(200).json({ message: "Mouvement supprimé avec succès." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

module.exports = {
  ajouterMouvementStock,
  recupererMouvementsStock,
  consulterMouvementStock,
  annulerMouvementStock,
  supprimerMouvementStock,
  modifierMouvementStock,
};
