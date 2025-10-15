// CONTROLLER / DEPENSE
const Depense = require('../models/depense');
const Utilisateur = require('../models/utilisateur');

// Ajouter une dépense
const ajouterDepense = async (req, res) => {
  try {
    const { utilisateurId, montant, description } = req.body;

    if (!utilisateurId || !montant || !description) {
      return res.status(400).json({ message: 'Tous les champs sont obligatoires.' });
    }

    const depense = await Depense.create({
      utilisateurId,
      montant,
      description,
    });

    res.status(201).json({ message: 'Dépense créée avec succès.', depense });
  } catch (error) {
    console.error('Erreur lors de la création de la dépense :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Récupérer toutes les dépenses
const recupererDepenses = async (req, res) => {
  try {
    const depenses = await Depense.findAll({
      include: [{ model: Utilisateur, attributes: ['id', 'nom', 'email'] }],
    });
    res.status(200).json(depenses);
  } catch (error) {
    console.error('Erreur lors de la récupération des dépenses :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Récupérer une seule dépense par ID
const consulterDepense = async (req, res) => {
  try {
    const { id } = req.params;
    const depense = await Depense.findByPk(id, {
      include: [{ model: Utilisateur, attributes: ['id', 'nom', 'email'] }],
    });

    if (!depense) return res.status(404).json({ message: 'Dépense non trouvée.' });

    res.status(200).json(depense);
  } catch (error) {
    console.error('Erreur lors de la récupération de la dépense :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Modifier une dépense
const modifierDepense = async (req, res) => {
  try {
    const { id } = req.params;
    const { montant, description } = req.body;

    const depense = await Depense.findByPk(id);
    if (!depense) return res.status(404).json({ message: 'Dépense non trouvée.' });

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

// Supprimer une dépense
const supprimerDepense = async (req, res) => {
  try {
    const { id } = req.params;
    const depense = await Depense.findByPk(id);

    if (!depense) return res.status(404).json({ message: 'Dépense non trouvée.' });

    await depense.destroy();
    res.status(200).json({ message: 'Dépense supprimée avec succès.' });
  } catch (error) {
    console.error('Erreur lors de la suppression de la dépense :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

module.exports = {
  ajouterDepense,
  recupererDepenses,
  consulterDepense,
  modifierDepense,
  supprimerDepense,
};
