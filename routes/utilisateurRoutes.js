
const express = require('express');
const router = express.Router();
const utilisateurController = require('../controllers/utilisateurController');

// --- UTILISATEUR ---
router.post('/create', utilisateurController.ajouterUtilisateur);
router.get('/liste', utilisateurController.recupererUtilisateurs);
router.put('/:id', utilisateurController.modifierUtilisateur);
router.post('/login', utilisateurController.connexionUtilisateur);


module.exports = router;