const MouvementStock = require('../models/mouvementStock');
const Produit = require('../models/produit');
const TypeMvt = require('../models/typeMvt');
const Utilisateur = require('../models/utilisateur');
const Caisse = require('../models/caisse');
const sequelize = require('../models/sequelize');


const ajouterMouvementStock = async (req, res) => {
  try {
    const { produitId, quantite, motif, typeMvtId, utilisateurId } = req.body;

    if (!produitId || quantite == null || !motif || !typeMvtId || !utilisateurId) {
      return res.status(400).json({ message: 'Tous les champs sont obligatoires.' });
    }

    const produit = await Produit.findByPk(produitId);
    if (!produit) {
      return res.status(404).json({ message: 'Produit non trouvé.' });
    }

    const typeMvt = await TypeMvt.findByPk(typeMvtId);
    if (!typeMvt) {
      return res.status(404).json({ message: 'Type de mouvement non trouvé.' });
    }

    // On fait tout dans une transaction
    const result = await sequelize.transaction(async (t) => {
      // Récupérer ou créer la caisse pour l’utilisateur
      let caisse = await Caisse.findOne({
        where: { utilisateurId, type: "VALEUR_STOCK_PUR" },
        transaction: t
      });
      if (!caisse) {
        caisse = await Caisse.create({
          utilisateurId,
          solde_actuel: 0,
          type: "VALEUR_STOCK_PUR"
        }, { transaction: t });
      }

      // Calculer le montant à ajuster sur la caisse
      const prixAchat = produit.prix_achat || 0;
      const montant = quantite * prixAchat;

      // Appliquer le mouvement de stock
      if (typeMvt.type === 'ENTRE') {
        produit.stock_actuel += quantite;
        caisse.solde_actuel += montant;

      } else if (typeMvt.type === 'SORTIE') {
        if (produit.stock_actuel < quantite) {
          throw new Error('Stock insuffisant pour cette sortie.');
        }
        produit.stock_actuel -= quantite;
        caisse.solde_actuel -= montant;
      } else {
        throw new Error('Type de mouvement inconnu.');
      }

      // Sauvegarder les modifications
      await produit.save({ transaction: t });
      await caisse.save({ transaction: t });

      // Créer le mouvement de stock
      const mouvement = await MouvementStock.create({
        produitId,
        quantite,
        motif,
        typeMvtId,
        utilisateurId,
        date: new Date()
      }, { transaction: t });

      return {
        mouvement,
        produit,
        solde_caisse: caisse.solde_actuel
      };
    });

    return res.status(201).json({
      message: 'Mouvement de stock ajouté.',
      mouvement: result.mouvement,
      stock_actuel: result.produit.stock_actuel,
      solde_caisse: result.solde_caisse
    });

  } catch (error) {
    console.error("Erreur lors de l'ajout du mouvement de stock :", error);
    // Si c’est l’erreur de stock insuffisant on renvoie 400
    if (error.message && error.message.includes('Stock insuffisant')) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};


const modifierMouvementStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { produitId, quantite, motif, typeMvtId, utilisateurId } = req.body;

    if (!produitId || quantite == null || !motif || !typeMvtId || !utilisateurId) {
      return res.status(400).json({ message: 'Tous les champs sont obligatoires.' });
    }

    const mouvement = await MouvementStock.findByPk(id);
    if (!mouvement) {
      return res.status(404).json({ message: 'Mouvement de stock non trouvé.' });
    }

    const produit = await Produit.findByPk(produitId);
    if (!produit) {
      return res.status(404).json({ message: 'Produit non trouvé.' });
    }

    const typeMvtNouveau = await TypeMvt.findByPk(typeMvtId);
    if (!typeMvtNouveau) {
      return res.status(404).json({ message: 'Type de mouvement non trouvé.' });
    }

    // Ancienne quantité et ancien type mouvements
    const ancienneQuantite = mouvement.quantite;
    const typeMvtAncien = await TypeMvt.findByPk(mouvement.typeMvtId);

    // Tout dans une transaction
    const result = await sequelize.transaction(async (t) => {
      // Récupérer ou créer la caisse
      let caisse = await Caisse.findOne({
        where: { utilisateurId, type: "VALEUR_STOCK_PUR" },
        transaction: t
      });
      if (!caisse) {
        caisse = await Caisse.create({
          utilisateurId,
          solde_actuel: 0,
          type: "VALEUR_STOCK_PUR"
        }, { transaction: t });
      }

      // Inverser l’effet de l’ancien mouvement sur le stock ET sur la caisse
      const prixAchat = produit.prix_achat || 0;  // On suppose que prix_achat du produit n’a pas changé entre les mouvements

      if (typeMvtAncien && typeMvtAncien.type === "ENTRE") {
        // l'ancien mouvement avait ajouté du stock, on le retire
        produit.stock_actuel -= ancienneQuantite;
        caisse.solde_actuel -= ancienneQuantite * prixAchat;
      } else if (typeMvtAncien && typeMvtAncien.type === "SORTIE") {
        // l'ancien mouvement avait retiré du stock, on le repousse
        produit.stock_actuel += ancienneQuantite;
        caisse.solde_actuel += ancienneQuantite * prixAchat;
      }

      // Appliquer le nouveau mouvement
      if (typeMvtNouveau.type === "ENTRE") {
        produit.stock_actuel += quantite;
        caisse.solde_actuel += quantite * prixAchat;
      } else if (typeMvtNouveau.type === "SORTIE") {
        if (produit.stock_actuel < quantite) {
          throw new Error("Stock insuffisant pour cette sortie.");
        }
        produit.stock_actuel -= quantite;
        caisse.solde_actuel -= quantite * prixAchat;
      } else {
        throw new Error("Type de mouvement inconnu.");
      }

      // Mettre à jour les champs du mouvement
      mouvement.produitId = produitId;
      mouvement.quantite = quantite;
      mouvement.motif = motif;
      mouvement.typeMvtId = typeMvtId;
      mouvement.utilisateurId = utilisateurId;
      mouvement.date = new Date();  // si tu veux mettre à jour la date

      // Sauvegarder
      await produit.save({ transaction: t });
      await caisse.save({ transaction: t });
      await mouvement.save({ transaction: t });

      return {
        mouvement,
        produit,
        solde_caisse: caisse.solde_actuel
      };
    });

    return res.status(200).json({
      message: "Mouvement de stock mis à jour avec succès.",
      mouvement: result.mouvement,
      stock_actuel: result.produit.stock_actuel,
      solde_caisse: result.solde_caisse
    });

  } catch (error) {
    console.error("Erreur lors de la modification du mouvement de stock :", error);
    if (error.message && error.message.includes('Stock insuffisant')) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Erreur interne du serveur." });
  }
};



