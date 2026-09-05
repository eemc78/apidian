const dianService = require('../services/dianService');

exports.consultarDocumento = async (req, res) => {
  try {
    const { tipo, numero, nit } = req.body;
    // Validación con Joi antes de pasar al servicio
    
    const resultado = await dianService.consultarYActualizar(tipo, { numero, nit });
    res.status(200).json(resultado);
  } catch (err) {
    // El servicio ya devuelve un objeto estructurado con statusCode
    res.status(err.statusCode || 500).json(err);
  }
};

exports.obtenerHistorialTercero = async (req, res) => {
  try {
    const { nit } = req.params;
    const terceros = await Tercero.findByPk(nit, { include: [{ model: Documento }] });
    if (!terceros) return res.status(404).json({ error: "Tercero no encontrado" });
    res.json(terceros);
  } catch (err) {
    res.status(500).json({ error: "Error consultando historial", details: err.message });
  }
};