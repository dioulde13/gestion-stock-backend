const Utilisateur = require("../models/utilisateur");
const Role = require("../models/role");
const Caisse = require("../models/caisse");
const Boutique = require("../models/boutique");
const sequelize = require("../models/sequelize");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
require("dotenv").config(); // si tu utilises .env

const nodemailer = require("nodemailer");

// ⚡ Configurer le transporteur
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER, // ton email Gmail
    pass: process.env.MAIL_PASS, // mot de passe d'application
  },
});

// ===============================
// Utilitaire : récupérer l’utilisateur connecté via token JWT
// ===============================
const getUserFromToken = async (req) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) throw { status: 401, message: "Token manquant" };

  const token = authHeader.split(" ")[1];
  if (!token) throw { status: 401, message: "Token invalide" };

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw { status: 401, message: "Token invalide ou expiré" };
  }

  const utilisateur = await Utilisateur.findByPk(decoded.id, {
    include: [
      { model: Role, attributes: ["id", "nom"] },
      { model: Boutique, as: "Boutique", attributes: ["id", "nom"] },
    ],
  });

  if (!utilisateur) throw { status: 404, message: "Utilisateur non trouvé" };
  return utilisateur;
};

const connexionUtilisateur = async (req, res) => {
  try {
    const { email, mot_de_passe } = req.body;

    const utilisateur = await Utilisateur.findOne({
      where: { email },
      include: [
        { model: Role, attributes: ["id", "nom"] },
        {
          model: Boutique,
          as: "Boutique",
          attributes: ["id", "nom"],
          required: false,
        },
      ],
    });

    if (!utilisateur) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    if (utilisateur.bloque) {
      return res
        .status(403)
        .json({ message: "Compte bloqué. Contactez un administrateur." });
    }

    const match = await bcrypt.compare(mot_de_passe, utilisateur.mot_de_passe);
    if (!match) {
      utilisateur.tentativesLogin += 1;
      if (utilisateur.tentativesLogin > 3) {
        utilisateur.bloque = true;
      }
      await utilisateur.save();
      return res.status(401).json({ message: "Mot de passe incorrect" });
    }

    // Réinitialiser les tentatives en cas de succès
    utilisateur.tentativesLogin = 0;
    await utilisateur.save();

    // Générer OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpire = new Date(Date.now() + 1 * 60 * 1000); // 1 minute
    await utilisateur.update({ otp, otpExpire });

    // Envoyer email OTP
    try {
      await transporter.sendMail({
        from: process.env.MAIL_USER,
        to: utilisateur.email,
        subject: "Votre code OTP",
        text: `Votre code OTP est : ${otp}. Il expire dans 1 minute.`,
      });
    } catch (mailErr) {
      return res.status(500).json({ message: "Erreur envoi email OTP" });
    }

    return res.status(200).json({
      message: "OTP envoyé à votre adresse email",
      step: "otp_required",
      status: 200,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

const verifierOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const utilisateur = await Utilisateur.findOne({ where: { email } });

    if (!utilisateur)
      return res.status(404).json({ message: "Utilisateur non trouvé" });

    if (utilisateur.bloque) {
      return res
        .status(403)
        .json({ message: "Compte bloqué. Contactez un administrateur." });
    }

    if (utilisateur.otp !== Number(otp)) {
      utilisateur.tentativesOtp += 1;
      if (utilisateur.tentativesOtp > 3) {
        utilisateur.bloque = true;
      }
      await utilisateur.save();
      return res.status(400).json({ message: "OTP incorrect" });
    }

    if (new Date() > utilisateur.otpExpire) {
      return res.status(400).json({ message: "OTP expiré" });
    }

    // Réinitialiser les tentatives OTP en cas de succès
    utilisateur.tentativesOtp = 0;
    utilisateur.otp = null;
    utilisateur.otpExpire = null;
    await utilisateur.save();

    // Générer token JWT
    const token = jwt.sign(
      {
        id: utilisateur.id,
        email: utilisateur.email,
        role: utilisateur.Role?.nom,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      message: "Connexion réussie",
      token,
      utilisateur: {
        id: utilisateur.id,
        email: utilisateur.email,
        nom: utilisateur.nom,
        role: utilisateur.Role?.nom || null,
      },
      status: 200,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

const renvoyerOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email)
      return res
        .status(400)
        .json({ message: "Email requis pour renvoyer l'OTP" });

    const utilisateur = await Utilisateur.findOne({ where: { email } });
    if (!utilisateur)
      return res.status(404).json({ message: "Utilisateur non trouvé" });

    if (utilisateur.bloque) {
      return res
        .status(403)
        .json({ message: "Compte bloqué. Contactez un administrateur." });
    }

    // Générer nouveau OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpire = new Date(Date.now() + 1 * 60 * 1000); // 1 minute

    utilisateur.otp = otp;
    utilisateur.otpExpire = otpExpire;
    await utilisateur.save();

    // Envoyer email OTP
    try {
      await transporter.sendMail({
        from: process.env.MAIL_USER,
        to: utilisateur.email,
        subject: "Votre nouveau code OTP",
        text: `Votre nouveau code OTP est : ${otp}. Il expire dans 1 minute.`,
      });
    } catch (mailErr) {
      return res.status(500).json({ message: "Erreur envoi email OTP" });
    }

    res
      .status(200)
      .json({ message: "Nouveau OTP envoyé avec succès", status: 200 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// Créer un vendeur
// ===============================
const creerVendeur = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    let { boutiqueId, nom, email, mot_de_passe } = req.body;
    if (!boutiqueId || !nom || !email)
      return res
        .status(400)
        .json({ message: "Tous les champs sont obligatoires." });

    mot_de_passe = mot_de_passe || "1234";

    const boutique = await Boutique.findByPk(boutiqueId, {
      include: [{ model: Utilisateur, as: "Vendeurs" }],
      transaction: t,
    });
    if (!boutique)
      return res.status(404).json({ message: "Boutique non trouvée." });

    const exist = await Utilisateur.findOne({
      where: { email },
      transaction: t,
    });
    if (exist)
      return res.status(400).json({ message: "Cet email est déjà utilisé." });

    let roleVendeur = await Role.findOne({
      where: { nom: "VENDEUR" },
      transaction: t,
    });
    if (!roleVendeur)
      roleVendeur = await Role.create({ nom: "VENDEUR" }, { transaction: t });

    const hash = await bcrypt.hash(mot_de_passe, 10);

    const vendeur = await Utilisateur.create(
      { nom, email, mot_de_passe: hash, roleId: roleVendeur.id, boutiqueId },
      { transaction: t }
    );

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

    const caisseBoutique = await Caisse.findOne({
      where: {
        type: "VALEUR_STOCK_PUR",
        utilisateurId: { [Op.in]: boutique.Vendeurs.map((v) => v.id) },
      },
      order: [["createdAt", "ASC"]],
      transaction: t,
    });

    if (caisseBoutique) {
      const valeurStockPur = caisseBoutique.solde_actuel;
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

// ===============================
// Récupérer utilisateurs selon rôle
// ===============================
const recupererUtilisateurs = async (req, res) => {
  try {
    const utilisateurConnecte = await getUserFromToken(req);

    let utilisateurs = [];
    if (utilisateurConnecte.Role.nom.toLowerCase() === "admin") {
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
    } else {
      utilisateurs = [utilisateurConnecte];
    }

    res.status(200).json(utilisateurs);
  } catch (error) {
    console.error(error);
    res
      .status(error.status || 500)
      .json({ message: error.message || "Erreur serveur" });
  }
};

// ===============================
// Modifier utilisateur connecté
// ===============================
const modifierUtilisateur = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, email, boutiqueId } = req.body; // 🔥 Extraction manquante

    const utilisateur = await Utilisateur.findByPk(id);
    if (!utilisateur) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    await utilisateur.update({
      nom: nom ?? utilisateur.nom, // mise à jour seulement si donné
      email: email ?? utilisateur.email,
      boutiqueId: boutiqueId ?? utilisateur.boutiqueId,
    });

    res.status(200).json({
      message: "Profil mis à jour avec succès.",
      utilisateur: {
        id: utilisateur.id,
        nom: utilisateur.nom,
        email: utilisateur.email,
        boutiqueId: utilisateur.boutiqueId,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: error.message || "Erreur serveur",
    });
  }
};

// ===============================
// Changer mot de passe
// ===============================
const changerMotDePasse = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req);
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword)
      return res
        .status(400)
        .json({ message: "Ancien et nouveau mot de passe requis" });

    const match = await bcrypt.compare(oldPassword, utilisateur.mot_de_passe);
    if (!match)
      return res.status(401).json({ message: "Ancien mot de passe incorrect" });

    utilisateur.mot_de_passe = await bcrypt.hash(newPassword, 10);
    await utilisateur.save();

    res.status(200).json({ message: "Mot de passe modifié avec succès" });
  } catch (error) {
    console.error(error);
    res
      .status(error.status || 500)
      .json({ message: error.message || "Erreur serveur" });
  }
};

// ===============================
// Supprimer utilisateur
// ===============================
const supprimerUtilisateur = async (req, res) => {
  try {
    const { id } = req.params;
    const utilisateur = await Utilisateur.findByPk(id);
    if (!utilisateur)
      return res.status(404).json({ message: "Utilisateur non trouvé" });

    await utilisateur.destroy();
    res.status(200).json({ message: "Utilisateur supprimé avec succès" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur interne du serveur" });
  }
};

// ===============================
// Récupérer utilisateur connecté
// ===============================
const getUtilisateurConnecte = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req);
    res.status(200).json(utilisateur);
  } catch (error) {
    console.error(error);
    res
      .status(error.status || 500)
      .json({ message: error.message || "Erreur serveur" });
  }
};

const debloquerUtilisateur = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que l'utilisateur connecté est admin
    const admin = await getUserFromToken(req);
    if (admin.Role.nom.toLowerCase() !== "admin") {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const utilisateur = await Utilisateur.findByPk(id);
    if (!utilisateur)
      return res.status(404).json({ message: "Utilisateur non trouvé" });

    utilisateur.bloque = false;
    utilisateur.tentativesLogin = 0;
    utilisateur.tentativesOtp = 0;
    await utilisateur.save();

    res.status(200).json({ message: "Utilisateur débloqué avec succès." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

module.exports = {
  debloquerUtilisateur,
  getUtilisateurConnecte,
  creerVendeur,
  recupererUtilisateurs,
  modifierUtilisateur,
  connexionUtilisateur,
  supprimerUtilisateur,
  changerMotDePasse,
  verifierOtp,
  renvoyerOtp,
};
