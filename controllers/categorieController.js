const Categorie = require('../models/categorie');
const Utilisateur = require('../models/utilisateur');
const Role = require('../models/role');
const Boutique = require('../models/boutique');
const jwt = require('jsonwebtoken');

// Ajouter une catégorie
const ajouterCategorie = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ message: 'Aucun token fourni.' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const utilisateurConnecte = await Utilisateur.findByPk(decoded.id, {
      include: [{ model: Role, attributes: ['nom'] }, { model: Boutique, as: 'Boutique' }],
    });
    if (!utilisateurConnecte) return res.status(404).json({ message: 'Utilisateur non trouvé.' });

    const { nom } = req.body;
    if (!nom) return res.status(400).json({ message: 'Le nom de la catégorie est obligatoire.' });

    // 👉 Normalisation du nom pour éviter "Test", " test ", "TEST"
    const nomNormalise = nom.trim().toLowerCase();

    let utilisateurId;

    if (utilisateurConnecte.Role.nom.toUpperCase() === 'ADMIN') {
      utilisateurId = utilisateurConnecte.id;
    } else if (utilisateurConnecte.Role.nom.toUpperCase() === 'VENDEUR') {
      if (!utilisateurConnecte.boutiqueId)
        return res.status(403).json({ message: 'Aucune boutique associée à ce vendeur.' });

      utilisateurId = utilisateurConnecte.id;
    } else {
      return res.status(403).json({ message: 'Rôle non autorisé.' });
    }

    // ⚠️ Vérifier si une catégorie existe déjà avec ce nom pour ce même utilisateur
    const categorieExistante = await Categorie.findOne({
      where: {
        utilisateurId,
        nom: nomNormalise,
      },
    });

    if (categorieExistante) {
      return res.status(400).json({ message: 'Une catégorie avec ce nom existe déjà.' });
    }

    // Création de la catégorie
    const categorie = await Categorie.create({ nom: nomNormalise, utilisateurId });

    res.status(201).json({ message: 'Catégorie créée avec succès.', categorie });
  } catch (error) {
    console.error('Erreur lors de la création de la catégorie :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};


// Récupérer les catégories
const recupererCategories = async (req, res) => {
  try {
    // 🔐 Vérification du token
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ message: 'Aucun token fourni.' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔹 Récupération de l'utilisateur avec son rôle et sa boutique
    const utilisateurConnecte = await Utilisateur.findByPk(decoded.id, {
      include: [{ model: Role, attributes: ['nom'] }, { model: Boutique, as: 'Boutique' }],
    });
    if (!utilisateurConnecte) return res.status(404).json({ message: 'Utilisateur non trouvé.' });

    let idsUtilisateurs = [];

    if (utilisateurConnecte.Role.nom.toUpperCase() === 'ADMIN') {
      // Admin : récupérer toutes les boutiques qu'il a créées
      const boutiques = await Boutique.findAll({
        where: { utilisateurId: utilisateurConnecte.id },
        include: [
          { 
            model: Utilisateur, as: 'Vendeurs', attributes: ['id'],
            include: [{ model: Boutique, as: "Boutique" }],
          },
        ],
      });

      for (const boutique of boutiques) {
        // Ajouter tous les utilisateurs (admin + vendeurs) de cette boutique
        idsUtilisateurs.push(boutique.utilisateurId); // admin
        if (boutique.Vendeurs && boutique.Vendeurs.length > 0) {
          boutique.Vendeurs.forEach(v => idsUtilisateurs.push(v.id));
        }
      }

    } else if (utilisateurConnecte.Role.nom.toUpperCase() === 'VENDEUR') {
      // Vendeur : récupérer tous les utilisateurs de sa boutique
      const boutique = await Boutique.findByPk(utilisateurConnecte.boutiqueId, {
        include: [{ model: Utilisateur, as: 'Vendeurs', attributes: ['id'] }],
      });

      if (boutique) {
        idsUtilisateurs.push(boutique.utilisateurId); // admin
        if (boutique.Vendeurs && boutique.Vendeurs.length > 0) {
          boutique.Vendeurs.forEach(v => idsUtilisateurs.push(v.id));
        }
      }

    } else {
      return res.status(403).json({ message: 'Rôle non autorisé.' });
    }

    // 🔹 Récupération des catégories de tous les utilisateurs sélectionnés
    const categories = await Categorie.findAll({
      where: { utilisateurId: idsUtilisateurs },
      include: [{ model: Utilisateur, attributes: ['id', 'nom', 'email'] }],
    });

    res.status(200).json(categories);
  } catch (error) {
    console.error('Erreur lors de la récupération des catégories :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Consulter une seule catégorie
const consulterCategorie = async (req, res) => {
  try {
    const { id } = req.params;
    const categorie = await Categorie.findByPk(id, {
      include: [
        {
          model: Utilisateur,
          attributes: ['id', 'nom', 'email', 'roleId'],
          include: [{ model: Role, attributes: ['id', 'nom'] }]
        }
      ]
    });
    if (!categorie) return res.status(404).json({ message: 'Catégorie non trouvée.' });
    res.status(200).json(categorie);
  } catch (error) {
    console.error('Erreur lors de la consultation de la catégorie :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Modifier une catégorie
const modifierCategorie = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom } = req.body;

    const categorie = await Categorie.findByPk(id);
    if (!categorie) return res.status(404).json({ message: 'Catégorie non trouvée.' });

    // On peut vérifier ici si l'utilisateur connecté est autorisé à modifier cette catégorie
    // Exemple : admin ou vendeur créateur
    const authHeader = req.headers['authorization'];
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const utilisateurConnecte = await Utilisateur.findByPk(decoded.id, { include: Role });

    if (utilisateurConnecte.Role.nom.toUpperCase() === 'VENDEUR' && categorie.utilisateurId !== utilisateurConnecte.id)
      return res.status(403).json({ message: 'Non autorisé à modifier cette catégorie.' });

    await categorie.update({ nom: nom || categorie.nom });
    res.status(200).json({ message: 'Catégorie mise à jour avec succès.', categorie });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la catégorie :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Supprimer une catégorie
const supprimerCategorie = async (req, res) => {
  try {
    const { id } = req.params;
    const categorie = await Categorie.findByPk(id);
    if (!categorie) return res.status(404).json({ message: 'Catégorie non trouvée.' });

    // Vérifier si utilisateur connecté peut supprimer
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(403).json({ message: "Accès refusé. Aucun token trouvé." });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2) {
      return res.status(400).json({ message: "Format de token invalide." });
    }

    const token = parts[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(403).json({ message: "Token invalide." });
    }

    const utilisateurConnecte = await Utilisateur.findByPk(decoded.id, { include: Role });
    if (!utilisateurConnecte) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    // Vérifie le rôle et la propriété de la catégorie
    if (
      utilisateurConnecte.Role.nom.toUpperCase() === 'VENDEUR' &&
      categorie.utilisateurId !== utilisateurConnecte.id
    ) {
      return res.status(403).json({ message: 'Non autorisé à supprimer cette catégorie.' });
    }

    await categorie.destroy();
    res.status(200).json({ message: 'Catégorie supprimée avec succès.' });
  } catch (error) {
    console.error('Erreur lors de la suppression de la catégorie :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};


module.exports = {
  ajouterCategorie,
  recupererCategories,
  consulterCategorie,
  modifierCategorie,
  supprimerCategorie
};
