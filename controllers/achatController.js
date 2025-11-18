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
 * Créer un achat (avec lignes + mise à jour stock et caisses)
 */
const creerAchat = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    const { fournisseurId, lignes, type = "ACHAT" } = req.body;
    if (!["ACHAT", "CREDIT"].includes(type))
      throw new Error('Type de vente invalide. Doit être "ACHAT" ou "CREDIT".');

    if (!fournisseurId || !lignes || lignes.length === 0)
      return res.status(400).json({ message: "Fournisseur et lignes obligatoires." });

    if (!utilisateur.boutiqueId)
      return res.status(400).json({ message: "Utilisateur non associé à une boutique." });

    // Calcul total
    let total = 0;
    for (const ligne of lignes) {
      if (!ligne.produitId || !ligne.quantite || !ligne.prix_achat)
        return res.status(400).json({ message: "Chaque ligne doit avoir produitId, quantite et prix_achat." });
      total += ligne.quantite * ligne.prix_achat;
    }

    // Vérification solde utilisateur
    const caisseUser = await getCaisseByType("CAISSE", utilisateur.id, t);
    if (!caisseUser) return res.status(400).json({ message: "Caisse utilisateur introuvable." });
    if (caisseUser.solde_actuel < total) return res.status(400).json({ message: "Solde insuffisant." });

    caisseUser.solde_actuel -= total;
    await caisseUser.save({ transaction: t });

    // Création achat
    const achat = await Achat.create({
      fournisseurId,
      utilisateurId: utilisateur.id,
      total,
      boutiqueId: utilisateur.boutiqueId,
      type,
      status: "VALIDER",
    }, { transaction: t });

    // Création des lignes + mise à jour stock
    for (const ligne of lignes) {
      const produit = await Produit.findByPk(ligne.produitId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!produit) throw new Error(`Produit ID ${ligne.produitId} non trouvé.`);

      if (produit.boutiqueId !== utilisateur.boutiqueId)
        throw new Error("Impossible de modifier un produit d'une autre boutique.");

      await LigneAchat.create({
        achatId: achat.id,
        produitId: ligne.produitId,
        quantite: ligne.quantite,
        prix_achat: ligne.prix_achat,
        prix_vente: ligne.prix_vente,
      }, { transaction: t });

      await produit.update({
        prix_achat: ligne.prix_achat,
        prix_vente: ligne.prix_vente || produit.prix_vente,
        stock_actuel: produit.stock_actuel + ligne.quantite
      }, { transaction: t });
    }

    // Mise à jour caisses admin et vendeurs
    const boutique = await Boutique.findByPk(utilisateur.boutiqueId, { transaction: t });
    if (boutique) {
      const vendeurs = await Utilisateur.findAll({ where: { boutiqueId: boutique.id }, transaction: t });

      for (const vendeur of vendeurs) {
        const caisseVSP = await getCaisseByType("VALEUR_STOCK_PUR", vendeur.id, t);
        if (caisseVSP) {
          caisseVSP.solde_actuel += total;
          await caisseVSP.save({ transaction: t });
        }
      }

      if (boutique.utilisateurId && boutique.utilisateurId !== utilisateur.id) {
        const admin = await Utilisateur.findByPk(boutique.utilisateurId, { transaction: t });
        if (admin) {
          const caisseVSPAdmin = await getCaisseByType("VALEUR_STOCK_PUR", admin.id, t);
          const caisseCaisseAdmin = await getCaisseByType("CAISSE", admin.id, t);
          if (caisseVSPAdmin && caisseCaisseAdmin) {
            caisseVSPAdmin.solde_actuel += total;
            caisseCaisseAdmin.solde_actuel -= total;
            await caisseVSPAdmin.save({ transaction: t });
            await caisseCaisseAdmin.save({ transaction: t });
          }
        }
      }
    }

    await t.commit();

    const io = req.app.get("io");
    if (io) io.emit("caisseMisAJour");

    return res.status(201).json({ message: "Achat créé avec succès.", achatId: achat.id });
  } catch (error) {
    await t.rollback();
    console.error("Erreur création achat :", error);
    return res.status(500).json({ message: error.message || "Erreur serveur." });
  }
};

/**
 * Récupérer tous les achats
 */
