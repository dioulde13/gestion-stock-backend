const Achat = require('../models/achat');
const LigneAchat = require('../models/ligneAchat');
const Produit = require('../models/produit');
const { sequelize } = require('../models/sequelize');

// Créer un achat avec ses lignes (transaction)
const creerAchat = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { fournisseurId, lignes } = req.body; // lignes = [{ produitId, quantite, prix_achat }, ...]

        if (!fournisseurId || !lignes || lignes.length === 0) {
            return res.status(400).json({ message: 'Fournisseur et lignes d\'achat obligatoires.' });
        }

        // Calcul total
        let total = 0;
        for (const ligne of lignes) {
            if (!ligne.produitId || !ligne.quantite || !ligne.prix_achat) {
                await t.rollback();
                return res.status(400).json({ message: 'Chaque ligne doit avoir produitId, quantite et prix_achat.' });
            }
            total += ligne.quantite * ligne.prix_achat;
        }

        // Création achat
        const achat = await Achat.create({ fournisseurId, total }, { transaction: t });

        // Création lignes et mise à jour stock produit (augmentation)
        for (const ligne of lignes) {
            const produit = await Produit.findByPk(ligne.produitId);
            if (!produit) {
                await t.rollback();
                return res.status(404).json({ message: `Produit ID ${ligne.produitId} non trouvé.` });
            }

            await LigneAchat.create({
                achatId: achat.id,
                produitId: ligne.produitId,
                quantite: ligne.quantite,
                prix_achat: ligne.prix_achat,
            }, { transaction: t });

            // Mise à jour du stock (augmentation)
            await produit.update({ stock_actuel: produit.stock_actuel + ligne.quantite }, { transaction: t });
        }

        await t.commit();
        res.status(201).json({ message: 'Achat créé avec succès.', achatId: achat.id });
    } catch (error) {
        await t.rollback();
        console.error('Erreur lors de la création de l\'achat :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

// Récupérer tous les achats avec leurs lignes
const recupererAchats = async (req, res) => {
    try {
        const achats = await Achat.findAll({
            include: [
                {
                    model: LigneAchat,
                    include: [
                        { model: Produit, attributes: ['id', 'nom'] }
                    ]
                }
            ],
            order: [['dateAchat', 'DESC']]
        });

        res.status(200).json(achats);
    } catch (error) {
        console.error('Erreur lors de la récupération des achats :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

// Consulter un achat par ID avec lignes
const consulterAchat = async (req, res) => {
    try {
        const { id } = req.params;
        const achat = await Achat.findByPk(id, {
            include: [
                {
                    model: LigneAchat,
                    include: [
                        { model: Produit, attributes: ['id', 'nom'] }
                    ]
                }
            ]
        });

        if (!achat) return res.status(404).json({ message: 'Achat non trouvé.' });

        res.status(200).json(achat);
    } catch (error) {
        console.error('Erreur lors de la consultation de l\'achat :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

// Supprimer un achat (restaurer stock et supprimer lignes)
const supprimerAchat = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const achat = await Achat.findByPk(id, { transaction: t });
        if (!achat) {
            await t.rollback();
            return res.status(404).json({ message: 'Achat non trouvé.' });
        }

        const lignes = await LigneAchat.findAll({ where: { achatId: id }, transaction: t });

        // Restituer stock des produits (diminuer stock)
        for (const ligne of lignes) {
            const produit = await Produit.findByPk(ligne.produitId, { transaction: t });
            if (produit) {
                await produit.update({ stock_actuel: produit.stock_actuel - ligne.quantite }, { transaction: t });
            }
        }

        // Supprimer lignes
        await LigneAchat.destroy({ where: { achatId: id }, transaction: t });

        // Supprimer achat
        await achat.destroy({ transaction: t });

        await t.commit();
        res.status(200).json({ message: 'Achat supprimé avec succès et stock mis à jour.' });
    } catch (error) {
        await t.rollback();
        console.error('Erreur lors de la suppression de l\'achat :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};


module.exports = {
    creerAchat,
    recupererAchats,
    consulterAchat,
    supprimerAchat,
};
