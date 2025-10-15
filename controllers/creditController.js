const Credit = require('../models/credit');
const Utilisateur = require('../models/utilisateur');
const Client = require('../models/client');
const sequelize = require('../models/sequelize');
const Caisse = require('../models/caisse');

const ajouterCredit = async (req, res) => {
  const { utilisateurId, clientId, montant, description, type , typeCredit} = req.body;

  // Validation initiale des champs
  if (!utilisateurId || !clientId || !montant || !type || !typeCredit || !description) {
    return res.status(400).json({ message: 'Tous les champs obligatoires doivent être remplis.' });
  }

  try {
    const utilisateur = await Utilisateur.findByPk(utilisateurId);
    if (!utilisateur) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    await sequelize.transaction(async (t) => {
      const client = await Client.findByPk(clientId, { transaction: t });
      if (!client) {
        return res.status(404).json({ message: 'Client non trouvé.' });
      }

      const caisseSolde = await Caisse.findOne({
        where: { utilisateurId, type: 'CAISSE' },
        transaction: t
      });
      if (!caisseSolde) {
        return res.status(404).json({ message: 'Caisse non trouvée.' });
      }

      // Vérifier solde pour type SORTIE
      if (type === 'SORTIE' && montant > caisseSolde.solde_actuel) {
        return res.status(400).json({ message: 'Solde insuffisant dans la caisse.' });
      }

      // Génération de la référence
      const dernierCredit = await Credit.findOne({
        order: [['id', 'DESC']],
        transaction: t
      });

      let numero = 1;
      if (dernierCredit && dernierCredit.reference) {
        const lastRefNum = dernierCredit.reference.replace(/^REF/, '');
        const parsed = parseInt(lastRefNum, 10);
        if (!isNaN(parsed)) {
          numero = parsed + 1;
        }
      }

      const reference = 'REF' + String(numero).padStart(4, '0');

      // Création du crédit
      const credit = await Credit.create({
        utilisateurId,
        clientId: client.id,
        reference,
        type,
        typeCredit: "ESPECE",
        description,
        montant,
        montantPaye: 0,
        montantRestant: 0
      }, { transaction: t });

      // Mise à jour des caisses selon le type
      if (type === 'SORTIE') {
        const caisseCreditEspece = await Caisse.findOne({
          where: { utilisateurId, type: 'CREDIT_ESPECE' },
          transaction: t
        });
        if (!caisseCreditEspece) {
          return res.status(404).json({ message: 'Caisse CREDIT ESPECE non trouvée.' });
        }
        caisseCreditEspece.solde_actuel += montant;
        await caisseCreditEspece.save({ transaction: t });

        caisseSolde.solde_actuel -= montant;
        await caisseSolde.save({ transaction: t });

      } else if (type === 'ENTRE') {
        const caisseCreditEspeceEntre = await Caisse.findOne({
          where: { utilisateurId, type: 'CREDIT_ESPECE_ENTRE' },
          transaction: t
        });
        if (!caisseCreditEspeceEntre) {
          return res.status(404).json({ message: 'Caisse CREDIT ESPECE ENTRE non trouvée.' });
        }
        caisseCreditEspeceEntre.solde_actuel += montant;
        await caisseCreditEspeceEntre.save({ transaction: t });

        caisseSolde.solde_actuel += montant;
        await caisseSolde.save({ transaction: t });

      } else {
        return res.status(400).json({ message: `Type invalide: ${type}` });
      }

      
      return res.status(201).json({ message: 'Crédit créé avec succès.', credit });
    });

  } catch (error) {
    console.error('Erreur lors de la création du crédit :', error);
    const statusCode = error.status || 500;
    return res.status(statusCode).json({ message: error.message || 'Erreur interne du serveur.' });
  }
};


const recupererCredits = async (req, res) => {
    try {
        const credits = await Credit.findAll({
            include: [
                { model: Utilisateur, attributes: ['id', 'nom', 'email'] },
                { model: Client, attributes: ['id', 'nom'] }
            ]
        });
        res.status(200).json(credits);
    } catch (error) {
        console.error('Erreur lors de la récupération des crédits :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};


const consulterCredit = async (req, res) => {
    try {
        const { id } = req.params;
        const credit = await Credit.findByPk(id, {
            include: [
                { model: Utilisateur, attributes: ['id', 'nom', 'email'] },
                { model: Client, attributes: ['id', 'nom'] }
            ]
        });

        if (!credit) return res.status(404).json({ message: 'Crédit non trouvé.' });

        res.status(200).json(credit);
    } catch (error) {
        console.error('Erreur lors de la consultation du crédit :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};


const modifierCredit = async (req, res) => {
    try {
        const { id } = req.params;
        const { montant, type } = req.body;

        const credit = await Credit.findByPk(id);
        if (!credit) return res.status(404).json({ message: 'Crédit non trouvé.' });

        await credit.update({
            montant: montant || credit.montant,
            type: type || credit.type
        });

        res.status(200).json({ message: 'Crédit mis à jour avec succès.', credit });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du crédit :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};


const supprimerCredit = async (req, res) => {
    try {
        const { id } = req.params;
        const credit = await Credit.findByPk(id);
        if (!credit) return res.status(404).json({ message: 'Crédit non trouvé.' });

        await credit.destroy();
        res.status(200).json({ message: 'Crédit supprimé avec succès.' });
    } catch (error) {
        console.error('Erreur lors de la suppression du crédit :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

module.exports = {
    ajouterCredit,
    recupererCredits,
    consulterCredit,
    modifierCredit,
    supprimerCredit
};
