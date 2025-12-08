const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");

const ModificationProduit = sequelize.define("ModificationProduit", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  dateModification: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  nomUtilisateur: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  ancienStockActuel: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  nouveauStockActuel: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  ancienPrixAchat: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  nouveauPrixAchat: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  ancienPrixVente: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  nouveauPrixVente: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
});


module.exports = ModificationProduit;
