const express = require('express');
const router = express.Router();
const rechargementCaisseController = require('../controllers/rechargementCaisseController');

router.post('/create', rechargementCaisseController.ajouterRechargementCaisse);
router.get('/liste', rechargementCaisseController.recupererRechargementCaisse);
router.put('/valider/:id', rechargementCaisseController.validerRechargementCaisse);
router.put('/rejeter/:id', rechargementCaisseController.rejeterRechargement);

module.exports = router;
