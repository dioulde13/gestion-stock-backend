const { Op, fn, col, literal } = require('sequelize');
const Produit = require('../models/produit');
const LigneVente = require('../models/ligneVente');

const dashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const dateDebut = req.query.dateDebut ? new Date(req.query.dateDebut) : startOfMonth;
    dateDebut.setHours(0, 0, 0, 0); // Forcer début de journée

    const dateFin = req.query.dateFin ? new Date(req.query.dateFin) : endOfToday;
    dateFin.setHours(23, 59, 59, 999); // Forcer fin de journée

    const [
      totalProduits,
      totalStock,
      valeurStock,
      lignesVentesPeriode,
      produitsEnStock,
      rupturesStock,
      alertesStock
    ] = await Promise.all([
      Produit.count(),
      Produit.sum('stock_actuel'),
      Produit.findAll({
        attributes: [[fn('SUM', literal('stock_actuel * prix_achat')), 'valeurStock']],
        raw: true,
      }),
      LigneVente.findAll({
        where: {
          createdAt: {
            [Op.between]: [dateDebut, dateFin]
          }
        },
        include: [
          {
            model: Produit,
            attributes: ['id', 'nom', 'prix_achat', 'prix_vente', 'stock_actuel']
          }
        ]
      }),
      Produit.count({
        where: {
          stock_actuel: {
            [Op.gt]: 0
          }
        }
      }),
      Produit.count({
        where: {
          stock_actuel: 0
        }
      }),
      Produit.count({
        where: {
          stock_actuel: {
            [Op.lte]: col('stock_minimum')
          }
        }
      })
    ]);

    // Calcul des valeurs d'achat et de vente pour la période
    const totalAchatPeriode = lignesVentesPeriode.reduce((acc, ligne) => {
      const prixAchat = ligne.prix_achat || ligne.Produit?.prix_achat || 0;
      return acc + (ligne.quantite * prixAchat);
    }, 0);

    const totalVentePeriode = lignesVentesPeriode.reduce((acc, ligne) => {
      const prixVente = ligne.prix_vente || ligne.Produit?.prix_vente || 0;
      return acc + (ligne.quantite * prixVente);
    }, 0);

    const beneficePeriode = totalVentePeriode - totalAchatPeriode;

    res.status(200).json({
      totalProduits,
      totalStock,
      valeurStock: parseFloat(valeurStock[0].valeurStock || 0),
      achatsTotal: totalAchatPeriode || 0,
      ventesTotal: totalVentePeriode || 0,
      beneficeTotal: beneficePeriode,
      produitsEnStock,
      rupturesStock,
      alertesStock,
      periode: {
        dateDebut,
        dateFin
      }
    });
  } catch (error) {
    console.error('Erreur dashboard stats :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};



const produitsPlusVendus = async (req, res) => {
  try {
    const topProduits = await LigneVente.findAll({
      attributes: [
        'produitId',
        [fn('SUM', col('quantite')), 'totalVendu']
      ],
      group: ['produitId'],
      order: [[literal('totalVendu'), 'DESC']],
      include: [
        {
          model: Produit,
          attributes: ['id', 'nom', 'prix_vente', 'stock_actuel']
        }
      ],
      limit: 10
    });

    res.status(200).json(topProduits);
  } catch (error) {
    console.error('Erreur produits plus vendus :', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
};

const produitsAlerteStock = async (req, res) => {
  try {
    const alertes = await Produit.findAll({
      where: {
        stock_actuel: {
          [Op.lte]: col('stock_minimum')
        }
      }
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
