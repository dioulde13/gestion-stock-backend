const Categorie = require('../models/categorie');
const Utilisateur = require('../models/utilisateur');
const Role = require('../models/role');
const Boutique = require('../models/boutique');


const jwt = require('jsonwebtoken');

const ajouterCategorie = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ message: 'Aucun token fourni.' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const utilisateurConnecte = await Utilisateur.findByPk(decoded.id, {
      include: [{ model: Boutique, as: 'Boutique' }],
    });

    const { nom } = req.body;
    if (!nom) return res.status(400).json({ message: 'Le nom de la catégorie est obligatoire.' });

    let utilisateurId;
    let boutiqueId = null;

    if (utilisateurConnecte.roleId === 1) {
      // Admin : crée une catégorie pour lui-même
      utilisateurId = utilisateurConnecte.id;
    } else {
      // Vendeur : crée une catégorie au nom de son admin
      const boutique = await Boutique.findByPk(utilisateurConnecte.boutiqueId, {
        include: [{ model: Utilisateur, as: 'Admin' }],
      });
      if (!boutique || !boutique.Admin)
        return res.status(403).json({ message: 'Aucun administrateur trouvé pour cette boutique.' });

      utilisateurId = boutique.Admin.id;
      boutiqueId = boutique.id;
    }

    const categorie = await Categorie.create({ nom, utilisateurId, boutiqueId });
    res.status(201).json({ message: 'Catégorie créée avec succès.', categorie });
  } catch (error) {
    console.error('Erreur lors de la création de la catégorie :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

const recupererCategories = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ message: 'Aucun token fourni.' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const utilisateurConnecte = await Utilisateur.findByPk(decoded.id, {
      include: [{ model: Boutique, as: 'Boutique' }],
    });

    let categories;

    if (utilisateurConnecte.roleId === 1) {
      // ADMIN → ses propres catégories
      categories = await Categorie.findAll({
        where: { utilisateurId: utilisateurConnecte.id },
        include: [{ model: Utilisateur, attributes: ['id', 'nom', 'email'] }],
      });
    } else {
      // VENDEUR → catégories de l'admin de sa boutique
      const boutique = await Boutique.findByPk(utilisateurConnecte.boutiqueId, {
        include: [{ model: Utilisateur, as: 'Admin' }],
      });
      if (!boutique || !boutique.Admin)
        return res.status(403).json({ message: 'Aucun administrateur trouvé pour cette boutique.' });

      categories = await Categorie.findAll({
        where: { utilisateurId: boutique.Admin.id },
        include: [{ model: Utilisateur, attributes: ['id', 'nom', 'email'] }],
      });
    }

    res.status(200).json(categories);
  } catch (error) {
    console.error('Erreur lors de la récupération des catégories :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};


// Fonction pour consulter une seule catégorie par id
const consulterCategorie = async (req, res) => {
    try {
        const { id } = req.params;
        const categorie = await Categorie.findByPk(id, {
            include: [
                {
                    model: Utilisateur,
                    attributes: ['id', 'nom', 'email', 'roleId'],
                    include: [
                        {
                            model: Role,
                            attributes: ['id', 'nom']
                        }
                    ]
                }
            ]
        });
        if (!categorie) return res.status(404).json({ message: 'Catégorie non trouvée.' });
        res.status(200).json(categorie);
    } catch (error) {
        console.error('Erreur lors de la consultation de la catégorie :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

const modifierCategorie = async (req, res) => {
    try {
        const { id } = req.params;
        const { nom, utilisateurId } = req.body;
        const categorie = await Categorie.findByPk(id);
        if (!categorie) return res.status(404).json({ message: 'Catégorie non trouvée.' });

        await categorie.update({
            nom: nom || categorie.nom,
            utilisateurId: utilisateurId || categorie.utilisateurId,
        });
        res.status(200).json({ message: 'Catégorie mise à jour avec succès.', categorie });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la catégorie :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

// Fonction pour supprimer une catégorie par id
const supprimerCategorie = async (req, res) => {
    try {
        const { id } = req.params;
        const categorie = await Categorie.findByPk(id);
        if (!categorie) return res.status(404).json({ message: 'Catégorie non trouvée.' });

        await categorie.destroy();
        res.status(200).json({ message: 'Catégorie supprimée avec succès.' });
    } catch (error) {
        console.error('Erreur lors de la suppression de la catégorie :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

module.exports = {
    ajouterCategorie,
    recupererCategories,
    consulterCategorie,
    modifierCategorie,
    supprimerCategorie
};
