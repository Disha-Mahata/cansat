/*
 * CanSat Ground Control Software - Arduino Telemetry Simulator
 * India Space Lab
 *
 * This sketch generates simulated CanSat telemetry packets
 * and transmits them via USB Serial at 9600 baud.
 *
 * Packet Format (CSV):
 * PacketID,Altitude,Pressure,Temperature,DescentRate,BatteryV,
 * GpsLat,GpsLon,GpsAlt,GpsFix,GpsSats,Roll,Pitch,Yaw,
 * Humidity,AccelX,AccelY,AccelZ,ErrorCode
 *
 * Upload to: Arduino Uno / Nano / Mega (WeGyanik Kit)
 */

#include <math.h>

// ── Configuration ─────────────────────────────────────────
#define BAUD_RATE      9600
#define PACKET_DELAY   1000   // ms between packets
#define TEAM_ID        "ISL01"

// ── State variables ───────────────────────────────────────
uint32_t packetID   = 0;
float    altitude   = 10.0;
float    pressure   = 101.3;
float    temperature= 28.0;
float    descentRate= 0.0;
float    batteryV   = 8.40;
float    gpsLat     = 28.6139;
float    gpsLon     = 77.2090;
float    roll       = 0.0;
float    pitch      = 0.0;
float    yaw        = 0.0;
float    humidity   = 45.0;
uint8_t  gpsFix     = 1;
uint8_t  gpsSats    = 8;
uint8_t  errorCode  = 0;  // 4-bit: descentRate|gps|payload|chute

// Phase: 0=ASCENDING, 1=PEAK, 2=DESCENDING, 3=LANDED
uint8_t  phase      = 0;
uint32_t phaseTimer = 0;
bool     payloadSep = false;

unsigned long lastPacket = 0;

// ── Helpers ───────────────────────────────────────────────
float noise(float range) {
  return ((float)random(-1000, 1000) / 1000.0) * range;
}

// ── Setup ─────────────────────────────────────────────────
void setup() {
  Serial.begin(BAUD_RATE);
  randomSeed(analogRead(A0));
  delay(1000);
  Serial.println("# CanSat GCS Telemetry Simulator - India Space Lab");
  Serial.println("# TeamID: " TEAM_ID);
  Serial.println("# PacketID,Altitude,Pressure,Temperature,DescentRate,BatteryV,GpsLat,GpsLon,GpsAlt,GpsFix,GpsSats,Roll,Pitch,Yaw,Humidity,AccelX,AccelY,AccelZ,ErrorCode");
}

// ── Loop ──────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();
  if (now - lastPacket < PACKET_DELAY) return;
  lastPacket = now;

  phaseTimer++;

  // Phase transitions
  switch (phase) {
    case 0: // ASCENDING
      if (altitude >= 800) { phase = 1; phaseTimer = 0; }
      break;
    case 1: // PEAK
      if (phaseTimer > 3) { phase = 2; phaseTimer = 0; payloadSep = true; }
      break;
    case 2: // DESCENDING
      if (altitude <= 2) { phase = 3; }
      break;
    case 3: // LANDED
      descentRate = 0;
      break;
  }

  // Update sensors
  switch (phase) {
    case 0:
      altitude    += 8.0 + noise(2.0);
      descentRate  = -8.0 + noise(0.5);
      pressure    -= 0.08 + noise(0.02);
      temperature -= 0.05 + noise(0.01);
      break;
    case 1:
      descentRate = noise(0.3);
      break;
    case 2:
      altitude    = max(0.0f, altitude - (9.0 + noise(0.8)));
      descentRate = 9.0 + noise(0.8);
      pressure   += 0.08 + noise(0.02);
      temperature += 0.04 + noise(0.01);
      break;
  }

  // GPS drift
  gpsLat += noise(0.0002);
  gpsLon += noise(0.0002);
  gpsFix  = (random(100) > 2) ? 1 : 0;
  gpsSats = 6 + random(5);

  // IMU
  float t = (float)now / 1000.0;
  roll  = sin(t / 3.0) * 15.0 + noise(5.0);
  pitch = sin(t / 4.0) * 8.0  + noise(3.0);
  yaw   = fmod(yaw + 0.5 + noise(0.2), 360.0);

  // Battery
  batteryV = max(6.0f, batteryV - 0.0005f);

  // Misc
  humidity = 45.0 + noise(5.0);

  float accelX = noise(2.0);
  float accelY = noise(2.0);
  float accelZ = 9.8  + noise(0.5);

  // Error codes (4-bit)
  uint8_t e1 = (phase == 2 && (descentRate < 8.0 || descentRate > 10.0)) ? 1 : 0;
  uint8_t e2 = gpsFix ? 0 : 1;
  uint8_t e3 = (phase >= 2 && !payloadSep) ? 1 : 0;
  uint8_t e4 = 0; // parachute not deployed in sim
  errorCode  = (e1 << 3) | (e2 << 2) | (e3 << 1) | e4;

  // Build error string
  char errStr[5];
  errStr[0] = '0' + e1;
  errStr[1] = '0' + e2;
  errStr[2] = '0' + e3;
  errStr[3] = '0' + e4;
  errStr[4] = '\0';

  // Transmit packet
  packetID++;
  Serial.print(packetID);         Serial.print(',');
  Serial.print(altitude, 2);      Serial.print(',');
  Serial.print(pressure, 3);      Serial.print(',');
  Serial.print(temperature, 2);   Serial.print(',');
  Serial.print(descentRate, 2);   Serial.print(',');
  Serial.print(batteryV, 3);      Serial.print(',');
  Serial.print(gpsLat, 6);        Serial.print(',');
  Serial.print(gpsLon, 6);        Serial.print(',');
  Serial.print(altitude, 2);      Serial.print(',');  // GPS altitude ≈ baro alt
  Serial.print(gpsFix);           Serial.print(',');
  Serial.print(gpsSats);          Serial.print(',');
  Serial.print(roll, 2);          Serial.print(',');
  Serial.print(pitch, 2);         Serial.print(',');
  Serial.print(yaw, 2);           Serial.print(',');
  Serial.print(humidity, 2);      Serial.print(',');
  Serial.print(accelX, 3);        Serial.print(',');
  Serial.print(accelY, 3);        Serial.print(',');
  Serial.print(accelZ, 3);        Serial.print(',');
  Serial.println(errStr);
}
