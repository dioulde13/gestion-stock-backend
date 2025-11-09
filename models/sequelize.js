// // Configuration Sequelize
// const sequelize = new Sequelize(
//   dbConfig.database,
//   dbConfig.user,
//   dbConfig.password,
//   {
//     host: dbConfig.host,
//     dialect: "mysql",
//     port: dbConfig.port,
//     logging: false,
//     dialectOptions: {
//       multipleStatements: true, // Permet d'exécuter plusieurs requêtes en une seule
//       connectTimeout: 60000, // Augmente le timeout de connexion
//     },
//     pool: {
//       max: 10, // Nombre max de connexions simultanées
//       min: 0,
//       acquire: 30000, // Timeout avant l'échec d'une connexion
//       idle: 10000, // Temps avant de fermer une connexion inactive
//     },
//   }
// );

// const { Sequelize } = require("sequelize");
// const dbConfig = require("../config/dbConfig");

// require("dotenv").config();

// module.exports = {
//   host: process.env.MYSQLHOST,
//   user: process.env.MYSQLUSER,         // 👈 attention ici
//   password: process.env.MYSQLPASSWORD,
//   database: process.env.MYSQLDATABASE,
//   port: parseInt(process.env.MYSQLPORT || "3306"),
// };

// Configuration de la connexion à la base de données
// const dbConfig = {
//   port: 3306,
//   host: '127.0.0.1',
//   user: 'root',
//   password: '1234',
//   database: 'transferts',
// };
// module.exports = dbConfig;

// module.exports = sequelize;

// const { Sequelize } = require("sequelize");
// const dbConfig = require("../config/dbConfig");

// // Configuration Sequelize
// const sequelize = new Sequelize(
//   dbConfig.database,
//   dbConfig.user,
//   dbConfig.password,
//   {
//     host: dbConfig.host,
//     dialect: "mysql",
//     port: dbConfig.port,
//     logging: false,
//     dialectOptions: {
//       multipleStatements: true, // Permet d'exécuter plusieurs requêtes en une seule
//       connectTimeout: 60000, // Augmente le timeout de connexion
//     },
//     pool: {
//       max: 10, // Nombre max de connexions simultanées
//       min: 0,
//       acquire: 30000, // Timeout avant l'échec d'une connexion
//       idle: 10000, // Temps avant de fermer une connexion inactive
//     },
//   }
// );

// module.exports = sequelize;

const { Sequelize } = require("sequelize");
const dbConfig = require("../config/dbConfig");

// Création de l'instance Sequelize
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.user,
  dbConfig.password,
  {
    host: dbConfig.host,
    dialect: "mysql",
    port: dbConfig.port,
    logging: false,
    dialectOptions: {
      multipleStatements: true, // Permet plusieurs requêtes en une seule
      connectTimeout: 60000, // Timeout plus long
    },
    pool: {
      max: 10, // max connexions simultanées
      min: 0,
      acquire: 30000, // temps avant échec connexion
      idle: 10000, // fermeture connexion inactive
    },
  }
);

// Test de connexion
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log("✅ Connexion à la base MySQL réussie !");
  } catch (error) {
    console.error("❌ Impossible de se connecter à MySQL :", error);
  }
}

testConnection();

module.exports = sequelize;
