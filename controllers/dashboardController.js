const { Op, fn, col, literal } = require('sequelize');
const Produit = require('../models/produit');
const LigneVente = require('../models/ligneVente');
const Boutique = require('../models/boutique');
const Utilisateur = require('../models/utilisateur');
const jwt = require('jsonwebtoken');


/**
 * 📊 Statistiques dashboard
 */

const dashboardStats = async (req, res) => {
  try {
    // Récupérer utilisateur connecté
    const authHeader = req.headers["authorization"];
    if (!authHeader) 
      return res.status(403).json({ message: "Accès refusé. Aucun token trouvé." });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const utilisateur = await Utilisateur.findByPk(decoded.id);
    if (!utilisateur) 
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });

    // Déterminer boutiques concernées selon rôle
    let boutiqueIds = [];
    if (utilisateur.roleId === 1) {
      const boutiquesAdmin = await Boutique.findAll({ where: { utilisateurId: utilisateur.id } });
      boutiqueIds = boutiquesAdmin.map(b => b.id);
    } else {
      boutiqueIds = [utilisateur.boutiqueId];
    }

    // Statistiques produits (hors ANNULER)
    const [produitsEnStock, rupturesStock, alertesStock] = await Promise.all([
      Produit.count({ 
        where: { 
          boutiqueId: boutiqueIds, 
          stock_actuel: { [Op.gt]: 0 },
          status: { [Op.ne]: "ANNULER" }
        } 
      }),
      Produit.count({ 
        where: { 
          boutiqueId: boutiqueIds, 
          stock_actuel: 0,
          status: { [Op.ne]: "ANNULER" }
        } 
      }),
      Produit.count({ 
        where: { 
          boutiqueId: boutiqueIds, 
          stock_actuel: { [Op.lte]: col('stock_minimum') },
          status: { [Op.ne]: "ANNULER" }
        } 
      }),
    ]);

    res.status(200).json({
      produitsEnStock,
      rupturesStock,
      alertesStock,
    });

  } catch (error) {
    console.error('Erreur dashboard stats :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};


/**
 * 🔝 Top produits les plus vendus
 */
const produitsPlusVendus = async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(403).json({ message: "Accès refusé. Aucun token trouvé." });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const utilisateur = await Utilisateur.findByPk(decoded.id);
    if (!utilisateur) return res.status(404).json({ message: 'Utilisateur non trouvé.' });

    let boutiqueIds = [];
    if (utilisateur.roleId === 1) {
      const boutiquesAdmin = await Boutique.findAll({ where: { utilisateurId: utilisateur.id } });
      boutiqueIds = boutiquesAdmin.map(b => b.id);
    } else {
      boutiqueIds = [utilisateur.boutiqueId];
    }

    const topProduits = await LigneVente.findAll({
      attributes: ['produitId', [fn('SUM', col('quantite')), 'totalVendu']],
      group: ['produitId'],
      order: [[literal('totalVendu'), 'DESC']],
      include: [
        { model: Produit, attributes: ['id', 'nom', 'prix_vente', 'stock_actuel'], where: { boutiqueId: boutiqueIds } }
      ],
      limit: 10
    });

    res.status(200).json(topProduits);

  } catch (error) {
    console.error('Erreur produits plus vendus :', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
};

/**
 * ⚠️ Produits en alerte stock
 */
const produitsAlerteStock = async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(403).json({ message: "Accès refusé. Aucun token trouvé." });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const utilisateur = await Utilisateur.findByPk(decoded.id);
    if (!utilisateur) return res.status(404).json({ message: 'Utilisateur non trouvé.' });

    let boutiqueIds = [];
    if (utilisateur.roleId === 1) {
      const boutiquesAdmin = await Boutique.findAll({ where: { utilisateurId: utilisateur.id } });
      boutiqueIds = boutiquesAdmin.map(b => b.id);
    } else {
      boutiqueIds = [utilisateur.boutiqueId];
    }

    const alertes = await Produit.findAll({
      where: {
        boutiqueId: boutiqueIds,
        stock_actuel: { [Op.lte]: col('stock_minimum') }
      },
      include: [
        { model: Boutique, attributes: ['id', 'nom', 'stock_minimum'] },
        { model: Utilisateur, attributes: ['id', 'nom'] }
      ]
    });

    res.status(200).json(alertes);

  } catch (error) {
    console.error('Erreur alerte stock :', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
};

module.exports = {
  dashboardStats,
  produitsPlusVendus,
  produitsAlerteStock
};
