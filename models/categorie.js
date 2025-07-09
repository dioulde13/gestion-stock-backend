const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');
const Utilisateur = require('./utilisateur');


const Categorie = sequelize.define('Categorie', {
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
  }
});

Categorie.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });


module.exports = Categorie;
