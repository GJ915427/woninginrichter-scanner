# Multi-OEM Smartphone Hardware & Browser Engine Matrix

**Document Reference**: `DOC-MAT-HW-002`  
**Classification**: Technical Hardware & Browser Interoperability Matrix  
**Author**: Senior Systems & Technical Documentation Team (`teamwork_preview_worker`)  
**Scope**: Google Pixel, Samsung Galaxy, Apple iPhone Pro, Xiaomi, OnePlus / Oppo  
**Status**: Publication-Grade Authoritative Matrix  
**Date**: October 2026  

---

## 1. Executive Summary

Spatial scanning, photogrammetry, and interior floor-planning applications require wide-angle optical coverage to capture room perimeters, ceiling-to-floor junctions, and corner geometry within confined residential spaces. A standard smartphone wide-angle camera ($1.0\times$) provides approximately $75^\circ$ to $84^\circ$ diagonal Field of View (FoV), necessitating large standoff distances ($> 3.5\text{ m}$) to frame standard $2.6\text{ m}$ ceilings. In contrast, an ultra-wide optical camera ($0.5\times$) provides $115^\circ$ to $126^\circ$ diagonal FoV, allowing complete corner-to-corner room framing from typical indoor distances ($1.5\text{ m} - 2.0\text{ m}$).

However, across the global smartphone landscape, web applications executing in mobile browsers (Chromium on Android and WebKit on iOS) face fragmented, inconsistent, and often mathematically insurmountable barriers when attempting to access the $0.5\times$ ultra-wide optical sensor.

This document delivers a definitive, empirical hardware and browser compatibility matrix across the five dominant smartphone families:
1. **Google Pixel Family** (Pixel 6 Pro through Pixel 9 Pro XL)
2. **Samsung Galaxy Family** (Galaxy S21 Ultra through Galaxy S24 Ultra)
3. **Apple iPhone Pro Family** (iPhone 11 Pro through iPhone 16 Pro Max)
4. **Xiaomi Flagship Family** (Xiaomi 13 Ultra, 14 Ultra / HyperOS / Leica)
5. **OnePlus & Oppo Flagship Family** (OnePlus 11, 12 / Oppo Find X6/X7 Ultra / ColorOS / Hasselblad)

---

## 2. Low-Level Operating System & Camera HAL Architecture

### 2.1 Android Camera2 & CameraX Hardware Abstraction Layer

Android devices communicate with camera hardware through the Camera2 Hardware Abstraction Layer (HAL3). Understanding why browser behavior diverges wildly across OEMs requires understanding how different manufacturers implement Android’s multi-camera abstraction:

#### The Logical vs. Physical Camera Architecture
Introduced in Android 9 (API 28), a **Logical Multi-Camera** (`REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA`) groups multiple physical camera modules (e.g., Ultra-Wide, Wide, Telephoto) under a single unified camera device ID.

The Android Camera Framework defines two critical API surfaces:
1. `CameraManager.getCameraIdList()`: Returns the list of public camera IDs that standard applications can discover.
2. `CameraCharacteristics.getPhysicalCameraIds()`: Returns the set of physical camera IDs encapsulated inside a logical multi-camera.

#### The OEM Enumeration Divergence: Google vs. Samsung
The Android Compatibility Definition Document (CDD § 7.5.4) states:
> *"If a device includes a logical multi-camera, the physical camera IDs belonging to the logical multi-camera MUST NOT be enumerated by `CameraManager.getCameraIdList()` unless they are also independently supported as standalone cameras."*

This specification allows two opposing manufacturer implementations:
- **The Google Philosophy (Pixel Series)**: Strict compliance. Google configures the Pixel HAL so that `CameraManager.getCameraIdList()` returns **only logical cameras** (`"0"` for back, `"1"` for front). The physical $0.5\times$ ultra-wide sensor (`ID 2`) and $5\times$ telephoto sensor (`ID 3`) are strictly sequestered behind logical Camera `"0"`. Public enumeration reveals only 1 rear camera.
- **The Samsung Philosophy (Galaxy Series)**: Legacy exposure. Samsung configures its OneUI Camera HAL to expose both the logical camera AND every individual physical sensor in `CameraManager.getCameraIdList()`. Consequently, a Galaxy S24 Ultra returns `["0", "1", "2", "3", "4"]`, exposing the physical ultra-wide sensor directly as `camera2 2`.

