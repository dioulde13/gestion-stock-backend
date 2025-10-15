// controllers/notificationController.js
const Notification = require("../models/notification");
const NotificationUser = require("../models/notificationUser");
const { Op } = require("sequelize");

const recupererNotifications = async (req, res) => {
  try {
    const utilisateurId = Number(req.params.utilisateurId);

    const notifications = await Notification.findAll({
      where: {
        [Op.or]: [
          { utilisateurId },       // notifications spécifiques
          { utilisateurId: null }  // notifications globales
        ],
      },
      include: [
        {
          model: NotificationUser,
          where: { utilisateurId },
          required: false,
        }
      ],
      order: [["createdAt", "DESC"]],
    });

    const result = notifications.map(n => ({
      id: n.id,
      message: n.message,
      type: n.type,
      montant: n.montant,
      benefice: n.benefice,
      timestamp: n.createdAt,
      read: n.NotificationUsers?.[0]?.read ?? false,
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error("Erreur lors de la récupération des notifications :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

const markAsRead = async (req, res) => {
  try {
    const notificationId = Number(req.params.id);
    const { utilisateurId } = req.body;

    if (!utilisateurId) {
      return res.status(400).json({ message: "utilisateurId manquant" });
    }

    // upsert : crée ou met à jour la ligne
    await NotificationUser.upsert({
      notificationId,
      utilisateurId,
      read: true,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Erreur markAsRead :", err);
    res.status(500).json({ message: "Impossible de marquer la notification comme lue" });
  }
};

module.exports = { recupererNotifications , markAsRead};
