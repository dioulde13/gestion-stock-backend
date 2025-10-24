const Utilisateur = require("../models/utilisateur");
const Role = require("../models/role");
// const nodemailer = require("nodemailer");

const Caisse = require("../models/caisse");
const sequelize = require("../models/sequelize");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");

const bcrypt = require("bcrypt");
const Boutique = require("../models/boutique");

// ===============================
// Connexion Utilisateur
// ===============================
const connexionUtilisateur = async (req, res) => {
  try {
    const { email, mot_de_passe } = req.body;

    // 🔍 Recherche de l'utilisateur avec son rôle et sa boutique (avec alias correct)
    const utilisateur = await Utilisateur.findOne({
      where: { email },
      include: [
        { model: Role, attributes: ["id", "nom"] },
        { model: Boutique, as: "Boutique", attributes: ["id", "nom"] }, // alias 'Boutique' comme dans le modèle
      ],
    });

    if (!utilisateur) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    // 🔐 Vérification du mot de passe
    const match = await bcrypt.compare(mot_de_passe, utilisateur.mot_de_passe);
    if (!match) {
      return res.status(401).json({ message: "Mot de passe incorrect." });
    }

    // 🔑 Génération du token JWT
    const token = jwt.sign(
      {
        id: utilisateur.id,
        email: utilisateur.email,
        role: utilisateur.Role.nom,
        boutiqueId: utilisateur.boutiqueId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // ✅ Réponse
    res.status(200).json({
      message: "Connexion réussie.",
      token,
      utilisateur: {
        id: utilisateur.id,
        nom: utilisateur.nom,
        email: utilisateur.email,
        roleId: utilisateur.roleId,
        role: utilisateur.Role.nom,
        boutiqueId: utilisateur.boutiqueId,
        boutique: utilisateur.Boutique ? utilisateur.Boutique.nom : null,
      },
    });
  } catch (error) {
    console.error("Erreur lors de la connexion :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

// const creerVendeur = async (req, res) => {
//   const t = await sequelize.transaction();
//   try {
//     let { boutiqueId, nom, email, mot_de_passe } = req.body;

//     if (!boutiqueId || !nom || !email) {
//       return res
//         .status(400)
//         .json({ message: "Tous les champs sont obligatoires." });
//     }

//     mot_de_passe = mot_de_passe || "1234";

//     // 🔍 Vérifier si la boutique existe
//     const boutique = await Boutique.findByPk(boutiqueId, {
//       include: [{ model: Utilisateur, as: "Vendeurs" }],
//     });
//     if (!boutique)
//       return res.status(404).json({ message: "Boutique non trouvée." });

//     // 🔍 Vérifier si l'email existe déjà
//     const exist = await Utilisateur.findOne({ where: { email } });
//     if (exist)
//       return res.status(400).json({ message: "Cet email est déjà utilisé." });

//     // 🔍 Récupérer ou créer le rôle VENDEUR
//     let roleVendeur = await Role.findOne({
//       where: { nom: "VENDEUR" },
//       transaction: t,
//     });
//     if (!roleVendeur)
//       roleVendeur = await Role.create({ nom: "VENDEUR" }, { transaction: t });

//     // 🔐 Hasher le mot de passe
//     const hash = await bcrypt.hash(mot_de_passe, 10);

//     // 👤 Créer le vendeur
//     const vendeur = await Utilisateur.create(
//       {
//         nom,
//         email,
//         mot_de_passe: hash,
//         roleId: roleVendeur.id,
//         boutiqueId,
//       },
//       { transaction: t }
//     );

//     // 🏦 Créer toutes les caisses pour le vendeur
//     const typesCaisses = [
//       "PRINCIPALE",
//       "VALEUR_STOCK_PUR",
//       "CAISSE",
//       "BENEFICE",
//       "VALEUR_STOCK",
//       "CREDIT_VENTE",
//       "BENEFICE_CREDIT",
//       "CREDIT_ACHAT",
//       "ACHAT_ESPACE",
//       "CREDIT_ESPECE",
//       "CREDIT_ESPECE_ENTRE",
//     ];

//     for (const type of typesCaisses) {
//       await Caisse.create(
//         { utilisateurId: vendeur.id, type, solde_actuel: 0 },
//         { transaction: t }
//       );
//     }

//     // ⚙️ Synchroniser la valeur VALEUR_STOCK_PUR avec celle de la boutique
//     // On prend celle de l'admin ou d'un vendeur existant
//     let caisseReference = await Caisse.findOne({
//       where: {
//         type: "VALEUR_STOCK_PUR",
//         utilisateurId: {
//           [Op.in]: boutique.Vendeurs.map((v) => v.id),
//         },
//       },
//       order: [["createdAt", "ASC"]],
//       transaction: t,
//     });

//     // Si aucun vendeur n’a encore de caisse, on prend celle de l’admin
//     if (!caisseReference) {
//       const admin = await Utilisateur.findOne({
//         where: { boutiqueId, roleId: 1 }, // rôle ADMIN
//         transaction: t,
//       });
//       if (admin) {
//         caisseReference = await Caisse.findOne({
//           where: { utilisateurId: admin.id, type: "VALEUR_STOCK_PUR" },
//           transaction: t,
//         });
//       }
//     }

//     // 🔁 Si une caisse de référence existe, on copie son solde
//     if (caisseReference) {
//       const caisseVendeur = await Caisse.findOne({
//         where: { utilisateurId: vendeur.id, type: "VALEUR_STOCK_PUR" },
//         transaction: t,
//       });

//       if (caisseVendeur) {
//         caisseVendeur.solde_actuel = caisseReference.solde_actuel;
//         await caisseVendeur.save({ transaction: t });
//       }
//     }

//     await t.commit();
//     res.status(201).json({ message: "Vendeur créé avec succès.", vendeur });
//   } catch (error) {
//     await t.rollback();
//     console.error(error);
//     res.status(500).json({ message: "Erreur lors de la création du vendeur." });
//   }
// };

const creerVendeur = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    let { boutiqueId, nom, email, mot_de_passe } = req.body;

    if (!boutiqueId || !nom || !email) {
      return res
        .status(400)
        .json({ message: "Tous les champs sont obligatoires." });
    }

    mot_de_passe = mot_de_passe || "1234";

    // 🔍 Vérifier si la boutique existe
    const boutique = await Boutique.findByPk(boutiqueId, {
      include: [{ model: Utilisateur, as: "Vendeurs" }],
      transaction: t,
    });
    if (!boutique)
      return res.status(404).json({ message: "Boutique non trouvée." });

    // 🔍 Vérifier si l'email existe déjà
    const exist = await Utilisateur.findOne({
      where: { email },
      transaction: t,
    });
    if (exist)
      return res.status(400).json({ message: "Cet email est déjà utilisé." });

    // 🔍 Récupérer ou créer le rôle VENDEUR
    let roleVendeur = await Role.findOne({
      where: { nom: "VENDEUR" },
      transaction: t,
    });
    if (!roleVendeur)
      roleVendeur = await Role.create({ nom: "VENDEUR" }, { transaction: t });

    // 🔐 Hasher le mot de passe
    const hash = await bcrypt.hash(mot_de_passe, 10);

    // 👤 Créer le vendeur
    const vendeur = await Utilisateur.create(
      {
        nom,
        email,
        mot_de_passe: hash,
        roleId: roleVendeur.id,
        boutiqueId,
      },
      { transaction: t }
    );

    // 🏦 Créer toutes les caisses pour le vendeur
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
        { utilisateurId: vendeur.id, type, solde_actuel: 0 },
        { transaction: t }
      );
    }

    // ⚙️ Récupérer la valeur actuelle du stock de la boutique (VALEUR_STOCK_PUR)
    const caisseBoutique = await Caisse.findOne({
      where: {
        type: "VALEUR_STOCK_PUR",
        utilisateurId: {
          [Op.in]: boutique.Vendeurs.map((v) => v.id),
        },
      },
      order: [["createdAt", "ASC"]],
      transaction: t,
    });

    // 🔁 Si la boutique a déjà une valeur VALEUR_STOCK_PUR
    if (caisseBoutique) {
      const valeurStockPur = caisseBoutique.solde_actuel;

      // 🧩 Mettre à jour la caisse du nouveau vendeur
      const caisseVendeur = await Caisse.findOne({
        where: { utilisateurId: vendeur.id, type: "VALEUR_STOCK_PUR" },
        transaction: t,
      });

      if (caisseVendeur) {
        caisseVendeur.solde_actuel = valeurStockPur;
        await caisseVendeur.save({ transaction: t });
      }

      // 🧩 Mettre à jour tous les vendeurs existants avec cette même valeur
      await Caisse.update(
        { solde_actuel: valeurStockPur },
        {
          where: {
            type: "VALEUR_STOCK_PUR",
            utilisateurId: {
              [Op.in]: boutique.Vendeurs.map((v) => v.id).concat(vendeur.id),
            },
          },
          transaction: t,
        }
      );
    }

    await t.commit();
    res.status(201).json({ message: "Vendeur créé avec succès.", vendeur });
  } catch (error) {
    await t.rollback();
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la création du vendeur." });
  }
};

// Récupérer utilisateurs selon rôle
const recupererUtilisateurs = async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader)
      return res
        .status(403)
        .json({ message: "Accès refusé. Aucun token trouvé." });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const utilisateurConnecte = await Utilisateur.findByPk(decoded.id, {
      include: [{ model: Role }, { model: Boutique, as: "Boutique" }],
    });

    if (!utilisateurConnecte)
      return res.status(404).json({ message: "Utilisateur non trouvé." });

    let utilisateurs = [];

    if (utilisateurConnecte.Role.nom.toLowerCase() === "admin") {
      // Admin voit ses vendeurs
      utilisateurs = await Utilisateur.findAll({
        include: [
          { model: Role, attributes: ["id", "nom"] },
          { model: Boutique, as: "Boutique", attributes: ["id", "nom"] },
        ],
        where: {
          "$Boutique.utilisateurId$": utilisateurConnecte.id,
          "$Role.nom$": "VENDEUR",
        },
      });
    } else if (utilisateurConnecte.Role.nom.toLowerCase() === "vendeur") {
      utilisateurs = [utilisateurConnecte];
    }

    res.status(200).json(utilisateurs);
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

