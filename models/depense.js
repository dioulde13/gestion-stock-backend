const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');
const Utilisateur = require('./utilisateur');
const Boutique = require('./boutique');

const Depense = sequelize.define('Depense', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
   utilisateurId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  montant: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false,
  },
   nomPersonneAnnuler: {
    type: DataTypes.STRING,
    allowNull: true,
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
  status: {
    type: DataTypes.ENUM("VALIDER", "ANNULER"),
    allowNull: false,
    defaultValue: "VALIDER",
  },
});

Depense.belongsTo(Boutique, { foreignKey: 'boutiqueId' });

Depense.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });

module.exports = Depense;
