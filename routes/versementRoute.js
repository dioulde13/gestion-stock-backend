const express = require('express');
const router = express.Router();
const versementController = require('../controllers/versementController');

router.post('/create', versementController.ajouterVersement);
router.get('/liste', versementController.recupererVersement);
router.get('/valider/:id', versementController.validerVersement);
router.put('/rejeter/:id', versementController.rejeterVersement);
// router.delete('/supprimer/:id', depenseController.supprimerDepense);
// router.delete('/annuler/:id', depenseController.annulerDepense);

module.exports = router;
