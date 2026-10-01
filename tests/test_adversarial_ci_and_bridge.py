"""
tests/test_adversarial_ci_and_bridge.py
=======================================
Adversarial Stress Test Suite for:
1. CI/CD Cloud Build Pipeline (.github/workflows/build-apk.yml)
   - Schema validation, Action version pinning, JDK 17 / SDK 34 compatibility,
   - Path resolution exactness, subshell semantics, fail-fast safeguards,
   - Package-lock fallback logic, Gradle memory & daemon constraints.
2. Web-to-Native Bridge Runtime & Viewfinder (scanner.html)
   - Hostile & corrupted mock window.Capacitor object injection.
   - Smooth fallback to WebRTC without uncaught exceptions or crashes.
   - Hostile WebRTC environments (NotAllowedError, NotFoundError, OverconstrainedError).
   - Race conditions: pre-init lens clicking, concurrent stopRecording/stopPreview,
   - Rapid toggle stress, double-tap debounce, idempotency of start/stop recording.
3. Asset Sync & Android Scaffolding Compatibility
   - sync_web_assets.js exact replication, Gradle wrapper distributionUrl, AGP 8.2.1.
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict

import pytest
import yaml

PROJECT_ROOT = Path(__file__).resolve().parent.parent
WORKFLOW_FILE = PROJECT_ROOT / ".github" / "workflows" / "build-apk.yml"
SCANNER_HTML = PROJECT_ROOT / "scanner.html"
ANDROID_DIR = PROJECT_ROOT / "android"
APP_GRADLE = ANDROID_DIR / "app" / "build.gradle"
ROOT_GRADLE = ANDROID_DIR / "build.gradle"
GRADLE_WRAPPER_PROPS = ANDROID_DIR / "gradle" / "wrapper" / "gradle-wrapper.properties"
PACKAGE_JSON = PROJECT_ROOT / "package.json"
CAP_CONFIG = PROJECT_ROOT / "capacitor.config.json"
SYNC_SCRIPT = PROJECT_ROOT / "scripts" / "sync_web_assets.js"


# ============================================================================
# HELPER: RUN NODE JS CODE AGAINST SCANNER.HTML IN NODE VM
# ============================================================================

def run_node_bridge_test(js_body: str, mock_gum_error: str = None) -> Dict[str, Any]:
    """
    Executes a Node.js snippet that loads scanner.html into a VM context
    with a mock DOM environment and returns JSON test results.
    """
    gum_impl = """
                getUserMedia: async () => ({
                    getVideoTracks: () => [{
                        readyState: 'live',
                        stop: () => {},
                        getSettings: () => ({ deviceId: 'cam_default' }),
                        getCapabilities: () => ({ zoom: { min: 1.0, max: 8.0 } }),
                        applyConstraints: async () => {}
                    }]
                }),
    """
    if mock_gum_error:
        gum_impl = f"""
                getUserMedia: async () => {{
                    const err = new Error("Mock WebRTC failure: {mock_gum_error}");
                    err.name = "{mock_gum_error}";
                    throw err;
                }},
        """

    node_harness = f"""
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const scannerPath = path.resolve({json.dumps(str(SCANNER_HTML))});
const htmlContent = fs.readFileSync(scannerPath, 'utf8');

const allScripts = [...htmlContent.matchAll(/<script[\\s\\S]*?>([\\s\\S]*?)<\\/script>/gi)];
const appScriptMatch = allScripts.find(s => s[1].includes('CameraBridgeAdapter')) || allScripts[allScripts.length - 1];
if (!appScriptMatch) {{
    console.log(JSON.stringify({{ error: "CameraBridgeAdapter script not found in scanner.html" }}));
    process.exit(1);
}}
const appCode = appScriptMatch[1];

function createMockElement(tagName = 'div', id = '') {{
    const listeners = {{}};
    return {{
        tagName: tagName.toUpperCase(),
        id,
        className: '',
        style: {{}},
        classList: {{
            _classes: new Set(),
            add(cls) {{ this._classes.add(cls); }},
            remove(cls) {{ this._classes.delete(cls); }},
            contains(cls) {{ return this._classes.has(cls); }},
            toggle(cls) {{
                if (this._classes.has(cls)) {{ this._classes.delete(cls); return false; }}
                this._classes.add(cls); return true;
            }}
        }},
        innerText: '',
        innerHTML: '',
        value: '',
        disabled: false,
        src: '',
        srcObject: null,
        play: async () => {{}},
        pause: () => {{}},
        addEventListener(event, cb) {{
            listeners[event] = listeners[event] || [];
            listeners[event].push(cb);
        }},
        removeEventListener(event, cb) {{
            if (!listeners[event]) return;
            listeners[event] = listeners[event].filter(x => x !== cb);
        }},
        trigger(event, e = {{}}) {{
            for (const cb of (listeners[event] || [])) cb(e);
        }}
    }};
}}

