const Depense = require("../models/depense");
const Utilisateur = require("../models/utilisateur");
const Boutique = require("../models/boutique");
const Role = require("../models/role");
const sequelize = require("../models/sequelize");
const jwt = require("jsonwebtoken");
const { getCaisseByType } = require("../utils/caisseUtils");

// 🔐 Récupérer l'utilisateur depuis le token
const getUserFromToken = async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader)
    return res
      .status(403)
      .json({ message: "Accès refusé. Aucun token trouvé." });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const utilisateur = await Utilisateur.findByPk(decoded.id, {
      include: Role,
    });
    if (!utilisateur)
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    return utilisateur;
  } catch (error) {
    console.error("Erreur de vérification du token :", error);
    return res.status(401).json({ message: "Token invalide ou expiré." });
  }
};

// ➕ Ajouter une dépense
const ajouterDepense = async (req, res) => {
  const { montant, description } = req.body;
  if (!montant || !description)
    return res
      .status(400)
      .json({ message: "Tous les champs sont obligatoires." });

  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  try {
    await sequelize.transaction(async (t) => {
      const caisseUtilisateur = await getCaisseByType(
        "CAISSE",
        utilisateur.id,
        t
      );
      if (!caisseUtilisateur)
        throw new Error("Caisse non trouvée pour cet utilisateur.");
      if (montant > caisseUtilisateur.solde_actuel)
        throw new Error("Solde insuffisant.");

      const boutique = await Boutique.findByPk(utilisateur.boutiqueId, {
        transaction: t,
      });
      let caisseAdminBoutique = null;
      if (boutique?.utilisateurId) {
        caisseAdminBoutique = await getCaisseByType(
          "CAISSE",
          boutique.utilisateurId,
          t
        );
      }

      const depense = await Depense.create(
        {
          utilisateurId: utilisateur.id,
          boutiqueId: utilisateur.boutiqueId,
          montant,
          description,
        },
        { transaction: t }
      );

      const vendeurs = await Utilisateur.findAll({
        where: { boutiqueId: boutique.id },
        transaction: t,
      });
      for (const vendeur of vendeurs) {
        const caisseUtilisateur = await getCaisseByType(
          "CAISSE",
          vendeur.id,
          t
        );
        caisseUtilisateur.solde_actuel -= montant;
        await caisseUtilisateur.save({ transaction: t });
      }

      if (caisseAdminBoutique) {
        caisseAdminBoutique.solde_actuel -= montant;
        await caisseAdminBoutique.save({ transaction: t });
      }

      const io = req.app.get("io");
      io.emit("caisseMisAJour");

      res.status(201).json({ message: "Dépense créée avec succès.", depense });
    });
  } catch (error) {
    console.error(
      "Erreur lors de l'ajout de la dépense :",
      error.message || error
    );
    res
      .status(400)
      .json({ message: error.message || "Erreur interne du serveur." });
  }
};

