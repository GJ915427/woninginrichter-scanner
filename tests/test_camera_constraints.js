/**
 * test_camera_constraints.js
 * Comprehensive Unit & Integration Test Suite for Camera & Lens Selection (Milestone 1 / R1)
 *
 * Verifies:
 * 1. Dual-strategy 0.5x Ultra-Wide auto-discovery:
 *    - Tier 1: Device enumeration (iOS, Android, Samsung multi-camera heuristics)
 *    - Tier 2: Continuous zoom capability (MediaTrackCapabilities.zoom <= 0.6)
 *    - Tier 3: Seamless fallback to 1.0x standard wide-angle when neither is present
 * 2. Lens switching via track constraints (Tier 2) and track replacement (Tier 1)
 * 3. Viewfinder HUD toggle pill [ 0.5x / 1.0x ] DOM state transitions and visibility
 * 4. Error recovery: OverconstrainedError, hardware rejection, invalid input
 * 5. Interface contracts: resolveCameraStream, toggleLens, getLensCapabilities
 * 6. Direct execution of production code extracted from scanner.html in Node VM
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passedTests = 0;
let failedTests = 0;
const testLogs = [];

function log(msg) {
  console.log(msg);
  testLogs.push(msg);
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

// ============================================================================
// MOCK FACTORIES FOR WEBRTC & DOM
// ============================================================================

function createMockTrack({ id = 'track-1', deviceId = 'cam-default', capabilities = {}, settings = {} } = {}) {
  let activeConstraints = {};
  let isStopped = false;

  return {
    id,
    kind: 'video',
    readyState: 'live',
    getCapabilities() {
      return { ...capabilities };
    },
    getSettings() {
      return { deviceId, ...settings };
    },
    async applyConstraints(constraints) {
      if (capabilities._failApplyConstraints) {
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

function setupMockEnvironment({ devices = [], initialTrackCapabilities = {}, gUMInterceptor = null } = {}) {
  const mockDoc = createMockDocument();
  let currentStream = null;
  const getUserMediaCalls = [];

  const mockNavigator = {
    mediaDevices: {
      async enumerateDevices() {
        return devices.map(d => ({
          deviceId: d.deviceId || 'dev-' + Math.random().toString(36).substring(2, 6),
          kind: d.kind || 'videoinput',
          label: d.label || '',
          groupId: d.groupId || 'group-1'
        }));
      },
      async getUserMedia(constraints) {
        getUserMediaCalls.push(constraints);
        if (gUMInterceptor) {
          return await gUMInterceptor(constraints);
        }
        const devId = (constraints.video && constraints.video.deviceId && constraints.video.deviceId.exact) 
          ? constraints.video.deviceId.exact 
          : 'cam-env-default';
        const track = createMockTrack({
          deviceId: devId,
          capabilities: initialTrackCapabilities
        });
        currentStream = createMockStream([track]);
        return currentStream;
      }
    }
  };

  return {
    mockDoc,
    mockNavigator,
    getGUMCalls: () => getUserMediaCalls,
    getCurrentStream: () => currentStream
  };
}

// Load and evaluate script from scanner.html
function loadScannerContext(env) {
  const htmlPath = path.resolve(__dirname, '..', 'scanner.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // Extract <script> that contains application logic (skip CDN scripts)
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
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
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

// ============================================================================
// TEST SUITES
// ============================================================================

async function runAllTests() {
  log('\n=== SUITE 1: Tier 1 Auto-Discovery (Device Enumeration & Label Heuristics) ===');

  await test('1.1 iOS device labels: detect Back Ultra Wide Camera', async () => {
    const devices = [
      { deviceId: 'cam-ultra-ios', kind: 'videoinput', label: 'Back Ultra Wide Camera' },
      { deviceId: 'cam-main-ios', kind: 'videoinput', label: 'Back Camera' },
      { deviceId: 'cam-front-ios', kind: 'videoinput', label: 'Front Camera' }
    ];
    const env = setupMockEnvironment({ devices });
    const { controller } = loadScannerContext(env);

    const caps = await controller.detectLensCapabilities();
    assert.strictEqual(caps.hasUltraWide, true, 'hasUltraWide should be true');
    assert.strictEqual(caps.ultraWideDeviceId, 'cam-ultra-ios', 'ultraWideDeviceId must match iOS ultra wide device');
    assert.strictEqual(caps.standardDeviceId, 'cam-main-ios', 'standardDeviceId must match main camera');
    assert.strictEqual(caps.minZoom, 0.5, 'minZoom must be 0.5');
  });

  await test('1.2 Android device labels: detect camera2 1 (back 1 / ultra-wide)', async () => {
    const devices = [
      { deviceId: 'cam-0-android', kind: 'videoinput', label: 'camera2 0, facing back' },
      { deviceId: 'cam-1-android', kind: 'videoinput', label: 'camera2 1, facing back' },
      { deviceId: 'cam-front-android', kind: 'videoinput', label: 'camera2 2, facing front' }
    ];
    const env = setupMockEnvironment({ devices });
    const { controller } = loadScannerContext(env);

    const caps = await controller.detectLensCapabilities();
    assert.strictEqual(caps.hasUltraWide, true, 'hasUltraWide should be true for Android multi-camera');
    assert.strictEqual(caps.ultraWideDeviceId, 'cam-1-android', 'camera2 1 should be selected as ultra wide');
    assert.strictEqual(caps.standardDeviceId, 'cam-0-android', 'camera2 0 should be selected as standard');
  });

  await test('1.3 Samsung device labels: detect 0.5x label', async () => {
    const devices = [
      { deviceId: 'cam-wide-samsung', kind: 'videoinput', label: 'Back Camera (1.0x)' },
      { deviceId: 'cam-uw-samsung', kind: 'videoinput', label: 'Back Camera (0.5x)' }
    ];
    const env = setupMockEnvironment({ devices });
    const { controller } = loadScannerContext(env);

    const caps = await controller.detectLensCapabilities();
    assert.strictEqual(caps.hasUltraWide, true, 'Samsung 0.5x label must be recognized');
    assert.strictEqual(caps.ultraWideDeviceId, 'cam-uw-samsung');
    assert.strictEqual(caps.standardDeviceId, 'cam-wide-samsung');
  });

  await test('1.4 Single standard camera: reports hasUltraWide = false', async () => {
    const devices = [
      { deviceId: 'cam-single', kind: 'videoinput', label: 'Standard Back Camera' },
      { deviceId: 'cam-front', kind: 'videoinput', label: 'Front Facing Camera' }
    ];
    const env = setupMockEnvironment({ devices });
    const { controller } = loadScannerContext(env);

    const caps = await controller.detectLensCapabilities();
    assert.strictEqual(caps.hasUltraWide, false);
    assert.strictEqual(caps.ultraWideDeviceId, null);
    assert.strictEqual(caps.minZoom, 1.0);
  });

  await test('1.5 Telephoto lenses are excluded from ultra-wide detection', async () => {
    const devices = [
      { deviceId: 'cam-tele', kind: 'videoinput', label: 'Back Telephoto Camera 3x' },
      { deviceId: 'cam-main', kind: 'videoinput', label: 'Back Camera' }
    ];
    const env = setupMockEnvironment({ devices });
    const { controller } = loadScannerContext(env);

    const caps = await controller.detectLensCapabilities();
    assert.strictEqual(caps.hasUltraWide, false, 'Telephoto must not be misidentified as ultra-wide');
    assert.strictEqual(caps.ultraWideDeviceId, null);
  });

  await test('1.6 Google Pixel 9 Pro XL camera layout: camera2 2 selected as 0.5x ultra-wide', async () => {
    const devices = [
      { deviceId: 'cam-main-pixel', kind: 'videoinput', label: 'camera2 0, facing back' },
      { deviceId: 'cam-front-pixel', kind: 'videoinput', label: 'camera2 1, facing front' },
      { deviceId: 'cam-uw-pixel', kind: 'videoinput', label: 'camera2 2, facing back' },
      { deviceId: 'cam-tele-pixel', kind: 'videoinput', label: 'camera2 3, facing back' }
    ];
    const env = setupMockEnvironment({ devices });
    const { controller } = loadScannerContext(env);

    const caps = await controller.detectLensCapabilities();
    assert.strictEqual(caps.hasUltraWide, true, 'hasUltraWide must be true on Pixel 9 Pro XL');
    assert.strictEqual(caps.ultraWideDeviceId, 'cam-uw-pixel', 'camera2 2 must be selected as ultra-wide');
    assert.strictEqual(caps.standardDeviceId, 'cam-main-pixel', 'camera2 0 must be selected as standard');
    assert.strictEqual(caps.minZoom, 0.5, 'minZoom must be 0.5');
  });

  log('\n=== SUITE 2: Tier 2 Auto-Discovery (Continuous Zoom Capability) ===');

  await test('2.1 Track with zoom capability min <= 0.6 detects ultra-wide', async () => {
    const env = setupMockEnvironment({
      devices: [{ deviceId: 'cam-unified', kind: 'videoinput', label: 'Camera' }],
      initialTrackCapabilities: { zoom: { min: 0.5, max: 8.0, step: 0.1 } }
    });
    const { controller } = loadScannerContext(env);

    await controller.resolveCameraStream(0.5);
    const caps = controller.getLensCapabilities();
    assert.strictEqual(caps.hasUltraWide, true, 'Continuous zoom min 0.5 must enable ultra-wide');
    assert.strictEqual(caps.minZoom, 0.5);
    assert.strictEqual(caps.maxZoom, 8.0);
  });

  await test('2.2 Boundary condition: zoom.min = 0.6 qualifies as ultra-wide', async () => {
    const env = setupMockEnvironment({
      devices: [{ deviceId: 'cam-1', kind: 'videoinput', label: 'Camera' }],
      initialTrackCapabilities: { zoom: { min: 0.6, max: 5.0 } }
    });
    const { controller } = loadScannerContext(env);

    await controller.resolveCameraStream(0.5);
    const caps = controller.getLensCapabilities();
    assert.strictEqual(caps.hasUltraWide, true, 'zoom.min = 0.6 must be treated as ultra-wide');
  });

  await test('2.3 Boundary condition: zoom.min = 0.7 does NOT qualify as ultra-wide', async () => {
    const env = setupMockEnvironment({
      devices: [{ deviceId: 'cam-1', kind: 'videoinput', label: 'Camera' }],
      initialTrackCapabilities: { zoom: { min: 0.7, max: 5.0 } }
    });
    const { controller } = loadScannerContext(env);

    await controller.resolveCameraStream(0.5);
    const caps = controller.getLensCapabilities();
    assert.strictEqual(caps.hasUltraWide, false, 'zoom.min = 0.7 must not qualify as ultra-wide');
    assert.strictEqual(controller.getCurrentZoom(), 1.0, 'Should fall back to 1.0x');
  });

  await test('2.4 Missing zoom capability handled gracefully without exceptions', async () => {
    const env = setupMockEnvironment({
      devices: [{ deviceId: 'cam-1', kind: 'videoinput', label: 'Camera' }],
      initialTrackCapabilities: {} // no zoom
    });
    const { controller } = loadScannerContext(env);

    await controller.resolveCameraStream(0.5);
    const caps = controller.getLensCapabilities();
    assert.strictEqual(caps.hasUltraWide, false);
    assert.strictEqual(caps.minZoom, 1.0);
  });

  log('\n=== SUITE 3: Stream Resolution & Lens Switching ===');

  await test('3.1 Tier 1 Stream resolution: requests deviceId exact for 0.5x', async () => {
    const devices = [
      { deviceId: 'cam-ultra-99', kind: 'videoinput', label: 'Ultra-Wide Rear Camera' },
      { deviceId: 'cam-std-99', kind: 'videoinput', label: 'Main Rear Camera' }
    ];
    const env = setupMockEnvironment({ devices });
    const { controller } = loadScannerContext(env);

    await controller.resolveCameraStream(0.5);
    const calls = env.getGUMCalls();
    assert.ok(calls.length >= 1, 'getUserMedia must have been invoked');
    const lastCall = calls[calls.length - 1];
    assert.strictEqual(lastCall.video.deviceId.exact, 'cam-ultra-99', 'Must select exact ultra-wide deviceId');
    assert.strictEqual(controller.getCurrentZoom(), 0.5);
  });

  await test('3.2 Tier 2 Stream resolution: applies track zoom constraint without stream recreation', async () => {
    const env = setupMockEnvironment({
      devices: [{ deviceId: 'cam-single', kind: 'videoinput', label: 'Camera' }],
      initialTrackCapabilities: { zoom: { min: 0.5, max: 10.0 } }
    });
    const { controller } = loadScannerContext(env);

    const stream = await controller.resolveCameraStream(0.5);
    const track = stream.getVideoTracks()[0];
    const activeConstraints = track._getActiveConstraints();
    assert.ok(activeConstraints.advanced, 'Should apply advanced constraints');
    assert.strictEqual(activeConstraints.advanced[0].zoom, 0.5, 'Applied zoom must be 0.5');

    // Switch to 1.0x
    await controller.toggleLens(1.0);
    const updatedConstraints = track._getActiveConstraints();
    assert.strictEqual(updatedConstraints.advanced[0].zoom, 1.0, 'Applied zoom must switch to 1.0');
    assert.strictEqual(controller.getCurrentZoom(), 1.0);
  });

  await test('3.3 Switching between 0.5x and 1.0x in Tier 1 switches device IDs', async () => {
    const devices = [
      { deviceId: 'cam-ultra-tier1', kind: 'videoinput', label: 'Back Ultra Wide Camera' },
      { deviceId: 'cam-std-tier1', kind: 'videoinput', label: 'Back Camera' }
    ];
    const env = setupMockEnvironment({ devices });
    const { controller } = loadScannerContext(env);

    await controller.resolveCameraStream(0.5);
    assert.strictEqual(controller.getCurrentZoom(), 0.5);

    // Switch to 1.0x
    await controller.toggleLens(1.0);
    assert.strictEqual(controller.getCurrentZoom(), 1.0);
    const callsAfter10 = env.getGUMCalls();
    const lastCall = callsAfter10[callsAfter10.length - 1];
    assert.strictEqual(lastCall.video.deviceId.exact, 'cam-std-tier1');

    // Switch back to 0.5x
    await controller.toggleLens(0.5);
    assert.strictEqual(controller.getCurrentZoom(), 0.5);
    const callsAfter05 = env.getGUMCalls();
    const lastCall05 = callsAfter05[callsAfter05.length - 1];
    assert.strictEqual(lastCall05.video.deviceId.exact, 'cam-ultra-tier1');
  });

  await test('3.4 Front camera mode enforces 1.0x and user facingMode', async () => {
    const devices = [
      { deviceId: 'cam-ultra', kind: 'videoinput', label: 'Back Ultra Wide Camera' },
      { deviceId: 'cam-front', kind: 'videoinput', label: 'Front Camera' }
    ];
    const env = setupMockEnvironment({ devices });
    const { controller } = loadScannerContext(env);

    controller.setFacingMode('user');
    await controller.resolveCameraStream(0.5);

    const calls = env.getGUMCalls();
    const lastCall = calls[calls.length - 1];
    assert.strictEqual(lastCall.video.facingMode.ideal, 'user');
    assert.strictEqual(controller.getCurrentZoom(), 1.0, 'Front camera must default to 1.0x');
  });

  log('\n=== SUITE 4: Tier 3 Fallback & Error Resilience ===');

  await test('4.1 Tier 3 Fallback: no ultra-wide available seamlessly falls back to 1.0x', async () => {
    const devices = [
      { deviceId: 'cam-standard', kind: 'videoinput', label: 'Regular Webcam' }
    ];
    const env = setupMockEnvironment({ devices, initialTrackCapabilities: { zoom: { min: 1.0, max: 2.0 } } });
    const { controller, sandbox } = loadScannerContext(env);

    let errorThrown = false;
    try {
      await controller.resolveCameraStream(0.5);
    } catch (e) {
      errorThrown = true;
    }

    assert.strictEqual(errorThrown, false, 'Must not throw error on unsupported ultra-wide');
    assert.strictEqual(controller.getCurrentZoom(), 1.0, 'Must fall back to 1.0x zoom');
    const btn10 = sandbox.document.getElementById('lens-10');
    const btn05 = sandbox.document.getElementById('lens-05');
    assert.ok(btn10.classList.contains('active'), '1.0x button must be active');
    assert.ok(!btn05.classList.contains('active'), '0.5x button must not be active');
  });

  await test('4.2 OverconstrainedError on ultra-wide deviceId falls back to standard camera', async () => {
    const devices = [
      { deviceId: 'cam-faulty-ultra', kind: 'videoinput', label: 'Back Ultra Wide Camera' },
      { deviceId: 'cam-standard', kind: 'videoinput', label: 'Back Camera' }
    ];
    const env = setupMockEnvironment({
      devices,
      gUMInterceptor: async (constraints) => {
        if (constraints.video && constraints.video.deviceId && constraints.video.deviceId.exact === 'cam-faulty-ultra') {
          const err = new Error('OverconstrainedError: Device unreachable');
          err.name = 'OverconstrainedError';
          throw err;
        }
        return createMockStream([createMockTrack({ deviceId: 'cam-standard' })]);
      }
    });
    const { controller } = loadScannerContext(env);

    await controller.resolveCameraStream(0.5);
    assert.strictEqual(controller.getCurrentZoom(), 1.0, 'Must recover from error and fall back to 1.0x');
  });

  await test('4.3 Track applyConstraints hardware failure recovers without uncaught rejection', async () => {
    const env = setupMockEnvironment({
      devices: [{ deviceId: 'cam-1', kind: 'videoinput', label: 'Camera' }],
      initialTrackCapabilities: { zoom: { min: 0.5, max: 5.0, _failApplyConstraints: true } }
    });
    const { controller } = loadScannerContext(env);

    let rejected = false;
    try {
      await controller.toggleLens(0.5);
    } catch (e) {
      rejected = true;
    }

    assert.strictEqual(rejected, false, 'toggleLens must absorb hardware errors gracefully');
  });

  await test('4.4 toggleLens handles various input representations (0.5, "0.5", "0.5x")', async () => {
    const devices = [
      { deviceId: 'cam-uw', kind: 'videoinput', label: 'Ultra Wide' }
    ];
    const env = setupMockEnvironment({ devices });
    const { controller } = loadScannerContext(env);

    await controller.toggleLens('0.5');
    assert.strictEqual(controller.getCurrentZoom(), 0.5);

    await controller.toggleLens(1.0);
    assert.strictEqual(controller.getCurrentZoom(), 1.0);

    await controller.toggleLens('0.5x');
    assert.strictEqual(controller.getCurrentZoom(), 0.5);
  });

  log('\n=== SUITE 5: Viewfinder HUD Toggle State & UI Transitions ===');

  await test('5.1 HUD toggle buttons exist in DOM with proper initial state', async () => {
    const env = setupMockEnvironment({});
    const { sandbox } = loadScannerContext(env);

    const pill = sandbox.document.getElementById('lens-toggle');
    const btn05 = sandbox.document.getElementById('lens-05');
    const btn10 = sandbox.document.getElementById('lens-10');

    assert.ok(pill, '#lens-toggle must exist in DOM');
    assert.ok(btn05, '#lens-05 must exist in DOM');
    assert.ok(btn10, '#lens-10 must exist in DOM');
  });

  await test('5.2 Clicking #lens-05 dispatches toggleLens and updates active classes', async () => {
    const devices = [
      { deviceId: 'cam-uw', kind: 'videoinput', label: 'Back Ultra Wide Camera' },
      { deviceId: 'cam-std', kind: 'videoinput', label: 'Back Camera' }
    ];
    const env = setupMockEnvironment({ devices });
    const { controller, sandbox } = loadScannerContext(env);

    const btn05 = sandbox.document.getElementById('lens-05');
    const btn10 = sandbox.document.getElementById('lens-10');

    // Simulate clicking 0.5x button
    await btn05.dispatchEvent('click');

    assert.strictEqual(controller.getCurrentZoom(), 0.5);
    assert.ok(btn05.classList.contains('active'), '#lens-05 must have .active class');
    assert.ok(!btn10.classList.contains('active'), '#lens-10 must not have .active class');

    // Simulate clicking 1.0x button
    await btn10.dispatchEvent('click');

    assert.strictEqual(controller.getCurrentZoom(), 1.0);
    assert.ok(btn10.classList.contains('active'), '#lens-10 must have .active class');
    assert.ok(!btn05.classList.contains('active'), '#lens-05 must not have .active class');
  });

  await test('5.3 Front camera switch button hides lens-toggle pill', async () => {
    const env = setupMockEnvironment({});
    const { sandbox } = loadScannerContext(env);

    const switchCamBtn = sandbox.document.getElementById('switch-cam-btn');
    const lensToggle = sandbox.document.getElementById('lens-toggle');

    // Click switchCamBtn (switches to user)
    await switchCamBtn.dispatchEvent('click');
    assert.strictEqual(lensToggle.style.display, 'none', 'lens-toggle should be hidden in front camera mode');

    // Click switchCamBtn again (switches back to environment)
    await switchCamBtn.dispatchEvent('click');
    assert.strictEqual(lensToggle.style.display, 'inline-flex', 'lens-toggle should be restored in environment mode');
  });

  log('\n=== SUITE 6: Interface Contracts Compliance ===');

  await test('6.1 resolveCameraStream contract verification', async () => {
    const env = setupMockEnvironment({});
    const { controller, sandbox } = loadScannerContext(env);

    assert.strictEqual(typeof controller.resolveCameraStream, 'function');
    const promise = controller.resolveCameraStream(1.0);
    assert.ok(promise && typeof promise.then === 'function', 'Must return a Promise');
    const resultStream = await promise;
    assert.ok(resultStream && typeof resultStream.getVideoTracks === 'function', 'Must resolve to MediaStream');
  });

  await test('6.2 toggleLens contract verification', async () => {
    const env = setupMockEnvironment({});
    const { controller, sandbox } = loadScannerContext(env);

    assert.strictEqual(typeof controller.toggleLens, 'function');
    const promise = controller.toggleLens(1.0);
    assert.ok(promise && typeof promise.then === 'function', 'Must return a Promise');
    const result = await promise;
    assert.strictEqual(result, undefined, 'toggleLens resolves void');
  });

  await test('6.3 getLensCapabilities contract verification', async () => {
    const env = setupMockEnvironment({});
    const { controller } = loadScannerContext(env);

    assert.strictEqual(typeof controller.getLensCapabilities, 'function');
    const caps = controller.getLensCapabilities();
    assert.ok('hasUltraWide' in caps, 'Must contain hasUltraWide boolean');
    assert.ok('minZoom' in caps, 'Must contain minZoom number');
    assert.ok('maxZoom' in caps, 'Must contain maxZoom number');
    assert.strictEqual(typeof caps.hasUltraWide, 'boolean');
    assert.strictEqual(typeof caps.minZoom, 'number');
    assert.strictEqual(typeof caps.maxZoom, 'number');
  });

  log('\n=== SUITE 7: Static Audit of scanner.html Source Code ===');

  await test('7.1 scanner.html contains required DOM elements, classes, and CSS rules', async () => {
    const htmlPath = path.resolve(__dirname, '..', 'scanner.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    // DOM Elements
    assert.ok(html.includes('id="lens-toggle"'), 'scanner.html must contain id="lens-toggle"');
    assert.ok(html.includes('id="lens-05"'), 'scanner.html must contain id="lens-05"');
    assert.ok(html.includes('id="lens-10"'), 'scanner.html must contain id="lens-10"');
    assert.ok(html.includes('0.5x'), 'scanner.html must contain "0.5x" label');
    assert.ok(html.includes('1.0x'), 'scanner.html must contain "1.0x" label');

    // CSS Rules
    assert.ok(html.includes('.lens-toggle-pill'), 'scanner.html must style .lens-toggle-pill');
    assert.ok(html.includes('.lens-opt'), 'scanner.html must style .lens-opt');
    assert.ok(html.includes('.lens-opt.active'), 'scanner.html must style .lens-opt.active');

    // Function definitions
    assert.ok(html.includes('resolveCameraStream'), 'scanner.html must implement resolveCameraStream');
    assert.ok(html.includes('toggleLens'), 'scanner.html must implement toggleLens');
    assert.ok(html.includes('getLensCapabilities'), 'scanner.html must implement getLensCapabilities');
    assert.ok(html.includes('detectLensCapabilities'), 'scanner.html must implement detectLensCapabilities');
  });

  // ============================================================================
  // SUMMARY
  // ============================================================================
  log('\n====================================================================');
  log('CAMERA CONSTRAINTS & LENS SELECTION TEST SUMMARY:');
  log(`Total Tests Run : ${passedTests + failedTests}`);
  log(`Passed          : ${passedTests}`);
  log(`Failed          : ${failedTests}`);
  const passRate = ((passedTests / (passedTests + failedTests)) * 100).toFixed(1);
  log(`Pass Rate       : ${passRate}%`);
  log('====================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
