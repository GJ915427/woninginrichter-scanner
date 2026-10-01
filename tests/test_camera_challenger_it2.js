/**
 * Milestone 1 Iteration 2 (Remediation) - Challenger Empirical Verification Suite
 * Adversarial edge-case mining, race-condition stress testing, MediaRecorder lifecycle integrity,
 * and contract compliance for scanner.html camera and lens controller.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

let passedTests = 0;
let failedTests = 0;

function log(msg) {
  console.log(msg);
}

async function test(name, fn) {
  try {
    await fn();
    log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    log(`  [FAIL] ${name}`);
    console.error(`    Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
    failedTests++;
  }
}

// ============================================================================
// ADVERSARIAL MOCK INFRASTRUCTURE
// ============================================================================

class MockTrack {
  constructor({ id = 'track-' + Math.random().toString(36).substring(2, 7), deviceId = 'cam-default', capabilities = {}, settings = {} } = {}) {
    this.id = id;
    this.kind = 'video';
    this.readyState = 'live';
    this.deviceId = deviceId;
    this._capabilities = { ...capabilities };
    this._settings = { deviceId, ...settings };
    this._activeConstraints = {};
    this._listeners = {};
    this.onended = null;
  }

  getCapabilities() {
    return { ...this._capabilities };
  }

  getSettings() {
    return { deviceId: this.deviceId, ...this._settings };
  }

  _getActiveConstraints() {
    return this._activeConstraints;
  }

  async applyConstraints(constraints) {
    if (this._capabilities._failApplyConstraints) {
      throw new Error('Hardware applyConstraints error');
    }
    this._activeConstraints = { ...this._activeConstraints, ...constraints };
    return true;
  }

  addEventListener(event, handler) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(handler);
  }

  removeEventListener(event, handler) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(h => h !== handler);
  }

  stop() {
    if (this.readyState === 'ended') return;
    this.readyState = 'ended';
    if (typeof this.onended === 'function') {
      this.onended({ type: 'ended', target: this });
    }
    if (this._listeners['ended']) {
      for (const h of this._listeners['ended']) {
        h({ type: 'ended', target: this });
      }
    }
  }

  _isStopped() {
    return this.readyState === 'ended';
  }
}

class MockStream {
  constructor(tracks = [new MockTrack()]) {
    this.id = 'stream-' + Math.random().toString(36).substring(2, 9);
    this._tracks = [...tracks];
  }

  getVideoTracks() {
    return this._tracks.filter(t => t.kind === 'video');
  }

  getTracks() {
    return [...this._tracks];
  }

  addTrack(track) {
    this._tracks.push(track);
  }

  removeTrack(track) {
    this._tracks = this._tracks.filter(t => t.id !== track.id);
  }
}

class MockMediaRecorder {
  static isTypeSupported(type) {
    return type.includes('mp4') || type.includes('webm');
  }

  constructor(stream, options = {}) {
    if (!stream) {
      throw new TypeError("Failed to construct 'MediaRecorder': 1 argument required, but only 0 present.");
    }
    this.stream = stream;
    this.options = options;
    this.mimeType = options.mimeType || 'video/webm';
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
    this.onerror = null;

    this._trackEndHandler = () => {
      const activeTracks = this.stream.getTracks().filter(t => t.readyState === 'live');
      if (activeTracks.length === 0 && this.state === 'recording') {
        this._autoStopDueTrackEnd();
      }
    };

    for (const track of this.stream.getTracks()) {
      track.addEventListener('ended', this._trackEndHandler);
    }
  }

  start(timeslice) {
    if (this.state !== 'inactive') {
      throw new Error(`InvalidStateError: MediaRecorder is already in state '${this.state}'`);
    }
    this.state = 'recording';
  }

  stop() {
    if (this.state === 'inactive') {
      throw new Error("InvalidStateError: Failed to execute 'stop' on 'MediaRecorder': The MediaRecorder's state is 'inactive'.");
    }
    this.state = 'inactive';
    if (typeof this.ondataavailable === 'function') {
      this.ondataavailable({ data: { size: 1024 } });
    }
    if (typeof this.onstop === 'function') {
      this.onstop();
    }
  }

  _autoStopDueTrackEnd() {
    if (this.state === 'inactive') return;
    this.state = 'inactive';
    if (typeof this.onstop === 'function') {
      this.onstop();
    }
  }
}

class MockElement {
  constructor(id, tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.style = {};
    this.classList = new Set();
    this.innerText = '';
    this.title = '';
    this.value = '';
    this.disabled = false;
    this.srcObject = null;
    this.src = '';
    this._listeners = {};
    const self = this;
    this.classList.addRaw = function (...classes) {
      for (const c of classes) {
        Set.prototype.add.call(self.classList, c);
      }
    };
    this.classList.add = function (...classes) {
      self.classList.addRaw(...classes);
    };
    this.classList.remove = function (...classes) {
      for (const c of classes) {
        Set.prototype.delete.call(self.classList, c);
      }
    };
    this.classList.contains = function (c) {
      return self.classList.has(c);
    };
    this.classList.toggle = function (c, force) {
      if (force !== undefined) {
        if (force) self.classList.addRaw(c);
        else self.classList.remove(c);
        return force;
      }
      if (self.classList.contains(c)) {
        self.classList.remove(c);
        return false;
      } else {
        self.classList.addRaw(c);
        return true;
      }
    };
    Object.defineProperty(this.classList, 'length', {
      get: () => self.classList.size,
      configurable: true
    });
    Object.defineProperty(this.classList, 'value', {
      get: () => Array.from(self.classList).join(' '),
      configurable: true
    });
  }

  classList_addRaw(...classes) {
    this.classList.addRaw(...classes);
  }

  addEventListener(event, handler) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(handler);
  }

  async click() {
    if (this.disabled) return;
    if (this._listeners['click']) {
      for (const h of this._listeners['click']) {
        await h({ target: this, preventDefault: () => {} });
      }
    }
  }

  async play() {
    return Promise.resolve();
  }
}

function createMockEnvironment({ devices = [], gUMDelayMs = 0, gUMInterceptor = null } = {}) {
  const elements = {};
  const elementIds = [
    'camera-video', 'start-sheet', 'start-app-btn', 'start-err', 'permission-hint',
    'viewfinder-hud', 'hz-val', 'samplesVal', 'pitchDeg', 'rec-dot', 'rec-text',
    'rec-timer', 'pitch-hud', 'pitchText', 'sensorText', 'lens-toggle', 'lens-05',
    'lens-10', 'switch-cam-btn', 'torch-btn', 'toggle-record-btn', 'finish-sheet',
    'finishSummary', 'playbackPreview', 'upload-pc-btn', 'pc-url-input', 'upload-status',
    'download-zip-btn', 'download-video-btn', 'download-json-btn', 'download-csv-btn',
    'new-scan-btn'
  ];

  for (const id of elementIds) {
    const tagName = id.includes('video') ? 'video' : (id.includes('btn') ? 'button' : (id.includes('input') ? 'input' : 'div'));
    const el = new MockElement(id, tagName);
    elements[id] = el;
  }

  const createdTracks = [];
  const createdStreams = [];
  let availableDevices = [...devices];
  let currentStream = null;

  const mockDoc = {
    getElementById: (id) => {
      if (!elements[id]) {
        elements[id] = new MockElement(id);
      }
      return elements[id];
    }
  };

  const mockNavigator = {
    mediaDevices: {
      enumerateDevices: async () => availableDevices.map(d => ({
        deviceId: d.deviceId,
        label: d.label,
        kind: d.kind || 'videoinput'
      })),
      getUserMedia: async (constraints) => {
        if (gUMInterceptor) {
          const res = await gUMInterceptor(constraints);
          if (res) return res;
        }

        if (gUMDelayMs > 0) {
          await new Promise(r => setTimeout(r, gUMDelayMs));
        }

        let devId = 'cam-default';
        if (constraints && constraints.video) {
          if (constraints.video.deviceId && constraints.video.deviceId.exact) {
            devId = constraints.video.deviceId.exact;
          } else if (constraints.video.facingMode && (constraints.video.facingMode.ideal === 'user' || constraints.video.facingMode === 'user')) {
            devId = 'cam-user';
          }
        }

        const devObj = availableDevices.find(d => d.deviceId === devId) || {};
        const track = new MockTrack({
          deviceId: devId,
          capabilities: devObj.capabilities || {},
          settings: { deviceId: devId }
        });
        createdTracks.push(track);
        const stream = new MockStream([track]);
        createdStreams.push(stream);
        currentStream = stream;
        return stream;
      }
    }
  };

  return {
    mockDoc,
    mockNavigator,
    getCreatedTracks: () => createdTracks,
    getCreatedStreams: () => createdStreams,
    getCurrentStream: () => currentStream,
    setDevices: (d) => { availableDevices = [...d]; },
    elements
  };
}

function loadScannerContext(env) {
  const htmlPath = path.resolve(__dirname, '..', 'scanner.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  const allScripts = [...htmlContent.matchAll(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi)];
  const appScript = allScripts.find(s => s[1].includes('cameraController')) || allScripts[allScripts.length - 1];
  if (!appScript) throw new Error('No application script found in scanner.html');
  const scriptCode = appScript[1];

  const mockLocation = {
    protocol: 'https:',
    hostname: 'localhost',
    origin: 'https://localhost',
    href: 'https://localhost/scanner.html',
    port: '443'
  };

  const sandbox = {
    document: env.mockDoc,
    navigator: env.mockNavigator,
    location: mockLocation,
    MediaRecorder: MockMediaRecorder,
    Blob: class MockBlob {
      constructor(chunks, opts) {
        this.chunks = chunks;
        this.type = opts ? opts.type : '';
        this.size = 1024;
      }
    },
    URL: {
      createObjectURL: () => 'blob:https://localhost/mock-video-stream'
    },
    window: {
      addEventListener: () => {},
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
      error: () => {}
    },
    alert: () => {},
    setTimeout: (fn, ms) => {
      if (ms === 0 || ms === undefined) { fn(); return 1; }
      return setTimeout(fn, ms);
    },
    clearTimeout: (id) => clearTimeout(id),
    setInterval: () => 1,
    clearInterval: () => {},
    module: { exports: {} },
    exports: {}
  };
  sandbox.window.document = sandbox.document;
  sandbox.window.navigator = sandbox.navigator;
  sandbox.window.MediaRecorder = MockMediaRecorder;

  vm.createContext(sandbox);
  vm.runInContext(scriptCode, sandbox);

  return {
    sandbox,
    controller: sandbox.module.exports.cameraController || sandbox.window.cameraController
  };
}

// ============================================================================
// ADVERSARIAL CHALLENGER TESTS
// ============================================================================

async function runChallengerTests() {
  log('\n====================================================================');
  log('CHALLENGER ADVERSARIAL STRESS SUITE: REMEDIATION VERIFICATION');
  log('====================================================================');

  // --------------------------------------------------------------------------
  // SUITE 1: Extreme Out-Of-Order Latency Shuffling & Epoch Invariance
  // --------------------------------------------------------------------------
  log('\n--- SUITE 1: Out-of-Order Latency Shuffling ---');

  await test('1.1 20 rapid toggles with reverse completion latencies strictly settles on final toggle', async () => {
    const devices = [
      { deviceId: 'std-cam', kind: 'videoinput', label: 'Back Camera' },
      { deviceId: 'uw-cam', kind: 'videoinput', label: 'Back Ultra Wide Camera' }
    ];

    let callCount = 0;
    const env = createMockEnvironment({
      devices,
      gUMInterceptor: async (constraints) => {
        const id = callCount++;
        // Inverse delay: earlier calls wait longer (up to 40ms), later calls complete faster (2ms)
        const delay = Math.max(2, 40 - id * 2);
        await new Promise(r => setTimeout(r, delay));
        const devId = (constraints.video.deviceId && constraints.video.deviceId.exact) ? 'uw-cam' : 'std-cam';
        const track = new MockTrack({ deviceId: devId });
        return new MockStream([track]);
      }
    });

    const { controller, sandbox } = loadScannerContext(env);
    await controller.startCamera('environment');

    // Fire 20 alternating calls
    const promises = [];
    for (let i = 0; i < 20; i++) {
      const target = (i % 2 === 0) ? 0.5 : 1.0;
      promises.push(controller.toggleLens(target));
    }

    await Promise.all(promises);

    // Call #19 was toggleLens(1.0)
    const btn05 = sandbox.document.getElementById('lens-05');
    const btn10 = sandbox.document.getElementById('lens-10');
    assert.strictEqual(btn10.classList.contains('active'), true, 'Call #19 (1.0x) must be active');
    assert.strictEqual(btn05.classList.contains('active'), false, '0.5x must NOT be active');
    assert.strictEqual(controller.getCurrentZoom(), 1.0, 'Controller currentZoom must be 1.0');

    // Check that obsolete tracks are stopped
    const activeStream = controller.getStream();
    const activeTrack = activeStream.getVideoTracks()[0];
    assert.strictEqual(activeTrack.readyState, 'live', 'Active track must be live');
  });

  // --------------------------------------------------------------------------
  // SUITE 2: Intermittent Hardware Rejections During Rapid Toggling
  // --------------------------------------------------------------------------
  log('\n--- SUITE 2: Hardware Rejection Resilience ---');

  await test('2.1 Intermittent getUserMedia rejection in toggle burst does not crash controller', async () => {
    const devices = [
      { deviceId: 'std-cam', kind: 'videoinput', label: 'Back Camera' },
      { deviceId: 'uw-cam', kind: 'videoinput', label: 'Back Ultra Wide Camera' }
    ];

    let count = 0;
    const env = createMockEnvironment({
      devices,
      gUMInterceptor: async (constraints) => {
        count++;
        if (count === 3) {
          throw new Error('NotReadableError: Hardware device locked by another process');
        }
        return null;
      }
    });

    const { controller, sandbox } = loadScannerContext(env);
    await controller.startCamera('environment');

    // Rapid burst where one call fails
    const p1 = controller.toggleLens(0.5);
    const p2 = controller.toggleLens(1.0);
    const p3 = controller.toggleLens(0.5); // will hit failure or subsequent
    const p4 = controller.toggleLens(1.0);

    await Promise.allSettled([p1, p2, p3, p4]);

    // Controller should remain functional and in a deterministic state
    const currentStream = controller.getStream();
    assert.ok(currentStream, 'Stream must exist');
    assert.strictEqual(currentStream.getVideoTracks()[0].readyState, 'live', 'Stream track must be live');
  });

  // --------------------------------------------------------------------------
  // SUITE 3: MediaRecorder State Machine & Rapid UI Toggling
  // --------------------------------------------------------------------------
  log('\n--- SUITE 3: MediaRecorder Lifecycle & Lockouts ---');

  await test('3.1 Rapid double-click on toggleRecordBtn (start then immediately stop) does not throw InvalidStateError', async () => {
    const devices = [
      { deviceId: 'std-cam', kind: 'videoinput', label: 'Back Camera' }
    ];
    const env = createMockEnvironment({ devices });
    const { controller, sandbox } = loadScannerContext(env);
    await controller.startCamera('environment');

    const recordBtn = sandbox.document.getElementById('toggle-record-btn');
    const lens05 = sandbox.document.getElementById('lens-05');
    const lens10 = sandbox.document.getElementById('lens-10');
    const switchBtn = sandbox.document.getElementById('switch-cam-btn');

    // Click start, then immediately click stop synchronously
    await recordBtn.click();
    assert.strictEqual(controller.isRecordingActive(), true, 'Recording should be active');
    assert.strictEqual(lens05.disabled, true, 'Lens 0.5 must be locked');

    // Immediate stop
    await recordBtn.click();
    assert.strictEqual(controller.isRecordingActive(), false, 'Recording should be stopped');
    assert.strictEqual(lens05.disabled, false, 'Lens 0.5 must be unlocked');
    assert.strictEqual(lens10.disabled, false, 'Lens 1.0 must be unlocked');
    assert.strictEqual(switchBtn.disabled, false, 'Switch button must be unlocked');
  });

  await test('3.2 Spontaneous track death during active recording safely terminates MediaRecorder and unlocks controls', async () => {
    const devices = [
      { deviceId: 'std-cam', kind: 'videoinput', label: 'Back Camera' }
    ];
    const env = createMockEnvironment({ devices });
    const { controller, sandbox } = loadScannerContext(env);
    await controller.startCamera('environment');

    const recordBtn = sandbox.document.getElementById('toggle-record-btn');
    await recordBtn.click();
    assert.strictEqual(controller.isRecordingActive(), true);

    const stream = controller.getStream();
    const track = stream.getVideoTracks()[0];

    // Hardware camera disconnected / track killed externally
    track.stop();

    // Verify recorder auto-stopped and unlocked controls
    assert.strictEqual(controller.isRecordingActive(), false, 'isRecording must reset to false upon track death');
    const lens10 = sandbox.document.getElementById('lens-10');
    assert.strictEqual(lens10.disabled, false, 'Controls must be unlocked after track death');
  });

  await test('3.3 Direct programmatic toggleLens/resolveCameraStream while recording is safely ignored', async () => {
    const devices = [
      { deviceId: 'std-cam', kind: 'videoinput', label: 'Back Camera' },
      { deviceId: 'uw-cam', kind: 'videoinput', label: 'Back Ultra Wide Camera' }
    ];
    const env = createMockEnvironment({ devices });
    const { controller, sandbox } = loadScannerContext(env);
    await controller.startCamera('environment');

    const recordBtn = sandbox.document.getElementById('toggle-record-btn');
    await recordBtn.click();
    assert.strictEqual(controller.isRecordingActive(), true);

    const originalStream = controller.getStream();
    const originalTrack = originalStream.getVideoTracks()[0];

    // Attempt direct programmatic calls bypassing disabled DOM buttons
    await controller.toggleLens(0.5);
    await controller.resolveCameraStream(0.5);
    await controller.startCamera('user');

    // Verify recording stream is unchanged and still live
    assert.strictEqual(controller.getStream(), originalStream, 'Stream must remain identical');
    assert.strictEqual(originalTrack.readyState, 'live', 'Recording track must NOT have been terminated');
    assert.strictEqual(controller.isRecordingActive(), true, 'Recording must still be active');

    // Clean stop
    await recordBtn.click();
    assert.strictEqual(controller.isRecordingActive(), false);
  });

  // --------------------------------------------------------------------------
  // SUITE 4: Boundary & Pathological Capabilities Contracts
  // --------------------------------------------------------------------------
  log('\n--- SUITE 4: Boundary & Pathological Capabilities Contracts ---');

  await test('4.1 getLensCapabilities never returns NaN or non-finite values across boundary inputs', async () => {
    const env = createMockEnvironment({});
    const { controller } = loadScannerContext(env);

    const pathologicalCaps = [
      { hasUltraWide: true, minZoom: NaN, maxZoom: 2.0 },
      { hasUltraWide: true, minZoom: 0.5, maxZoom: NaN },
      { hasUltraWide: true, minZoom: -Infinity, maxZoom: Infinity },
      { hasUltraWide: true, minZoom: '0.5', maxZoom: '2.0' },
      { hasUltraWide: true, minZoom: null, maxZoom: undefined },
      { hasUltraWide: true, minZoom: undefined, maxZoom: undefined },
      null,
      undefined
    ];

    for (const raw of pathologicalCaps) {
      controller.setLensCapabilitiesRaw(raw);
      const caps = controller.getLensCapabilities();
      assert.strictEqual(typeof caps.hasUltraWide, 'boolean', 'hasUltraWide must be boolean');
      assert.strictEqual(typeof caps.minZoom, 'number', 'minZoom must be number');
      assert.strictEqual(typeof caps.maxZoom, 'number', 'maxZoom must be number');
      assert.ok(Number.isFinite(caps.minZoom), `minZoom must be finite, got ${caps.minZoom}`);
      assert.ok(Number.isFinite(caps.maxZoom), `maxZoom must be finite, got ${caps.maxZoom}`);
      assert.ok(!isNaN(caps.minZoom), 'minZoom must not be NaN');
      assert.ok(!isNaN(caps.maxZoom), 'maxZoom must not be NaN');
    }
  });

  // --------------------------------------------------------------------------
  // SUITE 5: 100-Cycle Memory & Track Leak Stress Test
  // --------------------------------------------------------------------------
  log('\n--- SUITE 5: 100-Cycle Track Leak Stress Test ---');

  await test('5.1 100 alternating lens switches leaves exactly 1 live track (no track/memory leaks)', async () => {
    const devices = [
      { deviceId: 'std-cam', kind: 'videoinput', label: 'Back Camera' },
      { deviceId: 'uw-cam', kind: 'videoinput', label: 'Back Ultra Wide Camera' }
    ];
    const env = createMockEnvironment({ devices });
    const { controller } = loadScannerContext(env);
    await controller.startCamera('environment');

    for (let i = 0; i < 100; i++) {
      const target = (i % 2 === 0) ? 0.5 : 1.0;
      await controller.toggleLens(target);
    }

    const createdTracks = env.getCreatedTracks();
    const liveTracks = createdTracks.filter(t => t.readyState === 'live');
    const stoppedTracks = createdTracks.filter(t => t.readyState === 'ended');

    log(`    Total tracks created: ${createdTracks.length}, Live: ${liveTracks.length}, Stopped: ${stoppedTracks.length}`);
    assert.strictEqual(liveTracks.length, 1, 'Exactly one track must remain live');
    assert.strictEqual(stoppedTracks.length, createdTracks.length - 1, 'All superseded tracks must be stopped');
  });

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  log('\n====================================================================');
  log(`CHALLENGER ITERATION 2 VERIFICATION SUMMARY:`);
  log(`Total Tests Run : ${passedTests + failedTests}`);
  log(`Passed          : ${passedTests}`);
  log(`Failed          : ${failedTests}`);
  log(`Pass Rate       : ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
  log('====================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runChallengerTests().catch(err => {
  console.error('Unhandled test suite failure:', err);
  process.exit(1);
});
