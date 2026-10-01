# Technical Analysis: mDNS Resolution Failure, W3C Secure Contexts & Production Connectivity

## Executive Summary

This document provides an exhaustive technical analysis of network resolution barriers and web platform security constraints encountered when deploying mobile web applications—specifically the Woninginrichter 3D & IMU Scanner WebApp—on Android Chrome and iOS Safari. It covers:
1. The low-level architecture of multicast DNS (`.local` / mDNS) resolution failures on Android.
2. The W3C Secure Contexts specification and its enforcement on hardware camera and IMU sensor APIs.
3. The role of HTTPS reverse tunneling (Cloudflare Tunnel) as an infrastructure solution.
4. Field connectivity guidelines, Windows NT service management, and zero-dependency offline fallback.

---

## 1. Deep Dive: Why `gas.local` Fails on Android Chrome

When attempting to navigate to `http://gas.local:8080` from an Android device connected to the same local Wi-Fi network as the host machine (`gas`), the connection fails with `ERR_NAME_NOT_RESOLVED` or `DNS_PROBE_FINISHED_NXDOMAIN`. This failure occurs due to three fundamental architectural design decisions across the Android operating system and Chromium browser stack.

### 1.1 Android Bionic libc Resolver vs. Multicast DNS (RFC 6762 / RFC 6763)

1. **Absence of Native mDNS in Bionic Libc**:
   Unlike Apple macOS / iOS (which integrates Apple Bonjour / `mDNSResponder` directly into the system socket resolution pipeline) and desktop Linux distributions (which utilize `systemd-resolved` or `nss-mdns` via GNU `libc`), Android's C standard library (`Bionic libc`) has **no built-in Multicast DNS responder or resolver** in its native POSIX resolver implementation (`getaddrinfo` / `gethostbyname`).
2. **Java `NsdManager` Isolation**:
   Android provides Network Service Discovery via `android.net.nsd.NsdManager` (DNS-SD / mDNS), but this is an asynchronous high-level Android SDK API designed for discovery of specific service types (e.g. `_http._tcp.local.`). It is **not hooked into the standard POSIX socket resolution layer** (`libc.so`). Standard Linux/POSIX applications and browser networking layers calling `getaddrinfo("gas.local", ...)` bypass `NsdManager` completely and route standard unicast DNS queries.
3. **Android 12+ mDNS Implementation Scope**:
   While Android 12 introduced a system mDNS daemon (`mdnsd`), it is strictly restricted to platform-internal components, Tethering, and explicit NSD app requests. Standard socket calls for arbitrary `.local` hostnames continue to fail at the libc resolver layer.

### 1.2 Chromium's Asynchronous DNS Resolver & DNS-over-HTTPS (DoH)

Chromium on Android does not simply delegate hostname resolution to the OS; it employs its own asynchronous DNS client (`net::HostResolverManager`). In modern Android Chrome:

1. **DNS-over-HTTPS (DoH) & Private DNS**:
   Android 9+ (Pie) introduced system-wide "Private DNS" (DNS-over-TLS), and Chrome enables DNS-over-HTTPS (DoH) by default. When an address such as `gas.local` is entered:
   - Chrome's network stack routes the DNS lookup directly to the configured upstream secure DNS resolver (e.g., Google `8.8.8.8`, Cloudflare `1.1.1.1`, or ISP DoH).
   - Because RFC 6762 explicitly reserves `.local` as a link-local multicast domain that must not be routed over the public internet, public upstream DNS servers immediately return `NXDOMAIN` (Non-Existent Domain).
2. **Fallback to Local Wi-Fi Router DNS**:
   Even if Private DNS is disabled on the phone:
   - Chrome sends standard unicast DNS queries to the local Wi-Fi gateway/DHCP DNS server (typically `192.168.1.1` or `192.168.86.1`).
   - Consumer Wi-Fi routers (Netgear, TP-Link, AVM Fritz!Box, Google Nest Wi-Fi) do not bridge unicast DNS queries to link-local multicast (`224.0.0.251:5353` for IPv4, `[FF02::FB]:5353` for IPv6).
   - The router DNS forwarder forwards the query to the ISP WAN DNS, which also returns `NXDOMAIN`.

### 1.3 Port Handling and URL Parsing

Standard DNS and Multicast DNS resolve hostnames to IP addresses; they do not encode port numbers. When a custom port like `:8080` is specified:
- If hostname resolution fails, the browser never attempts a TCP SYN packet on port 8080.
- Even if DNS-SD (Service Discovery) publishes an SRV record for `_http._tcp.local` containing port 8080, web browsers do not query SRV records for standard HTTP navigation URLs.

---

## 2. W3C Secure Context Restrictions: Camera & Sensor Gatekeeping

Even if the technician enters the raw local IP address (e.g., `http://192.168.86.32:8080`), another critical barrier immediately halts operation: **W3C Secure Context enforcement**.

### 2.1 The W3C Secure Contexts Specification

