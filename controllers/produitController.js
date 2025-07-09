const Produit = require('../models/produit');
const Categorie = require('../models/categorie');
const Utilisateur = require('../models/utilisateur');
const { Op } = require('sequelize');
const { Sequelize } = require("sequelize");



const produitsEnAlerteStock = async (req, res) => {
    try {
        const produits = await Produit.findAll({
            where: {
                stock_actuel: {
                    [Sequelize.Op.lte]: Sequelize.col('stock_minimum')
                } 
            },
            attributes: ['id', 'nom','prix_achat','prix_vente', 'stock_actuel', 'stock_minimum']
        });

        res.status(200).json(produits);
    } catch (error) {
        console.error("Erreur lors de la récupération des produits en alerte stock :", error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

// Récupérer les produits (corrigé : inclure correctement plusieurs modèles)
const recupererProduits = async (req, res) => {
  try {
    const produits = await Produit.findAll({
      include: [
        {
          model: Categorie,
          attributes: ['id', 'nom'],
        },
        {
          model: Utilisateur,
          attributes: ['id', 'nom'],
        },
      ],
    });

    if (produits.length === 0) {
      return res.status(404).json({ message: 'Aucun produit trouvé.' });
    }

    res.status(200).json(produits);
  } catch (error) {
    console.error('Erreur lors de la récupération des produits :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Ajouter un produit
const ajouterProduit = async (req, res) => {
  try {
    const { nom, prix_achat, prix_vente, stock_actuel, stock_minimum, categorieId, utilisateurId } = req.body;

    if (!nom || !prix_achat || !prix_vente) {
      return res.status(400).json({ message: 'Les champs nom, prix_achat et prix_vente sont obligatoires.' });
    }

    const produit = await Produit.create({ 
      nom,
      prix_achat,
      prix_vente,
      stock_actuel: stock_actuel || 0,
      stock_minimum: stock_minimum || 0,
      categorieId,
      utilisateurId
    });

    res.status(201).json({ message: 'Produit créé avec succès.', produit });
  } catch (error) {
    console.error("Erreur lors de l'ajout du produit :", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Modifier un produit
const modifierProduit = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, description, prix_achat, prix_vente, stock_actuel, stock_minimum, categorieId, utilisateurId } = req.body;

    const produit = await Produit.findByPk(id);
    if (!produit) {
      return res.status(404).json({ message: 'Produit non trouvé.' });
    }

    await produit.update({
      nom: nom || produit.nom,
      description: description || produit.description,
      prix_achat: prix_achat || produit.prix_achat,
      prix_vente: prix_vente || produit.prix_vente,
      stock_actuel: stock_actuel || produit.stock_actuel,
      stock_minimum: stock_minimum || produit.stock_minimum, 
      categorieId: categorieId || produit.categorieId,
      utilisateurId: utilisateurId || produit.utilisateurId,
    });

    res.status(200).json({ message: 'Produit mis à jour avec succès.', produit });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du produit :", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Consulter un produit par ID
const consulterProduit = async (req, res) => {
  try {
    const { id } = req.params;
    const produit = await Produit.findByPk(id, {
      include: [
        { model: Categorie, attributes: ['id', 'nom'] },
        { model: Utilisateur, attributes: ['id', 'nom'] }
      ]
    });
    if (!produit) return res.status(404).json({ message: 'Produit non trouvé.' });

    res.status(200).json(produit);
  } catch (error) {
    console.error("Erreur lors de la consultation du produit :", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Supprimer un produit
const supprimerProduit = async (req, res) => {
  try {
    const { id } = req.params;
    const produit = await Produit.findByPk(id);
    if (!produit) return res.status(404).json({ message: 'Produit non trouvé.' });

    await produit.destroy();
    res.status(200).json({ message: 'Produit supprimé avec succès.' });
  } catch (error) {
    console.error("Erreur lors de la suppression du produit :", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

module.exports = {
  produitsEnAlerteStock,
  ajouterProduit,
  recupererProduits,
  modifierProduit,
  supprimerProduit,
  consulterProduit
};
