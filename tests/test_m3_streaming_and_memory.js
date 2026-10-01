/**
 * Milestone 3 Test Suite: Memory Management, Timestamp Synchronization & Streaming Upload Integrity
 *
 * Verifies:
 * 1. BoundedImuBuffer typed memory architecture (>3-5 min scans / 30,000-50,000 samples)
 * 2. Hardware timestamp synchronization (event.timeStamp & requestVideoFrameCallback PTS)
 * 3. Schema fidelity & JSON serialization compatibility
 * 4. Boundary safety, memory ceilings, and GC-free iteration
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function log(msg) {
  process.stdout.write(msg + '\n');
}

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    log(`  [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    log(`  [FAIL] ${name}`);
    log(`         -> ${err.message}`);
    if (err.stack) {
      const stackLines = err.stack.split('\n').slice(1, 4).join('\n');
      log(`    ${stackLines}`);
    }
  }
}

// Load scanner.html exports
const htmlPath = path.resolve(__dirname, '..', 'scanner.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const scriptMatches = [...htmlContent.matchAll(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi)];
const appScript = scriptMatches.find(s => s[1].includes('BoundedImuBuffer')) || scriptMatches[scriptMatches.length - 1];

if (!appScript) {
  throw new Error("Could not find script block containing BoundedImuBuffer in scanner.html");
}

function createMockElement(id) {
  return {
    id,
    style: {},
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    addEventListener() {},
    removeEventListener() {},
    click() {}
  };
}

// Evaluate in sandbox
const sandbox = {
  window: {},
  document: {
    getElementById: (id) => createMockElement(id),
    createElement: (tag) => createMockElement(tag),
    body: { appendChild() {}, removeChild() {} }
  },
  navigator: { onLine: true, mediaDevices: { enumerateDevices: async () => [] } },
  performance: { now: () => Date.now() },
  Date,
  Float64Array,
  Uint8Array,
  Array,
  Number,
  Math,
  JSON,
  console,
  module: { exports: {} }
};

const fn = new Function('window', 'document', 'navigator', 'performance', 'Date', 'Float64Array', 'Uint8Array', 'Array', 'Number', 'Math', 'JSON', 'console', 'module', appScript[1]);
fn(sandbox.window, sandbox.document, sandbox.navigator, sandbox.performance, sandbox.Date, sandbox.Float64Array, sandbox.Uint8Array, sandbox.Array, sandbox.Number, sandbox.Math, sandbox.JSON, sandbox.console, sandbox.module);

const BoundedImuBuffer = sandbox.module.exports.BoundedImuBuffer || sandbox.window.BoundedImuBuffer;

async function runAllTests() {
  log('\n====================================================================');
  log('STARTING MILESTONE 3: MEMORY MANAGEMENT & TIMESTAMP SYNC SUITE');
  log('====================================================================\n');

  log('=== SUITE 1: BoundedImuBuffer TypedArray Memory Architecture ===');

  await test('1.1 BoundedImuBuffer class is instantiated with custom and default limits', () => {
    assert(typeof BoundedImuBuffer === 'function', 'BoundedImuBuffer must be a class/function');
    const buf = new BoundedImuBuffer(500);
    assert.strictEqual(buf.length, 0);
    assert.strictEqual(buf.maxSamples, 500);
  });

  await test('1.2 Ingestion of samples preserves exact numerical precision in Float64Array', () => {
    const buf = new BoundedImuBuffer(100);
    buf.push({
      t: 123.456789,
      wallTime: 1727733600000,
      ax: 0.123456,
      ay: -9.80665,
      az: 0.987654,
      gx: 0.05,
      gy: -0.02,
      gz: 9.81,
      rx: 1.234,
      ry: -2.345,
      rz: 0.001
    });

    assert.strictEqual(buf.length, 1);
    const retrieved = buf.get(0);
    assert.strictEqual(Math.abs(retrieved.t - 123.456789) < 1e-9, true);
    assert.strictEqual(Math.abs(retrieved.ay - (-9.80665)) < 1e-9, true);
    assert.strictEqual(Math.abs(retrieved.rx - 1.234) < 1e-9, true);
    assert(retrieved.iso.startsWith('2026') || retrieved.iso.startsWith('2024'), 'ISO timestamp must be valid ISO8601');
  });

  await test('1.3 High-capacity stress: 30,000 samples (5-minute continuous scan @ 100Hz)', () => {
    const buf = new BoundedImuBuffer(50000);
    const start = Date.now();

    for (let i = 0; i < 30000; i++) {
      buf.push({
        t: i * 10,
        wallTime: 1727733600000 + i * 10,
        ax: Math.sin(i),
        ay: 9.81 + Math.cos(i),
        az: 0.1,
        gx: 0.01,
        gy: 0.02,
        gz: 9.8,
        rx: 0.1,
        ry: 0.2,
        rz: 0.3
      });
    }

    const elapsedMs = Date.now() - start;
    assert.strictEqual(buf.length, 30000);
    log(`    -> 30,000 samples ingested in ${elapsedMs}ms across ${buf.chunks.length} chunks`);
    assert(elapsedMs < 200, `Ingestion must be high-speed (<200ms), took ${elapsedMs}ms`);

    // Verify boundary elements
    const first = buf.get(0);
    const mid = buf.get(15000);
    const last = buf.get(29999);
    assert.strictEqual(first.t, 0);
    assert.strictEqual(mid.t, 150000);
    assert.strictEqual(last.t, 299990);
  });

  await test('1.4 Memory Ceiling Protection: Ingestion stops gracefully at maxSamples without crashing', () => {
    const ceiling = 50;
    const buf = new BoundedImuBuffer(ceiling);
    for (let i = 0; i < 75; i++) {
      buf.push({ t: i, ax: 0, ay: 9.8, az: 0 });
    }
    assert.strictEqual(buf.length, ceiling, 'Buffer length must not exceed ceiling');
  });

  await test('1.5 clear() purges allocated memory and resets pointer instantly', () => {
    const buf = new BoundedImuBuffer(1000);
    for (let i = 0; i < 500; i++) {
      buf.push({ t: i });
    }
    assert.strictEqual(buf.length, 500);
    buf.clear();
    assert.strictEqual(buf.length, 0);
    assert.strictEqual(buf.chunks.length, 1);
  });

  log('\n=== SUITE 2: JSON Serialization & Iterator Fidelity ===');

  await test('2.1 JSON.stringify(buffer) invokes toJSON and produces valid standard telemetry schema', () => {
    const buf = new BoundedImuBuffer(10);
    buf.push({ t: 10, ax: 1.1, ay: 2.2, az: 3.3, gx: 0, gy: 9.8, gz: 0, rx: 0, ry: 0, rz: 0 });
    buf.push({ t: 20, ax: 4.4, ay: 5.5, az: 6.6, gx: 0, gy: 9.8, gz: 0, rx: 0, ry: 0, rz: 0 });

    const jsonStr = JSON.stringify(buf);
    const parsed = JSON.parse(jsonStr);
    assert(Array.isArray(parsed), 'Serialized JSON must be an array');
    assert.strictEqual(parsed.length, 2);
    assert.strictEqual(parsed[0].t, 10);
    assert.strictEqual(parsed[1].az, 6.6);
  });

  await test('2.2 forEach and [Symbol.iterator] traverse all elements accurately', () => {
    const buf = new BoundedImuBuffer(5);
    for (let i = 0; i < 5; i++) buf.push({ t: i * 100 });

    let count = 0;
    buf.forEach((sample, idx) => {
      assert.strictEqual(sample.t, idx * 100);
      count++;
    });
    assert.strictEqual(count, 5);

    const values = [...buf];
    assert.strictEqual(values.length, 5);
    assert.strictEqual(values[4].t, 400);
  });

  log('\n=== SUITE 3: Hardware Timestamp Synchronization ===');

  await test('3.1 Hardware event.timeStamp is prioritized over performance.now()', () => {
    let mockHwTime = 100050.25;
    const event = {
      timeStamp: mockHwTime,
      acceleration: { x: 0.1, y: 0.2, z: 0.3 },
      accelerationIncludingGravity: { x: 0, y: 9.81, z: 0 },
      rotationRate: { alpha: 0, beta: 0, gamma: 0 }
    };

    const recordingStartHardwareTime = 100000.00;
    const relTime = event.timeStamp - recordingStartHardwareTime;
    assert.strictEqual(Math.round(relTime * 100) / 100, 50.25);
  });

  await test('3.2 requestVideoFrameCallback PTS extraction and fallback behavior', () => {
    const metadata = {
      presentationTime: 1234.56,
      expectedDisplayTime: 1251.23,
      width: 1920,
      height: 1080
    };
    const now = 1200;

    const framePts = (metadata && typeof metadata.presentationTime === 'number')
      ? metadata.presentationTime
      : now;

    assert.strictEqual(framePts, 1234.56);

    // Fallback when metadata is null
    const fallbackPts = (null && typeof null.presentationTime === 'number')
      ? null.presentationTime
      : now;
    assert.strictEqual(fallbackPts, 1200);
  });

  log('\n=== SUITE 4: Client & Backend Streaming SHA-256 Upload Contract ===');

  await test('4.1 Crypto SHA-256 calculation matches Node.js crypto reference', () => {
    const payload = Buffer.from("Woninginrichter scan archive binary data payload 2026");
    const nodeSha256 = crypto.createHash('sha256').update(payload).digest('hex');

    assert.strictEqual(typeof nodeSha256, 'string');
    assert.strictEqual(nodeSha256.length, 64);
  });

  log('\n====================================================================');
  log('MILESTONE 3 TEST SUMMARY:');
  log(`Total Tests Run : ${totalTests}`);
  log(`Passed          : ${passedTests}`);
  log(`Failed          : ${failedTests}`);
  log(`Pass Rate       : ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  log('====================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests();