The W3C Secure Contexts recommendation dictates that powerful device features—specifically those with privacy or fingerprinting implications—must be gated strictly behind a **Potentially Trustworthy Origin** (`isOriginPotentiallyTrustworthy`).

Under W3C rules:
- **Trustworthy Origins**:
  - `https://*` with valid TLS certificate verification.
  - `wss://*` over TLS.
  - `http://localhost` and `http://127.0.0.1` (loopback interface on the local machine itself).
  - `file://` (implementation-dependent, heavily sandboxed).
- **Insecure Origins**:
  - Any plain HTTP connection over a network interface: `http://192.168.x.x`, `http://10.x.x.x`, `http://[fe80::*]`, `http://gas.local`.

### 2.2 Impact on MediaDevices (`getUserMedia`)

`navigator.mediaDevices.getUserMedia` is the cornerstone of the Woninginrichter Scanner, enabling video capture and ultra-wide (0.5x) lens switching.

In an Insecure Context:
- Modern Android Chrome: `navigator.mediaDevices` is either completely `undefined`, or calling `getUserMedia()` throws a `SecurityError` / `NotAllowedError`.
- iOS Safari: Camera and microphone access is unconditionally blocked over plain HTTP network connections.
- Hardware lens enumeration (`navigator.mediaDevices.enumerateDevices()`) returns sanitized dummy records without device IDs or labels, preventing 0.5x ultra-wide camera detection.

### 2.3 Impact on IMU Motion & Orientation Sensors

Spatial 3D reconstruction relies on high-frequency IMU telemetry:
- `DeviceMotionEvent` (linear acceleration $a_x, a_y, a_z$, gravity vector, and rotation rates $\omega_\alpha, \omega_\beta, \omega_\gamma$).
- `DeviceOrientationEvent` (absolute Euler orientation $\alpha, \beta, \gamma$).

In an Insecure Context:
- Chromium completely silences `devicemotion` and `deviceorientation` events when served over plain HTTP.
- iOS Safari 13+ requires both a Secure Context (HTTPS) and an explicit user gesture granting permission via `DeviceMotionEvent.requestPermission()`. In an insecure context, the permission API rejects immediately.

### 2.4 Unsuitability of Developer Workarounds in Production

Chromium contains a developer flag: `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.
While this flag allows testing over plain HTTP IP addresses:
- It requires manual activation, typing explicit IP addresses into hidden developer menus, and restarting the browser.
- IP addresses change frequently across DHCP leases.
- Field workers and technicians using personal or company mobile devices cannot be expected to reconfigure internal browser security flags.

Therefore, **an authenticated HTTPS endpoint is an absolute, non-negotiable architectural requirement**.

---

## 3. Cloudflare Reverse Tunnel Architecture

To deliver an instant, zero-configuration HTTPS environment, the project incorporates **Cloudflare Tunnel (`cloudflared`)**.

```
[ Mobile Phone (Field) ]
       │
       │ HTTPS (TLS 1.3 / Valid Public Cert)
       ▼
[ Cloudflare Edge Server ]
       │
       │ Multiplexed Secure Tunnel (QUIC / HTTP/2)
       ▼
[ cloudflared.exe (Host PC) ]
       │
       │ Plain HTTP (127.0.0.1:8080)
       ▼
[ Python server.py ]
```

### 3.1 Benefits for Mobile Web Scanning

1. **W3C Secure Context Compliance**:
   The mobile browser connects to `https://*.trycloudflare.com`. This provides a fully trusted public certificate issued by Cloudflare CA, immediately unlocking:
   - Full `navigator.mediaDevices.getUserMedia` camera control and lens switching.
   - Unrestricted `DeviceMotionEvent` and `DeviceOrientationEvent` sampling up to 60–100 Hz.
2. **Zero Router / NAT Configuration**:
   The tunnel initiates outbound HTTPS/QUIC connections to Cloudflare Edge. No incoming port forwarding, static WAN IP, dynamic DNS (DDNS), or firewall changes are required on the host network.
3. **Cross-Network Reachability**:
   Works seamlessly whether the mobile phone is on the same local Wi-Fi network, on a mobile hotspot, or connected over 4G/5G cellular data.

### 3.2 Quick Tunnel vs. Named Tunnel

| Feature | Quick Tunnel (`--url http://127.0.0.1:8080`) | Named Tunnel (`cloudflared tunnel run <name>`) |
| :--- | :--- | :--- |
| **Authentication** | None (ad-hoc, instant start) | Cloudflare account & credentials token |
| **Hostname** | Ephemeral: `https://<random-hash>.trycloudflare.com` | Persistent: `https://scanner.inrichter-pro.com` |
| **Process Crash Recovery** | New random URL generated on restart (breaks existing QR codes) | Same hostname preserved across restarts and reboots |
| **Use Case** | Fast local testing, field prototyping | Production deployment, stable technician bookmarks |

### 3.3 Windows NT Service Installation for Headless Persistence

