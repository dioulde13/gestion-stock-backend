// const express = require('express');
// const bodyParser = require('body-parser');
// const sequelize = require("./models/sequelize");
// const cors = require("cors");

// require("./models/achat");
// require("./models/ligneAchat");
// require("./models/ligneVente");
// require("./models/mouvementStock");
// require("./models/produit");
// require("./models/typeMvt");
// require("./models/role");
//  require('./models/fournisseur');
//  require('./models/client');
//  require('./models/credit');
//  require('./models/payementCredit');

// const produitRoute = require("./routes/produitRoute");
// const categorieRoutes = require("./routes/categorieRoutes");
// const utilisateurRoutes = require("./routes/utilisateurRoutes");
// const roleRoutes = require("./routes/roleRoutes");
// const mouvementStockRoute = require("./routes/mouvementStockRoutes");
// const achatRoute = require("./routes/achatRoute");
// const fournisseurRoute = require("./routes/fournisseurRoutes");
// const dasboardRoutes = require("./routes/dashboardRoute");
// const venteRoute = require("./routes/venteRoute");
// const typeMvtStockRoute = require("./routes/typeMvtStockRoute");
// const clientRoute = require("./routes/clientRoute");
// const creditRoute = require("./routes/creditRoute");
// const payementCreditRoute = require("./routes/payementCreditRoute");
// const depenseRoute = require("./routes/depenseRoute");
// const caisseRoute = require("./routes/caisseRoute");

// const app = express();
// const PORT = 3000;

// app.use(bodyParser.json());

// app.use(
//   cors({
//     origin: "*", // Adapter si besoin pour Angular
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//   })
// );

// app.use("/api/caisse", caisseRoute);
// app.use("/api/credit", creditRoute);
// app.use("/api/depense", depenseRoute);
// app.use("/api/payementCredit", payementCreditRoute);
// app.use("/api/dashboard", dasboardRoutes);
// app.use("/api/vente", venteRoute);
// app.use("/api/achat", achatRoute);
// app.use("/api/fournisseur", fournisseurRoute);
// app.use("/api/mouvementStock", mouvementStockRoute);
// app.use("/api/typeMvtStock", typeMvtStockRoute);
// app.use("/api/role", roleRoutes);
// app.use("/api/produit", produitRoute);
// app.use("/api/client", clientRoute);
// app.use("/api/categorie", categorieRoutes);
// app.use("/api/utilisateur", utilisateurRoutes);

// app.use(express.urlencoded({ extended: true }));

// // Sequelize sync
// sequelize
//   .sync({ alter: true }) // Remettre force: true si besoin
//   .then(() => console.log("Tables créées avec succès"))
//   .catch((error) => console.error("Erreur création tables :", error));

// app.get('/', (req, res) => {
//   res.send('Bienvenue sur l\'API de gestion de stock !');
// });

// app.listen(PORT, () => {
//   console.log(`Serveur démarré sur http://localhost:${PORT}`);
// });

// server.js ou app.js

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const sequelize = require("./models/sequelize");
const cors = require("cors");
require("dotenv").config();

// Charger tes modèles
require("./models/notification");
require("./models/notificationUser");
require("./models/achat");
require("./models/ligneAchat");
require("./models/ligneVente");
require("./models/mouvementStock");
require("./models/produit");
require("./models/typeMvt");
require("./models/role");
require("./models/fournisseur");
require("./models/client");
require("./models/credit");
require("./models/payementCredit");
require("./models/caisse");
require("./models/boutique");

require("dotenv").config();

const produitRoute = require("./routes/produitRoute");
const categorieRoutes = require("./routes/categorieRoutes");
const utilisateurRoutes = require("./routes/utilisateurRoutes");
const roleRoutes = require("./routes/roleRoutes");
const mouvementStockRoute = require("./routes/mouvementStockRoutes");
const achatRoute = require("./routes/achatRoute");
const fournisseurRoute = require("./routes/fournisseurRoutes");
const dashboardRoutes = require("./routes/dashboardRoute");
const venteRoute = require("./routes/venteRoute");
const typeMvtStockRoute = require("./routes/typeMvtStockRoute");
const clientRoute = require("./routes/clientRoute");
const creditRoute = require("./routes/creditRoute");
const payementCreditRoute = require("./routes/payementCreditRoute");
const depenseRoute = require("./routes/depenseRoute");
const caisseRoute = require("./routes/caisseRoute");
const notificationRoute = require("./routes/notificationRoute");
const boutiqueRoute = require("./routes/boutiqueRoutes");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // à limiter en production
    methods: ["GET", "POST"],
  },
});

// Permettre accès à io dans tes routes/controllers
app.set("io", io);

app.use(bodyParser.json());

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Tes routes
app.use("/api/boutique", boutiqueRoute);
app.use("/api/caisse", caisseRoute);
app.use("/api/credit", creditRoute);
app.use("/api/depense", depenseRoute);
app.use("/api/payementCredit", payementCreditRoute);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/vente", venteRoute);
app.use("/api/achat", achatRoute);
app.use("/api/fournisseur", fournisseurRoute);
app.use("/api/mouvementStock", mouvementStockRoute);
app.use("/api/typeMvtStock", typeMvtStockRoute);
app.use("/api/role", roleRoutes);
app.use("/api/produit", produitRoute);
app.use("/api/client", clientRoute);
app.use("/api/categorie", categorieRoutes);
app.use("/api/utilisateur", utilisateurRoutes);
app.use("/api/notification", notificationRoute);

app.use(express.urlencoded({ extended: true }));

//.sync({ alter: true })
// Synchroniser la base
sequelize
  .sync()
  .then(() => console.log("Tables créées avec succès"))
  .catch((error) => console.error("Erreur création tables :", error));

app.get("/", (req, res) => {
  res.send("Bienvenue sur l'API de gestion de stock !");
});

// Événements de connexion Socket.IO
io.on("connection", (socket) => {
  console.log("Client connecté via Socket.IO, id:", socket.id);

  // Optionnel : le client peut s’enregistrer sous un utilisateur
  socket.on("registerUser", (userId) => {
    console.log("Client rejoint la room user_" + userId);
    socket.join("user_" + userId);
  });

  socket.on("disconnect", () => {
    console.log("Client déconnecté:", socket.id);
  });
});

app.get("/", (req, res) => {
  res.send("Backend en ligne");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
