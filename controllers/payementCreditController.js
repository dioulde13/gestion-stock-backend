// controllers/payementCreditController.js
const jwt = require("jsonwebtoken");
const { Transaction, Op } = require("sequelize");
const PayementCredit = require("../models/payementCredit");
const Credit = require("../models/credit");
const Utilisateur = require("../models/utilisateur");
const Client = require("../models/client");
const Boutique = require("../models/boutique");
const Role = require("../models/role");
const sequelize = require("../models/sequelize");
const { getCaisseByType } = require("../utils/caisseUtils");

/**
 * Récupération utilisateur depuis le token
 */
const getUserFromToken = async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    res.status(403).json({ message: "Aucun token trouvé." });
    return null;
  }

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

/**
 * Annuler un paiement de crédit (transaction unique)
 */
const annulerPayementCredit = async (req, res) => {
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  const t = await sequelize.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
  });

  try {
    const { id } = req.params;
    if (!id) {
      await t.rollback();
      return res.status(400).json({ message: "ID du paiement requis." });
    }

    // On lock le paiement + crédit
    const payement = await PayementCredit.findByPk(id, {
      include: [{ model: Credit }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!payement) {
      await t.rollback();
      return res.status(404).json({ message: "Paiement non trouvé." });
    }

    if (payement.status === "ANNULER") {
      await t.rollback();
      return res.status(400).json({ message: "Ce paiement est déjà annulé." });
    }

    const credit = payement.Credit;
    if (!credit) {
      await t.rollback();
      return res.status(400).json({ message: "Crédit associé introuvable." });
    }

    // On lock le crédit pour mise à jour
    await Credit.findByPk(credit.id, { transaction: t, lock: t.LOCK.UPDATE });

    // Récupération boutique et caisses (toutes passées la même transaction)
    const boutique = await Boutique.findByPk(utilisateur.boutiqueId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    // Récupération caisses (utilise getCaisseByType qui doit accepter transaction)
    const caisseAdminBoutique = boutique
      ? await getCaisseByType("CAISSE", boutique.utilisateurId, t)
      : null;
    const caisseCreditEspeceAdminBoutique = boutique
      ? await getCaisseByType("CREDIT_ESPECE", boutique.utilisateurId, t)
      : null;
    const caisseCreditVenteAdminBoutique = boutique
      ? await getCaisseByType("CREDIT_VENTE", boutique.utilisateurId, t)
      : null;
    const caisseCreditEspeceEntreAdminBoutique = boutique
      ? await getCaisseByType("CREDIT_ESPECE_ENTRE", boutique.utilisateurId, t)
      : null;

    let caisseCreditAchatAdminBoutique = null;
    if (boutique && boutique.utilisateurId) {
      caisseCreditAchatAdminBoutique = await getCaisseByType(
        "CREDIT_ACHAT",
        boutique.utilisateurId,
        t
      );
    }

    const montant = Number(payement.montant || 0);

    // Logique de restitution selon type du crédit
    if (credit.type === "SORTIE") {
      if (credit.typeCredit === "ESPECE") {
        const vendeurs = await Utilisateur.findAll({
          where: { boutiqueId: boutique?.id },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        for (const vendeur of vendeurs) {
          const caisseVendeurs = await getCaisseByType("CAISSE", vendeur.id, t);
          const caisseCreditEspeceUtilisateur = await getCaisseByType(
            "CREDIT_ESPECE",
            vendeur.id,
            t
          );

          if (!caisseVendeurs || !caisseCreditEspeceUtilisateur) {
            await t.rollback();
            return res
              .status(400)
              .json({ message: "Caisses utilisateur introuvables." });
          }

          caisseVendeurs.solde_actuel = Number(caisseVendeurs.solde_actuel) - montant;
          await caisseVendeurs.save({ transaction: t });

          caisseCreditEspeceUtilisateur.solde_actuel =
            Number(caisseCreditEspeceUtilisateur.solde_actuel) + montant;
          await caisseCreditEspeceUtilisateur.save({ transaction: t });
        }

        if (caisseAdminBoutique) {
          caisseAdminBoutique.solde_actuel = Number(caisseAdminBoutique.solde_actuel) - montant;
          await caisseAdminBoutique.save({ transaction: t });
        }

        if (caisseCreditEspeceAdminBoutique) {
          caisseCreditEspeceAdminBoutique.solde_actuel =
            Number(caisseCreditEspeceAdminBoutique.solde_actuel) + montant;
          await caisseCreditEspeceAdminBoutique.save({ transaction: t });
        }
      } else if (credit.typeCredit === "VENTE") {
        const vendeurs = await Utilisateur.findAll({
          where: { boutiqueId: boutique?.id },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        for (const vendeur of vendeurs) {
          const caisseVendeurs = await getCaisseByType("CAISSE", vendeur.id, t);
          const caisseCreditVenteUtilisateur = await getCaisseByType(
            "CREDIT_VENTE",
            vendeur.id,
            t
          );

          if (!caisseVendeurs || !caisseCreditVenteUtilisateur) {
            await t.rollback();
            return res
              .status(400)
              .json({ message: "Caisses utilisateur introuvables." });
          }

          caisseVendeurs.solde_actuel = Number(caisseVendeurs.solde_actuel) - montant;
          await caisseVendeurs.save({ transaction: t });

          caisseCreditVenteUtilisateur.solde_actuel =
            Number(caisseCreditVenteUtilisateur.solde_actuel) + montant;
          await caisseCreditVenteUtilisateur.save({ transaction: t });
        }

        if (caisseCreditVenteAdminBoutique) {
          caisseCreditVenteAdminBoutique.solde_actuel =
            Number(caisseCreditVenteAdminBoutique.solde_actuel) + montant;
          await caisseCreditVenteAdminBoutique.save({ transaction: t });
        }

        if (caisseAdminBoutique) {
          caisseAdminBoutique.solde_actuel = Number(caisseAdminBoutique.solde_actuel) - montant;
          await caisseAdminBoutique.save({ transaction: t });
        }
      }
    } else if (credit.type === "ENTRE") {
      if (credit.typeCredit === "ACHAT") {
        const vendeurs = await Utilisateur.findAll({
          where: { boutiqueId: boutique?.id },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        for (const vendeur of vendeurs) {
          const caisseVendeur = await getCaisseByType("CAISSE", vendeur.id, t);
          const caisseCreditAchatUtilisateur = await getCaisseByType(
            "CREDIT_ACHAT",
            vendeur.id,
            t
          );

          if (caisseVendeur) {
            caisseVendeur.solde_actuel = Number(caisseVendeur.solde_actuel) + montant;
            await caisseVendeur.save({ transaction: t });
          }
          if (caisseCreditAchatUtilisateur) {
            caisseCreditAchatUtilisateur.solde_actuel =
              Number(caisseCreditAchatUtilisateur.solde_actuel) + montant;
            await caisseCreditAchatUtilisateur.save({ transaction: t });
          }
        }

        if (caisseCreditAchatAdminBoutique) {
          caisseCreditAchatAdminBoutique.solde_actuel =
            Number(caisseCreditAchatAdminBoutique.solde_actuel) + montant;
          await caisseCreditAchatAdminBoutique.save({ transaction: t });
        }
        if (caisseAdminBoutique) {
          caisseAdminBoutique.solde_actuel = Number(caisseAdminBoutique.solde_actuel) + montant;
          await caisseAdminBoutique.save({ transaction: t });
        }
      } else {
        const vendeurs = await Utilisateur.findAll({
          where: { boutiqueId: boutique?.id },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        for (const vendeur of vendeurs) {
          const caisseVendeurs = await getCaisseByType("CAISSE", vendeur.id, t);
          const caisseCreditEspeceEntreUtilisateur = await getCaisseByType(
            "CREDIT_ESPECE_ENTRE",
            vendeur.id,
            t
          );

          if (caisseVendeurs) {
            caisseVendeurs.solde_actuel = Number(caisseVendeurs.solde_actuel) + montant;
            await caisseVendeurs.save({ transaction: t });
          }
          if (caisseCreditEspeceEntreUtilisateur) {
            caisseCreditEspeceEntreUtilisateur.solde_actuel =
              Number(caisseCreditEspeceEntreUtilisateur.solde_actuel) + montant;
            await caisseCreditEspeceEntreUtilisateur.save({ transaction: t });
          }
        }

        if (caisseCreditEspeceEntreAdminBoutique) {
          caisseCreditEspeceEntreAdminBoutique.solde_actuel =
            Number(caisseCreditEspeceEntreAdminBoutique.solde_actuel) + montant;
          await caisseCreditEspeceEntreAdminBoutique.save({ transaction: t });
        }
        if (caisseAdminBoutique) {
          caisseAdminBoutique.solde_actuel = Number(caisseAdminBoutique.solde_actuel) + montant;
          await caisseAdminBoutique.save({ transaction: t });
        }
      }
    }



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

    // // Mise à jour du crédit
    // credit.montantPaye = Number(credit.montantPaye) - montant;
    // if (credit.montantPaye <= 0) {
    //   credit.montantPaye = 0;
    //   credit.montantRestant = credit.montant || 0;
    // } else {
    //   credit.montantRestant = Number(credit.montant) - Number(credit.montantPaye);
    // }

    // credit.status = credit.montantRestant > 0 ? "EN COURS" : "NON PAYER";
    await credit.save({ transaction: t });

    // Mise à jour du paiement
    payement.status = "ANNULER";
    payement.nomPersonneAnnuler = utilisateur.nom;
    await payement.save({ transaction: t });

    await t.commit();

    // Socket emit après commit
    const io = req.app.get("io");
    if (io) io.emit("caisseMisAJour");

    return res.status(200).json({
      message: "Paiement annulé avec succès.",
      payement,
      credit,
    });
  } catch (error) {
    try {
      if (!t.finished) await t.rollback();
    } catch (e) {
      console.error("Rollback failed:", e);
    }
    console.error("Erreur lors de l'annulation du paiement :", error);
    return res.status(500).json({
      message: error.message || "Erreur interne du serveur.",
    });
  }
};

/**
 * Ajouter un paiement de crédit (transaction unique, verrous coherents)
 */
const ajouterPayementCredit = async (req, res) => {
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  const t = await sequelize.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
  });

  try {
    const { reference, montant } = req.body;
    if (!reference || montant == null) {
      await t.rollback();
      return res.status(400).json({
        message: "Tous les champs obligatoires doivent être remplis.",
      });
    }

    const montantNum = Number(montant);
    if (isNaN(montantNum) || montantNum <= 0) {
      await t.rollback();
      return res.status(400).json({ message: "Montant invalide." });
    }

    // Recherche du crédit avec lock
    const credit = await Credit.findOne({
      where: { reference },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!credit) {
      await t.rollback();
      return res.status(404).json({ message: "Crédit non trouvé pour cette référence." });
    }

    if (String(credit.status).toUpperCase() === "ANNULER") {
      await t.rollback();
      return res.status(400).json({ message: "Ce crédit est annulé." });
    }

    // Récupération caisse vendeur (avec transaction)
    const caisseVendeur = await getCaisseByType("CAISSE", utilisateur.id, t);
    if (!caisseVendeur) {
      await t.rollback();
      return res.status(400).json({ message: "Caisse non trouvée pour cet utilisateur." });
    }

    // Récupération boutique et caisses admin boutique
    const boutique = await Boutique.findByPk(utilisateur.boutiqueId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    let caisseAdminBoutique = null;
    if (boutique && boutique.utilisateurId) {
      caisseAdminBoutique = await getCaisseByType("CAISSE", boutique.utilisateurId, t);
      if (!caisseAdminBoutique) {
        await t.rollback();
        return res.status(400).json({ message: "Caisse CAISSE de l’admin boutique introuvable." });
      }
    }

    // Récupération autres caisses nécessaires
    const caisseCreditEspeceUtilisateur = await getCaisseByType(
      "CREDIT_ESPECE",
      utilisateur.id,
      t
    );
    const caisseCreditVenteUtilisateur = await getCaisseByType(
      "CREDIT_VENTE",
      utilisateur.id,
      t
    );
    const caisseCreditEspeceEntreUtilisateur = await getCaisseByType(
      "CREDIT_ESPECE_ENTRE",
      utilisateur.id,
      t
    );

    if (!caisseCreditEspeceUtilisateur || !caisseCreditVenteUtilisateur || !caisseCreditEspeceEntreUtilisateur) {
      await t.rollback();
      return res.status(400).json({ message: "Certaines caisses utilisateur introuvables." });
    }

    // Caisses admin (peuvent être null si boutique non définie)
    let caisseCreditEspeceAdminBoutique = null;
    let caisseCreditVenteAdminBoutique = null;
    let caisseCreditAchatAdminBoutique = null;
    let caisseCreditEspeceEntreAdminBoutique = null;

    if (boutique && boutique.utilisateurId) {
      caisseCreditEspeceAdminBoutique = await getCaisseByType("CREDIT_ESPECE", boutique.utilisateurId, t);
      caisseCreditVenteAdminBoutique = await getCaisseByType("CREDIT_VENTE", boutique.utilisateurId, t);
      caisseCreditAchatAdminBoutique = await getCaisseByType("CREDIT_ACHAT", boutique.utilisateurId, t);
      caisseCreditEspeceEntreAdminBoutique = await getCaisseByType("CREDIT_ESPECE_ENTRE", boutique.utilisateurId, t);
    }

    // Vérification dépassement du crédit
    const nouveauMontantPaye = Number(credit.montantPaye || 0) + montantNum;
    if (nouveauMontantPaye > Number(credit.montant || 0)) {
      await t.rollback();
      return res.status(400).json({ message: "Le montant dépasse le crédit restant." });
    }

    // Création du paiement (dans la transaction)
    const payement = await PayementCredit.create(
      {
        creditId: credit.id,
        utilisateurId: utilisateur.id,
        montant: montantNum,
        boutiqueId: utilisateur.boutiqueId,
        status: "VALIDER",
      },
      { transaction: t }
    );

    // Application des mouvements sur les caisses selon le type
    if (credit.type === "SORTIE") {
      if (credit.typeCredit === "ESPECE") {
        if (!caisseCreditEspeceAdminBoutique || !caisseAdminBoutique) {
          await t.rollback();
          return res.status(400).json({ message: "Caisses admin introuvables." });
        }

        caisseCreditEspeceAdminBoutique.solde_actuel =
          Number(caisseCreditEspeceAdminBoutique.solde_actuel) - montantNum;

        // Transférer vers tous les vendeurs de la boutique
        const vendeurs = await Utilisateur.findAll({
          where: { boutiqueId: boutique?.id },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        for (const vendeur of vendeurs) {
          const caisseVendeur = await getCaisseByType("CAISSE", vendeur.id, t);
          const caisseCreditEspeceUtilisateurV = await getCaisseByType(
            "CREDIT_ESPECE",
            vendeur.id,
            t
          );

          if (caisseVendeur) {
            caisseVendeur.solde_actuel = Number(caisseVendeur.solde_actuel) + montantNum;
            await caisseVendeur.save({ transaction: t });
          }
          if (caisseCreditEspeceUtilisateurV) {
            caisseCreditEspeceUtilisateurV.solde_actuel =
              Number(caisseCreditEspeceUtilisateurV.solde_actuel) - montantNum;
            await caisseCreditEspeceUtilisateurV.save({ transaction: t });
          }
        }

        caisseAdminBoutique.solde_actuel = Number(caisseAdminBoutique.solde_actuel) + montantNum;

        await Promise.all([
          caisseCreditEspeceAdminBoutique.save({ transaction: t }),
          caisseAdminBoutique.save({ transaction: t }),
        ]);
      } else if (credit.typeCredit === "VENTE") {
        if (!caisseCreditVenteAdminBoutique || !caisseAdminBoutique) {
          await t.rollback();
          return res.status(400).json({ message: "Caisses admin introuvables." });
        }

        const vendeurs = await Utilisateur.findAll({
          where: { boutiqueId: boutique?.id },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        for (const vendeur of vendeurs) {
          const caisseVendeur = await getCaisseByType("CAISSE", vendeur.id, t);
          const caisseCreditVenteUtilisateur = await getCaisseByType(
            "CREDIT_VENTE",
            vendeur.id,
            t
          );

          if (caisseVendeur) {
            caisseVendeur.solde_actuel = Number(caisseVendeur.solde_actuel) + montantNum;
            await caisseVendeur.save({ transaction: t });
          }
          if (caisseCreditVenteUtilisateur) {
            caisseCreditVenteUtilisateur.solde_actuel =
              Number(caisseCreditVenteUtilisateur.solde_actuel) - montantNum;
            await caisseCreditVenteUtilisateur.save({ transaction: t });
          }
        }

        caisseCreditVenteAdminBoutique.solde_actuel =
          Number(caisseCreditVenteAdminBoutique.solde_actuel) - montantNum;
        caisseAdminBoutique.solde_actuel = Number(caisseAdminBoutique.solde_actuel) + montantNum;

        await Promise.all([
          caisseCreditVenteAdminBoutique.save({ transaction: t }),
          caisseAdminBoutique.save({ transaction: t }),
        ]);
      }
    } else if (credit.type === "ENTRE") {
      // Assurer qu'on a la caisseVendeur (celle de l'utilisateur ordinaire)
      if (montantNum > Number(caisseVendeur.solde_actuel)) {
        await t.rollback();
        return res.status(400).json({ message: "Solde insuffisant." });
      }

      if (credit.typeCredit === "ACHAT") {
        const vendeurs = await Utilisateur.findAll({
          where: { boutiqueId: boutique?.id },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        for (const vendeur of vendeurs) {
          const caisseVendeur = await getCaisseByType("CAISSE", vendeur.id, t);
          const caisseCreditAchatUtilisateur = await getCaisseByType(
            "CREDIT_ACHAT",
            vendeur.id,
            t
          );

          if (caisseVendeur) {
            caisseVendeur.solde_actuel = Number(caisseVendeur.solde_actuel) - montantNum;
            await caisseVendeur.save({ transaction: t });
          }
          if (caisseCreditAchatUtilisateur) {
            caisseCreditAchatUtilisateur.solde_actuel =
              Number(caisseCreditAchatUtilisateur.solde_actuel) - montantNum;
            await caisseCreditAchatUtilisateur.save({ transaction: t });
          }
        }

        if (!caisseCreditAchatAdminBoutique || !caisseAdminBoutique) {
          await t.rollback();
          return res.status(400).json({ message: "Caisses admin introuvables." });
        }

        caisseCreditAchatAdminBoutique.solde_actuel =
          Number(caisseCreditAchatAdminBoutique.solde_actuel) - montantNum;
        caisseAdminBoutique.solde_actuel = Number(caisseAdminBoutique.solde_actuel) - montantNum;

        await Promise.all([
          caisseCreditAchatAdminBoutique.save({ transaction: t }),
          caisseAdminBoutique.save({ transaction: t }),
        ]);
      } else {
        // autre type d'ENTRE (ESPECE_ENTRE)
        if (!caisseCreditEspeceEntreAdminBoutique || !caisseAdminBoutique) {
          await t.rollback();
          return res.status(400).json({ message: "Caisses admin introuvables." });
        }

        caisseCreditEspeceEntreAdminBoutique.solde_actuel =
          Number(caisseCreditEspeceEntreAdminBoutique.solde_actuel) - montantNum;
        await caisseCreditEspeceEntreAdminBoutique.save({ transaction: t });

        caisseAdminBoutique.solde_actuel = Number(caisseAdminBoutique.solde_actuel) - montantNum;
        await caisseAdminBoutique.save({ transaction: t });

        const vendeurs = await Utilisateur.findAll({
          where: { boutiqueId: boutique?.id },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        for (const vendeur of vendeurs) {
          const caisseVendeur = await getCaisseByType("CAISSE", vendeur.id, t);
          const caisseCreditEspeceEntreUtilisateur = await getCaisseByType(
            "CREDIT_ESPECE_ENTRE",
            vendeur.id,
            t
          );

          if (caisseVendeur) {
            caisseVendeur.solde_actuel = Number(caisseVendeur.solde_actuel) - montantNum;
            await caisseVendeur.save({ transaction: t });
          }
          if (caisseCreditEspeceEntreUtilisateur) {
            caisseCreditEspeceEntreUtilisateur.solde_actuel =
              Number(caisseCreditEspeceEntreUtilisateur.solde_actuel) - montantNum;
            await caisseCreditEspeceEntreUtilisateur.save({ transaction: t });
          }
        }
      }
    }

    // Mise à jour du crédit (montantPaye, montantRestant, status)
    credit.montantPaye = Number(credit.montantPaye || 0) + montantNum;
    credit.montantRestant = Number(credit.montant || 0) - Number(credit.montantPaye);
    credit.status = credit.montantRestant === 0 ? "PAYER" : "EN COURS";
    await credit.save({ transaction: t });

    await t.commit();

    // Emission socket après commit
    const io = req.app.get("io");
    if (io) io.emit("caisseMisAJour");

    return res.status(201).json({
      message: "Paiement enregistré avec succès.",
      payement: { ...payement.toJSON(), reference: credit.reference },
    });
  } catch (error) {
    try {
      if (!t.finished) await t.rollback();
    } catch (e) {
      console.error("Rollback failed:", e);
    }
    console.error("Erreur lors de l'ajout du paiement :", error);
    return res.status(500).json({
      message: error.message || "Erreur interne du serveur.",
    });
  }
};

/**
 * Récupérer tous les paiements (avec rôle)
 */
const recupererPayementsCredit = async (req, res) => {
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  try {
    const utilisateurConnecte = await Utilisateur.findByPk(utilisateur.id, {
      include: [
        { model: Role, attributes: ["nom"] },
        { model: Boutique, as: "Boutique" },
      ],
    });
    if (!utilisateurConnecte) return res.status(404).json({ message: "Utilisateur non trouvé." });

    let idsUtilisateurs = [];

    const roleNom = String(utilisateurConnecte.Role?.nom || "").toUpperCase();
    if (roleNom === "ADMIN") {
      const boutiques = await Boutique.findAll({
        where: { utilisateurId: utilisateurConnecte.id },
        include: [{ model: Utilisateur, as: "Vendeurs", attributes: ["id"] }],
      });

      for (const boutique of boutiques) {
        idsUtilisateurs.push(boutique.utilisateurId);
        if (boutique.Vendeurs && boutique.Vendeurs.length) {
          boutique.Vendeurs.forEach((v) => idsUtilisateurs.push(v.id));
        }
      }
    } else if (roleNom === "VENDEUR") {
      const boutique = await Boutique.findByPk(utilisateurConnecte.boutiqueId, {
        include: [{ model: Utilisateur, as: "Vendeurs", attributes: ["id"] }],
      });

      if (boutique) {
        idsUtilisateurs.push(boutique.utilisateurId);
        if (boutique.Vendeurs && boutique.Vendeurs.length) {
          boutique.Vendeurs.forEach((v) => idsUtilisateurs.push(v.id));
        }
      }
    } else {
      return res.status(403).json({ message: "Rôle non autorisé." });
    }

    // Dé-duplication des ids
    idsUtilisateurs = Array.from(new Set(idsUtilisateurs));

    const payements = await PayementCredit.findAll({
      where: { utilisateurId: idsUtilisateurs },
      include: [
        { model: Utilisateur, attributes: ["id", "nom", "email"] },
        {
          model: Credit,
          attributes: ["id", "reference", "montant", "montantPaye", "montantRestant","nom"],
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
 * Consulter un paiement (accès restreint)
 */
const consulterPayementCredit = async (req, res) => {
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  try {
    const { id } = req.params;
    const payement = await PayementCredit.findByPk(id, {
      include: [{ model: Utilisateur, include: [Role] }, { model: Credit }],
    });

    if (!payement) return res.status(404).json({ message: "Paiement non trouvé." });

    // Contrôle d'accès
    const roleNom = String(utilisateur.Role?.nom || "").toUpperCase();
    if (roleNom === "VENDEUR" && payement.utilisateurId !== utilisateur.id) {
      return res.status(403).json({ message: "Accès refusé." });
    }

    if (roleNom === "ADMIN") {
      const boutique = await Boutique.findOne({ where: { utilisateurId: utilisateur.id } });
      const vendeurAutorisé = payement.Utilisateur?.boutiqueId === boutique?.id;
      if (!vendeurAutorisé && payement.utilisateurId !== utilisateur.id) {
        return res.status(403).json({ message: "Paiement hors de votre boutique." });
      }
    }

    res.status(200).json(payement);
  } catch (error) {
    console.error("Erreur lors de la consultation du paiement :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/**
 * Modifier un paiement
 */
const modifierPayementCredit = async (req, res) => {
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  try {
    const { id } = req.params;
    const { montant } = req.body;

    if (montant == null) return res.status(400).json({ message: "Montant requis." });

    const payement = await PayementCredit.findByPk(id, {
      include: [{ model: Utilisateur, include: [Role] }],
    });
    if (!payement) return res.status(404).json({ message: "Paiement non trouvé." });

    // Vérif permissions
    const roleNom = String(utilisateur.Role?.nom || "").toUpperCase();
    if (roleNom === "VENDEUR" && payement.utilisateurId !== utilisateur.id) {
      return res.status(403).json({ message: "Accès refusé." });
    }

    if (roleNom === "ADMIN") {
      const boutique = await Boutique.findOne({ where: { utilisateurId: utilisateur.id } });
      const vendeurAutorisé = payement.Utilisateur?.boutiqueId === boutique?.id;
      if (!vendeurAutorisé && payement.utilisateurId !== utilisateur.id) {
        return res.status(403).json({ message: "Paiement hors de votre boutique." });
      }
    }

    const credit = await Credit.findByPk(payement.creditId);
    if (!credit) return res.status(404).json({ message: "Crédit associé non trouvé." });

    // Recalcul des montants
    credit.montantPaye = Number(credit.montantPaye || 0) - Number(payement.montant || 0) + Number(montant);
    credit.montantRestant = Number(credit.montant || 0) - Number(credit.montantPaye || 0);
    credit.status = credit.montantRestant === 0 ? "PAYEE" : "EN COURS";

    payement.montant = Number(montant);

    await credit.save();
    await payement.save();

    res.status(200).json({ message: "Paiement mis à jour avec succès.", payement });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du paiement :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/**
 * Supprimer un paiement
 */
const supprimerPayementCredit = async (req, res) => {
  const utilisateur = await getUserFromToken(req, res);
  if (!utilisateur) return;

  try {
    const { id } = req.params;
    const payement = await PayementCredit.findByPk(id, {
      include: [{ model: Utilisateur, include: [Role] }],
    });
    if (!payement) return res.status(404).json({ message: "Paiement non trouvé." });

    const roleNom = String(utilisateur.Role?.nom || "").toUpperCase();
    if (roleNom === "VENDEUR" && payement.utilisateurId !== utilisateur.id) {
      return res.status(403).json({ message: "Suppression non autorisée." });
    }

    if (roleNom === "ADMIN") {
      const boutique = await Boutique.findOne({ where: { utilisateurId: utilisateur.id } });
      const vendeurAutorisé = payement.Utilisateur?.boutiqueId === boutique?.id;
      if (!vendeurAutorisé && payement.utilisateurId !== utilisateur.id) {
        return res.status(403).json({ message: "Paiement hors de votre boutique." });
      }
    }

    const credit = await Credit.findByPk(payement.creditId);
    if (credit) {
      credit.montantPaye = Number(credit.montantPaye || 0) - Number(payement.montant || 0);
      credit.montantRestant = Number(credit.montant || 0) - Number(credit.montantPaye || 0);
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