const recupererAchats = async (req, res) => {
  try {
    const utilisateur = await getUserFromToken(req, res);
    if (!utilisateur) return;

    let whereClause = {};
    if (utilisateur.Role && utilisateur.Role.nom.toUpperCase() === "ADMIN") {
      const boutiquesIds = (utilisateur.BoutiquesCreees || []).map(b => b.id);
      whereClause["$Utilisateur.boutiqueId$"] = boutiquesIds;
    } else {
      whereClause.utilisateurId = utilisateur.id;
    }

    const achats = await Achat.findAll({
      where: whereClause,
      include: [
        { model: LigneAchat, include: [{ model: Produit, attributes: ["id", "nom", "prix_achat", "prix_vente", "boutiqueId"] }] },
        { model: Fournisseur, attributes: ["id", "nom"] },
        { model: Utilisateur, attributes: ["id", "nom"], include: [{ model: Boutique, as: "Boutique" }] },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json(achats);
  } catch (error) {
    console.error("Erreur récupération achats :", error);
    return res.status(500).json({ message: error.message || "Erreur serveur." });
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
    if (achat.boutiqueId !== utilisateur.boutiqueId) return res.status(403).json({ message: "Suppression interdite." });

    const lignes = await LigneAchat.findAll({ where: { achatId: id }, transaction: t });
    let total = 0;
    for (const ligne of lignes) {
      const produit = await Produit.findByPk(ligne.produitId, { transaction: t });
      if (produit) {
        produit.stock_actuel -= ligne.quantite;
        await produit.save({ transaction: t });
        total += ligne.quantite * ligne.prix_achat;
      }
    }

    await LigneAchat.destroy({ where: { achatId: id }, transaction: t });
    await achat.destroy({ transaction: t });

    // Mise à jour caisses
    const boutique = await Boutique.findByPk(utilisateur.boutiqueId, { transaction: t });
    if (boutique) {
      const vendeurs = await Utilisateur.findAll({ where: { boutiqueId: boutique.id }, transaction: t });
      for (const vendeur of vendeurs) {
        const caisseVSP = await getCaisseByType("VALEUR_STOCK_PUR", vendeur.id, t);
        if (caisseVSP) { caisseVSP.solde_actuel -= total; await caisseVSP.save({ transaction: t }); }
      }
    }

    await t.commit();
    return res.status(200).json({ message: "Achat supprimé avec succès." });
  } catch (error) {
    await t.rollback();
    console.error("Erreur suppression achat :", error);
    return res.status(500).json({ message: error.message || "Erreur serveur." });
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
    const achat = await Achat.findByPk(id, { include: LigneAchat, transaction: t, lock: t.LOCK.UPDATE });
    if (!achat) return res.status(404).json({ message: "Achat non trouvé." });
    if (achat.status === "ANNULER") return res.status(400).json({ message: "Achat déjà annulé." });

    const total = achat.total;

    for (const ligne of achat.LigneAchats) {
      const produit = await Produit.findByPk(ligne.produitId, { transaction: t, lock: t.LOCK.UPDATE });
      if (produit) {
        if (produit.stock_actuel < ligne.quantite)
          throw new Error(`Stock insuffisant pour le produit ${produit.nom}.`);
        produit.stock_actuel -= ligne.quantite;
        await produit.save({ transaction: t });
      }
    }

    const caisseUser = await getCaisseByType("CAISSE", utilisateur.id, t);
    if (caisseUser) { caisseUser.solde_actuel += total; await caisseUser.save({ transaction: t }); }

    const boutique = await Boutique.findByPk(utilisateur.boutiqueId, { transaction: t });
    if (boutique) {
      const vendeurs = await Utilisateur.findAll({ where: { boutiqueId: boutique.id }, transaction: t });
      for (const vendeur of vendeurs) {
        const caisseVSP = await getCaisseByType("VALEUR_STOCK_PUR", vendeur.id, t);
        if (caisseVSP) { caisseVSP.solde_actuel -= total; await caisseVSP.save({ transaction: t }); }
      }
    }

    achat.status = "ANNULER";
    achat.nomPersonneAnnuler = utilisateur.nom;
    await achat.save({ transaction: t });

    await t.commit();

    const io = req.app.get("io");
    if (io) io.emit("caisseMisAJour");

    return res.status(200).json({ success: true, message: "Achat annulé avec succès." });
  } catch (error) {
    await t.rollback();
    console.error("Erreur annulation achat :", error);
    return res.status(500).json({ message: error.message || "Erreur serveur." });
  }
};

module.exports = {
  creerAchat,
  recupererAchats,
  supprimerAchat,
  annulerAchat,
};
