// const { Sequelize } = require("sequelize");
// const dbConfig = require("../configs/dbConfig");

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

// Configuration Sequelize
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
      multipleStatements: true, // Permet d'exécuter plusieurs requêtes en une seule
      connectTimeout: 60000, // Augmente le timeout de connexion
    },
    pool: {
      max: 10, // Nombre max de connexions simultanées
      min: 0,
      acquire: 30000, // Timeout avant l'échec d'une connexion
      idle: 10000, // Temps avant de fermer une connexion inactive
    },
  }
);

module.exports = sequelize;
