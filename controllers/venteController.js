const Sequelize = require('sequelize');
const Produit = require('../models/produit');
const { Vente, LigneVente } = require('../models/relation');

const sequelize = require('../models/sequelize');

// const creerVente = async (req, res) => {
//     const t = await sequelize.transaction();
//     try {
//         const { lignes } = req.body;
//         if (!lignes || !Array.isArray(lignes) || lignes.length === 0) {
//             await t.rollback();
//             return res.status(400).json({ message: 'Les lignes de vente sont obligatoires.' });
//         }

//         const totals = await Promise.all(lignes.map(async ligne => {
//             if (!ligne.produitId || !ligne.quantite || !ligne.prix_vente) {
//                 throw new Error('Chaque ligne doit contenir produitId, quantite, prix_vente.');
//             }
//             const produit = await Produit.findByPk(ligne.produitId, { transaction: t, lock: t.LOCK.UPDATE });
//             if (!produit) {
//                 throw new Error(`Produit ID ${ligne.produitId} non trouvé.`);
//             }
//             if (produit.stock_actuel < ligne.quantite) {
//                 throw new Error(`Stock insuffisant pour le produit: ${produit?.nom} qui est: ${produit?.stock_actuel}.`);
//             }
//             return ligne.quantite * ligne.prix_vente;
//         }));

//         const total = totals.reduce((acc, val) => acc + val, 0);

//         const vente = await Vente.create({ total }, { transaction: t });

//         for (const ligne of lignes) {
//             await LigneVente.create({
//                 venteId: vente.id,
//                 produitId: ligne.produitId,
//                 quantite: ligne.quantite,
//                 prix_vente: ligne.prix_vente
//             }, { transaction: t });

//             const produit = await Produit.findByPk(ligne.produitId, { transaction: t, lock: t.LOCK.UPDATE });
//             await produit.update({
//                 stock_actuel: produit.stock_actuel - ligne.quantite
//             }, { transaction: t });
//         }

//         await t.commit();
//         return res.status(201).json({ message: 'Vente créée avec succès.', venteId: vente.id });
//     } catch (error) {
//         await t.rollback();
//         console.error("Erreur lors de la vente :", error);
//         const message = error.message || 'Erreur interne du serveur.';
//         return res.status(400).json({ message });
//     }
// };

const creerVente = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { lignes } = req.body;

    if (!lignes || !Array.isArray(lignes) || lignes.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Les lignes de vente sont obligatoires.' });
    }

    const totals = await Promise.all(lignes.map(async ligne => {
      if (!ligne.produitId || !ligne.quantite || !ligne.prix_vente) {
        throw new Error('Chaque ligne doit contenir produitId, quantite, prix_vente.');
      }

      const produit = await Produit.findByPk(ligne.produitId, { transaction: t, lock: t.LOCK.UPDATE });

      if (!produit) {
        throw new Error(`Produit ID ${ligne.produitId} non trouvé.`);
      }

      if (produit.stock_actuel < ligne.quantite) {
        throw new Error(`Stock insuffisant pour le produit: ${produit.nom}, disponible: ${produit.stock_actuel}.`);
      }

      return ligne.quantite * ligne.prix_vente;
    }));

    const total = totals.reduce((acc, val) => acc + val, 0);

    const vente = await Vente.create({ total }, { transaction: t });

    for (const ligne of lignes) {
      const produit = await Produit.findByPk(ligne.produitId, { transaction: t, lock: t.LOCK.UPDATE });

      await LigneVente.create({
        venteId: vente.id,
        produitId: ligne.produitId,
        quantite: ligne.quantite,
        prix_vente: ligne.prix_vente,
        prix_achat: produit.prix_achat // <-- Enregistrement du prix d'achat à l'instant T
      }, { transaction: t });

      await produit.update({
        stock_actuel: produit.stock_actuel - ligne.quantite
      }, { transaction: t });
    }

    await t.commit();
    return res.status(201).json({ message: 'Vente créée avec succès.', venteId: vente.id });

  } catch (error) {
    await t.rollback();
    console.error("Erreur lors de la vente :", error);
    const message = error.message || 'Erreur interne du serveur.';
    return res.status(400).json({ message });
  }
};

const recupererVentes = async (req, res) => {
    try {
        const ventes = await Vente.findAll({
            include: [{
                model: LigneVente,
                include: [{ model: Produit, attributes: ['id', 'nom', 'prix_achat'] }]
            }],
            order: [['date', 'DESC']]
        });
        return res.status(200).json(ventes);
    } catch (error) {
        console.error('Erreur lors de la récupération des ventes :', error);
        return res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

const consulterVente = async (req, res) => {
    try {
        const { id } = req.params;
        const vente = await Vente.findByPk(id, {
            include: [{
                model: LigneVente,
                include: [{ model: Produit, attributes: ['id', 'nom'] }]
            }]
        });
        if (!vente) return res.status(404).json({ message: 'Vente non trouvée.' });
        return res.status(200).json(vente);
    } catch (error) {
        console.error('Erreur lors de la consultation de la vente :', error);
        return res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

const supprimerVente = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const vente = await Vente.findByPk(id, { transaction: t });
        if (!vente) {
            await t.rollback();
            return res.status(404).json({ message: 'Vente non trouvée.' });
        }

        const lignes = await LigneVente.findAll({ where: { venteId: id }, transaction: t });

        for (const ligne of lignes) {
            const produit = await Produit.findByPk(ligne.produitId, { transaction: t, lock: t.LOCK.UPDATE });
            if (produit) {
                await produit.update({
                    stock_actuel: produit.stock_actuel + ligne.quantite
                }, { transaction: t });
            }
        }

        await LigneVente.destroy({ where: { venteId: id }, transaction: t });
        await vente.destroy({ transaction: t });

        await t.commit();
        return res.status(200).json({ message: 'Vente supprimée avec succès.' });
    } catch (error) {
        await t.rollback();
        console.error('Erreur lors de la suppression de la vente :', error);
        return res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

const produitsPlusVendus = async (req, res) => {
    try {
        const result = await LigneVente.findAll({
            attributes: [
                'produitId',
                [Sequelize.fn('SUM', Sequelize.col('quantite')), 'totalVendu']
            ],
            group: ['produitId'],
            order: [[Sequelize.literal('totalVendu'), 'DESC']],
            include: [
                {
                    model: Produit,
                    attributes: ['id', 'nom', 'prix_vente', 'stock_actuel']
                }
            ],
            limit: 10
        });
        return res.status(200).json(result);
    } catch (error) {
        console.error('Erreur lors de la récupération des produits les plus vendus :', error);
        return res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

module.exports = {
    creerVente,
    recupererVentes,
    consulterVente,
    supprimerVente,
    produitsPlusVendus
};
