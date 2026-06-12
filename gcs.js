// ============================================================
//  CanSat Ground Control Software – Main JS
// ============================================================

const GCS = (() => {
  // ── State ────────────────────────────────────────────────
  let running = false;
  let missionStartTime = null;
  let packetCount = 0;
  let telemetryInterval = null;
  let clockInterval = null;

  // Current telemetry values
  let telem = {
    altitude: 500, pressure: 101.3, temperature: 22.5,
    descentRate: 0, batteryV: 8.4, gpsLat: 28.6139, gpsLon: 77.2090,
    gpsAlt: 500, gpsFix: 1, gpsNum: 8,
    roll: 0, pitch: 0, yaw: 0,
    humidity: 45, accelX: 0, accelY: 0, accelZ: 9.8,
    signalRSSI: -72, packetID: 0
  };

  // Mission phase: PRE_LAUNCH → ASCENDING → PEAK → DESCENDING → LANDED
  let phase = 'PRE_LAUNCH';
  let phaseTimer = 0;

  // Error codes [descentRate, gps, payload, parachute]
  let errors = [0, 0, 0, 0];
  let payloadSeparated = false;
  let parachuteDeployed = false;

  // GPS path history
  let gpsPath = [];
  let map = null, marker = null, pathLine = null;

  // Telemetry storage
  let telemLog = [];

  // Charts
  let charts = {};

  // ── DOM refs ─────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  // ── Init ─────────────────────────────────────────────────
  function init() {
    initMap();
    initCharts();
    initOrientation();
    initClock();
    bindButtons();
    updateErrorDisplay();
    logCmd('GCS SYSTEM INITIALIZED', 'ok');
    logCmd('Awaiting telemetry link...', 'warn');
    updatePacketCounter();
  }

  // ── Clock ────────────────────────────────────────────────
  function initClock() {
    clockInterval = setInterval(() => {
      if (running && missionStartTime) {
        const elapsed = Math.floor((Date.now() - missionStartTime) / 1000);
        const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
        const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
        const s = String(elapsed % 60).padStart(2, '0');
        $('mission-clock').textContent = `T+ ${h}:${m}:${s}`;
      } else {
        const now = new Date();
        $('mission-clock').textContent = now.toTimeString().slice(0, 8);
      }
    }, 1000);
  }

  // ── Map ──────────────────────────────────────────────────
  function initMap() {
    map = L.map('map', { zoomControl: true, attributionControl: false }).setView([telem.gpsLat, telem.gpsLon], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap'
    }).addTo(map);

    // Custom marker
    const icon = L.divIcon({
      className: '',
      html: `<div style="width:14px;height:14px;background:#00ffe7;border:2px solid #fff;border-radius:50%;box-shadow:0 0 10px #00ffe7;"></div>`,
      iconSize: [14, 14], iconAnchor: [7, 7]
    });

    marker = L.marker([telem.gpsLat, telem.gpsLon], { icon }).addTo(map);
    pathLine = L.polyline([], { color: '#00b4ff', weight: 2, opacity: 0.8 }).addTo(map);

    // Dark tile overlay
    map.getContainer().style.filter = 'hue-rotate(180deg) invert(1) brightness(0.7)';
  }

  function updateMap() {
    const pos = [telem.gpsLat, telem.gpsLon];
    marker.setLatLng(pos);
    gpsPath.push(pos);
    if (gpsPath.length > 200) gpsPath.shift();
    pathLine.setLatLngs(gpsPath);
    if (gpsPath.length === 1 || gpsPath.length % 30 === 0) map.panTo(pos);
    $('gps-lat').textContent = telem.gpsLat.toFixed(5);
    $('gps-lon').textContent = telem.gpsLon.toFixed(5);
    $('gps-fix').textContent = telem.gpsFix ? 'FIXED' : 'NO FIX';
    $('gps-fix').className = 'telem-value' + (telem.gpsFix ? '' : ' fault');
  }

  // ── Charts ───────────────────────────────────────────────
  const CHART_COLORS = {
    altitude: '#00b4ff',
    pressure: '#00ffe7',
    temperature: '#ff8c00',
    descentRate: '#ff2244',
    batteryV: '#00ff88'
  };
  const MAX_POINTS = 60;

  function makeDataset(label, color) {
    return {
      label,
      data: [],
      borderColor: color,
      backgroundColor: color + '18',
      borderWidth: 1.5,
      pointRadius: 0,
      fill: true,
      tension: 0.4
    };
  }

  function initCharts() {
    Chart.defaults.color = '#5a9fc0';
    Chart.defaults.borderColor = '#0d3a5c';
    Chart.defaults.font.family = "'Share Tech Mono', monospace";
    Chart.defaults.font.size = 10;

    const chartDefs = [
      { id: 'chart-altitude',    label: 'Altitude (m)',   key: 'altitude',    color: CHART_COLORS.altitude },
      { id: 'chart-pressure',    label: 'Pressure (kPa)', key: 'pressure',    color: CHART_COLORS.pressure },
      { id: 'chart-temperature', label: 'Temp (°C)',       key: 'temperature', color: CHART_COLORS.temperature },
      { id: 'chart-descent',     label: 'Descent (m/s)',  key: 'descentRate', color: CHART_COLORS.descentRate },
      { id: 'chart-battery',     label: 'Battery (V)',    key: 'batteryV',    color: CHART_COLORS.batteryV }
    ];

    chartDefs.forEach(({ id, label, key, color }) => {
      const ctx = $(id).getContext('2d');
      charts[key] = new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [makeDataset(label, color)]
        },
        options: {
          animation: false,
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { display: false },
            y: {
              grid: { color: '#0d3a5c55' },
              ticks: { maxTicksLimit: 4 }
            }
          }
        }
      });
    });
  }

  function pushChart(key, value) {
    const chart = charts[key];
    const ts = new Date().toLocaleTimeString();
    chart.data.labels.push(ts);
    chart.data.datasets[0].data.push(value);
    if (chart.data.labels.length > MAX_POINTS) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }
    chart.update('none');
  }

  // ── Orientation (Canvas 2D Artificial Horizon) ───────────
  let orientCanvas, orientCtx;

  function initOrientation() {
    orientCanvas = $('orient-canvas');
    orientCtx = orientCanvas.getContext('2d');
    drawHorizon(0, 0, 0);
  }

  function drawHorizon(roll, pitch, yaw) {
    const c = orientCtx;
    const w = orientCanvas.width, h = orientCanvas.height;
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 8;

    c.clearRect(0, 0, w, h);

    // Clip to circle
    c.save();
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip();

    // Horizon
    c.save();
    c.translate(cx, cy);
    c.rotate(roll * Math.PI / 180);
    const pitchOffset = (pitch / 90) * r;

    // Sky
    c.fillStyle = '#001a40';
    c.fillRect(-r, -r - pitchOffset, r * 2, r + pitchOffset);

    // Ground
    c.fillStyle = '#3a1a00';
    c.fillRect(-r, -pitchOffset, r * 2, r + pitchOffset);

    // Horizon line
    c.strokeStyle = '#ffffff'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-r, -pitchOffset); c.lineTo(r, -pitchOffset); c.stroke();

    // Pitch lines
    for (let i = -4; i <= 4; i++) {
      if (i === 0) continue;
      const y = -pitchOffset - (i * r / 4);
      const lw = (i % 2 === 0) ? r * 0.5 : r * 0.25;
      c.strokeStyle = '#ffffff80'; c.lineWidth = 0.5;
      c.beginPath(); c.moveTo(-lw / 2, y); c.lineTo(lw / 2, y); c.stroke();
    }

    c.restore();

    // Outer ring
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2);
    c.strokeStyle = '#00b4ff'; c.lineWidth = 2; c.stroke();

    // Roll indicator (triangle at top)
    c.save(); c.translate(cx, cy); c.rotate(roll * Math.PI / 180);
    c.fillStyle = '#00ffe7';
    c.beginPath(); c.moveTo(0, -r + 4); c.lineTo(-5, -r + 14); c.lineTo(5, -r + 14); c.closePath(); c.fill();
    c.restore();

    // Center crosshair
    c.strokeStyle = '#ffffff'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(cx - 20, cy); c.lineTo(cx - 8, cy); c.stroke();
    c.beginPath(); c.moveTo(cx + 8, cy); c.lineTo(cx + 20, cy); c.stroke();
    c.beginPath(); c.moveTo(cx, cy - 5); c.lineTo(cx, cy + 5); c.stroke();

    // Yaw compass ring (bottom)
    c.restore();
    c.save();
    c.translate(cx, cy);
    const yawR = r + 4;
    c.strokeStyle = '#00b4ff40'; c.lineWidth = 1;
    c.beginPath(); c.arc(0, 0, yawR, 0, Math.PI * 2); c.stroke();
    // Yaw needle
    const yawAngle = (yaw * Math.PI / 180) - Math.PI / 2;
    c.strokeStyle = '#ff2244'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(yawAngle) * yawR, Math.sin(yawAngle) * yawR); c.stroke();
    c.restore();
  }

  // ── Telemetry Simulation ─────────────────────────────────
  function simulateTelemetry() {
    phaseTimer++;

    // Phase progression
    if (phase === 'PRE_LAUNCH' && phaseTimer > 5) {
      phase = 'ASCENDING'; phaseTimer = 0;
      logCmd('Phase: ASCENDING', 'ok');
    } else if (phase === 'ASCENDING' && telem.altitude >= 800) {
      phase = 'PEAK'; phaseTimer = 0;
      logCmd('Phase: PEAK ALTITUDE', 'ok');
    } else if (phase === 'PEAK' && phaseTimer > 3) {
      phase = 'DESCENDING'; phaseTimer = 0;
      logCmd('Phase: DESCENDING', 'ok');
      if (!payloadSeparated) {
        payloadSeparated = true;
        logCmd('Payload separation: OK', 'ok');
        errors[2] = 0;
      }
    } else if (phase === 'DESCENDING' && telem.altitude <= 5) {
      phase = 'LANDED'; phaseTimer = 0;
      logCmd('Phase: LANDED', 'ok');
      running = false;
      updateMissionStatus('LANDED', 'active');
    }

    // Simulate sensor values based on phase
    const noise = () => (Math.random() - 0.5) * 0.4;

    if (phase === 'ASCENDING') {
      telem.altitude += 8 + noise() * 2;
      telem.descentRate = -8 - noise();
      telem.pressure -= 0.08 + noise() * 0.02;
      telem.temperature -= 0.05 + noise() * 0.01;
    } else if (phase === 'PEAK') {
      telem.descentRate = noise();
    } else if (phase === 'DESCENDING') {
      const rate = parachuteDeployed ? 3 + noise() * 0.5 : 9 + noise() * 0.8;
      telem.altitude = Math.max(0, telem.altitude - rate);
      telem.descentRate = rate;
      telem.pressure += 0.08 + noise() * 0.02;
      telem.temperature += 0.04 + noise() * 0.01;
    } else if (phase === 'LANDED') {
      telem.descentRate = 0;
    }

    // GPS wander
    telem.gpsLat += (Math.random() - 0.5) * 0.0002;
    telem.gpsLon += (Math.random() - 0.5) * 0.0002;
    telem.gpsAlt = telem.altitude;
    telem.gpsFix = Math.random() > 0.02 ? 1 : 0;
    telem.gpsNum = 6 + Math.floor(Math.random() * 4);

    // IMU
    telem.roll  = Math.sin(Date.now() / 3000) * 15 + noise() * 5;
    telem.pitch = Math.sin(Date.now() / 4000) * 8 + noise() * 3;
    telem.yaw  += 0.5 + noise() * 0.2;
    if (telem.yaw > 360) telem.yaw -= 360;

    // Battery drain
    telem.batteryV = Math.max(6.0, telem.batteryV - 0.0005);

    // Humidity & accel
    telem.humidity = 45 + noise() * 5;
    telem.accelX = noise() * 2; telem.accelY = noise() * 2;
    telem.accelZ = 9.8 + noise();
    telem.signalRSSI = -65 - Math.random() * 20;
    telem.packetID = ++packetCount;

    // Error code logic
    errors[0] = (phase === 'DESCENDING' && (telem.descentRate < 8 || telem.descentRate > 10) && !parachuteDeployed) ? 1 : 0;
    errors[1] = telem.gpsFix ? 0 : 1;
    errors[2] = (phase === 'DESCENDING' || phase === 'LANDED') ? 0 : (payloadSeparated ? 0 : 0);
    errors[3] = parachuteDeployed ? 1 : 0;

    // Store log
    telemLog.push({ ...telem, ts: Date.now() });
    if (telemLog.length > 5000) telemLog.shift();

    updateDisplay();
    updateMap();
    updateCharts();
    updateOrientation();
    updateErrorDisplay();
    updatePacketCounter();
    updateSignal();
    appendTelemLog();
  }

  function updateDisplay() {
    const set = (id, val, unit) => {
      const el = $(id);
      if (!el) return;
      el.textContent = typeof val === 'number' ? val.toFixed(2) : val;
      const field = el.closest('.telem-field');
      if (field) {
        field.classList.add('updated');
        setTimeout(() => field.classList.remove('updated'), 300);
      }
    };

    set('tval-altitude',   telem.altitude);
    set('tval-pressure',   telem.pressure);
    set('tval-temperature',telem.temperature);
    set('tval-descent',    telem.descentRate);
    set('tval-battery',    telem.batteryV);
    set('tval-humidity',   telem.humidity);
    set('tval-accelx',     telem.accelX);
    set('tval-accely',     telem.accelY);
    set('tval-accelz',     telem.accelZ);
    set('tval-rssi',       telem.signalRSSI);
    set('tval-packetid',   telem.packetID);
    set('tval-phase',      phase);

    // Battery bar
    const pct = Math.max(0, Math.min(100, ((telem.batteryV - 6) / 2.4) * 100));
    const fill = $('battery-fill');
    if (fill) {
      fill.style.width = pct + '%';
      fill.className = 'battery-fill' + (pct < 20 ? ' critical' : pct < 40 ? ' low' : '');
    }
    $('battery-pct').textContent = pct.toFixed(0) + '%';
  }

  function updateCharts() {
    pushChart('altitude',    telem.altitude);
    pushChart('pressure',    telem.pressure);
    pushChart('temperature', telem.temperature);
    pushChart('descentRate', telem.descentRate);
    pushChart('batteryV',    telem.batteryV);
  }

  function updateOrientation() {
    drawHorizon(telem.roll, telem.pitch, telem.yaw);
    const fmt = v => (v >= 0 ? '+' : '') + v.toFixed(1) + '°';
    $('val-roll').textContent  = fmt(telem.roll);
    $('val-pitch').textContent = fmt(telem.pitch);
    $('val-yaw').textContent   = telem.yaw.toFixed(1) + '°';
  }

  function updateErrorDisplay() {
    const codes = ['e1', 'e2', 'e3', 'e4'];
    const labels = ['DESCENT RATE', 'GPS AVAIL', 'PAYLOAD SEP', 'EMRG CHUTE'];
    const ok_msgs = ['8-10 m/s OK', 'GPS FIXED', 'SEPARATED', 'INACTIVE'];
    const err_msgs = ['RATE FAULT', 'GPS LOST', 'SEP FAILURE', 'ACTIVATED'];

    errors.forEach((e, i) => {
      const digit = $('err-d' + (i + 1));
      const item  = $('err-item' + (i + 1));
      if (digit) {
        digit.textContent = e;
        digit.className = 'error-digit ' + (e ? 'fault' : 'ok');
      }
      if (item) {
        item.className = 'error-item ' + (e ? 'fault' : 'ok');
        const s = item.querySelector('.e-status');
        if (s) s.textContent = e ? err_msgs[i] : ok_msgs[i];
      }
    });

    // Overall code display
    const codeStr = errors.join('');
    $('error-code-full').textContent = codeStr;
    $('error-code-full').style.color = codeStr === '0000' ? 'var(--accent-green)' : 'var(--accent-red)';
  }

  function updateSignal() {
    const quality = Math.max(0, Math.min(4, Math.round((telem.signalRSSI + 90) / 10)));
    document.querySelectorAll('.signal-bar').forEach((bar, i) => {
      bar.style.height = (8 + i * 3) + 'px';
      bar.classList.toggle('active', i <= quality);
    });
    $('rssi-val').textContent = telem.signalRSSI.toFixed(0) + ' dBm';
  }

  function updatePacketCounter() {
    $('pkt-count').textContent = packetCount;
  }

  function appendTelemLog() {
    const log = $('telem-log');
    const ts = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.textContent = `[${ts}] PKT#${telem.packetID} ALT:${telem.altitude.toFixed(1)}m PRESS:${telem.pressure.toFixed(2)}kPa TEMP:${telem.temperature.toFixed(1)}°C RATE:${telem.descentRate.toFixed(2)}m/s BAT:${telem.batteryV.toFixed(2)}V`;
    log.appendChild(line);
    if (log.children.length > 50) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }

  function updateMissionStatus(label, type) {
    const el = $('mission-status');
    el.textContent = label;
    el.className = 'status-pill ' + type;
  }

  // ── Command Logging ──────────────────────────────────────
  function logCmd(msg, type = '') {
    const log = $('cmd-log');
    const entry = document.createElement('div');
    entry.className = 'log-entry ' + type;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    log.appendChild(entry);
    if (log.children.length > 30) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }

  // ── Button Bindings ──────────────────────────────────────
  function bindButtons() {
    // Telemetry Start/Stop
    $('btn-start').onclick = () => {
      if (running) return;
      running = true;
      missionStartTime = missionStartTime || Date.now();
      phase = 'ASCENDING';
      packetCount = 0;
      telemLog = [];
      gpsPath = [];
      pathLine.setLatLngs([]);
      telem.altitude = 10; telem.pressure = 101.3; telem.temperature = 28;
      telem.batteryV = 8.4; payloadSeparated = false; parachuteDeployed = false;
      errors = [0, 0, 0, 0];
      updateMissionStatus('ACTIVE', 'active');
      telemetryInterval = setInterval(simulateTelemetry, 1000);
      logCmd('Telemetry stream STARTED', 'ok');
    };

    $('btn-stop').onclick = () => {
      if (!running) return;
      running = false;
      clearInterval(telemetryInterval);
      updateMissionStatus('STANDBY', 'standby');
      logCmd('Telemetry stream STOPPED', 'warn');
    };

    $('btn-export-csv').onclick = exportCSV;
    $('btn-export-graph').onclick = exportGraph;

    $('btn-sync-time').onclick = () => {
      missionStartTime = Date.now();
      logCmd('PC time synced', 'ok');
    };

    $('btn-reset-pkt').onclick = () => {
      packetCount = 0;
      telemLog = [];
      updatePacketCounter();
      logCmd('Packet counter reset', 'warn');
    };

    // Mission commands
    $('cmd-sep').onclick = () => {
      if (!running) { logCmd('ERROR: Telemetry not active', 'error'); return; }
      payloadSeparated = true;
      errors[2] = 0;
      updateErrorDisplay();
      logCmd('CMD: Manual Separation EXECUTED', 'ok');
      setCmdStatus('cmd-sep', 'EXECUTED');
    };

    $('cmd-chute').onclick = () => {
      if (!running) { logCmd('ERROR: Telemetry not active', 'error'); return; }
      parachuteDeployed = true;
      errors[3] = 1;
      updateErrorDisplay();
      logCmd('CMD: Emergency Parachute DEPLOYED', 'warn');
      setCmdStatus('cmd-chute', 'DEPLOYED');
    };

    $('cmd-redun').onclick = () => {
      if (!running) { logCmd('ERROR: Telemetry not active', 'error'); return; }
      logCmd('CMD: Redundant Activation SENT', 'ok');
      setCmdStatus('cmd-redun', 'ACTIVATED');
    };

    // Video
    $('btn-cam-start').onclick = startCamera;
    $('btn-cam-stop').onclick  = stopCamera;
  }

  function setCmdStatus(id, text) {
    const btn = $(id);
    const s = btn.querySelector('.cmd-status');
    if (s) { s.textContent = text; s.style.color = 'var(--accent-green)'; }
  }

  // ── CSV Export ───────────────────────────────────────────
  function exportCSV() {
    if (!telemLog.length) { logCmd('No telemetry data to export', 'warn'); return; }
    const headers = ['timestamp','packetID','altitude','pressure','temperature','descentRate','batteryV',
                     'gpsLat','gpsLon','gpsAlt','gpsFix','gpsNum','roll','pitch','yaw',
                     'humidity','accelX','accelY','accelZ','signalRSSI'];
    const rows = telemLog.map(t =>
      headers.map(h => {
        if (h === 'timestamp') return new Date(t.ts).toISOString();
        return typeof t[h] === 'number' ? t[h].toFixed(4) : (t[h] ?? '');
      }).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    download('cansat_telemetry.csv', csv, 'text/csv');
    logCmd(`CSV exported: ${telemLog.length} packets`, 'ok');
  }

  // ── Graph Export ─────────────────────────────────────────
  function exportGraph() {
    const chartKeys = ['altitude', 'pressure', 'temperature', 'descentRate', 'batteryV'];
    const anyKey = chartKeys.find(k => charts[k]);
    if (!anyKey) { logCmd('No chart data available', 'warn'); return; }
    const url = charts[anyKey].toBase64Image();
    const a = document.createElement('a');
    a.href = url; a.download = 'cansat_chart.png'; a.click();
    logCmd('Graph exported (altitude chart)', 'ok');
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Camera ───────────────────────────────────────────────
  let camStream = null;

  async function startCamera() {
    try {
      const deviceId = $('cam-select').value;
      const constraints = { video: deviceId ? { deviceId: { exact: deviceId } } : true };
      camStream = await navigator.mediaDevices.getUserMedia(constraints);
      const video = $('cam-video');
      video.srcObject = camStream; video.play(); video.style.display = 'block';
      $('video-placeholder').style.display = 'none';
      $('stream-status').textContent = 'LIVE'; $('stream-status').className = 'stream-status live';
      logCmd('Camera stream started', 'ok');
      await populateCameras();
    } catch (e) {
      logCmd('Camera error: ' + e.message, 'error');
    }
  }

  function stopCamera() {
    if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
    const video = $('cam-video');
    video.style.display = 'none'; video.srcObject = null;
    $('video-placeholder').style.display = 'flex';
    $('stream-status').textContent = 'OFFLINE'; $('stream-status').className = 'stream-status';
    logCmd('Camera stream stopped', 'warn');
  }

  async function populateCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter(d => d.kind === 'videoinput');
      const sel = $('cam-select');
      sel.innerHTML = cams.map((c, i) => `<option value="${c.deviceId}">${c.label || 'Camera ' + (i + 1)}</option>`).join('');
    } catch (e) {}
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', GCS.init);
