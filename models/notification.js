// models/notification.js
const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');
const Utilisateur = require('./utilisateur');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  utilisateurId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  message: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'info' // ex: 'vente', 'globale', 'info', etc.
  },
  montant: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  benefice: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  read: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
});

// Lier la notification à l'utilisateur
Notification.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });

module.exports = Notification;