const modifierUtilisateur = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, email, mot_de_passe } = req.body;
    const utilisateur = await Utilisateur.findByPk(id);
    if (!utilisateur)
      return res.status(404).json({ message: "Utilisateur non trouvé." });

    const updateData = {
      nom: nom || utilisateur.nom,
      email: email || utilisateur.email,
    };
    if (mot_de_passe)
      updateData.mot_de_passe = await bcrypt.hash(mot_de_passe, 10);

    await utilisateur.update(updateData);
    res
      .status(200)
      .json({ message: "Utilisateur mis à jour avec succès.", utilisateur });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de utilisateur :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

const otpGenererController = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email invalide" });
    }

    // Générer un OTP à 6 chiffres
    const otp = Math.floor(100000 + Math.random() * 900000);

    // Trouver l'utilisateur par email
    const user = await Utilisateur.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Sauvegarder l'OTP dans la BDD
    user.otp = otp;
    await user.save();

    // Envoi de l'OTP par email
    await transporter.sendMail({
      from: "baldedioulde992@gmail.com",
      to: email,
      subject: "Vérification OTP",
      text: `Votre code de vérification est : ${otp}`,
      html: `<p>Votre code de vérification est : <b>${otp}</b></p>`,
    });

    res.status(200).json({
      message: "OTP généré et envoyé avec succès",
    });
  } catch (error) {
    console.error("Erreur lors de la génération OTP :", error);
    res.status(500).json({ message: "Erreur interne du serveur" });
  }
};

