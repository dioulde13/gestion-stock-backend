const Caisse = require("../models/caisse");

/**
 * Récupère les caisses d’un utilisateur (ou toutes si Admin)
 */
const getCaisseByUser = async (userId, roleNom) => {
  const types = [
    "ACHAT_ESPACE",
    "BENEFICE",
    "BENEFICE_CREDIT",
    "CAISSE",
    "CREDIT_ACHAT",
    "CREDIT_ESPECE",
    "CREDIT_ESPECE_ENTRE",
    "CREDIT_VENTE",
    "PRINCIPALE",
    "VALEUR_STOCK",
    "VALEUR_STOCK_PUR",
  ];

  let caisses = [];

  if (roleNom === "Admin") {
    // Admin voit toutes les caisses
    caisses = await Caisse.findAll();
  } else {
    // Autres rôles : uniquement leurs caisses
    caisses = await Caisse.findAll({
      where: { utilisateurId: userId },
    });
  }

  // Initialisation de la structure finale
  const result = {};
  types.forEach((t) => (result[t] = 0));

  // Remplir selon les caisses existantes
  caisses.forEach((caisse) => {
    if (types.includes(caisse.type)) {
      result[caisse.type] = caisse.solde_actuel || 0;
    }
  });

  return result;
};

/**
 * Récupère une caisse par type + utilisateur
 * Toujours utiliser la transaction pour éviter les deadlocks
 */
const getCaisseByType = async (type, utilisateurId, transaction) => {
  const options = {
    where: { type, utilisateurId },
  };

  // Si une transaction est fournie → appliquer le LOCK
  if (transaction) {
    options.transaction = transaction;
    options.lock = transaction.LOCK.UPDATE;
  }

  let caisse = await Caisse.findOne(options);

  // Si elle n’existe pas → la créer
  if (!caisse) {
    caisse = await Caisse.create(
      {
        type,
        utilisateurId,
        solde_actuel: 0,
      },
      { transaction }
    );
  }

  return caisse;
};

module.exports = {
  getCaisseByUser,
  getCaisseByType,
};
