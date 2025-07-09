const express = require('express');
const router = express.Router();
const categorieController = require('../controllers/categorieController');

// --- CATEGORIE ---
router.post('/create', categorieController.ajouterCategorie);
router.get('/liste', categorieController.recupererCategories);
router.get('/consulter/:id', categorieController.consulterCategorie);
router.delete('/supprimer/:id', categorieController.supprimerCategorie);
router.put('/:id', categorieController.modifierCategorie);

module.exports = router;