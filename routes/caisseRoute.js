const express = require('express');
const router = express.Router();
const caisseController = require('../controllers/caisseController');

router.post('/create', caisseController.ajouterCaisse);
router.get('/liste', caisseController.recupererCaisses);
router.get('/listeParRole', caisseController.getCaisseParRole);
router.get('/consulter/:id', caisseController.consulterCaisse);
router.put('/modifier/:id', caisseController.modifierCaisse);
router.delete('/supprimer/:id', caisseController.supprimerCaisse);

module.exports = router;
