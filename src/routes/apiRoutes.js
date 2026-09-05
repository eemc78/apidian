const express = require('express');
const router = express.Router();

// Controladores
const resolucionController = require('../controllers/resolucionController');
const documentoController = require('../controllers/documentoController'); // Asumiendo que existe similar a resolucion
const adminController = require('../controllers/adminController');

// Middleware de validación global (opcional)
// const validate = require('../middleware/validate');

// Rutas de Resoluciones llamadas a la DIAN
router.post('/resoluciones/consultar', resolucionController.consultarResoluciones);
router.get('/resoluciones/listar', resolucionController.listarResolucionesDB);

// Rutas de Documentos (Facturas, Notas, etc.) llamadas a la DIAN
router.post('/documentos/consultar', documentoController.consultarDocumento);
router.get('/documentos/historial/:nit', documentoController.historialTercero);
router.post('/documentos/sincronizar/:id', documentoController.sincronizarDocumentoManual);
router.get('/documentos/listar', documentoController.listarDocumentos);

// Rutas Administrativas
router.post('/admin/usuarios', adminController.crearUsuario);
router.get('/admin/estadisticas', adminController.obtenerEstadisticas);

// Health Check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'DIAN API Integrator', timestamp: new Date() });
});

module.exports = router;