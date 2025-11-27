const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");
const Utilisateur = require("./utilisateur");
const Boutique = require("./boutique");

const Versement = sequelize.define(
  "Versement",
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

    type: {
      type: DataTypes.ENUM("ESPECE", "COMPTE BANCAIRE"),
      allowNull: false,
      defaultValue: "ESPECE",
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
    tableName: "versements",
    timestamps: true,
  }
);

// Associations
Versement.belongsTo(Utilisateur, {
  foreignKey: "utilisateurId",
  as: "vendeur",
});
Versement.belongsTo(Boutique, { foreignKey: "boutiqueId", as: "boutique" });

module.exports = Versement;
