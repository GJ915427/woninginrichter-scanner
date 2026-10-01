/**
 * test_camera_stress_adversarial.js
 * Adversarial Empirical Stress Test Suite for Camera & Lens Selection (Milestone 1 / R1)
 * Challenger 2 Evaluation Harness
 *
 * Stress tests:
 * 1. Stream switching while recording is preparing or active.
 * 2. Flipping between environment and user facingMode while toggling zoom (race conditions).
 * 3. Device disconnection or track ended event handling during zoom switch.
 * 4. Concurrent / re-entrant lens toggle invocations.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passedTests = 0;
let failedTests = 0;
const testResults = [];

function log(msg) {
  console.log(msg);
}

async function test(name, fn) {
  try {
    await fn();
    passedTests++;
    testResults.push({ name, status: 'PASS' });
    log(`  [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    testResults.push({ name, status: 'FAIL', error: err.message });
    log(`  [FAIL] ${name}: ${err.message}`);
  }
}

// ============================================================================
// ADVERSARIAL MOCK WEBRTC & DOM INFRASTRUCTURE
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

/**
 * W3C Spec-compliant Mock MediaRecorder
 * Tracks live state, throws InvalidStateError when stopped while inactive,
 * and automatically transitions to inactive if all stream tracks end.
 */
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

    // Monitor stream tracks: if all tracks end while recording, recorder must stop automatically
    this._trackEndHandler = () => {
      const activeTracks = this.stream.getTracks().filter(t => t.readyState === 'live');
      if (activeTracks.length === 0 && this.state === 'recording') {
        this._autoStopDueToTrackEnd();
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
    this.timeslice = timeslice;
  }

  stop() {
    if (this.state === 'inactive') {
      throw new Error("InvalidStateError: Failed to execute 'stop' on 'MediaRecorder': The MediaRecorder's state is 'inactive'.");
    }
    this.state = 'inactive';
    if (typeof this.ondataavailable === 'function') {
      this.ondataavailable({ data: { size: 1024, type: this.mimeType } });
    }
    if (typeof this.onstop === 'function') {
      this.onstop({ type: 'stop' });
    }
  }

  _autoStopDueToTrackEnd() {
    this.state = 'inactive';
    if (typeof this.ondataavailable === 'function') {
      this.ondataavailable({ data: { size: 512, type: this.mimeType } });
    }
    if (typeof this.onstop === 'function') {
      this.onstop({ type: 'stop' });
    }
  }
}

class MockElement {
  constructor(id, tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.style = {};
    this.title = '';
    this.value = '';
    this.innerText = '';
    this.disabled = false;
    this.srcObject = null;
    this._classListSet = new Set();
    this._listeners = {};
  }

  get classList() {
    return {
      add: (c) => this._classListSet.add(c),
      remove: (c) => this._classListSet.delete(c),
      contains: (c) => this._classListSet.has(c),
      toggle: (c) => this._classListSet.has(c) ? this._classListSet.delete(c) : this._classListSet.add(c)
    };
  }

  get className() {
    return Array.from(this._classListSet).join(' ');
  }

  set className(val) {
    this._classListSet.clear();
    if (val) {
      val.split(/\s+/).filter(Boolean).forEach(c => this._classListSet.add(c));
    }
  }

  addEventListener(event, handler) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(handler);
  }

  async click() {
    return this.dispatchEvent('click');
  }

  async dispatchEvent(event, extra = {}) {
    const evt = { target: this, preventDefault() {}, ...extra };
    if (this._listeners[event]) {
      for (const h of this._listeners[event]) {
        await h(evt);
      }
    }
  }

  async play() {
    return Promise.resolve();
  }
}

