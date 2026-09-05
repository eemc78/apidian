const { Documento, Resolucion } = require('../models');
const dianService = require('./dianService');
const logger = require('../utils/logger');

class SyncService {
  async sincronizarDocumentosPendientes() {
    logger.info('Iniciando sincronización de documentos pendientes...');
    
    try {
      // Buscar documentos pendientes o desactualizados hace más de 24h
      const docs = await Documento.findAll({
        where: {
          estadoDian: 'PENDIENTE' 
          // O agregar lógica de fecha: fechaUltimaActualizacion < now - 24h
        },
        limit: parseInt(process.env.AUTO_SYNC_BATCH_LIMIT || 50)
      });

      let exitosos = 0;
      let fallidos = 0;

      for (const doc of docs) {
        try {
          await dianService.consultarYActualizar(doc.tipoDocumento, {
            numero: doc.numero,
            nit: doc.terceroNit
          });
          exitosos++;
        } catch (err) {
          logger.warn(`Fallo al sincronizar doc ${doc.numero}: ${err.message}`);
          fallidos++;
        }
      }

      logger.info(`Sincronización finalizada: ${exitosos} éxitos, ${fallidos} fallos.`);
      return { exitosos, fallidos };

    } catch (error) {
      logger.error('Error crítico en servicio de sincronización', error);
      throw error;
    }
  }

  async verificarVigenciaResoluciones() {
    logger.info('Verificando vigencia de resoluciones...');
    const hoy = new Date();
    
    const resoluciones = await Resolucion.findAll({
      where: { estado: 'VIGENTE' }
    });

    let actualizadas = 0;
    for (const res of resoluciones) {
      if (new Date(res.fechaFin) < hoy) {
        res.estado = 'VENCIDA';
        await res.save();
        actualizadas++;
      }
    }
    logger.info(`${actualizadas} resoluciones marcadas como vencidas.`);
  }
}

module.exports = new SyncService();