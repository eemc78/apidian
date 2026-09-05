
 // GENERICA
const { Sequelize } = require('sequelize');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  dialect: process.env.DB_DIALECT, // 'postgres', 'mysql', 'mssql'
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
};

// Inicialización dinámica y agnóstica basada en el dialecto
const sequelizeOptions = {
  host: dbConfig.host,
  dialect: dbConfig.dialect || 'sqlite', // Fallback por defecto a sqlite
  define: { timestamps: true, underscored: true }, // Convención de nombres
  logging: (msg) => {
    if (process.env.LOG_LEVEL === 'debug') console.log(msg);
  },
  pool: dbConfig.pool
};

if (dbConfig.port) {
  sequelizeOptions.port = parseInt(dbConfig.port, 10);
}

// Opciones específicas para MSSQL
if (sequelizeOptions.dialect === 'mssql') {
  sequelizeOptions.dialectOptions = { options: { encrypt: true } };
}

let sequelize;

// Manejo específico para SQLite vs Motores tradicionales (MySQL/Postgres)
if (sequelizeOptions.dialect === 'sqlite') {
  // En SQLite, 'database' o 'storage' definen el archivo
  sequelizeOptions.storage = dbConfig.database || './database.sqlite';
  sequelize = new Sequelize(sequelizeOptions);
} else {
  // Para MySQL, Postgres, MSSQL
  sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    sequelizeOptions
  );
}

module.exports = sequelize;


/*
// PRUEBAS SQLITTE
const { Sequelize } = require('sequelize');
const path = require('path');

// Configuración para SQLite (Base de datos en un archivo local)
// No requiere servidor externo, ideal para desarrollo y pruebas rápidas
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../../database.sqlite'), // Archivo donde se guardarán los datos
  logging: false, // Desactiva logs SQL para limpieza (cambia a console.log si quieres ver las queries)
  define: {
    timestamps: true,
    underscored: true
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

module.exports = sequelize;


*/