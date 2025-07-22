const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');
const Utilisateur = require('./utilisateur');
const Credit = require('./credit');

const PayementCredit = sequelize.define('PayementCredit', {
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
    }
});

PayementCredit.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
Credit.belongsTo(Credit, { foreignKey: 'creditId' });


module.exports = PayementCredit;
