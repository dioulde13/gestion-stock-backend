const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');

// --- ROLE ---
router.post('/create', roleController.ajouterRole);
router.get('/liste', roleController.recupererRoles);
router.put('/:id', roleController.modifierRole);

module.exports = router;