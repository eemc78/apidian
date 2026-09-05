const logger = require('./logger');

const errorHandler = (err, req, res, next) => {
  logger.error(`Error en ruta ${req.path}:`, err);

  // Si ya es un objeto de error estructurado por nuestros servicios
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details || {},
      timestamp: new Date().toISOString()
    });
  }

  // Errores de validación (Joi/Zod)
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: "Error de validación de datos",
      details: err.details,
      timestamp: new Date().toISOString()
    });
  }

  // Errores de base de datos
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      message: "Conflicto de datos (registro duplicado)",
      details: err.fields,
      timestamp: new Date().toISOString()
    });
  }

  // Error genérico del servidor
  return res.status(500).json({
    success: false,
    message: "Error interno del servidor",
    details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    timestamp: new Date().toISOString()
  });
};

module.exports = errorHandler;