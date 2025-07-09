const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

router.get('/statistique', dashboardController.dashboardStats);

module.exports = router;