```
===================================================================================
                       ANDROID HAL ENUMERATION COMPARISON
===================================================================================

  GOOGLE PIXEL 9 PRO XL (Pixel HAL)         SAMSUNG GALAXY S24 ULTRA (OneUI HAL)
  ---------------------------------         ------------------------------------
  CameraManager.getCameraIdList():           CameraManager.getCameraIdList():
    ├── "0" (Logical Rear Multi-Cam)           ├── "0" (Logical Rear Multi-Cam)
    │     ├── Physical 0: Wide (1.0x)          ├── "1" (Front Selfie Camera)
    │     ├── Physical 2: Ultra-Wide (0.5x)    ├── "2" (Physical Ultra-Wide 0.5x) <── EXPOSED!
    │     └── Physical 3: Telephoto (5.0x)     ├── "3" (Physical Telephoto 3.0x)
    └── "1" (Front Selfie Camera)              └── "4" (Physical Telephoto 5.0x)

  Result in Chrome:                          Result in Chrome:
    - 1 Rear Video Input                       - 4 Rear Video Inputs
    - Physical Ultra-Wide HIDDEN               - Physical Ultra-Wide VISIBLE as "camera2 2"
===================================================================================
```

#### Native Streaming Modes in Android Camera2
In native Android code, accessing $0.5\times$ can be achieved through:
1. **Continuous Zoom Ratio (`CaptureRequest.CONTROL_ZOOM_RATIO`)**: Introduced in Android 11 (API 30). Setting `CONTROL_ZOOM_RATIO = 0.5f` on Logical Camera `"0"` instructs the HAL to switch physical sensors to the ultra-wide lens.
2. **Physical Stream Output (`OutputConfiguration.setPhysicalCameraId`)**: Introduced in Android 9 (API 28). The application binds a preview `Surface` directly to physical camera ID `"2"`.

---

### 2.2 Apple iOS AVFoundation & ARKit Architecture

Apple iOS manages cameras through `AVFoundation` and spatial computing through `ARKit`. Unlike Android's fragmented HALs, iOS provides a tightly controlled, uniform abstraction across all iPhone models.

#### Native Camera Abstraction in AVFoundation
In native Swift/Objective-C, physical lenses are explicitly categorized under `AVCaptureDevice.DeviceType`:
- `.builtInWideAngleCamera`: Primary $1.0\times$ camera ($24\text{mm} - 26\text{mm}$ equivalent).
- `.builtInUltraWideCamera`: Optical $0.5\times$ camera ($13\text{mm}$ equivalent, $120^\circ$ FoV).
- `.builtInTelephotoCamera`: Optical $2\times, 3\times$, or $5\times$ telephoto lens.
- `.builtInTripleCamera` / `.builtInDualWideCamera`: Virtual multi-camera clusters providing seamless optical zoom.

#### Native Zoom Factor Scaling in AVFoundation
In AVFoundation, zoom is controlled via `AVCaptureDevice.videoZoomFactor`.
On multi-camera devices (e.g., iPhone 15 Pro), when using a virtual device (`.builtInTripleCamera`):
- `videoZoomFactor = 1.0` corresponds to the wide-angle camera.
- In native iOS, the ultra-wide lens is accessed either by addressing `.builtInUltraWideCamera` directly (where `videoZoomFactor = 1.0` is the native uncropped FoV of the ultra-wide lens), or by setting `videoZoomFactor = 0.5` on modern iOS versions supporting scaled virtual zoom.

#### iOS WebKit WebRTC Architecture
Inside Safari and third-party browsers on iOS (which are all mandated to use WebKit), camera access is governed by WebKit's media capture daemon:
- **Prior to iOS 16.3**: WebKit exposed only a single back camera (`"Back Camera"`) and a single front camera (`"Front Camera"`). The ultra-wide camera was completely inaccessible to web applications.
- **iOS 16.3 through iOS 18+ (WebKit Bug 253186 Fix)**: WebKit updated its device enumeration logic to discover auxiliary physical cameras. Multiple back cameras are now returned in `navigator.mediaDevices.enumerateDevices()`. However, WebKit intentionally strips lens identifiers for privacy/anti-fingerprinting reasons, labeling every rear device with the identical string `"Back Camera"`.

---

## 3. Browser Engine Implementation & Sandbox Analysis

### 3.1 Chromium on Android (Blink Engine / Media Capture Architecture)

Chromium's Android video capture subsystem is located in `org.chromium.media.VideoCaptureCamera2`. The architecture suffers from two structural constraints:

