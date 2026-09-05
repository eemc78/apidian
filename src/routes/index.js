var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'apiDIAN' });
});

/* POST home page. */
router.post('/', function (req, res, next) {
  logger.info('POST /');
  // Lógica para manejar la solicitud POST
  logger.info('Datos recibidos:', req.body);
  // Procesar los datos recibidos
  
  res.render('index', { title: 'apiDIAN' });
});

module.exports = router;
