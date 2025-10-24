const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');
const Categorie = require('./categorie');
const Utilisateur = require('./utilisateur');
const Boutique = require('./boutique');


const Produit = sequelize.define('Produit', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  utilisateurId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  categorieId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  }, 
   boutiqueId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  nom: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  prix_achat: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  prix_vente: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  stock_actuel: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  stock_minimum: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM("VALIDER", "ANNULER"),
    allowNull: false,
    defaultValue: "VALIDER",
  },
});

Produit.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
Produit.belongsTo(Categorie, { foreignKey: 'categorieId' });
Produit.belongsTo(Boutique, { foreignKey: 'boutiqueId' });

module.exports = Produit;