const recupererMouvementsStock = async (req, res) => {
    try {
        const { produitId } = req.query;
        const where = produitId ? { produitId } : {};

        const mouvements = await MouvementStock.findAll({
            where,
            order: [['date', 'DESC']],
            include: [
                { model: Produit, attributes: ['id', 'nom'] },
                { model: TypeMvt, attributes: ['id', 'type'] },
                { model: Utilisateur, attributes: ['id', 'nom'] }
            ],
        });

        res.status(200).json(mouvements);
    } catch (error) {
        console.error("Erreur lors de la récupération des mouvements de stock :", error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

// Consulter un mouvement de stock par ID
const consulterMouvementStock = async (req, res) => {
    try {
        const { id } = req.params;
        const mouvement = await MouvementStock.findByPk(id, {
            include: [
                { model: Produit, attributes: ['id', 'nom'] },
                { model: TypeMvt, attributes: ['id', 'nom'] },
                { model: Utilisateur, attributes: ['id', 'nom'] }
            ],
        });

        if (!mouvement) return res.status(404).json({ message: 'Mouvement de stock non trouvé.' });

        res.status(200).json(mouvement);
    } catch (error) {
        console.error("Erreur lors de la consultation du mouvement de stock :", error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};




// Supprimer un mouvement de stock (attention : impact sur historique)
const supprimerMouvementStock = async (req, res) => {
    try {
        const { id } = req.params;
        const mouvement = await MouvementStock.findByPk(id);
        if (!mouvement) return res.status(404).json({ message: 'Mouvement de stock non trouvé.' });

        await mouvement.destroy();
        res.status(200).json({ message: 'Mouvement de stock supprimé.' });
    } catch (error) {
        console.error("Erreur lors de la suppression du mouvement de stock :", error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

const afficherHistoriqueMouvementsProduit = async (req, res) => {
    try {
        const { produitId } = req.params;

        const mouvements = await MouvementStock.findAll({
            where: { produitId },
            order: [['date', 'DESC']],
            include: [
                { model: TypeMvt, attributes: ['id', 'nom'] },
                { model: Utilisateur, attributes: ['id', 'nom'] }
            ],
        });

        if (mouvements.length === 0) {
            return res.status(404).json({ message: 'Aucun mouvement de stock trouvé pour ce produit.' });
        }

        res.status(200).json(mouvements);
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'historique des mouvements de stock :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

module.exports = {
    afficherHistoriqueMouvementsProduit,
    ajouterMouvementStock,
    recupererMouvementsStock,
    consulterMouvementStock,
    modifierMouvementStock,
    supprimerMouvementStock
};
