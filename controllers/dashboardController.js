const { Op, fn, col, literal } = require('sequelize');
const Produit = require('../models/produit');
const Achat = require('../models/achat');
const Vente = require('../models/vente');
const LigneVente = require('../models/ligneVente');
const LigneAchat = require('../models/ligneAchat');

const dashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalProduits,
      totalStock,
      valeurStock,
      totalAchats,
      totalVentes,
      ventesDuJour,
      lignesVentesDuJour,
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
      Achat.sum('total'),
      Vente.sum('total'),
      Vente.sum('total', {
        where: {
          date: {
            [Op.gte]: today
          }
        }
      }),
     
      LigneVente.findAll({
        where: {
          createdAt: {
            [Op.gte]: today
          }
        },
        include: [{ model: Produit, attributes: ['id', 'nom', 'prix_achat'] }]
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

    ligneVentesDuJour = await LigneVente.findAll({
      where: {
        createdAt: {
          [Op.gte]: today
        }
      },
      include: [
        {
          model: Produit,
          attributes: ['id', 'nom', 'prix_achat', 'prix_vente', 'stock_actuel']
        }
      ]
    });
    // console.log(ligneVentesDuJour);

    // ligneVentesDuJour.forEach(ligne => {
    //   console.log('Nom produit:', ligne.Produit.nom);
    //   console.log('Quantité vendue:', ligne.quantite);
    //   console.log('Prix achat:', ligne.prix_achat);
    //   console.log('Prix vente:', ligne.prix_vente);
    // });

    let totalsAchatJour = ligneVentesDuJour.reduce((acc, l) => {
      const prixAchat = l.prix_achat || 0;
      return acc + (l.quantite * prixAchat);
    }, 0);
    // console.log(totalsAchatJour)


    // Calcul bénéfice du jour : total ventes - total achats (simplifié)
    // let totalAchatJour = lignesAchatsDuJour.reduce((acc, l) => acc + (l.quantite * l.prix_achat), 0);
    let totalVenteJour = lignesVentesDuJour.reduce((acc, l) => acc + (l.quantite * l.prix_vente), 0);
    let beneficeDuJour = totalVenteJour - totalsAchatJour;

    res.status(200).json({
      totalProduits,
      totalStock,
      valeurStock: parseFloat(valeurStock[0].valeurStock || 0),
      totalAchats: totalAchats || 0,
      totalVentes: totalVentes || 0,
      ventesDuJour: ventesDuJour || 0,
      achatsDuJour: totalsAchatJour || 0,
      beneficeDuJour,
      produitsEnStock,
      rupturesStock,
      alertesStock
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
