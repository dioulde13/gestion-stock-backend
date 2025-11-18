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

    let utilisateurId, boutiqueId;

    if (utilisateurConnecte.Role.nom.toUpperCase() === 'ADMIN') {
      // Admin : peut créer pour lui-même
      utilisateurId = utilisateurConnecte.id;
      boutiqueId = null;
    } else if (utilisateurConnecte.Role.nom.toUpperCase() === 'VENDEUR') {
      // Vendeur : crée pour sa boutique
      if (!utilisateurConnecte.boutiqueId)
        return res.status(403).json({ message: 'Aucune boutique associée à ce vendeur.' });

      utilisateurId = utilisateurConnecte.id; // Le vendeur est le créateur
      boutiqueId = utilisateurConnecte.boutiqueId;
    } else {
      return res.status(403).json({ message: 'Rôle non autorisé.' });
    }

    const categorie = await Categorie.create({ nom, utilisateurId, boutiqueId });
    res.status(201).json({ message: 'Catégorie créée avec succès.', categorie });
  } catch (error) {
    console.error('Erreur lors de la création de la catégorie :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Récupérer les catégories
const recupererCategories = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ message: 'Aucun token fourni.' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const utilisateurConnecte = await Utilisateur.findByPk(decoded.id, {
      include: [{ model: Role, attributes: ['nom'] }, { model: Boutique, as: 'Boutique' }],
    });
    if (!utilisateurConnecte) return res.status(404).json({ message: 'Utilisateur non trouvé.' });

    let categories;

    if (utilisateurConnecte.Role.nom.toUpperCase() === 'ADMIN') {
      // Admin : voir ses catégories + celles de ses vendeurs
      const boutiques = await Boutique.findAll({
        where: { utilisateurId: utilisateurConnecte.id },
        include: [{ model: Utilisateur, as: 'Vendeurs' }],
      });

      const idsUtilisateurs = [utilisateurConnecte.id];
      boutiques.forEach(b => {
        if (b.Vendeurs?.length) {
          b.Vendeurs.forEach(v => idsUtilisateurs.push(v.id));
        }
      });

      categories = await Categorie.findAll({
        where: { utilisateurId: idsUtilisateurs },
        include: [{ model: Utilisateur, attributes: ['id', 'nom', 'email'] }],
      });

    } else if (utilisateurConnecte.Role.nom.toUpperCase() === 'VENDEUR') {
      // Vendeur : voir seulement ses propres catégories
      categories = await Categorie.findAll({
        where: { utilisateurId: utilisateurConnecte.id },
        include: [{ model: Utilisateur, attributes: ['id', 'nom', 'email'] }],
      });
    } else {
      return res.status(403).json({ message: 'Rôle non autorisé.' });
    }

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
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const utilisateurConnecte = await Utilisateur.findByPk(decoded.id, { include: Role });

    if (utilisateurConnecte.Role.nom.toUpperCase() === 'VENDEUR' && categorie.utilisateurId !== utilisateurConnecte.id)
      return res.status(403).json({ message: 'Non autorisé à supprimer cette catégorie.' });

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
