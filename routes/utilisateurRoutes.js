const express = require('express');
const router = express.Router();
const utilisateurController = require('../controllers/utilisateurController');

// --- UTILISATEUR ---
router.post('/create', utilisateurController.creerVendeur);
router.get('/liste', utilisateurController.recupererUtilisateurs);
router.put('/modifier/:id', utilisateurController.modifierUtilisateur);
router.put('/updatePassword', utilisateurController.changerMotDePasse);
router.post('/login', utilisateurController.connexionUtilisateur); 
router.delete('/supprimer/:id', utilisateurController.supprimerUtilisateur);
router.get('/profile', utilisateurController.getUtilisateurConnecte); 
router.put('/verifierOtp', utilisateurController.verifierOtp); 
router.put('/renvoyerOtp', utilisateurController.renvoyerOtp);
router.put('/debloquer', utilisateurController.debloquerUtilisateur);

module.exports = router;
