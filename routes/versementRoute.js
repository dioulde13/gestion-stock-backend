const express = require('express');
const router = express.Router();
const versementController = require('../controllers/versementController');

router.post('/create', versementController.ajouterVersement);
router.get('/liste', versementController.recupererVersement);
router.put('/valider/:id', versementController.validerVersement);
router.put('/rejeter/:id', versementController.rejeterVersement);

module.exports = router;
