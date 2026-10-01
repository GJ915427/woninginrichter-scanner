/**
 * test_camera_adversarial.js
 * 
 * Empirical Adversarial Stress Test Harness for Milestone 1 Camera & HUD Lens Selection (R1).
 * Specifically targets:
 *   1. Malformed device lists (null labels, empty arrays, weird vendor strings, emoji, long strings, enumerateDevices throwing).
 *   2. Track capabilities with missing zoom, non-numeric zoom, inverted bounds (min > max), NaN, Infinity, negative zoom.
 *   3. High-frequency rapid toggling (spamming 0.5x and 1.0x clicks concurrently, race condition analysis, stream leak checks).
 *   4. Boundary conditions & contract invariance under hostile inputs.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

let passedTests = 0;
let failedTests = 0;
const testFailures = [];

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
    log(`         Error: ${err.message}`);
    testFailures.push({ name, error: err });
    failedTests++;
  }
}

function createMockTrack({ id = 'track-1', deviceId = 'cam-default', capabilities = {}, settings = {}, applyDelayMs = 0 } = {}) {
  let activeConstraints = {};
  let isStopped = false;

  return {
    id,
    kind: 'video',
    readyState: 'live',
    getCapabilities() {
      return capabilities ? { ...capabilities } : capabilities;
    },
    getSettings() {
      return { deviceId, ...settings };
    },
    async applyConstraints(constraints) {
      if (applyDelayMs > 0) {
        await new Promise(r => setTimeout(r, applyDelayMs));
      }
      if (capabilities && capabilities._failApplyConstraints) {
        throw new Error('Hardware applyConstraints error');
      }
      activeConstraints = { ...activeConstraints, ...constraints };
      return true;
    },
    stop() {
      isStopped = true;
      this.readyState = 'ended';
    },
    _isStopped() {
      return isStopped;
    },
    _getActiveConstraints() {
      return activeConstraints;
    }
  };
}

function createMockStream(tracks = [createMockTrack()]) {
  return {
    id: 'stream-' + Math.random().toString(36).substring(2, 9),
    getVideoTracks() {
      return tracks;
    },
    getTracks() {
      return tracks;
    }
  };
}

function createMockElement(id, tagName = 'div') {
  const classListSet = new Set();
  const listeners = {};
  return {
    id,
    tagName: tagName.toUpperCase(),
    style: {},
    title: '',
    value: '',
    innerText: '',
    disabled: false,
    srcObject: null,
    classList: {
      add: (c) => classListSet.add(c),
      remove: (c) => classListSet.delete(c),
      contains: (c) => classListSet.has(c),
      toggle: (c) => classListSet.has(c) ? classListSet.delete(c) : classListSet.add(c)
    },
    addEventListener(event, handler) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    async dispatchEvent(event) {
      if (listeners[event]) {
        for (const h of listeners[event]) {
          await h({ target: this, preventDefault() {} });
        }
      }
    },
    async play() {
      return Promise.resolve();
    }
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
    _elements: elements
  };
}

function setupMockEnvironment({
  devices = [],
  enumerateError = null,
  initialTrackCapabilities = {},
  gUMDelayMs = 0,
  gUMInterceptor = null
} = {}) {
  const mockDoc = createMockDocument();
  let currentStream = null;
  const getUserMediaCalls = [];
  const createdStreams = [];

  const mockNavigator = {
    mediaDevices: {
      async enumerateDevices() {
        if (enumerateError) {
          throw enumerateError;
        }
        return devices.map(d => {
          if (!d) return d;
          return {
            deviceId: d.deviceId !== undefined ? d.deviceId : ('dev-' + Math.random().toString(36).substring(2, 6)),
            kind: d.kind !== undefined ? d.kind : 'videoinput',
            label: d.label !== undefined ? d.label : '',
            groupId: d.groupId || 'group-1'
          };
        });
      },
      async getUserMedia(constraints) {
        getUserMediaCalls.push(constraints);
        if (gUMDelayMs > 0) {
          await new Promise(r => setTimeout(r, gUMDelayMs));
        }
        if (gUMInterceptor) {
          return await gUMInterceptor(constraints);
        }
        const devId = (constraints && constraints.video && constraints.video.deviceId && constraints.video.deviceId.exact)
          ? constraints.video.deviceId.exact
          : 'cam-env-default';
        const track = createMockTrack({
          deviceId: devId,
          capabilities: initialTrackCapabilities
        });
        currentStream = createMockStream([track]);
        createdStreams.push(currentStream);
        return currentStream;
      }
    }
  };

  return {
    mockDoc,
    mockNavigator,
    getGUMCalls: () => getUserMediaCalls,
    getCurrentStream: () => currentStream,
    getCreatedStreams: () => createdStreams
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
    setTimeout: (fn, ms) => setTimeout(fn, ms || 0),
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
    controller: sandbox.module.exports.cameraController || sandbox.window.cameraController
  };
}

async function runAdversarialTests() {
  log('\n====================================================================');
  log('STARTING EMPIRICAL ADVERSARIAL STRESS TEST SUITE');
  log('====================================================================\n');

  // ------------------------------------------------------------------
  // SUITE 1: Malformed and Pathological Device Lists
  // ------------------------------------------------------------------
  log('=== SUITE 1: Malformed & Pathological Device Lists ===');

  await test('1.1 Empty enumerateDevices array', async () => {
    const env = setupMockEnvironment({ devices: [] });
    const { controller } = loadScannerContext(env);
    await controller.startCamera('environment');
    const caps = controller.getLensCapabilities();
    assert.strictEqual(caps.hasUltraWide, false, 'Empty devices must report hasUltraWide = false');
    assert.strictEqual(caps.minZoom, 1.0);
    assert.strictEqual(caps.maxZoom, 1.0);
  });

  await test('1.2 Device list with null, undefined, empty, and numeric labels', async () => {
    const env = setupMockEnvironment({
      devices: [
        { deviceId: 'dev-null', label: null, kind: 'videoinput' },
        { deviceId: 'dev-undef', label: undefined, kind: 'videoinput' },
        { deviceId: 'dev-empty', label: '', kind: 'videoinput' },
        { deviceId: 'dev-num', label: 12345, kind: 'videoinput' }
      ]
    });
    const { controller } = loadScannerContext(env);
    await controller.startCamera('environment');
    const caps = controller.getLensCapabilities();
    assert.strictEqual(caps.hasUltraWide, false, 'Malformed labels must not crash and must not falsely detect ultra-wide');
  });

  await test('1.3 Devices with missing or null deviceId', async () => {
    const env = setupMockEnvironment({
      devices: [
        { deviceId: null, label: 'Back Ultra Wide Camera', kind: 'videoinput' },
        { deviceId: undefined, label: 'Back Camera', kind: 'videoinput' }
      ]
    });
    const { controller } = loadScannerContext(env);
    await controller.startCamera('environment');
    // Ultra-wide requires ultraWideDeviceId to be valid
    const caps = controller.getLensCapabilities();
    // If ultraWideDeviceId was null, it should not activate Tier 1
    assert.ok(typeof caps.hasUltraWide === 'boolean');
  });

  await test('1.4 Audio-only device list (no videoinput)', async () => {
    const env = setupMockEnvironment({
      devices: [
        { deviceId: 'mic-1', label: 'Ultra Microphone 0.5x', kind: 'audioinput' },
        { deviceId: 'spk-1', label: 'Speaker 0.5x stereo', kind: 'audiooutput' }
      ]
    });
    const { controller } = loadScannerContext(env);
    await controller.startCamera('environment');
    const caps = controller.getLensCapabilities();
    assert.strictEqual(caps.hasUltraWide, false, 'Audio devices must be ignored regardless of labels');
  });

  await test('1.5 Emoji, unicode, null-bytes, and extremely long strings in labels', async () => {
    const env = setupMockEnvironment({
      devices: [
        { deviceId: 'dev-emoji', label: '📷 Ultra-Wide Lens (0.5x) \u0000 \uFEFF 🚀', kind: 'videoinput' },
        { deviceId: 'dev-long', label: 'A'.repeat(5000) + ' Back Camera 1.0x', kind: 'videoinput' }
      ]
    });
    const { controller } = loadScannerContext(env);
    await controller.startCamera('environment');
    const caps = controller.getLensCapabilities();
    assert.strictEqual(caps.hasUltraWide, true, 'Emoji / unicode labels with 0.5x/ultra should be recognized safely');
  });

  await test('1.6 Competing keywords: Front ultra-wide vs Rear telephoto', async () => {
    const env = setupMockEnvironment({
      devices: [
        { deviceId: 'front-uw', label: 'Front Ultra Wide TrueDepth Camera', kind: 'videoinput' },
        { deviceId: 'back-tele', label: 'Back Telephoto 3x Camera (ultra zoom)', kind: 'videoinput' },
        { deviceId: 'back-main', label: 'Back Camera', kind: 'videoinput' }
      ]
    });
    const { controller } = loadScannerContext(env);
    await controller.startCamera('environment');
    const caps = controller.getLensCapabilities();
    // Front camera must be disqualified by front/user check
    // Telephoto with ultra zoom: check how scoring handles it
    assert.strictEqual(controller.scoreUltraWideLabel('Front Ultra Wide Camera'), -1, 'Front camera must score -1');
    assert.strictEqual(controller.scoreUltraWideLabel('Front Camera'), -1, 'Front camera must score -1');
  });

  await test('1.7 enumerateDevices throws NotAllowedError / SecurityError', async () => {
    const env = setupMockEnvironment({
      enumerateError: new Error('Permission denied by user (NotAllowedError)')
    });
    const { controller } = loadScannerContext(env);
    // Should not crash startCamera
    await controller.startCamera('environment');
    const caps = controller.getLensCapabilities();
    assert.strictEqual(caps.hasUltraWide, false, 'enumerateDevices rejection must gracefully fallback without crash');
    assert.strictEqual(caps.minZoom, 1.0);
  });

  // ------------------------------------------------------------------
  // SUITE 2: Track Capabilities (Missing, Non-numeric, Inverted, Bounds)
  // ------------------------------------------------------------------
  log('\n=== SUITE 2: Track Capabilities Stress Testing ===');

  await test('2.1 getCapabilities returns null, undefined, or empty object', async () => {
    const env = setupMockEnvironment({
      devices: [{ deviceId: 'std-cam', label: 'Standard Camera', kind: 'videoinput' }],
      initialTrackCapabilities: null
    });
    const { controller } = loadScannerContext(env);
    await controller.startCamera('environment');
    const caps = controller.getLensCapabilities();
    assert.strictEqual(caps.hasUltraWide, false);
    assert.strictEqual(caps.minZoom, 1.0);
    assert.strictEqual(caps.maxZoom, 1.0);
  });

  await test('2.2 zoom property is null, boolean, or string instead of object', async () => {
    for (const invalidZoom of [null, undefined, true, false, 'zoom-1', 123]) {
      const env = setupMockEnvironment({
        devices: [{ deviceId: 'std-cam', label: 'Standard Camera', kind: 'videoinput' }],
        initialTrackCapabilities: { zoom: invalidZoom }
      });
      const { controller } = loadScannerContext(env);
      await controller.startCamera('environment');
      const caps = controller.getLensCapabilities();
      assert.strictEqual(caps.hasUltraWide, false, `invalid zoom=${invalidZoom} must not crash`);
      assert.strictEqual(typeof caps.minZoom, 'number');
      assert.strictEqual(typeof caps.maxZoom, 'number');
    }
  });

  await test('2.3 Non-numeric zoom.min and zoom.max (strings, NaN, Infinity)', async () => {
    const env = setupMockEnvironment({
      devices: [{ deviceId: 'std-cam', label: 'Standard Camera', kind: 'videoinput' }],
      initialTrackCapabilities: {
        zoom: { min: 'invalid', max: 'invalid' }
      }
    });
    const { controller } = loadScannerContext(env);
    await controller.startCamera('environment');
    const caps = controller.getLensCapabilities();
    assert.strictEqual(caps.hasUltraWide, false, 'Non-numeric zoom min must not qualify as ultra wide');
    assert.strictEqual(isNaN(caps.minZoom), false, `minZoom must not be NaN (got ${caps.minZoom})`);
    assert.strictEqual(isNaN(caps.maxZoom), false, `maxZoom must not be NaN (got ${caps.maxZoom})`);
  });

  await test('2.4 Inverted zoom bounds (min > max): e.g. min=2.0, max=0.5', async () => {
    const env = setupMockEnvironment({
      devices: [{ deviceId: 'std-cam', label: 'Standard Camera', kind: 'videoinput' }],
      initialTrackCapabilities: {
        zoom: { min: 2.0, max: 0.5 }
      }
    });
    const { controller } = loadScannerContext(env);
    await controller.startCamera('environment');
    const caps = controller.getLensCapabilities();
    assert.strictEqual(caps.hasUltraWide, false, 'Inverted bounds with min=2.0 must not qualify as ultra-wide');
  });

  await test('2.5 Inverted zoom bounds where min=0.5, max=0.2', async () => {
    const env = setupMockEnvironment({
      devices: [{ deviceId: 'std-cam', label: 'Standard Camera', kind: 'videoinput' }],
      initialTrackCapabilities: {
        zoom: { min: 0.5, max: 0.2 }
      }
    });
    const { controller } = loadScannerContext(env);
    await controller.startCamera('environment');
    const caps = controller.getLensCapabilities();
    assert.strictEqual(caps.hasUltraWide, true, 'min=0.5 qualifies as ultra-wide');
    // Contract: minZoom and maxZoom must be numeric
    assert.ok(!isNaN(caps.minZoom));
    assert.ok(!isNaN(caps.maxZoom));
  });

  await test('2.6 Extreme zoom values: min=-1.0, max=100.0', async () => {
    const env = setupMockEnvironment({
      devices: [{ deviceId: 'std-cam', label: 'Standard Camera', kind: 'videoinput' }],
      initialTrackCapabilities: {
        zoom: { min: -1.0, max: 100.0 }
      }
    });
    const { controller } = loadScannerContext(env);
    await controller.startCamera('environment');
    const caps = controller.getLensCapabilities();
    assert.strictEqual(caps.hasUltraWide, true, 'Negative min zoom <= 0.6 qualifies');
    // Clamping: when applied, Math.max(0.5, caps.zoom.min) should not crash
    await controller.resolveCameraStream(0.5);
    const activeConstraints = env.getCurrentStream().getVideoTracks()[0]._getActiveConstraints();
    assert.ok(activeConstraints.advanced[0].zoom >= 0.5, 'Applied zoom must clamp to at least 0.5');
  });

  await test('2.7 Boundary precision around 0.6 threshold', async () => {
    // 0.6000000000000001 vs 0.6000000000000000
    const env1 = setupMockEnvironment({
      devices: [{ deviceId: 'cam-1', label: 'Cam 1', kind: 'videoinput' }],
      initialTrackCapabilities: { zoom: { min: 0.6000001, max: 2.0 } }
    });
    const ctx1 = loadScannerContext(env1);
    await ctx1.controller.startCamera('environment');
    assert.strictEqual(ctx1.controller.getLensCapabilities().hasUltraWide, false, '0.6000001 is not ultra-wide');

    const env2 = setupMockEnvironment({
      devices: [{ deviceId: 'cam-2', label: 'Cam 2', kind: 'videoinput' }],
      initialTrackCapabilities: { zoom: { min: 0.6000000, max: 2.0 } }
    });
    const ctx2 = loadScannerContext(env2);
    await ctx2.controller.startCamera('environment');
    assert.strictEqual(ctx2.controller.getLensCapabilities().hasUltraWide, true, '0.6000000 is ultra-wide');
  });

  // ------------------------------------------------------------------
  // SUITE 3: High-Frequency Rapid Toggling & Concurrency Stress
  // ------------------------------------------------------------------
  log('\n=== SUITE 3: High-Frequency Rapid Toggling & Concurrency ===');

  await test('3.1 Synchronous rapid spamming of toggleLens (10 alternating calls)', async () => {
    const env = setupMockEnvironment({
      devices: [
        { deviceId: 'std-id', label: 'Back Camera', kind: 'videoinput' },
        { deviceId: 'uw-id', label: 'Back Ultra Wide Camera', kind: 'videoinput' }
      ]
    });
    const { controller, sandbox } = loadScannerContext(env);
    await controller.startCamera('environment');

    // Rapidly call toggleLens without waiting
    const promises = [];
    for (let i = 0; i < 10; i++) {
      const target = (i % 2 === 0) ? 0.5 : 1.0;
      promises.push(
        controller.toggleLens(target).then(() => {
          log(`    -> call #${i} toggleLens(${target}) resolved. UI 0.5 active: ${sandbox.document.getElementById('lens-05').classList.contains('active')}, UI 1.0 active: ${sandbox.document.getElementById('lens-10').classList.contains('active')}`);
        })
      );
    }

    const results = await Promise.allSettled(promises);
    const rejected = results.filter(r => r.status === 'rejected');
    assert.strictEqual(rejected.length, 0, 'No toggleLens promise should reject even under synchronous flood');

    // Final UI and controller state verification
    const btn05 = sandbox.document.getElementById('lens-05');
    const btn10 = sandbox.document.getElementById('lens-10');
    log(`    Final state: btn05.active=${btn05.classList.contains('active')}, btn10.active=${btn10.classList.contains('active')}`);
    assert.strictEqual(btn10.classList.contains('active'), true, 'Last toggle (1.0x) should be active');
    assert.strictEqual(btn05.classList.contains('active'), false, '0.5x should not be active');
  });

  await test('3.2 Rapid toggle with simulated hardware/network latency (gUM delay 15ms)', async () => {
    const env = setupMockEnvironment({
      devices: [
        { deviceId: 'std-id', label: 'Back Camera', kind: 'videoinput' },
        { deviceId: 'uw-id', label: 'Back Ultra Wide Camera', kind: 'videoinput' }
      ],
      gUMDelayMs: 15
    });
    const { controller, sandbox } = loadScannerContext(env);
    await controller.startCamera('environment');

    // Fire 0.5x, then 10ms later fire 1.0x while 0.5x is in-flight
    const p1 = controller.toggleLens(0.5);
    await new Promise(r => setTimeout(r, 5));
    const p2 = controller.toggleLens(1.0);

    await Promise.all([p1, p2]);

    // Ensure state ended consistently
    const btn10 = sandbox.document.getElementById('lens-10');
    assert.strictEqual(btn10.classList.contains('active'), true, 'Final state after sequential dispatch must be 1.0x');
  });

  await test('3.3 Track lifecycle: verify stopped tracks do not leak as live zombies', async () => {
    const env = setupMockEnvironment({
      devices: [
        { deviceId: 'std-id', label: 'Back Camera', kind: 'videoinput' },
        { deviceId: 'uw-id', label: 'Back Ultra Wide Camera', kind: 'videoinput' }
      ]
    });
    const { controller } = loadScannerContext(env);
    await controller.startCamera('environment');

    // Switch between 0.5x and 1.0x multiple times
    for (let i = 0; i < 5; i++) {
      await controller.toggleLens(0.5);
      await controller.toggleLens(1.0);
    }

    const createdStreams = env.getCreatedStreams();
    assert.ok(createdStreams.length > 5, 'Multiple streams created during switching');

    // Only the very last stream should have live tracks; all older streams must be stopped
    const currentStream = env.getCurrentStream();
    for (const s of createdStreams) {
      if (s !== currentStream) {
        for (const t of s.getTracks()) {
          assert.strictEqual(t._isStopped(), true, 'Superseded stream track must be stopped (no zombie camera leaks)');
        }
      }
    }
  });

  await test('3.4 Rapid toggle during user-facing mode switch', async () => {
    const env = setupMockEnvironment({
      devices: [
        { deviceId: 'std-id', label: 'Back Camera', kind: 'videoinput' },
        { deviceId: 'uw-id', label: 'Back Ultra Wide Camera', kind: 'videoinput' }
      ]
    });
    const { controller, sandbox } = loadScannerContext(env);
    await controller.startCamera('environment');

    // Switch to front camera via button click
    const switchBtn = sandbox.document.getElementById('switch-cam-btn');
    const lensTogglePill = sandbox.document.getElementById('lens-toggle');

    await switchBtn.dispatchEvent('click');
    assert.strictEqual(lensTogglePill.style.display, 'none', 'Pill must be hidden in front camera mode');

    // Spamming toggleLens while in front camera mode must force 1.0x
    await controller.toggleLens(0.5);
    const calls = env.getGUMCalls();
    const lastCall = calls[calls.length - 1];
    assert.strictEqual(lastCall.video.facingMode.ideal, 'user', 'Front camera mode must enforce user facingMode');
  });

  await test('3.5 Rapid toggle with intermittent hardware failure during switch', async () => {
    let failNextGUM = false;
    const env = setupMockEnvironment({
      devices: [
        { deviceId: 'std-id', label: 'Back Camera', kind: 'videoinput' },
        { deviceId: 'uw-id', label: 'Back Ultra Wide Camera', kind: 'videoinput' }
      ],
      gUMInterceptor: async (constraints) => {
        if (failNextGUM) {
          failNextGUM = false;
          const err = new Error('Camera hardware busy');
          err.name = 'NotReadableError';
          throw err;
        }
        const devId = (constraints.video && constraints.video.deviceId && constraints.video.deviceId.exact)
          ? constraints.video.deviceId.exact
          : 'cam-env-default';
        const track = createMockTrack({ deviceId: devId });
        return createMockStream([track]);
      }
    });

    const { controller, sandbox } = loadScannerContext(env);
    await controller.startCamera('environment');

    // Now make next gUM fail
    failNextGUM = true;
    await controller.toggleLens(0.5);

    // Should not throw unhandled exception, should fall back to standard
    const btn10 = sandbox.document.getElementById('lens-10');
    assert.strictEqual(btn10.classList.contains('active'), true, 'Hardware failure during toggle must fallback to 1.0x UI');
  });

  await test('3.6 User clicks 0.5x and quickly clicks 1.0x while 0.5x is in-flight', async () => {
    const env = setupMockEnvironment({
      devices: [
        { deviceId: 'std-id', label: 'Back Camera', kind: 'videoinput' },
        { deviceId: 'uw-id', label: 'Back Ultra Wide Camera', kind: 'videoinput' }
      ],
      gUMDelayMs: 20
    });
    const { controller, sandbox } = loadScannerContext(env);
    await controller.startCamera('environment');

    const btn05 = sandbox.document.getElementById('lens-05');
    const btn10 = sandbox.document.getElementById('lens-10');

    // User taps 0.5x
    const p05 = btn05.dispatchEvent('click').then(() => {
      log(`    [3.6] p05 finished at t=${Date.now()}ms, btn05.active=${btn05.classList.contains('active')}, btn10.active=${btn10.classList.contains('active')}`);
    });
    // 5ms later (while gUM is still waiting for 20ms delay), user taps 1.0x
    await new Promise(r => setTimeout(r, 5));
    const p10 = btn10.dispatchEvent('click').then(() => {
      log(`    [3.6] p10 finished at t=${Date.now()}ms, btn05.active=${btn05.classList.contains('active')}, btn10.active=${btn10.classList.contains('active')}`);
    });

    await Promise.all([p05, p10]);

    // Check final state
    log(`    3.6 Final state: btn05.active=${btn05.classList.contains('active')}, btn10.active=${btn10.classList.contains('active')}`);
    assert.strictEqual(btn10.classList.contains('active'), true, 'Final UI state must reflect user last click (1.0x)');
    assert.strictEqual(btn05.classList.contains('active'), false, '0.5x must not remain active after user clicked 1.0x');
  });

  // ------------------------------------------------------------------
  // SUITE 4: Boundary & Hostile Inputs on Interface Contracts
  // ------------------------------------------------------------------
  log('\n=== SUITE 4: Boundary & Hostile Input Contract Verification ===');

  await test('4.1 resolveCameraStream with hostile arguments (null, NaN, object, negative)', async () => {
    const env = setupMockEnvironment({
      devices: [
        { deviceId: 'std-id', label: 'Back Camera', kind: 'videoinput' },
        { deviceId: 'uw-id', label: 'Back Ultra Wide Camera', kind: 'videoinput' }
      ]
    });
    const { controller } = loadScannerContext(env);
    await controller.startCamera('environment');

    const weirdInputs = [null, undefined, NaN, {}, [], 'random', -1, 999, false, true];
    for (const val of weirdInputs) {
      const stream = await controller.resolveCameraStream(val);
      assert.ok(stream, `resolveCameraStream(${JSON.stringify(val)}) must return a MediaStream`);
    }
  });

  await test('4.2 toggleLens with hostile arguments (null, undefined, NaN, arrays)', async () => {
    const env = setupMockEnvironment({
      devices: [
        { deviceId: 'std-id', label: 'Back Camera', kind: 'videoinput' },
        { deviceId: 'uw-id', label: 'Back Ultra Wide Camera', kind: 'videoinput' }
      ]
    });
    const { controller } = loadScannerContext(env);
    await controller.startCamera('environment');

    const weirdInputs = [null, undefined, NaN, {}, [0.5], '0.500', 0, -0.5];
    for (const val of weirdInputs) {
      // Must not throw uncaught error
      await controller.toggleLens(val);
    }
  });

  await test('4.3 getLensCapabilities contract invariant check', async () => {
    const env = setupMockEnvironment({
      devices: [
        { deviceId: 'std-id', label: 'Back Camera', kind: 'videoinput' }
      ]
    });
    const { controller } = loadScannerContext(env);
    await controller.startCamera('environment');

    const caps1 = controller.getLensCapabilities();
    // Try to mutate caps1
    caps1.hasUltraWide = true;
    caps1.minZoom = -999;

    const caps2 = controller.getLensCapabilities();
    assert.strictEqual(caps2.hasUltraWide, false, 'Internal state must be protected against external mutation');
    assert.strictEqual(caps2.minZoom, 1.0);
  });

  await test('4.4 Simultaneous click event simulation on DOM elements', async () => {
    const env = setupMockEnvironment({
      devices: [
        { deviceId: 'std-id', label: 'Back Camera', kind: 'videoinput' },
        { deviceId: 'uw-id', label: 'Back Ultra Wide Camera', kind: 'videoinput' }
      ]
    });
    const { controller, sandbox } = loadScannerContext(env);
    await controller.startCamera('environment');

    const btn05 = sandbox.document.getElementById('lens-05');
    const btn10 = sandbox.document.getElementById('lens-10');

    // Simulate rapid concurrent user taps on both buttons
    await Promise.all([
      btn05.dispatchEvent('click'),
      btn10.dispatchEvent('click'),
      btn05.dispatchEvent('click')
    ]);

    const calls = env.getGUMCalls();
    assert.ok(calls.length >= 2, 'Events dispatched and processed');
    // Ensure active stream is valid and videoElem has it attached
    const videoElem = sandbox.document.getElementById('camera-video');
    assert.ok(videoElem.srcObject, 'videoElem must have valid srcObject');
    assert.strictEqual(videoElem.srcObject.getVideoTracks()[0].readyState, 'live');
  });

  // ------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------
  log('\n====================================================================');
  log('ADVERSARIAL STRESS TEST SUMMARY:');
  log(`Total Tests Run : ${passedTests + failedTests}`);
  log(`Passed          : ${passedTests}`);
  log(`Failed          : ${failedTests}`);
  log(`Pass Rate       : ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
  log('====================================================================\n');

  if (failedTests > 0) {
    log('FAILURES ENCOUNTERED:');
    for (const f of testFailures) {
      log(` - ${f.name}: ${f.error.message}`);
    }
    process.exit(1);
  } else {
    log('EMPIRICAL ADVERSARIAL VERDICT: ALL PASS');
    process.exit(0);
  }
}

runAdversarialTests().catch(err => {
  console.error('Fatal error running adversarial tests:', err);
  process.exit(1);
});
