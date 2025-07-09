const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");

const TypeMvt = sequelize.define('TypeMvt', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  type: {
    type: DataTypes.ENUM("entrée", "sortie"),
    allowNull: false,
    defaultValue: "entrée",
  },
});

module.exports = TypeMvt;
