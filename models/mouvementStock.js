const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');
const Produit = require('./produit');
const TypeMvt = require('./typeMvt');
const Utilisateur = require('./utilisateur');
const Boutique = require('./boutique');


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
  motif: {
    type: DataTypes.STRING,
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
  },
  boutiqueId: {
  type: DataTypes.INTEGER,
  allowNull: false,
},
status: {
    type: DataTypes.ENUM("VALIDER", "ANNULER"),
    allowNull: false,
    defaultValue: "VALIDER",
  },

})


MouvementStock.belongsTo(Boutique, { foreignKey: 'boutiqueId' });
MouvementStock.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
MouvementStock.belongsTo(Produit, { foreignKey: 'produitId' });
MouvementStock.belongsTo(TypeMvt, { foreignKey: 'typeMvtId' });

module.exports = MouvementStock;