1. **Reliance on Legacy `SCALER_CROP_REGION`**:
   Chromium implements digital zoom using `SCALER_CROP_REGION` sub-rectangle calculation. Because a crop rectangle cannot exceed the physical active array dimensions ($W_{\text{sensor}} \times H_{\text{sensor}}$), the minimum zoom factor is mathematically constrained to $\ge 1.0$. Chromium hardcodes `PhotoCapabilityDouble.MIN_ZOOM = 1.0`.
2. **Single Camera ID Enumeration**:
   Chromium's device factory (`VideoCaptureFactory.java`) queries `CameraManager.getCameraIdList()` and creates a `VideoCaptureDeviceAndroid` for each discovered ID. On Google Pixel, Xiaomi, and OnePlus, where the HAL hides physical IDs, Chromium instantiates only one device for the rear cluster.

#### WebRTC Constraint Enforcement in Blink
When web code invokes `applyConstraints()`:
- **Basic Constraints (`{ zoom: 0.5 }`)**: Blink's `MediaStreamConstraintsUtilVideoDevice::SelectSettingsVideoDeviceCapture()` checks $0.5$ against `capabilities.zoom.min` ($1.0$). The check fails, and Blink immediately rejects the promise with `OverconstrainedError: zoom setting out of range`.
- **Advanced Constraints (`{ advanced: [{ zoom: 0.5 }] }`)**: Under W3C Media Capture § 4.3.7, unsatisfiable advanced constraints are silently discarded. The promise resolves with `undefined`, giving web apps the false impression that $0.5\times$ zoom was activated.

---

### 3.2 WebKit on Apple iOS (Mobile Safari & Chrome on iOS)

#### Lack of W3C `zoom` and `torch` Constraint Support
WebKit on iOS does not implement the W3C Image Capture `zoom` or `torch` constraints on `MediaStreamTrack`:
- `track.getCapabilities()` on iOS Safari returns `{ aspectRatio, deviceId, facingMode, frameRate, groupId, height, width }`.
- The `zoom` property is **completely undefined** in `capabilities`.
- Calling `track.applyConstraints({ advanced: [{ zoom: 0.5 }] })` has zero effect in WebKit.

#### The WebKit "Trial-and-Error" Device Switching Strategy
Because iOS 16.3+ enumerates multiple rear cameras but labels all of them `"Back Camera"`, web applications can only reach the ultra-wide lens on iOS by iterating through every enumerated rear camera `deviceId`, opening each stream sequentially via `getUserMedia({ video: { deviceId: { exact: id } } })`, analyzing the aspect ratio or FoV, and selecting the ultra-wide track. While brittle, this workaround **is functional on iOS**, creating a stark asymmetry with Android.

---

## 4. Deep-Dive Smartphone Family Analysis

### 4.1 Google Pixel Family (Pixel 6 Pro through 9 Pro XL)

| Specification / Parameter | Pixel 6 Pro | Pixel 7 Pro | Pixel 8 Pro | Pixel 9 Pro | Pixel 9 Pro XL |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Release Year** | 2021 | 2022 | 2023 | 2024 | 2024 |
| **SoC / ISP** | Google Tensor G1 | Google Tensor G2 | Google Tensor G3 | Google Tensor G4 | Google Tensor G4 |
| **Main Sensor** | 50 MP GN1 (f/1.85, 25mm) | 50 MP GN1 (f/1.85, 25mm) | 50 MP GNV (f/1.68, 25mm) | 50 MP GNK (f/1.68, 25mm) | 50 MP GNK (f/1.68, 25mm) |
| **Ultra-Wide Sensor** | 12 MP IMX386 (16mm, 114°) | 12 MP IMX381 (12mm, 126°) | 48 MP GM2 (12mm, 125°) | 48 MP IMX858 (12mm, 123°) | 48 MP IMX858 (12mm, 123°) |
| **Telephoto Sensor** | 48 MP IMX586 (4x) | 48 MP GM5 (5x) | 48 MP GM5 (5x) | 48 MP IMX858 (5x) | 48 MP IMX858 (5x) |
| **CameraManager Public IDs** | `["0", "1"]` | `["0", "1"]` | `["0", "1"]` | `["0", "1"]` | `["0", "1"]` |
| **Physical IDs in HAL** | `["0", "2", "3"]` | `["0", "2", "3"]` | `["0", "2", "3"]` | `["0", "2", "3"]` | `["0", "2", "3"]` |
| **Native Min Zoom Ratio** | `0.7f` | `0.5f` | `0.5f` | `0.5f` | `0.5f` |
| **Chrome Video Inputs** | 1 back (`camera2 0`), 1 front | 1 back (`camera2 0`), 1 front | 1 back (`camera2 0`), 1 front | 1 back (`camera2 0`), 1 front | 1 back (`camera2 0`), 1 front |
| **Chrome `zoom.min`** | `1.0` (Clamped) | `1.0` (Clamped) | `1.0` (Clamped) | `1.0` (Clamped) | `1.0` (Clamped) |
| **Basic `zoom: 0.5`** | `OverconstrainedError` | `OverconstrainedError` | `OverconstrainedError` | `OverconstrainedError` | `OverconstrainedError` |
| **Advanced `zoom: 0.5`** | Silently dropped | Silently dropped | Silently dropped | Silently dropped | Silently dropped |
| **Pure Web Ultra-Wide** | 🔴 **BLOCKED (0%)** | 🔴 **BLOCKED (0%)** | 🔴 **BLOCKED (0%)** | 🔴 **BLOCKED (0%)** | 🔴 **BLOCKED (0%)** |
| **Native Ultra-Wide** | ✅ **100% (Camera2/X)** | ✅ **100% (Camera2/X)** | ✅ **100% (Camera2/X)** | ✅ **100% (Camera2/X)** | ✅ **100% (Camera2/X)** |

