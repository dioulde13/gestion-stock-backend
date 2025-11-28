const RechargementCaisse = require("../models/rechargementCaisse");
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
    res.status(401).json({ message: "Token invalide ou expiré." });
    return null;
  }
};

/* ============================================================
   ✅ 1. Créer un rechargement (admin)
============================================================ */
const ajouterRechargementCaisse = async (req, res) => {
  const { montant, description , boutiqueId} = req.body;

  if (!montant || !description || !boutiqueId) {
    return res.status(400).json({ message: "Tous les champs sont obligatoires." });
  }

  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  if (utilisateur.Role.nom !== "ADMIN") {
    return res.status(403).json({
      message: "Seuls les admin peuvent créer un rechargement."
    });
  }

  try {
    await sequelize.transaction(async (t) => {
      const rechargementCaisse = await RechargementCaisse.create(
        {
          utilisateurId: utilisateur.id,
          boutiqueId: boutiqueId,
          montant,
          description,
          status: "EN_ATTENTE",
        },
        { transaction: t }
      );

      res.status(201).json({
        message: "Rechargement créé avec succès.",
        rechargementCaisse,
      });
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Erreur interne du serveur." });
  }
};

/* ============================================================
   ✅ 2. Valider un rechargement (vendeur)
============================================================ */
const validerRechargementCaisse = async (req, res) => {
  const { id } = req.params;
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  if (utilisateur.Role.nom === "ADMIN") {
    return res.status(403).json({
      message: "Seuls les vendeurs peuvent valider un rechargement."
    });
  }

  const t = await sequelize.transaction();

  try {
    const rechargementCaisse = await RechargementCaisse.findByPk(id, { transaction: t });
    if (!rechargementCaisse) {
      await t.rollback();
      return res.status(404).json({ message: "Rechargement caisse non trouvé." });
    }

    if (rechargementCaisse.status === "VALIDE") {
      await t.rollback();
      return res.status(400).json({ message: "Déjà validé." });
    }

    if (rechargementCaisse.status === "REJETE") {
      await t.rollback();
      return res.status(400).json({ message: "Déjà rejeté." });
    }

    const boutique = await Boutique.findByPk(utilisateur.boutiqueId, { transaction: t });

    if (!boutique) {
      await t.rollback();
      return res.status(404).json({ message: "Boutique introuvable." });
    }

    const vendeurs = await Utilisateur.findAll({
      where: { boutiqueId: boutique.id },
      transaction: t,
    });

    for (const v of vendeurs) {
      const caisse = await getCaisseByType("CAISSE", v.id, t);
      if (caisse) {
        caisse.solde_actuel += rechargementCaisse.montant;
        await caisse.save({ transaction: t });
      }
    }

    rechargementCaisse.status = "VALIDE";
    await rechargementCaisse.save({ transaction: t });

    await t.commit();

    const io = req.app.get("io");
    if (io) io.emit("caisseMisAJour");

    return res.status(200).json({
      message: "Rechargement validé avec succès.",
      rechargementCaisse,
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: error.message || "Erreur interne du serveur." });
  }
};

/* ============================================================
   ✅ 3. Rejeter un rechargement (admin)
============================================================ */
const rejeterRechargement = async (req, res) => {
  const { id } = req.params;
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  if (utilisateur.Role.nom !== "ADMIN") {
    return res.status(403).json({
      message: "Seul un responsable peut rejeter un rechargement."
    });
  }

  const t = await sequelize.transaction();

  try {
    const rechargementCaisse = await RechargementCaisse.findByPk(id, { transaction: t });

    if (!rechargementCaisse) {
      await t.rollback();
      return res.status(404).json({ message: "Rechargement non trouvé." });
    }

    if (rechargementCaisse.status === "REJETE") {
      await t.rollback();
      return res.status(400).json({ message: "Déjà rejeté." });
    }

    if (rechargementCaisse.status === "VALIDE") {
      await t.rollback();
      return res.status(400).json({
        message: "Impossible de rejeter un rechargement déjà validé."
      });
    }

    rechargementCaisse.status = "REJETE";
    await rechargementCaisse.save({ transaction: t });

    await t.commit();

    const io = req.app.get("io");
    if (io) io.emit("caisseMisAJour");

    return res.status(200).json({
      message: "Rechargement rejeté avec succès.",
      rechargementCaisse,
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: error.message || "Erreur interne du serveur." });
  }
};

/* ============================================================
   ✅ 4. Récupérer les rechargements selon le rôle
============================================================ */
const recupererRechargementCaisse = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    const utilisateurConnecte = await Utilisateur.findByPk(utilisateur.id, {
      include: [
        { model: Role, attributes: ["nom"] },
        { model: Boutique, as: "Boutique" },
      ],
    });

    if (!utilisateurConnecte) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    let idsUtilisateurs = [];

    if (utilisateurConnecte.Role.nom === "ADMIN") {
      const boutiques = await Boutique.findAll({
        where: { utilisateurId: utilisateurConnecte.id },
        include: [{ model: Utilisateur, as: "Vendeurs", attributes: ["id"] }],
      });

      for (const boutique of boutiques) {
        idsUtilisateurs.push(boutique.utilisateurId);
        boutique.Vendeurs.forEach((v) => idsUtilisateurs.push(v.id));
      }
    } else {
      const boutique = await Boutique.findByPk(utilisateurConnecte.boutiqueId, {
        include: [{ model: Utilisateur, as: "Vendeurs", attributes: ["id"] }],
      });

      if (boutique) {
        idsUtilisateurs.push(boutique.utilisateurId);
        boutique.Vendeurs.forEach((v) => idsUtilisateurs.push(v.id));
      }
    }

    const rechargementCaisse = await RechargementCaisse.findAll({
      where: { utilisateurId: idsUtilisateurs },
      include: [
        {
          model: Utilisateur,
          as: "vendeur",
          attributes: ["id", "nom", "email"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json(rechargementCaisse);
  } catch (error) {
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

module.exports = {
  ajouterRechargementCaisse,
  validerRechargementCaisse,
  rejeterRechargement,
  recupererRechargementCaisse,
};
