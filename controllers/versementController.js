const Versement = require("../models/versement");
const Role = require("../models/role");
const Utilisateur = require("../models/utilisateur");
const Boutique = require("../models/boutique");
const sequelize = require("../models/sequelize");
const jwt = require("jsonwebtoken");
const { getCaisseByType } = require("../utils/caisseUtils");

/* ============================================================
   🔐 Utilitaire : Récupérer l'utilisateur connecté depuis le token
============================================================ */
const getUserFromToken = async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    res.status(403).json({ message: "Accès refusé. Aucun token trouvé." });
    return null;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const utilisateur = await Utilisateur.findByPk(decoded.id, {
      include: Role,
    });
    if (!utilisateur) {
      res.status(404).json({ message: "Utilisateur non trouvé." });
      return null;
    }
    return utilisateur;
  } catch (error) {
    console.error("Erreur de vérification du token :", error);
    res.status(401).json({ message: "Token invalide ou expiré." });
    return null;
  }
};

/* ============================================================
   ✅ 1. Créer un versement (par un vendeur)
============================================================ */
const ajouterVersement = async (req, res) => {
  const { montant, description } = req.body;

  if (!montant || !description) {
    return res
      .status(400)
      .json({ message: "Tous les champs sont obligatoires." });
  }

  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  if (utilisateur.Role.nom !== "VENDEUR") {
    return res
      .status(403)
      .json({ message: "Seuls les vendeurs peuvent créer un versement." });
  }

  try {
    await sequelize.transaction(async (t) => {
      const versement = await Versement.create(
        {
          utilisateurId: utilisateur.id,
          boutiqueId: utilisateur.boutiqueId,
          montant,
          description,
          status: "EN_ATTENTE",
        },
        { transaction: t }
      );

      res
        .status(201)
        .json({ message: "Versement créé avec succès.", versement });
    });
  } catch (error) {
    console.error("Erreur lors de la création du versement :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/* ============================================================
   ✅ 2. Valider un versement (par le responsable)
============================================================ */
const validerVersement = async (req, res) => {
  const { id } = req.params;
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  if (utilisateur.Role.nom !== "ADMIN") {
    return res
      .status(403)
      .json({ message: "Seul un responsable peut valider un versement." });
  }

  const t = await sequelize.transaction();
  try {
    const versement = await Versement.findByPk(id, { transaction: t });
    if (!versement) {
      await t.rollback();
      return res.status(404).json({ message: "Versement non trouvé." });
    }

    // Empêcher toute modification si le versement est déjà validé ou rejeté
    if (versement.status === "VALIDÉ") {
      await t.rollback();
      return res.status(400).json({ message: "Ce versement a déjà été VALIDÉ et ne peut pas être rejeté." });
    }
    if (versement.status === "REJETÉ") {
      await t.rollback();
      return res.status(400).json({ message: "Ce versement a déjà été REJETÉ et ne peut pas être validé." });
    }

    // Vérifier que le versement est bien en attente
    if (versement.status !== "EN_ATTENTE") {
      await t.rollback();
      return res.status(400).json({ message: "Ce versement ne peut pas être traité." });
    }

    // 1️⃣ Caisse du vendeur
    const caisseVendeur = await getCaisseByType(
      "CAISSE",
      versement.utilisateurId,
      t
    );
    if (!caisseVendeur) {
      await t.rollback();
      return res.status(404).json({ message: "Caisse vendeur non trouvée." });
    }

    if (caisseVendeur.solde_actuel < versement.montant) {
      await t.rollback();
      return res.status(400).json({ message: "Solde insuffisant dans la caisse du vendeur." });
    }

    // 💰 Débit vendeur
    caisseVendeur.solde_actuel -= versement.montant;
    await caisseVendeur.save({ transaction: t });

    // ✅ Mise à jour du statut
    versement.status = "VALIDÉ";
    await versement.save({ transaction: t });

    await t.commit();

    // 🔔 Notification temps réel
    const io = req.app.get("io");
    if (io) io.emit("caisseMisAJour");

    res.status(200).json({ message: "Versement validé avec succès.", versement });
  } catch (error) {
    await t.rollback();
    console.error("Erreur lors de la validation du versement :", error);
    res.status(500).json({ message: error.message || "Erreur interne du serveur." });
  }
};


/* ============================================================
   ✅ 3. Rejeter un versement (par le responsable)
============================================================ */
const rejeterVersement = async (req, res) => {
  const { id } = req.params;
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  if (utilisateur.Role.nom !== "ADMIN") {
    return res
      .status(403)
      .json({ message: "Seul un responsable peut rejeter un versement." });
  }

  const t = await sequelize.transaction();
  try {
    const versement = await Versement.findByPk(id, { transaction: t });
    if (!versement) {
      await t.rollback();
      return res.status(404).json({ message: "Versement non trouvé." });
    }

    // Empêcher toute modification si déjà rejeté
    if (versement.status === "REJETÉ") {
      await t.rollback();
      return res.status(400).json({ message: "Ce versement est déjà REJETÉ et ne peut pas être traité." });
    }

    // Empêcher de rejeter un versement déjà validé si tu veux stricte interdiction
    if (versement.status === "VALIDÉ") {
      await t.rollback();
      return res.status(400).json({ message: "Ce versement est déjà VALIDÉ et ne peut pas être rejeté." });
    }

    // Versements EN_ATTENTE ou VALIDÉ peuvent être rejetés
    const caisseVendeur = await getCaisseByType(
      "CAISSE",
      versement.utilisateurId,
      t
    );
    if (!caisseVendeur) {
      await t.rollback();
      return res.status(404).json({ message: "Caisse vendeur non trouvée." });
    }

    // Si le versement était VALIDÉ, restituer le montant au vendeur
    if (versement.status === "VALIDÉ") {
      caisseVendeur.solde_actuel += versement.montant;
      await caisseVendeur.save({ transaction: t });

      // Optionnel : débit admin si tu as une caisse admin
      // const caisseAdmin = await getCaisseByType("ADMIN", adminId, t);
      // if (caisseAdmin) {
      //   caisseAdmin.solde_actuel -= versement.montant;
      //   await caisseAdmin.save({ transaction: t });
      // }
    }

    // Mettre à jour le statut en REJETÉ
    versement.status = "REJETÉ";
    await versement.save({ transaction: t });

    await t.commit();

    const io = req.app.get("io");
    if (io) io.emit("caisseMisAJour");

    res.status(200).json({
      message:
        versement.status === "VALIDÉ"
          ? "Versement rejeté et montants restitués."
          : "Versement rejeté (aucune transaction de caisse).",
      versement,
    });
  } catch (error) {
    await t.rollback();
    console.error("Erreur lors du rejet du versement :", error);
    res
      .status(500)
      .json({ message: error.message || "Erreur interne du serveur." });
  }
};


/* ============================================================
   ✅ 4. Récupérer les versements selon le rôle
============================================================ */
const recupererVersement = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    let whereClause = {};

    if (utilisateur.Role.nom === "ADMIN") {
      const boutique = await Boutique.findOne({
        where: { utilisateurId: utilisateur.id },
      });
      if (boutique) {
        whereClause.boutiqueId = boutique.id;
      } else {
        return res.status(404).json({ message: "Boutique non trouvée." });
      }
    } else if (utilisateur.Role.nom === "VENDEUR") {
      whereClause.utilisateurId = utilisateur.id;
    } else {
      return res.status(403).json({ message: "Rôle non autorisé." });
    }

    const versements = await Versement.findAll({
      where: whereClause,
      include: [
        {
          model: Utilisateur,
          as: "vendeur", 
          attributes: ["id", "nom", "email"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json(versements);
  } catch (error) {
    console.error("Erreur lors de la récupération des versements :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

module.exports = {
  ajouterVersement,
  validerVersement,
  rejeterVersement,
  recupererVersement,
};
