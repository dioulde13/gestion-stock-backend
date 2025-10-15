// routes/notification.js
const express = require("express");
const router = express.Router();
const { recupererNotifications, markAsRead } = require("../controllers/notificationController");

// Récupérer notifications pour un utilisateur
router.get("/:utilisateurId", recupererNotifications);

// Marquer notification comme lue
router.patch("/markAsRead/:id", markAsRead);

module.exports = router;