// 📜 Récupérer les dépenses selon le rôle
const recupererDepenses = async (req, res) => {
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  try {
    // 🔹 Récupération de l'utilisateur avec son rôle et sa boutique
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

    const depenses = await Depense.findAll({
      where: { utilisateurId: idsUtilisateurs },
      include: [{ model: Utilisateur, attributes: ["id", "nom", "email"] }],
      order: [["id", "ASC"]],
    });

    res.status(200).json(depenses);
  } catch (error) {
    console.error("Erreur lors de la récupération des dépenses :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

// 🔍 Consulter une dépense
const consulterDepense = async (req, res) => {
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  try {
    const { id } = req.params;
    const depense = await Depense.findByPk(id, {
      include: [
        { model: Utilisateur, attributes: ["id", "nom", "boutiqueId"] },
      ],
    });
    if (!depense)
      return res.status(404).json({ message: "Dépense non trouvée." });

    if (
      utilisateur.Role.nom === "VENDEUR" &&
      depense.utilisateurId !== utilisateur.id
    )
      return res.status(403).json({ message: "Accès refusé à cette dépense." });

    if (utilisateur.Role.nom === "ADMIN") {
      const boutique = await Boutique.findByPk(depense.Utilisateur.boutiqueId);
      if (
        boutique?.utilisateurId !== utilisateur.id &&
        depense.utilisateurId !== utilisateur.id
      )
        return res
          .status(403)
          .json({ message: "Dépense hors de votre boutique." });
    }

    res.status(200).json(depense);
  } catch (error) {
    console.error("Erreur lors de la consultation de la dépense :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

// ✏️ Modifier une dépense
const modifierDepense = async (req, res) => {
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  try {
    const { id } = req.params;
    const { montant, description } = req.body;

    const depense = await Depense.findByPk(id, {
      include: [{ model: Utilisateur, attributes: ["id", "boutiqueId"] }],
    });
    if (!depense)
      return res.status(404).json({ message: "Dépense non trouvée." });

    if (
      utilisateur.Role.nom === "VENDEUR" &&
      depense.utilisateurId !== utilisateur.id
    )
      return res.status(403).json({ message: "Accès refusé à cette dépense." });

    if (utilisateur.Role.nom === "ADMIN") {
      const boutique = await Boutique.findByPk(depense.Utilisateur.boutiqueId);
      if (
        boutique?.utilisateurId !== utilisateur.id &&
        depense.utilisateurId !== utilisateur.id
      )
        return res
          .status(403)
          .json({ message: "Dépense hors de votre boutique." });
    }

    await depense.update({
      montant: montant || depense.montant,
      description: description || depense.description,
    });

    res
      .status(200)
      .json({ message: "Dépense mise à jour avec succès.", depense });
  } catch (error) {
    console.error("Erreur lors de la modification de la dépense :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

// 🗑️ Supprimer une dépense
const supprimerDepense = async (req, res) => {
  const t = await sequelize.transaction();
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  try {
    const { id } = req.params;
    const depense = await Depense.findByPk(id, {
      include: [{ model: Utilisateur, attributes: ["id", "boutiqueId"] }],
      transaction: t,
    });
    if (!depense) {
      await t.rollback();
      return res.status(404).json({ message: "Dépense non trouvée." });
    }

    if (
      utilisateur.Role.nom === "VENDEUR" &&
      depense.utilisateurId !== utilisateur.id
    )
      return res.status(403).json({ message: "Suppression non autorisée." });

    if (utilisateur.Role.nom === "ADMIN") {
      const boutique = await Boutique.findByPk(depense.Utilisateur.boutiqueId);
      if (
        boutique?.utilisateurId !== utilisateur.id &&
        depense.utilisateurId !== utilisateur.id
      )
        return res
          .status(403)
          .json({ message: "Dépense hors de votre boutique." });
    }

    const caisseUtilisateur = await getCaisseByType(
      "CAISSE",
      utilisateur.id,
      t
    );
    const boutique = await Boutique.findByPk(utilisateur.boutiqueId, {
      transaction: t,
    });
    let caisseAdminBoutique = null;
    if (boutique?.utilisateurId)
      caisseAdminBoutique = await getCaisseByType(
        "CAISSE",
        boutique.utilisateurId,
        t
      );

    caisseUtilisateur.solde_actuel += depense.montant;
    await caisseUtilisateur.save({ transaction: t });
    if (caisseAdminBoutique) {
      caisseAdminBoutique.solde_actuel += depense.montant;
      await caisseAdminBoutique.save({ transaction: t });
    }

    await depense.destroy({ transaction: t });
    await t.commit();

    const io = req.app.get("io");
    io.emit("caisseMisAJour");

    res.status(200).json({ message: "Dépense supprimée avec succès." });
  } catch (error) {
    await t.rollback();
    console.error("Erreur lors de la suppression de la dépense :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

// 🔄 Annuler une dépense
const annulerDepense = async (req, res) => {
  const t = await sequelize.transaction();
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  try {
    const { id } = req.params;
    const depense = await Depense.findByPk(id, {
      include: [{ model: Utilisateur, attributes: ["id", "boutiqueId"] }],
      transaction: t,
    });
    if (!depense) {
      await t.rollback();
      return res.status(404).json({ message: "Dépense non trouvée." });
    }
    if (depense.status === "ANNULER") {
      await t.rollback();
      return res
        .status(400)
        .json({ message: "Cette dépense est déjà annulée." });
    }

    if (
      utilisateur.Role.nom === "VENDEUR" &&
      depense.utilisateurId !== utilisateur.id
    )
      return res.status(403).json({ message: "Annulation non autorisée." });

    if (utilisateur.Role.nom === "ADMIN") {
      const boutique = await Boutique.findByPk(depense.Utilisateur.boutiqueId);
      if (
        boutique?.utilisateurId !== utilisateur.id &&
        depense.utilisateurId !== utilisateur.id
      )
        return res
          .status(403)
          .json({ message: "Dépense hors de votre boutique." });
    }

    const montant = depense.montant;
    const caisseUtilisateur = await getCaisseByType(
      "CAISSE",
      utilisateur.id,
      t
    );
    const boutique = await Boutique.findByPk(utilisateur.boutiqueId, {
      transaction: t,
    });
    let caisseAdminBoutique = null;
    if (boutique?.utilisateurId)
      caisseAdminBoutique = await getCaisseByType(
        "CAISSE",
        boutique.utilisateurId,
        t
      );

    caisseUtilisateur.solde_actuel += montant;
    await caisseUtilisateur.save({ transaction: t });
    if (caisseAdminBoutique) {
      caisseAdminBoutique.solde_actuel += montant;
      await caisseAdminBoutique.save({ transaction: t });
    }

    depense.status = "ANNULER";
    await depense.save({ transaction: t });
    await t.commit();

    const io = req.app.get("io");
    io.emit("caisseMisAJour");

    res.status(200).json({ message: "Dépense annulée avec succès." });
  } catch (error) {
    await t.rollback();
    console.error("Erreur lors de l'annulation de la dépense :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

module.exports = {
  ajouterDepense,
  recupererDepenses,
  consulterDepense,
  modifierDepense,
  supprimerDepense,
  annulerDepense,
};