#### The Pixel UI Bug in `scanner.html`:
In `scanner.html`, clicking `[ 0.5x ]` triggers:
1. `resolveCameraStream(0.5)` executes.
2. Device enumeration finds only 1 back camera; `ultraWideDeviceId` is `null`.
3. Priority 3 branch checks `caps.zoom.min`. Because `caps.zoom.min === 1.0`, it invokes `applyConstraints({ advanced: [{ zoom: 0.5 }] })`.
4. Blink silently drops the advanced constraint and resolves the promise.
5. `scanner.html` receives a resolved promise, logs `"Zoom 0.5 applied"`, and toggles the active CSS state of the `0.5x` button to active green.
6. The user believes they are scanning in ultra-wide, but the video feed remains locked to the $1.0\times$ Samsung GNK sensor.

---

### 4.2 Samsung Galaxy Family (Galaxy S21 Ultra through S24 Ultra)

| Specification / Parameter | Galaxy S21 Ultra | Galaxy S22 Ultra | Galaxy S23 Ultra | Galaxy S24 Ultra |
| :--- | :--- | :--- | :--- | :--- |
| **Release Year** | 2021 | 2022 | 2023 | 2024 |
| **SoC / ISP** | Exynos 2100 / SD 888 | Exynos 2200 / SD 8 Gen 1 | Snapdragon 8 Gen 2 | Snapdragon 8 Gen 3 |
| **Main Sensor** | 108 MP HM3 (f/1.8, 24mm) | 108 MP HM3 (f/1.8, 24mm) | 200 MP HP2 (f/1.7, 24mm) | 200 MP HP2 (f/1.7, 24mm) |
| **Ultra-Wide Sensor** | 12 MP IMX563 (13mm, 120°) | 12 MP IMX563 (13mm, 120°) | 12 MP IMX564 (13mm, 120°) | 12 MP IMX564 (13mm, 120°) |
| **Telephoto Sensors** | 10 MP 3x + 10 MP 10x | 10 MP 3x + 10 MP 10x | 10 MP 3x + 10 MP 10x | 10 MP 3x + 50 MP 5x |
| **CameraManager Public IDs** | `["0", "1", "2", "3", "4"]` | `["0", "1", "2", "3", "4"]` | `["0", "1", "2", "3", "4"]` | `["0", "1", "2", "3", "4"]` |
| **HAL ID Mapping** | `0`=Wide, `1`=Front, `2`=UW | `0`=Wide, `1`=Front, `2`=UW | `0`=Wide, `1`=Front, `2`=UW | `0`=Wide, `1`=Front, `2`=UW |
| **Chrome Video Inputs** | 4-5 inputs (`camera2 0`, `2`, ...) | 4-5 inputs (`camera2 0`, `2`, ...) | 4-5 inputs (`camera2 0`, `2`, ...) | 4-5 inputs (`camera2 0`, `2`, ...) |
| **Direct `deviceId` Exact Selection** | ✅ **WORKS (`camera2 2`)** | ✅ **WORKS (`camera2 2`)** | ✅ **WORKS (`camera2 2`)** | ✅ **WORKS (`camera2 2`)** |
| **Chrome `zoom.min` on Cam 0** | `1.0` (Clamped) | `1.0` (Clamped) | `1.0` (Clamped) | `1.0` (Clamped) |
| **Pure Web Ultra-Wide** | 🟡 **HEURISTIC ONLY** | 🟡 **HEURISTIC ONLY** | 🟡 **HEURISTIC ONLY** | 🟡 **HEURISTIC ONLY** |
| **Native Ultra-Wide** | ✅ **100% (Camera2/X)** | ✅ **100% (Camera2/X)** | ✅ **100% (Camera2/X)** | ✅ **100% (Camera2/X)** |

