const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");

const Utilisateur = sequelize.define("Utilisateur", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  nom: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, unique: true },
  mot_de_passe: { type: DataTypes.STRING },
  roleId: { type: DataTypes.INTEGER, allowNull: false },
  boutiqueId: { type: DataTypes.INTEGER, allowNull: true },

  // 🔥 Champ qui manquait !
  adminId: { type: DataTypes.INTEGER, allowNull: true },
  otp: { type: DataTypes.INTEGER, allowNull: true },
});

module.exports = Utilisateur;
