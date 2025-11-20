const Credit = require("../models/credit");
const Sequelize = require("sequelize");
const Produit = require("../models/produit");
const { Vente, LigneVente } = require("../models/relation");
const Utilisateur = require("../models/utilisateur");
const Client = require("../models/client");
const sequelize = require("../models/sequelize");
// const Notification = require("../models/notification");
const jwt = require("jsonwebtoken");
const Role = require("../models/role");
const { getCaisseByType } = require("../utils/caisseUtils");
const Boutique = require("../models/boutique");

/* ==========================
   🔐 Utilitaire pour récupérer utilisateur depuis JWT
========================== */
const getUserFromToken = async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    res.status(403).json({ message: "Accès refusé. Aucun token trouvé." });
    return null;
  }
  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const utilisateur = await Utilisateur.findByPk(decoded.id, {
      include: Role,
    });
    if (!utilisateur) {
      res.status(404).json({ message: "Utilisateur non trouvé." });
      return null;
    }
    return utilisateur;
  } catch (error) {
    console.error("Erreur token:", error);
    res.status(401).json({ message: "Token invalide ou expiré." });
    return null;
  }
};

/* ==========================
   ✅ Créer une vente (ACHAT ou CREDIT)
========================== */
const creerVente = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    const {
      lignes,
      type = "ACHAT",
      clientId,
      clientNom,
      clientTelephone,
    } = req.body;
    if (!["ACHAT", "CREDIT"].includes(type))
      throw new Error('Type de vente invalide. Doit être "ACHAT" ou "CREDIT".');

    if (!utilisateur.boutiqueId)
      throw new Error("Utilisateur non associé à une boutique.");

    // Gestion client pour vente à crédit
    let clientAssocie = null;
    if (type === "CREDIT") {
      if (clientId) {
        clientAssocie = await Client.findByPk(clientId, { transaction: t });
        if (!clientAssocie) throw new Error("Client introuvable.");
      } else {
        if (!clientNom || !clientTelephone)
          throw new Error("Nom et téléphone requis pour un crédit.");
        clientAssocie = await Client.create(
          {
            nom: clientNom,
            telephone: clientTelephone,
            utilisateurId: utilisateur.id,
            boutiqueId: utilisateur.boutiqueId,
          },
          { transaction: t }
        );
      }
    }

    // Calcul totalVente et totalAchat
    let totalVente = 0;
    let totalAchat = 0;
    for (const ligne of lignes) {
      if (!ligne.produitId || !ligne.quantite || !ligne.prix_vente)
        throw new Error(
          "Chaque ligne doit contenir produitId, quantite et prix_vente."
        );

      const produit = await Produit.findByPk(ligne.produitId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!produit)
        throw new Error(`Produit ID ${ligne.produitId} introuvable.`);
      if (produit.boutiqueId !== utilisateur.boutiqueId)
        throw new Error(
          "Impossible de vendre un produit d'une autre boutique."
        );
      if (produit.stock_actuel < ligne.quantite)
        throw new Error(`Stock insuffisant pour ${produit.nom}.`);

      totalVente += ligne.quantite * ligne.prix_vente;
      totalAchat += ligne.quantite * produit.prix_achat;
    }

    const benefice = totalVente - totalAchat;

    // Création de la vente
    const vente = await Vente.create(
      {
        utilisateurId: utilisateur.id,
        boutiqueId: utilisateur.boutiqueId,
        clientId: clientAssocie ? clientAssocie.id : null,
        total: totalVente,
        type,
        status: "VALIDER",
      },
      { transaction: t }
    );

    // Création des lignes de vente et mise à jour stock
    for (const ligne of lignes) {
      const produit = await Produit.findByPk(ligne.produitId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      await LigneVente.create(
        {
          venteId: vente.id,
          produitId: ligne.produitId,
          quantite: ligne.quantite,
          prix_vente: ligne.prix_vente,
          prix_achat: produit.prix_achat,
        },
        { transaction: t }
      );
      produit.stock_actuel -= ligne.quantite;
      await produit.save({ transaction: t });
    }

    // 💰 Mise à jour des caisses
    const boutique = await Boutique.findByPk(utilisateur.boutiqueId, {
      transaction: t,
    });
    if (boutique) {
      const vendeurs = await Utilisateur.findAll({
        where: { boutiqueId: boutique.id },
        transaction: t,
      });
      for (const vendeur of vendeurs) {
        const caisseVSP = await getCaisseByType(
          "VALEUR_STOCK_PUR",
          vendeur.id,
          t
        );
        if (caisseVSP) {
          caisseVSP.solde_actuel -= totalAchat;
          await caisseVSP.save({ transaction: t });
        }
      }
      if (boutique.utilisateurId) {
        const admin = await Utilisateur.findByPk(boutique.utilisateurId, {
          transaction: t,
        });
        if (admin && !vendeurs.some((v) => v.id === admin.id)) {
          const caisseAdminVSP = await getCaisseByType(
            "VALEUR_STOCK_PUR",
            admin.id,
            t
          );
          if (type === "ACHAT") {
            const caisseAdminPrincipal = await getCaisseByType(
              "CAISSE",
              admin.id,
              t
            );
            if (caisseAdminVSP && caisseAdminPrincipal) {
              caisseAdminVSP.solde_actuel -= totalAchat;
              caisseAdminPrincipal.solde_actuel += totalVente;
              await caisseAdminVSP.save({ transaction: t });
              await caisseAdminPrincipal.save({ transaction: t });
            }
          } else if (type === "CREDIT") {
            const caisseCredit = await getCaisseByType(
              "CREDIT_VENTE",
              admin.id,
              t
            );
            if (caisseAdminVSP && caisseCredit) {
              caisseAdminVSP.solde_actuel -= totalAchat;
              caisseCredit.solde_actuel += totalVente;
              await caisseAdminVSP.save({ transaction: t });
              await caisseCredit.save({ transaction: t });
            }
          }
        }
      }
    }

    // Mise à jour des caisses utilisateur
    if (type === "ACHAT") {
      const caissePrincipale = await getCaisseByType(
        "PRINCIPALE",
        utilisateur.id,
        t
      );
      // const caisseGlobale = await getCaisseByType("CAISSE", utilisateur.id, t);
      const beneficeRealise = await getCaisseByType(
        "BENEFICE",
        utilisateur.id,
        t
      );

      caissePrincipale.solde_actuel += totalVente;
      // caisseGlobale.solde_actuel += totalVente;
      beneficeRealise.solde_actuel += benefice;

      if (boutique) {
        const vendeurs = await Utilisateur.findAll({
          where: { boutiqueId: boutique.id },
          transaction: t,
        });
        for (const vendeur of vendeurs) {
          const caisseGlobale = await getCaisseByType("CAISSE", vendeur.id, t);
          if (caisseGlobale) {
            caisseGlobale.solde_actuel += totalVente;
            await caisseGlobale.save({ transaction: t });
          }
        }
      }

      await caissePrincipale.save({ transaction: t });
      // await caisseGlobale.save({ transaction: t });
      await beneficeRealise.save({ transaction: t });
    } else if (type === "CREDIT") {
      const vendeurs = await Utilisateur.findAll({
        where: { boutiqueId: boutique.id },
        transaction: t,
      });
      for (const vendeur of vendeurs) {
        const caisseCredit = await getCaisseByType(
          "CREDIT_VENTE",
          vendeur.id,
          t
        );
        caisseCredit.solde_actuel += totalVente;
        await caisseCredit.save({ transaction: t });
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

      await Credit.create(
        {
          utilisateurId: utilisateur.id,
          reference,
          description: "Vente à crédit",
          nom: clientAssocie.nom,
          clientId: clientAssocie.id,
          montant: totalVente,
          montantPaye: 0,
          montantRestant: 0,
          beneficeCredit: benefice,
          type: "SORTIE",
          typeCredit: "VENTE",
          status: "NON PAYER",
          boutiqueId: utilisateur.boutiqueId,
        },
        { transaction: t }
      );
    }

    await t.commit();

    // Notifications
    const io = req.app.get("io");
    if (io) io.emit("caisseMisAJour", { utilisateurId: utilisateur.id });

    return res.status(201).json({
      success: true,
      message: "Vente créée avec succès.",
      benefice,
      client: clientAssocie || null,
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Erreur lors de la vente:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Erreur interne du serveur.",
    });
  }
};

