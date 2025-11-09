const jwt = require("jsonwebtoken");
const Credit = require("../models/credit");
const Utilisateur = require("../models/utilisateur");
const Client = require("../models/client");
const Boutique = require("../models/boutique");
// const Caisse = require("../models/caisse");
const Role = require("../models/role");
const sequelize = require("../models/sequelize");
const { getCaisseByType } = require("../utils/caisseUtils"); // ton utilitaire

/**
 * 🧠 Récupération utilisateur depuis le token JWT
 */
const getUserFromToken = async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader)
    return res.status(403).json({ message: "Aucun token trouvé." });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const utilisateur = await Utilisateur.findByPk(decoded.id, {
      include: [Role],
    });
    if (!utilisateur) {
      res.status(404).json({ message: "Utilisateur non trouvé." });
      return null;
    }
    return utilisateur;
  } catch (error) {
    res.status(401).json({ message: "Token invalide ou expiré." });
    return null;
  }
};

const annulerCredit = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    const { id } = req.params;

    await sequelize.transaction(async (t) => {
      // 1️⃣ Récupération du crédit
      const credit = await Credit.findByPk(id, {
        include: [{ model: Client }],
        transaction: t,
      });

      if (!credit) {
        return res.status(404).json({ message: "Crédit non trouvé." });
      }

      if (credit.status === "ANNULER") {
        return res.status(400).json({ message: "Ce crédit est déjà annulé." });
      }

      // 2️⃣ Récupération des caisses concernées
      const caisseUtilisateur = await getCaisseByType(
        "CAISSE",
        utilisateur.id,
        t
      );
      const caisseAdminBoutique = await getCaisseByType(
        "CAISSE",
        credit.boutiqueId
          ? (
              await Boutique.findByPk(credit.boutiqueId, { transaction: t })
            ).utilisateurId
          : null,
        t
      );

      const caisseCreditEspeceUtilisateur = await getCaisseByType(
        "CREDIT_ESPECE",
        utilisateur.id,
        t
      );
      const caisseCreditEspeceAdminBoutique = await getCaisseByType(
        "CREDIT_ESPECE",
        caisseAdminBoutique.utilisateurId,
        t
      );

      const caisseCreditEspeceEntreUtilisateur = await getCaisseByType(
        "CREDIT_ESPECE_ENTRE",
        utilisateur.id,
        t
      );
      const caisseCreditEspeceEntreAdminBoutique = await getCaisseByType(
        "CREDIT_ESPECE_ENTRE",
        caisseAdminBoutique.utilisateurId,
        t
      );

      const montant = credit.montant;

      // 3️⃣ Inversion des mouvements de caisse
      if (credit.type === "SORTIE") {
        caisseCreditEspeceAdminBoutique.solde_actuel -= montant;
        caisseCreditEspeceUtilisateur.solde_actuel -= montant;
        caisseUtilisateur.solde_actuel += montant;
        caisseAdminBoutique.solde_actuel += montant;

        await Promise.all([
          caisseCreditEspeceAdminBoutique.save({ transaction: t }),
          caisseCreditEspeceUtilisateur.save({ transaction: t }),
          caisseUtilisateur.save({ transaction: t }),
          caisseAdminBoutique.save({ transaction: t }),
        ]);
      } else if (credit.type === "ENTRE") {
        caisseCreditEspeceEntreUtilisateur.solde_actuel -= montant;
        caisseCreditEspeceEntreAdminBoutique.solde_actuel -= montant;
        caisseUtilisateur.solde_actuel -= montant;
        caisseAdminBoutique.solde_actuel -= montant;

        await Promise.all([
          caisseCreditEspeceEntreUtilisateur.save({ transaction: t }),
          caisseCreditEspeceEntreAdminBoutique.save({ transaction: t }),
          caisseUtilisateur.save({ transaction: t }),
          caisseAdminBoutique.save({ transaction: t }),
        ]);
      }

      // 4️⃣ Mise à jour du crédit
      credit.status = "ANNULER";
      await credit.save({ transaction: t });

      // ✅ Émission socket pour mise à jour en temps réel
      const io = req.app.get("io");
      io.emit("caisseMisAJour");

      res.status(200).json({ message: "Crédit annulé avec succès.", credit });
    });
  } catch (error) {
    console.error("Erreur lors de l'annulation du crédit :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

const ajouterCredit = async (req, res) => {
  const { clientId, montant, description, type, typeCredit } = req.body;
  if (!clientId || !montant || !type || !description)
    return res
      .status(400)
      .json({ message: "Tous les champs obligatoires doivent être remplis." });

  try {
    await sequelize.transaction(async (t) => {
      const client = await Client.findByPk(clientId, { transaction: t });
      if (!client)
        return res.status(404).json({ message: "Client non trouvé." });
      const utilisateur = await getUserFromToken(req, res);
      if (!utilisateur) return;

      // 1️⃣ Caisse de l'utilisateur
      const caisseUtilisateur = await getCaisseByType(
        "CAISSE",
        utilisateur.id,
        t
      );
      if (!caisseUtilisateur)
        throw new Error("Caisse non trouvée pour cet utilisateur.");

      // 2️⃣ Caisse de la boutique (admin principal)
      let caisseAdminBoutique = null;
      const boutique = await Boutique.findByPk(utilisateur.boutiqueId, {
        transaction: t,
      });
      if (boutique && boutique.utilisateurId) {
        caisseAdminBoutique = await getCaisseByType(
          "CAISSE",
          boutique.utilisateurId,
          t
        );
      }

      // 1️⃣ Caisse CREDIT_ESPECE utilisateur
      const caisseCreditEspeceUtilisateur = await getCaisseByType(
        "CREDIT_ESPECE",
        utilisateur.id,
        t
      );
      if (!caisseCreditEspeceUtilisateur)
        throw new Error(
          "Caisse credit espece non trouvée pour cet utilisateur."
        );

      // 2️⃣ Caisse CREDIT_ESPECE admin boutique
      let caisseCreditEspeceAdminBoutique = null;
      if (boutique && boutique.utilisateurId) {
        caisseCreditEspeceAdminBoutique = await getCaisseByType(
          "CREDIT_ESPECE",
          boutique.utilisateurId,
          t
        );
      }

      // 1️⃣ Caisse CREDIT_ESPECE_ENTRE utilisateur
      const caisseCreditEspeceEntreUtilisateur = await getCaisseByType(
        "CREDIT_ESPECE_ENTRE",
        utilisateur.id,
        t
      );
      if (!caisseCreditEspeceEntreUtilisateur)
        throw new Error(
          "Caisse credit espece entre non trouvée pour cet utilisateur."
        );

      // 2️⃣ Caisse CREDIT_ESPECE_ENTRE admin boutique
      let caisseCreditEspeceEntreAdminBoutique = null;
      if (boutique && boutique.utilisateurId) {
        caisseCreditEspeceEntreAdminBoutique = await getCaisseByType(
          "CREDIT_ESPECE_ENTRE",
          boutique.utilisateurId,
          t
        );
      }

      // Vérif solde avant sortie
      if (type === "SORTIE" && montant > caisseUtilisateur.solde_actuel) {
        return res
          .status(400)
          .json({ message: "Solde insuffisant dans la caisse." });
      }

      // Génération de la référence
      const dernierCredit = await Credit.findOne({
        order: [["id", "DESC"]],
        transaction: t,
      });
      const numero = dernierCredit
        ? parseInt(dernierCredit.reference.replace(/^REF/, "")) + 1
        : 1;
      const reference = "REF" + String(numero).padStart(4, "0");

      // Création du crédit
      const credit = await Credit.create(
        {
          utilisateurId: utilisateur.id,
          clientId,
          reference,
          type,
          status: "NON PAYER",
          typeCredit: typeCredit || "ESPECE",
          description,
          montant,
          montantPaye: 0,
          montantRestant: 0,
          boutiqueId: utilisateur.boutiqueId,
        },
        { transaction: t }
      );

      // 💰 Mise à jour des caisses
      if (type === "SORTIE") {
        caisseCreditEspeceAdminBoutique.solde_actuel += montant;
        await caisseCreditEspeceAdminBoutique.save({ transaction: t });

        caisseCreditEspeceUtilisateur.solde_actuel += montant;
        await caisseCreditEspeceUtilisateur.save({ transaction: t });

        caisseUtilisateur.solde_actuel -= montant;
        await caisseUtilisateur.save({ transaction: t });

        caisseAdminBoutique.solde_actuel -= montant;
        await caisseAdminBoutique.save({ transaction: t });
      } else if (type === "ENTRE") {
        caisseCreditEspeceEntreUtilisateur.solde_actuel += montant;
        await caisseCreditEspeceEntreUtilisateur.save({ transaction: t });

        caisseCreditEspeceEntreAdminBoutique.solde_actuel += montant;
        await caisseCreditEspeceEntreAdminBoutique.save({ transaction: t });

        caisseUtilisateur.solde_actuel += montant;
        await caisseUtilisateur.save({ transaction: t });

        caisseAdminBoutique.solde_actuel += montant;
        await caisseAdminBoutique.save({ transaction: t });
      }

      // ✅ Émission socket pour mise à jour en temps réel
      const io = req.app.get("io");
      io.emit("caisseMisAJour");

      res.status(201).json({
        message: "Crédit créé avec succès.",
        credit,
      });
    });
  } catch (error) {
    console.error("Erreur lors de la création du crédit :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/**
 * 🔍 Récupérer les crédits selon le rôle
 */
const recupererCredits = async (req, res) => {
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  try {
    let whereClause = {};

    if (utilisateur.Role.nom === "SUPERADMIN") {
      whereClause = {};
    } else if (utilisateur.Role.nom === "ADMIN") {
      const boutique = await Boutique.findOne({
        where: { utilisateurId: utilisateur.id },
      });
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
      whereClause.utilisateurId = utilisateur.id;
    } else {
      return res.status(403).json({ message: "Rôle non autorisé." });
    }

    const credits = await Credit.findAll({
      where: whereClause,
      include: [
        { model: Utilisateur, attributes: ["id", "nom", "email"] },
        { model: Client, attributes: ["id", "nom", "telephone"] },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json(credits);
  } catch (error) {
    console.error("Erreur lors de la récupération des crédits :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/**
 * 🧾 Consulter un crédit (accès restreint)
 */
const consulterCredit = async (req, res) => {
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  try {
    const { id } = req.params;
    const credit = await Credit.findByPk(id, {
      include: [{ model: Utilisateur, include: [Role] }, { model: Client }],
    });
    if (!credit) return res.status(404).json({ message: "Crédit non trouvé." });

    // Sécurité
    if (
      utilisateur.Role.nom === "VENDEUR" &&
      credit.utilisateurId !== utilisateur.id
    )
      return res.status(403).json({ message: "Accès refusé." });

    if (utilisateur.Role.nom === "ADMIN") {
      const boutique = await Boutique.findOne({
        where: { utilisateurId: utilisateur.id },
      });
      const vendeurAutorisé = credit.Utilisateur?.boutiqueId === boutique?.id;
      if (!vendeurAutorisé && credit.utilisateurId !== utilisateur.id)
        return res
          .status(403)
          .json({ message: "Crédit hors de votre boutique." });
    }

    res.status(200).json(credit);
  } catch (error) {
    console.error("Erreur lors de la consultation du crédit :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

const modifierCredit = async (req, res) => {
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  const { id } = req.params; // Utiliser l'id du crédit depuis les params
  const { clientId, montant, description, type, typeCredit } = req.body;

  if (!clientId || !montant || !type || !description)
    return res
      .status(400)
      .json({ message: "Tous les champs obligatoires doivent être remplis." });

  try {
    await sequelize.transaction(async (t) => {
      const credit = await Credit.findByPk(id, { transaction: t });
      if (!credit)
        return res.status(404).json({ message: "Crédit non trouvé." });

      const client = await Client.findByPk(clientId, { transaction: t });
      if (!client)
        return res.status(404).json({ message: "Client non trouvé." });

      // 1️⃣ Caisse de l'utilisateur
      const caisseUtilisateur = await getCaisseByType(
        "CAISSE",
        utilisateur.id,
        t
      );
      if (!caisseUtilisateur)
        throw new Error("Caisse non trouvée pour cet utilisateur.");

      // 2️⃣ Caisse de la boutique (admin principal)
      let caisseAdminBoutique = null;
      const boutique = await Boutique.findByPk(utilisateur.boutiqueId, {
        transaction: t,
      });
      if (boutique && boutique.utilisateurId) {
        caisseAdminBoutique = await getCaisseByType(
          "CAISSE",
          boutique.utilisateurId,
          t
        );
      }

      // Caisse CREDIT_ESPECE
      const caisseCreditEspeceUtilisateur = await getCaisseByType(
        "CREDIT_ESPECE",
        utilisateur.id,
        t
      );
      let caisseCreditEspeceAdminBoutique = null;
      if (boutique && boutique.utilisateurId) {
        caisseCreditEspeceAdminBoutique = await getCaisseByType(
          "CREDIT_ESPECE",
          boutique.utilisateurId,
          t
        );
      }

      // Caisse CREDIT_ESPECE_ENTRE
      const caisseCreditEspeceEntreUtilisateur = await getCaisseByType(
        "CREDIT_ESPECE_ENTRE",
        utilisateur.id,
        t
      );
      let caisseCreditEspeceEntreAdminBoutique = null;
      if (boutique && boutique.utilisateurId) {
        caisseCreditEspeceEntreAdminBoutique = await getCaisseByType(
          "CREDIT_ESPECE_ENTRE",
          boutique.utilisateurId,
          t
        );
      }

      // ⚠️ Revenir sur les montants précédemment appliqués
      const montantPrecedent = credit.montant;
      const typePrecedent = credit.type;

      if (typePrecedent === "SORTIE") {
        if (caisseCreditEspeceAdminBoutique) {
          caisseCreditEspeceAdminBoutique.solde_actuel -= montantPrecedent;
          await caisseCreditEspeceAdminBoutique.save({ transaction: t });
        }

        if (caisseCreditEspeceUtilisateur) {
          caisseCreditEspeceUtilisateur.solde_actuel -= montantPrecedent;
          await caisseCreditEspeceUtilisateur.save({ transaction: t });
        }

        if (caisseUtilisateur) {
          caisseUtilisateur.solde_actuel += montantPrecedent;
          await caisseUtilisateur.save({ transaction: t });
        }

        if (caisseAdminBoutique) {
          caisseAdminBoutique.solde_actuel += montantPrecedent;
          await caisseAdminBoutique.save({ transaction: t });
        }
      } else if (typePrecedent === "ENTRE") {
        if (caisseCreditEspeceUtilisateur) {
          caisseCreditEspeceUtilisateur.solde_actuel -= montantPrecedent;
          await caisseCreditEspeceUtilisateur.save({ transaction: t });
        }

        if (caisseCreditEspeceEntreAdminBoutique) {
          caisseCreditEspeceEntreAdminBoutique.solde_actuel -= montantPrecedent;
          await caisseCreditEspeceEntreAdminBoutique.save({ transaction: t });
        }

        if (caisseUtilisateur) {
          caisseUtilisateur.solde_actuel -= montantPrecedent;
          await caisseUtilisateur.save({ transaction: t });
        }

        if (caisseAdminBoutique) {
          caisseAdminBoutique.solde_actuel -= montantPrecedent;
          await caisseAdminBoutique.save({ transaction: t });
        }
      }

      // ⚡️ Appliquer les nouveaux montants
      if (type === "SORTIE") {
        if (caisseCreditEspeceAdminBoutique) {
          caisseCreditEspeceAdminBoutique.solde_actuel += montant;
          await caisseCreditEspeceAdminBoutique.save({ transaction: t });
        }

        if (caisseCreditEspeceUtilisateur) {
          caisseCreditEspeceUtilisateur.solde_actuel += montant;
          await caisseCreditEspeceUtilisateur.save({ transaction: t });
        }

        if (caisseUtilisateur) {
          caisseUtilisateur.solde_actuel -= montant;
          await caisseUtilisateur.save({ transaction: t });
        }

        if (caisseAdminBoutique) {
          caisseAdminBoutique.solde_actuel -= montant;
          await caisseAdminBoutique.save({ transaction: t });
        }
      } else if (type === "ENTRE") {
        if (caisseCreditEspeceUtilisateur) {
          caisseCreditEspeceUtilisateur.solde_actuel += montant;
          await caisseCreditEspeceUtilisateur.save({ transaction: t });
        }

        if (caisseCreditEspeceEntreAdminBoutique) {
          caisseCreditEspeceEntreAdminBoutique.solde_actuel += montant;
          await caisseCreditEspeceEntreAdminBoutique.save({ transaction: t });
        }

        if (caisseUtilisateur) {
          caisseUtilisateur.solde_actuel += montant;
          await caisseUtilisateur.save({ transaction: t });
        }

        if (caisseAdminBoutique) {
          caisseAdminBoutique.solde_actuel += montant;
          await caisseAdminBoutique.save({ transaction: t });
        }
      }

      // ✅ Mise à jour du crédit
      credit.clientId = clientId;
      credit.montant = montant;
      credit.type = type;
      credit.typeCredit = typeCredit || "ESPECE";
      credit.description = description;
      await credit.save({ transaction: t });

      // ✅ Émission socket pour mise à jour en temps réel
      const io = req.app.get("io");
      io.emit("caisseMisAJour");

      res.status(200).json({
        message: "Crédit modifié avec succès.",
        credit,
      });
    });
  } catch (error) {
    console.error("Erreur lors de la modification du crédit :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/**
 * ❌ Supprimer un crédit (avec restrictions)
 */
const supprimerCredit = async (req, res) => {
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  const t = await sequelize.transaction(); // ✅ il manquait la transaction
  try {
    const { id } = req.params;

    // 🔹 Récupération du crédit avec son utilisateur
    const credit = await Credit.findByPk(id, {
      include: [{ model: Utilisateur, include: [Role] }],
      transaction: t,
    });

    if (!credit) {
      await t.rollback();
      return res.status(404).json({ message: "Crédit non trouvé." });
    }

    const type = credit.type; // ✅ récupération du type du crédit

    // 1️⃣ Caisse de l'utilisateur
    const caisseUtilisateur = await getCaisseByType(
      "CAISSE",
      utilisateur.id,
      t
    );
    if (!caisseUtilisateur)
      throw new Error("Caisse non trouvée pour cet utilisateur.");

    // 2️⃣ Caisse de la boutique (admin principal)
    const boutique = await Boutique.findByPk(utilisateur.boutiqueId, {
      transaction: t,
    });
    let caisseAdminBoutique = null;
    if (boutique?.utilisateurId) {
      caisseAdminBoutique = await getCaisseByType(
        "CAISSE",
        boutique.utilisateurId,
        t
      );
    }

    // 3️⃣ Caisses CREDIT_ESPECE
    const caisseCreditEspeceUtilisateur = await getCaisseByType(
      "CREDIT_ESPECE",
      utilisateur.id,
      t
    );
    if (!caisseCreditEspeceUtilisateur)
      throw new Error("Caisse credit espece non trouvée pour cet utilisateur.");

    let caisseCreditEspeceAdminBoutique = null;
    if (boutique?.utilisateurId) {
      caisseCreditEspeceAdminBoutique = await getCaisseByType(
        "CREDIT_ESPECE",
        boutique.utilisateurId,
        t
      );
    }

    // 4️⃣ Caisses CREDIT_ESPECE_ENTRE
    const caisseCreditEspeceEntreUtilisateur = await getCaisseByType(
      "CREDIT_ESPECE_ENTRE",
      utilisateur.id,
      t
    );
    if (!caisseCreditEspeceEntreUtilisateur)
      throw new Error(
        "Caisse credit espece entre non trouvée pour cet utilisateur."
      );

    let caisseCreditEspeceEntreAdminBoutique = null;
    if (boutique?.utilisateurId) {
      caisseCreditEspeceEntreAdminBoutique = await getCaisseByType(
        "CREDIT_ESPECE_ENTRE",
        boutique.utilisateurId,
        t
      );
    }

    // 💰 Mise à jour des caisses
    if (type === "SORTIE") {
      caisseCreditEspeceAdminBoutique.solde_actuel -= credit.montant;
      await caisseCreditEspeceAdminBoutique.save({ transaction: t });

      caisseCreditEspeceUtilisateur.solde_actuel -= credit.montant;
      await caisseCreditEspeceUtilisateur.save({ transaction: t });

      caisseUtilisateur.solde_actuel += credit.montant;
      await caisseUtilisateur.save({ transaction: t });

      caisseAdminBoutique.solde_actuel += credit.montant;
      await caisseAdminBoutique.save({ transaction: t });
    } else if (type === "ENTRE") {
      caisseCreditEspeceEntreUtilisateur.solde_actuel -= credit.montant;
      await caisseCreditEspeceEntreUtilisateur.save({ transaction: t });

      caisseCreditEspeceEntreAdminBoutique.solde_actuel -= credit.montant;
      await caisseCreditEspeceEntreAdminBoutique.save({ transaction: t });

      caisseUtilisateur.solde_actuel -= credit.montant;
      await caisseUtilisateur.save({ transaction: t });

      caisseAdminBoutique.solde_actuel -= credit.montant;
      await caisseAdminBoutique.save({ transaction: t });
    }

    // ✅ Suppression du crédit
    await credit.destroy({ transaction: t });

    // ✅ Commit de la transaction
    await t.commit();

    // ✅ Émission socket pour mise à jour en temps réel
    const io = req.app.get("io");
    io.emit("caisseMisAJour");

    res.status(200).json({ message: "Crédit supprimé avec succès." });
  } catch (error) {
    console.error("Erreur lors de la suppression du crédit :", error);
    await t.rollback();
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

module.exports = {
  ajouterCredit,
  recupererCredits,
  consulterCredit,
  modifierCredit,
  supprimerCredit,
  annulerCredit,
};
