const dianService = require('../services/dianService');
const validators = require('../utils/validators');

exports.consultarResoluciones = async (req, res, next) => {
  try {
    const { error, value } = validators.consultarResolucion.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const resultado = await dianService.consultarResoluciones(value.nit, value.softwareCode);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
};

exports.listarResolucionesDB = async (req, res, next) => {
  try {
    const { Resolucion } = require('../models');
    const resoluciones = await Resolucion.findAll({ order: [['fechaFin', 'DESC']] });
    res.json({ success: true, data: resoluciones });
  } catch (err) {
    next(err);
  }
};