const express = require('express');
const router = express.Router();
const creditController = require('../controllers/creditController');

router.post('/create', creditController.ajouterCredit);
router.get('/liste', creditController.recupererCredits);
router.get('/consulter/:id', creditController.consulterCredit);
router.put('/modifier/:id', creditController.modifierCredit);
router.delete('/supprimer/:id', creditController.supprimerCredit);

module.exports = router;
