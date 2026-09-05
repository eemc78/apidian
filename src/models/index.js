const { Sequelize } = require('sequelize');
const sequelize = require('../config/database');
const fs = require('fs');
const path = require('path');

const db = {};

// Leer todos los modelos
fs.readdirSync(__dirname)
  .filter(file => file !== 'index.js' && file.endsWith('.js'))
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

// Definir asociaciones
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Asociaciones manuales
if (db.Tercero && db.Documento) {
  db.Tercero.hasMany(db.Documento, { foreignKey: 'terceroNit', as: 'documentos' });
  db.Documento.belongsTo(db.Tercero, { foreignKey: 'terceroNit', as: 'tercero' });
}

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;