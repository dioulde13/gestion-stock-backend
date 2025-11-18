const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");

const Boutique = sequelize.define("Boutique", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  nom: { type: DataTypes.STRING, allowNull: false },
  adresse: { type: DataTypes.STRING, allowNull: false },
  utilisateurId: { type: DataTypes.INTEGER, allowNull: false }, // admin
});

module.exports = Boutique;
