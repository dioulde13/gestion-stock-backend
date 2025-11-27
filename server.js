// server.js

const express = require("express");
const http = require("http");
const cors = require("cors");
require("dotenv").config();
const { Server } = require("socket.io");
const mysql = require("mysql2/promise");
const dbConfig = require("./config/dbConfig");
const sequelize = require("./models/sequelize");

// Charger les modèles
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

// Import des routes
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

// --- CORS configuration ---
const corsOptions = {
  origin: "*",  // Pour dev : toutes origines. En production, mettre l'URL de ton front. :contentReference[oaicite:0]{index=0}
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],  // Méthodes autorisées :contentReference[oaicite:1]{index=1}
  allowedHeaders: ["Content-Type", "Authorization"],  // Headers autorisés :contentReference[oaicite:2]{index=2}
  optionsSuccessStatus: 200 // Pour que le preflight OPTIONS retourne 200 OK (et pas 204, parfois problématique) :contentReference[oaicite:3]{index=3}
};

// Appliquer CORS globalement
app.use(cors(corsOptions));
// Gérer explicitement les requêtes OPTIONS (preflight) pour tous les chemins
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Socket.IO config ---
const io = new Server(server, {
  cors: {
    origin: "*", // ou le domaine de ton front en prod :contentReference[oaicite:4]{index=4}
    methods: ["GET", "POST"],
    // allowedHeaders, credentials etc. si besoin
  }
});
app.set("io", io);

// --- Définition des routes ---
app.use("/api/versement", versementRoute);
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

app.get("/", (req, res) => {
  res.send("Bienvenue sur l'API de gestion de stock !");
});

// Endpoint test de connexion à la base
app.get("/check-db-connection", async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    await connection.ping();
    await connection.end();
    res.json({ success: true, message: "Connexion à la base de données réussie" });
  } catch (error) {
    console.error("Erreur connexion MySQL :", error);
    res.status(500).json({ success: false, message: "Erreur de connexion", error: error.message });
  }
});

// Synchronisation Sequelize
sequelize
  .sync({ alter: true })
  .then(() => console.log("Tables créées avec succès"))
  .catch((error) => console.error("Erreur création tables :", error));

// Événements Socket.IO
io.on("connection", (socket) => {
  console.log("Client connecté via Socket.IO, id:", socket.id);

  socket.on("registerUser", (userId) => {
    socket.join("user_" + userId);
  });

  socket.on("disconnect", () => {
    console.log("Client déconnecté:", socket.id);
  });
});


// Démarrage du serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
