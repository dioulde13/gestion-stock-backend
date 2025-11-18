const bcrypt = require("bcrypt");
const Boutique = require("../models/boutique");
const Utilisateur = require("../models/utilisateur");
const Role = require("../models/role");
const Caisse = require("../models/caisse");
const sequelize = require("../models/sequelize");

const jwt = require("jsonwebtoken");

const recupererBoutiquesParAdmin = async (req, res) => {
  try {
    // 1️⃣ Vérifier le token
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res
        .status(403)
        .json({ message: "Accès refusé. Aucun token trouvé." });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Token invalide." });
    }

    // 2️⃣ Récupérer l'utilisateur connecté
    const utilisateur = await Utilisateur.findByPk(decoded.id, {
      include: [{ model: Role, attributes: ["id", "nom"] }],
    });
    if (!utilisateur) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    // Vérifier que c'est un admin
    if (utilisateur.Role.nom.toLowerCase() !== "admin") {
      return res
        .status(403)
        .json({
          message:
            "Accès refusé. Seuls les admins peuvent accéder à ces données.",
        });
    }

    // 3️⃣ Récupérer les boutiques de cet admin avec les vendeurs
    const boutiques = await Boutique.findAll({
      where: { utilisateurId: utilisateur.id }, // admin de la boutique
      include: [
        {
          model: Utilisateur,
          as: "Admin",
          attributes: ["id", "nom", "email"],
          include: [{ model: Role, attributes: ["id", "nom"] }],
        },
        {
          model: Utilisateur,
          as: "Vendeurs",
          attributes: ["id", "nom", "email"],
          include: [{ model: Role, attributes: ["id", "nom"] }],
        },
      ],
    });

    res.status(200).json(boutiques);
  } catch (error) {
    console.error("Erreur lors de la récupération des boutiques :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

// ===============================
// Créer une Boutique + son Admin
// ===============================
const creerBoutiqueAvecAdmin = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { nomBoutique, adresse, emailAdmin, mot_de_passeAdmin } = req.body;

    if (!nomBoutique || !adresse || !emailAdmin || !mot_de_passeAdmin) {
      return res
        .status(400)
        .json({ message: "Tous les champs sont obligatoires." });
    }

    // 1️⃣ Vérifier si l'admin existe
    let admin = await Utilisateur.findOne({
      where: { email: emailAdmin },
      transaction: t,
    });

    if (!admin) {
      // 2️⃣ Si l'admin n'existe pas, on le crée
      const roleAdmin = await Role.findOrCreate({
        where: { nom: "ADMIN" },
        defaults: { nom: "ADMIN" },
        transaction: t,
      }).then((r) => r[0]);

      const hash = await bcrypt.hash(req.body.mot_de_passeAdmin, 10);
      admin = await Utilisateur.create(
        {
          nom: req.body.nomAdmin,
          email: emailAdmin,
          mot_de_passe: hash,
          roleId: roleAdmin.id,
        },
        { transaction: t }
      );

      // Créer les caisses pour cet admin
      const typesCaisses = [
        "PRINCIPALE",
        "VALEUR_STOCK_PUR",
        "CAISSE",
        "BENEFICE",
        "VALEUR_STOCK",
        "CREDIT_VENTE",
        "BENEFICE_CREDIT",
        "CREDIT_ACHAT",
        "ACHAT_ESPACE",
        "CREDIT_ESPECE",
        "CREDIT_ESPECE_ENTRE",
      ];
      for (const type of typesCaisses) {
        await Caisse.create(
          { utilisateurId: admin.id, type, solde_actuel: 0 },
          { transaction: t }
        );
      }
    }

    // 3️⃣ Créer la boutique en la liant à cet admin
    const boutique = await Boutique.create(
      {
        nom: nomBoutique,
        adresse,
        utilisateurId: admin.id,
      },
      { transaction: t }
    );

    await t.commit();
    res.status(201).json({
      message: "Boutique créée avec succès pour cet admin.",
      boutique,
      admin,
    });
  } catch (error) {
    await t.rollback();
    console.error(error);
    res
      .status(500)
      .json({ message: "Erreur lors de la création de la boutique." });
  }
};

// Récupérer toutes les boutiques avec leur Admin
const recupererBoutiques = async (req, res) => {
  try {
    const boutiques = await Boutique.findAll({
      include: [
        {
          model: Utilisateur,
          as: "Admin",
          attributes: ["id", "nom", "email"],
          include: [{ model: Role, attributes: ["id", "nom"] }],
        },
      ],
    });
    res.status(200).json(boutiques);
  } catch (error) {
    console.error("Erreur lors de la récupération des boutiques :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

// Consulter une boutique par ID
const consulterBoutique = async (req, res) => {
  try {
    const { id } = req.params;
    const boutique = await Boutique.findByPk(id, {
      include: [
        {
          model: Utilisateur,
          as: "Admin",
          attributes: ["id", "nom", "email"],
          include: [{ model: Role, attributes: ["id", "nom"] }],
        },
      ],
    });
    if (!boutique)
      return res.status(404).json({ message: "Boutique non trouvée." });
    res.status(200).json(boutique);
  } catch (error) {
    console.error("Erreur lors de la consultation de la boutique :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

// Modifier une boutique
const modifierBoutique = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, adresse } = req.body;
    const boutique = await Boutique.findByPk(id);
    if (!boutique)
      return res.status(404).json({ message: "Boutique non trouvée." });

    await boutique.update({
      nom: nom || boutique.nom,
      adresse: adresse || boutique.adresse,
    });

    res
      .status(200)
      .json({ message: "Boutique mise à jour avec succès.", boutique });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la boutique :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

// Supprimer une boutique
const supprimerBoutique = async (req, res) => {
  try {
    const { id } = req.params;
    const boutique = await Boutique.findByPk(id);
    if (!boutique)
      return res.status(404).json({ message: "Boutique non trouvée." });

    await boutique.destroy();
    res.status(200).json({ message: "Boutique supprimée avec succès." });
  } catch (error) {
    console.error("Erreur lors de la suppression de la boutique :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

module.exports = {
  creerBoutiqueAvecAdmin,
  recupererBoutiques,
  consulterBoutique,
  modifierBoutique,
  supprimerBoutique,
  recupererBoutiquesParAdmin,
};
