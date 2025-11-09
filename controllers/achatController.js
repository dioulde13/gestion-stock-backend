// controllers/achatController.js
const Achat = require("../models/achat");
const LigneAchat = require("../models/ligneAchat");
const Produit = require("../models/produit");
const Utilisateur = require("../models/utilisateur");
const Boutique = require("../models/boutique");
const { getCaisseByType } = require("../utils/caisseUtils");
const sequelize = require("../models/sequelize");
const jwt = require("jsonwebtoken");
const Role = require("../models/role");
const Fournisseur = require("../models/fournisseur");

const getUserFromToken = async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    res.status(403).json({ message: "Accès refusé. Aucun token trouvé." });
    return null;
  }

  const token = authHeader.split(" ")[1];
  try {
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
    console.error("Erreur de vérification du token :", error);
    res.status(401).json({ message: "Token invalide ou expiré." });
    return null;
  }
};

const annulerAchat = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    const { id } = req.params;

    // 🔹 Récupérer l'achat avec ses lignes
    const achat = await Achat.findByPk(id, {
      include: [{ model: LigneAchat }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!achat) throw new Error("Achat non trouvé.");
    if (achat.status === "ANNULER")
      throw new Error("Cet achat est déjà annulé.");


    const total = achat.total;

    // === 🔁 1️⃣ Restaurer le stock des produits (retirer ce qui a été ajouté)
    for (const ligne of achat.LigneAchats) {
      const produit = await Produit.findByPk(ligne.produitId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (produit) {
        if (produit.stock_actuel < ligne.quantite) {
          throw new Error(
            `Impossible d'annuler : le stock du produit ${produit.nom} est inférieur à la quantité de l'achat.`
          );
        }

        await produit.update(
          { stock_actuel: produit.stock_actuel - ligne.quantite },
          { transaction: t }
        );
      }
    }

    // === 💰 2️⃣ Restaurer la caisse utilisateur
    const caisseUser = await getCaisseByType("CAISSE", utilisateur.id, t);
    if (caisseUser) {
      caisseUser.solde_actuel += total;
      await caisseUser.save({ transaction: t });
    }

    // === 💰 3️⃣ Restaurer les caisses des vendeurs et admin
    const boutique = await Boutique.findByPk(utilisateur.boutiqueId, {
      transaction: t,
    });

    if (boutique) {
      const vendeursBoutique = await Utilisateur.findAll({
        where: { boutiqueId: boutique.id },
        transaction: t,
      });

      // --- Réduire VALEUR_STOCK_PUR pour tous les vendeurs
      for (const vendeur of vendeursBoutique) {
        const caisseVSP = await getCaisseByType(
          "VALEUR_STOCK_PUR",
          vendeur.id,
          t
        );
        if (caisseVSP) {
          caisseVSP.solde_actuel -= total;
          await caisseVSP.save({ transaction: t });
        }
      }

      // --- Corriger les caisses de l'admin
      if (boutique.utilisateurId) {
        const admin = await Utilisateur.findByPk(boutique.utilisateurId, {
          transaction: t,
        });

        if (admin) {
          const caisseVSPAdmin = await getCaisseByType(
            "VALEUR_STOCK_PUR",
            admin.id,
            t
          );
          const caisseCaisseAdmin = await getCaisseByType(
            "CAISSE",
            admin.id,
            t
          );

          if (caisseVSPAdmin && caisseCaisseAdmin) {
            caisseVSPAdmin.solde_actuel -= total;
            caisseCaisseAdmin.solde_actuel += total;

            await caisseVSPAdmin.save({ transaction: t });
            await caisseCaisseAdmin.save({ transaction: t });
          }
        }
      }
    }

    // === 🚫 4️⃣ Changer le statut de l'achat
    achat.nomPersonneAnnuler = `${utilisateur.nom ?? ""}`.trim();
    achat.status = "ANNULER";
    await achat.save({ transaction: t });

    await t.commit();

    // === 🔔 5️⃣ Notification ou socket
    const io = req.app.get("io");
    if (io) io.emit("caisseMisAJour");

    return res.status(200).json({
      success: true,
      message: "Achat annulé et effets restaurés avec succès.",
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Erreur lors de l'annulation de l'achat :", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Erreur interne du serveur.",
    });
  }
};

/**
 * ✅ Créer un achat (avec lignes + mise à jour stock et caisses)
 */
const creerAchat = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    const { fournisseurId, lignes, type = "ACHAT" } = req.body;

    if (!["ACHAT", "CREDIT"].includes(type)) {
      throw new Error('Type de vente invalide. Doit être "ACHAT" ou "CREDIT".');
    }

    if (!fournisseurId || !lignes || lignes.length === 0) {
      return res
        .status(400)
        .json({ message: "Fournisseur et lignes d'achat obligatoires." });
    }

    if (!utilisateur.boutiqueId) {
      return res
        .status(400)
        .json({ message: "Utilisateur non associé à une boutique." });
    }

    // Calcul du total de l'achat
    let total = 0;
    for (const ligne of lignes) {
      if (!ligne.produitId || !ligne.quantite || !ligne.prix_achat) {
        return res.status(400).json({
          message: "Chaque ligne doit avoir produitId, quantite et prix_achat.",
        });
      }
      total += ligne.quantite * ligne.prix_achat;
    }

    // Vérification solde de la caisse
    const caisseUser = await getCaisseByType("CAISSE", utilisateur.id, t);
    if (!caisseUser) {
      return res
        .status(400)
        .json({ message: "Caisse utilisateur introuvable." });
    }
    if (caisseUser.solde_actuel < total) {
      return res
        .status(400)
        .json({ message: "Solde insuffisant pour effectuer cet achat." });
    }

    // Déduction immédiate du solde de l'utilisateur pour bloquer le montant
    caisseUser.solde_actuel -= total;
    await caisseUser.save({ transaction: t });

    // Création de l'achat
    const achat = await Achat.create(
      {
        fournisseurId,
        utilisateurId: utilisateur.id,
        total,
        boutiqueId: utilisateur.boutiqueId,
        type,
        status: "VALIDER",
      },
      { transaction: t }
    );

    // Création des lignes et mise à jour du stock
    for (const ligne of lignes) {
      const produit = await Produit.findByPk(ligne.produitId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!produit) {
        await t.rollback();
        return res
          .status(404)
          .json({ message: `Produit ID ${ligne.produitId} non trouvé.` });
      }

      if (produit.boutiqueId !== utilisateur.boutiqueId) {
        await t.rollback();
        return res.status(403).json({
          message:
            "Vous ne pouvez pas modifier un produit d'une autre boutique.",
        });
      }

      await LigneAchat.create(
        {
          achatId: achat.id,
          produitId: ligne.produitId,
          quantite: ligne.quantite,
          prix_achat: ligne.prix_achat,
          prix_vente: ligne.prix_vente,
        },
        { transaction: t }
      );

      await produit.update(
        {
          prix_vente: ligne.prix_vente || produit.prix_vente,
          prix_achat: ligne.prix_achat,
          stock_actuel: produit.stock_actuel + ligne.quantite,
        },
        { transaction: t }
      );
    }

    // Mise à jour des caisses de l'admin de la boutique
    const boutique = await Boutique.findByPk(utilisateur.boutiqueId, {
      transaction: t,
    });
    if (
      boutique &&
      boutique.utilisateurId &&
      boutique.utilisateurId !== utilisateur.id
    ) {
      const admin = await Utilisateur.findByPk(boutique.utilisateurId, {
        transaction: t,
      });

      const vendeursBoutique = await Utilisateur.findAll({
        where: { boutiqueId: boutique.id },
        transaction: t,
      });

      for (const vendeur of vendeursBoutique) {
        const caisseVSP = await getCaisseByType(
          "VALEUR_STOCK_PUR",
          vendeur.id,
          t
        );
        if (caisseVSP) {
          caisseVSP.solde_actuel += total;
          await caisseVSP.save({ transaction: t });
        }
      }

      if (admin) {
        const caisseVSPAdmin = await getCaisseByType(
          "VALEUR_STOCK_PUR",
          admin.id,
          t
        );
        const caisseCaisseAdmin = await getCaisseByType("CAISSE", admin.id, t);

        if (caisseVSPAdmin && caisseCaisseAdmin) {
          caisseVSPAdmin.solde_actuel += total;
          caisseCaisseAdmin.solde_actuel -= total;

          await caisseVSPAdmin.save({ transaction: t });
          await caisseCaisseAdmin.save({ transaction: t });
        }
      }
    }

    await t.commit();

    // ✅ 5️⃣ Émission Socket pour mettre à jour la caisse côté client
    const io = req.app.get("io"); // 📢 récupérer l'instance Socket.io
    io.emit("caisseMisAJour"); // 📢 avertir tous les clients connectés
    res
      .status(201)
      .json({ message: "Achat créé avec succès.", achatId: achat.id });
  } catch (error) {
    await t.rollback();
    console.error("Erreur lors de la création de l'achat :", error);
    res
      .status(500)
      .json({ message: error.message || "Erreur interne du serveur." });
  }
};

