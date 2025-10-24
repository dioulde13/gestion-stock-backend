const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');
const Utilisateur = require('./utilisateur');
const Boutique = require('./boutique');

const Client = sequelize.define('Client', {
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
      isEmail: {
        msg: 'Adresse email invalide.',
      },
    },
  },
}, {
  tableName: 'clients',
  timestamps: true,
});

// 🔗 Associations
Client.belongsTo(Utilisateur, {
  foreignKey: 'utilisateurId',
  as: 'utilisateur',
  onDelete: 'CASCADE',
});

Client.belongsTo(Boutique, {
  foreignKey: 'boutiqueId',
  as: 'boutique',
  onDelete: 'CASCADE',
});

module.exports = Client;
