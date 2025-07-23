
const Utilisateur = require('../models/utilisateur');
const Role = require('../models/role');
const jwt = require("jsonwebtoken");


const bcrypt = require('bcrypt');
const SECRET_KEY = 'cle_super_secrete';

const connexionUtilisateur = async (req, res) => {
  try {
    const { email, mot_de_passe } = req.body;
    const utilisateur = await Utilisateur.findOne({ where: { email } });

    if (!utilisateur) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    const match = await bcrypt.compare(mot_de_passe, utilisateur.mot_de_passe);
    if (!match) {
      return res.status(401).json({ message: 'Mot de passe incorrect.' });
    }

    const token = jwt.sign({
      id: utilisateur.id,
      id: utilisateur.id,
      role: utilisateur.role,   // si c’est un champ string direct
      email: utilisateur.email,
      nom: utilisateur.nom,
      role: utilisateur.role
    }, SECRET_KEY, { expiresIn: '2h' });
    res.status(200).json({ message: 'Connexion réussie.', token });
  } catch (error) {
    console.error('Erreur lors de la connexion :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// CONTROLLER / UTILISATEUR
const ajouterUtilisateur = async (req, res) => {
  try {
    const { nom, email, mot_de_passe, roleId } = req.body;
    if (!nom || !email || !mot_de_passe || !roleId) {
      return res.status(400).json({ message: 'Tous les champs sont obligatoires.' });
    }
    const hash = await bcrypt.hash(mot_de_passe, 10);
    const utilisateur = await Utilisateur.create({ nom, email, mot_de_passe: hash, roleId });
    res.status(201).json({ message: 'Utilisateur créé avec succès.', utilisateur });
  } catch (error) {
    console.error("Erreur lors de l'ajout de l'utilisateur :", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};




const recupererUtilisateurs = async (req, res) => {
  try {
    const utilisateurs = await Utilisateur.findAll(
      {
        include: [
          {
            model: Role,
            attributes: ['id', 'nom'],
          },
        ],
      }
    );
    res.status(200).json(utilisateurs);
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

const modifierUtilisateur = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, email, mot_de_passe } = req.body;
    const utilisateur = await Utilisateur.findByPk(id);
    if (!utilisateur) return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    await utilisateur.update({
      nom: nom || utilisateur.nom,
      email: email || utilisateur.email,
      mot_de_passe: mot_de_passe || utilisateur.mot_de_passe,
    });
    res.status(200).json({ message: 'Utilisateur mis à jour avec succès.', utilisateur });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de utilisateur :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Supprimer un Utilisateur
const supprimerUtilisateur = async (req, res) => {
  try {
    const { id } = req.params;
    const utilisateur = await Utilisateur.findByPk(id);
    if (!utilisateur) return res.status(404).json({ message: 'Utilisateur non trouvé.' });

    await utilisateur.destroy();
    res.status(200).json({ message: 'Utilisateur supprimé avec succès.' });
  } catch (error) {
    console.error('Erreur lors de la suppression du Utilisateur :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

module.exports = { ajouterUtilisateur, recupererUtilisateurs, modifierUtilisateur, connexionUtilisateur, supprimerUtilisateur };
