// const Sequelize = require('sequelize');
// const Produit = require('../models/produit');
// const { Vente, LigneVente } = require('../models/relation');
// const Utilisateur = require('../models/utilisateur');
// const Client = require('../models/client');
// const Credit = require('../models/credit');
// const sequelize = require('../models/sequelize');
// const Caisse = require('../models/caisse');

// const creerVente = async (req, res) => {
//     const t = await sequelize.transaction();
//     try {
//         const { utilisateurId, lignes, type = "ACHAT", clientId } = req.body;

//         if (!["ACHAT", "CREDIT"].includes(type)) {
//             throw new Error('Type de vente invalide. Doit être "ACHAT" ou "CREDIT".');
//         }

//         if (type === "CREDIT" && !clientId) {
//             throw new Error('Le client est obligatoire pour une vente de type CREDIT.');
//         }

//         const utilisateur = await Utilisateur.findByPk(utilisateurId, { transaction: t });
//         if (!utilisateur) {
//             throw new Error('Utilisateur non trouvé.');
//         }

//         let totalVente = 0;
//         let totalAchat = 0;
//         for (const ligne of lignes) {
//             if (!ligne.produitId || !ligne.quantite || !ligne.prix_vente) {
//                 throw new Error('Chaque ligne doit contenir produitId, quantite, prix_vente.');
//             }

//             const produit = await Produit.findByPk(ligne.produitId, { transaction: t, lock: t.LOCK.UPDATE });
//             if (!produit) {
//                 throw new Error(`Produit ID ${ligne.produitId} non trouvé.`);
//             }

//             if (produit.stock_actuel < ligne.quantite) {
//                 throw new Error(`Stock insuffisant pour le produit: ${produit.nom}, disponible: ${produit.stock_actuel}.`);
//             }

//             totalVente += ligne.quantite * ligne.prix_vente;
//             totalAchat += ligne.quantite * produit.prix_achat;
//         }

//         const benefice = totalVente - totalAchat;

//         const vente = await Vente.create({
//             utilisateurId,
//             clientId: clientId || null,
//             total: totalVente,
//             type
//         }, { transaction: t });

//         for (const ligne of lignes) {
//             const produit = await Produit.findByPk(ligne.produitId, { transaction: t, lock: t.LOCK.UPDATE });

//             await LigneVente.create({
//                 venteId: vente.id,
//                 produitId: ligne.produitId,
//                 quantite: ligne.quantite,
//                 prix_vente: ligne.prix_vente,
//                 prix_achat: produit.prix_achat
//             }, { transaction: t });

//             // Mise à jour du stock
//             await produit.update({
//                 stock_actuel: produit.stock_actuel - ligne.quantite
//             }, { transaction: t });
//         }

//         // === MISE A JOUR DES CAISSES ===
//         // Toujours mettre à jour VALEUR_STOCK_PUR et VALEUR_STOCK
//         let caisseValeurStockPur = await Caisse.findOne({
//             where: { utilisateurId, type: "VALEUR_STOCK_PUR" },
//             transaction: t
//         });

//         caisseValeurStockPur.solde_actuel -= totalAchat;
//         await caisseValeurStockPur.save({ transaction: t });

//         let caisseValeurStock = await Caisse.findOne({
//             where: { utilisateurId, type: "VALEUR_STOCK" },
//             transaction: t
//         });

//          let totalAchtBenefice = totalAchat + benefice;
//         caisseValeurStock.solde_actuel += totalAchtBenefice;
//         await caisseValeurStock.save({ transaction: t });

//         if (type === "ACHAT") {
//             // Vente encaissée
//             let caissePrincipale = await Caisse.findOne({
//                 where: { utilisateurId, type: "PRINCIPALE" },
//                 transaction: t
//             });
//             caissePrincipale.solde_actuel += totalVente;
//             await caissePrincipale.save({ transaction: t });

//             // Caisse total
//             let caisseSolde = await Caisse.findOne({
//                 where: { utilisateurId, type: "CAISSE" },
//                 transaction: t
//             });

//             caisseSolde.solde_actuel += totalVente;
//             await caisseSolde.save({ transaction: t });

