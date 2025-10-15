const Client = require('../models/client');
const Utilisateur = require('../models/utilisateur');

// Ajouter un client
const ajouterClient = async (req, res) => {
    try {
        const { nom, utilisateurId, telephone, adresse, email } = req.body;
        if (!nom || !utilisateurId) 
            return res.status(400).json({ message: 'Le nom du client et l’utilisateur sont obligatoires.' });

        const client = await Client.create({ nom, utilisateurId, telephone, adresse, email });
        res.status(201).json({ message: 'Client créé avec succès.', client });
    } catch (error) {
        console.error('Erreur lors de la création du client :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

// Récupérer tous les clients
const recupererClients = async (req, res) => {
    try {
        const clients = await Client.findAll({
            include: [
                {
                    model: Utilisateur,
                    attributes: ['id', 'nom', 'email']
                }
            ]
        });
        res.status(200).json(clients);
    } catch (error) {
        console.error('Erreur lors de la récupération des clients :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

// Consulter un client par id
const consulterClient = async (req, res) => {
    try {
        const { id } = req.params;
        const client = await Client.findByPk(id, {
            include: [
                {
                    model: Utilisateur,
                    attributes: ['id', 'nom', 'email']
                }
            ]
        });
        if (!client) return res.status(404).json({ message: 'Client non trouvé.' });
        res.status(200).json(client);
    } catch (error) {
        console.error('Erreur lors de la consultation du client :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

// Modifier un client
const modifierClient = async (req, res) => {
    try {
        const { id } = req.params;
        const { nom, utilisateurId, telephone, adresse, email } = req.body;

        const client = await Client.findByPk(id);
        if (!client) return res.status(404).json({ message: 'Client non trouvé.' });

        await client.update({
            nom: nom || client.nom,
            utilisateurId: utilisateurId || client.utilisateurId,
            telephone: telephone || client.telephone,
            adresse: adresse || client.adresse,
            email: email || client.email
        });

        res.status(200).json({ message: 'Client mis à jour avec succès.', client });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du client :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

// Supprimer un client
const supprimerClient = async (req, res) => {
    try {
        const { id } = req.params;
        const client = await Client.findByPk(id);
        if (!client) return res.status(404).json({ message: 'Client non trouvé.' });

        await client.destroy();
        res.status(200).json({ message: 'Client supprimé avec succès.' });
    } catch (error) {
        console.error('Erreur lors de la suppression du client :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};

module.exports = {
    ajouterClient,
    recupererClients,
    consulterClient,
    modifierClient,
    supprimerClient
};
