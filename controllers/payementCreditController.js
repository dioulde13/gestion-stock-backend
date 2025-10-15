const PayementCredit = require('../models/payementCredit');
const Credit = require('../models/credit');
const Utilisateur = require('../models/utilisateur');
const sequelize = require('../models/sequelize');
const Caisse = require('../models/caisse');

// Ajouter un paiement de crédit
const ajouterPayementCredit = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { reference, utilisateurId, montant } = req.body;

        // console.log("Request body:", req.body);

        // Vérification des champs obligatoires
        if (!reference || !utilisateurId || !montant) {
            return res.status(400).json({ message: 'Tous les champs obligatoires doivent être remplis.' });
        }

        // Vérification crédit
        const credit = await Credit.findOne({ where: { reference } });
        if (!credit) {
            console.log("Erreur : crédit non trouvé pour la référence", reference);
            return res.status(404).json({ message: 'Crédit non trouvé pour cette référence.' });
        }

        // Vérification caisse principale
        const caisseSolde = await Caisse.findOne({ where: { utilisateurId, type: 'CAISSE' }, transaction: t });
        if (!caisseSolde) {
            console.log("Erreur : caisse non trouvée pour utilisateur", utilisateurId);
            return res.status(404).json({ message: 'Caisse non trouvée.' });
        }

        // Vérifier si le paiement ne dépasse pas le montant du crédit
        const montantEnCoursPayement = montant + (credit.montantPaye ?? 0);
        if (montantEnCoursPayement > credit.montant) {
            return res.status(400).json({ message: 'Le montant dépasse le montant restant du crédit.' });
        }

        // Mise à jour du crédit
        credit.montantPaye = (credit.montantPaye ?? 0) + montant;
        credit.montantRestant = (credit.montant ?? 0) - credit.montantPaye;

        // Enregistrer le paiement
        const payement = await PayementCredit.create({
            creditId: credit.id,
            utilisateurId,
            montant
        }, { transaction: t });

        // Gestion caisse en fonction du type de crédit
        if (credit.type === "SORTIE") {
            if (credit.typeCredit === "ESPECE") {
                let caisseCreditEspece = await Caisse.findOne({
                    where: { utilisateurId, type: "CREDIT_ESPECE" },
                    transaction: t
                });
                caisseCreditEspece.solde_actuel -= montant;
                await caisseCreditEspece.save({ transaction: t });
            } else {
                let caisseCredit = await Caisse.findOne({
                    where: { utilisateurId, type: "CREDIT_VENTE" },
                    transaction: t
                });
                caisseCredit.solde_actuel -= montant;
                await caisseCredit.save({ transaction: t });
            }

            caisseSolde.solde_actuel += montant;
            await caisseSolde.save({ transaction: t });

        } else if (credit.type === "ENTRE") {
            if (caisseSolde.solde_actuel < montant) {
                throw new Error('Solde insuffisant dans la caisse.');
            }

            const caisseCredit = await Caisse.findOne({
                where: { utilisateurId, type: 'CREDIT_ESPECE_ENTRE' },
                transaction: t,
            });

            if (!caisseCredit || caisseCredit.solde_actuel < montant) {
                throw new Error('Solde insuffisant dans la caisse de crédit.');
            }

            caisseCredit.solde_actuel -= montant;
            await caisseCredit.save({ transaction: t });

            caisseSolde.solde_actuel -= montant;
            await caisseSolde.save({ transaction: t });
        }

        // Mise à jour du statut
        if (credit.montantRestant === 0) {
            credit.status = "PAYEE";
        } else if (credit.montantPaye < credit.montant) {
            credit.status = "EN COURS";
        }

        await credit.save({ transaction: t });

        // Validation de la transaction
        await t.commit();

        // Réponse avec la référence du crédit
        res.status(201).json({
            message: 'Paiement enregistré avec succès.',
            payement: { ...payement.toJSON(), reference: credit.reference }
        });

    } catch (error) {
        await t.rollback();
        console.error('Erreur lors de l\'ajout du paiement :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};


// Récupérer tous les paiements
const recupererPayementsCredit = async (req, res) => {
    try {
        const payements = await PayementCredit.findAll({
            include: [
                { model: Utilisateur, attributes: ['id', 'nom', 'email'] },
                { model: Credit, attributes: ['id', 'montant', 'montantPaye', 'montantRestant', 'reference'] }
            ],
            order: [['id', 'DESC']]
        });
        res.status(200).json(payements);
    } catch (error) {
        console.error('Erreur lors de la récupération des paiements :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

// Consulter un paiement par id
const consulterPayementCredit = async (req, res) => {
    try {
        const { id } = req.params;
        const payement = await PayementCredit.findByPk(id, {
            include: [
                { model: Utilisateur, attributes: ['id', 'nom', 'email'] },
                { model: Credit, attributes: ['id', 'nom', 'montant', 'montantPaye', 'montantRestant'] }
            ]
        });

        if (!payement) return res.status(404).json({ message: 'Paiement non trouvé.' });

        res.status(200).json(payement);
    } catch (error) {
        console.error('Erreur lors de la consultation du paiement :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

// Modifier un paiement
const modifierPayementCredit = async (req, res) => {
    try {
        const { id } = req.params;
        const { montant } = req.body;

        const payement = await PayementCredit.findByPk(id);
        if (!payement) return res.status(404).json({ message: 'Paiement non trouvé.' });

        const credit = await Credit.findByPk(payement.creditId);
        if (!credit) return res.status(404).json({ message: 'Crédit associé non trouvé.' });

        // Mettre à jour le crédit avant le paiement
        credit.montantPaye = credit.montantPaye - payement.montant + montant;
        credit.montantRestant = credit.montant - credit.montantPaye;
        await credit.save();

        // Mettre à jour le paiement
        payement.montant = montant;
        await payement.save();

        res.status(200).json({ message: 'Paiement mis à jour avec succès.', payement });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du paiement :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

// Supprimer un paiement
const supprimerPayementCredit = async (req, res) => {
    try {
        const { id } = req.params;
        const payement = await PayementCredit.findByPk(id);
        if (!payement) return res.status(404).json({ message: 'Paiement non trouvé.' });

        const credit = await Credit.findByPk(payement.creditId);
        if (credit) {
            // Mettre à jour le crédit avant suppression
            credit.montantPaye -= payement.montant;
            credit.montantRestant = credit.montant - credit.montantPaye;
            await credit.save();
        }

        await payement.destroy();
        res.status(200).json({ message: 'Paiement supprimé avec succès.' });
    } catch (error) {
        console.error('Erreur lors de la suppression du paiement :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

module.exports = {
    ajouterPayementCredit,
    recupererPayementsCredit,
    consulterPayementCredit,
    modifierPayementCredit,
    supprimerPayementCredit
};