//              let beneficeRealiser = await Caisse.findOne({
//                 where: { utilisateurId, type: "BENEFICE" },
//                 transaction: t
//             });
//             beneficeRealiser.solde_actuel += benefice;
//             await beneficeRealiser.save({ transaction: t });

//         } else if (type === "CREDIT") {
//             // Vente à crédit → augmente le solde CREDIT_VENTE
//             let caisseCredit = await Caisse.findOne({
//                 where: { utilisateurId, type: "CREDIT_VENTE" },
//                 transaction: t
//             });

//             caisseCredit.solde_actuel += totalVente;
//             await caisseCredit.save({ transaction: t });

//               let beneficeRealiserCredit = await Caisse.findOne({
//                 where: { utilisateurId, type: "BENEFICE_CREDIT" },
//                 transaction: t
//             });

//             beneficeRealiserCredit.solde_actuel += benefice;
//             await beneficeRealiserCredit.save({ transaction: t });

//             // Création du crédit lié au client
//             const reference = `CR-${Date.now()}`;
//             const client = await Client.findByPk(clientId, { transaction: t });
//             if (!client) throw new Error("Client non trouvé pour créer le crédit.");

//             await Credit.create({
//                 utilisateurId,
//                 reference,
//                 description:"Vente",
//                 nom: client.nom,
//                 clientId: client.id,
//                 montant: totalVente,
//                 montantPaye: 0,
//                 montantRestant: 0,
//                 beneficeCredit: benefice,
//                 type: "SORTIE",
//                 typeCredit: "VENTE"
//             }, { transaction: t });
//         }

//         await t.commit();
//         return res.status(201).json({
//             message: 'Vente créée avec succès.',
//             benefice
//         });

//     } catch (error) {
//         await t.rollback();
//         console.error("Erreur lors de la vente :", error);
//         const message = error.message || 'Erreur interne du serveur.';
//         return res.status(400).json({ message });
//     }
// };

// module.exports = { creerVente };

const Credit = require("../models/credit");
const Sequelize = require("sequelize");
const Produit = require("../models/produit");
const { Vente, LigneVente } = require("../models/relation");
const Utilisateur = require("../models/utilisateur");
const Client = require("../models/client");
const sequelize = require("../models/sequelize");
const Notification = require("../models/notification");
const jwt = require("jsonwebtoken");
const Role = require("../models/role");
const { getCaisseByType } = require("../utils/caisseUtils");
const Boutique = require("../models/boutique");

