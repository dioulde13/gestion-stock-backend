const TypeMvt = require('../models/typeMvt');

// Ajouter un type de mouvement
const ajouterTypeMvt = async (req, res) => {
  try {
    const { type } = req.body;
    if (!type) return res.status(400).json({ message: 'Le nom est obligatoire.' });

    const typeExistant = await TypeMvt.findOne({ where: { type } });
    if (typeExistant) return res.status(409).json({ message: 'Ce type existe déjà.' });

    const typeMvt = await TypeMvt.create({ type });
    res.status(201).json({ message: 'Type de mouvement créé.', typeMvt });
  } catch (error) {
    console.error("Erreur lors de l'ajout du type de mouvement :", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Récupérer tous les types de mouvements
const recupererTypesMvt = async (req, res) => {
  try {
    const types = await TypeMvt.findAll();
    res.status(200).json(types);
  } catch (error) {
    console.error("Erreur lors de la récupération des types de mouvement :", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Consulter un type de mouvement par ID
const consulterTypeMvt = async (req, res) => {
  try {
    const { id } = req.params;
    const typeMvt = await TypeMvt.findByPk(id);
    if (!typeMvt) return res.status(404).json({ message: 'Type de mouvement non trouvé.' });
    res.status(200).json(typeMvt);
  } catch (error) {
    console.error("Erreur lors de la consultation du type de mouvement :", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Modifier un type de mouvement
const modifierTypeMvt = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body;

    const typeMvt = await TypeMvt.findByPk(id);
    if (!typeMvt) return res.status(404).json({ message: 'Type de mouvement non trouvé.' });

    if (type) typeMvt.type = type;
    await typeMvt.save();

    res.status(200).json({ message: 'Type de mouvement mis à jour.', typeMvt });
  } catch (error) {
    console.error("Erreur lors de la modification du type de mouvement :", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Supprimer un type de mouvement
const supprimerTypeMvt = async (req, res) => {
  try {
    const { id } = req.params;
    const typeMvt = await TypeMvt.findByPk(id);
    if (!typeMvt) return res.status(404).json({ message: 'Type de mouvement non trouvé.' });

    await typeMvt.destroy();
    res.status(200).json({ message: 'Type de mouvement supprimé.' });
  } catch (error) {
    console.error("Erreur lors de la suppression du type de mouvement :", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

module.exports = {
  ajouterTypeMvt,
  recupererTypesMvt,
  consulterTypeMvt,
  modifierTypeMvt,
  supprimerTypeMvt
};
