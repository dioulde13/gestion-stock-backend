

const express = require("express");
const http = require("http");
require("dotenv").config();
const { Server } = require("socket.io");
const mysql = require("mysql2/promise"); // ✅ Importation correcte
const bodyParser = require("body-parser");
const dbConfig = require("./config/dbConfig");
const sequelize = require("./models/sequelize");
const cors = require("cors");

//sussuusus
// Charger tes modèles
require("./models/produit");
require("./models/notification");
require("./models/notificationUser");
require("./models/achat");
require("./models/ligneAchat");
require("./models/ligneVente");
require("./models/mouvementStock");
require("./models/typeMvt");
require("./models/role");
require("./models/fournisseur");
require("./models/client");
require("./models/credit");
require("./models/payementCredit");
require("./models/caisse");
require("./models/boutique");
require("./models/versement");



const produitRoute = require("./routes/produitRoute");
const versementRoute = require("./routes/versementRoute");
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

app.use("/api/versement", boutiqueRoute);
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

app.get("/check-db-connection", async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    await connection.ping(); // Vérifie la connexion
    await connection.end();

    res.json({
      success: true,
      message: "Connexion à la base de données réussie"
    });
  } catch (error) {
    console.error("Erreur connexion MySQL :", error);
    res.status(500).json({
      success: false,
      message: "Erreur de connexion",
      error: error.message
    });
  }
});


// (async () => {
//   try {
//     // Synchroniser les modèles (tables) si besoin
//     await sequelize.sync({ alter: true });  // ou { force: false } selon vos besoins
//     console.log("🔄 Synchronisation des tables terminée");
//     app.listen(PORT, () => {
//       console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
//     });
//   } catch (error) {
//     console.error("Erreur lors de la synchronisation / démarrage :", error);
//   }
// })();

// Sequelize sync
sequelize
  .sync({ alter: true }) // Remettre  force: true si besoin
  .then(() => console.log("Tables créées avec succès"))
  .catch((error) => console.error("Erreur création tables :", error));


// Port Railway ou local
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});

// const PORT = process.env.PORT || 3000;
// server.listen(PORT, () => {
//   console.log(`Serveur démarré sur http://localhost:${PORT}`);
// });
