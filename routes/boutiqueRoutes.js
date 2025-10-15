const express = require('express');
const router = express.Router();
const boutiqueController = require('../controllers/boutiqueController');

router.post('/create', boutiqueController.creerBoutiqueAvecAdmin); 
router.get('/liste', boutiqueController.recupererBoutiques);
router.get('/listeBoutiqueParAdmin', boutiqueController.recupererBoutiquesParAdmin);
router.get('/consulter/:id', boutiqueController.consulterBoutique);
router.put('/modifier/:id', boutiqueController.modifierBoutique);
router.delete('/supprimer/:id', boutiqueController.supprimerBoutique);

module.exports = router;