const annulerVente = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res.status(403).json({
        success: false,
        message: "Accès refusé. Aucun token trouvé.",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const utilisateur = await Utilisateur.findByPk(decoded.id, {
      transaction: t,
    });
    if (!utilisateur) throw new Error("Utilisateur non trouvé.");

    const vente = await Vente.findByPk(id, {
      include: [{ model: LigneVente }, { model: Client }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!vente) throw new Error("Vente non trouvée.");
    if (vente.status === "ANNULER")
      throw new Error("Cette vente est déjà annulée.");

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
          caisseVSP.solde_actuel += totalAchat;
          await caisseVSP.save({ transaction: t });
        }
      }

      if (boutique.utilisateurId) {
        const adminBoutique = await Utilisateur.findByPk(
          boutique.utilisateurId,
          {
            transaction: t,
          }
        );
        if (adminBoutique) {
          const caisseAdminVSP = await getCaisseByType(
            "VALEUR_STOCK_PUR",
            adminBoutique.id,
            t
          );
          const caisseAdminPrincipal = await getCaisseByType(
            "CAISSE",
            adminBoutique.id,
            t
          );
          if (type === "ACHAT") {
            if (!caisseAdminPrincipal || !caisseAdminVSP) {
              await t.rollback();
              return res.status(400).json({
                success: false,
                message: "Caisse admin ou valeur stock pur introuvable.",
              });
            }

            if (caisseAdminVSP.solde_actuel < total) {
              await t.rollback();
              return res.status(400).json({
                success: false,
                message:
                  "Solde insuffisant dans la caisse admin pour annuler cette vente.",
              });
            }
            if (caisseAdminVSP && caisseAdminPrincipal) {
              caisseAdminVSP.solde_actuel += totalAchat;
              caisseAdminPrincipal.solde_actuel -= total;
              await caisseAdminVSP.save({ transaction: t });
              await caisseAdminPrincipal.save({ transaction: t });
            }
          } else if (type === "CREDIT") {
            const CreditVenteAdminVSP = await getCaisseByType(
              "CREDIT_VENTE",
              adminBoutique.id,
              t
            );
            if (caisseAdminVSP && CreditVenteAdminVSP) {
              caisseAdminVSP.solde_actuel += totalAchat;
              CreditVenteAdminVSP.solde_actuel -= total;
              await caisseAdminVSP.save({ transaction: t });
              await CreditVenteAdminVSP.save({ transaction: t });
            }
          }
        }
      }
    }

    if (type === "ACHAT") {
      const caissePrincipale = await getCaisseByType(
        "PRINCIPALE",
        utilisateur.id,
        t
      );

      const caisseSolde = await getCaisseByType("CAISSE", utilisateur.id, t);

      // Vérifier l'existence
      if (!caisseSolde) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Caisse principale ou caisse utilisateur introuvable.",
        });
      }

      // Vérifier le solde suffisant
      if (caisseSolde.solde_actuel < total) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Solde insuffisant dans la caisse pour annuler la vente.",
        });
      }

      caissePrincipale.solde_actuel -= total;
      await caissePrincipale.save({ transaction: t });

      caisseSolde.solde_actuel -= total;
      await caisseSolde.save({ transaction: t });

      const beneficeRealiser = await getCaisseByType(
        "BENEFICE",
        utilisateur.id,
        t
      );
      beneficeRealiser.solde_actuel -= benefice;
      await beneficeRealiser.save({ transaction: t });
    } else if (type === "CREDIT") {
      const caisseCredit = await getCaisseByType(
        "CREDIT_VENTE",
        utilisateur.id,
        t
      );
      caisseCredit.solde_actuel -= total;
      await caisseCredit.save({ transaction: t });

      const beneficeRealiserCredit = await getCaisseByType(
        "BENEFICE_CREDIT",
        utilisateur.id,
        t
      );
      beneficeRealiserCredit.solde_actuel -= benefice;
      await beneficeRealiserCredit.save({ transaction: t });

      const credit = await Credit.findOne({
        where: {
          clientId,
          typeCredit: "VENTE",
          montant: total,
          status: "VALIDER",
        },
        transaction: t,
      });
      if (credit) {
        credit.status = "ANNULER";
        await credit.save({ transaction: t });
      }
    }

    vente.nomPersonneAnnuler = `${utilisateur.nom ?? ""}`.trim();
    vente.status = "ANNULER";

    await vente.save({ transaction: t });

    await t.commit();

    const io = req.app.get("io");
    io.emit("caisseMisAJour");

    return res.status(200).json({
      success: true,
      message: "Vente annulée et effets restaurés avec succès.",
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Erreur lors de l'annulation de la vente :", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Erreur interne du serveur.",
    });
  }
};

