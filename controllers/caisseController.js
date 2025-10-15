// CONTROLLER / CAISSE
const Caisse = require('../models/caisse');
const Utilisateur = require('../models/utilisateur');
const Role = require('../models/role');
const jwt = require('jsonwebtoken');
// const { getCaisseByUser } = require("../utils/caisseUtils");

// Récupérer les caisses selon le rôle
const getCaisseParRole = async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(403).json({ message: "Accès refusé. Aucun token trouvé." });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const utilisateur = await Utilisateur.findByPk(decoded.id, { include: Role });
    if (!utilisateur) return res.status(404).json({ message: "Utilisateur non trouvé." });

    let caisses = [];

    if (utilisateur.Role.nom.toLowerCase() === "admin" || utilisateur.Role.nom.toLowerCase() === "vendeur") {
      caisses = await Caisse.findAll({ where: { utilisateurId: utilisateur.id } });
    }

    // Transformer les caisses pour ne garder que type et solde_actuel
    const caissesSimplifiees = {};
    caisses.forEach(c => {
      caissesSimplifiees[c.type] = c.solde_actuel;
    });

    res.status(200).json(caissesSimplifiees);

    // res.status(200).json(caisses);

  } catch (error) {
    console.error("Erreur getCaisseParRole :", error);
    res.status(500).json({ message: "Erreur lors de la récupération des caisses." });
  }
};

// Créer une caisse si elle n'existe pas
const ajouterCaisse = async (req, res) => {
  try {
    const { utilisateurId, type, solde_actuel } = req.body;
    if (!utilisateurId || !type || solde_actuel == null) return res.status(400).json({ message: 'Tous les champs sont obligatoires.' });

    const caisseExist = await Caisse.findOne({ where: { utilisateurId, type } });
    if (caisseExist) return res.status(400).json({ message: 'Une caisse de ce type existe déjà pour cet utilisateur.' });

    const caisse = await Caisse.create({ utilisateurId, type, solde_actuel });
    res.status(201).json({ message: 'Caisse créée avec succès.', caisse });
  } catch (error) {
    console.error('Erreur lors de la création de la caisse :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Récupérer toutes les caisses et les transformer
const recupererCaisses = async (req, res) => {
  try {
    const caisses = await Caisse.findAll({
      include: [{ model: Utilisateur, attributes: ['id', 'nom', 'email'] }],
    });

    // Transformer les caisses pour ne garder que type et solde_actuel
    const caissesSimplifiees = {};
    caisses.forEach(c => {
      caissesSimplifiees[c.type] = c.solde_actuel;
    });

    res.status(200).json(caissesSimplifiees);
  } catch (error) {
    console.error('Erreur lors de la récupération des caisses :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Récupérer une seule caisse par ID
const consulterCaisse = async (req, res) => {
  try {
    const { id } = req.params;
    const caisse = await Caisse.findByPk(id, {
      include: [{ model: Utilisateur, attributes: ['id', 'nom', 'email'] }],
    });

    if (!caisse) return res.status(404).json({ message: 'Caisse non trouvée.' });

    res.status(200).json(caisse);
  } catch (error) {
    console.error('Erreur lors de la récupération de la caisse :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Modifier une caisse
const modifierCaisse = async (req, res) => {
  try {
    const { id } = req.params;
    const { solde_actuel, utilisateurId } = req.body;

    const caisse = await Caisse.findByPk(id);
    if (!caisse) return res.status(404).json({ message: 'Caisse non trouvée.' });

    await Caisse.update(
      {
        solde_actuel: solde_actuel ?? caisse.solde_actuel,
        utilisateurId: utilisateurId ?? caisse.utilisateurId,
      },
      { where: { id } }
    );

    // Récupérer la caisse mise à jour
    const caisseModifiee = await Caisse.findByPk(id);

    res.status(200).json({ message: 'Caisse mise à jour avec succès.', caisse: caisseModifiee });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la caisse :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Supprimer une caisse
const supprimerCaisse = async (req, res) => {
  try {
    const { id } = req.params;
    const caisse = await Caisse.findByPk(id);

    if (!caisse) return res.status(404).json({ message: 'Caisse non trouvée.' });

    await caisse.destroy();
    res.status(200).json({ message: 'Caisse supprimée avec succès.' });
  } catch (error) {
    console.error('Erreur lors de la suppression de la caisse :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

module.exports = {
  ajouterCaisse,
  recupererCaisses,
  consulterCaisse,
  modifierCaisse,
  supprimerCaisse,
  getCaisseParRole
};
