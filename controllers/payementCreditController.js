const jwt = require("jsonwebtoken");
const PayementCredit = require("../models/payementCredit");
const Credit = require("../models/credit");
const Utilisateur = require("../models/utilisateur");
const Client = require("../models/client");
const Boutique = require("../models/boutique");
const Role = require("../models/role");
// const Caisse = require("../models/caisse");
const sequelize = require("../models/sequelize");
const { getCaisseByType } = require("../utils/caisseUtils"); // ton utilitaire

/**
 * 🧠 Récupération utilisateur depuis le token
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
    if (!utilisateur)
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    return utilisateur;
  } catch (error) {
    res.status(401).json({ message: "Token invalide ou expiré." });
    return null;
  }
};

const annulerPayementCredit = async (req, res) => {
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  const t = await sequelize.transaction();

  try {
    const { id } = req.params; // ID du paiement
    const payement = await PayementCredit.findByPk(id, {
      include: [{ model: Credit }],
      transaction: t,
    });

    if (!payement) {
      throw new Error("Paiement non trouvé.");
    }

    if (payement.status === "ANNULER") {
      throw new Error("Ce paiement est déjà annulé.");
    }

    const credit = payement.Credit;
    if (!credit) {
      throw new Error("Crédit associé introuvable.");
    }

    // Récupération des caisses nécessaires
    const boutique = await Boutique.findByPk(utilisateur.boutiqueId, {
      transaction: t,
    });

    const caisseVendeur = await getCaisseByType("CAISSE", utilisateur.id, t);
    const caisseAdminBoutique = await getCaisseByType(
      "CAISSE",
      boutique.utilisateurId,
      t
    );

    const caisseCreditEspeceUtilisateur = await getCaisseByType(
      "CREDIT_ESPECE",
      utilisateur.id,
      t
    );
    const caisseCreditEspeceAdminBoutique = await getCaisseByType(
      "CREDIT_ESPECE",
      boutique.utilisateurId,
      t
    );

    const caisseCreditVenteUtilisateur = await getCaisseByType(
      "CREDIT_VENTE",
      utilisateur.id,
      t
    );
    const caisseCreditVenteAdminBoutique = await getCaisseByType(
      "CREDIT_VENTE",
      boutique.utilisateurId,
      t
    );

    const caisseCreditEspeceEntreUtilisateur = await getCaisseByType(
      "CREDIT_ESPECE_ENTRE",
      utilisateur.id,
      t
    );
    const caisseCreditEspeceEntreAdminBoutique = await getCaisseByType(
      "CREDIT_ESPECE_ENTRE",
      boutique.utilisateurId,
      t
    );

    const montant = payement.montant;

    // 💰 Inversion des mouvements de caisse selon le type du crédit
    if (credit.type === "SORTIE") {
      if (credit.typeCredit === "ESPECE") {
        // On inverse le paiement en espèces
        caisseCreditEspeceAdminBoutique.solde_actuel += montant;
        caisseCreditEspeceUtilisateur.solde_actuel += montant;
        caisseVendeur.solde_actuel -= montant;
        caisseAdminBoutique.solde_actuel -= montant;
      } else if (credit.typeCredit === "VENTE") {
        // On inverse le paiement d’un crédit vente
        caisseCreditVenteUtilisateur.solde_actuel += montant;
        caisseCreditVenteAdminBoutique.solde_actuel += montant;
        caisseVendeur.solde_actuel -= montant;
        caisseAdminBoutique.solde_actuel -= montant;
      }
    } else if (credit.type === "ENTRE") {
      caisseCreditEspeceEntreAdminBoutique.solde_actuel += montant;
      caisseCreditEspeceEntreUtilisateur.solde_actuel += montant;
      caisseVendeur.solde_actuel += montant;
      caisseAdminBoutique.solde_actuel += montant;
    }

    // Sauvegarde de toutes les caisses
    await Promise.all([
      caisseVendeur.save({ transaction: t }),
      caisseAdminBoutique.save({ transaction: t }),
      caisseCreditEspeceUtilisateur.save({ transaction: t }),
      caisseCreditEspeceAdminBoutique.save({ transaction: t }),
      caisseCreditVenteUtilisateur.save({ transaction: t }),
      caisseCreditVenteAdminBoutique.save({ transaction: t }),
      caisseCreditEspeceEntreUtilisateur.save({ transaction: t }),
      caisseCreditEspeceEntreAdminBoutique.save({ transaction: t }),
    ]);

    // 📉 Mise à jour du crédit
    credit.montantPaye -= montant;
    if (credit.montantPaye === 0) {
      credit.montantRestant = 0;
    } else {
      credit.montantRestant = credit.montant - credit.montantPaye;
    }
    if (credit.montantRestant > 0) {
      credit.status = "EN COURS";
    } else if (credit.montantRestant === 0) {
      credit.status = "NON PAYER";
    }
    await credit.save({ transaction: t });

    // 🧾 Mise à jour du paiement
    payement.status = "ANNULER";
    await payement.save({ transaction: t });

    await t.commit();

    // ⚡ Notification Socket.io
    const io = req.app.get("io");
    io.emit("caisseMisAJour");

    res.status(200).json({
      message: "Paiement annulé avec succès.",
      payement,
      credit,
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Erreur lors de l'annulation du paiement :", error);
    res.status(500).json({
      message: error.message || "Erreur interne du serveur.",
    });
  }
};

/**
 * ➕ Ajouter un paiement de crédit
 */