/* ==========================
   ✅ Récupérer toutes les ventes
========================== */
const recupererVentes = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

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

    const ventes = await Vente.findAll({
      where: { utilisateurId: idsUtilisateurs },
      include: [
        {
          model: LigneVente,
          include: [
            {
              model: Produit,
              attributes: [
                "id",
                "nom",
                "prix_achat",
                "prix_vente",
                "boutiqueId",
              ],
            },
          ],
        },
        {
          model: Utilisateur,
          attributes: ["id", "nom"],
          include: [{ model: Boutique, as: "Boutique" }],
        },
      ],
      order: [["date", "DESC"]],
    });

    return res.status(200).json(ventes);
  } catch (error) {
    console.error("Erreur récupération ventes:", error);
    return res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/* ==========================
   ✅ Consulter une vente
========================== */
const consulterVente = async (req, res) => {
  try {
    const { id } = req.params;
    const vente = await Vente.findByPk(id, {
      include: [
        {
          model: LigneVente,
          include: [{ model: Produit, attributes: ["id", "nom"] }],
        },
      ],
    });
    if (!vente) return res.status(404).json({ message: "Vente non trouvée." });
    return res.status(200).json(vente);
  } catch (error) {
    console.error("Erreur consultation vente:", error);
    return res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/* ==========================
   ✅ Supprimer une vente
========================== */
const supprimerVente = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const vente = await Vente.findByPk(id, { transaction: t });
    if (!vente) {
      await t.rollback();
      return res.status(404).json({ message: "Vente non trouvée." });
    }

    const lignes = await LigneVente.findAll({
      where: { venteId: id },
      transaction: t,
    });
    for (const ligne of lignes) {
      const produit = await Produit.findByPk(ligne.produitId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (produit) {
        produit.stock_actuel += ligne.quantite;
        await produit.save({ transaction: t });
      }
    }

    await LigneVente.destroy({ where: { venteId: id }, transaction: t });
    await vente.destroy({ transaction: t });

    await t.commit();
    return res.status(200).json({ message: "Vente supprimée avec succès." });
  } catch (error) {
    await t.rollback();
    console.error("Erreur suppression vente:", error);
    return res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/* ==========================
   ✅ Produits les plus vendus
========================== */
const produitsPlusVendus = async (req, res) => {
  try {
    const result = await LigneVente.findAll({
      attributes: [
        "produitId",
        [Sequelize.fn("SUM", Sequelize.col("quantite")), "totalVendu"],
      ],
      group: ["produitId"],
      order: [[Sequelize.literal("totalVendu"), "DESC"]],
      include: [
        {
          model: Produit,
          attributes: ["id", "nom", "prix_vente", "stock_actuel"],
        },
      ],
      limit: 10,
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error("Erreur produits plus vendus:", error);
    return res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/* ==========================
   ✅ Annuler une vente
========================== */
const annulerVente = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    const { id } = req.params;
    const vente = await Vente.findByPk(id, {
      include: [LigneVente, Client],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!vente) throw new Error("Vente introuvable.");
    if (vente.status === "ANNULER") throw new Error("Vente déjà annulée.");

    const { type, total, clientId } = vente;
    let totalAchat = 0;
    let benefice = 0;

    for (const ligne of vente.LigneVentes) {
      const produit = await Produit.findByPk(ligne.produitId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (produit) {
        produit.stock_actuel += ligne.quantite;
        await produit.save({ transaction: t });
        totalAchat += ligne.quantite * ligne.prix_achat;
      }
      benefice += (ligne.prix_vente - ligne.prix_achat) * ligne.quantite;
    }

    const boutique = await Boutique.findByPk(utilisateur.boutiqueId, {
      transaction: t,
    });

    const admin = await Utilisateur.findByPk(boutique.utilisateurId, {
      transaction: t,
    });
    // Mise à jour des caisses utilisateur
    if (type === "ACHAT") {
      // 🔹 Récupérer les vendeurs de la boutique
      const vendeurs = await Utilisateur.findAll({
        where: { boutiqueId: boutique.id },
        transaction: t,
      });

      // ============================================================
      // 🔹 1) Si c'est un ADMIN et qu'il n'est PAS dans les vendeurs
      // ============================================================
      if (admin && !vendeurs.some((v) => v.id === admin.id)) {
        const valeurStockPurAdmin = await getCaisseByType(
          "VALEUR_STOCK_PUR",
          admin.id,
          t
        );

        const caisseAdminPrincipal = await getCaisseByType(
          "CAISSE",
          admin.id,
          t
        );

        if (valeurStockPurAdmin && caisseAdminPrincipal) {
          // Vérification solde admin
          if (caisseAdminPrincipal.solde_actuel < totalAchat) {
            throw new Error("Solde insuffisant dans la caisse ADMIN.");
          }

          caisseAdminPrincipal.solde_actuel -= total;
          valeurStockPurAdmin.solde_actuel += totalAchat;

          await caisseAdminPrincipal.save({ transaction: t });
          await valeurStockPurAdmin.save({ transaction: t });
        }
      }

      // ============================================================
      // 🔹 2) Mise à jour des vendeurs de la boutique
      // ============================================================
      for (const vendeur of vendeurs) {
        const caisseUtilisateur = await getCaisseByType(
          "CAISSE",
          vendeur.id,
          t
        );

        const valeurStockPur = await getCaisseByType(
          "VALEUR_STOCK_PUR",
          vendeur.id,
          t
        );

        // Vérification solde vendeur
        if (caisseUtilisateur.solde_actuel < totalAchat) {
          throw new Error(
            `Solde insuffisant pour le vendeur ${vendeur.nom || vendeur.id}.`
          );
        }

        caisseUtilisateur.solde_actuel -= total;
        valeurStockPur.solde_actuel += totalAchat;

        await caisseUtilisateur.save({ transaction: t });
        await valeurStockPur.save({ transaction: t });
      }
    } else if (type === "CREDIT") {
      // 🔹 Récupérer les vendeurs de la boutique
      const vendeurs = await Utilisateur.findAll({
        where: { boutiqueId: boutique.id },
        transaction: t,
      });

      // ============================================================
      // 🔹 1) Mise à jour ADMIN si non-vendeur
      // ============================================================
      if (admin && !vendeurs.some((v) => v.id === admin.id)) {
        const valeurStockPurAdmin = await getCaisseByType(
          "VALEUR_STOCK_PUR",
          admin.id,
          t
        );

        const caisseAdminCredit = await getCaisseByType(
          "CREDIT_VENTE",
          admin.id,
          t
        );

        if (valeurStockPurAdmin && caisseAdminCredit) {
          caisseAdminCredit.solde_actuel -= total;
          valeurStockPurAdmin.solde_actuel += totalAchat;

          await caisseAdminCredit.save({ transaction: t });
          await valeurStockPurAdmin.save({ transaction: t });
        }
      }

      // ============================================================
      // 🔹 2) Mise à jour des vendeurs de la boutique
      // ============================================================
      for (const vendeur of vendeurs) {
        const caisseVendeurCredit = await getCaisseByType(
          "CREDIT_VENTE",
          vendeur.id,
          t
        );

        const valeurStockPur = await getCaisseByType(
          "VALEUR_STOCK_PUR",
          vendeur.id,
          t
        );

        caisseVendeurCredit.solde_actuel -= total;
        valeurStockPur.solde_actuel += totalAchat;

        await caisseVendeurCredit.save({ transaction: t });
        await valeurStockPur.save({ transaction: t });
      }

      // ============================================================
      // 🔹 3) Annuler le crédit précédent correspondant
      // ============================================================
      const credit = await Credit.findOne({
        where: {
          clientId,
          typeCredit: "VENTE",
          montant: total,
          status: "NON PAYER",
        },
        transaction: t,
      });

      if (credit) {
        credit.status = "ANNULER";
        await credit.save({ transaction: t });
      }
    }

    vente.status = "ANNULER";
    vente.nomPersonneAnnuler = utilisateur.nom;
    await vente.save({ transaction: t });

    await t.commit();
    const io = req.app.get("io");
    if (io) io.emit("caisseMisAJour");

    return res
      .status(200)
      .json({ success: true, message: "Vente annulée avec succès." });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Erreur annulation vente:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Erreur interne du serveur.",
    });
  }
};

module.exports = {
  creerVente,
  recupererVentes,
  consulterVente,
  supprimerVente,
  produitsPlusVendus,
  annulerVente,
};
