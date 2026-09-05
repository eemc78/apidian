const cron = require('node-cron');
const dianService = require('../services/dianService');
const { Documento, Resolucion } = require('../models');
const logger = require('../utils/logger');

const iniciarSincronizacionAutomatica = () => {
  // Sintaxis: segundo minuto hora día mes díaSemana
  // 0 0 8 * * * -> Todos los días a las 8:00 AM
  // 0 0 12 * * * -> Todos los días a las 12:00 PM
  // 0 0 17 * * * -> Todos los días a las 5:00 PM
  
  const horarios = ['0 0 8 * * *', '0 0 12 * * *', '0 0 17 * * *'];

  horarios.forEach(horario => {
    cron.schedule(horario, async () => {
      logger.info(`Iniciando sincronización automática programada: ${new Date().toLocaleTimeString()}`);
      try {
        // 1. Buscar documentos con estado PENDIENTE o desactualizados hace > 24h
        const docsPendientes = await Documento.findAll({
          where: { 
            estadoDian: 'PENDIENTE',
            // O lógica de fecha: fechaUltimaActualizacion < hace 24h
          },
          limit: 50 // Evitar saturar la DIAN
        });

        for (const doc of docsPendientes) {
          try {
            await dianService.consultarYActualizar(doc.tipoDocumento.toUpperCase(), {
              numero: doc.numero,
              nit: doc.terceroNit // Asumiendo relación cargada o campo directo
            });
            logger.info(`Documento ${doc.numero} actualizado exitosamente.`);
          } catch (e) {
            logger.warn(`Fallo al actualizar auto-doc ${doc.numero}: ${e.message}`);
          }
        }

        // 2. Verificar vigencias de resoluciones (lógica similar)
        // ... código para resoluciones ...

        logger.info("Sincronización automática finalizada.");
      } catch (err) {
        logger.error("Error crítico en tarea programada", err);
      }
    });
  });
};

module.exports = { iniciarSincronizacionAutomatica };