const ajouterPayementCredit = async (req, res) => {
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  const t = await sequelize.transaction();

  try {
    const { reference, montant } = req.body;
    if (!reference || !montant) {
      throw new Error("Tous les champs obligatoires doivent être remplis.");
    }

    // 🔍 Recherche du crédit correspondant
    const credit = await Credit.findOne({
      where: { reference },
      transaction: t,
    });
    if (!credit) throw new Error("Crédit non trouvé pour cette référence.");

    if (credit.status === "ANNULER") {
      return res.status(400).json({ message: "Ce paiement est déjà annulé." });
    }

    // 1️⃣ Récupération de la caisse principale du vendeur
    const caisseVendeur = await getCaisseByType("CAISSE", utilisateur.id, t);
    if (!caisseVendeur)
      throw new Error("Caisse non trouvée pour cet utilisateur.");
    if (montant > caisseVendeur.solde_actuel)
      throw new Error("Solde insuffisant.");

    // 2️⃣ Caisse de l’administrateur de la boutique
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
      if (!caisseAdminBoutique)
        throw new Error("Caisse CAISSE de l’admin boutique introuvable.");
    }

    // 1️⃣ Caisse de l'utilisateur
    const caisseCreditEspeceUtilisateur = await getCaisseByType(
      "CREDIT_ESPECE",
      utilisateur.id,
      t
    );
    if (!caisseCreditEspeceUtilisateur)
      throw new Error("Caisse credit espece non trouvée pour cet utilisateur.");

    // 1️⃣ Caisse de l'utilisateur
    const caisseCreditVenteUtilisateur = await getCaisseByType(
      "CREDIT_VENTE",
      utilisateur.id,
      t
    );
    if (!caisseCreditVenteUtilisateur)
      throw new Error("Caisse credit espece non trouvée pour cet utilisateur.");

    // 2️⃣ Caisse de la boutique (admin principal)
    let caisseCreditEspeceAdminBoutique = null;
    if (boutique && boutique.utilisateurId) {
      caisseCreditEspeceAdminBoutique = await getCaisseByType(
        "CREDIT_ESPECE",
        boutique.utilisateurId,
        t
      );
    }

    let caisseCreditVenteAdminBoutique = null;
    if (boutique && boutique.utilisateurId) {
      caisseCreditVenteAdminBoutique = await getCaisseByType(
        "CREDIT_VENTE",
        boutique.utilisateurId,
        t
      );
    }

    // 1️⃣ Caisse de l'utilisateur
    const caisseCreditEspeceEntreUtilisateur = await getCaisseByType(
      "CREDIT_ESPECE_ENTRE",
      utilisateur.id,
      t
    );
    if (!caisseCreditEspeceEntreUtilisateur)
      throw new Error("Caisse credit espece non trouvée pour cet utilisateur.");

    // 2️⃣ Caisse de la boutique (admin principal)
    let caisseCreditEspeceEntreAdminBoutique = null;
    if (boutique && boutique.utilisateurId) {
      caisseCreditEspeceEntreAdminBoutique = await getCaisseByType(
        "CREDIT_ESPECE_ENTRE",
        boutique.utilisateurId,
        t
      );
    }

    // Vérification dépassement du crédit
    if (credit.montantPaye + montant > credit.montant) {
      throw new Error("Le montant dépasse le crédit restant.");
    }

    // 💰 Mise à jour du crédit
    credit.montantPaye += montant;
    credit.montantRestant = credit.montant - credit.montantPaye;

    // 💾 Enregistrement du paiement
    const payement = await PayementCredit.create(
      {
        creditId: credit.id,
        utilisateurId: utilisateur.id,
        montant,
        boutiqueId: utilisateur.boutiqueId,
        status: "VALIDER",
      },
      { transaction: t }
    );

    // 🧾 Gestion selon le type du crédit
    if (credit.type === "SORTIE") {
      if (credit.typeCredit === "ESPECE") {
        // 💵 Cas d'un crédit en espèces
        caisseCreditEspeceAdminBoutique.solde_actuel -= montant;
        // caisseCreditEspeceUtilisateur.solde_actuel -= montant;
        // caisseVendeur.solde_actuel += montant;

        const vendeurs = await Utilisateur.findAll({
          where: { boutiqueId: boutique.id },
          transaction: t,
        });
        for (const vendeur of vendeurs) {
          const caisseVendeur = await getCaisseByType("CAISSE", vendeur.id, t);
          if (caisseVendeur) {
            caisseVendeur.solde_actuel += montant;
            await caisseVendeur.save({ transaction: t });
          }
          const caisseCreditEspeceUtilisateur = await getCaisseByType(
            "CREDIT_ESPECE",
            vendeur.id,
            t
          );
          if (caisseCreditEspeceUtilisateur) {
            caisseCreditEspeceUtilisateur.solde_actuel -= montant;
            await caisseCreditEspeceUtilisateur.save({ transaction: t });
          }
        }
        caisseAdminBoutique.solde_actuel += montant;

        await Promise.all([
          caisseCreditEspeceAdminBoutique.save({ transaction: t }),
          // caisseCreditEspeceUtilisateur.save({ transaction: t }),
          // caisseVendeur.save({ transaction: t }),
          caisseAdminBoutique.save({ transaction: t }),
        ]);
      } else if (credit.typeCredit === "VENTE") {
        const vendeurs = await Utilisateur.findAll({
          where: { boutiqueId: boutique.id },
          transaction: t,
        });
        for (const vendeur of vendeurs) {
          const caisseVendeur = await getCaisseByType("CAISSE", vendeur.id, t);
          if (caisseVendeur) {
            caisseVendeur.solde_actuel += montant;
            await caisseVendeur.save({ transaction: t });
          }
          const caisseCreditVenteUtilisateur = await getCaisseByType(
            "CREDIT_VENTE",
            vendeur.id,
            t
          );
          if (caisseCreditVenteUtilisateur) {
            caisseCreditVenteUtilisateur.solde_actuel -= montant;
            await caisseCreditVenteUtilisateur.save({ transaction: t });
          }
        }
        // 🧾 Cas d'un crédit sur vente
        // caisseCreditVenteUtilisateur.solde_actuel -= montant;
        caisseCreditVenteAdminBoutique.solde_actuel -= montant;
        // caisseVendeur.solde_actuel += montant;
        caisseAdminBoutique.solde_actuel += montant;

        await Promise.all([
          // caisseCreditVenteUtilisateur.save({ transaction: t }),
          caisseCreditVenteAdminBoutique.save({ transaction: t }),
          // caisseVendeur.save({ transaction: t }),
          caisseAdminBoutique.save({ transaction: t }),
        ]);
      }
    } else if (credit.type === "ENTRE") {
      caisseCreditEspeceEntreAdminBoutique.solde_actuel -= montant;
      await caisseCreditEspeceEntreAdminBoutique.save({ transaction: t });

      caisseAdminBoutique.solde_actuel -= montant;
      await caisseAdminBoutique.save({ transaction: t });

      const vendeurs = await Utilisateur.findAll({
        where: { boutiqueId: boutique.id },
        transaction: t,
      });
      for (const vendeur of vendeurs) {
        const caisseVendeur = await getCaisseByType("CAISSE", vendeur.id, t);
        if (caisseVendeur) {
          caisseVendeur.solde_actuel -= montant;
          await caisseVendeur.save({ transaction: t });
        }
        const caisseCreditEspeceEntreUtilisateur = await getCaisseByType(
          "CREDIT_ESPECE_ENTRE",
          vendeur.id,
          t
        );
        if (caisseCreditEspeceEntreUtilisateur) {
          caisseCreditEspeceEntreUtilisateur.solde_actuel -= montant;
          await caisseCreditEspeceEntreUtilisateur.save({ transaction: t });
        }
      }

      // caisseVendeur.solde_actuel -= montant;
      // await caisseVendeur.save({ transaction: t });

      // caisseCreditEspeceEntreUtilisateur.solde_actuel -= montant;
      // await caisseCreditEspeceEntreUtilisateur.save({ transaction: t });
    }

    // 📊 Mise à jour du statut du crédit
    credit.status = credit.montantRestant === 0 ? "PAYER" : "EN COURS";
    await credit.save({ transaction: t });

    // ✅ Validation de la transaction avant toute opération externe
    await t.commit();

    // ⚡ Émission de l’événement Socket.io après validation
    // ✅ 5️⃣ Émission Socket pour mettre à jour la caisse côté client
    const io = req.app.get("io"); // 📢 récupérer l'instance Socket.io
    io.emit("caisseMisAJour"); // 📢 avertir tous les clients connectés

    // ✅ Réponse au client
    return res.status(201).json({
      message: "Paiement enregistré avec succès.",
      payement: { ...payement.toJSON(), reference: credit.reference },
    });
  } catch (error) {
    // 🔁 Rollback seulement si la transaction n’est pas déjà terminée
    if (!t.finished) await t.rollback();

    console.error("Erreur lors de l'ajout du paiement :", error);
    return res.status(500).json({
      message: error.message || "Erreur interne du serveur.",
    });
  }
};

