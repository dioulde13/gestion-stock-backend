const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');
const Vente = require('./vente');
const Produit = require('./produit');

const LigneVente = sequelize.define('LigneVente', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  quantite: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  prix_vente: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  produitId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  venteId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  }
});

LigneVente.belongsTo(Vente, { foreignKey: 'venteId' });
LigneVente.belongsTo(Produit, { foreignKey: 'produitId' });

module.exports = LigneVente;
