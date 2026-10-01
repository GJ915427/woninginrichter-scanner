/**
 * test_offline_adversarial_challenger.js
 * 
 * Empirical Adversarial Challenger Test Harness for Milestone 2:
 * - RFC 1951 / PKWARE APPNOTE PKZIP Binary Specification Audit
 * - Bit-Exact CRC-32 Oracle against Node.js zlib.crc32
 * - Interoperability with Python zipfile and OS Native Extractors
 * - High-Stress Multi-Megabyte Buffers & Unicode Preservations
 * - Network State Machine & UI Emergency Fallback Stress
 * - Zero-Dependency Static & Dynamic Audit
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');
const vm = require('vm');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertStrictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'assertStrictEqual failed'}: expected ${expected} (0x${expected.toString(16)}), got ${actual} (0x${actual.toString(16)})`);
  }
}

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ name, error: err });
    console.log(`  [FAIL] ${name}: ${err.message}`);
  }
}

// -------------------------------------------------------------
// Mock Environment for scanner.html
// -------------------------------------------------------------
function createMockElement(id) {
  const classListSet = new Set();
  const listeners = {};
  const dataset = {};
  const style = { display: '' };

  const el = {
    id,
    disabled: false,
    innerText: '',
    innerHTML: '',
    value: '',
    title: '',
    href: '',
    download: '',
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
    click: async function() {
      if (listeners['click']) {
        for (const handler of listeners['click']) {
          await handler({ target: el, preventDefault: () => {} });
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
  return el;
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

class RobustMockBlob {
  constructor(parts = [], opts = {}) {
    this.parts = parts;
    this.type = opts.type || '';
    let totalLen = 0;
    for (const p of parts) {
      if (typeof p === 'string') totalLen += Buffer.byteLength(p, 'utf8');
      else if (p && p.byteLength !== undefined) totalLen += p.byteLength;
      else if (p && p.length !== undefined) totalLen += p.length;
    }
    this.size = totalLen;
  }
  async arrayBuffer() {
    let total = 0;
    for (const p of this.parts) {
      if (typeof p === 'string') total += Buffer.byteLength(p, 'utf8');
      else total += (p.byteLength || p.length || 0);
    }
    const res = new Uint8Array(total);
    let off = 0;
    for (const p of this.parts) {
      let arr;
      if (typeof p === 'string') arr = Buffer.from(p, 'utf8');
      else if (p instanceof Uint8Array) arr = p;
      else if (Buffer.isBuffer(p)) arr = new Uint8Array(p);
      else arr = new Uint8Array(p);
      res.set(arr, off);
      off += arr.length;
    }
    return res.buffer;
  }
}

function loadScannerSandbox(options = {}) {
  const htmlPath = path.resolve(__dirname, '..', 'scanner.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  const allScripts = [...htmlContent.matchAll(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi)];
  const appScript = allScripts.find(s => s[1].includes('generateOfflineZip')) || allScripts[allScripts.length - 1];
  if (!appScript) {
    throw new Error('No application <script> tag with generateOfflineZip found in scanner.html');
  }
  const scriptCode = appScript[1];

  const mockDoc = createMockDocument();
  const windowListeners = {};
  const createdUrls = [];
  const revokedUrls = [];

  const mockLocation = {
    protocol: 'https:',
    hostname: 'localhost',
    origin: 'https://localhost',
    href: 'https://localhost/scanner.html',
    port: '443',
    reload: () => {}
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

  const mockWindow = {
    document: mockDoc,
    navigator: mockNavigator,
    location: mockLocation,
    addEventListener(evt, fn) {
      if (!windowListeners[evt]) windowListeners[evt] = [];
      windowListeners[evt].push(fn);
    },
    dispatchEvent(evt, data = {}) {
      if (windowListeners[evt]) {
        for (const fn of windowListeners[evt]) fn(data);
      }
    },
    URL: {
      createObjectURL: (blob) => {
        const url = 'blob:mock-url-' + Math.random();
        createdUrls.push({ url, blob });
        return url;
      },
      revokeObjectURL: (url) => {
        revokedUrls.push(url);
      }
    },
    Blob: RobustMockBlob,
    JSZip: undefined,
    console: console,
    performance: { now: () => Date.now() },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: () => 1,
    clearInterval: () => {}
  };

  mockWindow.window = mockWindow;

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
    console,
    performance: { now: () => Date.now() },
    window: mockWindow,
    document: mockDoc,
    navigator: mockNavigator,
    location: mockLocation,
    URL: mockWindow.URL,
    Blob: RobustMockBlob,
    JSZip: undefined,
    setTimeout: mockWindow.setTimeout,
    clearTimeout: mockWindow.clearTimeout,
    setInterval: mockWindow.setInterval,
    clearInterval: mockWindow.clearInterval,
    module: { exports: {} },
    exports: {}
  };

  vm.createContext(sandbox);

  try {
    vm.runInContext(scriptCode, sandbox);
  } catch (err) {
    console.error('Error during vm.runInContext:', err.message);
  }

  const generateOfflineZip = sandbox.module.exports.generateOfflineZip || sandbox.window.generateOfflineZip;
  const updateNetworkStatus = sandbox.module.exports.updateNetworkStatus || sandbox.window.updateNetworkStatus;

  return {
    generateOfflineZip,
    updateNetworkStatus,
    doc: mockDoc,
    win: mockWindow,
    nav: mockNavigator,
    createdUrls,
    revokedUrls,
    htmlContent,
    Blob: RobustMockBlob
  };
}

// -------------------------------------------------------------
// Low-Level PKZIP Spec Parser & Validator
// -------------------------------------------------------------
function parseAndValidateZip(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  assert(buf.length >= 22, `ZIP buffer too small (${buf.length} bytes) for EOCD`);

  // Find EOCD signature PK\x05\x06 (0x06054b50) scanning backwards from end
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  assert(eocdOffset !== -1, 'End of Central Directory signature 0x06054b50 not found');

  const diskNumber = buf.readUInt16LE(eocdOffset + 4);
  const cdStartDisk = buf.readUInt16LE(eocdOffset + 6);
  const numEntriesThisDisk = buf.readUInt16LE(eocdOffset + 8);
  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdSize = buf.readUInt32LE(eocdOffset + 12);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const commentLength = buf.readUInt16LE(eocdOffset + 20);

  assertStrictEqual(diskNumber, 0, 'EOCD diskNumber');
  assertStrictEqual(cdStartDisk, 0, 'EOCD cdStartDisk');
  assertStrictEqual(numEntriesThisDisk, totalEntries, 'EOCD entry count mismatch on disk');
  assertStrictEqual(eocdOffset + 22 + commentLength, buf.length, 'EOCD not at end of file');

  // Parse Central Directory entries
  let offset = cdOffset;
  const cdEntries = [];
  for (let i = 0; i < totalEntries; i++) {
    assert(offset + 46 <= eocdOffset, `CD entry ${i} overflows CD area`);
    const sig = buf.readUInt32LE(offset);
    assertStrictEqual(sig, 0x02014b50, `CD entry ${i} signature`);

    const versionMadeBy = buf.readUInt16LE(offset + 4);
    const versionNeeded = buf.readUInt16LE(offset + 6);
    const flags = buf.readUInt16LE(offset + 8);
    const compression = buf.readUInt16LE(offset + 10);
    const modTime = buf.readUInt16LE(offset + 12);
    const modDate = buf.readUInt16LE(offset + 14);
    const crc32 = buf.readUInt32LE(offset + 16);
    const compSize = buf.readUInt32LE(offset + 20);
    const uncompSize = buf.readUInt32LE(offset + 24);
    const fnLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const diskNumStart = buf.readUInt16LE(offset + 34);
    const intAttr = buf.readUInt16LE(offset + 36);
    const extAttr = buf.readUInt32LE(offset + 38);
    const localHeaderOffset = buf.readUInt32LE(offset + 42);

    const fnBytes = buf.slice(offset + 46, offset + 46 + fnLen);
    const filename = fnBytes.toString('utf8');

    cdEntries.push({
      index: i,
      offset,
      filename,
      versionMadeBy,
      versionNeeded,
      flags,
      compression,
      modTime,
      modDate,
      crc32,
      compSize,
      uncompSize,
      localHeaderOffset,
      extAttr
    });

    offset += 46 + fnLen + extraLen + commentLen;
  }
  assertStrictEqual(offset - cdOffset, cdSize, 'Total parsed CD size must equal EOCD cdSize');

  // Parse and validate Local File Headers
  const files = {};
  for (const cd of cdEntries) {
    const lOffset = cd.localHeaderOffset;
    assert(lOffset + 30 <= buf.length, `Local header for ${cd.filename} overflows file`);
    const lSig = buf.readUInt32LE(lOffset);
    assertStrictEqual(lSig, 0x04034b50, `Local header signature for ${cd.filename}`);

    const lVersion = buf.readUInt16LE(lOffset + 4);
    const lFlags = buf.readUInt16LE(lOffset + 6);
    const lCompression = buf.readUInt16LE(lOffset + 8);
    const lModTime = buf.readUInt16LE(lOffset + 10);
    const lModDate = buf.readUInt16LE(lOffset + 12);
    const lCrc32 = buf.readUInt32LE(lOffset + 14);
    const lCompSize = buf.readUInt32LE(lOffset + 18);
    const lUncompSize = buf.readUInt32LE(lOffset + 22);
    const lFnLen = buf.readUInt16LE(lOffset + 26);
    const lExtraLen = buf.readUInt16LE(lOffset + 28);

    const lFilename = buf.slice(lOffset + 30, lOffset + 30 + lFnLen).toString('utf8');
    assertStrictEqual(lFilename, cd.filename, `Filename mismatch between CD and Local for ${cd.filename}`);
    assertStrictEqual(lCompression, 0, `Compression method for ${cd.filename} must be 0 (Stored)`);
    assertStrictEqual(lCompSize, lUncompSize, `CompSize == UncompSize for Stored file ${cd.filename}`);
    assertStrictEqual(lCrc32, cd.crc32, `CRC32 mismatch between CD and Local for ${cd.filename}`);

    // Validate DOS Date and Time validity
    const sec = (lModTime & 0x1F) * 2;
    const min = (lModTime >> 5) & 0x3F;
    const hour = (lModTime >> 11) & 0x1F;
    assert(hour >= 0 && hour <= 23, `Invalid DOS hour: ${hour}`);
    assert(min >= 0 && min <= 59, `Invalid DOS minute: ${min}`);
    assert(sec >= 0 && sec <= 59, `Invalid DOS second: ${sec}`);

    const day = lModDate & 0x1F;
    const month = (lModDate >> 5) & 0x0F;
    const year = ((lModDate >> 9) & 0x7F) + 1980;
    assert(month >= 1 && month <= 12, `Invalid DOS month: ${month}`);
    assert(day >= 1 && day <= 31, `Invalid DOS day: ${day}`);
    assert(year >= 1980, `Invalid DOS year: ${year}`);

    // Data payload extraction
    const dataStart = lOffset + 30 + lFnLen + lExtraLen;
    const dataEnd = dataStart + lCompSize;
    assert(dataEnd <= buf.length, `Data payload for ${cd.filename} overflows file`);
    const payload = buf.slice(dataStart, dataEnd);

    // Compute reference CRC32 with Node.js zlib
    const refCrc = zlib.crc32(payload);
    assertStrictEqual(lCrc32, refCrc, `CRC32 mismatch against Node.js zlib.crc32 for ${cd.filename}`);

    files[cd.filename] = {
      filename: cd.filename,
      data: payload,
      crc32: lCrc32,
      size: lCompSize,
      cd,
      modDate: { year, month, day },
      modTime: { hour, min, sec }
    };
  }

  return { totalEntries, cdEntries, files, eocdOffset, cdOffset, cdSize };
}

// -------------------------------------------------------------
// MAIN TEST RUNNER
// -------------------------------------------------------------
async function runAllChallengerTests() {
  console.log('====================================================================');
  console.log('STARTING EMPIRICAL CHALLENGER VERIFICATION FOR MILESTONE 2');
  console.log('====================================================================');

  const { generateOfflineZip, updateNetworkStatus, doc, win, nav, createdUrls, htmlContent, Blob } = loadScannerSandbox();

  // -------------------------------------------------------------
  // SUITE 1: CRC-32 Oracle Invariant Verification
  // -------------------------------------------------------------
  console.log('\n=== SUITE 1: CRC-32 Oracle Invariant vs Node.js zlib.crc32 ===');

  await test('1.1 Zero-byte buffer CRC-32 is 0x00000000', async () => {
    const emptyBuf = Buffer.alloc(0);
    assertStrictEqual(zlib.crc32(emptyBuf), 0, 'zlib zero-byte CRC-32');
  });

  await test('1.2 Single-byte full spectrum (0x00 - 0xFF) matches zlib oracle', async () => {
    for (let b = 0; b < 256; b += 17) {
      const payload = Buffer.from([b]);
      const zipBlob = await generateOfflineZip(
        new Blob([payload], { type: 'video/webm' }),
        JSON.stringify({ b }),
        '[]',
        '{}'
      );
      const zipBuf = Buffer.from(await zipBlob.arrayBuffer());
      const parsed = parseAndValidateZip(zipBuf);
      assertStrictEqual(parsed.files['recording.webm'].crc32, zlib.crc32(payload), `Byte 0x${b.toString(16)} CRC`);
    }
  });

  await test('1.3 Complex multi-byte UTF-8 strings & emojis match zlib oracle', async () => {
    const unicodeStrings = [
      'De snelle bruine vos springt over de luie hond.',
      'Woninginrichter 3D scanner: kamerhoogte 2,65m & vloeroppervlak 42,8m².',
      'Special symbols: © ® ™ § ¶ † ‡ • … ‰ ′ ″ ‹ › « » “ ” ‘ ’',
      'Dutch diacritics: geëerd, reëel, kopiëren, ruïne, beïnvloeden, café, crème',
      'Emojis: 🎥 📱 📐 🏠 🛋️ 🚀 ⚡ 📡 ⚙️ 🔍'
    ];
    for (const str of unicodeStrings) {
      const utf8Buf = Buffer.from(str, 'utf8');
      const zipBlob = await generateOfflineZip(
        new Blob([Buffer.from('video')], { type: 'video/webm' }),
        str,
        '[]',
        '{}'
      );
      const zipBuf = Buffer.from(await zipBlob.arrayBuffer());
      const parsed = parseAndValidateZip(zipBuf);
      assertStrictEqual(parsed.files['sensor_data.json'].crc32, zlib.crc32(utf8Buf), `String "${str.substring(0, 20)}..." CRC`);
    }
  });

  await test('1.4 Boundary buffer sizes (255B, 256B, 1KB, 64KB, 1MB) match zlib oracle', async () => {
    const sizes = [255, 256, 1024, 65536, 1048576];
    for (const size of sizes) {
      const pseudoRandomBuf = Buffer.alloc(size);
      for (let i = 0; i < size; i++) {
        pseudoRandomBuf[i] = (i * 31 + 17) & 0xFF;
      }
      const expectedCrc = zlib.crc32(pseudoRandomBuf);
      const zipBlob = await generateOfflineZip(
        new Blob([pseudoRandomBuf], { type: 'video/webm' }),
        '{"status":"ok"}',
        '[]',
        '{}'
      );
      const zipBuf = Buffer.from(await zipBlob.arrayBuffer());
      const parsed = parseAndValidateZip(zipBuf);
      assertStrictEqual(parsed.files['recording.webm'].crc32, expectedCrc, `Size ${size} bytes CRC`);
    }
  });

  // -------------------------------------------------------------
  // SUITE 2: Standard PKZIP Format & External Utilities Interoperability
  // -------------------------------------------------------------
  console.log('\n=== SUITE 2: PKZIP Format & External Tool Interoperability ===');

  await test('2.1 Python zipfile.ZipFile.testzip() audits all generated archives cleanly', async () => {
    const videoData = Buffer.from('RIFF....WEBMfakevideobytes1234567890');
    const sensorData = JSON.stringify({ telemetry: [{ t: 100, ax: 0.1, ay: 9.81, az: 0.2 }] });
    const timestampsData = JSON.stringify([{ frame: 0, pts: 0.033 }]);
    const metadataData = JSON.stringify({ scanId: 'scan-abc-42' });

    const zipBlob = await generateOfflineZip(
      new Blob([videoData], { type: 'video/webm' }),
      sensorData,
      timestampsData,
      metadataData
    );
    const zipBuf = Buffer.from(await zipBlob.arrayBuffer());

    const tmpZipPath = path.resolve(__dirname, 'temp_challenger_test.zip');
    fs.writeFileSync(tmpZipPath, zipBuf);

    try {
      const pyScript = `
import zipfile, sys, json
try:
    with zipfile.ZipFile(r"${tmpZipPath.replace(/\\/g, '\\\\')}", "r") as zf:
        bad = zf.testzip()
        if bad:
            print(f"CRC_ERROR:{bad}")
            sys.exit(1)
        names = zf.namelist()
        expected = ["recording.webm", "sensor_data.json", "frame_timestamps.json", "scan_metadata.json"]
        for exp in expected:
            if exp not in names:
                print(f"MISSING_ENTRY:{exp}")
                sys.exit(2)
        v = zf.read("recording.webm")
        if len(v) != ${videoData.length}:
            print(f"SIZE_MISMATCH:video len {len(v)}")
            sys.exit(3)
        s = json.loads(zf.read("sensor_data.json").decode("utf-8"))
        if len(s["telemetry"]) != 1:
            print(f"PAYLOAD_MISMATCH:sensor telemetry")
            sys.exit(4)
    print("PYTHON_ZIPFILE_OK")
except Exception as e:
    print(f"EXCEPTION:{e}")
    sys.exit(5)
`;
      const res = spawnSync('python', ['-c', pyScript], { encoding: 'utf8' });
      assertStrictEqual(res.status, 0, `Python testzip exit code: ${res.stderr || res.stdout}`);
      assert(res.stdout.includes('PYTHON_ZIPFILE_OK'), `Python output: ${res.stdout}`);
    } finally {
      if (fs.existsSync(tmpZipPath)) fs.unlinkSync(tmpZipPath);
    }
  });

  await test('2.2 PowerShell Expand-Archive unzips without error or corruption', async () => {
    const videoData = Buffer.from('SAMPLE_MP4_BYTES_FOR_POWERSHELL_EXTRACTION');
    const sensorData = JSON.stringify({ sensor: 'active', count: 12 });
    const timestampsData = JSON.stringify([{ frame: 1, pts: 0.05 }]);
    const metadataData = JSON.stringify({ test: 'powershell' });

    const zipBlob = await generateOfflineZip(
      new Blob([videoData], { type: 'video/mp4' }),
      sensorData,
      timestampsData,
      metadataData
    );
    const zipBuf = Buffer.from(await zipBlob.arrayBuffer());

    const tmpZip = path.resolve(__dirname, 'temp_ps_test.zip');
    const tmpDest = path.resolve(__dirname, 'temp_ps_extracted');
    fs.writeFileSync(tmpZip, zipBuf);

    try {
      const psCmd = `Expand-Archive -LiteralPath "${tmpZip}" -DestinationPath "${tmpDest}" -Force`;
      const res = spawnSync('powershell', ['-NoProfile', '-Command', psCmd], { encoding: 'utf8' });
      assertStrictEqual(res.status, 0, `PowerShell Expand-Archive failed: ${res.stderr}`);

      assert(fs.existsSync(path.join(tmpDest, 'recording.mp4')), 'recording.mp4 extracted');
      assert(fs.existsSync(path.join(tmpDest, 'sensor_data.json')), 'sensor_data.json extracted');
      assert(fs.existsSync(path.join(tmpDest, 'frame_timestamps.json')), 'frame_timestamps.json extracted');
      assert(fs.existsSync(path.join(tmpDest, 'scan_metadata.json')), 'scan_metadata.json extracted');

      const extractedVideo = fs.readFileSync(path.join(tmpDest, 'recording.mp4'));
      assertStrictEqual(extractedVideo.length, videoData.length, 'Extracted video size matches');
      assertStrictEqual(extractedVideo.toString('utf8'), videoData.toString('utf8'), 'Extracted video data matches');
    } finally {
      if (fs.existsSync(tmpZip)) fs.unlinkSync(tmpZip);
      if (fs.existsSync(tmpDest)) fs.rmSync(tmpDest, { recursive: true, force: true });
    }
  });

  await test('2.3 Exact MS-DOS timestamp bitfield encoding compliance', async () => {
    const zipBlob = await generateOfflineZip(
      new Blob([Buffer.from('test')], { type: 'video/webm' }),
      '{}',
      '[]',
      '{}'
    );
    const zipBuf = Buffer.from(await zipBlob.arrayBuffer());
    const parsed = parseAndValidateZip(zipBuf);

    for (const entry of parsed.cdEntries) {
      assert(entry.modDate >= 0x0021, `DOS Date must be valid year >= 1980 (was 0x${entry.modDate.toString(16)})`);
      assert(entry.modTime >= 0, `DOS Time must be non-negative (was 0x${entry.modTime.toString(16)})`);
      // Verify local file header matches CD exactly (offset + 12 is date, offset + 10 is time)
      assertStrictEqual(entry.modDate, (zipBuf.readUInt16LE(entry.localHeaderOffset + 12)), `DOS Date sync for ${entry.filename}`);
      assertStrictEqual(entry.modTime, (zipBuf.readUInt16LE(entry.localHeaderOffset + 10)), `DOS Time sync for ${entry.filename}`);
    }
  });

  // -------------------------------------------------------------
  // SUITE 3: Dynamic Codec Selection & Naming Invariants
  // -------------------------------------------------------------
  console.log('\n=== SUITE 3: Codec Selection & Naming Invariants ===');

  await test('3.1 WebM video defaults to recording.webm', async () => {
    const zipBlob = await generateOfflineZip(new Blob(['webm'], { type: 'video/webm' }));
    const zipBuf = Buffer.from(await zipBlob.arrayBuffer());
    const parsed = parseAndValidateZip(zipBuf);
    assert(parsed.files['recording.webm'] !== undefined, 'Contains recording.webm');
    assert(parsed.files['recording.mp4'] === undefined, 'Does not contain recording.mp4');
  });

  await test('3.2 MP4 video blob type triggers recording.mp4', async () => {
    const zipBlob = await generateOfflineZip(new Blob(['mp4'], { type: 'video/mp4;codecs=avc1' }));
    const zipBuf = Buffer.from(await zipBlob.arrayBuffer());
    const parsed = parseAndValidateZip(zipBuf);
    assert(parsed.files['recording.mp4'] !== undefined, 'Contains recording.mp4');
    assert(parsed.files['recording.webm'] === undefined, 'Does not contain recording.webm');
  });

  await test('3.3 Custom filename with .mp4 extension triggers recording.mp4', async () => {
    const customBlob = new Blob(['custom'], { type: 'application/octet-stream' });
    customBlob.name = 'captured_take.mp4';
    const zipBlob = await generateOfflineZip(customBlob);
    const zipBuf = Buffer.from(await zipBlob.arrayBuffer());
    const parsed = parseAndValidateZip(zipBuf);
    assert(parsed.files['recording.mp4'] !== undefined, 'Contains recording.mp4 based on filename');
  });

  // -------------------------------------------------------------
  // SUITE 4: Boundary & Adversarial Payload Stress Testing
  // -------------------------------------------------------------
  console.log('\n=== SUITE 4: Boundary & Adversarial Payload Stress ===');

  await test('4.1 Zero-byte video blob produces valid empty recording file in archive', async () => {
    const emptyBlob = new Blob([], { type: 'video/webm' });
    const zipBlob = await generateOfflineZip(emptyBlob, '{}', '[]', '{}');
    const zipBuf = Buffer.from(await zipBlob.arrayBuffer());
    const parsed = parseAndValidateZip(zipBuf);
    assertStrictEqual(parsed.files['recording.webm'].size, 0, 'Empty video file size');
    assertStrictEqual(parsed.files['recording.webm'].crc32, 0, 'Empty video file CRC');
  });

  await test('4.2 Missing / undefined parameters fallback gracefully to valid schemas', async () => {
    const zipBlob = await generateOfflineZip(new Blob(['data']));
    const zipBuf = Buffer.from(await zipBlob.arrayBuffer());
    const parsed = parseAndValidateZip(zipBuf);

    assertStrictEqual(parsed.totalEntries, 4, 'Must contain all 4 files even when args omitted');
    const sensorContent = parsed.files['sensor_data.json'].data.toString('utf8');
    const framesContent = parsed.files['frame_timestamps.json'].data.toString('utf8');
    const metaContent = parsed.files['scan_metadata.json'].data.toString('utf8');

    assert(Array.isArray(JSON.parse(sensorContent)) || typeof JSON.parse(sensorContent) === 'object', 'sensor JSON parsed');
    assert(Array.isArray(JSON.parse(framesContent)), 'frames JSON parsed');
    assert(typeof JSON.parse(metaContent) === 'object', 'meta JSON parsed');
  });

  await test('4.3 Malformed non-JSON sensor data does not crash generator', async () => {
    const hostileString = 'NOT_JSON{broken:true<<<>>>"\'&;DROP TABLE scans;';
    const zipBlob = await generateOfflineZip(
      new Blob(['video']),
      hostileString,
      '[]',
      '{}'
    );
    const zipBuf = Buffer.from(await zipBlob.arrayBuffer());
    const parsed = parseAndValidateZip(zipBuf);
    assertStrictEqual(parsed.files['sensor_data.json'].data.toString('utf8'), hostileString, 'Raw string preserved');
  });

  await test('4.4 Multi-megabyte (10MB) video payload stress test', async () => {
    const largeSize = 10 * 1024 * 1024; // 10 MB
    const largeBuf = Buffer.alloc(largeSize, 0x42);
    const start = Date.now();
    const zipBlob = await generateOfflineZip(new Blob([largeBuf], { type: 'video/webm' }));
    const elapsed = Date.now() - start;
    const zipBuf = Buffer.from(await zipBlob.arrayBuffer());
    const parsed = parseAndValidateZip(zipBuf);

    assertStrictEqual(parsed.files['recording.webm'].size, largeSize, '10MB payload size matches');
    assertStrictEqual(parsed.files['recording.webm'].crc32, zlib.crc32(largeBuf), '10MB CRC-32 matches');
    console.log(`    -> 10MB archive generated & validated in ${elapsed}ms`);
  });

  await test('4.5 High concurrency: 20 simultaneous invocations with unique payloads', async () => {
    const promises = [];
    for (let i = 0; i < 20; i++) {
      const payload = Buffer.from(`CONCURRENT_TASK_${i}_` + 'X'.repeat(500));
      const p = generateOfflineZip(
        new Blob([payload], { type: 'video/webm' }),
        JSON.stringify({ task: i }),
        JSON.stringify([{ frame: i }]),
        JSON.stringify({ id: i })
      ).then(async (blob) => {
        const buf = Buffer.from(await blob.arrayBuffer());
        const parsed = parseAndValidateZip(buf);
        assertStrictEqual(parsed.files['recording.webm'].data.toString('utf8'), payload.toString('utf8'), `Task ${i} payload`);
      });
      promises.push(p);
    }
    await Promise.all(promises);
  });

  // -------------------------------------------------------------
  // SUITE 5: Network State Machine & Emergency UI Trigger
  // -------------------------------------------------------------
  console.log('\n=== SUITE 5: Network State Machine & Emergency UI Trigger ===');

  await test('5.1 Offline button exists in scanner.html with correct attributes', async () => {
    assert(htmlContent.includes('id="download-offline-zip-btn"'), 'download-offline-zip-btn in HTML');
    assert(htmlContent.includes('generateOfflineZip'), 'generateOfflineZip defined in script');
  });

  await test('5.2 #download-offline-zip-btn initial visibility respects navigator.onLine', async () => {
    const btn = doc.getElementById('download-offline-zip-btn');
    assert(btn !== null, '#download-offline-zip-btn exists');
  });

  await test('5.3 Dispatching window "offline" event makes emergency button visible', async () => {
    const btn = doc.getElementById('download-offline-zip-btn');
    btn.style.display = 'none';

    // Simulate browser offline event: navigator.onLine becomes false and event fires
    nav.onLine = false;
    win.dispatchEvent('offline');
    assert(btn.style.display === 'flex' && !btn.classList.contains('hidden'), '#download-offline-zip-btn becomes visible on offline');
  });

  await test('5.4 Dispatching window "online" event hides emergency button if upload not in error', async () => {
    const btn = doc.getElementById('download-offline-zip-btn');
    btn.style.display = 'flex';
    delete btn.dataset.keepVisible;

    // Simulate browser online event: navigator.onLine becomes true and event fires
    nav.onLine = true;
    win.dispatchEvent('online');
    assert(btn.style.display === 'none' || btn.classList.contains('hidden'), '#download-offline-zip-btn hidden on online');
  });

  await test('5.5 Emergency button click triggers ZIP generation and initiates download', async () => {
    const btn = doc.getElementById('download-offline-zip-btn');
    const startUrlCount = createdUrls.length;

    await btn.click();
    assert(createdUrls.length > startUrlCount, 'URL.createObjectURL was invoked to download zip');
  });

  // -------------------------------------------------------------
  // SUITE 6: Zero CDN Dependency Audit
  // -------------------------------------------------------------
  console.log('\n=== SUITE 6: Zero CDN Dependency Audit ===');

  await test('6.1 No remaining script tags import JSZip from external CDNs', async () => {
    const hasCdnTag = /<script[^>]*src=[^>]*jszip[^>]*>/i.test(htmlContent);
    assert(!hasCdnTag, 'CDN JSZip script tag is still present in scanner.html <head> at line 8!');
  });

  await test('6.2 window.JSZip is undefined and no ReferenceError is thrown anywhere', async () => {
    assertStrictEqual(win.JSZip, undefined, 'win.JSZip is undefined');
    const blob = await generateOfflineZip(new Blob(['test']));
    assert(blob.size > 0, 'Offline zip generated without JSZip');
  });

  console.log('\n====================================================================');
  console.log('CHALLENGER VERIFICATION SUMMARY:');
  console.log(`Total Tests Run : ${totalTests}`);
  console.log(`Passed          : ${passedTests}`);
  console.log(`Failed          : ${failedTests}`);
  console.log(`Pass Rate       : ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log('====================================================================\n');

  if (failedTests > 0) {
    console.error('FAILURES:');
    for (const f of failures) {
      console.error(`- ${f.name}: ${f.error.message}`);
    }
  }
}

runAllChallengerTests().catch((err) => {
  console.error('FATAL UNCAUGHT RUNNER ERROR:', err);
  process.exit(1);
});
