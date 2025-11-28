const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");
const Utilisateur = require("./utilisateur");
const Boutique = require("./boutique");

const RechargementCaisse = sequelize.define(
  "RechargementCaisse",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    utilisateurId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Utilisateur,
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
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

    montant: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },

    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("EN_ATTENTE", "VALIDE", "REJETE"),
      allowNull: false,
      defaultValue: "EN_ATTENTE",
      comment: ` 
      EN_ATTENTE → versement créé, en attente de validation 
      VALIDE     → versement confirmé 
      REJETE     → versement refusé ou annulé
    `,
    },
  },
  {
    tableName: "rechargements_caisses",
    timestamps: true,
  }
);

// Associations
RechargementCaisse.belongsTo(Utilisateur, {
  foreignKey: "utilisateurId",
  as: "vendeur",
});

RechargementCaisse.belongsTo(Boutique, {
  foreignKey: "boutiqueId",
  as: "boutique",
});

// Associations
// RechargementCaisse.belongsTo(Utilisateur, { foreignKey: "adminId", as: "admin" });
// RechargementCaisse.belongsTo(Utilisateur, { foreignKey: "vendeurId", as: "vendeur" });
// RechargementCaisse.belongsTo(Boutique, { foreignKey: "boutiqueId", as: "boutique" });

module.exports = RechargementCaisse;
