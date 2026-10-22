const cassandra = require('cassandra-driver');
require('dotenv').config();

const client = new cassandra.Client({
  contactPoints: [process.env.CASSANDRA_CONTACT_POINTS],
  localDataCenter: 'datacenter1',
  keyspace: process.env.CASSANDRA_KEYSPACE
});

client.connect()
  .then(() => console.log('✅ Conectado exitosamente a Apache Cassandra'))
  .catch((err) => console.error('❌ Error al conectar a Cassandra:', err));

module.exports = client;