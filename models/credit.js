const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');
const Utilisateur = require('./utilisateur');
const Client = require('./client');
const Boutique = require('./boutique'); // 🔥 à importer

const Credit = sequelize.define('Credit', {
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
        allowNull: false,
    },
     description: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    reference: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    montant: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    montantPaye: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
    },
    montantRestant: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0
    },
     beneficeCredit: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0
    },
    type: {
        type: DataTypes.ENUM("SORTIE", "ENTRE"),
        allowNull: false,
        defaultValue: "SORTIE",
    },
    typeCredit: {
        type: DataTypes.ENUM("ESPECE", "VENTE"),
        allowNull: false,
        defaultValue: "ESPECE",
    },
    status: {
        type: DataTypes.ENUM("NON PAYER", "PAYER", "EN COURS", "ANNULEE"),
        allowNull: false,
        defaultValue: "NON PAYER",
    },
     boutiqueId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Boutique,
      key: 'id',
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  },
});

Credit.belongsTo(Boutique, { foreignKey: 'boutiqueId' });

Credit.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
Credit.belongsTo(Client, { foreignKey: 'clientId' });


module.exports = Credit;