const recupererAchats = async (req, res) => {
  try {
    // 🔐 Récupération du token
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res
        .status(403)
        .json({ success: false, message: "Accès refusé. Aucun token trouvé." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Récupération de l'utilisateur avec ses relations
    const utilisateur = await Utilisateur.findByPk(decoded.id, {
      include: [
        { model: Role },
        { model: Boutique, as: "BoutiquesCreees" }, // admin peut avoir plusieurs boutiques
      ],
    });

    if (!utilisateur) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    // ✅ Préparer le filtre
    let whereClause = {};

    if (utilisateur.Role && utilisateur.Role.nom.toUpperCase() === "ADMIN") {
      // Admin : toutes les ventes des vendeurs de ses boutiques
      const boutiqueIds = (utilisateur.BoutiquesCreees || []).map((b) => b.id);
      whereClause["$Utilisateur.boutiqueId$"] = boutiqueIds;
    } else {
      // Vendeur : uniquement ses ventes
      whereClause.utilisateurId = utilisateur.id;
    }

    // ✅ Récupération des ventes
    const achats = await Achat.findAll({
      where: whereClause,
      include: [
        {
          model: LigneAchat,
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
          model: Fournisseur,
          attributes: ["id", "nom"], // ← on ajoute 'nom' ici pour récupérer le nom du vendeur
        },
        {
          model: Utilisateur,
          attributes: ["id", "nom"], // ← on ajoute 'nom' ici pour récupérer le nom du vendeur
          include: [{ model: Boutique, as: "Boutique" }],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json(achats);
  } catch (error) {
    console.error("Erreur lors de la récupération des achats :", error);
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Token invalide." });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expiré." });
    }
    return res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

/**
 * ✅ Supprimer un achat (avec restauration du stock et mise à jour des caisses)
 */
const supprimerAchat = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    const { id } = req.params;
    const achat = await Achat.findByPk(id, { transaction: t });
    if (!achat) return res.status(404).json({ message: "Achat non trouvé." });

    if (achat.boutiqueId !== utilisateur.boutiqueId) {
      await t.rollback();
      return res
        .status(403)
        .json({ message: "Suppression interdite : autre boutique." });
    }

    const lignes = await LigneAchat.findAll({
      where: { achatId: id },
      transaction: t,
    });
    let total = 0;

    for (const ligne of lignes) {
      const produit = await Produit.findByPk(ligne.produitId, {
        transaction: t,
      });
      if (produit) {
        await produit.update(
          {
            stock_actuel: produit.stock_actuel - ligne.quantite,
          },
          { transaction: t }
        );

        total += ligne.quantite * ligne.prix_achat;
      }
    }

    await LigneAchat.destroy({ where: { achatId: id }, transaction: t });
    await achat.destroy({ transaction: t });

    // 🔁 Mise à jour des caisses (inversion du calcul)
    const boutique = await Boutique.findByPk(utilisateur.boutiqueId, {
      transaction: t,
    });
    if (boutique) {
      const vendeursBoutique = await Utilisateur.findAll({
        where: { boutiqueId: boutique.id },
        transaction: t,
      });

      for (const vendeur of vendeursBoutique) {
        const caisseVSP = await getCaisseByType(
          "VALEUR_STOCK_PUR",
          vendeur.id,
          t
        );
        if (caisseVSP) {
          caisseVSP.solde_actuel -= total;
          await caisseVSP.save({ transaction: t });
        }
      }

      if (boutique.utilisateurId) {
        const adminBoutique = await Utilisateur.findByPk(
          boutique.utilisateurId,
          { transaction: t }
        );
        if (
          adminBoutique &&
          !vendeursBoutique.some((v) => v.id === adminBoutique.id)
        ) {
          const caisseAdminVSP = await getCaisseByType(
            "VALEUR_STOCK_PUR",
            adminBoutique.id,
            t
          );
          if (caisseAdminVSP) {
            caisseAdminVSP.solde_actuel -= total;
            await caisseAdminVSP.save({ transaction: t });
          }
        }
      }
    }

    await t.commit();
    res
      .status(200)
      .json({ message: "Achat supprimé avec succès et stock mis à jour." });
  } catch (error) {
    await t.rollback();
    console.error("Erreur lors de la suppression de l'achat :", error);
    res
      .status(500)
      .json({ message: error.message || "Erreur interne du serveur." });
  }
};

module.exports = {
  creerAchat,
  recupererAchats,
  supprimerAchat,
  annulerAchat,
};
