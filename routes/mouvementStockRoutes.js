const express = require('express');
const router = express.Router();
const mouvementStockController = require('../controllers/mouvementStockController'); // ✅ sans destructuring

router.post('/create', mouvementStockController.ajouterMouvementStock);
router.get('/liste', mouvementStockController.recupererMouvementsStock);
router.get('/consulter/:id', mouvementStockController.consulterMouvementStock);
router.delete('/supprimer/:id', mouvementStockController.supprimerMouvementStock); // ✅ corriger ici aussi !
// router.get('/mouvementStock/:produitId', mouvementStockController.afficherHistoriqueMouvementsProduit);
router.put('/modifier/:id', mouvementStockController.modifierMouvementStock);

module.exports = router;
