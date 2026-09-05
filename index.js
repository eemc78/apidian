const dianService = require('./src/services/dianService');
const db = require('./src/models');
const logger = require('./src/utils/logger');
const { startServer } = require('./server'); // Importamos la lógica de servidor exportable

/**
 * Librería API DIAN Integrator
 */
module.exports = {
  // Servicio core de DIAN (firmas, peticiones SOAP, parseo)
  dianService,
  
  // Modelos de Base de Datos y conexión Sequelize
  db,
  
  // Logger interno
  logger,
  
  // Función para inicializar la librería manualmente (si no se usan variables de entorno)
  init: async (config) => {
    if (config) {
      if (config.certPath) process.env.CERT_PATH = config.certPath;
      if (config.certFilename) process.env.CERT_FILENAME = config.certFilename;
      if (config.certPassword) process.env.CERT_PASSWORD = config.certPassword;
      if (config.dbDialect) process.env.DB_DIALECT = config.dbDialect;
      // Re-inicializar el firmador si se pasan nuevas credenciales
      dianService.initialize();
    }
    
    // Autenticar y sincronizar BD
    await db.sequelize.authenticate();
    await db.sequelize.sync({ alter: false });
    return true;
  },

  // Función para arrancar el servidor Express embebido (modo standalone)
  startApiServer: async (port) => {
    if (port) process.env.PORT = port;
    return await startServer();
  }
};