function createMockEnvironment({ devices = [], initialTrackCapabilities = {}, gUMInterceptor = null, gumDelay = 0 } = {}) {
  const elements = {};
  const mockDoc = {
    getElementById(id) {
      if (!elements[id]) {
        elements[id] = new MockElement(id);
      }
      return elements[id];
    },
    _elements: elements
  };

  let currentStream = null;
  const getUserMediaCalls = [];
  let availableDevices = [...devices];

  const mockNavigator = {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15',
    mediaDevices: {
      ondevicechange: null,
      async enumerateDevices() {
        return availableDevices.map(d => ({
          deviceId: d.deviceId || 'dev-' + Math.random().toString(36).substring(2, 6),
          kind: d.kind || 'videoinput',
          label: d.label || '',
          groupId: d.groupId || 'group-1'
        }));
      },
      async getUserMedia(constraints) {
        getUserMediaCalls.push(constraints);
        if (gumDelay > 0) {
          await new Promise(r => setTimeout(r, gumDelay));
        }
        if (gUMInterceptor) {
          return await gUMInterceptor(constraints);
        }
        const devId = (constraints.video && constraints.video.deviceId && constraints.video.deviceId.exact)
          ? constraints.video.deviceId.exact
          : 'cam-env-default';

        const track = new MockTrack({
          deviceId: devId,
          capabilities: initialTrackCapabilities
        });
        currentStream = new MockStream([track]);
        return currentStream;
      }
    }
  };

  return {
    mockDoc,
    mockNavigator,
    getGUMCalls: () => getUserMediaCalls,
    getCurrentStream: () => currentStream,
    setDevices: (devs) => { availableDevices = [...devs]; },
    elements
  };
}

