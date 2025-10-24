const jwt = require("jsonwebtoken");
const Fournisseur = require("../models/fournisseur");
const Utilisateur = require("../models/utilisateur");
const Role = require("../models/role");
const Boutique = require("../models/boutique");

/**
 * 🔒 Fonction utilitaire pour décoder le token et récupérer l'utilisateur
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
 * Ajouter un fournisseur (ADMIN ou VENDEUR)
 */
const ajouterFournisseur = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    const { nom, telephone} = req.body;
    if (!nom) return res.status(400).json({ message: "Le nom est obligatoire." });

    // ADMIN et VENDEUR peuvent ajouter un fournisseur pour eux-mêmes
    const fournisseur = await Fournisseur.create({
      nom,
      telephone,
      utilisateurId: utilisateur.id,
      boutiqueId: utilisateur.boutiqueId,
    });

    res.status(201).json({
      message: "Fournisseur ajouté avec succès.",
      fournisseur,
    });
  } catch (error) {
    console.error("Erreur lors de l'ajout du fournisseur :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/**
 * Récupérer les fournisseurs selon le rôle
 */
const recupererFournisseurs = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    let whereClause = {};

    // Si ADMIN : il peut voir ses fournisseurs + ceux de ses vendeurs
    if (utilisateur.Role.nom === "ADMIN") {
      // Récupérer les vendeurs de la boutique de l’admin
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
    }
    // Si VENDEUR : uniquement ses fournisseurs
    else if (utilisateur.Role.nom === "VENDEUR") {
      whereClause.utilisateurId = utilisateur.id;
    }
    // Si SUPERADMIN : tous les fournisseurs
    else if (utilisateur.Role.nom === "SUPERADMIN") {
      whereClause = {};
    }
    else {
      return res.status(403).json({ message: "Rôle non autorisé." });
    }

    const fournisseurs = await Fournisseur.findAll({
      where: whereClause,
      include: [{ model: Utilisateur, attributes: ["id", "nom", "email"] }],
      order: [["nom", "ASC"]],
    });

    res.status(200).json(fournisseurs);
  } catch (error) {
    console.error("Erreur lors de la récupération des fournisseurs :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/**
 * Consulter un fournisseur (accès restreint)
 */
const consulterFournisseur = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    const { id } = req.params;
    const fournisseur = await Fournisseur.findByPk(id, {
      include: [{ model: Utilisateur, attributes: ["id", "nom", "email", "boutiqueId"], include: [Role] }],
    });
    if (!fournisseur) return res.status(404).json({ message: "Fournisseur non trouvé." });

    // Vérification d'accès
    if (utilisateur.Role.nom === "VENDEUR" && fournisseur.utilisateurId !== utilisateur.id) {
      return res.status(403).json({ message: "Accès refusé à ce fournisseur." });
    }

    if (utilisateur.Role.nom === "ADMIN") {
      // ADMIN : peut voir fournisseur d’un vendeur de sa boutique
      const boutique = await Boutique.findOne({ where: { utilisateurId: utilisateur.id } });
      const vendeurAutorisé = fournisseur.Utilisateur?.boutiqueId === boutique?.id;
      if (!vendeurAutorisé && fournisseur.utilisateurId !== utilisateur.id) {
        return res.status(403).json({ message: "Fournisseur hors de votre boutique." });
      }
    }

    res.status(200).json(fournisseur);
  } catch (error) {
    console.error("Erreur lors de la consultation du fournisseur :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/**
 * Modifier un fournisseur (mêmes règles d’accès)
 */
const modifierFournisseur = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    const { id } = req.params;
    const fournisseur = await Fournisseur.findByPk(id, {
      include: [{ model: Utilisateur, include: [Role] }],
    });
    if (!fournisseur) return res.status(404).json({ message: "Fournisseur non trouvé." });

    // Vérification des droits
    if (utilisateur.Role.nom === "VENDEUR" && fournisseur.utilisateurId !== utilisateur.id) {
      return res.status(403).json({ message: "Accès refusé à ce fournisseur." });
    }
    if (utilisateur.Role.nom === "ADMIN") {
      const boutique = await Boutique.findOne({ where: { utilisateurId: utilisateur.id } });
      const vendeurAutorisé = fournisseur.Utilisateur?.boutiqueId === boutique?.id;
      if (!vendeurAutorisé && fournisseur.utilisateurId !== utilisateur.id) {
        return res.status(403).json({ message: "Fournisseur hors de votre boutique." });
      }
    }

    const { nom, telephone } = req.body;
    await fournisseur.update({ nom, telephone });
    res.status(200).json({ message: "Fournisseur mis à jour avec succès.", fournisseur });
  } catch (error) {
    console.error("Erreur lors de la modification du fournisseur :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/**
 * Supprimer un fournisseur (mêmes règles d’accès)
 */
const supprimerFournisseur = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    const { id } = req.params;
    const fournisseur = await Fournisseur.findByPk(id, {
      include: [{ model: Utilisateur, include: [Role] }],
    });
    if (!fournisseur) return res.status(404).json({ message: "Fournisseur non trouvé." });

    if (utilisateur.Role.nom === "VENDEUR" && fournisseur.utilisateurId !== utilisateur.id) {
      return res.status(403).json({ message: "Suppression non autorisée." });
    }

    if (utilisateur.Role.nom === "ADMIN") {
      const boutique = await Boutique.findOne({ where: { utilisateurId: utilisateur.id } });
      const vendeurAutorisé = fournisseur.Utilisateur?.boutiqueId === boutique?.id;
      if (!vendeurAutorisé && fournisseur.utilisateurId !== utilisateur.id) {
        return res.status(403).json({ message: "Fournisseur hors de votre boutique." });
      }
    }

    await fournisseur.destroy();
    res.status(200).json({ message: "Fournisseur supprimé avec succès." });
  } catch (error) {
    console.error("Erreur lors de la suppression du fournisseur :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

module.exports = {
  ajouterFournisseur,
  recupererFournisseurs,
  consulterFournisseur,
  modifierFournisseur,
  supprimerFournisseur,
};
