const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');
const Utilisateur = require('./utilisateur');
const Boutique = require('./boutique'); // 🔥 à importer

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
}
);

Fournisseur.belongsTo(Boutique, { foreignKey: 'boutiqueId' });

Fournisseur.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });


module.exports = Fournisseur;
