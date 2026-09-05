const { User } = require('../models'); // Asumiendo que creaste un modelo User
const validators = require('../utils/validators');
const bcrypt = require('bcrypt'); // npm install bcrypt

exports.crearUsuario = async (req, res, next) => {
  try {
    const { error } = validators.crearUsuarioAdmin.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Lógica para crear usuario (ejemplo simplificado)
    // const hashedPassword = await bcrypt.hash(req.body.password, 10);
    // const user = await User.create({ ...req.body, password: hashedPassword });
    
    res.status(201).json({ message: "Usuario creado exitosamente" });
  } catch (err) {
    next(err);
  }
};

exports.obtenerEstadisticas = async (req, res, next) => {
  try {
    const totalDocs = await Documento.count();
    const totalTerceros = await Tercero.count();
    const pendientes = await Documento.count({ where: { estadoDian: 'PENDIENTE' } });
    
    res.json({
      totalDocumentos: totalDocs,
      totalTerceros: totalTerceros,
      documentosPendientes: pendientes,
      fechaReporte: new Date()
    });
  } catch (err) {
    next(err);
  }
};