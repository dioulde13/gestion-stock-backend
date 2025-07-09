const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");

const Vente = sequelize.define('Vente', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  total: {
    type: DataTypes.FLOAT,
    allowNull: false,
  }
});

module.exports = Vente;
