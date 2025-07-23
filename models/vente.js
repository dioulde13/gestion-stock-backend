const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");
const Utilisateur = require('./utilisateur');

const Vente = sequelize.define('Vente', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  utilisateurId: {
    type: DataTypes.INTEGER,
    allowNull: false,
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

Vente.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });

module.exports = Vente;