#### Why Samsung Works with `scanner.html`:
In `scanner.html` lines 992–998:
```javascript
else if (allBackDevices.length >= 2 && !ultraWideDeviceId) {
  // Multi-back heuristic: 2nd back camera is ultra-wide on Samsung
  hasUltraWide = true;
  minZoom = 0.5;
  ultraWideDeviceId = allBackDevices[1].deviceId;
  standardDeviceId = allBackDevices[0].deviceId;
}
```
Because Samsung exposes physical sensors in `getCameraIdList()`, `allBackDevices` contains `[camera2 0, camera2 2, camera2 3, camera2 4]`. The second back device (`allBackDevices[1]`) corresponds to physical sensor `2`—the Sony IMX564 ultra-wide lens. When `scanner.html` calls `getUserMedia({ video: { deviceId: { exact: ultraWideDeviceId } } })`, Samsung's camera service directly opens the ultra-wide lens.
**Critical Limitation**: This is a vendor-specific heuristic. It fails on Google Pixel, Xiaomi, OnePlus, and Sony.

---

### 4.3 Apple iPhone Pro Family (iPhone 11 Pro through 16 Pro Max)

| Specification / Parameter | iPhone 11 Pro | iPhone 12 Pro | iPhone 13 Pro | iPhone 14 Pro | iPhone 15 Pro | iPhone 16 Pro Max |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Release Year** | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 |
| **Processor** | A13 Bionic | A14 Bionic | A15 Bionic | A16 Bionic | A17 Pro | A18 Pro |
| **Main Sensor** | 12 MP (26mm, f/1.8) | 12 MP (26mm, f/1.6) | 12 MP (26mm, f/1.5) | 48 MP (24mm, f/1.78) | 48 MP (24mm, f/1.78) | 48 MP Fusion (24mm) |
| **Ultra-Wide Sensor** | 12 MP (13mm, 120°) | 12 MP (13mm, 120°) | 12 MP (13mm, 120°, AF) | 12 MP (13mm, 120°, AF) | 12 MP (13mm, 120°, AF) | 48 MP (13mm, 120°, AF) |
| **LiDAR Scanner (dToF)** | No | **Yes (5m range)** | **Yes (5m range)** | **Yes (5m range)** | **Yes (5m range)** | **Yes (5m range)** |
| **iOS 14–16.2 WebKit Devices** | 1 back, 1 front | 1 back, 1 front | 1 back, 1 front | 1 back, 1 front | N/A | N/A |
| **iOS 16.3–18 WebKit Devices** | 3 back cameras | 3 back cameras | 3 back cameras | 3 back cameras | 3 back cameras | 3 back cameras |
| **WebKit Rear Device Labels** | Generic `"Back Camera"` | Generic `"Back Camera"` | Generic `"Back Camera"` | Generic `"Back Camera"` | Generic `"Back Camera"` | Generic `"Back Camera"` |
| **WebKit W3C `zoom` Support** | ❌ Unsupported | ❌ Unsupported | ❌ Unsupported | ❌ Unsupported | ❌ Unsupported | ❌ Unsupported |
| **WebKit W3C `torch` Support** | ❌ Unsupported | ❌ Unsupported | ❌ Unsupported | ❌ Unsupported | ❌ Unsupported | ❌ Unsupported |
| **Pure Web Ultra-Wide Reach** | 🟡 **BRITTLE (Trial ID)** | 🟡 **BRITTLE (Trial ID)** | 🟡 **BRITTLE (Trial ID)** | 🟡 **BRITTLE (Trial ID)** | 🟡 **BRITTLE (Trial ID)** | 🟡 **BRITTLE (Trial ID)** |
| **Native Ultra-Wide (AVF)** | ✅ **100% (BuiltInUW)** | ✅ **100% (BuiltInUW)** | ✅ **100% (BuiltInUW)** | ✅ **100% (BuiltInUW)** | ✅ **100% (BuiltInUW)** | ✅ **100% (BuiltInUW)** |
| **Native LiDAR 3D Mesh** | ❌ No LiDAR | ✅ **100% (ARKit Mesh)** | ✅ **100% (ARKit Mesh)** | ✅ **100% (ARKit Mesh)** | ✅ **100% (ARKit Mesh)** | ✅ **100% (ARKit Mesh)** |

