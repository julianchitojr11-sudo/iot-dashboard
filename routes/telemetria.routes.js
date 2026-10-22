const express = require('express');
const router = express.Router();
const controller = require('../controllers/telemetria.controller');

router.post('/telemetria', controller.registrarLectura);
router.get('/telemetria/:sensor_id', controller.obtenerHistorialSensor);
router.get('/estadisticas', controller.obtenerEstadisticas);
router.get('/estadisticas/:sensor_id', controller.obtenerEstadisticasSensor);

module.exports = router;