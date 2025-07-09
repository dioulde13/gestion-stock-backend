const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');
const Produit = require('./produit');
const TypeMvt = require('./typeMvt');

const MouvementStock = sequelize.define('MouvementStock', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  quantite: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  produitId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  typeMvtId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  }
});

MouvementStock.belongsTo(Produit, { foreignKey: 'produitId' });
MouvementStock.belongsTo(TypeMvt, { foreignKey: 'typeMvtId' });

module.exports = MouvementStock;
