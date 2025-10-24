const jwt = require("jsonwebtoken");
const Client = require("../models/client");
const Utilisateur = require("../models/utilisateur");
const Role = require("../models/role");
const Boutique = require("../models/boutique");

/**
 * 🔒 Fonction utilitaire pour décoder le token et récupérer l'utilisateur connecté
 */
const getUserFromToken = async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    res.status(403).json({ message: "Accès refusé. Aucun token trouvé." });
    return null;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const utilisateur = await Utilisateur.findByPk(decoded.id, { include: Role });
    if (!utilisateur) {
      res.status(404).json({ message: "Utilisateur non trouvé." });
      return null;
    }
    return utilisateur;
  } catch (error) {
    console.error("Erreur de vérification du token :", error);
    res.status(401).json({ message: "Token invalide ou expiré." });
    return null;
  }
};

/**
 * ➕ Ajouter un client (ADMIN ou VENDEUR)
 */
const ajouterClient = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    const { nom, telephone} = req.body;
    if (!nom) return res.status(400).json({ message: "Le nom est obligatoire." });

    // ADMIN et VENDEUR peuvent ajouter un client pour eux-mêmes
    const client = await Client.create({
      nom,
      telephone,
      utilisateurId: utilisateur.id,
      boutiqueId: utilisateur.boutiqueId,
    });

    res.status(201).json({
      message: "Client ajouté avec succès.",
      client,
    });
  } catch (error) {
    console.error("Erreur lors de l'ajout du client :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/**
 * 📜 Récupérer les clients selon le rôle
 */
const recupererClients = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    let whereClause = {};

    if (utilisateur.Role.nom === "ADMIN") {
      // ADMIN → ses clients + ceux des vendeurs de sa boutique
      const boutique = await Boutique.findOne({ where: { utilisateurId: utilisateur.id } });
      if (boutique) {
        const vendeurs = await Utilisateur.findAll({
          where: { boutiqueId: boutique.id },
          attributes: ["id"],
        });
        const vendeursIds = vendeurs.map((v) => v.id);
        whereClause.utilisateurId = [utilisateur.id, ...vendeursIds];
      } else {
        whereClause.utilisateurId = utilisateur.id;
      }
    } else if (utilisateur.Role.nom === "VENDEUR") {
      // VENDEUR → uniquement ses clients
      whereClause.utilisateurId = utilisateur.id;
    } else if (utilisateur.Role.nom === "SUPERADMIN") {
      // SUPERADMIN → tous les clients
      whereClause = {};
    } else {
      return res.status(403).json({ message: "Rôle non autorisé." });
    }

    const clients = await Client.findAll({
      where: whereClause,
      include: [{ model: Utilisateur, attributes: ["id", "nom", "email"] }],
      order: [["nom", "ASC"]],
    });

    res.status(200).json(clients);
  } catch (error) {
    console.error("Erreur lors de la récupération des clients :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/**
 * 🔍 Consulter un client par ID (avec restrictions)
 */
const consulterClient = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    const { id } = req.params;
    const client = await Client.findByPk(id, {
      include: [{ model: Utilisateur, attributes: ["id", "nom", "email", "boutiqueId"], include: [Role] }],
    });
    if (!client) return res.status(404).json({ message: "Client non trouvé." });

    // Contrôle d’accès
    if (utilisateur.Role.nom === "VENDEUR" && client.utilisateurId !== utilisateur.id) {
      return res.status(403).json({ message: "Accès refusé à ce client." });
    }

    if (utilisateur.Role.nom === "ADMIN") {
      const boutique = await Boutique.findOne({ where: { utilisateurId: utilisateur.id } });
      const vendeurAutorisé = client.Utilisateur?.boutiqueId === boutique?.id;
      if (!vendeurAutorisé && client.utilisateurId !== utilisateur.id) {
        return res.status(403).json({ message: "Client hors de votre boutique." });
      }
    }

    res.status(200).json(client);
  } catch (error) {
    console.error("Erreur lors de la consultation du client :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/**
 * ✏️ Modifier un client (mêmes règles d’accès)
 */
const modifierClient = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    const { id } = req.params;
    const client = await Client.findByPk(id, {
      include: [{ model: Utilisateur, include: [Role] }],
    });
    if (!client) return res.status(404).json({ message: "Client non trouvé." });

    if (utilisateur.Role.nom === "VENDEUR" && client.utilisateurId !== utilisateur.id) {
      return res.status(403).json({ message: "Accès refusé à ce client." });
    }
    if (utilisateur.Role.nom === "ADMIN") {
      const boutique = await Boutique.findOne({ where: { utilisateurId: utilisateur.id } });
      const vendeurAutorisé = client.Utilisateur?.boutiqueId === boutique?.id;
      if (!vendeurAutorisé && client.utilisateurId !== utilisateur.id) {
        return res.status(403).json({ message: "Client hors de votre boutique." });
      }
    }

    const { nom, telephone } = req.body;
    await client.update({ nom, telephone });

    res.status(200).json({ message: "Client mis à jour avec succès.", client });
  } catch (error) {
    console.error("Erreur lors de la modification du client :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/**
 * 🗑️ Supprimer un client (mêmes règles d’accès)
 */
const supprimerClient = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    const { id } = req.params;
    const client = await Client.findByPk(id, {
      include: [{ model: Utilisateur, include: [Role] }],
    });
    if (!client) return res.status(404).json({ message: "Client non trouvé." });

    if (utilisateur.Role.nom === "VENDEUR" && client.utilisateurId !== utilisateur.id) {
      return res.status(403).json({ message: "Suppression non autorisée." });
    }
    if (utilisateur.Role.nom === "ADMIN") {
      const boutique = await Boutique.findOne({ where: { utilisateurId: utilisateur.id } });
      const vendeurAutorisé = client.Utilisateur?.boutiqueId === boutique?.id;
      if (!vendeurAutorisé && client.utilisateurId !== utilisateur.id) {
        return res.status(403).json({ message: "Client hors de votre boutique." });
      }
    }

    await client.destroy();
    res.status(200).json({ message: "Client supprimé avec succès." });
  } catch (error) {
    console.error("Erreur lors de la suppression du client :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

module.exports = {
  ajouterClient,
  recupererClients,
  consulterClient,
  modifierClient,
  supprimerClient,
};
