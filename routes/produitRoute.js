const express = require('express');
const router = express.Router();
const produitController = require('../controllers/produitController');

// Ajouter un produit
router.post('/create', produitController.ajouterProduit);

// Récupérer la liste des produits
router.get('/liste', produitController.recupererProduits);

router.get('/alert', produitController.produitsEnAlerteStock);

// Modifier un produit
router.put('/:id', produitController.modifierProduit);

router.delete('/supprimer/:id', produitController.supprimerProduit);


module.exports = router;