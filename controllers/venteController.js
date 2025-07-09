const { sequelize } = require('../models/sequelize');
const Vente = require('../models/vente');
const LigneVente = require('../models/ligneVente');
const Produit = require('../models/produit');
const { Sequelize } = require('../models/sequelize');

const creerVente = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { lignes } = req.body;
        if (!lignes || lignes.length === 0) {
            return res.status(400).json({ message: 'Les lignes de vente sont obligatoires.' });
        }

        let total = 0;
        for (const ligne of lignes) {
            if (!ligne.produitId || !ligne.quantite || !ligne.prix_vente) {
                await t.rollback();
                return res.status(400).json({ message: 'Chaque ligne doit contenir produitId, quantite, prix_vente.' });
            }
            const produit = await Produit.findByPk(ligne.produitId, { transaction: t });
            if (!produit || produit.stock_actuel < ligne.quantite) {
                await t.rollback();
                return res.status(400).json({ message: `Stock insuffisant pour le produit ID ${ligne.produitId}.` });
            }
            total += ligne.quantite * ligne.prix_vente;
        }

        const vente = await Vente.create({ total }, { transaction: t });

        for (const ligne of lignes) {
            await LigneVente.create({
                venteId: vente.id,
                produitId: ligne.produitId,
                quantite: ligne.quantite,
                prix_vente: ligne.prix_vente
            }, { transaction: t });

            const produit = await Produit.findByPk(ligne.produitId);
            await produit.update({
                stock_actuel: produit.stock_actuel - ligne.quantite
            }, { transaction: t });
        }

        await t.commit();
        res.status(201).json({ message: 'Vente créée avec succès.', venteId: vente.id });
    } catch (error) {
        await t.rollback();
        console.error("Erreur lors de la vente :", error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

const recupererVentes = async (req, res) => {
    try {
        const ventes = await Vente.findAll({
            include: [{
                model: LigneVente,
                include: [{ model: Produit, attributes: ['id', 'nom'] }]
            }],
            order: [['date', 'DESC']]
        });
        res.status(200).json(ventes);
    } catch (error) {
        console.error('Erreur lors de la récupération des ventes :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
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
        res.status(200).json(vente);
    } catch (error) {
        console.error('Erreur lors de la consultation de la vente :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
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
            const produit = await Produit.findByPk(ligne.produitId, { transaction: t });
            if (produit) {
                await produit.update({
                    stock_actuel: produit.stock_actuel + ligne.quantite
                }, { transaction: t });
            }
        }

        await LigneVente.destroy({ where: { venteId: id }, transaction: t });
        await vente.destroy({ transaction: t });

        await t.commit();
        res.status(200).json({ message: 'Vente supprimée avec succès.' });
    } catch (error) {
        await t.rollback();
        console.error('Erreur lors de la suppression de la vente :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
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
        res.status(200).json(result);
    } catch (error) {
        console.error('Erreur lors de la récupération des produits les plus vendus :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

module.exports = {
    creerVente,
    recupererVentes,
    consulterVente,
    supprimerVente,
    produitsPlusVendus
};