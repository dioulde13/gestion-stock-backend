const express = require('express');
const router = express.Router();
const payementCreditController = require('../controllers/payementCreditController');

router.post('/create', payementCreditController.ajouterPayementCredit);
router.get('/liste', payementCreditController.recupererPayementsCredit);
router.get('/consulter/:id', payementCreditController.consulterPayementCredit);
router.put('/modifier/:id', payementCreditController.modifierPayementCredit);
router.delete('/supprimer/:id', payementCreditController.supprimerPayementCredit);

module.exports = router;
