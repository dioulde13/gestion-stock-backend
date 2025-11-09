const express = require('express');
const router = express.Router();
const venteController = require('../controllers/venteController');

router.get('/produitsPlusVendus', venteController.produitsPlusVendus);
router.post('/create', venteController.creerVente);
router.get('/liste', venteController.recupererVentes);
router.get('/consulter/:id', venteController.consulterVente);
router.delete('/supprimer/:id', venteController.supprimerVente);
router.put('/annuler/:id', venteController.annulerVente);

module.exports = router;