const creerVente = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // 🔐 Vérification et décodage du token
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res.status(403).json({
        success: false,
        message: "Accès refusé. Aucun token trouvé.",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const {
      lignes,
      type = "ACHAT",
      clientId,
      clientNom,
      clientTelephone,
    } = req.body;

    if (!["ACHAT", "CREDIT"].includes(type)) {
      throw new Error('Type de vente invalide. Doit être "ACHAT" ou "CREDIT".');
    }

    // ✅ Récupération de l'utilisateur connecté
    const utilisateur = await Utilisateur.findByPk(decoded.id, {
      transaction: t,
    });
    if (!utilisateur) throw new Error("Utilisateur non trouvé.");
    if (!utilisateur.boutiqueId)
      throw new Error("L'utilisateur n'est associé à aucune boutique.");

    let clientAssocie = null;

    // ✅ Gestion du client pour une vente à crédit
    if (type === "CREDIT") {
      if (clientId) {
        clientAssocie = await Client.findByPk(clientId, { transaction: t });
        if (!clientAssocie) throw new Error("Client non trouvé.");
      } else {
        if (!clientNom || !clientTelephone) {
          throw new Error(
            "Nom et téléphone du client requis pour une vente à crédit."
          );
        }

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

    let totalVente = 0;
    let totalAchat = 0;

    for (const ligne of lignes) {
      if (!ligne.produitId || !ligne.quantite || !ligne.prix_vente) {
        throw new Error(
          "Chaque ligne doit contenir produitId, quantite et prix_vente."
        );
      }

      const produit = await Produit.findByPk(ligne.produitId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!produit)
        throw new Error(`Produit ID ${ligne.produitId} non trouvé.`);
      if (produit.boutiqueId !== utilisateur.boutiqueId) {
        throw new Error(
          `Vous ne pouvez pas vendre un produit d'une autre boutique.`
        );
      }
      if (produit.stock_actuel < ligne.quantite) {
        throw new Error(
          `Stock insuffisant pour ${produit.nom}, disponible: ${produit.stock_actuel}.`
        );
      }

      totalVente += ligne.quantite * ligne.prix_vente;
      totalAchat += ligne.quantite * produit.prix_achat;
    }

    const benefice = totalVente - totalAchat;

    // ✅ Création de la vente
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

    // ✅ Lignes de vente et mise à jour du stock
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

      await produit.update(
        {
          stock_actuel: produit.stock_actuel - ligne.quantite,
        },
        { transaction: t }
      );
    }

    let nouveauSoldePrincipale = 0;
    let nouveauSoldeGlobale = 0;
    let nouveauBenefice = 0;

    if (type === "ACHAT") {
      // === 💰 Mise à jour VALEUR_STOCK_PUR pour tous les vendeurs et admin de la boutique ===
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
            caisseVSP.solde_actuel -= totalAchat;
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
            const caisseAdminPrincipal = await getCaisseByType(
              "CAISSE",
              adminBoutique.id,
              t
            );
            if (caisseAdminVSP && caisseAdminPrincipal) {
              caisseAdminVSP.solde_actuel -= totalAchat;
              caisseAdminPrincipal.solde_actuel += totalVente;

              await caisseAdminVSP.save({ transaction: t });
              await caisseAdminPrincipal.save({ transaction: t });
            }
          }
        }
      }

      const caissePrincipale = await getCaisseByType(
        "PRINCIPALE",
        utilisateur.id,
        t
      );
      caissePrincipale.solde_actuel += totalVente;
      await caissePrincipale.save({ transaction: t });
      nouveauSoldePrincipale = caissePrincipale.solde_actuel;

      const caisseSolde = await getCaisseByType("CAISSE", utilisateur.id, t);
      caisseSolde.solde_actuel += totalVente;
      await caisseSolde.save({ transaction: t });
      nouveauSoldeGlobale = caisseSolde.solde_actuel;

      const beneficeRealiser = await getCaisseByType(
        "BENEFICE",
        utilisateur.id,
        t
      );
      beneficeRealiser.solde_actuel += benefice;
      await beneficeRealiser.save({ transaction: t });
      nouveauBenefice = beneficeRealiser.solde_actuel;
    } else if (type === "CREDIT") {
      // === 💰 Mise à jour VALEUR_STOCK_PUR pour tous les vendeurs et admin de la boutique ===
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
            caisseVSP.solde_actuel -= totalAchat;
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
            const CreditVenteAdminVSP = await getCaisseByType(
              "CREDIT_VENTE",
              adminBoutique.id,
              t
            );
            if (caisseAdminVSP && CreditVenteAdminVSP) {
              caisseAdminVSP.solde_actuel -= totalAchat;
              CreditVenteAdminVSP.solde_actuel += totalVente;

              await caisseAdminVSP.save({ transaction: t });
              await CreditVenteAdminVSP.save({ transaction: t });
            }
          }
        }
      }

      // ✅ Mise à jour de la caisse CREDIT_VENTE
      const caisseCredit = await getCaisseByType(
        "CREDIT_VENTE",
        utilisateur.id,
        t
      );
      caisseCredit.solde_actuel += totalVente;
      await caisseCredit.save({ transaction: t });
      nouveauSoldePrincipale = caisseCredit.solde_actuel;

      // ✅ Mise à jour du bénéfice crédit
      const beneficeRealiserCredit = await getCaisseByType(
        "BENEFICE_CREDIT",
        utilisateur.id,
        t
      );
      beneficeRealiserCredit.solde_actuel += benefice;
      await beneficeRealiserCredit.save({ transaction: t });
      nouveauBenefice = beneficeRealiserCredit.solde_actuel;

      // ✅ Vérification du client
      if (!clientAssocie) {
        throw new Error(
          "Impossible de créer le crédit : client non trouvé ou non défini."
        );
      }

      // ✅ Génération automatique d'une référence séquentielle par utilisateur
      let reference;

      // On cherche le dernier crédit de cet utilisateur uniquement
      const dernierCredit = await Credit.findOne({
        where: { utilisateurId: utilisateur.id },
        order: [["createdAt", "DESC"]],
        attributes: ["reference"],
        transaction: t,
      });

      if (dernierCredit && dernierCredit.reference) {
        // Exemple : REF0012 → extraire 12 → +1 → REF0013
        const numeroActuel =
          parseInt(dernierCredit.reference.replace(/\D/g, "")) || 0;
        const nouveauNumero = (numeroActuel + 1).toString().padStart(4, "0");
        reference = `REF${nouveauNumero}`;
      } else {
        // Si aucun crédit n'existe encore pour cet utilisateur
        reference = "REF0001";
      }

      // ✅ Création du crédit
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
          status: "VALIDER",
          boutiqueId: utilisateur.boutiqueId,
        },
        { transaction: t }
      );
    }

    await t.commit();

    // === 🔔 Notifications ===
    const io = req.app.get("io");
    const formatMontant = (montant) =>
      new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "GNF",
        minimumFractionDigits: 0,
      }).format(montant);

    const notif = await Notification.create({
      utilisateurId: utilisateur.id,
      message: `Vente enregistrée: ${formatMontant(totalVente)}.`,
      type: "vente",
      montant: totalVente,
      benefice,
      read: false,
    });

    if (io) io.to("user_" + utilisateur.id).emit("notification", notif);

    const notifGlobale = await Notification.create({
      utilisateurId: null,
      message: `${utilisateur.nom} a fait une vente de ${formatMontant(
        totalVente
      )}.`,
      type: "globale",
      montant: totalVente,
      benefice,
      read: false,
    });

    if (io)
      io.emit("notificationGlobale", {
        message: notifGlobale.message,
        timestamp: notifGlobale.createdAt,
      });

    if (io) {
      io.emit("caisseMisAJour", {
        utilisateurId: utilisateur.id,
        nomUtilisateur: utilisateur.nom,
        soldePrincipale: formatMontant(nouveauSoldePrincipale),
        soldeGlobale: formatMontant(nouveauSoldeGlobale),
        benefice: formatMontant(nouveauBenefice),
        timestamp: new Date(),
      });
    }

    return res.status(201).json({
      success: true,
      message: "Vente créée avec succès.",
      benefice,
      client: clientAssocie || null,
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Erreur lors de la vente :", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Erreur interne du serveur.",
    });
  }
};

const recupererVentes = async (req, res) => {
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
    const ventes = await Vente.findAll({
      where: whereClause,
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
          attributes: ["id", "nom"], // ← on ajoute 'nom' ici pour récupérer le nom du vendeur
          include: [{ model: Boutique, as: "Boutique" }],
        },
      ],
      order: [["date", "DESC"]],
    });

    return res.status(200).json(ventes);
  } catch (error) {
    console.error("Erreur lors de la récupération des ventes :", error);
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Token invalide." });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expiré." });
    }
    return res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

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
    console.error("Erreur lors de la consultation de la vente :", error);
    return res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

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
        await produit.update(
          {
            stock_actuel: produit.stock_actuel + ligne.quantite,
          },
          { transaction: t }
        );
      }
    }

    await LigneVente.destroy({ where: { venteId: id }, transaction: t });
    await vente.destroy({ transaction: t });

    await t.commit();
    return res.status(200).json({ message: "Vente supprimée avec succès." });
  } catch (error) {
    await t.rollback();
    console.error("Erreur lors de la suppression de la vente :", error);
    return res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

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
    console.error(
      "Erreur lors de la récupération des produits les plus vendus :",
      error
    );
    return res.status(500).json({ message: "Erreur interne du serveur." });
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
