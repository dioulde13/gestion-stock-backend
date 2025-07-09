const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");
const Role = require('./role');

const Utilisateur = sequelize.define('Utilisateur', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nom: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
  },
  mot_de_passe: {
    type: DataTypes.STRING,
  },
  roleId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  }
});

Utilisateur.belongsTo(Role, { foreignKey: 'roleId' });

module.exports = Utilisateur;