// Vérification du code OTP
const verifierOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const utilisateur = await Utilisateur.findOne({ where: { email } });

    if (!utilisateur) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    if (utilisateur.otp !== parseInt(otp)) {
      return res.status(400).json({ message: "Code OTP incorrect." });
    }

    // OTP correct → on peut générer le token JWT
    const token = jwt.sign(
      {
        id: utilisateur.id,
        email: utilisateur.email,
        nom: utilisateur.nom,
        role: utilisateur.role,
      },
      SECRET_KEY,
      { expiresIn: "1h" }
    );

    // Supprimer l’OTP de la BDD
    utilisateur.otp = null;
    await utilisateur.save();

    res.status(200).json({ message: "Connexion réussie.", token });
  } catch (error) {
    console.error("Erreur lors de la vérification OTP :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

// Supprimer un Utilisateur
const supprimerUtilisateur = async (req, res) => {
  try {
    const { id } = req.params;
    const utilisateur = await Utilisateur.findByPk(id);
    if (!utilisateur)
      return res.status(404).json({ message: "Utilisateur non trouvé." });

    await utilisateur.destroy();
    res.status(200).json({ message: "Utilisateur supprimé avec succès." });
  } catch (error) {
    console.error("Erreur lors de la suppression du Utilisateur :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

const getUtilisateurConnecte = async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res.status(401).json({ message: "Token manquant" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Token invalide" });
    }

    // Vérification du token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(401).json({ message: "Token invalide ou expiré" });
    }

    // Récupérer l'utilisateur depuis la base
    const utilisateur = await Utilisateur.findByPk(decoded.id, {
      include: [
        { model: Role, attributes: ["id", "nom"] },
        { model: Boutique, as: "Boutique", attributes: ["id", "nom"] },
      ],
    });

    if (!utilisateur) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // ✅ Retourner directement l’utilisateur
    return res.status(200).json(utilisateur);
  } catch (error) {
    console.error("Erreur récupération utilisateur connecté :", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

module.exports = {
  getUtilisateurConnecte,
  verifierOtp,
  otpGenererController,
  creerVendeur,
  recupererUtilisateurs,
  modifierUtilisateur,
  connexionUtilisateur,
  supprimerUtilisateur,
};
