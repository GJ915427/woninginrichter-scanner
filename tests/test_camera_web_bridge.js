/**
 * test_camera_web_bridge.js
 *
 * Dedicated Milestone 3 Test Suite for Web-to-Native Bridge & Viewfinder Integration.
 * Validates:
 * 1. Safe runtime detection (Capacitor native shell vs standard browser vs headless/sandboxed).
 * 2. CameraBridgeAdapter pattern (invoking UltraWideCamera plugin in native mode, WebRTC fallback in web mode).
 * 3. Transparent underlay CSS (.native-camera-underlay-active) and HUD visibility.
 * 4. Lens toggle [ 0.5x / 1.0x ] bindings and AE/AF lockout synchronization.
 * 5. Native recording handshake (startRecording with IMU telemetry & stopRecording).
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
    console.error(`    -> ${err.stack || err.message}`);
    failedTests++;
  }
}

function createMockElement(tagName = 'div', id = '') {
  return {
    tagName: tagName.toUpperCase(),
    id,
    className: '',
    style: {},
    classList: {
      _classes: new Set(),
      add(cls) { this._classes.add(cls); },
      remove(cls) { this._classes.delete(cls); },
      contains(cls) { return this._classes.has(cls); },
      toggle(cls) {
        if (this._classes.has(cls)) {
          this._classes.delete(cls);
          return false;
        } else {
          this._classes.add(cls);
          return true;
        }
      }
    },
    innerText: '',
    innerHTML: '',
    disabled: false,
    src: '',
    srcObject: null,
    play: async () => {},
    pause: () => {},
    addEventListener: () => {},
    removeEventListener: () => {}
  };
}

function setupMockEnvironment(customCapacitor = undefined) {
  const elements = {};
  const getOrCreate = (id, tag = 'div') => {
    if (!elements[id]) elements[id] = createMockElement(tag, id);
    return elements[id];
  };

  const body = createMockElement('body');
  const mockDoc = {
    body,
    getElementById: (id) => getOrCreate(id),
    createElement: (tag) => createMockElement(tag),
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  const mockLocation = {
    protocol: 'https:',
    hostname: 'localhost',
    origin: 'https://localhost',
    href: 'https://localhost/scanner.html',
    port: '443'
  };

  const sandbox = {
    document: mockDoc,
    location: mockLocation,
    window: {
      document: mockDoc,
      location: mockLocation,
      addEventListener: () => {},
      removeEventListener: () => {},
      performance: { now: () => Date.now() },
      setInterval: () => 1,
      clearInterval: () => {},
      fetch: async () => ({ ok: true, status: 200, json: async () => ({}) })
    },
    navigator: {
      mediaDevices: {
        getUserMedia: async () => ({
          getVideoTracks: () => [{
            readyState: 'live',
            stop: () => {},
            getSettings: () => ({ deviceId: 'default' }),
            getCapabilities: () => ({ zoom: { min: 1.0, max: 5.0 } }),
            applyConstraints: async () => {}
          }]
        }),
        enumerateDevices: async () => []
      }
    },
    performance: { now: () => Date.now() },
    fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
    console: { log: () => {}, warn: () => {}, error: () => {} },
    alert: () => {},
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    module: { exports: {} },
    exports: {}
  };

  if (customCapacitor !== undefined) {
    sandbox.window.Capacitor = customCapacitor;
  }

  return { sandbox, mockDoc, body };
}

function loadScanner(envOrSandbox) {
  const sandbox = envOrSandbox.sandbox || envOrSandbox;
  const htmlPath = path.resolve(__dirname, '..', 'scanner.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  const allScripts = [...htmlContent.matchAll(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi)];
  const appScript = allScripts.find(s => s[1].includes('CameraBridgeAdapter')) || allScripts[allScripts.length - 1];
  if (!appScript) {
    throw new Error('Application script not found in scanner.html');
  }

  vm.createContext(sandbox);
  vm.runInContext(appScript[1], sandbox);

  return {
    sandbox,
    controller: sandbox.module.exports.cameraController || sandbox.window.cameraController,
    adapter: sandbox.module.exports.CameraBridgeAdapter || sandbox.window.CameraBridgeAdapter,
    checkIsNative: sandbox.module.exports.checkIsNativeCapacitor
  };
}

async function runWebBridgeTests() {
  log('====================================================================');
  log('STARTING MILESTONE 3: WEB-TO-NATIVE BRIDGE VERIFICATION SUITE');
  log('====================================================================\n');

  log('=== SUITE 1: Runtime Platform Detection & Exception Safety ===');

  await test('1.1 Standard browser mode: window.Capacitor is undefined', async () => {
    const { sandbox, controller, adapter, checkIsNative } = loadScanner(setupMockEnvironment());
    assert.strictEqual(adapter.isNativePlatform(), false, 'isNativePlatform must be false');
    assert.strictEqual(adapter.is_native, false, 'is_native must be false');
    assert.strictEqual(adapter.isNative, false, 'isNative must be false');
    if (checkIsNative) {
      assert.strictEqual(checkIsNative(), false);
    }
  });

  await test('1.2 Web-platform Capacitor shell: isNativePlatform() returns false', async () => {
    const mockCapacitor = {
      isNativePlatform: () => false,
      Plugins: { UltraWideCamera: {} }
    };
    const { adapter } = loadScanner(setupMockEnvironment(mockCapacitor).sandbox);
    assert.strictEqual(adapter.isNativePlatform(), false, 'Non-native platform must evaluate to false');
  });

  await test('1.3 Capacitor shell missing UltraWideCamera plugin', async () => {
    const mockCapacitor = {
      isNativePlatform: () => true,
      Plugins: {} // Missing UltraWideCamera
    };
    const { adapter } = loadScanner(setupMockEnvironment(mockCapacitor).sandbox);
    assert.strictEqual(adapter.isNativePlatform(), false, 'Missing plugin must evaluate to false');
  });

  await test('1.4 Hostile runtime: isNativePlatform throws exception', async () => {
    const mockCapacitor = {
      isNativePlatform: () => { throw new Error('Security sandbox violation'); },
      Plugins: { UltraWideCamera: {} }
    };
    const { adapter } = loadScanner(setupMockEnvironment(mockCapacitor).sandbox);
    assert.strictEqual(adapter.isNativePlatform(), false, 'Exception must be caught safely');
  });

  await test('1.5 Full Native Android shell detection', async () => {
    const mockPlugin = {
      startPreview: async (opts) => ({ success: true, activeCameraId: '2', zoomRatio: opts.zoomRatio || 0.5 }),
      stopPreview: async () => ({ success: true }),
      lockExposureAndFocus: async (opts) => ({ aeLocked: opts.aeLocked, afLocked: opts.afLocked }),
      startRecording: async () => ({ success: true, outputPath: '/cache/scan.mp4' }),
      stopRecording: async () => ({ success: true, videoPath: '/cache/scan.mp4', sampleCount: 100 })
    };
    const mockCapacitor = {
      isNativePlatform: () => true,
      Plugins: { UltraWideCamera: mockPlugin }
    };
    const { adapter } = loadScanner(setupMockEnvironment(mockCapacitor).sandbox);
    assert.strictEqual(adapter.isNativePlatform(), true, 'Native platform must evaluate to true');
    assert.ok(adapter.plugin, 'Plugin reference must be accessible');
  });

  log('\n=== SUITE 2: Native Camera Lifecycle & Viewfinder Transparency ===');

  await test('2.1 initializeCamera in native mode starts preview and sets underlay class', async () => {
    let previewCalled = false;
    let receivedZoom = 0;
    const mockPlugin = {
      startPreview: async (opts) => {
        previewCalled = true;
        receivedZoom = opts.zoomRatio;
        return { success: true, activeCameraId: '2', zoomRatio: opts.zoomRatio };
      },
      stopPreview: async () => ({ success: true })
    };
    const mockCapacitor = {
      isNativePlatform: () => true,
      Plugins: { UltraWideCamera: mockPlugin }
    };
    const env = setupMockEnvironment(mockCapacitor);
    const { adapter } = loadScanner(env.sandbox);

    assert.strictEqual(adapter.underlay_active, false);
    assert.strictEqual(env.body.classList.contains('native-camera-underlay-active'), false);

    const initResult = await adapter.initializeCamera(true);
    assert.strictEqual(initResult.mode, 'native');
    assert.strictEqual(initResult.activeLens, '0.5x');
    assert.strictEqual(previewCalled, true);
    assert.strictEqual(receivedZoom, 0.5);
    assert.strictEqual(adapter.underlay_active, true);
    assert.strictEqual(env.body.classList.contains('native-camera-underlay-active'), true);

    // Teardown cleans up underlay class
    await adapter.teardown();
    assert.strictEqual(adapter.underlay_active, false);
    assert.strictEqual(env.body.classList.contains('native-camera-underlay-active'), false);
  });

  await test('2.2 toggleLens in native mode alternates 0.5x and 1.0x with plugin invocation', async () => {
    const previewCalls = [];
    const mockPlugin = {
      startPreview: async (opts) => {
        previewCalls.push(opts);
        return { success: true, zoomRatio: opts.zoomRatio };
      }
    };
    const mockCapacitor = {
      isNativePlatform: () => true,
      Plugins: { UltraWideCamera: mockPlugin }
    };
    const env = setupMockEnvironment(mockCapacitor);
    const { adapter } = loadScanner(env.sandbox);

    await adapter.initializeCamera(false); // starts at 1.0x
    assert.strictEqual(adapter.active_lens, '1.0x');

    const toggled1 = await adapter.toggleLens();
    assert.strictEqual(toggled1, '0.5x');
    assert.strictEqual(previewCalls[previewCalls.length - 1].zoomRatio, 0.5);
    assert.strictEqual(previewCalls[previewCalls.length - 1].lens, 'ultra_wide');

    const toggled2 = await adapter.toggleLens();
    assert.strictEqual(toggled2, '1.0x');
    assert.strictEqual(previewCalls[previewCalls.length - 1].zoomRatio, 1.0);
    assert.strictEqual(previewCalls[previewCalls.length - 1].lens, 'wide');
  });

  await test('2.3 AE/AF lockout and native recording handshake', async () => {
    let lockedAe = false;
    let lockedAf = false;
    let recordingStarted = false;
    let recordingStopped = false;

    const mockPlugin = {
      startPreview: async () => ({ success: true }),
      lockExposureAndFocus: async (opts) => {
        lockedAe = opts.aeLocked;
        lockedAf = opts.afLocked;
        return { aeLocked: lockedAe, afLocked: lockedAf };
      },
      startRecording: async () => {
        recordingStarted = true;
        return { success: true, outputPath: '/cache/scan.mp4' };
      },
      stopRecording: async () => {
        recordingStopped = true;
        return { success: true, videoPath: '/cache/scan.mp4', imuCsvPath: '/cache/imu.csv', sampleCount: 500, durationMs: 5000 };
      }
    };
    const mockCapacitor = {
      isNativePlatform: () => true,
      Plugins: { UltraWideCamera: mockPlugin }
    };
    const env = setupMockEnvironment(mockCapacitor);
    const { adapter } = loadScanner(env.sandbox);

    await adapter.startRecording({ recordImu: true });
    assert.strictEqual(recordingStarted, true, 'Native startRecording must be invoked');
    assert.strictEqual(lockedAe, true, 'AE lock must be engaged during recording');
    assert.strictEqual(lockedAf, true, 'AF lock must be engaged during recording');

    const stopResult = await adapter.stopRecording();
    assert.strictEqual(recordingStopped, true, 'Native stopRecording must be invoked');
    assert.strictEqual(stopResult.sampleCount, 500);
    assert.strictEqual(lockedAe, false, 'AE lock must be released after recording');
    assert.strictEqual(lockedAf, false, 'AF lock must be released after recording');
  });

  log('\n=== SUITE 3: Browser Fallback & Backward Compatibility ===');

  await test('3.1 initializeCamera in web mode falls back cleanly to WebRTC', async () => {
    const env = setupMockEnvironment(); // no Capacitor
    const { adapter } = loadScanner(env.sandbox);

    const res = await adapter.initializeCamera(true);
    assert.strictEqual(res.mode, 'webrtc_fallback');
    assert.strictEqual(adapter.webrtc_active, true);
    assert.strictEqual(adapter.underlay_active, false);
    assert.strictEqual(env.body.classList.contains('native-camera-underlay-active'), false);
  });

  await test('3.2 Pure browser controller functions work without errors', async () => {
    const env = setupMockEnvironment();
    const { controller } = loadScanner(env.sandbox);

    assert.strictEqual(typeof controller.resolveCameraStream, 'function');
    assert.strictEqual(typeof controller.toggleLens, 'function');
    assert.strictEqual(typeof controller.getLensCapabilities, 'function');

    const caps = controller.getLensCapabilities();
    assert.ok('hasUltraWide' in caps);
  });

  log('\n=== SUITE 4: Static Audit of scanner.html for M3 Bridge Artifacts ===');

  await test('4.1 CSS rules for .native-camera-underlay-active exist and apply transparent background', async () => {
    const htmlPath = path.resolve(__dirname, '..', 'scanner.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(html.includes('.native-camera-underlay-active'), 'Must define .native-camera-underlay-active');
    assert.ok(html.includes('background: transparent !important;'), 'Must specify transparent background');
    assert.ok(html.includes('#camera-video'), 'Must hide #camera-video');
  });

  await test('4.2 Safe platform detection pattern present in source', async () => {
    const htmlPath = path.resolve(__dirname, '..', 'scanner.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(html.includes('isNativePlatform'), 'Must check isNativePlatform');
    assert.ok(html.includes('UltraWideCamera'), 'Must reference UltraWideCamera plugin');
    assert.ok(html.includes('CameraBridgeAdapter'), 'Must define CameraBridgeAdapter');
  });

  log('\n====================================================================');
  log('WEB-TO-NATIVE BRIDGE TEST SUMMARY:');
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

runWebBridgeTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
