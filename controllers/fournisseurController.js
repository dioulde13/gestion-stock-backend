const Fournisseur = require('../models/fournisseur');
const Utilisateur = require('../models/utilisateur');

// Ajouter un fournisseur
const ajouterFournisseur = async (req, res) => {
  try {
    const { nom, telephone, adresse, email, utilisateurId } = req.body;

    if (!nom || !utilisateurId) {
      return res.status(400).json({ message: 'Le nom et l\'utilisateurId sont obligatoires.' });
    }

    const fournisseur = await Fournisseur.create({ nom, telephone, adresse, email, utilisateurId });

    res.status(201).json({ message: 'Fournisseur ajouté avec succès.', fournisseur });
  } catch (error) {
    console.error("Erreur lors de l'ajout du fournisseur :", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Récupérer tous les fournisseurs avec leurs utilisateurs
const recupererFournisseurs = async (req, res) => {
  try {
    const fournisseurs = await Fournisseur.findAll({
      include: [
        {
          model: Utilisateur,
          attributes: ['id', 'nom', 'email'],
        }
      ]
    });
    res.status(200).json(fournisseurs);
  } catch (error) {
    console.error('Erreur lors de la récupération des fournisseurs :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Consulter un fournisseur par ID avec utilisateur
const consulterFournisseur = async (req, res) => {
  try {
    const { id } = req.params;
    const fournisseur = await Fournisseur.findByPk(id, {
      include: [
        {
          model: Utilisateur,
          attributes: ['id', 'nom', 'email'],
        }
      ]
    });

    if (!fournisseur) return res.status(404).json({ message: 'Fournisseur non trouvé.' });

    res.status(200).json(fournisseur);
  } catch (error) {
    console.error('Erreur lors de la consultation du fournisseur :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Modifier un fournisseur
const modifierFournisseur = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, telephone, adresse, email, utilisateurId } = req.body;

    const fournisseur = await Fournisseur.findByPk(id);
    if (!fournisseur) return res.status(404).json({ message: 'Fournisseur non trouvé.' });

    await fournisseur.update({ nom, telephone, adresse, email, utilisateurId });

    res.status(200).json({ message: 'Fournisseur mis à jour avec succès.', fournisseur });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du fournisseur :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Supprimer un fournisseur
const supprimerFournisseur = async (req, res) => {
  try {
    const { id } = req.params;
    const fournisseur = await Fournisseur.findByPk(id);
    if (!fournisseur) return res.status(404).json({ message: 'Fournisseur non trouvé.' });

    await fournisseur.destroy();
    res.status(200).json({ message: 'Fournisseur supprimé avec succès.' });
  } catch (error) {
    console.error('Erreur lors de la suppression du fournisseur :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Optionnel : Lister les fournisseurs d’un utilisateur donné
const fournisseursParUtilisateur = async (req, res) => {
  try {
    const { utilisateurId } = req.params;

    const fournisseurs = await Fournisseur.findAll({
      where: { utilisateurId },
      include: [{ model: Utilisateur, attributes: ['id', 'nom', 'email'] }]
    });

    res.status(200).json(fournisseurs);
  } catch (error) {
    console.error('Erreur lors de la récupération des fournisseurs par utilisateur :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

module.exports = {
  ajouterFournisseur,
  recupererFournisseurs,
  consulterFournisseur,
  modifierFournisseur,
  supprimerFournisseur,
  fournisseursParUtilisateur, // Optionnel
};