function setupEnv(customCapacitor) {{
    const elements = {{}};
    const getOrCreate = (id, tag = 'div') => {{
        if (!elements[id]) elements[id] = createMockElement(tag, id);
        return elements[id];
    }};

    const body = createMockElement('body');
    const mockDoc = {{
        body,
        getElementById: (id) => getOrCreate(id),
        createElement: (tag) => createMockElement(tag),
        addEventListener: () => {{}},
        removeEventListener: () => {{}}
    }};

    const mockLocation = {{
        protocol: 'https:',
        hostname: 'localhost',
        origin: 'https://localhost',
        href: 'https://localhost/scanner.html',
        port: '443'
    }};

    const sandbox = {{
        document: mockDoc,
        location: mockLocation,
        window: {{
            document: mockDoc,
            location: mockLocation,
            addEventListener: () => {{}},
            removeEventListener: () => {{}},
            performance: {{ now: () => Date.now() }},
            setInterval: () => 1,
            clearInterval: () => {{}},
            fetch: async () => ({{ ok: true, status: 200, json: async () => ({{}}) }})
        }},
        navigator: {{
            mediaDevices: {{
                {gum_impl}
                enumerateDevices: async () => []
            }},
            vibrate: () => true
        }},
        console: {{
            log: () => {{}},
            warn: () => {{}},
            error: () => {{}}
        }},
        alert: () => {{}},
        setTimeout: (fn) => fn(),
        clearTimeout: () => {{}},
        setInterval: () => 1,
        clearInterval: () => {{}},
        performance: {{ now: () => Date.now() }},
        module: {{ exports: {{}} }},
        exports: {{}}
    }};

    if (customCapacitor !== undefined) {{
        sandbox.window.Capacitor = customCapacitor;
    }}

    vm.createContext(sandbox);
    vm.runInContext(appCode, sandbox);

    return {{
        sandbox,
        elements,
        controller: sandbox.module.exports.cameraController || sandbox.window.cameraController,
        adapter: sandbox.module.exports.CameraBridgeAdapter || sandbox.window.CameraBridgeAdapter,
        checkIsNative: sandbox.module.exports.checkIsNativeCapacitor || sandbox.window.checkIsNativeCapacitor
    }};
}}

