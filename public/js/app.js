const API_URL = '/cassandra';
const UMBRAL_ALERTA_TEMPERATURA = 75;
let temporizadorMensaje;
let solicitudHistorial = 0;
let solicitudEstadisticasSensor = 0;

document.getElementById('umbral-alerta').textContent = UMBRAL_ALERTA_TEMPERATURA;

function mostrarMensaje(texto, tipo = 'exito') {
    const elemento = document.getElementById('mensaje');
    clearTimeout(temporizadorMensaje);
    elemento.textContent = texto;
    elemento.className = tipo === 'error' ? 'mensaje-error' : 'mensaje-exito';

    temporizadorMensaje = setTimeout(() => {
        elemento.textContent = '';
        elemento.className = '';
    }, 4000);
}

function actualizarKpis(data) {
    document.getElementById('kpi-total').innerText = data.totalLecturas;
    document.getElementById('kpi-temp-prom').innerText = `${data.tempPromedio} °C`;
    document.getElementById('kpi-hum-prom').innerText = `${data.humPromedio} %`;
    document.getElementById('kpi-temp-ext').innerText = `${data.tempMax} / ${data.tempMin} °C`;
}

async function cargarEstadisticas() {
    const sensorSeleccionado = document.getElementById('filtro-sensor').value;
    if (sensorSeleccionado) {
        await Promise.all([
            cargarHistorialSensor(sensorSeleccionado),
            cargarEstadisticasSensor(sensorSeleccionado)
        ]);
        return;
    }

    try {
        const response = await fetch(`${API_URL}/estadisticas`);
        const result = await response.json();
        
        if (!response.ok || result.status !== 'success') {
            throw new Error(result.message || 'No se pudieron cargar las estadísticas.');
        }

        const data = result.data;
        actualizarSensores(data.sensoresUnicos || []);
        const sensorId = document.getElementById('filtro-sensor').value;
        if (sensorId) {
            await Promise.all([cargarHistorialSensor(sensorId), cargarEstadisticasSensor(sensorId)]);
        } else {
            solicitudEstadisticasSensor += 1;
            actualizarKpis(data);
            renderizarTabla(data.ultimasLecturas || []);
        }
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
        mostrarMensaje(error.message || 'No se pudieron cargar las estadísticas.', 'error');
    }
}

function actualizarSensores(sensores) {
    const filtro = document.getElementById('filtro-sensor');
    const seleccionActual = filtro.value;
    filtro.replaceChildren(new Option('Todos los sensores', ''));

    sensores.forEach(sensorId => {
        filtro.add(new Option(sensorId, sensorId));
    });

    if (sensores.includes(seleccionActual)) {
        filtro.value = seleccionActual;
    } else {
        filtro.value = '';
    }
}

async function cargarHistorialSensor(sensorId) {
    const solicitud = ++solicitudHistorial;

    try {
        const response = await fetch(`${API_URL}/telemetria/${encodeURIComponent(sensorId)}`);
        const result = await response.json();

        if (!response.ok || result.status !== 'success') {
            throw new Error(result.message || 'No se pudo cargar el historial del sensor.');
        }

        if (solicitud === solicitudHistorial && document.getElementById('filtro-sensor').value === sensorId) {
            renderizarTabla(result.data || []);
        }
    } catch (error) {
        if (solicitud === solicitudHistorial) {
            console.error('Error al cargar el historial del sensor:', error);
            mostrarMensaje(error.message || 'No se pudo cargar el historial del sensor.', 'error');
        }
    }
}

async function cargarEstadisticasSensor(sensorId) {
    const solicitud = ++solicitudEstadisticasSensor;

    try {
        const response = await fetch(`${API_URL}/estadisticas/${encodeURIComponent(sensorId)}`);
        const result = await response.json();

        if (!response.ok || result.status !== 'success') {
            throw new Error(result.message || 'No se pudieron cargar las estadísticas del sensor.');
        }

        if (solicitud === solicitudEstadisticasSensor && document.getElementById('filtro-sensor').value === sensorId) {
            actualizarKpis(result.data);
        }
    } catch (error) {
        if (solicitud === solicitudEstadisticasSensor) {
            console.error('Error al cargar las estadísticas del sensor:', error);
            mostrarMensaje(error.message || 'No se pudieron cargar las estadísticas del sensor.', 'error');
        }
    }
}

function renderizarTabla(lecturas) {
    const tbody = document.getElementById('tabla-lecturas');
    tbody.innerHTML = '';

    lecturas.forEach(item => {
        const tr = document.createElement('tr');
        const alerta = item.temperatura > UMBRAL_ALERTA_TEMPERATURA;

        tr.innerHTML = `
            <td>${item.sensor_id}</td>
            <td>${item.ubicacion || 'N/A'}</td>
            <td>${new Date(item.fecha).toLocaleString()}</td>
            <td>${item.temperatura} °C</td>
            <td>${item.humedad} %</td>
            <td>${alerta ? '<span class="badge-alert">⚠️ Alerta Temp</span>' : '<span class="badge-normal">Normal</span>'}</td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('filtro-sensor').addEventListener('change', event => {
    const sensorId = event.target.value;
    if (sensorId) {
        Promise.all([cargarHistorialSensor(sensorId), cargarEstadisticasSensor(sensorId)]);
    } else {
        solicitudHistorial += 1;
        solicitudEstadisticasSensor += 1;
        cargarEstadisticas();
    }
});

async function simularLectura() {
    const sensor_id = document.getElementById('input-sensor-id').value;
    const ubicacion = document.getElementById('input-ubicacion').value;
    const temperatura = parseFloat(document.getElementById('input-temp').value);
    const humedad = parseFloat(document.getElementById('input-hum').value);

    if (isNaN(temperatura) || isNaN(humedad) || !ubicacion) {
        mostrarMensaje('Complete temperatura, humedad y ubicación.', 'error');
        return;
    }

    const payload = {
        sensor_id: sensor_id || undefined,
        ubicacion,
        temperatura,
        humedad
    };

    try {
        const response = await fetch(`${API_URL}/telemetria`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.status === 'success') {
            // Limpiar inputs y recargar métricas
            document.getElementById('input-sensor-id').value = '';
            document.getElementById('input-ubicacion').value = '';
            document.getElementById('input-temp').value = '';
            document.getElementById('input-hum').value = '';
            mostrarMensaje('Lectura guardada correctamente.');
            cargarEstadisticas();
        } else {
            mostrarMensaje(result.message || 'No se pudo registrar la lectura.', 'error');
        }
    } catch (error) {
        console.error('Error en la petición POST:', error);
        mostrarMensaje('No se pudo conectar con el servidor.', 'error');
    }
}

// Cargar al iniciar y actualizar cada 10 segundos
cargarEstadisticas();
setInterval(cargarEstadisticas, 10000);