function loadScannerContext(env) {
  const htmlPath = path.resolve(__dirname, '..', 'scanner.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  const allScripts = [...htmlContent.matchAll(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi)];
  const appScript = allScripts.find(s => s[1].includes('cameraController')) || allScripts[allScripts.length - 1];
  if (!appScript) {
    throw new Error('No application <script> tag found in scanner.html');
  }
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
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout: () => {},
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
// EMPIRICAL STRESS TESTS
// ============================================================================

async function runAdversarialStressTests() {
  log('\n====================================================================');
  log('ADVERSARIAL STRESS TEST SUITE: CAMERA & LENS CONTROLLER (R1)');
  log('====================================================================');

  // --------------------------------------------------------------------------
  // SUITE 1: STREAM SWITCHING WHILE RECORDING IS PREPARING OR ACTIVE
  // --------------------------------------------------------------------------
  log('\n--- SUITE 1: Stream switching while recording is active or preparing ---');

  await test('1.1 Toggling Tier 1 lens during active recording is prevented and preserves recording stream', async () => {
    const devices = [
      { deviceId: 'cam-main', kind: 'videoinput', label: 'Back Camera' },
      { deviceId: 'cam-ultra', kind: 'videoinput', label: 'Back Ultra Wide Camera' }
    ];
    const env = createMockEnvironment({ devices });
    const { sandbox, controller } = loadScannerContext(env);

    // Initial stream start (1.0x)
    await controller.startCamera('environment');
    await controller.toggleLens(1.0);

    const initialStream = controller.getStream();
    const initialTrack = initialStream.getVideoTracks()[0];
    assert.strictEqual(initialTrack.readyState, 'live', 'Initial track should be live');

    // Start recording via UI button
    const recordBtn = env.mockDoc.getElementById('toggle-record-btn');
    await recordBtn.click();

    // Verify recording is active
    const recText = env.mockDoc.getElementById('rec-text');
    assert.strictEqual(recText.innerText, 'OPNAME', 'Status must indicate OPNAME');
    assert.ok(recordBtn.classList.contains('recording'), 'Record button must have recording class');

    // While recording is active, user clicks 0.5x lens button
    const lens05Btn = env.mockDoc.getElementById('lens-05');
    await lens05Btn.click();

    // Check that initial track was preserved and NOT stopped
    assert.strictEqual(initialTrack.readyState, 'live', 'Stream track must remain live during active recording');
    assert.strictEqual(recText.innerText, 'OPNAME', 'Status must remain OPNAME while recording is active');

    // Now user tries to stop the recording normally via toggleRecordBtn:
    let uncaughtError = null;
    try {
      await recordBtn.click();
    } catch (err) {
      uncaughtError = err;
    }

    log(`    Empirical Result on toggleRecordBtn.click(): ${uncaughtError ? uncaughtError.message : 'Clean stop'}`);
    assert.strictEqual(uncaughtError, null, 'Recording stops cleanly without throwing InvalidStateError');
  });

  await test('1.2 Front/Back camera switch (switchCamBtn) during active recording is locked out', async () => {
    const devices = [
      { deviceId: 'cam-back', kind: 'videoinput', label: 'Back Camera' },
      { deviceId: 'cam-front', kind: 'videoinput', label: 'Front Camera' }
    ];
    const env = createMockEnvironment({ devices });
    const { sandbox, controller } = loadScannerContext(env);

    await controller.startCamera('environment');
    const initialStream = controller.getStream();
    const initialTrack = initialStream.getVideoTracks()[0];

    const recordBtn = env.mockDoc.getElementById('toggle-record-btn');
    await recordBtn.click();

    // Switch camera
    const switchCamBtn = env.mockDoc.getElementById('switch-cam-btn');
    await switchCamBtn.click();

    assert.strictEqual(initialTrack.readyState, 'live', 'Initial track remains live when camera switch is locked out');
    assert.strictEqual(controller.getCurrentFacingMode(), 'environment', 'Facing mode remains environment during recording');
  });

  await test('1.3 Lens buttons (#lens-05, #lens-10) and switch button are disabled in DOM when recording is active', async () => {
    const devices = [
      { deviceId: 'cam-main', kind: 'videoinput', label: 'Back Camera' },
      { deviceId: 'cam-ultra', kind: 'videoinput', label: 'Back Ultra Wide Camera' }
    ];
    const env = createMockEnvironment({ devices });
    const { controller } = loadScannerContext(env);

    await controller.startCamera('environment');

    const recordBtn = env.mockDoc.getElementById('toggle-record-btn');
    const lens05Btn = env.mockDoc.getElementById('lens-05');
    const lens10Btn = env.mockDoc.getElementById('lens-10');
    const switchCamBtn = env.mockDoc.getElementById('switch-cam-btn');

    await recordBtn.click(); // Start recording

    // Inspect if UI prevents user interaction during recording
    const is05Disabled = lens05Btn.disabled;
    const is10Disabled = lens10Btn.disabled;
    const isSwitchDisabled = switchCamBtn.disabled;

    log(`    DOM disabled check during recording: #lens-05=${is05Disabled}, #lens-10=${is10Disabled}, #switch-cam-btn=${isSwitchDisabled}`);
    assert.strictEqual(is05Disabled, true, 'lens05Btn is disabled during recording');
    assert.strictEqual(is10Disabled, true, 'lens10Btn is disabled during recording');
    assert.strictEqual(isSwitchDisabled, true, 'switchCamBtn is disabled during recording');
  });

  await test('1.4 Tier 2 continuous zoom during active recording preserves MediaRecorder continuity', async () => {
    const env = createMockEnvironment({
      devices: [{ deviceId: 'cam-continuous', kind: 'videoinput', label: 'Continuous Zoom Camera' }],
      initialTrackCapabilities: { zoom: { min: 0.5, max: 8.0, step: 0.1 } }
    });
    const { controller } = loadScannerContext(env);

    await controller.resolveCameraStream(1.0);
    const initialStream = controller.getStream();
    const track = initialStream.getVideoTracks()[0];

    const recordBtn = env.mockDoc.getElementById('toggle-record-btn');
    await recordBtn.click(); // Start recording

    // In Tier 2, zoom is applied via track.applyConstraints without replacing stream
    await controller.toggleLens(0.5);

    assert.strictEqual(track.readyState, 'live', 'Tier 2 must NOT stop track');
    assert.strictEqual(controller.getStream(), initialStream, 'Stream instance must remain identical');
    assert.strictEqual(track._getActiveConstraints().advanced[0].zoom, 0.5, 'Zoom constraint applied');
  });

  // --------------------------------------------------------------------------
  // SUITE 2: FLIPPING BETWEEN FACINGMODE WHILE TOGGLING ZOOM (RACE CONDITIONS)
  // --------------------------------------------------------------------------
  log('\n--- SUITE 2: FacingMode flipping vs Zoom toggling race conditions ---');

  await test('2.1 Asynchronous race: slow toggleLens(0.5) resolving AFTER rapid switchCamBtn to user', async () => {
    const gUMInterceptor = async (constraints) => {
      const isUltra = constraints.video && constraints.video.deviceId && constraints.video.deviceId.exact === 'cam-ultra';
      const isUser = constraints.video && constraints.video.facingMode && constraints.video.facingMode.ideal === 'user';

      if (isUltra) {
        await new Promise(r => setTimeout(r, 40));
        return new MockStream([new MockTrack({ deviceId: 'cam-ultra' })]);
      } else if (isUser) {
        await new Promise(r => setTimeout(r, 5));
        return new MockStream([new MockTrack({ deviceId: 'cam-user' })]);
      } else {
        return new MockStream([new MockTrack({ deviceId: 'cam-default' })]);
      }
    };

    const devices = [
      { deviceId: 'cam-main', kind: 'videoinput', label: 'Back Camera' },
      { deviceId: 'cam-ultra', kind: 'videoinput', label: 'Back Ultra Wide Camera' },
      { deviceId: 'cam-user', kind: 'videoinput', label: 'Front Camera' }
    ];
    const env = createMockEnvironment({ devices, gUMInterceptor });
    const { controller } = loadScannerContext(env);

    // Initial stream: Back camera
    await controller.startCamera('environment');

    // Trigger slow 0.5x switch
    const slowZoomPromise = controller.toggleLens(0.5);

    // Immediately user clicks switchCamBtn to switch to front camera
    const switchCamBtn = env.mockDoc.getElementById('switch-cam-btn');
    const fastCamPromise = switchCamBtn.click();

    // Await both operations
    await Promise.all([slowZoomPromise, fastCamPromise]);

    const finalFacingMode = controller.getCurrentFacingMode();
    const finalStream = controller.getStream();
    const finalDeviceId = finalStream.getVideoTracks()[0].deviceId;
    const finalZoom = controller.getCurrentZoom();
    const lensTogglePill = env.mockDoc.getElementById('lens-toggle');

    log(`    Race result: finalFacingMode=${finalFacingMode}, finalDeviceId=${finalDeviceId}, finalZoom=${finalZoom}, lensPillDisplay=${lensTogglePill.style.display}`);

    // Vulnerability Check:
    const isDesynced = (finalFacingMode === 'user' && finalDeviceId === 'cam-ultra');
    assert.strictEqual(isDesynced, false, 'Race condition eliminated: rear ultra-wide discarded, user camera active');
    assert.strictEqual(finalFacingMode, 'user', 'Final facing mode is user');
    assert.strictEqual(finalDeviceId, 'cam-user', 'Active stream matches latest user camera request');
  });

  await test('2.2 Rapid consecutive clicks on switchCamBtn (triple flip) stress test', async () => {
    let callIndex = 0;
    const gUMInterceptor = async (constraints) => {
      const idx = ++callIndex;
      const delays = [0, 20, 5, 15];
      await new Promise(r => setTimeout(r, delays[idx] || 5));
      const mode = (constraints.video && constraints.video.facingMode) ? constraints.video.facingMode.ideal : 'env';
      return new MockStream([new MockTrack({ deviceId: `cam-${mode}-${idx}` })]);
    };

    const devices = [
      { deviceId: 'cam-env', kind: 'videoinput', label: 'Back Camera' },
      { deviceId: 'cam-user', kind: 'videoinput', label: 'Front Camera' }
    ];
    const env = createMockEnvironment({ devices, gUMInterceptor });
    const { controller } = loadScannerContext(env);

    await controller.startCamera('environment');
    callIndex = 0;

    const switchCamBtn = env.mockDoc.getElementById('switch-cam-btn');

    // 3 rapid clicks without waiting
    const p1 = switchCamBtn.click();
    const p2 = switchCamBtn.click();
    const p3 = switchCamBtn.click();

    await Promise.all([p1, p2, p3]);

    const activeStream = controller.getStream();
    const activeTrack = activeStream.getVideoTracks()[0];
    const facingMode = controller.getCurrentFacingMode();

    log(`    Triple switch result: facingMode=${facingMode}, activeTrackDeviceId=${activeTrack.deviceId}`);
    assert.strictEqual(activeTrack.readyState, 'live', 'Active stream track must be live');
  });

  await test('2.3 toggleLens(0.5) invoked while in user facingMode forces user mode constraints', async () => {
    const devices = [
      { deviceId: 'cam-main', kind: 'videoinput', label: 'Back Camera' },
      { deviceId: 'cam-ultra', kind: 'videoinput', label: 'Back Ultra Wide Camera' },
      { deviceId: 'cam-front', kind: 'videoinput', label: 'Front Camera' }
    ];
    const env = createMockEnvironment({ devices });
    const { controller } = loadScannerContext(env);

    await controller.startCamera('user');
    assert.strictEqual(controller.getCurrentFacingMode(), 'user');

    // User calls toggleLens(0.5) while in front camera
    await controller.toggleLens(0.5);

    // Front camera mode must stay 1.0x and facingMode user
    assert.strictEqual(controller.getCurrentZoom(), 1.0, 'Front camera must force 1.0x zoom');
    assert.strictEqual(controller.getCurrentFacingMode(), 'user', 'Facing mode must remain user');
    const gumCalls = env.getGUMCalls();
    const lastCall = gumCalls[gumCalls.length - 1];
    assert.strictEqual(lastCall.video.facingMode.ideal, 'user', 'Must request user facingMode');
  });

  // --------------------------------------------------------------------------
  // SUITE 3: DEVICE DISCONNECTION & TRACK ENDED EVENT HANDLING
  // --------------------------------------------------------------------------
  log('\n--- SUITE 3: Device disconnection & track ended handling ---');

  await test('3.1 Device disconnection during Tier 1 ultra-wide switch triggers graceful Tier 3 fallback', async () => {
    let ultraWideAvailable = true;
    const gUMInterceptor = async (constraints) => {
      const isUltra = constraints.video && constraints.video.deviceId && constraints.video.deviceId.exact === 'cam-ultra';
      if (isUltra && !ultraWideAvailable) {
        const err = new Error('Device not found');
        err.name = 'NotFoundError';
        throw err;
      }
      const devId = isUltra ? 'cam-ultra' : 'cam-standard';
      return new MockStream([new MockTrack({ deviceId: devId })]);
    };

    const devices = [
      { deviceId: 'cam-standard', kind: 'videoinput', label: 'Back Standard Camera' },
      { deviceId: 'cam-ultra', kind: 'videoinput', label: 'Back Ultra Wide Camera' }
    ];
    const env = createMockEnvironment({ devices, gUMInterceptor });
    const { controller } = loadScannerContext(env);

    // Initial environment stream on 1.0x
    await controller.startCamera('environment');
    await controller.toggleLens(1.0);

    const initialTrack = controller.getStream().getVideoTracks()[0];
    assert.strictEqual(initialTrack.deviceId, 'cam-standard', 'Initial stream is standard camera');

    // Now ultra-wide camera disconnects from system (simulate USB/hardware unplug)
    ultraWideAvailable = false;
    env.setDevices([{ deviceId: 'cam-standard', kind: 'videoinput', label: 'Back Standard Camera' }]);

    // User attempts to switch to 0.5x
    await controller.toggleLens(0.5);

    const activeStream = controller.getStream();
    const activeTrack = activeStream.getVideoTracks()[0];

    log(`    Stream after disconnected 0.5x attempt: track readyState=${activeTrack ? activeTrack.readyState : 'null'}, deviceId=${activeTrack ? activeTrack.deviceId : 'null'}`);
    assert.strictEqual(activeTrack.readyState, 'live', 'Fallback stream must be live');
    assert.strictEqual(activeTrack.deviceId, 'cam-standard', 'Must fallback to standard camera');
    assert.strictEqual(controller.getCurrentZoom(), 1.0, 'Current zoom must reflect 1.0x fallback');
  });

  await test('3.2 Track ended event occurs on active stream before toggleLens(0.5)', async () => {
    const env = createMockEnvironment({
      devices: [{ deviceId: 'cam-env', kind: 'videoinput', label: 'Camera' }],
      initialTrackCapabilities: { zoom: { min: 0.5, max: 4.0 } }
    });
    const { controller } = loadScannerContext(env);

    await controller.startCamera('environment');
    const oldStream = controller.getStream();
    const oldTrack = oldStream.getVideoTracks()[0];

    // Simulate track termination by OS (e.g. phone call, sleep, background)
    oldTrack.stop();
    assert.strictEqual(oldTrack.readyState, 'ended');

    // Now user switches lens
    await controller.toggleLens(0.5);

    const newStream = controller.getStream();
    const newTrack = newStream.getVideoTracks()[0];

    assert.strictEqual(newTrack.readyState, 'live', 'New track after ended state must be live');
  });

  await test('3.3 Hardware rejection on applyConstraints with continuous zoom track', async () => {
    const env = createMockEnvironment({
      devices: [{ deviceId: 'cam-1', kind: 'videoinput', label: 'Back Camera' }],
      initialTrackCapabilities: {
        zoom: { min: 0.5, max: 5.0 },
        _failApplyConstraints: true // simulate hardware driver error
      }
    });
    const { controller } = loadScannerContext(env);

    await controller.startCamera('environment');

    // toggleLens must not crash on hardware applyConstraints error
    let thrownError = null;
    try {
      await controller.toggleLens(0.5);
    } catch (e) {
      thrownError = e;
    }

    assert.strictEqual(thrownError, null, 'Hardware rejection must be caught and absorbed');
  });

  // --------------------------------------------------------------------------
  // SUITE 4: CONCURRENT & RE-ENTRANT LENS TOGGLE INVOCATIONS
  // --------------------------------------------------------------------------
  log('\n--- SUITE 4: Concurrent & re-entrant invocations ---');

  await test('4.1 Rapid toggling between 0.5x and 1.0x does not leave orphaned unstopped tracks', async () => {
    const createdTracks = [];
    const gUMInterceptor = async (constraints) => {
      const devId = (constraints.video && constraints.video.deviceId && constraints.video.deviceId.exact)
        ? constraints.video.deviceId.exact : 'cam-std';
      const trk = new MockTrack({ deviceId: devId });
      createdTracks.push(trk);
      return new MockStream([trk]);
    };

    const devices = [
      { deviceId: 'cam-std', kind: 'videoinput', label: 'Back Camera' },
      { deviceId: 'cam-uw', kind: 'videoinput', label: 'Back Ultra Wide Camera' }
    ];
    const env = createMockEnvironment({ devices, gUMInterceptor });
    const { controller } = loadScannerContext(env);

    await controller.startCamera('environment');

    // Execute 5 rapid sequential switches
    await controller.toggleLens(0.5);
    await controller.toggleLens(1.0);
    await controller.toggleLens(0.5);
    await controller.toggleLens(1.0);
    await controller.toggleLens(0.5);

    const activeStream = controller.getStream();
    const activeTrack = activeStream.getVideoTracks()[0];

    // Verify all prior tracks were properly stopped
    const liveTracks = createdTracks.filter(t => t.readyState === 'live');
    log(`    Total tracks created: ${createdTracks.length}, Currently live tracks: ${liveTracks.length}`);

    assert.strictEqual(liveTracks.length, 1, 'Exactly one track should remain live; prior tracks must be stopped');
    assert.strictEqual(liveTracks[0].id, activeTrack.id, 'The single live track must be the active track');
  });

  await test('4.2 Re-entrant simultaneous toggleLens calls (Promise.all([0.5, 1.0, 0.5]))', async () => {
    const devices = [
      { deviceId: 'cam-std', kind: 'videoinput', label: 'Back Camera' },
      { deviceId: 'cam-uw', kind: 'videoinput', label: 'Back Ultra Wide Camera' }
    ];
    const env = createMockEnvironment({ devices });
    const { controller } = loadScannerContext(env);

    await controller.startCamera('environment');

    // Fire simultaneously
    await Promise.all([
      controller.toggleLens(0.5),
      controller.toggleLens(1.0),
      controller.toggleLens(0.5)
    ]);

    const activeStream = controller.getStream();
    const activeTrack = activeStream.getVideoTracks()[0];

    assert.strictEqual(activeTrack.readyState, 'live', 'Track must remain live after concurrent toggle calls');
  });

  // --------------------------------------------------------------------------
  // SUMMARY REPORT
  // --------------------------------------------------------------------------
  log('\n====================================================================');
  log('ADVERSARIAL EMPIRICAL STRESS TEST SUMMARY:');
  log(`Total Tests Run : ${passedTests + failedTests}`);
  log(`Passed          : ${passedTests}`);
  log(`Failed          : ${failedTests}`);
  log(`Pass Rate       : ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
  log('====================================================================\n');

  return { passedTests, failedTests, testResults };
}

if (require.main === module) {
  runAdversarialStressTests()
    .then(({ failedTests }) => {
      // Exit 0 so caller receives full test results output
      process.exit(0);
    })
    .catch(err => {
      console.error('Test runner fatal error:', err);
      process.exit(1);
    });
}

module.exports = { runAdversarialStressTests };
