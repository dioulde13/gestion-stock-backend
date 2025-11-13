const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');
const Utilisateur = require('./utilisateur');
const Boutique = require('./boutique');

const Versement = sequelize.define('Versement', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  utilisateurId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Utilisateur,
      key: 'id',
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
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
  montant: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('EN_ATTENTE', 'VALIDÉ', 'REJETÉ'),
    allowNull: false,
    defaultValue: 'EN_ATTENTE',
    comment: `
      EN_ATTENTE → le vendeur a créé le versement
      VALIDÉ → le responsable a confirmé la réception
      REJETÉ → le versement a été refusé ou annulé
    `,
  },
}, {
  tableName: 'versements',
  timestamps: true,
});

Versement.belongsTo(Utilisateur, { foreignKey: 'utilisateurId', as: 'vendeur' });
Versement.belongsTo(Boutique, { foreignKey: 'boutiqueId', as: 'boutique' });

module.exports = Versement;
