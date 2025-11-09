const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");
const Utilisateur = require("./utilisateur");
const Fournisseur = require("./fournisseur");

const Achat = sequelize.define("Achat", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  utilisateurId: {
    type: DataTypes.INTEGER,
    allowNull: false,
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
  },
  nomPersonneAnnuler: {
    type: DataTypes.STRING,
    allowNull: true,
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

Achat.belongsTo(Utilisateur, { foreignKey: "utilisateurId" });
Achat.belongsTo(Fournisseur, { foreignKey: "fournisseurId" });

module.exports = Achat;
