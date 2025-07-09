// CONTROLLER / ROLE
const Role = require('../models/role');

const ajouterRole = async (req, res) => {
  try {
    const { nom } = req.body;
    if (!nom) return res.status(400).json({ message: 'Le nom du rôle est obligatoire.' });
    const role = await Role.create({ nom });
    res.status(201).json({ message: 'Rôle créé avec succès.', role });
  } catch (error) {
    console.error('Erreur lors de la création du rôle :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

const recupererRoles = async (req, res) => {
  try {
    const roles = await Role.findAll();
    res.status(200).json(roles);
  } catch (error) {
    console.error('Erreur lors de la récupération des rôles :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

const modifierRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom } = req.body;
    const role = await Role.findByPk(id);
    if (!role) return res.status(404).json({ message: 'Rôle non trouvé.' });
    await role.update({ nom: nom || role.nom });
    res.status(200).json({ message: 'Rôle mis à jour avec succès.', role });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du rôle :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

module.exports = { ajouterRole, recupererRoles, modifierRole };