For production desktop or server deployments on Windows, `cloudflared` can run as a background Windows NT Service:

```powershell
# 1. Authenticate and create named tunnel
.\cloudflared.exe tunnel login
.\cloudflared.exe tunnel create scanner-tunnel

# 2. Configure routing in ~/.cloudflared/config.yml:
#    tunnel: <Tunnel-UUID>
#    credentials-file: C:\Users\<User>\.cloudflared\<Tunnel-UUID>.json
#    ingress:
#      - hostname: scanner.yourdomain.com
#        service: http://127.0.0.1:8080
#      - service: http_status:404

# 3. Install and start as Windows Service
.\cloudflared.exe service install
Start-Service -Name "cloudflared"
```

Running as a Windows Service guarantees:
- Automatic startup on system boot (before user login).
- Automatic process recovery by the Windows Service Control Manager (SCM).
- Continuous background operation without an open terminal window.

---

## 4. Field Connectivity Guidelines & Offline Fallback Strategy

Technicians operating in construction sites, concrete basements, or remote residential areas frequently encounter **connectivity blackouts** where cellular 4G/5G and Wi-Fi internet are entirely absent.

### 4.1 The Three-Tier Connectivity Strategy

```
┌─────────────────────────────────────────────────────────────┐
│ Tier 1: Cloudflare HTTPS Tunnel (Default Production)        │
│ - Full online access, automated server upload               │
│ - W3C Secure Context guaranteed                             │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Tunnel drop / No WAN)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Tier 2: Local Wi-Fi + Self-Signed / PNA Fallback            │
│ - Direct connection to host PC IP (192.168.x.x)             │
│ - Requires installed local CA or pre-cached PWA context      │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Complete Offline / Field)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Tier 3: Zero-Dependency Client-Side ZIP Emergency Fallback  │
│ - 100% offline, zero network dependencies                    │
│ - Generates standard PKZIP archive directly in browser      │
│ - Stores recording.webm/mp4, sensors, timestamps, metadata  │
│ - Local device download: /Downloads/scan_<id>.zip           │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Why Client-Side PKZIP Fallback is Crucial

1. **Elimination of CDN JSZip Dependency**:
   If an application relies on `<script src="https://cdnjs.cloudflare.com/.../jszip.min.js">`, loading the page in offline conditions causes `window.JSZip` to be `undefined`. Clicking "Download Backup" results in an uncaught `ReferenceError`.
2. **Pure JavaScript PKZIP Implementation**:
   By implementing standard PKZIP file headers (`PK\x03\x04`), 32-bit CRC checksum calculation, central directory records (`PK\x01\x02`), and end-of-central-directory structures (`PK\x05\x06`) natively in JavaScript, the scanner generates valid uncompressed ZIP archives without requiring any external libraries or network access.
3. **Data Preservation Guarantee**:
   When network uploads to `server.py` fail (timeout, 502 Bad Gateway, DNS resolution error), the technician's scan—representing minutes of walking, physical measurement, and sensor telemetry—is never lost. The emergency HUD button `#download-offline-zip-btn` triggers an instantaneous download of `recording.webm` (or `.mp4`), `sensor_data.json`, `frame_timestamps.json`, and `scan_metadata.json` directly into the mobile device storage.

---

## 5. Summary Matrix: Resolution & Context Compatibility

| Access Method | Protocol | Hostname/IP | Android Chrome Resolution | W3C Secure Context | Camera Access (`getUserMedia`) | IMU Access (`DeviceMotion`) | Production Readiness |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **mDNS** | HTTP | `gas.local:8080` | ❌ Fails (Bionic / DoH NXDOMAIN) | ❌ Insecure | ❌ Denied | ❌ Denied | ❌ Completely Unusable |
| **Direct IP** | HTTP | `192.168.x.x:8080` | ✅ Resolves via LAN | ❌ Insecure | ❌ Denied | ❌ Denied | ❌ Blocked by W3C |
| **Direct IP** | HTTPS | `https://192.168.x.x:8443` | ✅ Resolves via LAN | ⚠️ Untrusted Cert warning | ⚠️ Blocked unless cert accepted | ⚠️ Blocked unless cert accepted | ⚠️ High user friction |
| **Cloudflare Quick Tunnel** | HTTPS | `*.trycloudflare.com` | ✅ Global DNS resolution | ✅ Fully Secure | ✅ Full 0.5x / 1.0x Support | ✅ High-Rate (60-100Hz) | ✅ Excellent for Testing |
| **Cloudflare Named Tunnel** | HTTPS | `scanner.domain.com` | ✅ Global DNS resolution | ✅ Fully Secure | ✅ Full 0.5x / 1.0x Support | ✅ High-Rate (60-100Hz) | 🏆 Enterprise Recommended |
| **Offline Client ZIP Fallback** | N/A | Cached / Local Storage | N/A (Local In-Memory) | N/A (Pre-loaded Context) | ✅ Operational | ✅ Operational | 🏆 Mandatory Fail-Safe |

