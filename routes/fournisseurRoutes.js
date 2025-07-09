const express = require('express');
const router = express.Router();
const fournisseurController = require('../controllers/fournisseurController');

router.post('/create', fournisseurController.ajouterFournisseur);
router.get('/liste', fournisseurController.recupererFournisseurs);
router.get('/consulter/:id', fournisseurController.consulterFournisseur);
router.put('/modifier/:id', fournisseurController.modifierFournisseur);
router.delete('/supprimer/:id', fournisseurController.supprimerFournisseur);

module.exports = router;
