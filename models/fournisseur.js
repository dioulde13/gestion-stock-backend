const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');
const Utilisateur = require('./utilisateur');


const Fournisseur = sequelize.define('Fournisseur', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
   utilisateurId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  nom: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  telephone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  adresse: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: true,
    },
  },
}
);

Fournisseur.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });


module.exports = Fournisseur;
