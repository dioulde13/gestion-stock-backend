const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');

const Achat = sequelize.define('Achat', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  fournisseurId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  dateAchat: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  total: {
    type: DataTypes.FLOAT,
    allowNull: false,
  }
}
);

module.exports = Achat;

