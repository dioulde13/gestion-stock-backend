const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");

const Utilisateur = sequelize.define('Utilisateur', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  nom: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, unique: true },
  mot_de_passe: { type: DataTypes.STRING },
  roleId: { type: DataTypes.INTEGER, allowNull: false },
  boutiqueId: { type: DataTypes.INTEGER, allowNull: true }, // vendeur lié à une seule boutique
  otp: { type: DataTypes.INTEGER },
});

module.exports = Utilisateur;
