const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');
const Utilisateur = require('./utilisateur');

const Caisse = sequelize.define('Caisse', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  utilisateurId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM(
      "CAISSE",       // Argent encaissé
      "PRINCIPALE",       // Argent encaissé lors des ventes
      "CREDIT_VENTE",     // Argent des ventes à crédit
      "VALEUR_STOCK",     // Valeur du stock + bénéfice
      "VALEUR_STOCK_PUR", // Valeur du stock sans bénéfice
      "BENEFICE",         // Bénéfice réalisé
      "BENEFICE_CREDIT",  // Bénéfice credit
      "CREDIT_ACHAT",     // Crédit pour achats
      "ACHAT_ESPACE",     // Argent utilisé pour acheter via espace
      "CREDIT_ESPECE",    // Argent crédité à quelqu'un en espèces Sortie
      "CREDIT_ESPECE_ENTRE"     // Argent crédité à quelqu'un en espèces Entre
    ),
    allowNull: false,
  },
  solde_actuel: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
});

Caisse.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });

module.exports = Caisse;
