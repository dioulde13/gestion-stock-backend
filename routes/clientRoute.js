const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

router.post('/create', clientController.ajouterClient);
router.get('/liste', clientController.recupererClients);
router.get('/consulter/:id', clientController.consulterClient);
router.put('/modifier/:id', clientController.modifierClient);
router.delete('/supprimer/:id', clientController.supprimerClient);

module.exports = router;
