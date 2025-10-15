const Caisse = require("../models/caisse");

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
    "VALEUR_STOCK_PUR"
  ];

  let caisses = [];

  if (roleNom === "Admin") {
    // 🔑 Admin voit toutes les caisses
    caisses = await Caisse.findAll();
  } else {
    // 🔑 Autres rôles => seulement leurs caisses
    caisses = await Caisse.findAll({ where: { utilisateurId: userId } });
  }

  // Construire un objet initialisé à 0
  const result = {};
  types.forEach((t) => (result[t] = 0));

  // Remplir avec les vraies valeurs
  caisses.forEach((caisse) => {
    if (types.includes(caisse.type)) {
      result[caisse.type] = caisse.montant || 0;
    }
  });

  return result;
};

const getCaisseByType = async (type, utilisateurId, transaction) => {
  let caisse = await Caisse.findOne({
    where: { type, utilisateurId },
    transaction,
    lock: transaction.LOCK.UPDATE
  });

  // Si la caisse n’existe pas, on la crée avec un solde initial de 0
  if (!caisse) {
    caisse = await Caisse.create({
      type,
      utilisateurId,
      solde_actuel: 0
    }, { transaction });
  }

  return caisse;
};

module.exports = { getCaisseByUser, getCaisseByType };
