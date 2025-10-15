const express = require('express');
const router = express.Router();
const utilisateurController = require('../controllers/utilisateurController');

// --- UTILISATEUR ---
router.post('/create', utilisateurController.creerVendeur);
router.get('/liste', utilisateurController.recupererUtilisateurs);
router.put('/:id', utilisateurController.modifierUtilisateur);
router.post('/login', utilisateurController.connexionUtilisateur);
router.delete('/supprimer/:id', utilisateurController.supprimerUtilisateur);
router.post('/generate/otp', utilisateurController.otpGenererController);
router.post('/verifier/otp', utilisateurController.verifierOtp);
router.get('/profile', utilisateurController.getUtilisateurConnecte);

module.exports = router;
