require('dotenv').config();
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./src/routes/apiRoutes');
const errorHandler = require('./src/utils/errorHandler');
const logger = require('./src/utils/logger');
const { iniciarSincronizacionAutomatica } = require('./src/jobs/syncScheduler');
const db = require('./src/models');

const app = express();
const PORT = process.env.PORT || 3009;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Aumentar límite para XMLs grandes
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/v1', apiRoutes);

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Ruta no encontrada' });
});

// Manejador global de errores (DEBE IR AL FINAL)
app.use(errorHandler);

// Inicio del servidor
const startServer = async () => {
  try {
    // Conectar DB y sincronizar modelos
    await db.sequelize.authenticate();
    logger.info('✅ Conexión a Base de Datos establecida.');
    
    // Sincronización de tablas (usar migrations en producción real)
    await db.sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    logger.info('✅ Modelos de Base de Datos sincronizados.');

    app.listen(PORT, () => {
      logger.info(`${new Date().toISOString()} 🚀 Servidor API corriendo en puerto ${PORT}`);
      
      // Iniciar tareas programadas (Cron)
      iniciarSincronizacionAutomatica();
      logger.info(`${new Date().toISOString()} ⏰ Tareas automáticas (8am, 12pm, 5pm) activadas.`);
    });

    return app; // Retornamos app para pruebas o montajes externos
  } catch (error) {
    logger.error(`${new Date().toISOString()} Fallo crítico al iniciar el servidor:`, error);
    if (require.main === module) {
      process.exit(1);
    }
    throw error;
  }
};

// Solo iniciar automáticamente si este archivo es ejecutado directamente (ej. node server.js)
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };