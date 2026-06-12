# 🚀 CanSat Ground Control Station (GCS)

## 📌 Overview

The CanSat Ground Control Station (GCS) is a real-time mission monitoring and control software developed for CanSat, CubeSat, and aerospace telemetry projects. It provides a professional mission-control environment for monitoring flight telemetry, visualizing sensor data, tracking GPS locations, analyzing mission status, and issuing remote commands during flight operations.

The system is designed to simulate a real satellite ground station and can be used for:

- CanSat Competitions
- CubeSat Demonstrations
- Aerospace Research Projects
- Telemetry Monitoring Systems
- Educational Satellite Programs
- Disaster Monitoring Payload Missions

---

## ✨ Features

### 📡 Real-Time Telemetry Monitoring

Monitor live flight parameters including:

- Altitude (m)
- Pressure (kPa)
- Temperature (°C)
- Humidity (%)
- Descent Rate (m/s)
- Battery Voltage (V)
- Signal Strength (RSSI)
- Packet Count

---

### 🔧 Payload Telemetry

Monitor payload subsystem information:

- Accelerometer X
- Accelerometer Y
- Accelerometer Z
- Packet ID
- Payload Status

---

### 🌍 GPS Tracking System

Features include:

- Real-time GPS location tracking
- Latitude and Longitude monitoring
- GPS Fix Status
- Satellite Count
- Flight Path Visualization
- Interactive OpenStreetMap Integration using Leaflet.js

---

### 📊 Live Telemetry Graphs

The system provides real-time graphical visualization of:

- Altitude vs Time
- Pressure vs Time
- Temperature vs Time
- Descent Rate vs Time
- Battery Voltage vs Time

Features:

- Live Updates
- Smooth Animations
- 60-Second Rolling Data Window
- Graph Export Capability

---

### ⚠ Error Detection System

A 4-digit error monitoring system continuously checks mission health.

| Digit | Function |
|---------|----------|
| D1 | Descent Rate Monitoring |
| D2 | GPS Availability |
| D3 | Payload Separation Status |
| D4 | Emergency Parachute Status |

The system provides visual alerts for abnormal conditions.

---

### 🚀 Mission Control Commands

The Ground Control Station supports command uplinks including:

#### Manual Separation
Triggers payload separation manually.

#### Emergency Parachute Deployment
Deploys backup parachute during emergencies.

#### Redundant System Activation
Activates backup mission systems.

---

### 🧭 Orientation Visualization

Artificial Horizon Display provides:

- Roll Angle
- Pitch Angle
- Yaw Angle

Useful for monitoring payload orientation during descent.

---

### 📹 Live Video Streaming

Integrated camera streaming system:

- Camera Selection
- Start / Stop Stream
- Live Mission Monitoring
- Browser-Based Video Feed

---

### 📋 Telemetry Logging

Mission telemetry is automatically logged with:

- Timestamps
- Sensor Readings
- GPS Data
- Mission Events

Export options:

- CSV Export
- Graph Export
- Post-Mission Analysis

---

## 🏗 Project Structure

CanSat-GCS/
│
├── index.html
│
├── css/
│   └── style.css
│
├── js/
│   └── gcs.js
│
├── assets/
│   ├── images/
│   └── icons/
│
├── data/
│   └── sample_telemetry.csv
│
└── README.md

---

## 🛠 Technologies Used

### Frontend

- HTML5
- CSS3
- JavaScript (ES6)

### Libraries

- Leaflet.js
- Chart.js

### APIs

- Camera API
- Geolocation API
- File Export API

---

## ⚙ Installation

### Clone Repository

```bash
git clone https://github.com/yourusername/cansat-gcs.git
```

### Navigate to Project Directory

```bash
cd cansat-gcs
```

### Run Local Server

Using Python:

```bash
python -m http.server 8000
```

or

```bash
python3 -m http.server 8000
```

### Open Browser

```text
http://localhost:8000
```

---

## 🎮 Usage

### Start Mission

1. Launch Ground Control Station
2. Connect telemetry source
3. Click START
4. Monitor live telemetry data

### Export Data

- Click "Export CSV" to save telemetry logs.
- Click "Export Graph" to save chart snapshots.

### GPS Tracking

As GPS packets are received:

- Map marker updates automatically.
- Flight path is drawn in real-time.

### Video Streaming

1. Select camera device.
2. Click "Stream".
3. Monitor live video feed.

---

## 📡 Supported Telemetry Parameters

| Parameter | Unit |
|------------|------|
| Altitude | m |
| Pressure | kPa |
| Temperature | °C |
| Humidity | % |
| Battery Voltage | V |
| RSSI | dBm |
| Roll | ° |
| Pitch | ° |
| Yaw | ° |
| Latitude | Decimal Degrees |
| Longitude | Decimal Degrees |

---

## 🎯 Applications

This Ground Control Station can be used for:

- CanSat Competitions
- CubeSat Simulations
- Aerospace Research
- Environmental Monitoring
- Disaster Management Payloads
- Educational Satellite Missions
- Telemetry Visualization Projects

---

## 🔮 Future Enhancements

Planned upgrades include:

- LoRa Telemetry Integration
- Serial Port Communication
- ESP32 Flight Computer Support
- AI-Based Failure Prediction
- 3D Flight Visualization
- Cloud Telemetry Storage
- Mobile Application Support

---


## 🌟 Mission Statement

"Empowering students and researchers to explore aerospace technology through real-time telemetry, mission control systems, and satellite-inspired engineering solutions."

🚀🛰️
