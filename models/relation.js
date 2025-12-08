const Categorie = require('./categorie');
const Produit = require('./produit');
const Utilisateur = require('./utilisateur');
const Role = require('./role');

const Vente = require('./vente');
const Achat = require('./achat');
const LigneVente = require('./ligneVente');
const LigneAchat = require('./ligneAchat');
const TypeMvt = require('./typeMvt');
const MouvementStock = require('./mouvementStock');
const Fournisseur = require('./fournisseur');
const Client = require('./client');
const Depense = require('./depense');
const Caisse = require('./caisse');
const Credit = require('./credit'); 
const PayementCredit = require('./payementCredit'); 
const NotificationUser = require('./notificationUser');
const Notification = require('./notification');
const Boutique = require('./boutique');
const ModificationProduit = require('./modificationProduit');


// ---- Historique de modification ----
Produit.hasMany(ModificationProduit, { foreignKey: "produitId" });
ModificationProduit.belongsTo(Produit, { foreignKey: "produitId" });

Utilisateur.hasMany(ModificationProduit, { foreignKey: "utilisateurId" });
ModificationProduit.belongsTo(Utilisateur, { foreignKey: "utilisateurId" });


// =====================================
// BOUTIQUE ↔ ENTITÉS MULTI-BOUTIQUE
// =====================================
Depense.belongsTo(Boutique, { foreignKey: 'boutiqueId' });
Boutique.hasMany(Depense, { foreignKey: 'boutiqueId' });

PayementCredit.belongsTo(Boutique, { foreignKey: 'boutiqueId' });
Boutique.hasMany(PayementCredit, { foreignKey: 'boutiqueId' });

Credit.belongsTo(Boutique, { foreignKey: 'boutiqueId' });
Boutique.hasMany(Credit, { foreignKey: 'boutiqueId' });

Client.belongsTo(Boutique, { foreignKey: 'boutiqueId' });
Boutique.hasMany(Client, { foreignKey: 'boutiqueId' });

MouvementStock.belongsTo(Boutique, { foreignKey: 'boutiqueId' });
Boutique.hasMany(MouvementStock, { foreignKey: 'boutiqueId' });


// =====================================
// ADMIN ↔ VENDEURS (Utilisateur)
// =====================================
Utilisateur.hasMany(Utilisateur, {
  foreignKey: "adminId",
  as: "Vendeurs"
});

Utilisateur.belongsTo(Utilisateur, {
  foreignKey: "adminId",
  as: "Admin"
});


// =====================================
// BOUTIQUE ↔ VENDEURS
// =====================================
Utilisateur.belongsTo(Boutique, {
  foreignKey: "boutiqueId",
  as: "Boutique"
});

Boutique.hasMany(Utilisateur, {
  foreignKey: "boutiqueId",
  as: "Vendeurs"
});


// =====================================
// BOUTIQUE ↔ ADMIN (plusieurs boutiques)
// =====================================
Boutique.belongsTo(Utilisateur, {
  foreignKey: "utilisateurId",
  as: "Admin"
});

Utilisateur.hasMany(Boutique, {
  foreignKey: "utilisateurId",
  as: "Boutiques"
});


// =====================================
// NOTIFICATIONS
// =====================================
NotificationUser.belongsTo(Notification, { foreignKey: 'notificationId' });
Notification.hasMany(NotificationUser, { foreignKey: 'notificationId' });

NotificationUser.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
Utilisateur.hasMany(NotificationUser, { foreignKey: 'utilisateurId' });

Notification.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
Utilisateur.hasMany(Notification, { foreignKey: 'utilisateurId' });


// =====================================
// UTILISATEUR ↔ CAISSE
// =====================================
Caisse.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
Utilisateur.hasMany(Caisse, { foreignKey: 'utilisateurId' });


// =====================================
// PRODUITS, CATEGORIES, BOUTIQUES
// =====================================
Categorie.hasMany(Produit, { foreignKey: 'categorieId' });
Produit.belongsTo(Categorie, { foreignKey: 'categorieId' });

Boutique.hasMany(Produit, { foreignKey: 'boutiqueId' });
Produit.belongsTo(Boutique, { foreignKey: 'boutiqueId' });

Produit.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
Utilisateur.hasMany(Produit, { foreignKey: 'utilisateurId' });


// =====================================
// ACHATS & FOURNISSEURS
// =====================================
Achat.belongsTo(Fournisseur, { foreignKey: 'fournisseurId' });
Fournisseur.hasMany(Achat, { foreignKey: 'fournisseurId' });


// =====================================
// LIGNE VENTE & LIGNE ACHAT
// =====================================
Produit.hasMany(LigneVente, { foreignKey: 'produitId' });
LigneVente.belongsTo(Produit, { foreignKey: 'produitId' });

Produit.hasMany(LigneAchat, { foreignKey: 'produitId' });
LigneAchat.belongsTo(Produit, { foreignKey: 'produitId' });

Vente.hasMany(LigneVente, { foreignKey: 'venteId' });
LigneVente.belongsTo(Vente, { foreignKey: 'venteId' });

Achat.hasMany(LigneAchat, { foreignKey: 'achatId' });
LigneAchat.belongsTo(Achat, { foreignKey: 'achatId' });


// =====================================
// DEPENSES
// =====================================
Depense.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
Utilisateur.hasMany(Depense, { foreignKey: 'utilisateurId' });


// =====================================
// ROLE ↔ UTILISATEUR
// =====================================
Utilisateur.belongsTo(Role, { foreignKey: 'roleId' });
Role.hasMany(Utilisateur, { foreignKey: 'roleId' });


// =====================================
// VENTES & CLIENTS
// =====================================
Client.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
Utilisateur.hasMany(Client, { foreignKey: 'utilisateurId' });

Vente.belongsTo(Client, { foreignKey: 'clientId' });
Client.hasMany(Vente, { foreignKey: 'clientId' });


// =====================================
// MOUVEMENT STOCK
// =====================================
Produit.hasMany(MouvementStock, { foreignKey: 'produitId' });
MouvementStock.belongsTo(Produit, { foreignKey: 'produitId' });

MouvementStock.belongsTo(TypeMvt, { foreignKey: 'typeMvtId' });
TypeMvt.hasMany(MouvementStock, { foreignKey: 'typeMvtId' });


// =====================================
// CREDIT & PAYEMENT CREDIT
// =====================================
Credit.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
Utilisateur.hasMany(Credit, { foreignKey: 'utilisateurId' });

Credit.belongsTo(Client, { foreignKey: 'clientId' });
Client.hasMany(Credit, { foreignKey: 'clientId' });

PayementCredit.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
Utilisateur.hasMany(PayementCredit, { foreignKey: 'utilisateurId' });

PayementCredit.belongsTo(Credit, { foreignKey: 'creditId' });
Credit.hasMany(PayementCredit, { foreignKey: 'creditId' });


// =======================
// Export
// =======================
module.exports = {
  Categorie,
  Produit,
  Vente,
  Achat,
  LigneVente,
  LigneAchat,
  Utilisateur,
  Boutique,
  Client,
  Credit,
  PayementCredit,
  Fournisseur,
  Role,
  TypeMvt,
  MouvementStock,
  Caisse,
  Depense,
  Notification,
  NotificationUser
};
