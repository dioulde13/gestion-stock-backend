const Categorie = require('./categorie');
const Produit = require('./produit');
const Vente = require('./vente');
const Achat = require('./achat');
const LigneVente = require('./ligneVente');
const LigneAchat = require('./ligneAchat');
const Utilisateur = require('./utilisateur');
const Role = require('./role');
const TypeMvt = require('./typeMvt');
const MouvementStock = require('./mouvementStock');
const Fournisseur = require('./fournisseur');


// Relations principales
Categorie.hasMany(Produit, { foreignKey: 'categorieId' });
Produit.belongsTo(Categorie, { foreignKey: 'categorieId' });

Achat.belongsTo(Fournisseur, { foreignKey: 'fournisseurId' });
Fournisseur.hasMany(Achat, { foreignKey: 'fournisseurId' });

Produit.hasMany(LigneVente, { foreignKey: 'produitId' });
LigneVente.belongsTo(Produit, { foreignKey: 'produitId' });

Produit.hasMany(LigneAchat, { foreignKey: 'produitId' });
LigneAchat.belongsTo(Produit, { foreignKey: 'produitId' });

Vente.hasMany(LigneVente, { foreignKey: 'venteId' });

// Vente.hasMany(LigneVente, { foreignKey: 'venteId' });
// LigneVente.belongsTo(Vente, { foreignKey: 'venteId' });

Achat.hasMany(LigneAchat, { foreignKey: 'achatId' });
LigneAchat.belongsTo(Achat, { foreignKey: 'achatId' });

Utilisateur.belongsTo(Role, { foreignKey: 'roleId' });
Role.hasMany(Utilisateur, { foreignKey: 'roleId' });

Produit.hasMany(MouvementStock, { foreignKey: 'produitId' });
MouvementStock.belongsTo(Produit, { foreignKey: 'produitId' });

MouvementStock.belongsTo(TypeMvt, { foreignKey: 'typeMvtId' });
TypeMvt.hasMany(MouvementStock, { foreignKey: 'typeMvtId' });

module.exports = {
  Categorie,
  Produit,
  Vente,
  Achat,
  LigneVente,
  LigneAchat,
  Utilisateur,
  Fournisseur,
  Role,
  TypeMvt,
  MouvementStock
};