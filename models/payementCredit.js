const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");
const Utilisateur = require("./utilisateur");
const Credit = require("./credit");
const Boutique = require("./boutique");

const PayementCredit = sequelize.define("PayementCredit", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  creditId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  utilisateurId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  montant: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  boutiqueId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Boutique,
      key: "id",
    },
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  },
  nomPersonneAnnuler: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM("VALIDER", "ANNULER"),
    allowNull: false,
    defaultValue: "VALIDER",
  },
});

PayementCredit.belongsTo(Boutique, { foreignKey: "boutiqueId" });
PayementCredit.belongsTo(Utilisateur, { foreignKey: "utilisateurId" });
PayementCredit.belongsTo(Credit, { foreignKey: "creditId" });

module.exports = PayementCredit;
