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
const { Op } = require("sequelize");
const Credit = require("../models/credit");

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

/**
 * Annuler un achat
 */
const annulerAchat = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    const { id } = req.params;

    // ================================
    // 🔹 Récupération de l'achat
    // ================================
    const achat = await Achat.findByPk(id, {
      include: LigneAchat,
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!achat) return res.status(404).json({ message: "Achat non trouvé." });
    if (achat.status === "ANNULER")
      return res.status(400).json({ message: "Achat déjà annulé." });

    const total = achat.total;
    const type = achat.type; // 🔥 Correction : on récupère réellement le type (ACHAT ou CREDIT)

    // ================================
    // 🔹 Restauration du stock
    // ================================
    for (const ligne of achat.LigneAchats) {
      const produit = await Produit.findByPk(ligne.produitId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!produit) continue;

      if (produit.stock_actuel < ligne.quantite)
        throw new Error(`Stock insuffisant pour le produit ${produit.nom}.`);

      produit.stock_actuel -= ligne.quantite;
      await produit.save({ transaction: t });
    }

    // ================================
    // 🔹 Gestion des caisses
    // ================================
    const boutique = await Boutique.findByPk(utilisateur.boutiqueId, {
      transaction: t,
    });
    const admin = await Utilisateur.findByPk(boutique.utilisateurId, {
      transaction: t,
    });

    const vendeurs = await Utilisateur.findAll({
      where: { boutiqueId: boutique.id },
      transaction: t,
    });

    // =====================================================
    // 🔹 Si l’achat est un ACHAT simple (pas crédit)
    // =====================================================
    if (type === "ACHAT") {
      // ⚠️ l’achat avait diminué les caisses vendeurs → on remet
      await Promise.all(
        vendeurs.map(async (vendeur) => {
          const caisse = await getCaisseByType("CAISSE", vendeur.id, t);
          const valeurStock = await getCaisseByType(
            "VALEUR_STOCK_PUR",
            vendeur.id,
            t
          );

          if (caisse) {
            caisse.solde_actuel += total; // restitution du montant
            await caisse.save({ transaction: t });
          }

          if (valeurStock) {
            valeurStock.solde_actuel -= total; // diminution valeur stock
            await valeurStock.save({ transaction: t });
          }
        })
      );

      // 🔹 Gestion admin (si il n’est pas vendeur)
      if (admin && !vendeurs.some((v) => v.id === admin.id)) {
        const caisseAdmin = await getCaisseByType("CAISSE", admin.id, t);
        const valeurStockAdmin = await getCaisseByType(
          "VALEUR_STOCK_PUR",
          admin.id,
          t
        );

        if (caisseAdmin) {
          caisseAdmin.solde_actuel += total;
          await caisseAdmin.save({ transaction: t });
        }

        if (valeurStockAdmin) {
          valeurStockAdmin.solde_actuel -= total;
          await valeurStockAdmin.save({ transaction: t });
        }
      }
    }

    // =====================================================
    // 🔹 Si l’achat était un ACHAT à CRÉDIT
    // =====================================================
    else if (type === "CREDIT") {
      // 🔹 Les vendeurs avaient reçu du CREDIT_ACHAT → on retire
      await Promise.all(
        vendeurs.map(async (vendeur) => {
          const caisseCredit = await getCaisseByType(
            "CREDIT_ACHAT",
            vendeur.id,
            t
          );
          const valeurStock = await getCaisseByType(
            "VALEUR_STOCK_PUR",
            vendeur.id,
            t
          );

          if (caisseCredit) {
            caisseCredit.solde_actuel -= total;
            await caisseCredit.save({ transaction: t });
          }

          if (valeurStock) {
            valeurStock.solde_actuel -= total;
            await valeurStock.save({ transaction: t });
          }
        })
      );

      // 🔹 Admin si non vendeur
      if (admin && !vendeurs.some((v) => v.id === admin.id)) {
        const caisseCreditAdmin = await getCaisseByType(
          "CREDIT_ACHAT",
          admin.id,
          t
        );
        const valeurStockAdmin = await getCaisseByType(
          "VALEUR_STOCK_PUR",
          admin.id,
          t
        );

        if (caisseCreditAdmin) {
          caisseCreditAdmin.solde_actuel -= total;
          await caisseCreditAdmin.save({ transaction: t });
        }

        if (valeurStockAdmin) {
          valeurStockAdmin.solde_actuel -= total;
          await valeurStockAdmin.save({ transaction: t });
        }
      }

      // 🔹 Annuler le crédit correspondant
      const credit = await Credit.findOne({
        where: {
          typeCredit: "ACHAT",
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

    // ================================
    // 🔹 Finalisation
    // ================================
    achat.status = "ANNULER";
    achat.nomPersonneAnnuler = utilisateur.nom;
    await achat.save({ transaction: t });

    await t.commit();

    const io = req.app.get("io");
    if (io) io.emit("caisseMisAJour");

    return res.status(200).json({
      success: true,
      message: "Achat annulé avec succès.",
    });
  } catch (error) {
    await t.rollback();
    console.error("Erreur annulation achat :", error);
    return res
      .status(500)
      .json({ message: error.message || "Erreur serveur." });
  }
};

/**
 * Créer un achat (avec lignes + mise à jour stock et caisses)
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
        .json({ message: "Fournisseur et lignes obligatoires." });
    }

    if (!utilisateur.boutiqueId) {
      return res
        .status(400)
        .json({ message: "Utilisateur non associé à une boutique." });
    }

    // Calcul du total et bénéfice
    let totalAchat = 0;
    let benefice = 0;
    for (const ligne of lignes) {
      if (!ligne.produitId || !ligne.quantite || !ligne.prix_achat) {
        return res.status(400).json({
          message: "Chaque ligne doit avoir produitId, quantite et prix_achat.",
        });
      }
      totalAchat += ligne.quantite * ligne.prix_achat;
      if (ligne.prix_vente) {
        benefice += ligne.quantite * (ligne.prix_vente - ligne.prix_achat);
      }
    }

    // Vérification du solde pour ACHAT
    if (type === "ACHAT") {
      const caisseUser = await getCaisseByType("CAISSE", utilisateur.id, t);
      if (!caisseUser) {
        return res
          .status(400)
          .json({ message: "Caisse utilisateur introuvable." });
      }
      if (caisseUser.solde_actuel < totalAchat) {
        return res.status(400).json({ message: "Solde insuffisant." });
      }
    }

    // Création de l'achat
    const achat = await Achat.create(
      {
        fournisseurId,
        utilisateurId: utilisateur.id,
        total: totalAchat,
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
      if (!produit)
        throw new Error(`Produit ID ${ligne.produitId} non trouvé.`);
      if (produit.boutiqueId !== utilisateur.boutiqueId) {
        throw new Error(
          "Impossible de modifier un produit d'une autre boutique."
        );
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
          prix_achat: ligne.prix_achat,
          prix_vente: ligne.prix_vente || produit.prix_vente,
          stock_actuel: produit.stock_actuel + ligne.quantite,
        },
        { transaction: t }
      );
    }

    // Mise à jour des caisses et valeur du stock
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

        if (type === "ACHAT") {
          const caisseUser = await getCaisseByType("CAISSE", vendeur.id, t);
          if (caisseUser) {
            caisseUser.solde_actuel -= totalAchat;
            await caisseUser.save({ transaction: t });
          }
        }

        if (caisseVSP) {
          caisseVSP.solde_actuel += totalAchat;
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
            // const caisseAdminPrincipal = await getCaisseByType(
            //   "CAISSE",
            //   admin.id,
            //   t
            // );
            if (caisseAdminVSP) {
              caisseAdminVSP.solde_actuel += totalAchat;
              // caisseAdminPrincipal.solde_actuel += totalVente;
              await caisseAdminVSP.save({ transaction: t });
              // await caisseAdminPrincipal.save({ transaction: t });
            }
          } else if (type === "CREDIT") {
            const caisseCredit = await getCaisseByType(
              "CREDIT_ACHAT",
              admin.id,
              t
            );
            if (caisseAdminVSP && caisseCredit) {
              caisseAdminVSP.solde_actuel += totalAchat;
              caisseCredit.solde_actuel += totalAchat;
              await caisseAdminVSP.save({ transaction: t });
              await caisseCredit.save({ transaction: t });
            }
          }
        }
      }
    }

    const fournisseur = await Fournisseur.findByPk(fournisseurId);
    if (!fournisseur) {
      return res.status(404).json({ message: "Fournisseur introuvable." });
    }

    if (type === "CREDIT") {
      const vendeurs = await Utilisateur.findAll({
        where: { boutiqueId: boutique.id },
        transaction: t,
      });
      for (const vendeur of vendeurs) {
        const caisseCredit = await getCaisseByType(
          "CREDIT_ACHAT",
          vendeur.id,
          t
        );
        caisseCredit.solde_actuel += totalAchat;
        await caisseCredit.save({ transaction: t });
      }

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
          description: "ACHAT à crédit",
          nom: fournisseur.nom,
          montant: totalAchat,
          montantPaye: 0,
          montantRestant: 0,
          beneficeCredit: benefice,
          type: "ENTRE",
          typeCredit: "ACHAT",
          status: "NON PAYER",
          boutiqueId: utilisateur.boutiqueId,
        },
        { transaction: t }
      );
    }

    await t.commit();

    const io = req.app.get("io");
    if (io) io.emit("caisseMisAJour");

    return res
      .status(201)
      .json({ message: "Achat créé avec succès.", achatId: achat.id });
  } catch (error) {
    await t.rollback();
    console.error("Erreur création achat :", error);
    return res
      .status(500)
      .json({ message: error.message || "Erreur serveur." });
  }
};

/**
 * Récupérer tous les achats
 */
const recupererAchats = async (req, res) => {
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

    // ============================================================
    // Récupérer les achats avec leurs relations
    // ============================================================
    const achats = await Achat.findAll({
      where: { utilisateurId: idsUtilisateurs },
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
        { model: Fournisseur, attributes: ["id", "nom"] },
        {
          model: Utilisateur,
          attributes: ["id", "nom", "boutiqueId"],
          include: [{ model: Boutique, as: "Boutique" }],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json(achats);
  } catch (error) {
    console.error("Erreur récupération achats :", error);
    return res
      .status(500)
      .json({ message: error.message || "Erreur serveur." });
  }
};

/**
 * Supprimer un achat
 */
const supprimerAchat = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    const { id } = req.params;
    const achat = await Achat.findByPk(id, { transaction: t });
    if (!achat) return res.status(404).json({ message: "Achat non trouvé." });
    if (achat.boutiqueId !== utilisateur.boutiqueId)
      return res.status(403).json({ message: "Suppression interdite." });

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
        produit.stock_actuel -= ligne.quantite;
        await produit.save({ transaction: t });
        total += ligne.quantite * ligne.prix_achat;
      }
    }

    await LigneAchat.destroy({ where: { achatId: id }, transaction: t });
    await achat.destroy({ transaction: t });

    // Mise à jour caisses
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
          caisseVSP.solde_actuel -= total;
          await caisseVSP.save({ transaction: t });
        }
      }
    }

    await t.commit();
    return res.status(200).json({ message: "Achat supprimé avec succès." });
  } catch (error) {
    await t.rollback();
    console.error("Erreur suppression achat :", error);
    return res
      .status(500)
      .json({ message: error.message || "Erreur serveur." });
  }
};

module.exports = {
  creerAchat,
  recupererAchats,
  supprimerAchat,
  annulerAchat,
};