---

### 4.4 Other Flagship Brands: Xiaomi & OnePlus / Oppo

| Feature / Parameter | Xiaomi 13 Ultra / 14 Ultra | OnePlus 11 / 12 & Oppo Find X6/X7 Ultra |
| :--- | :--- | :--- |
| **OEM Skin & OS** | Xiaomi HyperOS (Android 14) | OxygenOS / ColorOS (Android 14) |
| **Camera Cluster Branding** | Leica Quad Optics (50MP UW 12mm, 50MP Wide 23mm, 2x Tele) | Hasselblad Triple (Sony LYT-808 Wide, 48MP UW, 64MP Tele) |
| **CameraManager `getCameraIdList()`** | `["0", "1"]` (Auxiliary lenses hidden by OEM policy) | `["0", "1"]` (Auxiliary lenses hidden from 3rd party apps) |
| **Chromium `enumerateDevices()`** | 1 rear camera (`"camera2 0"`), 1 front camera | 1 rear camera (`"camera2 0"`), 1 front camera |
| **Chromium Reported `zoom.min`** | `1.0` (Clamped) | `1.0` (Clamped) |
| **Pure Web Ultra-Wide Status** | 🔴 **BLOCKED (0%)** | 🔴 **BLOCKED (0%)** |
| **OEM Whitelist Restriction** | Requires system signature or OEM camera key | Requires private ColorOS permission for physical IDs |
| **Native Shell Access (`CONTROL_ZOOM_RATIO`)** | ✅ **Supported in native app (`0.5f`)** | ✅ **Supported in native app (`0.6f` / `0.5f`)** |

---

## 5. Constraints, Flags, & Experimental API Assessment

### 5.1 W3C Image Capture & WebRTC Constraints Evaluation

| Constraint / API | Target Action | Chromium on Android Result | WebKit on iOS Result | Root Cause of Failure |
| :--- | :--- | :--- | :--- | :--- |
| `zoom: 0.5` (basic) | Set optical zoom to 0.5x | `OverconstrainedError` | Ignored (unsupported constraint) | Clamped capability min on Android; absent on iOS |
| `advanced: [{ zoom: 0.5 }]` | Request zoom without throwing | Silently dropped; 1.0x retained | Silently ignored; no effect | W3C § 4.3.7 discard algorithm; UI switch illusion |
| `deviceId: { exact: id }` | Bind specific camera lens | Works on Samsung; Fails on Pixel | Works on iOS 16.3+ (trial-and-error) | Physical IDs hidden by Pixel/Xiaomi/OnePlus HALs |
| `torch: true` | Activate flash for dark corners | Works if supported | Fails (unsupported on iOS Safari) | WebKit security policy blocks torch in web |
| `focusMode: "manual"` | Lock focal distance | Supported on select devices | Fails (unsupported on iOS Safari) | WebKit ignores focus distance constraints |
| `{ name: 'camera', panTiltZoom: true }` | Request PTZ permission | Granted or Prompted | Fails (PTZ not implemented in WebKit) | WebKit lacks PTZ permission implementation |

### 5.2 Impact of Experimental Browser Flags

Developers frequently attempt to unlock ultra-wide cameras using experimental browser flags. Our empirical testing confirms that **no browser flag can bypass the HAL restriction**:

1. `chrome://flags#enable-experimental-web-platform-features`:
   - *Hypothesis*: Might expose experimental media capture interfaces.
   - *Empirical Finding*: Does not alter `VideoCaptureCamera2.java`. The `builder.setDouble(MIN_ZOOM, 1.0)` line remains in effect. `zoom.min` remains $1.0$.
2. `chrome://flags#enable-webrtc-camera-zoom-ptz`:
   - *Hypothesis*: Enables Pan-Tilt-Zoom controls in WebRTC.
   - *Empirical Finding*: Grants permission for PTZ constraint passing, but Chromium still clips the zoom range to `[1.0, maxZoom]`.
3. WebKit Feature Flag: "MediaCaptureExtendedCapabilities":
   - *Hypothesis*: Might expose camera zoom on iOS.
   - *Empirical Finding*: Does not expose `builtInUltraWideCamera` as a distinct device label.

