const express = require('express');
const cors = require('cors');
const path = require('path');
const telemetriaRoutes = require('./routes/telemetria.routes');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rutas de la API
app.use('/api', telemetriaRoutes);
app.use('/cassandra', telemetriaRoutes);

// Servir el dashboard desde /cassandra
app.get('/cassandra', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});