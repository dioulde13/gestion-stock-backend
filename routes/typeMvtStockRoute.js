const express = require('express');
const router = express.Router();
const typeController = require('../controllers/typeMvtController');

// --- ROLE ---
router.post('/create', typeController.ajouterTypeMvt);
router.get('/liste', typeController.recupererTypesMvt);
router.put('/:id', typeController.modifierTypeMvt);
router.put('/supprimer/:id', typeController.supprimerTypeMvt);

module.exports = router;