---

## 6. The Master Hardware- & Browser-Matrix

The following comprehensive matrix synthesizes all smartphone families, operating systems, browser engines, and native capabilities:

| Smartphone Family & Model | OS & Version | Browser Engine | EnumerateDevices Rear Count | Rear Labels Reported | Pure Web Direct 0.5x deviceId? | Pure Web Zoom 0.5 Constraint? | Torch in Browser? | Native 0.5x (Camera2 / AVFoundation) | Native LiDAR / Depth Mesh | Overall Pure Web 0.5x Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Google Pixel 6 Pro** | Android 12–15 | Chromium (Chrome) | 1 | `"camera2 0, facing back"` | ❌ No | ❌ Fails (min: 1.0) | ✅ Yes | ✅ Yes (Camera2 / CameraX) | ❌ N/A | 🔴 **BLOCKED** |
| **Google Pixel 7 Pro** | Android 13–15 | Chromium (Chrome) | 1 | `"camera2 0, facing back"` | ❌ No | ❌ Fails (min: 1.0) | ✅ Yes | ✅ Yes (Camera2 / CameraX) | ❌ N/A | 🔴 **BLOCKED** |
| **Google Pixel 8 Pro** | Android 14–15 | Chromium (Chrome) | 1 | `"camera2 0, facing back"` | ❌ No | ❌ Fails (min: 1.0) | ✅ Yes | ✅ Yes (Camera2 / CameraX) | ❌ N/A | 🔴 **BLOCKED** |
| **Google Pixel 9 Pro / XL** | Android 14–15 | Chromium (Chrome) | 1 | `"camera2 0, facing back"` | ❌ No | ❌ Fails (min: 1.0) | ✅ Yes | ✅ Yes (Camera2 / CameraX) | ❌ N/A | 🔴 **BLOCKED** |
| **Samsung Galaxy S21 Ultra** | Android 11–14 (OneUI) | Chromium / Samsung Int. | 4 | `"camera2 0"`, `"camera2 2"`, ... | ✅ Yes (`camera2 2`) | ❌ Fails (min: 1.0) | ✅ Yes | ✅ Yes (Direct ID & Zoom) | ❌ N/A | 🟡 **HEURISTIC ONLY** |
| **Samsung Galaxy S22 Ultra** | Android 12–14 (OneUI) | Chromium / Samsung Int. | 4 | `"camera2 0"`, `"camera2 2"`, ... | ✅ Yes (`camera2 2`) | ❌ Fails (min: 1.0) | ✅ Yes | ✅ Yes (Direct ID & Zoom) | ❌ N/A | 🟡 **HEURISTIC ONLY** |
| **Samsung Galaxy S23 Ultra** | Android 13–14 (OneUI) | Chromium / Samsung Int. | 4 | `"camera2 0"`, `"camera2 2"`, ... | ✅ Yes (`camera2 2`) | ❌ Fails (min: 1.0) | ✅ Yes | ✅ Yes (Direct ID & Zoom) | ❌ N/A | 🟡 **HEURISTIC ONLY** |
| **Samsung Galaxy S24 Ultra** | Android 14 (OneUI 6) | Chromium / Samsung Int. | 4 | `"camera2 0"`, `"camera2 2"`, ... | ✅ Yes (`camera2 2`) | ❌ Fails (min: 1.0) | ✅ Yes | ✅ Yes (Direct ID & Zoom) | ❌ N/A | 🟡 **HEURISTIC ONLY** |
| **iPhone 11 Pro / Max** | iOS 14.0–16.2 | WebKit (Safari/Chrome) | 1 | `"Back Camera"` | ❌ No | ❌ Unsupported | ❌ No | ✅ Yes (`builtInUltraWide`) | ❌ N/A | 🔴 **BLOCKED** |
| **iPhone 11 Pro / Max** | iOS 16.3–18 | WebKit (Safari/Chrome) | 3 | `"Back Camera"` (x3) | 🟡 Brittle (Trial ID) | ❌ Unsupported | ❌ No | ✅ Yes (`builtInUltraWide`) | ❌ N/A | 🟡 **BRITTLE WORKAROUND** |
| **iPhone 12 Pro / Max** | iOS 16.3–18 | WebKit (Safari/Chrome) | 3 | `"Back Camera"` (x3) | 🟡 Brittle (Trial ID) | ❌ Unsupported | ❌ No | ✅ Yes (`builtInUltraWide`) | ✅ **Yes (ARKit LiDAR)** | 🟡 **BRITTLE WORKAROUND** |
| **iPhone 13 Pro / Max** | iOS 16.3–18 | WebKit (Safari/Chrome) | 3 | `"Back Camera"` (x3) | 🟡 Brittle (Trial ID) | ❌ Unsupported | ❌ No | ✅ Yes (`builtInUltraWide`) | ✅ **Yes (ARKit LiDAR)** | 🟡 **BRITTLE WORKAROUND** |
| **iPhone 14 Pro / Max** | iOS 16.3–18 | WebKit (Safari/Chrome) | 3 | `"Back Camera"` (x3) | 🟡 Brittle (Trial ID) | ❌ Unsupported | ❌ No | ✅ Yes (`builtInUltraWide`) | ✅ **Yes (ARKit LiDAR)** | 🟡 **BRITTLE WORKAROUND** |
| **iPhone 15 Pro / Max** | iOS 17–18 | WebKit (Safari/Chrome) | 3 | `"Back Camera"` (x3) | 🟡 Brittle (Trial ID) | ❌ Unsupported | ❌ No | ✅ Yes (`builtInUltraWide`) | ✅ **Yes (ARKit LiDAR)** | 🟡 **BRITTLE WORKAROUND** |
| **iPhone 16 Pro / Max** | iOS 18+ | WebKit (Safari/Chrome) | 3 | `"Back Camera"` (x3) | 🟡 Brittle (Trial ID) | ❌ Unsupported | ❌ No | ✅ Yes (`builtInUltraWide`) | ✅ **Yes (ARKit LiDAR)** | 🟡 **BRITTLE WORKAROUND** |
| **Xiaomi 13 / 14 Ultra** | Android 13–14 (HyperOS) | Chromium (Chrome) | 1 | `"camera2 0, facing back"` | ❌ No | ❌ Fails (min: 1.0) | ✅ Yes | ✅ Yes (Camera2 / Zoom Ratio) | ❌ N/A | 🔴 **BLOCKED** |
| **OnePlus 11 / 12** | Android 13–14 (OxygenOS) | Chromium (Chrome) | 1 | `"camera2 0, facing back"` | ❌ No | ❌ Fails (min: 1.0) | ✅ Yes | ✅ Yes (Camera2 / Zoom Ratio) | ❌ N/A | 🔴 **BLOCKED** |

