const Categorie = require('../models/categorie');
const Utilisateur = require('../models/utilisateur');
const Role = require('../models/role');

const ajouterCategorie = async (req, res) => {
    try {
        const { nom, utilisateurId } = req.body;
        if (!nom || !utilisateurId) return res.status(400).json({ message: 'Le nom de la catégorie est obligatoire.' });
        const categorie = await Categorie.create({ nom, utilisateurId });
        res.status(201).json({ message: 'Catégorie créée avec succès.', categorie });
    } catch (error) {
        console.error('Erreur lors de la création de la catégorie :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

const recupererCategories = async (req, res) => {
    try {
        const categories = await Categorie.findAll({
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
