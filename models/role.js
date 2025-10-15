const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");

const Role = sequelize.define('Role', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  nom: { type: DataTypes.STRING, allowNull: false }
});

module.exports = Role;
