const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');
const Produit = require('./produit');
const TypeMvt = require('./typeMvt');
const Utilisateur = require('./utilisateur');


const MouvementStock = sequelize.define('MouvementStock', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
   utilisateurId: {
    type: DataTypes.INTEGER,
    allowNull: false,
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

MouvementStock.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
MouvementStock.belongsTo(Produit, { foreignKey: 'produitId' });
MouvementStock.belongsTo(TypeMvt, { foreignKey: 'typeMvtId' });

module.exports = MouvementStock;
