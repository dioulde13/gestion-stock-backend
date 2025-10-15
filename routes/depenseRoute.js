const express = require('express');
const router = express.Router();
const depenseController = require('../controllers/depenseController');

router.post('/create', depenseController.ajouterDepense);
router.get('/liste', depenseController.recupererDepenses);
router.get('/consulter/:id', depenseController.consulterDepense);
router.put('/modifier/:id', depenseController.modifierDepense);
router.delete('/supprimer/:id', depenseController.supprimerDepense);

module.exports = router;
