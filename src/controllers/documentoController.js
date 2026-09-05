const dianService = require('../services/dianService');
const validators = require('../utils/validators');
const { Documento, Tercero } = require('../models');
const logger = require('../utils/logger');

/**
 * Controlador para consultar el estado de un documento específico en la DIAN
 * y actualizarlo en la base de datos local.
 */
exports.consultarDocumento = async (req, res, next) => {
  try {
    // 1. Validar entrada de datos
    const { error, value } = validators.consultarDocumento.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Datos de entrada inválidos",
        details: error.details.map(d => d.message)
      });
    }

    const { tipo, numero, nit, trackId } = value;

    logger.info(`${new Date().toISOString()} Solicitud de consulta de documento: Tipo=${tipo}, Numero=${numero}, NIT=${nit}, TrackId=${trackId || 'No enviado (Buscará en BD)'}`);

    // 2. Llamar al servicio DIAN
    // El servicio se encarga de firmar, enviar SOAP, recibir respuesta y guardar en DB
    const resultado = await dianService.consultarYActualizar(tipo, { numero, nit, trackId });

    // 3. Responder al cliente
    res.status(200).json({
      success: true,
      message: "Consulta realizada exitosamente",
      data: resultado.data
    });

  } catch (err) {
    // Pasar el error al middleware global de errorHandler
    next(err);
  }
};

/**
 * Obtener el historial completo de documentos de un tercero desde la base de datos local
 * (sin consultar a la DIAN en tiempo real, solo lectura de caché local).
 */
exports.historialTercero = async (req, res, next) => {
  try {
    const { nit } = req.params;

    if (!nit) {
      return res.status(400).json({ success: false, message: "El NIT es obligatorio" });
    }

    // Buscar el tercero y sus documentos asociados
    const tercero = await Tercero.findByPk(nit, {
      include: [{
        model: Documento,
        as: 'documentos',
        order: [['fechaEmision', 'DESC']] // Ordenar por más reciente primero
      }]
    });

    if (!tercero) {
      return res.status(404).json({
        success: false,
        message: "Tercero no encontrado en la base de datos local"
      });
    }

    res.status(200).json({
      success: true,
      data: {
        tercero: tercero,
        totalDocumentos: tercero.documentos ? tercero.documentos.length : 0
      }
    });

  } catch (err) {
    next(err);
  }
};

/**
 * Forzar una sincronización manual de un documento específico (útil si la automática falla)
 */
exports.sincronizarDocumentoManual = async (req, res, next) => {
  try {
    const { id } = req.params; // ID del documento en nuestra BD
    
    const doc = await Documento.findByPk(id);
    if (!doc) {
      return res.status(404).json({ success: false, message: "Documento no encontrado" });
    }

    logger.info(`${new Date().toISOString()} Sincronización manual solicitada para documento ID: ${id} (CUFE: ${doc.cufe})`);

    // Re-ejecutar la consulta a la DIAN
    const resultado = await dianService.consultarYActualizar(doc.tipoDocumento, {
      numero: doc.numero,
      nit: doc.terceroNit
    });

    res.status(200).json({
      success: true,
      message: "Documento sincronizado manualmente",
      data: resultado.data
    });

  } catch (err) {
    next(err);
  }
};

/**
 * Listar documentos con filtros (paginación básica)
 */
exports.listarDocumentos = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, estado, tipo, fechaInicio, fechaFin } = req.query;
    
    const offset = (page - 1) * limit;
    const whereClause = {};

    if (estado) whereClause.estadoDian = estado;
    if (tipo) whereClause.tipoDocumento = tipo;
    
    if (fechaInicio || fechaFin) {
      whereClause.fechaEmision = {};
      if (fechaInicio) whereClause.fechaEmision.gte = fechaInicio;
      if (fechaFin) whereClause.fechaEmision.lte = fechaFin;
    }

    const { count, rows } = await Documento.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['fechaUltimaActualizacion', 'DESC']],
      include: [{
        model: Tercero,
        as: 'tercero',
        attributes: ['nit', 'razonSocial'] // Solo traer datos básicos del tercero
      }]
    });

    res.status(200).json({
      success: true,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit)
      },
      data: rows
    });

  } catch (err) {
    next(err);
  }
};