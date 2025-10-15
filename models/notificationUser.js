// models/notificationUser.js
const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");
const Notification = require("./notification");
const Utilisateur = require("./utilisateur");

const NotificationUser = sequelize.define("NotificationUser", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

// Relations
Notification.belongsToMany(Utilisateur, { through: NotificationUser, foreignKey: "notificationId" });
Utilisateur.belongsToMany(Notification, { through: NotificationUser, foreignKey: "utilisateurId" });

module.exports = NotificationUser;
