const Depense = require('../models/depense');
const Utilisateur = require('../models/utilisateur');
const Boutique = require('../models/boutique');
const Role = require('../models/role');
const sequelize = require('../models/sequelize');
const jwt = require('jsonwebtoken');
const { getCaisseByType } = require('../utils/caisseUtils'); 

// 🔐 Récupère l'utilisateur depuis le token
const getUserFromToken = async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    res.status(403).json({ message: "Accès refusé. Aucun token trouvé." });
    return null;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const utilisateur = await Utilisateur.findByPk(decoded.id, { include: Role });
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

// ✅ Ajouter une dépense
const ajouterDepense = async (req, res) => {
  const { montant, description } = req.body;

  if (!montant || !description) {
    return res.status(400).json({ message: 'Tous les champs sont obligatoires.' });
  }

  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  try {
    await sequelize.transaction(async (t) => {
      const caisseUtilisateur = await getCaisseByType('CAISSE', utilisateur.id, t);
      if (!caisseUtilisateur) throw new Error('Caisse non trouvée pour cet utilisateur.');
      if (montant > caisseUtilisateur.solde_actuel) throw new Error('Solde insuffisant.');

      let caisseAdminBoutique = null;
      const boutique = await Boutique.findByPk(utilisateur.boutiqueId, { transaction: t });
      if (boutique && boutique.utilisateurId) {
        caisseAdminBoutique = await getCaisseByType('CAISSE', boutique.utilisateurId, t);
      }

      // 3️⃣ Création de la dépense
      const depense = await Depense.create(
        {
          utilisateurId: utilisateur.id,
          montant,
          description,
          boutiqueId: utilisateur.boutiqueId,
        },
        { transaction: t }
      );

      // 4️⃣ Mise à jour des soldes
      caisseUtilisateur.solde_actuel -= montant;
      await caisseUtilisateur.save({ transaction: t });

      if (caisseAdminBoutique) {
        caisseAdminBoutique.solde_actuel -= montant;
        await caisseAdminBoutique.save({ transaction: t });
      }

      // ✅ 5️⃣ Émission Socket pour mettre à jour la caisse côté client
      const io = req.app.get("io"); // 📢 récupérer l'instance Socket.io
      io.emit("caisseMisAJour"); // 📢 avertir tous les clients connectés

      res.status(201).json({ message: 'Dépense créée avec succès.', depense });
    });
  } catch (error) {
    console.error('Erreur lors de la création de la dépense :', error.message || error);
    res.status(400).json({ message: error.message || 'Erreur interne du serveur.' });
  }
};


// ✅ Récupérer les dépenses selon le rôle
const recupererDepenses = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    let whereClause = {};

    if (utilisateur.Role.nom === "ADMIN") {
      // ADMIN → ses clients + ceux des vendeurs de sa boutique
      const boutique = await Boutique.findOne({ where: { utilisateurId: utilisateur.id } });
      if (boutique) {
        const vendeurs = await Utilisateur.findAll({
          where: { boutiqueId: boutique.id },
          attributes: ["id"],
        });
        const vendeursIds = vendeurs.map((v) => v.id);
        whereClause.utilisateurId = [utilisateur.id, ...vendeursIds];
      } else {
        whereClause.utilisateurId = utilisateur.id;
      }
    } else if (utilisateur.Role.nom === "VENDEUR") {
      // VENDEUR → uniquement ses depenses
      whereClause.utilisateurId = utilisateur.id;
    } else {
      return res.status(403).json({ message: "Rôle non autorisé." });
    }

    const depenses = await Depense.findAll({
      where: whereClause,
      include: [{ model: Utilisateur, attributes: ["id", "nom", "email"] }],
      order: [["id", "ASC"]],
    });

    res.status(200).json(depenses);
  } catch (error) {
    console.error('Erreur lors de la récupération des dépenses :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// ✅ Consulter une dépense
const consulterDepense = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    const { id } = req.params;

    const depense = await Depense.findByPk(id, {
      include: [{ model: Utilisateur, attributes: ['id', 'nom', 'email', 'boutiqueId'] }],
    });

    if (!depense) return res.status(404).json({ message: 'Dépense non trouvée.' });

    // Accès restreint
    if (
      utilisateur.Role.nom !== 'ADMIN' &&
      depense.utilisateurId !== utilisateur.id
    ) {
      return res.status(403).json({ message: 'Accès refusé à cette dépense.' });
    }

    if (
      utilisateur.Role.nom === 'ADMIN' &&
      depense.Utilisateur.boutiqueId !== utilisateur.boutiqueId
    ) {
      return res.status(403).json({ message: 'Dépense hors de votre boutique.' });
    }

    res.status(200).json(depense);
  } catch (error) {
    console.error('Erreur lors de la consultation de la dépense :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// ✅ Modifier une dépense
const modifierDepense = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    const { id } = req.params;
    const { montant, description } = req.body;

    const depense = await Depense.findByPk(id, {
      include: [{ model: Utilisateur, attributes: ['id', 'boutiqueId'] }],
    });

    if (!depense) return res.status(404).json({ message: 'Dépense non trouvée.' });

    if (
      utilisateur.Role.nom !== 'ADMIN' &&
      depense.utilisateurId !== utilisateur.id
    ) {
      return res.status(403).json({ message: 'Accès refusé à cette dépense.' });
    }

    await depense.update({
      montant: montant || depense.montant,
      description: description || depense.description,
    });

    res.status(200).json({ message: 'Dépense mise à jour avec succès.', depense });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la dépense :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// ✅ Supprimer une dépense
const supprimerDepense = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    const { id } = req.params;

    // 🔹 Récupération de la dépense avec son utilisateur
    const depense = await Depense.findByPk(id, {
      include: [{ model: Utilisateur, include: [Role] }],
      transaction: t,
    });

    if (!depense) {
      await t.rollback();
      return res.status(404).json({ message: "Dépense non trouvée." });
    }

    // 1️⃣ Caisse de l'utilisateur
    const caisseUtilisateur = await getCaisseByType("CAISSE", utilisateur.id, t);
    if (!caisseUtilisateur)
      throw new Error("Caisse non trouvée pour cet utilisateur.");

    // 2️⃣ Caisse de la boutique (admin principal)
    const boutique = await Boutique.findByPk(utilisateur.boutiqueId, { transaction: t });
    let caisseAdminBoutique = null;
    if (boutique?.utilisateurId) {
      caisseAdminBoutique = await getCaisseByType("CAISSE", boutique.utilisateurId, t);
    }

    // 💰 Remboursement de la dépense supprimée
    caisseUtilisateur.solde_actuel += depense.montant;
    await caisseUtilisateur.save({ transaction: t });

    if (caisseAdminBoutique) {
      caisseAdminBoutique.solde_actuel += depense.montant;
      await caisseAdminBoutique.save({ transaction: t });
    }

    // ✅ Suppression de la dépense
    await depense.destroy({ transaction: t });

    // ✅ Commit de la transaction
    await t.commit();

    // ✅ Émission socket pour mise à jour en temps réel
    const io = req.app.get("io");
    io.emit("caisseMisAJour");

    res.status(200).json({ message: "Dépense supprimée avec succès." });
  } catch (error) {
    await t.rollback();
    console.error("Erreur lors de la suppression de la dépense :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};


module.exports = {
  ajouterDepense,
  recupererDepenses,
  consulterDepense,
  modifierDepense,
  supprimerDepense,
};