(async () => {{
    try {{
        {js_body}
    }} catch (fatalErr) {{
        console.log(JSON.stringify({{ fatal_error: fatalErr.stack || fatalErr.message }}));
        process.exit(1);
    }}
}})();
"""
    result = subprocess.run(
        ["node", "-e", node_harness],
        capture_output=True,
        text=True,
        cwd=PROJECT_ROOT,
        timeout=15
    )
    if result.returncode != 0:
        raise RuntimeError(f"Node execution failed (code {result.returncode}): {result.stderr or result.stdout}")
    
    output_lines = [line.strip() for line in result.stdout.splitlines() if line.strip().startswith("{")]
    if not output_lines:
        raise ValueError(f"No JSON output from Node harness: stdout={result.stdout} stderr={result.stderr}")
    return json.loads(output_lines[-1])


# ============================================================================
# 1. ADVERSARIAL CHALLENGES FOR GITHUB ACTIONS WORKFLOW (.github/workflows/build-apk.yml)
# ============================================================================

class TestAdversarialCIWorkflow:
    """
    Stress-tests GitHub Actions workflow schema, step paths, action pinning,
    JDK/SDK compatibility, and fail-fast invariants.
    """

    @pytest.fixture(autouse=True)
    def load_workflow(self):
        assert WORKFLOW_FILE.is_file(), f"Workflow file missing: {WORKFLOW_FILE}"
        with open(WORKFLOW_FILE, "r", encoding="utf-8") as f:
            self.raw_yaml = f.read()
            self.data = yaml.safe_load(self.raw_yaml)
        assert isinstance(self.data, dict), "Workflow YAML must parse as a dictionary"
        self.job = self.data.get("jobs", {}).get("build", {})
        self.steps = self.job.get("steps", [])

    def test_workflow_top_level_structure_and_triggers(self):
        """Validates triggers, name, permissions, and timeout protection."""
        assert "name" in self.data, "Workflow must declare a top-level name"
        
        # In YAML 1.1 unquoted 'on' is loaded as boolean True by PyYAML
        assert "on" in self.data or True in self.data, "Workflow must declare triggers ('on')"
        triggers = self.data.get("on") if "on" in self.data else self.data.get(True)
        assert isinstance(triggers, dict), "Triggers must be a dictionary"
        
        # Verify essential triggers are declared
        assert "push" in triggers, "Workflow must trigger on git push"
        assert "pull_request" in triggers, "Workflow must trigger on pull_request"
        assert "workflow_dispatch" in triggers, "Workflow must support manual trigger"

        # Push branch safety
        push_branches = triggers["push"].get("branches", [])
        assert "main" in push_branches or "master" in push_branches, "Push must monitor main/master"

        # Security permissions
        assert "permissions" in self.data, "Workflow must declare explicit least-privilege permissions"
        assert self.data["permissions"].get("contents") == "read", "contents permission must be read-only"

        # Timeout safeguard
        assert self.job.get("timeout-minutes", 0) > 0, "Job must have timeout-minutes configured to prevent stuck runners"
        assert self.job.get("timeout-minutes") <= 60, "Job timeout should be sane (<= 60 min)"

    def test_action_version_pinning_and_modern_node_runtimes(self):
        """
        Adversarial test against deprecated Node 12/16 based GitHub Actions.
        Actions must be pinned to v4 (or setup-android@v3).
        """
        step_uses = [step.get("uses") for step in self.steps if "uses" in step]
        
        # Verify checkout@v4
        checkout_steps = [u for u in step_uses if u.startswith("actions/checkout")]
        assert len(checkout_steps) == 1, "Must have exactly one actions/checkout step"
        assert checkout_steps[0] == "actions/checkout@v4", "actions/checkout must be pinned to @v4"

        # Verify setup-node@v4
        node_steps = [u for u in step_uses if u.startswith("actions/setup-node")]
        assert len(node_steps) == 1, "Must have exactly one actions/setup-node step"
        assert node_steps[0] == "actions/setup-node@v4", "actions/setup-node must be pinned to @v4"

        # Verify setup-java (v4 or v5)
        java_steps = [u for u in step_uses if u.startswith("actions/setup-java")]
        assert len(java_steps) == 1, "Must have exactly one actions/setup-java step"
        assert java_steps[0] in ("actions/setup-java@v4", "actions/setup-java@v5"), "actions/setup-java must be pinned to @v4 or @v5"

        # Verify Gradle / Android setup (setup-gradle@v4 or setup-android@v3)
        gradle_steps = [u for u in step_uses if "setup-gradle" in u or "setup-android" in u]
        assert len(gradle_steps) == 1, "Must have a Gradle or Android setup step"
        assert gradle_steps[0] in ("gradle/actions/setup-gradle@v4", "android-actions/setup-android@v3")

        # Verify upload-artifact@v4
        upload_steps = [u for u in step_uses if u.startswith("actions/upload-artifact")]
        assert len(upload_steps) == 1, "Must have exactly one actions/upload-artifact step"
        assert upload_steps[0] == "actions/upload-artifact@v4", "actions/upload-artifact must be pinned to @v4"

    def test_jdk17_and_sdk34_compatibility_matrix(self):
        """
        Verifies JDK 17 (Temurin) and Android SDK 34 compatibility with
        Gradle 8.2.1 and Capacitor 6.
        """
        # Find setup-java step
        java_step = next(s for s in self.steps if s.get("uses", "").startswith("actions/setup-java"))
        java_with = java_step.get("with", {})
        assert str(java_with.get("java-version")) == "17", "Java version must be JDK 17"
        assert java_with.get("distribution") == "temurin", "Java distribution must be Eclipse Temurin"

        # Verify Gradle setup step
        gradle_step = next(s for s in self.steps if "setup-gradle" in s.get("uses", "") or "setup-android" in s.get("uses", ""))
        assert gradle_step is not None

        # Verify against app/build.gradle
        assert APP_GRADLE.is_file(), "app/build.gradle must exist"
        with open(APP_GRADLE, "r", encoding="utf-8") as f:
            gradle_text = f.read()
        assert "compileSdk 34" in gradle_text, "app/build.gradle compileSdk must match SDK 34"
        assert "targetSdk 34" in gradle_text, "app/build.gradle targetSdk must match SDK 34"
        assert "VERSION_17" in gradle_text, "app/build.gradle must specify Java 17 compatibility"
        assert "jvmTarget = '17'" in gradle_text, "app/build.gradle must specify Kotlin jvmTarget = 17"

        # Verify against gradle-wrapper.properties
        assert GRADLE_WRAPPER_PROPS.is_file(), "gradle-wrapper.properties must exist"
        with open(GRADLE_WRAPPER_PROPS, "r", encoding="utf-8") as f:
            wrapper_text = f.read()
        assert "gradle-8.2.1" in wrapper_text, "Gradle wrapper must use Gradle 8.2.1"

    def test_pipeline_step_ordering_and_dependency_flow(self):
        """
        Ensures execution order guarantees all dependencies and web assets
        are prepared before Capacitor sync and Gradle compilation.
        """
        step_names = [s.get("name") for s in self.steps]
        
        idx_checkout = next(i for i, n in enumerate(step_names) if "Checkout" in n)
        idx_node = next(i for i, n in enumerate(step_names) if "Node.js" in n)
        idx_java = next(i for i, n in enumerate(step_names) if "JDK 17" in n)
        idx_sdk = next(i for i, n in enumerate(step_names) if "Android SDK" in n)
        idx_install = next(i for i, n in enumerate(step_names) if "Install Node" in n)
        idx_sync_assets = next(i for i, n in enumerate(step_names) if "Sync Web Assets" in n)
        idx_cap_sync = next(i for i, n in enumerate(step_names) if "Sync Capacitor" in n)
        idx_chmod = next(i for i, n in enumerate(step_names) if "Gradle Wrapper Executable" in n)
        idx_build = next(i for i, n in enumerate(step_names) if "Build Debug APK" in n)
        idx_verify = next(i for i, n in enumerate(step_names) if "Verify APK" in n)
        idx_upload = next(i for i, n in enumerate(step_names) if "Upload Debug APK" in n)

        # Ordering assertions
        assert idx_checkout < idx_node < idx_java < idx_sdk < idx_install
        assert idx_install < idx_sync_assets, "npm install must precede asset sync"
        assert idx_sync_assets < idx_cap_sync, "Web assets must be synced to www/ before 'cap sync android'"
        assert idx_cap_sync < idx_chmod < idx_build, "Cap sync & chmod must precede Gradle assembleDebug"
        assert idx_build < idx_verify < idx_upload, "Build must precede binary verification and artifact upload"

    def test_path_resolution_and_shell_subshell_exactness(self):
        """
        Adversarial test on working directory changes:
        'cd android && ./gradlew assembleDebug' runs in a single subshell.
        Subsequent steps evaluate paths relative to $GITHUB_WORKSPACE.
        """
        build_step = next(s for s in self.steps if "Build Debug APK" in s.get("name", ""))
        build_run = build_step.get("run", "")
        assert "cd android && ./gradlew assembleDebug" in build_run, \
            "Gradle step must navigate to android/ and invoke ./gradlew assembleDebug"

        # Verify APK output verification step
        verify_step = next(s for s in self.steps if "Verify APK" in s.get("name", ""))
        verify_run = verify_step.get("run", "")
        expected_apk_rel = "android/app/build/outputs/apk/debug/app-debug.apk"
        assert expected_apk_rel in verify_run, \
            f"Verification step must inspect relative path {expected_apk_rel} from repo root"

        # Verify artifact upload step
        upload_step = next(s for s in self.steps if "Upload Debug APK" in s.get("name", ""))
        upload_with = upload_step.get("with", {})
        assert upload_with.get("path") == expected_apk_rel, \
            f"Artifact upload path must exactly match {expected_apk_rel}"
        assert upload_with.get("if-no-files-found") == "error", \
            "Upload artifact must enforce 'if-no-files-found: error' for fail-fast"

    def test_chmod_gradlew_executable_safeguard(self):
        """
        Ensures 'chmod +x android/gradlew' is explicitly executed
        to prevent 'Permission denied' errors on Linux runners.
        """
        chmod_step = next(s for s in self.steps if "chmod +x" in s.get("run", ""))
        assert "android/gradlew" in chmod_step.get("run", ""), \
            "Must chmod +x android/gradlew before assembleDebug"

    def test_package_lock_fallback_and_gradle_opts(self):
        """
        Verifies package-lock fallback script and headless Gradle options.
        """
        install_step = next(s for s in self.steps if "Install Node" in s.get("name", ""))
        run_text = install_step.get("run", "")
        assert "npm ci" in run_text, "Install step must support npm ci"
        assert "npm install" in run_text, "Install step must fallback to npm install if lockfile absent"

        env = self.data.get("env", {})
        gradle_opts = env.get("GRADLE_OPTS", "")
        assert "org.gradle.daemon=false" in gradle_opts, "Gradle daemon should be disabled in CI"
        assert "-Xmx" in gradle_opts, "JVM max heap size must be configured for Gradle"


# ============================================================================
# 2. ADVERSARIAL CHALLENGES FOR SCANNER.HTML WEB-TO-NATIVE BRIDGE
# ============================================================================

class TestAdversarialCapacitorBridgeMocks:
    """
    Injects hostile and corrupted mock window.Capacitor environments:
    - window.Capacitor = {}
    - window.Capacitor.isNativePlatform = "yes" (corrupted string type)
    - window.Capacitor.isNativePlatform = () => { throw new Error(...) }
    - window.Capacitor.Plugins = null
    - window.Capacitor.Plugins.UltraWideCamera = null
    - window.Capacitor.Plugins.UltraWideCamera = {} (missing methods)
    - window.Capacitor with evil throwing property getters.
    Asserts zero unhandled exceptions, safe isNative evaluation, and clean WebRTC fallback.
    """

    def test_hostile_mock_empty_object(self):
        """window.Capacitor = {} must evaluate to non-native and fallback to WebRTC."""
        js_code = """
        const { adapter, checkIsNative } = setupEnv({});
        const isNative = adapter.isNative;
        const initRes = await adapter.initializeCamera(true);
        console.log(JSON.stringify({
            isNative,
            initMode: initRes.mode,
            underlayActive: adapter.underlayActive,
            webrtcActive: adapter.webrtcActive
        }));
        """
        res = run_node_bridge_test(js_code)
        assert res["isNative"] is False, "Empty Capacitor object must not be treated as native"
        assert res["initMode"] == "webrtc_fallback", "Must smoothly fall back to WebRTC"
        assert res["underlayActive"] is False
        assert res["webrtcActive"] is True

    def test_hostile_mock_string_is_native_platform(self):
        """window.Capacitor = { isNativePlatform: 'yes' } must not crash and fallback."""
        js_code = """
        const { adapter } = setupEnv({ isNativePlatform: "yes" });
        const isNative = adapter.isNative;
        const initRes = await adapter.initializeCamera(true);
        console.log(JSON.stringify({
            isNative,
            initMode: initRes.mode,
            underlayActive: adapter.underlayActive,
            webrtcActive: adapter.webrtcActive
        }));
        """
        res = run_node_bridge_test(js_code)
        assert res["isNative"] is False
        assert res["initMode"] == "webrtc_fallback"

    def test_hostile_mock_throwing_is_native_platform_function(self):
        """isNativePlatform throwing an error must be caught in try-catch without crashing."""
        js_code = """
        const { adapter } = setupEnv({
            isNativePlatform: () => { throw new Error("Hardware bridge corrupted!"); }
        });
        const isNative = adapter.isNative;
        const initRes = await adapter.initializeCamera(true);
        console.log(JSON.stringify({
            isNative,
            initMode: initRes.mode,
            underlayActive: adapter.underlayActive,
            webrtcActive: adapter.webrtcActive
        }));
        """
        res = run_node_bridge_test(js_code)
        assert res["isNative"] is False
        assert res["initMode"] == "webrtc_fallback"

    def test_hostile_mock_null_plugins_container(self):
        """isNativePlatform returns true but Plugins is null."""
        js_code = """
        const { adapter } = setupEnv({
            isNativePlatform: () => true,
            Plugins: null
        });
        const isNative = adapter.isNative;
        const initRes = await adapter.initializeCamera(true);
        console.log(JSON.stringify({
            isNative,
            initMode: initRes.mode,
            underlayActive: adapter.underlayActive,
            webrtcActive: adapter.webrtcActive
        }));
        """
        res = run_node_bridge_test(js_code)
        assert res["isNative"] is False
        assert res["initMode"] == "webrtc_fallback"

    def test_hostile_mock_null_ultrawide_camera_plugin(self):
        """isNativePlatform returns true and Plugins exists, but UltraWideCamera is null."""
        js_code = """
        const { adapter } = setupEnv({
            isNativePlatform: () => true,
            Plugins: { UltraWideCamera: null }
        });
        const isNative = adapter.isNative;
        const initRes = await adapter.initializeCamera(true);
        console.log(JSON.stringify({
            isNative,
            initMode: initRes.mode,
            underlayActive: adapter.underlayActive,
            webrtcActive: adapter.webrtcActive
        }));
        """
        res = run_node_bridge_test(js_code)
        assert res["isNative"] is False
        assert res["initMode"] == "webrtc_fallback"

    def test_hostile_mock_evil_getter_throws_type_error(self):
        """window.Capacitor object with throwing getter property."""
        js_code = """
        const evilCapacitor = {};
        Object.defineProperty(evilCapacitor, 'isNativePlatform', {
            get() { throw new TypeError("Adversarial getter trap"); }
        });
        const { adapter } = setupEnv(evilCapacitor);
        const isNative = adapter.isNative;
        const initRes = await adapter.initializeCamera(true);
        console.log(JSON.stringify({
            isNative,
            initMode: initRes.mode,
            underlayActive: adapter.underlayActive,
            webrtcActive: adapter.webrtcActive
        }));
        """
        res = run_node_bridge_test(js_code)
        assert res["isNative"] is False
        assert res["initMode"] == "webrtc_fallback"

    def test_hostile_mock_empty_plugin_object_resilience(self):
        """
        UltraWideCamera is an empty object {} missing startPreview, stopRecording, etc.
        Bridge must not crash and must return fallback default promises.
        """
        js_code = """
        const { adapter } = setupEnv({
            isNativePlatform: () => true,
            Plugins: { UltraWideCamera: {} }
        });
        const isNative = adapter.isNative;
        const initRes = await adapter.initializeCamera(true);
        const toggleRes = await adapter.toggleLens(0.5);
        const startRecRes = await adapter.startRecording();
        const stopRecRes = await adapter.stopRecording();
        const stopPrevRes = await adapter.stopPreview();
        const lockRes = await adapter.lockExposureAndFocus();
        const permRes = await adapter.checkPermissions();

        console.log(JSON.stringify({
            isNative,
            initMode: initRes.mode,
            toggleLens: toggleRes,
            startRecSuccess: startRecRes.success,
            stopRecSuccess: stopRecRes.success,
            stopPrevSuccess: stopPrevRes.success,
            lockSuccess: lockRes.success,
            permCamera: permRes.camera
        }));
        """
        res = run_node_bridge_test(js_code)
        assert res["isNative"] is True
        assert res["initMode"] == "native"
        assert res["toggleLens"] == "0.5x"
        assert res["startRecSuccess"] is True
        assert res["stopRecSuccess"] is True
        assert res["stopPrevSuccess"] is True
        assert res["lockSuccess"] is True
        assert res["permCamera"] == "granted"

    def test_hostile_webrtc_permission_denied_fallback_safety(self):
        """
        When falling back to WebRTC and getUserMedia rejects with NotAllowedError,
        resolveCameraStream catches the error internally, preventing unhandled
        rejections and returning stream: null smoothly.
        """
        js_code = """
        const { adapter } = setupEnv(undefined);
        let errorCaught = false;
        let resObj = null;
        try {
            resObj = await adapter.initializeCamera(true);
        } catch (err) {
            errorCaught = true;
        }
        console.log(JSON.stringify({
            errorCaught,
            isNative: adapter.isNative,
            webrtcActive: adapter.webrtcActive,
            streamIsNull: resObj && resObj.stream === null,
            mode: resObj ? resObj.mode : null
        }));
        """
        res = run_node_bridge_test(js_code, mock_gum_error="NotAllowedError")
        assert res["isNative"] is False
        assert res["errorCaught"] is False, "Bridge must not throw unhandled rejection on WebRTC permission denial"
        assert res["streamIsNull"] is True, "Stream should be safely null on permission denial"
        assert res["mode"] == "webrtc_fallback"


# ============================================================================
# 3. ADVERSARIAL CHALLENGES FOR RACE CONDITIONS & CONCURRENCY
# ============================================================================

class TestAdversarialBridgeRaceConditions:
    """
    Stress-tests race conditions and concurrency:
    1. User clicking [ 0.5x ] before camera initialization.
    2. User pressing stopRecording while preview is stopping.
    3. User rapid-toggling lenses (high frequency 0.5x <-> 1.0x).
    4. Synthetic click event suppression after pointerup touch.
    5. Double-startRecording / double-stopRecording idempotency.
    """

    def test_race_click_05x_before_camera_init_web_mode(self):
        """User clicks lens-05 before startAppBtn in browser fallback mode."""
        js_code = """
        const { adapter, elements, controller } = setupEnv(undefined);
        const btn05 = elements['lens-05'];
        
        // Trigger click before startCamera is called
        btn05.trigger('click');
        
        // Allow microtasks to settle
        await new Promise(r => setTimeout(r, 20));

        console.log(JSON.stringify({
            currentZoom: controller.getCurrentZoom(),
            webrtcActive: adapter.webrtcActive,
            underlayActive: adapter.underlayActive
        }));
        """
        res = run_node_bridge_test(js_code)
        assert res["underlayActive"] is False

    def test_race_click_05x_before_camera_init_native_mode(self):
        """User clicks lens-05 before startAppBtn in native Capacitor mode."""
        js_code = """
        let previewCalledWith = null;
        const mockPlugin = {
            startPreview: async (opts) => { previewCalledWith = opts; return { success: true }; },
            stopPreview: async () => ({ success: true }),
            toggleLens: async () => ({ success: true })
        };
        const { adapter, elements, controller } = setupEnv({
            isNativePlatform: () => true,
            Plugins: { UltraWideCamera: mockPlugin }
        });
        const btn05 = elements['lens-05'];
        
        // Click lens-05 before camera init
        btn05.trigger('click');
        await new Promise(r => setTimeout(r, 20));

        console.log(JSON.stringify({
            currentZoom: controller.getCurrentZoom(),
            underlayActive: adapter.underlayActive,
            previewZoom: previewCalledWith ? previewCalledWith.zoomRatio : null
        }));
        """
        res = run_node_bridge_test(js_code)
        assert res["currentZoom"] == 0.5
        assert res["previewZoom"] == 0.5

    def test_race_concurrent_stop_recording_and_stop_preview(self):
        """
        Simultaneous invocation of stopRecording() and stopPreview()
        must settle cleanly without deadlocks or unhandled rejections.
        """
        js_code = """
        let previewStopped = false;
        let recordingStopped = false;

        const mockPlugin = {
            startPreview: async () => ({ success: true }),
            stopPreview: async () => {
                await new Promise(r => setTimeout(r, 30));
                previewStopped = true;
                return { success: true };
            },
            startRecording: async () => ({ success: true }),
            stopRecording: async () => {
                await new Promise(r => setTimeout(r, 30));
                recordingStopped = true;
                return { success: true, sampleCount: 200, videoPath: '/sdcard/test.mp4' };
            },
            lockExposureAndFocus: async () => ({ success: true })
        };

        const { adapter, controller } = setupEnv({
            isNativePlatform: () => true,
            Plugins: { UltraWideCamera: mockPlugin }
        });

        // Initialize and start recording
        await adapter.initializeCamera(true);
        await adapter.startRecording();
        
        // Fire concurrent stop operations
        const [prevRes, recRes] = await Promise.all([
            adapter.stopPreview(),
            adapter.stopRecording()
        ]);

        console.log(JSON.stringify({
            previewStopped,
            recordingStopped,
            underlayActive: adapter.underlayActive,
            sampleCount: recRes.sampleCount,
            videoPath: recRes.videoPath,
            lastResultVideoPath: adapter.lastRecordingResult ? adapter.lastRecordingResult.videoPath : null
        }));
        """
        res = run_node_bridge_test(js_code)
        assert res["previewStopped"] is True
        assert res["recordingStopped"] is True
        assert res["underlayActive"] is False
        assert res["sampleCount"] == 200
        assert res["videoPath"] == "/sdcard/test.mp4"
        assert res["lastResultVideoPath"] == "/sdcard/test.mp4"

    def test_race_rapid_lens_toggle_stress(self):
        """Stress-tests rapid alternating lens switches (0.5x <-> 1.0x)."""
        js_code = """
        let switchCount = 0;
        const mockPlugin = {
            startPreview: async () => { switchCount++; return { success: true }; },
            stopPreview: async () => ({ success: true })
        };

        const { adapter, controller } = setupEnv({
            isNativePlatform: () => true,
            Plugins: { UltraWideCamera: mockPlugin }
        });

        await adapter.initializeCamera(true);
        
        // Rapid alternating switches
        const toggles = [0.5, 1.0, 0.5, 1.0, 0.5, 1.0, 0.5];
        for (const target of toggles) {
            await adapter.toggleLens(target);
        }

        console.log(JSON.stringify({
            switchCount,
            finalZoom: controller.getCurrentZoom(),
            finalLens: adapter.activeLens
        }));
        """
        res = run_node_bridge_test(js_code)
        assert res["switchCount"] >= 7
        assert res["finalZoom"] == 0.5
        assert res["finalLens"] == "0.5x"

    def test_race_synthetic_click_debounce_safeguard(self):
        """
        Ensures that when a touch device emits pointerup followed immediately
        by a synthetic 'click' (< 400ms), doToggleRecord is NOT fired twice.
        """
        js_code = """
        let recordToggles = 0;
        const mockPlugin = {
            startRecording: async () => { recordToggles++; return { success: true }; },
            stopRecording: async () => { recordToggles++; return { success: true }; },
            lockExposureAndFocus: async () => ({ success: true })
        };

        const { adapter, elements } = setupEnv({
            isNativePlatform: () => true,
            Plugins: { UltraWideCamera: mockPlugin }
        });

        const toggleBtn = elements['toggle-record-btn'];

        // Step 1: Touch pointerup (starts recording)
        toggleBtn.trigger('pointerup', { pointerType: 'touch', cancelable: true, preventDefault: () => {} });
        await new Promise(r => setTimeout(r, 10));

        // Step 2: Immediate synthetic click (< 400ms)
        toggleBtn.trigger('click');
        await new Promise(r => setTimeout(r, 10));

        console.log(JSON.stringify({
            recordToggles
        }));
        """
        res = run_node_bridge_test(js_code)
        # Should only toggle ONCE from the pointerup event; synthetic click ignored
        assert res["recordToggles"] == 1, \
            f"Expected exactly 1 recording toggle, got {res['recordToggles']} (synthetic click wasn't debounced!)"

    def test_race_double_stop_recording_idempotency(self):
        """
        Calling stopRecording() consecutively when already stopped
        should not throw uncaught exceptions.
        """
        js_code = """
        let stopCount = 0;
        const mockPlugin = {
            startPreview: async () => ({ success: true }),
            startRecording: async () => ({ success: true }),
            stopRecording: async () => {
                stopCount++;
                return { success: true, sampleCount: 50 };
            },
            lockExposureAndFocus: async () => ({ success: true })
        };
        const { adapter } = setupEnv({
            isNativePlatform: () => true,
            Plugins: { UltraWideCamera: mockPlugin }
        });
        await adapter.initializeCamera(true);
        await adapter.startRecording();
        const res1 = await adapter.stopRecording();
        const res2 = await adapter.stopRecording();
        console.log(JSON.stringify({
            stopCount,
            res1Success: res1.success,
            res2Success: res2.success
        }));
        """
        res = run_node_bridge_test(js_code)
        assert res["res1Success"] is True
        assert res["res2Success"] is True


# ============================================================================
# 4. ADVERSARIAL ASSET SYNCHRONIZATION & SCAFFOLDING VERIFICATION
# ============================================================================

class TestAdversarialBuildAndAssetSync:
    """
    Verifies that scripts/sync_web_assets.js accurately mirrors scanner.html
    to www/index.html and www/scanner.html, preventing stale builds.
    """

    def test_sync_web_assets_execution_and_content_matching(self):
        """Runs sync_web_assets.js and confirms byte-for-byte fidelity."""
        assert SYNC_SCRIPT.is_file(), f"Missing {SYNC_SCRIPT}"
        
        # Execute sync script
        res = subprocess.run(
            ["node", str(SYNC_SCRIPT)],
            capture_output=True,
            text=True,
            cwd=PROJECT_ROOT
        )
        assert res.returncode == 0, f"sync_web_assets.js failed: {res.stderr}"

        www_index = PROJECT_ROOT / "www" / "index.html"
        www_scanner = PROJECT_ROOT / "www" / "scanner.html"
        assert www_index.is_file(), "www/index.html must exist after sync"
        assert www_scanner.is_file(), "www/scanner.html must exist after sync"

        with open(SCANNER_HTML, "rb") as f:
            src_bytes = f.read()
        with open(www_index, "rb") as f:
            idx_bytes = f.read()
        with open(www_scanner, "rb") as f:
            scn_bytes = f.read()

        assert src_bytes == idx_bytes, "www/index.html must be identical to root scanner.html"
        assert src_bytes == scn_bytes, "www/scanner.html must be identical to root scanner.html"

    def test_capacitor_config_web_dir_matches_www(self):
        """Verifies capacitor.config.json references 'www'."""
        assert CAP_CONFIG.is_file(), "capacitor.config.json missing"
        with open(CAP_CONFIG, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        assert cfg.get("webDir") == "www", "webDir must be set to 'www'"
        assert cfg.get("appId") == "com.woninginrichter.scanner"

    def test_package_json_capacitor_versions_match_v6(self):
        """Verifies package.json dependencies are pinned to Capacitor 6."""
        assert PACKAGE_JSON.is_file(), "package.json missing"
        with open(PACKAGE_JSON, "r", encoding="utf-8") as f:
            pkg = json.load(f)
        deps = pkg.get("dependencies", {})
        assert "@capacitor/android" in deps, "@capacitor/android required"
        assert "@capacitor/core" in deps, "@capacitor/core required"
        assert "@capacitor/cli" in deps, "@capacitor/cli required"
        for dep in ["@capacitor/android", "@capacitor/core", "@capacitor/cli"]:
            version = deps[dep]
            assert "6." in version or "^6." in version, f"{dep} must be Capacitor 6 (found {version})"
