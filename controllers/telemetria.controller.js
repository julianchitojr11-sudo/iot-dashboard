const client = require('../config/db');
const { types } = require('cassandra-driver');

function consultarMetricas(query, params = []) {
  return new Promise((resolve, reject) => {
    let totalLecturas = 0;
    let sumaTemp = 0;
    let sumaHum = 0;
    let tempMax = -Infinity;
    let tempMin = Infinity;
    const sensoresSet = new Set();
    const ultimasLecturas = [];

    client.eachRow(
      query,
      params,
      { prepare: true, autoPage: true },
      (n, row) => {
        totalLecturas += 1;
        sumaTemp += row.temperatura;
        sumaHum += row.humedad;
        tempMax = Math.max(tempMax, row.temperatura);
        tempMin = Math.min(tempMin, row.temperatura);
        sensoresSet.add(row.sensor_id.toString());

        ultimasLecturas.push(row);
        ultimasLecturas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        if (ultimasLecturas.length > 15) ultimasLecturas.pop();
      },
      error => {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          totalLecturas,
          tempPromedio: totalLecturas ? Number((sumaTemp / totalLecturas).toFixed(2)) : 0,
          humPromedio: totalLecturas ? Number((sumaHum / totalLecturas).toFixed(2)) : 0,
          tempMax: totalLecturas ? tempMax : 0,
          tempMin: totalLecturas ? tempMin : 0,
          sensoresUnicos: Array.from(sensoresSet),
          ultimasLecturas
        });
      }
    );
  });
}

// 1. Registrar lectura individual (POST)
exports.registrarLectura = async (req, res) => {
  try {
    const { sensor_id, ubicacion, temperatura, humedad } = req.body;
    const sId = sensor_id ? types.Uuid.fromString(sensor_id) : types.Uuid.random();
    const fecha = new Date();

    const query = `INSERT INTO lecturas_sensor (sensor_id, fecha, ubicacion, temperatura, humedad) VALUES (?, ?, ?, ?, ?)`;
    const params = [sId, fecha, ubicacion, temperatura, humedad];

    await client.execute(query, params, { prepare: true });
    res.status(201).json({ status: 'success', message: 'Lectura registrada correctamente', data: { sensor_id: sId, fecha, ubicacion, temperatura, humedad } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// 2. Obtener historial reciente por sensor (GET /api/telemetria/:sensor_id)
exports.obtenerHistorialSensor = async (req, res) => {
  try {
    const { sensor_id } = req.params;
    const query = 'SELECT * FROM lecturas_sensor WHERE sensor_id = ? LIMIT 50';
    const result = await client.execute(query, [types.Uuid.fromString(sensor_id)], { prepare: true });
    
    res.json({ status: 'success', count: result.rows.length, data: result.rows });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// 3. Obtener estadísticas globales consolidadas (GET /api/estadisticas)
exports.obtenerEstadisticas = async (req, res) => {
  try {
    const query = 'SELECT * FROM lecturas_sensor';
    const metricas = await consultarMetricas(query);

    res.json({
      status: 'success',
      data: metricas
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.obtenerEstadisticasSensor = async (req, res) => {
  try {
    let sensorId;
    try {
      sensorId = types.Uuid.fromString(req.params.sensor_id);
    } catch (error) {
      return res.status(400).json({ status: 'error', message: 'El sensor_id debe ser un UUID válido.' });
    }

    const query = 'SELECT * FROM lecturas_sensor WHERE sensor_id = ?';
    const metricas = await consultarMetricas(query, [sensorId]);

    res.json({ status: 'success', data: metricas });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};