/**
 * tests/test_offline_fallback.js
 * 
 * Comprehensive automated test suite for Milestone 2:
 * - Zero-dependency client-side PKZIP archive generation
 * - Standard PKZIP format specification compliance (headers, CRC-32, central directory)
 * - Required package payload completeness (recording.webm/mp4, sensor_data.json, frame_timestamps.json, scan_metadata.json)
 * - Network state detection (navigator.onLine, online/offline events)
 * - Emergency HUD fallback activation (#download-offline-zip-btn)
 * - Adversarial stress resilience and CDN isolation (zero dependency on JSZip)
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { spawnSync } = require('child_process');

let passedTests = 0;
let failedTests = 0;

function log(msg) {
  console.log(msg);
}

async function test(name, fn) {
  try {
    await fn();
    passedTests++;
    log(`  [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    log(`  [FAIL] ${name}: ${err.message}`);
    console.error(err);
  }
}

// =========================================================================
// Independent Reference ZIP Parser for Cryptographic & Spec Audit
// =========================================================================

function parseZipArchive(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const localFiles = [];
  let offset = 0;

  // 1. Parse Local File Headers
  while (offset + 30 <= bytes.length) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break; // Not a local file header

    const versionNeeded = view.getUint16(offset + 4, true);
    const flags = view.getUint16(offset + 6, true);
    const compression = view.getUint16(offset + 8, true);
    const modTime = view.getUint16(offset + 10, true);
    const modDate = view.getUint16(offset + 12, true);
    const crc32 = view.getUint32(offset + 14, true);
    const compSize = view.getUint32(offset + 18, true);
    const uncompSize = view.getUint32(offset + 22, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);

    const nameBytes = bytes.subarray(offset + 30, offset + 30 + nameLen);
    const name = new TextDecoder().decode(nameBytes);

    const dataStart = offset + 30 + nameLen + extraLen;
    const dataBytes = bytes.subarray(dataStart, dataStart + compSize);

    localFiles.push({
      headerOffset: offset,
      signature: sig,
      versionNeeded,
      flags,
      compression,
      modTime,
      modDate,
      crc32,
      compSize,
      uncompSize,
      name,
      data: dataBytes
    });

    offset = dataStart + compSize;
  }

  // 2. Parse Central Directory Headers
  const cdOffset = offset;
  const centralFiles = [];
  while (offset + 46 <= bytes.length) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x02014b50) break; // Not a central directory header

    const versionMadeBy = view.getUint16(offset + 4, true);
    const versionNeeded = view.getUint16(offset + 6, true);
    const flags = view.getUint16(offset + 8, true);
    const compression = view.getUint16(offset + 10, true);
    const crc32 = view.getUint32(offset + 16, true);
    const compSize = view.getUint32(offset + 20, true);
    const uncompSize = view.getUint32(offset + 24, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const extAttrs = view.getUint32(offset + 38, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);

    const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLen);
    const name = new TextDecoder().decode(nameBytes);

    centralFiles.push({
      signature: sig,
      versionMadeBy,
      versionNeeded,
      flags,
      compression,
      crc32,
      compSize,
      uncompSize,
      name,
      extAttrs,
      localHeaderOffset
    });

    offset += 46 + nameLen + extraLen + commentLen;
  }

  // 3. Parse End of Central Directory (EOCD)
  let eocd = null;
  if (offset + 22 <= bytes.length) {
    const sig = view.getUint32(offset, true);
    if (sig === 0x06054b50) {
      eocd = {
        signature: sig,
        diskNum: view.getUint16(offset + 4, true),
        cdStartDisk: view.getUint16(offset + 6, true),
        diskEntries: view.getUint16(offset + 8, true),
        totalEntries: view.getUint16(offset + 10, true),
        cdSize: view.getUint32(offset + 12, true),
        cdOffset: view.getUint32(offset + 16, true),
        commentLen: view.getUint16(offset + 20, true)
      };
    }
  }

  return {
    localFiles,
    centralFiles,
    eocd,
    totalBytes: bytes.length
  };
}

// Reference CRC-32 calculator
function computeReferenceCRC32(bytes) {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

// =========================================================================
// Mock Environment & Scanner.html Loader
// =========================================================================

function createMockElement(id) {
  const classListSet = new Set();
  const listeners = {};
  const dataset = {};
  const style = {};

  return {
    id,
    disabled: false,
    innerText: '',
    innerHTML: '',
    value: '',
    title: '',
    style,
    dataset,
    classList: {
      add: (c) => classListSet.add(c),
      remove: (c) => classListSet.delete(c),
      toggle: (c) => (classListSet.has(c) ? classListSet.delete(c) : classListSet.add(c)),
      contains: (c) => classListSet.has(c),
      get length() { return classListSet.size; }
    },
    addEventListener: (type, fn) => {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
    },
    click: async () => {
      if (listeners['click']) {
        for (const handler of listeners['click']) {
          await handler({ target: this });
        }
      }
    },
    trigger: async (type, ev = {}) => {
      if (listeners[type]) {
        for (const handler of listeners[type]) {
          await handler(ev);
        }
      }
    },
    appendChild: () => {},
    removeChild: () => {}
  };
}

function createMockDocument() {
  const elements = {};
  return {
    getElementById(id) {
      if (!elements[id]) {
        elements[id] = createMockElement(id);
      }
      return elements[id];
    },
    createElement(tag) {
      return createMockElement(tag);
    },
    body: {
      appendChild: () => {},
      removeChild: () => {}
    },
    _elements: elements
  };
}

function loadScannerEnvironment(options = {}) {
  const htmlPath = path.resolve(__dirname, '..', 'scanner.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  const allScripts = [...htmlContent.matchAll(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi)];
  const appScript = allScripts.find(s => s[1].includes('cameraController')) || allScripts[allScripts.length - 1];
  if (!appScript) {
    throw new Error('No application <script> tag found in scanner.html');
  }
  const scriptCode = appScript[1];

  const mockDoc = createMockDocument();
  const windowListeners = {};

  const mockLocation = {
    protocol: 'https:',
    hostname: 'localhost',
    origin: 'https://localhost',
    href: 'https://localhost/scanner.html',
    port: '443'
  };

  const mockNavigator = {
    userAgent: 'Mozilla/5.0 (Linux; Android 13) Mobile Safari/537.36 TestRunner',
    onLine: options.initialOnline !== undefined ? options.initialOnline : true,
    mediaDevices: {
      enumerateDevices: async () => [],
      getUserMedia: async () => ({
        getVideoTracks: () => [],
        getAudioTracks: () => [],
        getTracks: () => []
      })
    }
  };

  const sandbox = {
    TextEncoder: typeof TextEncoder !== 'undefined' ? TextEncoder : require('util').TextEncoder,
    TextDecoder: typeof TextDecoder !== 'undefined' ? TextDecoder : require('util').TextDecoder,
    Uint8Array,
    Uint16Array,
    Uint32Array,
    DataView,
    ArrayBuffer,
    Promise,
    Set,
    Map,
    Date,
    JSON,
    Math,
    document: mockDoc,
    navigator: mockNavigator,
    location: mockLocation,
    window: {
      addEventListener: (type, fn) => {
        if (!windowListeners[type]) windowListeners[type] = [];
        windowListeners[type].push(fn);
      },
      removeEventListener: () => {},
      performance: { now: () => Date.now() },
      setInterval: () => 1,
      clearInterval: () => {},
      location: mockLocation,
      fetch: async () => ({ ok: true, status: 200, json: async () => ({}) })
    },
    performance: { now: () => Date.now() },
    fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
    console: {
      log: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {}
    },
    alert: () => {},
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    URL: {
      createObjectURL: () => 'blob:mock-url-' + Math.random(),
      revokeObjectURL: () => {}
    },
    Blob: typeof Blob !== 'undefined' ? Blob : class MockBlob {
      constructor(parts, opts = {}) {
        this.parts = parts;
        this.type = opts.type || '';
        let totalLen = 0;
        for (const p of parts) totalLen += (p.length || p.byteLength || 0);
        this.size = totalLen;
      }
      async arrayBuffer() {
        let total = 0;
        for (const p of this.parts) total += p.byteLength || p.length || 0;
        const res = new Uint8Array(total);
        let off = 0;
        for (const p of this.parts) {
          const arr = p instanceof Uint8Array ? p : new Uint8Array(p);
          res.set(arr, off);
          off += arr.length;
        }
        return res.buffer;
      }
    },
    module: { exports: {} },
    exports: {}
  };

  sandbox.window.document = sandbox.document;
  sandbox.window.navigator = sandbox.navigator;

  vm.createContext(sandbox);
  vm.runInContext(scriptCode, sandbox);

  return {
    sandbox,
    doc: mockDoc,
    windowListeners,
    generateOfflineZip: sandbox.module.exports.generateOfflineZip || sandbox.window.generateOfflineZip,
    updateNetworkStatus: sandbox.module.exports.updateNetworkStatus || sandbox.window.updateNetworkStatus,
    controller: sandbox.module.exports.cameraController || sandbox.window.cameraController
  };
}

// =========================================================================
// TEST SUITES EXECUTION
// =========================================================================

async function runAllTests() {
  log('====================================================================');
  log('STARTING MILESTONE 2: OFFLINE FALLBACK & PKZIP VERIFICATION SUITE');
  log('====================================================================');

  const env = loadScannerEnvironment();
  const generateOfflineZip = env.generateOfflineZip;

  // -----------------------------------------------------------------------
  // SUITE 1: Binary Format & Standard PKZIP Compliance
  // -----------------------------------------------------------------------
  log('\n=== SUITE 1: Binary Format & Standard PKZIP Compliance ===');

  await test('1.1 Local file headers start with PK\\x03\\x04 signature (0x04034b50)', async () => {
    const dummyVideo = new Uint8Array([0x1A, 0x45, 0xDF, 0xA3, 0x01, 0x02, 0x03]); // Matroska/WebM magic
    const sensorJson = JSON.stringify([{ t: 100, ax: 0.1, ay: 0.2, az: 9.8 }]);
    const frameJson = JSON.stringify([{ frameIndex: 0, t: 16.6 }]);

    const zipBlob = await generateOfflineZip(dummyVideo, sensorJson, frameJson);
    const arrayBuf = await zipBlob.arrayBuffer();
    const parsed = parseZipArchive(arrayBuf);

    assert.strictEqual(parsed.localFiles.length, 4, 'Must contain 4 local files');
    for (const file of parsed.localFiles) {
      assert.strictEqual(file.signature, 0x04034b50, `File ${file.name} header must start with 0x04034b50`);
      assert.strictEqual(file.versionNeeded, 20, `File ${file.name} versionNeeded must be 20`);
      assert.strictEqual(file.compression, 0, `File ${file.name} must be Method 0 (Stored)`);
    }
  });

  await test('1.2 Central directory file headers start with PK\\x01\\x02 (0x02014b50)', async () => {
    const dummyVideo = new Uint8Array([1, 2, 3, 4, 5]);
    const zipBlob = await generateOfflineZip(dummyVideo, '[]', '[]');
    const arrayBuf = await zipBlob.arrayBuffer();
    const parsed = parseZipArchive(arrayBuf);

    assert.strictEqual(parsed.centralFiles.length, 4, 'Must contain 4 central directory headers');
    for (let i = 0; i < parsed.centralFiles.length; i++) {
      const cd = parsed.centralFiles[i];
      const local = parsed.localFiles[i];
      assert.strictEqual(cd.signature, 0x02014b50, 'Central header signature must be 0x02014b50');
      assert.strictEqual(cd.name, local.name, 'CD file name must match local header file name');
      assert.strictEqual(cd.localHeaderOffset, local.headerOffset, 'CD local header offset must match');
      assert.strictEqual(cd.compSize, local.compSize, 'Compressed size must match');
      assert.strictEqual(cd.uncompSize, local.uncompSize, 'Uncompressed size must match');
      assert.strictEqual(cd.crc32, local.crc32, 'CRC-32 in central directory must match local header');
    }
  });

  await test('1.3 End of Central Directory (EOCD) signature PK\\x05\\x06 and offsets', async () => {
    const dummyVideo = new Uint8Array([10, 20, 30]);
    const zipBlob = await generateOfflineZip(dummyVideo, '[]', '[]');
    const arrayBuf = await zipBlob.arrayBuffer();
    const parsed = parseZipArchive(arrayBuf);

    assert.ok(parsed.eocd, 'EOCD record must be present');
    assert.strictEqual(parsed.eocd.signature, 0x06054b50, 'EOCD signature must be 0x06054b50');
    assert.strictEqual(parsed.eocd.diskEntries, 4, 'Disk entries count must be 4');
    assert.strictEqual(parsed.eocd.totalEntries, 4, 'Total entries count must be 4');
    assert.ok(parsed.eocd.cdSize > 0, 'Central directory size must be positive');
    assert.ok(parsed.eocd.cdOffset > 0, 'Central directory offset must be positive');
  });

  await test('1.4 Standard IEEE 802.3 CRC-32 integrity across all stored entries', async () => {
    const testVideo = new TextEncoder().encode('VIDEO_PAYLOAD_TEST_DATA_BYTES_12345');
    const testSensors = JSON.stringify([{ t: 0, a: [1, 2, 3] }, { t: 50, a: [4, 5, 6] }]);
    const testFrames = JSON.stringify([{ frame: 1, t: 33.3 }]);

    const zipBlob = await generateOfflineZip(testVideo, testSensors, testFrames);
    const arrayBuf = await zipBlob.arrayBuffer();
    const parsed = parseZipArchive(arrayBuf);

    for (const file of parsed.localFiles) {
      const expectedCrc = computeReferenceCRC32(file.data);
      assert.strictEqual(file.crc32, expectedCrc, `CRC32 mismatch for ${file.name}: got ${file.crc32}, expected ${expectedCrc}`);
    }
  });

  await test('1.5 Method 0 (Stored) uncompressed payload matches source verbatim', async () => {
    const testVideo = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0xFF]);
    const sensorContent = '[{"sensor":"gyro","rx":0.05}]';
    const frameContent = '[{"frame":0,"pts":0}]';

    const zipBlob = await generateOfflineZip(testVideo, sensorContent, frameContent);
    const arrayBuf = await zipBlob.arrayBuffer();
    const parsed = parseZipArchive(arrayBuf);

    const videoEntry = parsed.localFiles.find(f => f.name === 'recording.webm');
    assert.ok(videoEntry, 'recording.webm must exist');
    assert.deepStrictEqual(Array.from(videoEntry.data), Array.from(testVideo), 'Video data must match verbatim');

    const sensorEntry = parsed.localFiles.find(f => f.name === 'sensor_data.json');
    assert.ok(sensorEntry, 'sensor_data.json must exist');
    assert.strictEqual(new TextDecoder().decode(sensorEntry.data), sensorContent);

    const frameEntry = parsed.localFiles.find(f => f.name === 'frame_timestamps.json');
    assert.ok(frameEntry, 'frame_timestamps.json must exist');
    assert.strictEqual(new TextDecoder().decode(frameEntry.data), frameContent);
  });

  await test('1.6 Independent extraction verification via Python zipfile module', async () => {
    const testPayload = new Uint8Array([11, 22, 33, 44, 55, 66]);
    const zipBlob = await generateOfflineZip(testPayload, '{"test":1}', '[]');
    const arrayBuf = await zipBlob.arrayBuffer();
    const tmpZipPath = path.resolve(__dirname, 'temp_verify_test.zip');
    fs.writeFileSync(tmpZipPath, Buffer.from(arrayBuf));

    try {
      const pyScript = `
import zipfile, sys
with zipfile.ZipFile(sys.argv[1], 'r') as zf:
    bad = zf.testzip()
    if bad is not None:
        sys.exit(f"Corrupt zip entry: {bad}")
    names = zf.namelist()
    assert 'recording.webm' in names
    assert 'sensor_data.json' in names
    assert 'frame_timestamps.json' in names
    assert 'scan_metadata.json' in names
    data = zf.read('sensor_data.json')
    assert b'{"test":1}' in data
print("PYTHON_ZIPFILE_OK")
`;
      const res = spawnSync('python', ['-c', pyScript, tmpZipPath], { encoding: 'utf8' });
      assert.strictEqual(res.status, 0, `Python zipfile verification failed: ${res.stderr || res.stdout}`);
      assert.ok(res.stdout.includes('PYTHON_ZIPFILE_OK'), 'Must output verification confirmation');
    } finally {
      if (fs.existsSync(tmpZipPath)) fs.unlinkSync(tmpZipPath);
    }
  });

  // -----------------------------------------------------------------------
  // SUITE 2: Package Schema & Payload Completeness
  // -----------------------------------------------------------------------
  log('\n=== SUITE 2: Package Schema & Payload Completeness ===');

  await test('2.1 Default WebM video package includes all 4 required files', async () => {
    const dummyWebm = new Uint8Array([0x1A, 0x45]);
    const zipBlob = await generateOfflineZip(dummyWebm, [], []);
    const arrayBuf = await zipBlob.arrayBuffer();
    const parsed = parseZipArchive(arrayBuf);

    const names = parsed.localFiles.map(f => f.name);
    assert.ok(names.includes('recording.webm'), 'Must include recording.webm');
    assert.ok(names.includes('sensor_data.json'), 'Must include sensor_data.json');
    assert.ok(names.includes('frame_timestamps.json'), 'Must include frame_timestamps.json');
    assert.ok(names.includes('scan_metadata.json'), 'Must include scan_metadata.json');
  });

  await test('2.2 MP4 video package names video file recording.mp4', async () => {
    const mp4MockBlob = {
      type: 'video/mp4;codecs=avc1',
      arrayBuffer: async () => new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]).buffer
    };
    const zipBlob = await generateOfflineZip(mp4MockBlob, '[]', '[]');
    const arrayBuf = await zipBlob.arrayBuffer();
    const parsed = parseZipArchive(arrayBuf);

    const names = parsed.localFiles.map(f => f.name);
    assert.ok(names.includes('recording.mp4'), 'Must name file recording.mp4 for MP4 mime type');
    assert.ok(!names.includes('recording.webm'), 'Must not include recording.webm when MP4 is present');
  });

  await test('2.3 Sensor data JSON payload preserves telemetry format and typing', async () => {
    const sensors = [
      { t: 0.0, iso: '2026-09-30T20:00:00.000Z', ax: 0.1, ay: 0.2, az: 9.81, gx: 0.01, gy: -0.02, gz: 0.00 },
      { t: 20.0, iso: '2026-09-30T20:00:00.020Z', ax: 0.15, ay: 0.22, az: 9.79, gx: 0.02, gy: -0.01, gz: 0.01 }
    ];

    const zipBlob = await generateOfflineZip(new Uint8Array(0), sensors, []);
    const arrayBuf = await zipBlob.arrayBuffer();
    const parsed = parseZipArchive(arrayBuf);

    const sensorEntry = parsed.localFiles.find(f => f.name === 'sensor_data.json');
    const parsedSensors = JSON.parse(new TextDecoder().decode(sensorEntry.data));
    assert.strictEqual(parsedSensors.length, 2);
    assert.strictEqual(parsedSensors[0].ax, 0.1);
    assert.strictEqual(parsedSensors[1].az, 9.79);
  });

  await test('2.4 Frame timestamps JSON payload preserves frame indices and time offsets', async () => {
    const frames = [
      { frameIndex: 0, t: 0, wallTime: 1790800000000 },
      { frameIndex: 1, t: 16.67, wallTime: 1790800000016 },
      { frameIndex: 2, t: 33.33, wallTime: 1790800000033 }
    ];

    const zipBlob = await generateOfflineZip(new Uint8Array(0), '[]', frames);
    const arrayBuf = await zipBlob.arrayBuffer();
    const parsed = parseZipArchive(arrayBuf);

    const frameEntry = parsed.localFiles.find(f => f.name === 'frame_timestamps.json');
    const parsedFrames = JSON.parse(new TextDecoder().decode(frameEntry.data));
    assert.strictEqual(parsedFrames.length, 3);
    assert.strictEqual(parsedFrames[1].frameIndex, 1);
    assert.strictEqual(parsedFrames[2].t, 33.33);
  });

  await test('2.5 scan_metadata.json includes required schema fields', async () => {
    const zipBlob = await generateOfflineZip(new Uint8Array([1, 2, 3]), '[]', '[]');
    const arrayBuf = await zipBlob.arrayBuffer();
    const parsed = parseZipArchive(arrayBuf);

    const metaEntry = parsed.localFiles.find(f => f.name === 'scan_metadata.json');
    const meta = JSON.parse(new TextDecoder().decode(metaEntry.data));

    assert.ok(meta.scanId, 'Must include scanId');
    assert.ok(meta.timestamp, 'Must include timestamp');
    assert.strictEqual(meta.isOfflinePackage, true, 'isOfflinePackage must be true');
    assert.ok(Array.isArray(meta.files), 'files must be an array');
    assert.strictEqual(meta.files.length, 4);
    assert.ok(meta.files.includes('recording.webm'));
  });

  await test('2.6 Boundary conditions: Empty video, empty sensor list, null frames', async () => {
    const zipBlob = await generateOfflineZip(null, null, null);
    const arrayBuf = await zipBlob.arrayBuffer();
    const parsed = parseZipArchive(arrayBuf);

    assert.strictEqual(parsed.localFiles.length, 4);
    const videoEntry = parsed.localFiles.find(f => f.name === 'recording.webm');
    assert.strictEqual(videoEntry.compSize, 0);
    assert.strictEqual(videoEntry.crc32, 0);

    const sensorEntry = parsed.localFiles.find(f => f.name === 'sensor_data.json');
    assert.strictEqual(new TextDecoder().decode(sensorEntry.data), '[]');
  });

  // -----------------------------------------------------------------------
  // SUITE 3: Network Detection & Emergency UI Trigger Logic
  // -----------------------------------------------------------------------
  log('\n=== SUITE 3: Network Detection & Emergency UI Trigger Logic ===');

  await test('3.1 navigator.onLine state detection and button initial state', async () => {
    const offlineEnv = loadScannerEnvironment({ initialOnline: false });
    const btn = offlineEnv.doc.getElementById('download-offline-zip-btn');
    assert.strictEqual(btn.style.display, 'flex', 'Button must be visible when loaded offline');

    const onlineEnv = loadScannerEnvironment({ initialOnline: true });
    const onlineBtn = onlineEnv.doc.getElementById('download-offline-zip-btn');
    assert.strictEqual(onlineBtn.style.display, 'none', 'Button must be hidden when loaded online');
  });

  await test('3.2 Window offline event activates emergency HUD button', async () => {
    const testEnv = loadScannerEnvironment({ initialOnline: true });
    const btn = testEnv.doc.getElementById('download-offline-zip-btn');
    assert.strictEqual(btn.style.display, 'none');

    // Trigger offline event
    testEnv.sandbox.navigator.onLine = false;
    testEnv.updateNetworkStatus(true);

    assert.strictEqual(btn.style.display, 'flex', 'Offline event must display emergency button');
    assert.ok(!btn.classList.contains('hidden'));
  });

  await test('3.3 Window online event hides emergency button when no error is sticky', async () => {
    const testEnv = loadScannerEnvironment({ initialOnline: false });
    const btn = testEnv.doc.getElementById('download-offline-zip-btn');
    assert.strictEqual(btn.style.display, 'flex');

    testEnv.sandbox.navigator.onLine = true;
    testEnv.updateNetworkStatus(false);

    assert.strictEqual(btn.style.display, 'none', 'Online event must hide emergency button');
  });

  await test('3.4 Upload fetch network failure triggers emergency button visibility', async () => {
    const testEnv = loadScannerEnvironment({ initialOnline: true });
    const btn = testEnv.doc.getElementById('download-offline-zip-btn');
    const uploadBtn = testEnv.doc.getElementById('upload-pc-btn');
    const statusDiv = testEnv.doc.getElementById('upload-status');

    assert.strictEqual(btn.style.display, 'none');

    // Mock fetch to simulate network failure (e.g. PC server unreachable)
    testEnv.sandbox.fetch = async () => {
      throw new Error('Failed to fetch (ECONNREFUSED)');
    };

    // Trigger upload
    await uploadBtn.click();

    // Verify upload failure handled
    assert.ok(statusDiv.innerText.includes('Niet gelukt'), 'Must report upload failure in UI');
    assert.strictEqual(btn.style.display, 'flex', 'Emergency HUD button must activate upon upload failure');
    assert.strictEqual(btn.dataset.keepVisible, 'true', 'keepVisible flag must be set');
  });

  await test('3.5 Emergency button click triggers generateOfflineZip and download', async () => {
    const testEnv = loadScannerEnvironment({ initialOnline: false });
    const btn = testEnv.doc.getElementById('download-offline-zip-btn');

    let downloadTriggered = false;
    let downloadedBlob = null;
    let downloadedFilename = '';

    testEnv.sandbox.document.createElement = (tag) => {
      const el = createMockElement(tag);
      if (tag === 'a') {
        el.click = () => {
          downloadTriggered = true;
          downloadedFilename = el.download;
        };
      }
      return el;
    };
    testEnv.doc.createElement = testEnv.sandbox.document.createElement;

    testEnv.sandbox.URL.createObjectURL = (blob) => {
      downloadedBlob = blob;
      return 'blob:mock-download-123';
    };

    await btn.click();

    assert.ok(downloadTriggered, 'Clicking emergency button must trigger browser download');
    assert.ok(downloadedFilename.startsWith('scan_offline_'), `Filename must start with scan_offline_: ${downloadedFilename}`);
    assert.ok(downloadedFilename.endsWith('.zip'), 'Filename must end with .zip');
    assert.ok(downloadedBlob, 'Must pass generated ZIP blob to download handler');
  });

  // -----------------------------------------------------------------------
  // SUITE 4: Adversarial & Resiliency Stress Tests
  // -----------------------------------------------------------------------
  log('\n=== SUITE 4: Adversarial & Resiliency Stress Tests ===');

  await test('4.1 Hostile / edge-case inputs handled gracefully without throwing', async () => {
    // Malformed JSON strings or strange objects
    const zip1 = await generateOfflineZip(undefined, '{ not valid json }', [1, 2, { a: 'b' }]);
    assert.ok(zip1, 'Must return blob for malformed sensor string');

    const zip2 = await generateOfflineZip('string-video', 12345, 67890, 'raw-meta');
    const parsed2 = parseZipArchive(await zip2.arrayBuffer());
    assert.strictEqual(parsed2.localFiles.length, 4);

    const zip3 = await generateOfflineZip(new Uint8Array(0), '', '', '');
    const parsed3 = parseZipArchive(await zip3.arrayBuffer());
    assert.strictEqual(parsed3.localFiles.length, 4);
  });

  await test('4.2 Multi-megabyte payload simulation (5MB buffer) with CRC validation', async () => {
    const fiveMb = new Uint8Array(5 * 1024 * 1024);
    // Fill pseudo-random patterns to test CRC-32 performance and correctness
    for (let i = 0; i < fiveMb.length; i += 4096) {
      fiveMb[i] = (i * 31) & 0xFF;
      fiveMb[i + 1] = (i * 17) & 0xFF;
    }

    const t0 = Date.now();
    const zipBlob = await generateOfflineZip(fiveMb, '[]', '[]');
    const elapsed = Date.now() - t0;

    const arrayBuf = await zipBlob.arrayBuffer();
    const parsed = parseZipArchive(arrayBuf);
    assert.strictEqual(parsed.localFiles[0].uncompSize, 5 * 1024 * 1024);
    assert.strictEqual(parsed.localFiles[0].crc32, computeReferenceCRC32(fiveMb));
    log(`    -> 5MB ZIP generated & verified in ${elapsed}ms`);
  });

  await test('4.3 Unicode characters in filenames and JSON metadata preserved via UTF-8 flag', async () => {
    const unicodeSensor = JSON.stringify({
      roomName: 'Woonkamer & Keuken — 0.5x groothoekopname',
      technician: 'René van der Vloer 🏠🔨',
      notes: 'Plinten: 15.4m², Hoogte: 2.65m ± 0.02m'
    });

    const zipBlob = await generateOfflineZip(new Uint8Array([1, 2, 3]), unicodeSensor, '[]');
    const arrayBuf = await zipBlob.arrayBuffer();
    const parsed = parseZipArchive(arrayBuf);

    const sensorFile = parsed.localFiles.find(f => f.name === 'sensor_data.json');
    assert.strictEqual(sensorFile.flags & 0x0800, 0x0800, 'Bit 11 (UTF-8) must be set in header flags');

    const decoded = JSON.parse(new TextDecoder().decode(sensorFile.data));
    assert.strictEqual(decoded.roomName, 'Woonkamer & Keuken — 0.5x groothoekopname');
    assert.strictEqual(decoded.technician, 'René van der Vloer 🏠🔨');
  });

  await test('4.4 High concurrency: 10 simultaneous generateOfflineZip invocations', async () => {
    const tasks = [];
    for (let i = 0; i < 10; i++) {
      const vid = new Uint8Array([i, i + 1, i + 2]);
      const sensors = [{ index: i, val: `sensor-${i}` }];
      tasks.push(generateOfflineZip(vid, sensors, [{ frame: i }]));
    }

    const results = await Promise.all(tasks);
    assert.strictEqual(results.length, 10);

    for (let i = 0; i < 10; i++) {
      const parsed = parseZipArchive(await results[i].arrayBuffer());
      const sensorEntry = parsed.localFiles.find(f => f.name === 'sensor_data.json');
      const data = JSON.parse(new TextDecoder().decode(sensorEntry.data));
      assert.strictEqual(data[0].index, i, `Concurrent payload ${i} must preserve isolated state`);
    }
  });

  // -----------------------------------------------------------------------
  // SUITE 5: Static & Runtime Contract Audit on scanner.html
  // -----------------------------------------------------------------------
  log('\n=== SUITE 5: Static & Runtime Contract Audit on scanner.html ===');

  await test('5.1 #download-offline-zip-btn element exists in scanner.html source', async () => {
    const htmlPath = path.resolve(__dirname, '..', 'scanner.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(html.includes('id="download-offline-zip-btn"'), 'scanner.html must contain id="download-offline-zip-btn"');
    assert.ok(html.includes('Download Scan ZIP lokaal'), 'scanner.html must contain label "Download Scan ZIP lokaal"');
    assert.ok(html.includes('#download-offline-zip-btn'), 'scanner.html must style #download-offline-zip-btn');
  });

  await test('5.2 generateOfflineZip is exposed on window and module.exports', async () => {
    const testEnv = loadScannerEnvironment();
    assert.strictEqual(typeof testEnv.generateOfflineZip, 'function', 'generateOfflineZip must be exported as function');
    assert.strictEqual(typeof testEnv.sandbox.window.generateOfflineZip, 'function', 'window.generateOfflineZip must be defined');
    assert.strictEqual(typeof testEnv.controller.generateOfflineZip, 'function', 'controller.generateOfflineZip must be defined');
  });

  await test('5.3 Zero external CDN dependency: functions when window.JSZip is undefined', async () => {
    const testEnv = loadScannerEnvironment();
    testEnv.sandbox.window.JSZip = undefined;
    testEnv.sandbox.JSZip = undefined;

    const zipBlob = await testEnv.generateOfflineZip(new Uint8Array([42]), '[]', '[]');
    assert.ok(zipBlob, 'Must generate ZIP without JSZip');
    assert.strictEqual(zipBlob.type, 'application/zip');
    assert.ok(zipBlob.size > 0, 'Generated ZIP must have non-zero size');
  });

  // -----------------------------------------------------------------------
  // SUMMARY
  // -----------------------------------------------------------------------
  log('\n====================================================================');
  log('OFFLINE FALLBACK & PKZIP TEST SUMMARY:');
  log(`Total Tests Run : ${passedTests + failedTests}`);
  log(`Passed          : ${passedTests}`);
  log(`Failed          : ${failedTests}`);
  log(`Pass Rate       : ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
  log('====================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal error during test runner execution:', err);
  process.exit(1);
});
