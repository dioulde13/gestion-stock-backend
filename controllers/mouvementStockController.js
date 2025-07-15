const MouvementStock = require('../models/mouvementStock');
const Produit = require('../models/produit');
const TypeMvt = require('../models/typeMvt');
const Utilisateur = require('../models/utilisateur');

// Ajouter un mouvement de stock (entrée ou sortie)
const ajouterMouvementStock = async (req, res) => {
    try {
        const { produitId, quantite, typeMvtId, utilisateurId } = req.body;

        if (!produitId || !quantite || !typeMvtId || !utilisateurId) {
            return res.status(400).json({ message: 'Tous les champs sont obligatoires.' });
        }

        const produit = await Produit.findByPk(produitId);
        if (!produit) return res.status(404).json({ message: 'Produit non trouvé.' });

        const typeMvt = await TypeMvt.findByPk(typeMvtId);
        if (!typeMvt) return res.status(404).json({ message: 'Type de mouvement non trouvé.' });

        // Gestion du stock selon le type de mouvement (exemple : 'entrée' augmente le stock)
        if (typeMvt.nom.toLowerCase() === 'entrée') {
            produit.stock_actuel += quantite;
        } else if (typeMvt.nom.toLowerCase() === 'sortie') {
            if (produit.stock_actuel < quantite) {
                return res.status(400).json({ message: 'Stock insuffisant pour cette sortie.' });
            }
            produit.stock_actuel -= quantite;
        } else {
            return res.status(400).json({ message: 'Type de mouvement inconnu.' });
        }

        await produit.save();

        const mouvement = await MouvementStock.create({
            produitId,
            quantite,
            typeMvtId,
            utilisateurId,
            date: new Date()
        });

        res.status(201).json({ message: 'Mouvement de stock ajouté.', mouvement, stock_actuel: produit.stock_actuel });
    } catch (error) {
        console.error("Erreur lors de l'ajout du mouvement de stock :", error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

// Récupérer tous les mouvements de stock, optionnellement filtrés par produitId
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

// Modifier un mouvement de stock (attention : à utiliser avec prudence car peut casser l'historique)
const modifierMouvementStock = async (req, res) => {
    try {
        const { id } = req.params;
        const { quantite, typeMvtId } = req.body;

        const mouvement = await MouvementStock.findByPk(id);
        if (!mouvement) return res.status(404).json({ message: 'Mouvement de stock non trouvé.' });

        if (quantite) mouvement.quantite = quantite;
        if (typeMvtId) mouvement.typeMvtId = typeMvtId;

        await mouvement.save();

        res.status(200).json({ message: 'Mouvement de stock mis à jour.', mouvement });
    } catch (error) {
        console.error("Erreur lors de la modification du mouvement de stock :", error);
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
