const express = require('express');
const bodyParser = require('body-parser');
const sequelize = require("./models/sequelize");
const cors = require("cors");


require("./models/achat");
require("./models/ligneAchat");
require("./models/ligneVente");
require("./models/mouvementStock");
require("./models/produit");
require("./models/typeMvt");
require("./models/role");
 require('./models/fournisseur');
 
const produitRoute = require("./routes/produitRoute");
const categorieRoutes = require("./routes/categorieRoutes");
const utilisateurRoutes = require("./routes/utilisateurRoutes");
const roleRoutes = require("./routes/roleRoutes");
const mouvementStockRoute = require("./routes/mouvementStockRoutes");
const achatRoute = require("./routes/achatRoute");
const fournisseurRoute = require("./routes/fournisseurRoutes");
const dasboardRoutes = require("./routes/dashboardRoute");
const venteRoute = require("./routes/venteRoute");

const app = express();
const PORT = 3000;

app.use(bodyParser.json());


app.use(
  cors({
    origin: "*", // Adapter si besoin pour Angular
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use("/api/dashboard", dasboardRoutes);
app.use("/api/vente", venteRoute);
app.use("/api/achat", achatRoute);
app.use("/api/fournisseur", fournisseurRoute);
app.use("/api/mouvementStock", mouvementStockRoute);
app.use("/api/role", roleRoutes);
app.use("/api/produit", produitRoute);
app.use("/api/categorie", categorieRoutes);
app.use("/api/utilisateur", utilisateurRoutes);


// Sequelize sync
sequelize
  .sync({ alter: true }) // Remettre force: true si besoin
  .then(() => console.log("Tables créées avec succès"))
  .catch((error) => console.error("Erreur création tables :", error));

app.get('/', (req, res) => {
  res.send('Bienvenue sur l\'API de gestion de stock !');
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
