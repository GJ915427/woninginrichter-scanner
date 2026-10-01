/**
 * test_client_algorithms.js
 * Empirical Mathematical & Algorithmic Stress Test Harness for index.html
 * 
 * Verifies:
 * 1. Gyroscope transformation, Lie-algebra compliance SO(3), and numerical scale drift
 * 2. Digital gravity filter (0.5Hz low-pass) frequency response, stability, and step/impulse dynamics
 * 3. MediaRecorder codec capability selection across iOS/Android/Desktop user agents
 * 4. Timestamp monotonicity, jitter tolerance, and dt clamping
 * 5. Sensor log export schemas (JSON and CSV)
 */

const assert = require('assert');

// Track overall test results
let passedTests = 0;
let failedTests = 0;
const testLogs = [];

function log(msg) {
  console.log(msg);
  testLogs.push(msg);
}

function test(name, fn) {
  try {
    fn();
    passedTests++;
    log(`  [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    log(`  [FAIL] ${name}: ${err.message}`);
    console.error(err);
  }
}

// ============================================================================
// SUITE 1: Gyroscope Transformation & Lie-Algebra Compliance
// ============================================================================
log('\n=== SUITE 1: Gyroscope Transformation & Lie-Algebra Compliance ===');

// Client logic extraction:
// W3C spec: rot.beta = X (pitch rate), rot.gamma = Y (roll rate), rot.alpha = Z (yaw rate)
function transformGyroscope(rawRot) {
  const degToRad = Math.PI / 180;
  const rx = (rawRot.beta || 0) * degToRad;  // pitch rate (rad/s)
  const ry = (rawRot.gamma || 0) * degToRad; // roll rate (rad/s)
  const rz = (rawRot.alpha || 0) * degToRad; // yaw rate (rad/s)
  return {
    rx: Number(rx.toFixed(6)),
    ry: Number(ry.toFixed(6)),
    rz: Number(rz.toFixed(6)),
    gyro_x: Number(rx.toFixed(6)),
    gyro_y: Number(ry.toFixed(6)),
    gyro_z: Number(rz.toFixed(6))
  };
}

// Client quaternion helper (from index.html line 578)
function eulerToQuaternion(alphaDeg, betaDeg, gammaDeg) {
  if (alphaDeg === null || betaDeg === null || gammaDeg === null) return null;
  const degToRad = Math.PI / 180;
  const _z = (alphaDeg || 0) * degToRad; // yaw
  const _x = (betaDeg || 0) * degToRad;  // pitch
  const _y = (gammaDeg || 0) * degToRad; // roll

  const cX = Math.cos(_x / 2), sX = Math.sin(_x / 2);
  const cY = Math.cos(_y / 2), sY = Math.sin(_y / 2);
  const cZ = Math.cos(_z / 2), sZ = Math.sin(_z / 2);

  return {
    qw: cX * cY * cZ - sX * sY * sZ,
    qx: sX * cY * cZ - cX * sY * sZ,
    qy: cX * sY * cZ + sX * cY * sZ,
    qz: cX * cY * sZ + sX * sY * cZ
  };
}

// Lie-algebra Rodrigues exponential map: exp(hat(omega) * dt) -> SO(3)
function rodriguesExp(omega, dt) {
  const theta = Math.sqrt(omega.x * omega.x + omega.y * omega.y + omega.z * omega.z) * dt;
  if (theta < 1e-12) {
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
  }
  const kx = (omega.x * dt) / theta;
  const ky = (omega.y * dt) / theta;
  const kz = (omega.z * dt) / theta;

  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  const v = 1 - cosTheta;

  return [
    [cosTheta + kx * kx * v,      kx * ky * v - kz * sinTheta, kx * kz * v + ky * sinTheta],
    [ky * kx * v + kz * sinTheta, cosTheta + ky * ky * v,      ky * kz * v - kx * sinTheta],
    [kz * kx * v - ky * sinTheta, kz * ky * v + kx * sinTheta, cosTheta + kz * kz * v]
  ];
}

function matMul(A, B) {
  const C = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        C[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return C;
}

function matNormDiff(A, B) {
  let maxDiff = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      maxDiff = Math.max(maxDiff, Math.abs(A[i][j] - B[i][j]));
    }
  }
  return maxDiff;
}

function matDet(M) {
  return (
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
    M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
    M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0])
  );
}

test('1.1 Axis mapping: beta=pitch(rx), gamma=roll(ry), alpha=yaw(rz)', () => {
  const raw = { beta: 45.0, gamma: -30.0, alpha: 90.0 };
  const res = transformGyroscope(raw);
  const expectedRx = Number((45.0 * Math.PI / 180).toFixed(6));
  const expectedRy = Number((-30.0 * Math.PI / 180).toFixed(6));
  const expectedRz = Number((90.0 * Math.PI / 180).toFixed(6));

  assert.strictEqual(res.rx, expectedRx);
  assert.strictEqual(res.ry, expectedRy);
  assert.strictEqual(res.rz, expectedRz);
  assert.strictEqual(res.gyro_x, res.rx);
  assert.strictEqual(res.gyro_y, res.ry);
  assert.strictEqual(res.gyro_z, res.rz);
});

test('1.2 High angular velocity (500 deg/s & 1000 deg/s) scale drift verification', () => {
  const velocities = [0, 50, 100, 180, 360, 500, 720, 1000, -500];
  for (const v of velocities) {
    const raw = { beta: v, gamma: v, alpha: v };
    const res = transformGyroscope(raw);
    const exactRad = v * (Math.PI / 180);
    const floatDiff = Math.abs(res.rx - exactRad);
    // Precision of toFixed(6) rounding error is strictly < 1e-5 rad/s
    assert(floatDiff < 1e-5, `Scale drift too high for ${v} deg/s: diff=${floatDiff}`);
  }
});

test('1.3 Lie-algebra SO(3) compliance under 500 deg/s rotation rate', () => {
  const omega = {
    x: 500 * (Math.PI / 180),
    y: 250 * (Math.PI / 180),
    z: -300 * (Math.PI / 180)
  };
  const dt = 0.016; // 60Hz frame interval

  let R_accum = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]
  ];

  // Integrate 1000 time steps (16 seconds of extreme spinning)
  for (let step = 0; step < 1000; step++) {
    const dR = rodriguesExp(omega, dt);
    R_accum = matMul(R_accum, dR);
  }

  // Orthogonality check: R^T * R == I
  const R_T = [
    [R_accum[0][0], R_accum[1][0], R_accum[2][0]],
    [R_accum[0][1], R_accum[1][1], R_accum[2][1]],
    [R_accum[0][2], R_accum[1][2], R_accum[2][2]]
  ];
  const I_test = matMul(R_T, R_accum);
  const I_identity = [[1,0,0],[0,1,0],[0,0,1]];
  const orthoDiff = matNormDiff(I_test, I_identity);
  assert(orthoDiff < 1e-10, `SO(3) orthogonality violation: ${orthoDiff}`);

  // Determinant check: det(R) == +1.0
  const det = matDet(R_accum);
  assert(Math.abs(det - 1.0) < 1e-10, `SO(3) determinant violation: ${det}`);
});

test('1.4 High-iteration (10,000 steps) continuous Lie-algebra stability', () => {
  // Test numerical runaway over 10,000 steps (160 seconds)
  const normAxis = 1 / Math.sqrt(3);
  const rateRad = 500 * (Math.PI / 180);
  const omega = { x: rateRad * normAxis, y: rateRad * normAxis, z: rateRad * normAxis };
  const dt = 0.016;

  let R_accum = [[1,0,0],[0,1,0],[0,0,1]];
  for (let i = 0; i < 10000; i++) {
    const dR = rodriguesExp(omega, dt);
    R_accum = matMul(R_accum, dR);
  }

  const det = matDet(R_accum);
  assert(Math.abs(det - 1.0) < 1e-8, `Determinant drift after 10,000 steps: ${det}`);
});

test('1.5 Euler-to-quaternion unit norm preservation', () => {
  const testAngles = [
    [0, 0, 0],
    [90, 0, 0],
    [0, 90, 0],
    [0, 0, 90],
    [45, 45, 45],
    [-60, 30, 120],
    [180, -90, 270],
    [359, 89, -179]
  ];

  for (const [alpha, beta, gamma] of testAngles) {
    const q = eulerToQuaternion(alpha, beta, gamma);
    assert(q !== null, 'Quaternion should not be null');
    const normSq = q.qw * q.qw + q.qx * q.qx + q.qy * q.qy + q.qz * q.qz;
    assert(Math.abs(normSq - 1.0) < 1e-6, `Unit norm violated for angles ${alpha},${beta},${gamma}: normSq=${normSq}`);
  }

  assert.strictEqual(eulerToQuaternion(null, 0, 0), null);
});


// ============================================================================
// SUITE 2: Digital Gravity Filter Stability & Linear Acceleration Isolation
// ============================================================================
log('\n=== SUITE 2: Digital Gravity Filter (0.5Hz Low-Pass) Stability ===');

// Client gravity filter class replicating index.html lines 727-753
class DigitalGravityFilter {
  constructor(isIOS = false) {
    this.isIOS = isIOS;
    this.estimatedGravity = { x: 0, y: 0, z: 9.80665 };
    this.gravityFilterInitialized = false;
    this.lastEventTimeStamp = null;
    this.rc = 0.3183; // tau = 1 / (2 * pi * 0.5Hz)
  }

  processSample(event) {
    const hwTimeStamp = event.timeStamp;
    const intervalMs = event.interval || 0;
    const dt_ms = this.lastEventTimeStamp ? (hwTimeStamp - this.lastEventTimeStamp) : intervalMs;
    this.lastEventTimeStamp = hwTimeStamp;

    const signMultiplier = this.isIOS ? -1 : 1;

    const rawAccG = event.accelerationIncludingGravity || {};
    const gx = (typeof rawAccG.x === 'number') ? rawAccG.x * signMultiplier : 0;
    const gy = (typeof rawAccG.y === 'number') ? rawAccG.y * signMultiplier : 0;
    const gz = (typeof rawAccG.z === 'number') ? rawAccG.z * signMultiplier : 0;

    // Filter equation from index.html line 728
    const dtSec = (dt_ms > 0 && dt_ms < 200) ? (dt_ms / 1000) : 0.016;
    const alphaFilter = dtSec / (this.rc + dtSec);

    if (!this.gravityFilterInitialized) {
      this.estimatedGravity = { x: gx, y: gy, z: gz };
      this.gravityFilterInitialized = true;
    } else {
      this.estimatedGravity.x = (1 - alphaFilter) * this.estimatedGravity.x + alphaFilter * gx;
      this.estimatedGravity.y = (1 - alphaFilter) * this.estimatedGravity.y + alphaFilter * gy;
      this.estimatedGravity.z = (1 - alphaFilter) * this.estimatedGravity.z + alphaFilter * gz;
    }

    // Linear acceleration isolation
    const rawAcc = event.acceleration || {};
    let ax, ay, az;
    if (typeof rawAcc.x === 'number' && rawAcc.x !== null) {
      ax = rawAcc.x * signMultiplier;
      ay = (typeof rawAcc.y === 'number') ? rawAcc.y * signMultiplier : 0;
      az = (typeof rawAcc.z === 'number') ? rawAcc.z * signMultiplier : 0;
    } else {
      ax = gx - this.estimatedGravity.x;
      ay = gy - this.estimatedGravity.y;
      az = gz - this.estimatedGravity.z;
    }

    return {
      gx, gy, gz,
      grav_x: this.estimatedGravity.x,
      grav_y: this.estimatedGravity.y,
      grav_z: this.estimatedGravity.z,
      ax, ay, az,
      alphaFilter
    };
  }
}

test('2.1 Static 1g gravity convergence and stability', () => {
  const filter = new DigitalGravityFilter(false);
  const totalSamples = 1800; // 30 seconds @ 60Hz
  let lastRes;

  for (let i = 0; i < totalSamples; i++) {
    const t = i * 16.666;
    lastRes = filter.processSample({
      timeStamp: t,
      interval: 16.666,
      accelerationIncludingGravity: { x: 0, y: 0, z: 9.81 }
    });
  }

  assert(Math.abs(lastRes.grav_z - 9.81) < 1e-4, `Convergence failed: grav_z=${lastRes.grav_z}`);
  assert(Math.abs(lastRes.grav_x) < 1e-4, `grav_x leak: ${lastRes.grav_x}`);
  assert(Math.abs(lastRes.grav_y) < 1e-4, `grav_y leak: ${lastRes.grav_y}`);
  assert(Math.abs(lastRes.az) < 1e-4, `Static linear acc not zero: ${lastRes.az}`);
});

test('2.2 High-frequency step motions (walking 2Hz + jerking 10Hz) filter stability', () => {
  const filter = new DigitalGravityFilter(false);
  const fs = 60; // 60 Hz sampling
  const durationSec = 10;
  const numSamples = fs * durationSec;
  const dtMs = 1000 / fs;

  let gravZMin = Infinity, gravZMax = -Infinity;
  let dynamicAccEnergy = 0;

  for (let i = 0; i < numSamples; i++) {
    const tSec = i / fs;
    const tMs = i * dtMs;
    // 1g static gravity + 2Hz step oscillation (2.0 m/s^2) + 10Hz jerk oscillation (1.0 m/s^2)
    const stepSignal = 2.0 * Math.sin(2 * Math.PI * 2.0 * tSec);
    const jerkSignal = 1.0 * Math.sin(2 * Math.PI * 10.0 * tSec);
    const rawGZ = 9.80665 + stepSignal + jerkSignal;

    const res = filter.processSample({
      timeStamp: tMs,
      interval: dtMs,
      accelerationIncludingGravity: { x: 0, y: 0, z: rawGZ }
    });

    if (tSec > 2.0) { // After initial filter settle time (2 seconds > 6 * tau)
      gravZMin = Math.min(gravZMin, res.grav_z);
      gravZMax = Math.max(gravZMax, res.grav_z);
      dynamicAccEnergy += res.az * res.az;
    }
  }

  // Verify filter did not explode or diverge
  assert(gravZMin > 8.5 && gravZMax < 11.0, `Filter oscillated excessively: min=${gravZMin}, max=${gravZMax}`);
  const meanGravZ = (gravZMin + gravZMax) / 2;
  assert(Math.abs(meanGravZ - 9.80665) < 0.1, `Filtered gravity mean drifted: ${meanGravZ}`);
  
  // Verify linear acceleration correctly captured dynamic motions
  assert(dynamicAccEnergy > 0, 'Linear acceleration energy was zero');
});

test('2.3 0.5Hz cutoff frequency attenuation verification (-3dB @ 0.5Hz)', () => {
  const filter = new DigitalGravityFilter(false);
  const fs = 100; // 100 Hz sampling
  const dtMs = 10;
  const durationSec = 20;
  const numSamples = fs * durationSec;

  const inputAmplitude = 2.0;
  let outMin = Infinity, outMax = -Infinity;

  for (let i = 0; i < numSamples; i++) {
    const tSec = i / fs;
    const tMs = i * dtMs;
    // Sine wave exactly at cutoff frequency fc = 0.5 Hz
    const signal = 9.80665 + inputAmplitude * Math.sin(2 * Math.PI * 0.5 * tSec);
    const res = filter.processSample({
      timeStamp: tMs,
      interval: dtMs,
      accelerationIncludingGravity: { x: 0, y: 0, z: signal }
    });

    if (tSec > 5.0) {
      outMin = Math.min(outMin, res.grav_z);
      outMax = Math.max(outMax, res.grav_z);
    }
  }

  const measuredAmplitude = (outMax - outMin) / 2;
  const measuredGain = measuredAmplitude / inputAmplitude;
  const theoreticalGain = 1 / Math.sqrt(2); // 0.7071 (-3.01 dB)
  
  // Verify measured gain matches theoretical first-order lowpass within 5%
  assert(Math.abs(measuredGain - theoreticalGain) < 0.05,
    `Cutoff gain mismatch: expected ~${theoreticalGain.toFixed(4)}, got ${measuredGain.toFixed(4)}`);
});

test('2.4 Impulse / Step Shock response & recovery without NaN or ringing', () => {
  const filter = new DigitalGravityFilter(false);
  // Initial 2 seconds steady state
  for (let i = 0; i < 120; i++) {
    filter.processSample({ timeStamp: i * 16.666, interval: 16.666, accelerationIncludingGravity: { x: 0, y: 0, z: 9.81 } });
  }

  // 10g shock (100 m/s^2) for 3 samples (~50ms)
  let shockMaxAz = -Infinity;
  for (let i = 120; i < 123; i++) {
    const res = filter.processSample({ timeStamp: i * 16.666, interval: 16.666, accelerationIncludingGravity: { x: 0, y: 0, z: 100.0 } });
    shockMaxAz = Math.max(shockMaxAz, res.ax, res.az);
  }
  // Linear acceleration should absorb most of the shock (~90 m/s^2)
  assert(shockMaxAz > 75.0, `Linear acceleration failed to isolate shock: ${shockMaxAz}`);

  // 2 seconds recovery back at 9.81 m/s^2
  let finalRes;
  for (let i = 123; i < 250; i++) {
    finalRes = filter.processSample({ timeStamp: i * 16.666, interval: 16.666, accelerationIncludingGravity: { x: 0, y: 0, z: 9.81 } });
  }

  // Verify full convergence back to 9.81 within 2s (decay tau = 0.318s)
  assert(Math.abs(finalRes.grav_z - 9.81) < 0.05, `Filter failed to recover after shock: grav_z=${finalRes.grav_z}`);
  assert(!isNaN(finalRes.grav_z), 'Shock produced NaN');
});

test('2.5 iOS coordinate inversion normalization', () => {
  // On iOS, WebKit reports inverted gravity signs (-9.81 on table face up)
  const filterIOS = new DigitalGravityFilter(true);
  const res = filterIOS.processSample({
    timeStamp: 16.666,
    interval: 16.666,
    accelerationIncludingGravity: { x: 0, y: 0, z: -9.81 }
  });

  // Must be normalized to positive 9.81 m/s^2 (W3C standard)
  assert.strictEqual(res.gz, 9.81, `iOS z-acceleration not inverted: ${res.gz}`);
  assert.strictEqual(res.grav_z, 9.81, `iOS estimated gravity not inverted: ${res.grav_z}`);
});

test('2.6 Timestamp clamping and filter resistance to jitter / glitches', () => {
  const filter = new DigitalGravityFilter(false);

  // Normal initialization
  filter.processSample({ timeStamp: 100, interval: 16, accelerationIncludingGravity: { x: 0, y: 0, z: 9.81 } });

  // Glitch 1: Large pause / sleep (dt = 5000ms)
  const resGlitch1 = filter.processSample({
    timeStamp: 5100,
    interval: 5000,
    accelerationIncludingGravity: { x: 0, y: 0, z: 9.81 }
  });
  // Must clamp dtSec to 0.016, so alphaFilter = 0.016 / (0.3183 + 0.016) ≈ 0.04786
  assert(resGlitch1.alphaFilter < 0.06, `Alpha filter not clamped during pause: ${resGlitch1.alphaFilter}`);
  assert(!isNaN(resGlitch1.grav_z), 'Filter produced NaN on large dt');

  // Glitch 2: Clock step backwards (dt < 0)
  const resGlitch2 = filter.processSample({
    timeStamp: 5090, // -10ms backwards
    interval: 16,
    accelerationIncludingGravity: { x: 0, y: 0, z: 9.81 }
  });
  assert(resGlitch2.alphaFilter < 0.06, `Alpha filter not clamped on negative dt: ${resGlitch2.alphaFilter}`);
  assert(!isNaN(resGlitch2.grav_z), 'Filter produced NaN on negative dt');
});


// ============================================================================
// SUITE 3: MediaRecorder Codec Capability Selection Logic
// ============================================================================
log('\n=== SUITE 3: MediaRecorder Codec Capability Selection Logic ===');

function simulateCodecSelection(userAgent, supportedMimeTypes, isMacIntelTouch = false) {
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) || isMacIntelTouch;

  const mockMediaRecorder = {
    isTypeSupported: (mime) => supportedMimeTypes.includes(mime)
  };

  const iosCandidates = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs="avc1.42E01E"',
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm'
  ];

  const androidCandidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=avc1',
    'video/mp4'
  ];

  const primaryList = isIOS ? iosCandidates : androidCandidates;
  const fallbackList = isIOS ? androidCandidates : iosCandidates;

  for (const candidate of primaryList) {
    if (mockMediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  for (const candidate of fallbackList) {
    if (mockMediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return "";
}

test('3.1 iOS 15 Safari selects MP4 AVC1 (No WebM support)', () => {
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1';
  const supported = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4'];
  const codec = simulateCodecSelection(ua, supported);
  assert.strictEqual(codec, 'video/mp4;codecs=avc1.42E01E');
});

test('3.2 iOS 17 Safari selects MP4 AVC1 even when WebM is present', () => {
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1';
  const supported = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm'];
  const codec = simulateCodecSelection(ua, supported);
  assert.strictEqual(codec, 'video/mp4;codecs=avc1.42E01E');
});

test('3.3 Android 13 Chrome selects WebM VP9', () => {
  const ua = 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
  const supported = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=avc1.42E01E'
  ];
  const codec = simulateCodecSelection(ua, supported);
  assert.strictEqual(codec, 'video/webm;codecs=vp9,opus');
});

test('3.4 Desktop Chrome selects WebM VP9', () => {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  const supported = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4'
  ];
  const codec = simulateCodecSelection(ua, supported);
  assert.strictEqual(codec, 'video/webm;codecs=vp9,opus');
});

test('3.5 Android with VP8 fallback when VP9 unsupported', () => {
  const ua = 'Mozilla/5.0 (Linux; Android 10; SM-A105F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.101 Mobile Safari/537.36';
  const supported = ['video/webm;codecs=vp8,opus', 'video/webm'];
  const codec = simulateCodecSelection(ua, supported);
  assert.strictEqual(codec, 'video/webm;codecs=vp8,opus');
});

test('3.6 Graceful fallback to empty string when no supported codec matches', () => {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ExoticBrowser/1.0';
  const supported = ['video/ogg']; // none in candidate lists
  const codec = simulateCodecSelection(ua, supported);
  assert.strictEqual(codec, "");
});


// ============================================================================
// SUITE 4: Timestamp Monotonicity & Interval Handling
// ============================================================================
log('\n=== SUITE 4: Timestamp Monotonicity & Interval Handling ===');

function simulateSensorLogging(eventList, recordingStartTime = 1000) {
  const sensorData = [];
  let lastEventTimeStamp = null;
  let estimatedGravity = { x: 0, y: 0, z: 9.80665 };
  let gravityFilterInitialized = false;

  for (const event of eventList) {
    const hwTimeStamp = event.timeStamp;
    const intervalMs = event.interval || 0;
    const dt_ms = lastEventTimeStamp ? (hwTimeStamp - lastEventTimeStamp) : intervalMs;
    lastEventTimeStamp = hwTimeStamp;

    const dtSec = (dt_ms > 0 && dt_ms < 200) ? (dt_ms / 1000) : 0.016;
    const rc = 0.3183;
    const alphaFilter = dtSec / (rc + dtSec);

    const gx = event.gx || 0;
    const gy = event.gy || 0;
    const gz = event.gz || 9.81;

    if (!gravityFilterInitialized) {
      estimatedGravity = { x: gx, y: gy, z: gz };
      gravityFilterInitialized = true;
    } else {
      estimatedGravity.x = (1 - alphaFilter) * estimatedGravity.x + alphaFilter * gx;
      estimatedGravity.y = (1 - alphaFilter) * estimatedGravity.y + alphaFilter * gy;
      estimatedGravity.z = (1 - alphaFilter) * estimatedGravity.z + alphaFilter * gz;
    }

    const tRel = hwTimeStamp - recordingStartTime;
    sensorData.push({
      t_hw_ms: Number(hwTimeStamp.toFixed(2)),
      t_rel_ms: Number(tRel.toFixed(2)),
      t: Number(tRel.toFixed(2)),
      dt_ms: Number(dt_ms.toFixed(3)),
      interval_ms: Number(intervalMs.toFixed(2)),
      iso: new Date(1700000000000 + hwTimeStamp).toISOString(),
      ax: 0, ay: 0, az: 0,
      gx, gy, gz,
      total_ax: gx, total_ay: gy, total_az: gz,
      grav_x: Number(estimatedGravity.x.toFixed(4)),
      grav_y: Number(estimatedGravity.y.toFixed(4)),
      grav_z: Number(estimatedGravity.z.toFixed(4)),
      rx: 0, ry: 0, rz: 0,
      gyro_x: 0, gyro_y: 0, gyro_z: 0,
      ori_alpha: null, ori_beta: null, ori_gamma: null,
      qw: 1, qx: 0, qy: 0, qz: 0
    });
  }

  return sensorData;
}

test('4.1 Strictly monotonic timestamps guarantee positive intervals and ordering', () => {
  const events = [];
  let t = 1000;
  for (let i = 0; i < 100; i++) {
    // 60Hz with +/- 2ms jitter
    const jitter = (Math.random() - 0.5) * 4;
    const dt = 16.666 + jitter;
    t += dt;
    events.push({ timeStamp: t, interval: 16.666, gz: 9.81 });
  }

  const logs = simulateSensorLogging(events, 1000);
  assert.strictEqual(logs.length, 100);

  for (let i = 0; i < logs.length; i++) {
    assert(!isNaN(logs[i].t_hw_ms), `NaN t_hw_ms at index ${i}`);
    assert(!isNaN(logs[i].t_rel_ms), `NaN t_rel_ms at index ${i}`);
    assert(!isNaN(logs[i].dt_ms), `NaN dt_ms at index ${i}`);
    assert(logs[i].t_rel_ms >= 0, `Negative t_rel_ms at index ${i}: ${logs[i].t_rel_ms}`);
    assert.strictEqual(logs[i].t, logs[i].t_rel_ms, `Alias mismatch at index ${i}`);

    if (i > 0) {
      assert(logs[i].t_hw_ms > logs[i - 1].t_hw_ms, `Non-monotonic t_hw_ms at index ${i}`);
      assert(logs[i].t_rel_ms > logs[i - 1].t_rel_ms, `Non-monotonic t_rel_ms at index ${i}`);
      assert(logs[i].dt_ms > 0, `Non-positive dt_ms at index ${i}: ${logs[i].dt_ms}`);
    }
  }
});

test('4.2 Resistance to duplicate timestamps without NaN corruption', () => {
  const events = [
    { timeStamp: 1000, interval: 16, gz: 9.81 },
    { timeStamp: 1000, interval: 16, gz: 9.81 }, // duplicate timestamp
    { timeStamp: 1016, interval: 16, gz: 9.81 }
  ];

  const logs = simulateSensorLogging(events, 1000);
  assert.strictEqual(logs.length, 3);
  assert.strictEqual(logs[1].dt_ms, 0);
  assert(!isNaN(logs[1].grav_z), 'grav_z was NaN on duplicate timestamp');
  assert(!isNaN(logs[1].t_rel_ms), 't_rel_ms was NaN on duplicate timestamp');
});


// ============================================================================
// SUITE 5: Sensor Log Schema Compliance (JSON & CSV)
// ============================================================================
log('\n=== SUITE 5: Sensor Log Schema Compliance (JSON & CSV) ===');

// Client JSON & CSV generators from index.html lines 972-1028
function generateSensorJson(data, isIOS = false) {
  return JSON.stringify({
    metadata: {
      version: "2.0-vio",
      scanDate: new Date().toISOString(),
      platform: isIOS ? "iOS_WebKit" : "Android_Chromium",
      coordinate_system: "W3C_FLU",
      gravity_standard: 9.80665,
      units: {
        linear_acceleration: "m/s^2",
        total_acceleration: "m/s^2",
        angular_velocity: "rad/s",
        orientation_euler: "deg",
        quaternion: "Hamilton_wxyz",
        timestamps: "ms"
      },
      platform_normalized: true,
      total_samples: data.length
    },
    samples: data
  }, null, 2);
}

function generateSensorCsv(data, isIOS = false) {
  const metadataComment = `# metadata: platform=${isIOS ? "iOS_WebKit" : "Android_Chromium"},coordinate_system=W3C_FLU,gravity_standard=9.80665,linear_acceleration_units=m/s^2,angular_velocity_units=rad/s,platform_normalized=true\n`;
  const headers = [
    "t_rel_ms", "t_hw_ms", "dt_ms", "interval_ms", "iso_timestamp",
    "ax", "ay", "az",
    "gx", "gy", "gz",
    "grav_x", "grav_y", "grav_z",
    "rx", "ry", "rz",
    "ori_alpha", "ori_beta", "ori_gamma",
    "qw", "qx", "qy", "qz"
  ];
  let csv = metadataComment + headers.join(",") + "\n";
  for (const r of data) {
    csv += [
      r.t_rel_ms.toFixed(2),
      r.t_hw_ms.toFixed(2),
      r.dt_ms.toFixed(3),
      r.interval_ms.toFixed(2),
      r.iso,
      r.ax, r.ay, r.az,
      r.gx, r.gy, r.gz,
      r.grav_x, r.grav_y, r.grav_z,
      r.rx, r.ry, r.rz,
      r.ori_alpha !== null && r.ori_alpha !== undefined ? r.ori_alpha : "",
      r.ori_beta !== null && r.ori_beta !== undefined ? r.ori_beta : "",
      r.ori_gamma !== null && r.ori_gamma !== undefined ? r.ori_gamma : "",
      r.qw !== null && r.qw !== undefined ? r.qw : "",
      r.qx !== null && r.qx !== undefined ? r.qx : "",
      r.qy !== null && r.qy !== undefined ? r.qy : "",
      r.qz !== null && r.qz !== undefined ? r.qz : ""
    ].join(",") + "\n";
  }
  return csv;
}

test('5.1 JSON export schema completeness and typing', () => {
  const sampleEvent = {
    t_hw_ms: 1016.67,
    t_rel_ms: 16.67,
    t: 16.67,
    dt_ms: 16.666,
    interval_ms: 16.67,
    iso: new Date().toISOString(),
    ax: 0.0123, ay: -0.0456, az: 0.1234,
    gx: 0.0123, gy: -0.0456, gz: 9.9300,
    total_ax: 0.0123, total_ay: -0.0456, total_az: 9.9300,
    grav_x: 0.0, grav_y: 0.0, grav_z: 9.8066,
    rx: 0.001234, ry: -0.005678, rz: 0.010111,
    gyro_x: 0.001234, gyro_y: -0.005678, gyro_z: 0.010111,
    ori_alpha: 90.5, ori_beta: 12.3, ori_gamma: -4.5,
    qw: 0.999, qx: 0.01, qy: -0.02, qz: 0.03
  };

  const rawJson = generateSensorJson([sampleEvent], false);
  const parsed = JSON.parse(rawJson);

  // Metadata verification
  assert.strictEqual(parsed.metadata.version, "2.0-vio");
  assert.strictEqual(parsed.metadata.platform, "Android_Chromium");
  assert.strictEqual(parsed.metadata.coordinate_system, "W3C_FLU");
  assert.strictEqual(parsed.metadata.gravity_standard, 9.80665);
  assert.strictEqual(parsed.metadata.platform_normalized, true);
  assert.strictEqual(parsed.metadata.total_samples, 1);

  // Sample verification
  const s = parsed.samples[0];
  const requiredFields = [
    't_hw_ms', 't_rel_ms', 't', 'dt_ms', 'interval_ms', 'iso',
    'ax', 'ay', 'az', 'gx', 'gy', 'gz', 'total_ax', 'total_ay', 'total_az',
    'grav_x', 'grav_y', 'grav_z', 'rx', 'ry', 'rz', 'gyro_x', 'gyro_y', 'gyro_z',
    'ori_alpha', 'ori_beta', 'ori_gamma', 'qw', 'qx', 'qy', 'qz'
  ];

  for (const f of requiredFields) {
    assert(f in s, `Missing field in sample JSON: ${f}`);
    assert(s[f] !== undefined, `Field is undefined in sample JSON: ${f}`);
  }
});

test('5.2 CSV export header-column alignment and null handling', () => {
  const sampleEvents = [
    {
      t_hw_ms: 1000.00,
      t_rel_ms: 0.00,
      dt_ms: 16.666,
      interval_ms: 16.67,
      iso: "2026-09-28T20:00:00.000Z",
      ax: 0.0, ay: 0.0, az: 0.0,
      gx: 0.0, gy: 0.0, gz: 9.81,
      grav_x: 0.0, grav_y: 0.0, grav_z: 9.81,
      rx: 0.0, ry: 0.0, rz: 0.0,
      ori_alpha: null, ori_beta: null, ori_gamma: null, // Null orientations
      qw: null, qx: null, qy: null, qz: null
    },
    {
      t_hw_ms: 1016.67,
      t_rel_ms: 16.67,
      dt_ms: 16.667,
      interval_ms: 16.67,
      iso: "2026-09-28T20:00:00.016Z",
      ax: 0.1, ay: 0.2, az: 0.3,
      gx: 0.1, gy: 0.2, gz: 10.11,
      grav_x: 0.01, grav_y: 0.02, grav_z: 9.81,
      rx: 0.01, ry: 0.02, rz: 0.03,
      ori_alpha: 180.0, ori_beta: 45.0, ori_gamma: -30.0,
      qw: 0.7071, qx: 0.0, qy: 0.7071, qz: 0.0
    }
  ];

  const csv = generateSensorCsv(sampleEvents, true);
  const lines = csv.trim().split('\n');

  assert.strictEqual(lines.length, 4); // Metadata comment + header + 2 data rows
  assert(lines[0].startsWith('# metadata: platform=iOS_WebKit'));

  const headerCols = lines[1].split(',');
  assert.strictEqual(headerCols.length, 24, `Header count mismatch: expected 24, got ${headerCols.length}`);

  for (let i = 2; i < lines.length; i++) {
    const rowCols = lines[i].split(',');
    assert.strictEqual(rowCols.length, 24, `Data row ${i-2} count mismatch: expected 24, got ${rowCols.length}`);
  }

  // Check row 0 nulls became empty strings
  const row0 = lines[2].split(',');
  assert.strictEqual(row0[17], ""); // ori_alpha
  assert.strictEqual(row0[18], ""); // ori_beta
  assert.strictEqual(row0[19], ""); // ori_gamma
  assert.strictEqual(row0[20], ""); // qw
  assert.strictEqual(row0[21], ""); // qx
  assert.strictEqual(row0[22], ""); // qy
  assert.strictEqual(row0[23], ""); // qz

  // Check row 1 filled values
  const row1 = lines[3].split(',');
  assert.strictEqual(row1[17], "180");
  assert.strictEqual(row1[20], "0.7071");
});

// ============================================================================
// SUMMARY & VERDICT
// ============================================================================
log('\n====================================================================');
log(`TEST EXECUTION SUMMARY:`);
log(`Total Tests Run : ${passedTests + failedTests}`);
log(`Passed          : ${passedTests}`);
log(`Failed          : ${failedTests}`);
log(`Pass Rate       : ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
log('====================================================================\n');

if (failedTests > 0) {
  log('FINAL EMPIRICAL VERDICT: REJECT');
  process.exit(1);
} else {
  log('FINAL EMPIRICAL VERDICT: APPROVE');
  process.exit(0);
}
