const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');
const Utilisateur = require('./utilisateur');

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
    reference: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    nom: {
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
    }, // Nouveau champ
    montantRestant: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0
    },
    type: {
        type: DataTypes.ENUM("CASH", "OM"),
        allowNull: false,
        defaultValue: "CASH",
    },
});

Credit.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });


module.exports = Credit;
