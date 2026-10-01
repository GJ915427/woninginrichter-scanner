/**
 * test_m2_empirical_challenger.js
 * 
 * Deep Empirical Adversarial Challenge Suite for Milestone 2:
 * Netwerk, Tunnel & Offline Fallback (R2).
 * 
 * Evaluates:
 * 1. Zero-dependency PKZIP format compliance and 32-bit binary layout invariants.
 * 2. Multi-megabyte payloads (10MB, 25MB) under strict memory and time constraints.
 * 3. Pathological and corrupted inputs (null, undefined, malformed JSON, strings, circular).
 * 4. High-surrogate Unicode and emoji UTF-8 compliance (Flag 0x0800).
 * 5. High-frequency rapid network status toggling and sticky UI fallbacks.
 * 6. Generates artifact ZIP files for Python zipfile independent oracle extraction.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const zlib = require('zlib');

const ARTIFACTS_DIR = path.resolve(__dirname, 'artifacts');
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function log(msg) {
  console.log(msg);
}

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ name, err });
    console.error(`  [FAIL] ${name}`);
    console.error(`         -> ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
  }
}

// Low-level binary ZIP parser for structural inspection
function parseZipBinary(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  
  // Find EOCD (starts with 0x06054b50)
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  
  if (eocdOffset === -1) {
    throw new Error('EOCD signature PK\\x05\\x06 not found in buffer');
  }

  const eocd = {
    offset: eocdOffset,
    diskNumber: bytes.readUInt16LE(eocdOffset + 4),
    cdStartDisk: bytes.readUInt16LE(eocdOffset + 6),
    entriesOnDisk: bytes.readUInt16LE(eocdOffset + 8),
    totalEntries: bytes.readUInt16LE(eocdOffset + 10),
    cdSize: bytes.readUInt32LE(eocdOffset + 12),
    cdOffset: bytes.readUInt32LE(eocdOffset + 16),
    commentLength: bytes.readUInt16LE(eocdOffset + 20)
  };

  const centralDirectory = [];
  let curCdOffset = eocd.cdOffset;
  for (let i = 0; i < eocd.totalEntries; i++) {
    const sig = bytes.readUInt32LE(curCdOffset);
    if (sig !== 0x02014b50) {
      throw new Error(`Invalid Central Directory header signature at offset ${curCdOffset}: 0x${sig.toString(16)}`);
    }

    const versionMadeBy = bytes.readUInt16LE(curCdOffset + 4);
    const versionNeeded = bytes.readUInt16LE(curCdOffset + 6);
    const flags = bytes.readUInt16LE(curCdOffset + 8);
    const method = bytes.readUInt16LE(curCdOffset + 10);
    const dosTime = bytes.readUInt16LE(curCdOffset + 12);
    const dosDate = bytes.readUInt16LE(curCdOffset + 14);
    const crc32 = bytes.readUInt32LE(curCdOffset + 16);
    const compressedSize = bytes.readUInt32LE(curCdOffset + 20);
    const uncompressedSize = bytes.readUInt32LE(curCdOffset + 24);
    const fileNameLength = bytes.readUInt16LE(curCdOffset + 28);
    const extraLength = bytes.readUInt16LE(curCdOffset + 30);
    const commentLength = bytes.readUInt16LE(curCdOffset + 32);
    const localHeaderOffset = bytes.readUInt32LE(curCdOffset + 42);

    const fileName = bytes.toString('utf8', curCdOffset + 46, curCdOffset + 46 + fileNameLength);

    centralDirectory.push({
      fileName,
      versionMadeBy,
      versionNeeded,
      flags,
      method,
      dosTime,
      dosDate,
      crc32,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      cdEntryLength: 46 + fileNameLength + extraLength + commentLength
    });

    curCdOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  const localFiles = [];
  for (const cd of centralDirectory) {
    const lhOffset = cd.localHeaderOffset;
    const lhSig = bytes.readUInt32LE(lhOffset);
    if (lhSig !== 0x04034b50) {
      throw new Error(`Invalid Local Header signature for ${cd.fileName} at ${lhOffset}: 0x${lhSig.toString(16)}`);
    }

    const versionNeeded = bytes.readUInt16LE(lhOffset + 4);
    const flags = bytes.readUInt16LE(lhOffset + 6);
    const method = bytes.readUInt16LE(lhOffset + 8);
    const dosTime = bytes.readUInt16LE(lhOffset + 10);
    const dosDate = bytes.readUInt16LE(lhOffset + 12);
    const crc32 = bytes.readUInt32LE(lhOffset + 14);
    const compressedSize = bytes.readUInt32LE(lhOffset + 18);
    const uncompressedSize = bytes.readUInt32LE(lhOffset + 22);
    const fileNameLength = bytes.readUInt16LE(lhOffset + 26);
    const extraLength = bytes.readUInt16LE(lhOffset + 28);

    const nameStart = lhOffset + 30;
    const fileName = bytes.toString('utf8', nameStart, nameStart + fileNameLength);
    const dataStart = nameStart + fileNameLength + extraLength;
    const data = bytes.subarray(dataStart, dataStart + compressedSize);

    localFiles.push({
      fileName,
      versionNeeded,
      flags,
      method,
      dosTime,
      dosDate,
      crc32,
      compressedSize,
      uncompressedSize,
      data,
      lhOffset,
      totalLength: 30 + fileNameLength + extraLength + compressedSize
    });
  }

  return { bytes, eocd, centralDirectory, localFiles };
}

// Compute reference IEEE 802.3 CRC32 via zlib
function refCrc32(data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return zlib.crc32(buf);
}

// Sandbox builder for scanner.html
function createMockElement(id = '') {
  return {
    id,
    tagName: 'DIV',
    style: { display: '' },
    classList: {
      _classes: new Set(),
      add(cls) { this._classes.add(cls); },
      remove(cls) { this._classes.delete(cls); },
      contains(cls) { return this._classes.has(cls); }
    },
    disabled: false,
    innerHTML: '',
    innerText: '',
    dataset: {},
    _listeners: {},
    addEventListener(evt, fn) {
      if (!this._listeners[evt]) this._listeners[evt] = [];
      this._listeners[evt].push(fn);
    },
    removeEventListener(evt, fn) {
      if (this._listeners[evt]) {
        this._listeners[evt] = this._listeners[evt].filter(f => f !== fn);
      }
    },
    async click() {
      if (this.disabled) return;
      if (this._listeners['click']) {
        for (const fn of this._listeners['click']) {
          await fn({ target: this, preventDefault: () => {} });
        }
      }
    }
  };
}

function loadScannerEnvironment() {
  const htmlPath = path.resolve(__dirname, '..', 'scanner.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  const allScripts = [...htmlContent.matchAll(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi)];
  const appScript = allScripts.find(s => s[1].includes('generateOfflineZip')) || allScripts[allScripts.length - 1];
  if (!appScript) throw new Error('No script containing generateOfflineZip found in scanner.html');
  const scriptCode = appScript[1];

  const elements = {};
  function getEl(id) {
    if (!elements[id]) {
      elements[id] = createMockElement(id);
    }
    return elements[id];
  }

  const createdElements = [];
  const mockDoc = {
    getElementById: getEl,
    createElement: (tag) => {
      const el = createMockElement(tag);
      el.tagName = (tag || 'DIV').toUpperCase();
      createdElements.push(el);
      return el;
    },
    body: {
      appendChild: () => {},
      removeChild: () => {}
    },
    _elements: elements,
    _createdElements: createdElements
  };

  const windowListeners = {};
  const mockNavigator = {
    onLine: true,
    mediaDevices: {
      enumerateDevices: async () => [],
      getUserMedia: async () => ({ getTracks: () => [] })
    }
  };

  const sandbox = {
    document: mockDoc,
    navigator: mockNavigator,
    location: { protocol: 'https:', hostname: 'localhost', origin: 'https://localhost', href: 'https://localhost/scanner.html', port: '443' },
    URL: {
      createObjectURL: (blob) => `blob:mock-zip-${Date.now()}`,
      revokeObjectURL: () => {}
    },
    Uint8Array,
    Uint16Array,
    Uint32Array,
    DataView,
    ArrayBuffer,
    Buffer,
    Blob: typeof Blob !== 'undefined' ? Blob : require('buffer').Blob,
    TextEncoder: typeof TextEncoder !== 'undefined' ? TextEncoder : require('util').TextEncoder,
    window: {
      addEventListener: (evt, fn) => {
        if (!windowListeners[evt]) windowListeners[evt] = [];
        windowListeners[evt].push(fn);
      },
      removeEventListener: (evt, fn) => {
        if (windowListeners[evt]) {
          windowListeners[evt] = windowListeners[evt].filter(f => f !== fn);
        }
      },
      dispatchEvent: async (evt) => {
        const type = typeof evt === 'string' ? evt : evt.type;
        if (windowListeners[type]) {
          for (const fn of windowListeners[type]) {
            await fn(evt);
          }
        }
      },
      performance: { now: () => Date.now() },
      setInterval: () => 1,
      clearInterval: () => {},
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (id) => clearTimeout(id),
      fetch: async () => ({ ok: true, status: 200, json: async () => ({}) })
    },
    performance: { now: () => Date.now() },
    fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
    console: {
      log: () => {},
      warn: () => {},
      error: (...args) => console.log('CAUGHT ERR:', ...args)
    },
    alert: () => {},
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: () => 1,
    clearInterval: () => {},
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
    nav: mockNavigator,
    windowListeners,
    generateOfflineZip: sandbox.module.exports.generateOfflineZip || sandbox.window.generateOfflineZip,
    updateNetworkStatus: sandbox.module.exports.updateNetworkStatus || sandbox.window.updateNetworkStatus,
    controller: sandbox.module.exports.cameraController || sandbox.window.cameraController
  };
}

async function runChallengerTests() {
  log('====================================================================');
  log('STARTING EMPIRICAL ADVERSARIAL CHALLENGE SUITE (MILESTONE 2: R2)');
  log('====================================================================\n');

  const env = loadScannerEnvironment();
  const generateOfflineZip = env.generateOfflineZip;

  // ------------------------------------------------------------------
  // SUITE 1: Binary Specification Adherence & Structural Invariants
  // ------------------------------------------------------------------
  log('=== SUITE 1: Binary Specification Adherence & Invariants ===');

  await test('1.1 Exact alignment of Local Headers and Central Directory relative offsets', async () => {
    const video = new Uint8Array([0x1A, 0x45, 0xDF, 0xA3, 0x01, 0x02, 0x03]);
    const sensors = JSON.stringify([{ t: 100, ax: 0.1, ay: 9.81, az: 0.2 }]);
    const frames = JSON.stringify([{ frame: 0, ts: 100 }]);
    const meta = { scanId: 'align-test', ts: new Date().toISOString() };

    const zipBlob = await generateOfflineZip(video, sensors, frames, meta);
    const buf = Buffer.from(await zipBlob.arrayBuffer());
    const parsed = parseZipBinary(buf);

    assert.strictEqual(parsed.centralDirectory.length, 4, 'Must contain 4 files');
    
    // Validate each file offset
    for (let i = 0; i < parsed.centralDirectory.length; i++) {
      const cd = parsed.centralDirectory[i];
      const lh = parsed.localFiles[i];
      assert.strictEqual(cd.fileName, lh.fileName, `CD and LH filename mismatch at ${i}`);
      assert.strictEqual(cd.localHeaderOffset, lh.lhOffset, `Offset mismatch for ${cd.fileName}`);
      assert.strictEqual(cd.crc32, lh.crc32, `CRC mismatch between CD and LH for ${cd.fileName}`);
      assert.strictEqual(cd.compressedSize, lh.compressedSize, `Compressed size mismatch for ${cd.fileName}`);
      assert.strictEqual(cd.uncompressedSize, lh.uncompressedSize, `Uncompressed size mismatch for ${cd.fileName}`);
    }

    // Verify EOCD offsets
    const lastFile = parsed.localFiles[parsed.localFiles.length - 1];
    const expectedCdOffset = lastFile.lhOffset + lastFile.totalLength;
    assert.strictEqual(parsed.eocd.cdOffset, expectedCdOffset, 'CD offset in EOCD must follow last local file');
    
    const calculatedCdSize = parsed.centralDirectory.reduce((sum, cd) => sum + cd.cdEntryLength, 0);
    assert.strictEqual(parsed.eocd.cdSize, calculatedCdSize, 'EOCD cdSize must match sum of CD headers');
    assert.strictEqual(parsed.eocd.offset + 22, buf.length, 'No trailing garbage after EOCD');
  });

  await test('1.2 Method 0 (Stored) verbatim data fidelity without compression alteration', async () => {
    const rawVideo = Buffer.from('TEST_VIDEO_BYTES_PAYLOAD_' + 'X'.repeat(500));
    const zipBlob = await generateOfflineZip(rawVideo, '{"test":123}', '[]');
    const buf = Buffer.from(await zipBlob.arrayBuffer());
    const parsed = parseZipBinary(buf);

    const videoEntry = parsed.localFiles.find(f => f.fileName.startsWith('recording.'));
    assert(videoEntry, 'Video file entry must exist');
    assert.strictEqual(videoEntry.method, 0, 'Method must be 0 (Stored)');
    assert.strictEqual(videoEntry.compressedSize, rawVideo.length);
    assert.strictEqual(videoEntry.uncompressedSize, rawVideo.length);
    assert(rawVideo.equals(videoEntry.data), 'Payload data must match byte-for-byte');
  });

  await test('1.3 IEEE 802.3 CRC-32 integrity matches zlib reference across binary test vectors', async () => {
    const vectors = [
      Buffer.alloc(0),
      Buffer.from('123456789', 'ascii'),
      Buffer.from('The quick brown fox jumps over the lazy dog'),
      Buffer.from([0x00, 0xFF, 0x80, 0x7F, 0xAA, 0x55, 0x01, 0xFE]),
      Buffer.alloc(65536, 0xA5)
    ];

    for (const vec of vectors) {
      const expectedCrc = refCrc32(vec);
      const zipBlob = await generateOfflineZip(vec, '[]', '[]');
      const buf = Buffer.from(await zipBlob.arrayBuffer());
      const parsed = parseZipBinary(buf);
      const videoEntry = parsed.localFiles.find(f => f.fileName.startsWith('recording.'));
      assert.strictEqual(videoEntry.crc32, expectedCrc, `CRC mismatch for vector of length ${vec.length}: expected ${expectedCrc}, got ${videoEntry.crc32}`);
    }
  });

  await test('1.4 UTF-8 General Purpose Bit Flag (0x0800) and DOS datetime consistency', async () => {
    const zipBlob = await generateOfflineZip(new Uint8Array(10), '[]', '[]');
    const buf = Buffer.from(await zipBlob.arrayBuffer());
    const parsed = parseZipBinary(buf);

    for (const cd of parsed.centralDirectory) {
      assert.strictEqual(cd.flags & 0x0800, 0x0800, `Flag 0x0800 (bit 11) must be set for ${cd.fileName}`);
      
      // DOS date: year is (date >> 9) + 1980
      const year = ((cd.dosDate >> 9) & 0x7F) + 1980;
      const month = (cd.dosDate >> 5) & 0x0F;
      const day = cd.dosDate & 0x1F;
      assert(year >= 2026, `DOS year must be >= 2026, got ${year}`);
      assert(month >= 1 && month <= 12, `DOS month must be 1..12, got ${month}`);
      assert(day >= 1 && day <= 31, `DOS day must be 1..31, got ${day}`);
    }
  });

  // ------------------------------------------------------------------
  // SUITE 2: Multi-Megabyte Stress & Memory Benchmarks
  // ------------------------------------------------------------------
  log('\n=== SUITE 2: Multi-Megabyte Stress & Benchmarks ===');

  await test('2.1 10 Megabyte payload buffer packaging and CRC-32 validation', async () => {
    const size = 10 * 1024 * 1024;
    const tenMb = Buffer.alloc(size);
    // Fill with non-zero pseudorandom pattern
    for (let i = 0; i < size; i += 4096) {
      tenMb.writeUInt32LE((i * 1103515245 + 12345) >>> 0, i);
    }
    const expectedCrc = refCrc32(tenMb);

    const t0 = Date.now();
    const zipBlob = await generateOfflineZip(tenMb, '[]', '[]');
    const duration = Date.now() - t0;

    log(`    -> 10MB ZIP generated in ${duration}ms`);
    assert(duration < 1500, `10MB ZIP packaging took too long: ${duration}ms > 1500ms`);

    const buf = Buffer.from(await zipBlob.arrayBuffer());
    const parsed = parseZipBinary(buf);
    const videoEntry = parsed.localFiles.find(f => f.fileName.startsWith('recording.'));

    assert.strictEqual(videoEntry.uncompressedSize, size);
    assert.strictEqual(videoEntry.compressedSize, size);
    assert.strictEqual(videoEntry.crc32, expectedCrc);

    // Save artifact for Python verification
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'archive_10mb.zip'), buf);
  });

  await test('2.2 25 Megabyte large video simulation with 32-bit offset verification', async () => {
    const size = 25 * 1024 * 1024;
    const twentyFiveMb = Buffer.alloc(size, 0x7E); // 25MB buffer
    const expectedCrc = refCrc32(twentyFiveMb);

    const t0 = Date.now();
    const zipBlob = await generateOfflineZip(twentyFiveMb, '[]', '[]');
    const duration = Date.now() - t0;

    log(`    -> 25MB ZIP generated in ${duration}ms`);
    assert(duration < 3000, `25MB ZIP packaging took too long: ${duration}ms > 3000ms`);

    const buf = Buffer.from(await zipBlob.arrayBuffer());
    const parsed = parseZipBinary(buf);
    const videoEntry = parsed.localFiles.find(f => f.fileName.startsWith('recording.'));

    assert.strictEqual(videoEntry.uncompressedSize, size);
    assert.strictEqual(videoEntry.compressedSize, size);
    assert.strictEqual(videoEntry.crc32, expectedCrc);
    assert(parsed.eocd.cdOffset >= size, 'CD offset must be >= 25MB');

    // Save artifact for Python verification
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'archive_25mb.zip'), buf);
  });

  // ------------------------------------------------------------------
  // SUITE 3: Hostile, Malformed & Edge-Case Inputs
  // ------------------------------------------------------------------
  log('\n=== SUITE 3: Hostile, Malformed & Edge-Case Inputs ===');

  await test('3.1 Completely empty buffers (0-byte video, empty JSON strings)', async () => {
    const zipBlob = await generateOfflineZip(new Uint8Array(0), '', '', '');
    const buf = Buffer.from(await zipBlob.arrayBuffer());
    const parsed = parseZipBinary(buf);

    assert.strictEqual(parsed.centralDirectory.length, 4);
    for (const f of parsed.localFiles) {
      assert.strictEqual(f.compressedSize, 0);
      assert.strictEqual(f.uncompressedSize, 0);
      assert.strictEqual(f.crc32, 0);
    }
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'archive_empty.zip'), buf);
  });

  await test('3.2 Null and undefined arguments without throwing uncaught errors', async () => {
    const zipBlob = await generateOfflineZip(null, null, null, null);
    assert(zipBlob, 'Must return a Blob even when all args are null');
    const buf = Buffer.from(await zipBlob.arrayBuffer());
    const parsed = parseZipBinary(buf);
    assert.strictEqual(parsed.centralDirectory.length, 4);
  });

  await test('3.3 Hostile video inputs (ArrayBuffer, Buffer, number, string, object)', async () => {
    // ArrayBuffer
    const ab = new ArrayBuffer(16);
    const z1 = await generateOfflineZip(ab, '[]', '[]');
    assert(z1 && (await z1.arrayBuffer()).byteLength > 0);

    // Buffer
    const nodeBuf = Buffer.from('hello-node-buffer');
    const z2 = await generateOfflineZip(nodeBuf, '[]', '[]');
    assert(z2 && (await z2.arrayBuffer()).byteLength > 0);

    // Raw string (e.g. data URI or corrupted string)
    const str = 'data:video/mp4;base64,AAAA';
    const z3 = await generateOfflineZip(str, '[]', '[]');
    assert(z3 && (await z3.arrayBuffer()).byteLength > 0);

    // Hostile object
    const hostileObj = { dummy: true, length: 100 };
    const z4 = await generateOfflineZip(hostileObj, '[]', '[]');
    assert(z4 && (await z4.arrayBuffer()).byteLength > 0);
  });

  await test('3.4 Malformed and non-JSON telemetry strings preserved safely', async () => {
    const malformedJson = '{ "sensors": [ { unquoted_key: 123, truncated: ';
    const zipBlob = await generateOfflineZip(new Uint8Array(5), malformedJson, '{ bad json');
    const buf = Buffer.from(await zipBlob.arrayBuffer());
    const parsed = parseZipBinary(buf);

    const sensorEntry = parsed.localFiles.find(f => f.fileName === 'sensor_data.json');
    assert.strictEqual(sensorEntry.data.toString('utf8'), malformedJson, 'Malformed JSON must be stored verbatim');
  });

  await test('3.5 High-surrogate Unicode and Emojis in metadata and telemetry', async () => {
    const unicodeSensor = JSON.stringify({
      device: 'Woninginrichter Phone 📐 🎥 🚀',
      room: 'Woonkamer & Keuken — 3,5m × 4,2m — Grüß Gott — 部屋 — 𠜎',
      symbols: '©®™ €$¥ ∭ ∇ ℵ₀ ⨀'
    });

    const zipBlob = await generateOfflineZip(new Uint8Array([1, 2, 3]), unicodeSensor, '[]', { note: 'Emoji-Test 🎨' });
    const buf = Buffer.from(await zipBlob.arrayBuffer());
    const parsed = parseZipBinary(buf);

    const sensorEntry = parsed.localFiles.find(f => f.fileName === 'sensor_data.json');
    assert.strictEqual(sensorEntry.data.toString('utf8'), unicodeSensor);
    assert.strictEqual(sensorEntry.crc32, refCrc32(Buffer.from(unicodeSensor, 'utf8')));

    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'archive_unicode.zip'), buf);
  });

  await test('3.6 Codec determination: MP4 container vs WebM container naming', async () => {
    // 1. WebM default
    const webmBlob = { type: 'video/webm;codecs=vp9', arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
    const zWebm = await generateOfflineZip(webmBlob, '[]', '[]');
    const pWebm = parseZipBinary(Buffer.from(await zWebm.arrayBuffer()));
    assert(pWebm.localFiles.some(f => f.fileName === 'recording.webm'), 'WebM must be named recording.webm');

    // 2. MP4 blob type
    const mp4Blob = { type: 'video/mp4;codecs=avc1', arrayBuffer: async () => new Uint8Array([4, 5, 6]).buffer };
    const zMp4 = await generateOfflineZip(mp4Blob, '[]', '[]');
    const pMp4 = parseZipBinary(Buffer.from(await zMp4.arrayBuffer()));
    assert(pMp4.localFiles.some(f => f.fileName === 'recording.mp4'), 'MP4 must be named recording.mp4');

    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'archive_mp4.zip'), Buffer.from(await zMp4.arrayBuffer()));
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'archive_default.zip'), Buffer.from(await zWebm.arrayBuffer()));
  });

  await test('3.7 High Concurrency: 20 simultaneous packaging requests', async () => {
    const tasks = [];
    for (let i = 0; i < 20; i++) {
      const payload = Buffer.from(`CONCURRENT_TASK_PAYLOAD_${i}_` + 'Z'.repeat(1000));
      tasks.push(generateOfflineZip(payload, `[{"task":${i}}]`, `[{"frame":${i}}]`));
    }
    const results = await Promise.all(tasks);
    assert.strictEqual(results.length, 20);

    for (let i = 0; i < 20; i++) {
      const buf = Buffer.from(await results[i].arrayBuffer());
      const parsed = parseZipBinary(buf);
      const frameFile = parsed.localFiles.find(f => f.fileName === 'frame_timestamps.json');
      assert(frameFile.data.toString('utf8').includes(`"frame":${i}`), `Concurrency cross-talk detected on task ${i}`);
    }
  });

  // ------------------------------------------------------------------
  // SUITE 4: Network Status & Emergency HUD Trigger Logic
  // ------------------------------------------------------------------
  log('\n=== SUITE 4: Network Status & Emergency HUD Trigger Logic ===');

  await test('4.1 Rapid toggling: 50 back-to-back online/offline transitions', async () => {
    const testEnv = loadScannerEnvironment();
    const btn = testEnv.doc.getElementById('download-offline-zip-btn');

    for (let i = 0; i < 50; i++) {
      const isOnline = (i % 2 === 0);
      testEnv.nav.onLine = isOnline;
      testEnv.updateNetworkStatus();
      if (!isOnline) {
        assert.strictEqual(btn.style.display, 'flex');
        assert(!btn.classList.contains('hidden'));
      } else {
        assert.strictEqual(btn.style.display, 'none');
        assert(btn.classList.contains('hidden'));
      }
    }
  });

  await test('4.2 Sticky error state: Upload network failure preserves button visibility on reconnect', async () => {
    const testEnv = loadScannerEnvironment();
    const btn = testEnv.doc.getElementById('download-offline-zip-btn');

    // Simulate upload failure (as done in scanner.html lines 1282-1287)
    btn.dataset.keepVisible = 'true';
    btn.style.display = 'flex';
    btn.classList.remove('hidden');

    // Device reconnects (online event)
    testEnv.nav.onLine = true;
    testEnv.updateNetworkStatus();

    // Button MUST remain visible because keepVisible is true
    assert.strictEqual(btn.style.display, 'flex', 'Button must stay visible when keepVisible is set');
    assert(!btn.classList.contains('hidden'), 'Button must not have hidden class');
  });

  await test('4.3 Emergency button click triggers packaging and download anchor creation', async () => {
    const testEnv = loadScannerEnvironment();
    const btn = testEnv.doc.getElementById('download-offline-zip-btn');

    assert.strictEqual(btn.disabled, false);
    // Execute click
    await btn.click();

    // Verify anchor element was created for download
    const createdAnchors = testEnv.doc._createdElements.filter(e => e.tagName === 'A' || e.tagName === 'a');
    assert(createdAnchors.length > 0, 'An <a> download anchor must have been created');
    const anchor = createdAnchors[createdAnchors.length - 1];
    assert(anchor.download && anchor.download.endsWith('.zip'), 'Anchor download attribute must end with .zip');
    assert(anchor.href && anchor.href.startsWith('blob:'), 'Anchor href must be a blob URL');
  });

  // ------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------
  log('\n====================================================================');
  log('EMPIRICAL ADVERSARIAL CHALLENGE SUMMARY:');
  log(`Total Tests Run : ${totalTests}`);
  log(`Passed          : ${passedTests}`);
  log(`Failed          : ${failedTests}`);
  log(`Pass Rate       : ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  log('====================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runChallengerTests().catch(err => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