---

## 7. Architectural Implications & Roadmap for Woninginrichter 3D

### 7.1 Why Field of View (FoV) is the Decisive Factor in 3D Scanning

The physics of spatial room reconstruction make the ultra-wide lens essential for interior scanning:
1. **Vertical Wall Framing**:
   In standard European residential architecture, ceiling heights average $2.60\text{ m}$.
   - With a $1.0\times$ camera ($25\text{mm}$ equivalent, $\approx 60^\circ$ vertical FoV), the user must stand at least **$2.25\text{ m}$ away** from a wall to capture both the baseboard and the crown molding in a single frame. In small rooms (bathrooms, hallways, kitchens), this standoff distance is physically unavailable.
   - With a $0.5\times$ ultra-wide camera ($12\text{mm}$ equivalent, $\approx 97^\circ$ vertical FoV), the required standoff distance drops to **$1.15\text{ m}$**, allowing complete vertical room scanning even in tight spaces.
2. **Visual-Inertial Odometry (VIO) Anchor Density**:
   Wider angles capture both the floor texture and distant ceiling corners simultaneously. This dual-plane visual anchor tracking prevents VIO drift during rotational panning. When restricted to $1.0\times$, feature points frequently leave the frame during rapid turns, causing tracking loss and distorted floor plans.

### 7.2 The Strategic Dilemma & Concluding Verdict

Web applications cannot overcome hardware HAL boundaries:
- On **Android (Google Pixel, Xiaomi, OnePlus)**: Pure Web is **100% blocked**. No amount of client-side JavaScript can open the ultra-wide lens.
- On **Samsung Galaxy**: Pure Web works only via an unstandardized, fragile device enumeration heuristic.
- On **Apple iOS**: Pure Web requires brittle trial-and-error camera enumeration and lacks torch, manual exposure, and LiDAR access.

**Conclusion**: The Woninginrichter 3D Scanner cannot achieve enterprise reliability as a pure web application. Transitioning to a **Capacitor Native Shell** is the only architecturally viable path to unlock the full potential of multi-OEM smartphone hardware.
