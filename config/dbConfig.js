//  // Configuration de la connexion à la base de données
// const dbConfig = {
//   host: '127.0.0.1',
//   port: 3306,
//   user: 'root',
//   password: '1234',
//   database: 'gestion_Stock',
//   dialect: 'mysql',
//   pool: {
//     max: 5,
//     min: 0,
//     acquire: 30000, // 30 secondes pour acquérir la connexion
//     idle: 10000
//   }
// };
// // 30 secondes pour acquérir la connexion
// module.exports = dbConfig;

require("dotenv").config();

module.exports = {
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: parseInt(process.env.MYSQLPORT, 10) || 3306,
};

