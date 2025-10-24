const express = require('express');
const router = express.Router();
const achatController = require('../controllers/achatController');


router.post('/create', achatController.creerAchat);
router.get('/liste', achatController. recupererAchats);
// router.get('/consulter/:id', achatController.consulterAchat);
router.delete('/supprimer/:id', achatController.supprimerAchat);

module.exports = router;
