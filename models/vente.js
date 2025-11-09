const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");
const Utilisateur = require("./utilisateur");
const Client = require("./client");

const Vente = sequelize.define("Vente", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  utilisateurId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  clientId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  nomPersonneAnnuler: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  total: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM("ACHAT", "CREDIT"),
    allowNull: false,
    defaultValue: "ACHAT",
  },
  status: {
    type: DataTypes.ENUM("VALIDER", "ANNULER"),
    allowNull: false,
    defaultValue: "VALIDER",
  },
});

// Relations
Vente.belongsTo(Utilisateur, { foreignKey: "utilisateurId" });
Vente.belongsTo(Client, { foreignKey: "clientId", allowNull: true }); // relation optionnelle

module.exports = Vente;