/**
 * 🔍 Récupérer tous les paiements (avec rôle)
 */
const recupererPayementsCredit = async (req, res) => {
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  try {
    // 🔹 Récupération de l'utilisateur avec son rôle et sa boutique
    const utilisateurConnecte = await Utilisateur.findByPk(utilisateur.id, {
      include: [
        { model: Role, attributes: ["nom"] },
        { model: Boutique, as: "Boutique" },
      ],
    });
    if (!utilisateurConnecte)
      return res.status(404).json({ message: "Utilisateur non trouvé." });

    let idsUtilisateurs = [];

    if (utilisateurConnecte.Role.nom.toUpperCase() === "ADMIN") {
      // Admin : récupérer toutes les boutiques qu'il a créées
      const boutiques = await Boutique.findAll({
        where: { utilisateurId: utilisateurConnecte.id },
        include: [{ model: Utilisateur, as: "Vendeurs", attributes: ["id"] }],
      });

      for (const boutique of boutiques) {
        // Ajouter tous les utilisateurs (admin + vendeurs) de cette boutique
        idsUtilisateurs.push(boutique.utilisateurId); // admin
        if (boutique.Vendeurs && boutique.Vendeurs.length > 0) {
          boutique.Vendeurs.forEach((v) => idsUtilisateurs.push(v.id));
        }
      }
    } else if (utilisateurConnecte.Role.nom.toUpperCase() === "VENDEUR") {
      // Vendeur : récupérer tous les utilisateurs de sa boutique
      const boutique = await Boutique.findByPk(utilisateurConnecte.boutiqueId, {
        include: [{ model: Utilisateur, as: "Vendeurs", attributes: ["id"] }],
      });

      if (boutique) {
        idsUtilisateurs.push(boutique.utilisateurId); // admin
        if (boutique.Vendeurs && boutique.Vendeurs.length > 0) {
          boutique.Vendeurs.forEach((v) => idsUtilisateurs.push(v.id));
        }
      }
    } else {
      return res.status(403).json({ message: "Rôle non autorisé." });
    }

    const payements = await PayementCredit.findAll({
      where: { utilisateurId: idsUtilisateurs },
      include: [
        { model: Utilisateur, attributes: ["id", "nom", "email"] },
        {
          model: Credit,
          attributes: [
            "id",
            "reference",
            "montant",
            "montantPaye",
            "montantRestant",
          ],
          include: [{ model: Client, attributes: ["id", "nom"] }],
        },
      ],
      order: [["id", "DESC"]],
    });

    res.status(200).json(payements);
  } catch (error) {
    console.error("Erreur lors de la récupération des paiements :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/**
 * 🔎 Consulter un paiement (accès restreint)
 */
const consulterPayementCredit = async (req, res) => {
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  try {
    const { id } = req.params;
    const payement = await PayementCredit.findByPk(id, {
      include: [{ model: Utilisateur, include: [Role] }, { model: Credit }],
    });

    if (!payement)
      return res.status(404).json({ message: "Paiement non trouvé." });

    // Contrôle d’accès
    if (
      utilisateur.Role.nom === "VENDEUR" &&
      payement.utilisateurId !== utilisateur.id
    )
      return res.status(403).json({ message: "Accès refusé." });

    if (utilisateur.Role.nom === "ADMIN") {
      const boutique = await Boutique.findOne({
        where: { utilisateurId: utilisateur.id },
      });
      const vendeurAutorisé = payement.Utilisateur?.boutiqueId === boutique?.id;
      if (!vendeurAutorisé && payement.utilisateurId !== utilisateur.id)
        return res
          .status(403)
          .json({ message: "Paiement hors de votre boutique." });
    }

    res.status(200).json(payement);
  } catch (error) {
    console.error("Erreur lors de la consultation du paiement :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/**
 * ✏️ Modifier un paiement
 */
const modifierPayementCredit = async (req, res) => {
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  try {
    const { id } = req.params;
    const { montant } = req.body;

    const payement = await PayementCredit.findByPk(id, {
      include: [{ model: Utilisateur, include: [Role] }],
    });
    if (!payement)
      return res.status(404).json({ message: "Paiement non trouvé." });

    // Vérification des permissions
    if (
      utilisateur.Role.nom === "VENDEUR" &&
      payement.utilisateurId !== utilisateur.id
    )
      return res.status(403).json({ message: "Accès refusé." });

    if (utilisateur.Role.nom === "ADMIN") {
      const boutique = await Boutique.findOne({
        where: { utilisateurId: utilisateur.id },
      });
      const vendeurAutorisé = payement.Utilisateur?.boutiqueId === boutique?.id;
      if (!vendeurAutorisé && payement.utilisateurId !== utilisateur.id)
        return res
          .status(403)
          .json({ message: "Paiement hors de votre boutique." });
    }

    const credit = await Credit.findByPk(payement.creditId);
    if (!credit)
      return res.status(404).json({ message: "Crédit associé non trouvé." });

    // Mise à jour du crédit avant modif
    credit.montantPaye = credit.montantPaye - payement.montant + montant;
    credit.montantRestant = credit.montant - credit.montantPaye;
    credit.status = credit.montantRestant === 0 ? "PAYEE" : "EN COURS";

    payement.montant = montant;
    await credit.save();
    await payement.save();

    res
      .status(200)
      .json({ message: "Paiement mis à jour avec succès.", payement });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du paiement :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/**
 * ❌ Supprimer un paiement (restreint)
 */
const supprimerPayementCredit = async (req, res) => {
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  try {
    const { id } = req.params;
    const payement = await PayementCredit.findByPk(id, {
      include: [{ model: Utilisateur, include: [Role] }],
    });
    if (!payement)
      return res.status(404).json({ message: "Paiement non trouvé." });

    if (
      utilisateur.Role.nom === "VENDEUR" &&
      payement.utilisateurId !== utilisateur.id
    )
      return res.status(403).json({ message: "Suppression non autorisée." });

    if (utilisateur.Role.nom === "ADMIN") {
      const boutique = await Boutique.findOne({
        where: { utilisateurId: utilisateur.id },
      });
      const vendeurAutorisé = payement.Utilisateur?.boutiqueId === boutique?.id;
      if (!vendeurAutorisé && payement.utilisateurId !== utilisateur.id)
        return res
          .status(403)
          .json({ message: "Paiement hors de votre boutique." });
    }

    const credit = await Credit.findByPk(payement.creditId);
    if (credit) {
      credit.montantPaye -= payement.montant;
      credit.montantRestant = credit.montant - credit.montantPaye;
      credit.status = "EN COURS";
      await credit.save();
    }

    await payement.destroy();
    res.status(200).json({ message: "Paiement supprimé avec succès." });
  } catch (error) {
    console.error("Erreur lors de la suppression du paiement :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

module.exports = {
  ajouterPayementCredit,
  recupererPayementsCredit,
  consulterPayementCredit,
  modifierPayementCredit,
  supprimerPayementCredit,
  annulerPayementCredit,
};
