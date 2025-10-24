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


Client.belongsTo(Boutique, { foreignKey: 'boutiqueId' });
Boutique.hasMany(Client, { foreignKey: 'boutiqueId' });

// =======================
// Relations Catégorie ↔ Utilisateur et Boutique
// =======================

// Une catégorie est créée par un utilisateur (souvent l'admin)
Categorie.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
Utilisateur.hasMany(Categorie, { foreignKey: 'utilisateurId' });

// Une boutique peut avoir plusieurs catégories
Categorie.belongsTo(Boutique, { foreignKey: 'boutiqueId' });
Boutique.hasMany(Categorie, { foreignKey: 'boutiqueId' });


// =======================
// Relations Utilisateur ↔ Boutique
// =======================

// Un admin peut créer plusieurs boutiques
Utilisateur.hasMany(Boutique, { as: "BoutiquesCreees", foreignKey: 'utilisateurId' });
Boutique.belongsTo(Utilisateur, { as: "Admin", foreignKey: 'utilisateurId' });

// Un vendeur appartient à une seule boutique
Utilisateur.belongsTo(Boutique, { as: "Boutique", foreignKey: 'boutiqueId' });
// Une boutique peut avoir plusieurs vendeurs
Boutique.hasMany(Utilisateur, { as: "Vendeurs", foreignKey: 'boutiqueId' });


// =======================
// Relations Notifications
// =======================
NotificationUser.belongsTo(Notification, { foreignKey: 'notificationId' });
Notification.hasMany(NotificationUser, { foreignKey: 'notificationId' });

NotificationUser.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
Utilisateur.hasMany(NotificationUser, { foreignKey: 'utilisateurId' });

Notification.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
Utilisateur.hasMany(Notification, { foreignKey: 'utilisateurId' });


// =======================
// Relations Utilisateur ↔ Caisse
// =======================
Caisse.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
Utilisateur.hasMany(Caisse, { foreignKey: 'utilisateurId' });


// =======================
// Relations Produits, Catégories, Boutique
// =======================
Categorie.hasMany(Produit, { foreignKey: 'categorieId' });
Produit.belongsTo(Categorie, { foreignKey: 'categorieId' });

Boutique.hasMany(Produit, { foreignKey: 'boutiqueId' });
Produit.belongsTo(Boutique, { foreignKey: 'boutiqueId' });


// =======================
// Relations Achats & Fournisseurs
// =======================
Achat.belongsTo(Fournisseur, { foreignKey: 'fournisseurId' });
Fournisseur.hasMany(Achat, { foreignKey: 'fournisseurId' });


// =======================
// Relations LigneVente / LigneAchat
// =======================
Produit.hasMany(LigneVente, { foreignKey: 'produitId' });
LigneVente.belongsTo(Produit, { foreignKey: 'produitId' });

Produit.hasMany(LigneAchat, { foreignKey: 'produitId' });
LigneAchat.belongsTo(Produit, { foreignKey: 'produitId' });

Vente.hasMany(LigneVente, { foreignKey: 'venteId' });
LigneVente.belongsTo(Vente, { foreignKey: 'venteId' });

Achat.hasMany(LigneAchat, { foreignKey: 'achatId' });
LigneAchat.belongsTo(Achat, { foreignKey: 'achatId' });


// =======================
// Relations Dépenses
// =======================
Depense.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
Utilisateur.hasMany(Depense, { foreignKey: 'utilisateurId' });


// =======================
// Relations Rôles
// =======================
Utilisateur.belongsTo(Role, { foreignKey: 'roleId' });
Role.hasMany(Utilisateur, { foreignKey: 'roleId' });


// =======================
// Relations Client & Vente
// =======================
Client.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
Utilisateur.hasMany(Client, { foreignKey: 'utilisateurId' });

Vente.belongsTo(Client, { foreignKey: 'clientId' });
Client.hasMany(Vente, { foreignKey: 'clientId' });


// =======================
// Relations Mouvement de stock
// =======================
Produit.hasMany(MouvementStock, { foreignKey: 'produitId' });
MouvementStock.belongsTo(Produit, { foreignKey: 'produitId' });

MouvementStock.belongsTo(TypeMvt, { foreignKey: 'typeMvtId' });
TypeMvt.hasMany(MouvementStock, { foreignKey: 'typeMvtId' });


// =======================
// Relations Credit et PayementCredit
// =======================
Credit.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
Utilisateur.hasMany(Credit, { foreignKey: 'utilisateurId' });

Credit.belongsTo(Client, { foreignKey: 'clientId' });
Client.hasMany(Credit, { foreignKey: 'clientId' });

PayementCredit.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
Utilisateur.hasMany(PayementCredit, { foreignKey: 'utilisateurId' });

PayementCredit.belongsTo(Credit, { foreignKey: 'creditId' });
Credit.hasMany(PayementCredit, { foreignKey: 'creditId' });


// =======================
// Export des modèles
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
