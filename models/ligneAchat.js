const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');
const Achat = require('./achat');
const Produit = require('./produit');

const LigneAchat = sequelize.define('LigneAchat', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  quantite: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  prix_achat: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  produitId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  achatId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  }
});

LigneAchat.belongsTo(Achat, { foreignKey: 'achatId' });
LigneAchat.belongsTo(Produit, { foreignKey: 'produitId' });

module.exports = LigneAchat;
