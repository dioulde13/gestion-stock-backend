const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");

const TypeMvt = sequelize.define('TypeMvt', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  type: {
    type: DataTypes.ENUM("ENTRE", "SORTIE"),
    allowNull: false,
    defaultValue: "ENTRE",
  },
});

module.exports = TypeMvt;
