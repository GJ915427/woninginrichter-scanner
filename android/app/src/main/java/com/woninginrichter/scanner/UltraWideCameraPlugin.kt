package com.woninginrichter.scanner

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.SurfaceTexture
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.hardware.camera2.*
import android.hardware.camera2.params.OutputConfiguration
import android.hardware.camera2.params.SessionConfiguration
import android.media.MediaRecorder
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.util.Range
import android.util.Size
import android.view.Surface
import android.view.TextureView
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import java.io.BufferedWriter
import java.io.File
import java.io.FileWriter
import java.util.*
import java.util.concurrent.Executors

@CapacitorPlugin(
    name = "UltraWideCamera",
    permissions = [
        Permission(strings = [Manifest.permission.CAMERA], alias = "camera"),
        Permission(strings = [Manifest.permission.RECORD_AUDIO], alias = "audio")
    ]
)
class UltraWideCameraPlugin : Plugin(), SensorEventListener {

    private lateinit var cameraManager: CameraManager
    private lateinit var sensorManager: SensorManager
    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var previewRequestBuilder: CaptureRequest.Builder? = null
    private var previewSurface: Surface? = null
    private var textureView: TextureView? = null

    // Background Threading
    private var backgroundThread: HandlerThread? = null
    private var backgroundHandler: Handler? = null

    // Camera Configuration State
    private var activeCameraId: String = "0"
    private var isUsingZoomRatio: Boolean = false
    private var physicalUltraWideId: String? = null
    private var currentZoomFactor: Float = 1.0f

    // Exposure & Focus Lock State Preservation
    private var isAeLocked: Boolean = false
    private var isAfLocked: Boolean = false

    // IMU Telemetry Streaming Pipeline (100 Hz, zero-heap-bloat buffered CSV stream)
    private var imuBufferedWriter: BufferedWriter? = null
    private var imuFileWriter: FileWriter? = null
    private var imuSampleCount: Int = 0
    private var isRecording: Boolean = false
    private var recordingStartTimeNanos: Long = 0L

    // Reusable structures for zero-allocation 100Hz IMU formatting
    private val imuRowBuilder = java.lang.StringBuilder(128)
    private var lastAccelX: Float = 0f
    private var lastAccelY: Float = 0f
    private var lastAccelZ: Float = 0f
    private var lastGyroX: Float = 0f
    private var lastGyroY: Float = 0f
    private var lastGyroZ: Float = 0f

    // Video Recording Pipeline
    private var mediaRecorder: MediaRecorder? = null
    private var recorderSurface: Surface? = null
    private var videoOutputFile: File? = null
    private var imuOutputFile: File? = null

    override fun load() {
        super.load()
        val ctx = context ?: return
        cameraManager = ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        sensorManager = ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        startBackgroundThread()
    }

    private fun startBackgroundThread() {
        if (backgroundThread == null) {
            backgroundThread = HandlerThread("CameraBackgroundThread").also { it.start() }
            backgroundHandler = Handler(backgroundThread!!.looper)
        }
    }

    private fun stopBackgroundThread() {
        backgroundThread?.quitSafely()
        try {
            backgroundThread?.join()
            backgroundThread = null
            backgroundHandler = null
        } catch (e: InterruptedException) {
            e.printStackTrace()
        }
    }

    @PluginMethod
    override fun checkPermissions(call: PluginCall) {
        val ctx = context
        if (ctx == null) {
            call.reject("Context unavailable")
            return
        }
        val cameraGranted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        val audioGranted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

        val res = JSObject()
        res.put("camera", if (cameraGranted) "granted" else "denied")
        res.put("audio", if (audioGranted) "granted" else "denied")
        call.resolve(res)
    }

    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        super.requestPermissions(call)
    }

    @PluginMethod
    fun getCameraCapabilities(call: PluginCall) {
        getAvailableCameras(call)
    }

    @PluginMethod
    fun getAvailableCameras(call: PluginCall) {
        try {
            val response = JSObject()
            val camerasArray = JSArray()

            for (id in cameraManager.cameraIdList) {
                val chars = cameraManager.getCameraCharacteristics(id)
                val facing = chars.get(CameraCharacteristics.LENS_FACING)
                if (facing != CameraCharacteristics.LENS_FACING_BACK) continue

                val camObj = JSObject()
                camObj.put("id", id)
                camObj.put("lensFacing", if (facing == CameraCharacteristics.LENS_FACING_BACK) "back" else "front")
                camObj.put("facing", facing)

                val focalLengths = chars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)
                val focalArray = JSArray()
                var hasUltraWideFocal = false
                if (focalLengths != null) {
                    for (f in focalLengths) {
                        focalArray.put(f.toDouble())
                        if (f < 2.5f) {
                            hasUltraWideFocal = true
                        }
                    }
                }
                camObj.put("focalLengths", focalArray)

                var supportsRatio = false
                var minZ = 1.0f
                var maxZ = 1.0f
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    val zoomRange: Range<Float>? = chars.get(CameraCharacteristics.CONTROL_ZOOM_RATIO_RANGE)
                    if (zoomRange != null) {
                        minZ = zoomRange.lower
                        maxZ = zoomRange.upper
                        supportsRatio = zoomRange.lower <= 0.6f
                    }
                }
                camObj.put("minZoom", minZ)
                camObj.put("maxZoom", maxZ)
                camObj.put("supportsUltraWideRatio", supportsRatio)
                camObj.put("isUltraWide", supportsRatio || hasUltraWideFocal)

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    val capabilities = chars.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES)
                    val isLogicalMulti = capabilities != null && capabilities.contains(CameraMetadata.REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA)
                    if (isLogicalMulti) {
                        val physicalIds = chars.physicalCameraIds
                        val physArray = JSArray()
                        for (physId in physicalIds) {
                            physArray.put(physId)
                        }
                        camObj.put("physicalCameraIds", physArray)
                    }
                }

                camerasArray.put(camObj)
            }

            response.put("cameras", camerasArray)
            call.resolve(response)
        } catch (e: Exception) {
            call.reject("Failed to query camera capabilities: ${e.message}", e)
        }
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    fun startPreview(call: PluginCall) {
        val targetLens = call.getString("lens", "ultra_wide")
        val targetFps = call.getInt("targetFps", 30) ?: 30
        val explicitCameraId = call.getString("cameraId")
        val explicitZoom = call.getDouble("zoomRatio")

        activity.runOnUiThread {
            try {
                bridge.webView.setBackgroundColor(Color.TRANSPARENT)

                if (textureView == null) {
                    textureView = TextureView(context).apply {
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                        surfaceTextureListener = object : TextureView.SurfaceTextureListener {
                            override fun onSurfaceTextureAvailable(surface: SurfaceTexture, width: Int, height: Int) {
                                previewSurface = Surface(surface)
                                backgroundHandler?.post {
                                    try {
                                        if (explicitCameraId != null) {
                                            activeCameraId = explicitCameraId
                                            currentZoomFactor = explicitZoom?.toFloat() ?: 1.0f
                                        } else {
                                            selectBestCamera(targetLens == "ultra_wide")
                                            if (explicitZoom != null) {
                                                currentZoomFactor = explicitZoom.toFloat()
                                            }
                                        }
                                        openCamera(activeCameraId, call)
                                    } catch (e: Exception) {
                                        call.reject("Error starting camera: ${e.message}", e)
                                    }
                                }
                            }
                            override fun onSurfaceTextureSizeChanged(surface: SurfaceTexture, width: Int, height: Int) {}
                            override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean {
                                previewSurface?.release()
                                previewSurface = null
                                return true
                            }
                            override fun onSurfaceTextureUpdated(surface: SurfaceTexture) {}
                        }
                    }
                    val rootLayout = bridge.webView.parent as? ViewGroup
                    rootLayout?.addView(textureView, 0)
                } else if (textureView!!.isAvailable) {
                    if (previewSurface != null) {
                        previewSurface?.release()
                        previewSurface = null
                    }
                    if (captureSession != null) {
                        captureSession?.close()
                        captureSession = null
                    }
                    if (cameraDevice != null) {
                        cameraDevice?.close()
                        cameraDevice = null
                    }
                    previewSurface = Surface(textureView!!.surfaceTexture)
                    backgroundHandler?.post {
                        try {
                            if (explicitCameraId != null) {
                                activeCameraId = explicitCameraId
                                currentZoomFactor = explicitZoom?.toFloat() ?: 1.0f
                            } else {
                                selectBestCamera(targetLens == "ultra_wide")
                                if (explicitZoom != null) {
                                    currentZoomFactor = explicitZoom.toFloat()
                                }
                            }
                            openCamera(activeCameraId, call)
                        } catch (e: Exception) {
                            call.reject("Error starting camera: ${e.message}", e)
                        }
                    }
                }
            } catch (e: Exception) {
                call.reject("Failed to initialize TextureView underlay: ${e.message}", e)
            }
        }
    }

    @PluginMethod
    fun stopPreview(call: PluginCall) {
        activity.runOnUiThread {
            try {
                closeCamera()
                val root = textureView?.parent as? ViewGroup
                root?.removeView(textureView)
                textureView = null
                previewSurface?.release()
                previewSurface = null
                call.resolve(JSObject().apply {
                    put("success", true)
                    put("status", "PREVIEW_STOPPED")
                })
            } catch (e: Exception) {
                call.reject("Failed to stop preview: ${e.message}", e)
            }
        }
    }

    private fun selectBestCamera(requireUltraWide: Boolean) {
        isUsingZoomRatio = false
        physicalUltraWideId = null

        for (id in cameraManager.cameraIdList) {
            val chars = cameraManager.getCameraCharacteristics(id)
            val facing = chars.get(CameraCharacteristics.LENS_FACING)
            if (facing != CameraCharacteristics.LENS_FACING_BACK) continue

            // Priority 1: Modern Android 11+ CONTROL_ZOOM_RATIO on Logical Multi-Camera (Pixel 9 / S24)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val zoomRange: Range<Float>? = chars.get(CameraCharacteristics.CONTROL_ZOOM_RATIO_RANGE)
                if (zoomRange != null && zoomRange.lower <= 0.6f) {
                    activeCameraId = id
                    isUsingZoomRatio = true
                    currentZoomFactor = if (requireUltraWide) {
                        0.5f.coerceIn(zoomRange.lower, zoomRange.upper)
                    } else {
                        1.0f.coerceIn(zoomRange.lower, zoomRange.upper)
                    }
                    return
                }
            }

            // Priority 2: Direct physical camera ID discovery (Samsung / Multi-lens)
            if (requireUltraWide && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val capabilities = chars.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES)
                val isLogicalMulti = capabilities != null && capabilities.contains(CameraMetadata.REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA)
                if (isLogicalMulti) {
                    val physicalIds = chars.physicalCameraIds
                    for (physId in physicalIds) {
                        val physChars = cameraManager.getCameraCharacteristics(physId)
                        val focalLengths = physChars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)
                        if (focalLengths != null && focalLengths.any { it < 2.5f }) {
                            activeCameraId = id
                            physicalUltraWideId = physId
                            currentZoomFactor = 1.0f
                            return
                        }
                    }
                }
            }
        }

        // Fallback: Primary rear camera (firstOrNull safety for devices without rear camera)
        activeCameraId = cameraManager.cameraIdList.firstOrNull {
            cameraManager.getCameraCharacteristics(it).get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK
        } ?: (cameraManager.cameraIdList.firstOrNull() ?: "0")
        currentZoomFactor = 1.0f
    }

    @SuppressLint("MissingPermission")
    private fun openCamera(cameraId: String, call: PluginCall? = null) {
        cameraManager.openCamera(cameraId, object : CameraDevice.StateCallback() {
            override fun onOpened(camera: CameraDevice) {
                cameraDevice = camera
                startCaptureSession(call)
            }

            override fun onDisconnected(camera: CameraDevice) {
                camera.close()
                cameraDevice = null
            }

            override fun onError(camera: CameraDevice, error: Int) {
                camera.close()
                cameraDevice = null
                call?.reject("CameraDevice error code: $error")
            }
        }, backgroundHandler)
    }

    private fun startCaptureSession(call: PluginCall? = null) {
        val device = cameraDevice ?: run {
            call?.reject("CameraDevice not initialized")
            return
        }
        val surface = previewSurface ?: run {
            call?.reject("Preview surface not ready")
            return
        }
        try {
            previewRequestBuilder = device.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
                addTarget(surface)

                // Apply Zoom Clamping & Android 10 SCALER_CROP_REGION Fallback
                val chars = cameraManager.getCameraCharacteristics(activeCameraId)
                val zoomRange = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    chars.get(CameraCharacteristics.CONTROL_ZOOM_RATIO_RANGE)
                } else null

                if (zoomRange != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    val clampedZoom = currentZoomFactor.coerceIn(zoomRange.lower, zoomRange.upper)
                    set(CaptureRequest.CONTROL_ZOOM_RATIO, clampedZoom)
                    currentZoomFactor = clampedZoom
                } else {
                    val activeArray = chars.get(CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE)
                    val maxDigitalZoom = chars.get(CameraCharacteristics.SCALER_AVAILABLE_MAX_DIGITAL_ZOOM) ?: 1.0f
                    val clampedZoom = currentZoomFactor.coerceIn(1.0f, maxDigitalZoom)
                    if (activeArray != null && clampedZoom > 1.0f) {
                        val cropW = (activeArray.width() / clampedZoom).toInt()
                        val cropH = (activeArray.height() / clampedZoom).toInt()
                        val cropX = (activeArray.width() - cropW) / 2
                        val cropY = (activeArray.height() - cropH) / 2
                        set(CaptureRequest.SCALER_CROP_REGION, Rect(cropX, cropY, cropX + cropW, cropY + cropH))
                    } else if (activeArray != null) {
                        set(CaptureRequest.SCALER_CROP_REGION, activeArray)
                    }
                    currentZoomFactor = clampedZoom
                }

                // Enable autofocus and auto-exposure initially (honoring preserved lock state)
                val afMode = if (isAfLocked) CaptureRequest.CONTROL_AF_MODE_AUTO else CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE
                set(CaptureRequest.CONTROL_AF_MODE, afMode)
                set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON)
                set(CaptureRequest.CONTROL_AE_LOCK, isAeLocked)
                set(CaptureRequest.CONTROL_AWB_LOCK, isAeLocked)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val outputConfig = OutputConfiguration(surface)
                if (physicalUltraWideId != null) {
                    outputConfig.setPhysicalCameraId(physicalUltraWideId!!)
                }

                val sessionConfig = SessionConfiguration(
                    SessionConfiguration.SESSION_REGULAR,
                    Collections.singletonList(outputConfig),
                    Executors.newSingleThreadExecutor(),
                    object : CameraCaptureSession.StateCallback() {
                        override fun onConfigured(session: CameraCaptureSession) {
                            captureSession = session
                            session.setRepeatingRequest(previewRequestBuilder!!.build(), null, backgroundHandler)
                            call?.resolve(JSObject().apply {
                                put("success", true)
                                put("status", "PREVIEW_ACTIVE")
                                put("activeCameraId", activeCameraId)
                                put("zoomFactor", currentZoomFactor.toDouble())
                                put("zoomRatio", currentZoomFactor.toDouble())
                                put("isUltraWide", currentZoomFactor <= 0.6f || physicalUltraWideId != null)
                                put("width", 1920)
                                put("height", 1080)
                            })
                        }

                        override fun onConfigureFailed(session: CameraCaptureSession) {
                            call?.reject("Capture session configuration failed")
                        }
                    }
                )
                device.createCaptureSession(sessionConfig)
            } else {
                @Suppress("DEPRECATION")
                device.createCaptureSession(listOf(surface), object : CameraCaptureSession.StateCallback() {
                    override fun onConfigured(session: CameraCaptureSession) {
                        captureSession = session
                        session.setRepeatingRequest(previewRequestBuilder!!.build(), null, backgroundHandler)
                        call?.resolve(JSObject().apply {
                            put("success", true)
                            put("status", "PREVIEW_ACTIVE")
                            put("activeCameraId", activeCameraId)
                            put("zoomFactor", currentZoomFactor.toDouble())
                            put("zoomRatio", currentZoomFactor.toDouble())
                            put("isUltraWide", currentZoomFactor <= 0.6f || physicalUltraWideId != null)
                            put("width", 1920)
                            put("height", 1080)
                        })
                    }
                    override fun onConfigureFailed(session: CameraCaptureSession) {
                        call?.reject("Legacy capture session failed")
                    }
                }, backgroundHandler)
            }

        } catch (e: Exception) {
            call?.reject("Failed to initialize capture session: ${e.message}", e)
        }
    }

    @PluginMethod
    fun setZoom(call: PluginCall) {
        val rawZoom = call.getDouble("factor", call.getDouble("zoomRatio", 1.0) ?: 1.0)?.toFloat() ?: 1.0f
        val session = captureSession ?: return call.reject("No active capture session")
        val builder = previewRequestBuilder ?: return call.reject("No preview request builder")

        try {
            val chars = cameraManager.getCameraCharacteristics(activeCameraId)
            val zoomRange = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                chars.get(CameraCharacteristics.CONTROL_ZOOM_RATIO_RANGE)
            } else null

            if (zoomRange != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val clampedZoom = rawZoom.coerceIn(zoomRange.lower, zoomRange.upper)
                builder.set(CaptureRequest.CONTROL_ZOOM_RATIO, clampedZoom)
                currentZoomFactor = clampedZoom
                session.setRepeatingRequest(builder.build(), null, backgroundHandler)
                call.resolve(JSObject().apply {
                    put("success", true)
                    put("appliedZoom", clampedZoom.toDouble())
                    put("zoomRatio", clampedZoom.toDouble())
                })
            } else {
                // Fallback for Android 10 or devices lacking CONTROL_ZOOM_RATIO_RANGE
                val activeArray = chars.get(CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE)
                val maxDigitalZoom = chars.get(CameraCharacteristics.SCALER_AVAILABLE_MAX_DIGITAL_ZOOM) ?: 1.0f
                val clampedZoom = rawZoom.coerceIn(1.0f, maxDigitalZoom)
                if (activeArray != null && clampedZoom > 1.0f) {
                    val cropW = (activeArray.width() / clampedZoom).toInt()
                    val cropH = (activeArray.height() / clampedZoom).toInt()
                    val cropX = (activeArray.width() - cropW) / 2
                    val cropY = (activeArray.height() - cropH) / 2
                    builder.set(CaptureRequest.SCALER_CROP_REGION, Rect(cropX, cropY, cropX + cropW, cropY + cropH))
                } else if (activeArray != null) {
                    builder.set(CaptureRequest.SCALER_CROP_REGION, activeArray)
                }
                currentZoomFactor = clampedZoom
                session.setRepeatingRequest(builder.build(), null, backgroundHandler)
                call.resolve(JSObject().apply {
                    put("success", true)
                    put("appliedZoom", clampedZoom.toDouble())
                    put("zoomRatio", clampedZoom.toDouble())
                })
            }
        } catch (e: Exception) {
            call.reject("Failed to set zoom: ${e.message}", e)
        }
    }

    @PluginMethod
    fun lockExposureAndFocus(call: PluginCall) {
        val lock = call.getBoolean("lock", true) ?: true
        val aeLock = call.getBoolean("aeLocked", lock) ?: lock
        val afLock = call.getBoolean("afLocked", lock) ?: lock

        isAeLocked = aeLock
        isAfLocked = afLock

        val session = captureSession
        val builder = previewRequestBuilder

        if (session == null || builder == null) {
            // Persist intent even if session is not yet created
            call.resolve(JSObject().apply {
                put("success", true)
                put("locked", lock)
                put("aeLocked", aeLock)
                put("afLocked", afLock)
                put("pending", true)
            })
            return
        }

        try {
            builder.set(CaptureRequest.CONTROL_AE_LOCK, aeLock)
            builder.set(
                CaptureRequest.CONTROL_AF_MODE,
                if (afLock) CaptureRequest.CONTROL_AF_MODE_AUTO else CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE
            )
            builder.set(CaptureRequest.CONTROL_AWB_LOCK, aeLock)
            session.setRepeatingRequest(builder.build(), null, backgroundHandler)
            call.resolve(JSObject().apply {
                put("success", true)
                put("locked", lock)
                put("aeLocked", aeLock)
                put("afLocked", afLock)
            })
        } catch (e: Exception) {
            call.reject("Failed to lock AE/AF: ${e.message}", e)
        }
    }

    @PluginMethod
    fun startRecording(call: PluginCall) {
        if (isRecording) {
            call.reject("Recording already in progress")
            return
        }

        val ctx = context ?: return call.reject("No context")
        val device = cameraDevice ?: return call.reject("Camera not initialized")
        val surface = previewSurface ?: return call.reject("Preview surface not initialized")

        backgroundHandler?.post {
            try {
                val customFilePath = call.getString("filePath")
                val recordImu = call.getBoolean("recordImu", true) ?: true

                videoOutputFile = if (customFilePath != null) {
                    File(customFilePath)
                } else {
                    File(ctx.cacheDir, "scan_video_${System.currentTimeMillis()}.mp4")
                }
                videoOutputFile?.parentFile?.mkdirs()

                imuOutputFile = File(ctx.cacheDir, "scan_imu_${System.currentTimeMillis()}.csv")

                if (recordImu) {
                    imuSampleCount = 0
                    val rawWriter = FileWriter(imuOutputFile!!, true)
                    imuFileWriter = rawWriter
                    imuBufferedWriter = BufferedWriter(rawWriter, 32768).apply {
                        write("timestamp_ns,accel_x,accel_y,accel_z,gyro_x,gyro_y,gyro_z\n")
                        flush()
                    }
                }

                mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    MediaRecorder(ctx)
                } else {
                    @Suppress("DEPRECATION")
                    MediaRecorder()
                }.apply {
                    setVideoSource(MediaRecorder.VideoSource.SURFACE)
                    setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                    setOutputFile(videoOutputFile!!.absolutePath)
                    setVideoEncodingBitRate(30_000_000) // 30 Mbps
                    setVideoFrameRate(30)
                    setVideoSize(1920, 1080)
                    setVideoEncoder(MediaRecorder.VideoEncoder.H264)
                    prepare()
                }

                recorderSurface = mediaRecorder!!.surface

                val surfaces = listOf(surface, recorderSurface!!)
                val recordBuilder = device.createCaptureRequest(CameraDevice.TEMPLATE_RECORD).apply {
                    addTarget(surface)
                    addTarget(recorderSurface!!)

                    // Apply Zoom with range clamping and SCALER_CROP_REGION fallback
                    val chars = cameraManager.getCameraCharacteristics(activeCameraId)
                    val zoomRange = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        chars.get(CameraCharacteristics.CONTROL_ZOOM_RATIO_RANGE)
                    } else null

                    if (zoomRange != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        val clampedZoom = currentZoomFactor.coerceIn(zoomRange.lower, zoomRange.upper)
                        set(CaptureRequest.CONTROL_ZOOM_RATIO, clampedZoom)
                        currentZoomFactor = clampedZoom
                    } else {
                        val activeArray = chars.get(CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE)
                        val maxDigitalZoom = chars.get(CameraCharacteristics.SCALER_AVAILABLE_MAX_DIGITAL_ZOOM) ?: 1.0f
                        val clampedZoom = currentZoomFactor.coerceIn(1.0f, maxDigitalZoom)
                        if (activeArray != null && clampedZoom > 1.0f) {
                            val cropW = (activeArray.width() / clampedZoom).toInt()
                            val cropH = (activeArray.height() / clampedZoom).toInt()
                            val cropX = (activeArray.width() - cropW) / 2
                            val cropY = (activeArray.height() - cropH) / 2
                            set(CaptureRequest.SCALER_CROP_REGION, Rect(cropX, cropY, cropX + cropW, cropY + cropH))
                        } else if (activeArray != null) {
                            set(CaptureRequest.SCALER_CROP_REGION, activeArray)
                        }
                        currentZoomFactor = clampedZoom
                    }

                    // Preserve locked AE/AF state
                    val afMode = if (isAfLocked) CaptureRequest.CONTROL_AF_MODE_AUTO else CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO
                    set(CaptureRequest.CONTROL_AF_MODE, afMode)
                    set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON)
                    set(CaptureRequest.CONTROL_AE_LOCK, isAeLocked)
                    set(CaptureRequest.CONTROL_AWB_LOCK, isAeLocked)
                }

                // Preserve physical camera ID on OutputConfiguration where available (API 28+)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    val previewConfig = OutputConfiguration(surface).apply {
                        if (physicalUltraWideId != null) {
                            setPhysicalCameraId(physicalUltraWideId!!)
                        }
                    }
                    val recorderConfig = OutputConfiguration(recorderSurface!!).apply {
                        if (physicalUltraWideId != null) {
                            setPhysicalCameraId(physicalUltraWideId!!)
                        }
                    }
                    val sessionConfig = SessionConfiguration(
                        SessionConfiguration.SESSION_REGULAR,
                        listOf(previewConfig, recorderConfig),
                        Executors.newSingleThreadExecutor(),
                        object : CameraCaptureSession.StateCallback() {
                            override fun onConfigured(session: CameraCaptureSession) {
                                captureSession = session
                                previewRequestBuilder = recordBuilder
                                session.setRepeatingRequest(recordBuilder.build(), null, backgroundHandler)
                                mediaRecorder!!.start()
                                isRecording = true
                                recordingStartTimeNanos = SystemClock.elapsedRealtimeNanos()

                                if (recordImu) {
                                    val accel = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
                                    val gyro = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)
                                    sensorManager.registerListener(this@UltraWideCameraPlugin, accel, SensorManager.SENSOR_DELAY_FASTEST, backgroundHandler)
                                    sensorManager.registerListener(this@UltraWideCameraPlugin, gyro, SensorManager.SENSOR_DELAY_FASTEST, backgroundHandler)
                                }

                                call.resolve(JSObject().apply {
                                    put("success", true)
                                    put("status", "RECORDING_STARTED")
                                    put("videoPath", videoOutputFile!!.absolutePath)
                                    put("outputPath", videoOutputFile!!.absolutePath)
                                    put("imuPath", imuOutputFile?.absolutePath ?: "")
                                    put("imuCsvPath", imuOutputFile?.absolutePath ?: "")
                                })
                            }

                            override fun onConfigureFailed(session: CameraCaptureSession) {
                                call.reject("Failed to configure recording capture session")
                            }
                        }
                    )
                    device.createCaptureSession(sessionConfig)
                } else {
                    @Suppress("DEPRECATION")
                    device.createCaptureSession(surfaces, object : CameraCaptureSession.StateCallback() {
                        override fun onConfigured(session: CameraCaptureSession) {
                            captureSession = session
                            previewRequestBuilder = recordBuilder
                            session.setRepeatingRequest(recordBuilder.build(), null, backgroundHandler)
                            mediaRecorder!!.start()
                            isRecording = true
                            recordingStartTimeNanos = SystemClock.elapsedRealtimeNanos()

                            if (recordImu) {
                                val accel = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
                                val gyro = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)
                                sensorManager.registerListener(this@UltraWideCameraPlugin, accel, SensorManager.SENSOR_DELAY_FASTEST, backgroundHandler)
                                sensorManager.registerListener(this@UltraWideCameraPlugin, gyro, SensorManager.SENSOR_DELAY_FASTEST, backgroundHandler)
                            }

                            call.resolve(JSObject().apply {
                                put("success", true)
                                put("status", "RECORDING_STARTED")
                                put("videoPath", videoOutputFile!!.absolutePath)
                                put("outputPath", videoOutputFile!!.absolutePath)
                                put("imuPath", imuOutputFile?.absolutePath ?: "")
                                put("imuCsvPath", imuOutputFile?.absolutePath ?: "")
                            })
                        }

                        override fun onConfigureFailed(session: CameraCaptureSession) {
                            call.reject("Failed to configure recording capture session")
                        }
                    }, backgroundHandler)
                }

            } catch (e: Exception) {
                call.reject("Failed to start recording: ${e.message}", e)
            }
        }
    }

    @PluginMethod
    fun stopRecording(call: PluginCall) {
        if (!isRecording) {
            return call.reject("Cannot stop recording: no active recording session")
        }

        backgroundHandler?.post {
            try {
                val durationMs = if (isRecording && recordingStartTimeNanos > 0L) {
                    (SystemClock.elapsedRealtimeNanos() - recordingStartTimeNanos) / 1_000_000
                } else {
                    0L
                }
                isRecording = false
                recordingStartTimeNanos = 0L
                sensorManager.unregisterListener(this)

                try {
                    mediaRecorder?.stop()
                } catch (e: RuntimeException) {
                    // Ignore runtime exception if stop called too fast
                }
                mediaRecorder?.reset()
                mediaRecorder?.release()
                mediaRecorder = null
                recorderSurface = null

                try {
                    imuBufferedWriter?.flush()
                    imuBufferedWriter?.close()
                } catch (e: Exception) {
                    e.printStackTrace()
                }
                imuBufferedWriter = null
                imuFileWriter = null

                if (cameraDevice != null && previewSurface != null) {
                    startCaptureSession(null)
                }

                call.resolve(JSObject().apply {
                    put("success", true)
                    put("status", "RECORDING_STOPPED")
                    put("videoPath", videoOutputFile?.absolutePath ?: "")
                    put("outputPath", videoOutputFile?.absolutePath ?: "")
                    put("imuPath", imuOutputFile?.absolutePath ?: "")
                    put("imuCsvPath", imuOutputFile?.absolutePath ?: "")
                    put("sampleCount", imuSampleCount)
                    put("durationMs", durationMs)
                })
            } catch (e: Exception) {
                call.reject("Failed to stop recording: ${e.message}", e)
            }
        }
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (!isRecording || event == null) return
        val writer = imuBufferedWriter ?: return

        val sensorType = event.sensor.type
        if (sensorType == Sensor.TYPE_ACCELEROMETER) {
            lastAccelX = event.values[0]
            lastAccelY = event.values[1]
            lastAccelZ = event.values[2]
        } else if (sensorType == Sensor.TYPE_GYROSCOPE) {
            lastGyroX = event.values[0]
            lastGyroY = event.values[1]
            lastGyroZ = event.values[2]
        }

        try {
            synchronized(imuRowBuilder) {
                imuRowBuilder.setLength(0)
                imuRowBuilder.append(event.timestamp)
                imuRowBuilder.append(',')
                imuRowBuilder.append(lastAccelX)
                imuRowBuilder.append(',')
                imuRowBuilder.append(lastAccelY)
                imuRowBuilder.append(',')
                imuRowBuilder.append(lastAccelZ)
                imuRowBuilder.append(',')
                imuRowBuilder.append(lastGyroX)
                imuRowBuilder.append(',')
                imuRowBuilder.append(lastGyroY)
                imuRowBuilder.append(',')
                imuRowBuilder.append(lastGyroZ)
                imuRowBuilder.append('\n')
                writer.write(imuRowBuilder.toString())
            }
            imuSampleCount++
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    // Lifecycle Management & Hardware Cleanup
    override fun handleOnPause() {
        super.handleOnPause()
        if (isRecording) {
            try {
                mediaRecorder?.stop()
            } catch (e: Exception) {
                e.printStackTrace()
            }
            try {
                mediaRecorder?.reset()
                mediaRecorder?.release()
            } catch (e: Exception) {
                e.printStackTrace()
            }
            mediaRecorder = null
            recorderSurface = null
            sensorManager.unregisterListener(this)
            isRecording = false
            recordingStartTimeNanos = 0L
        }
        try {
            imuBufferedWriter?.flush()
            imuBufferedWriter?.close()
        } catch (e: Exception) {
            e.printStackTrace()
        }
        imuBufferedWriter = null
        imuFileWriter = null
        closeCamera()
    }

    override fun handleOnResume() {
        super.handleOnResume()
        if (cameraDevice == null && activeCameraId.isNotEmpty() && previewSurface != null) {
            openCamera(activeCameraId, null)
        }
    }

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        closeCamera()
        stopBackgroundThread()
        previewSurface?.release()
        previewSurface = null
        activity?.runOnUiThread {
            val root = textureView?.parent as? ViewGroup
            root?.removeView(textureView)
            textureView = null
        }
    }

    private fun closeCamera() {
        try {
            captureSession?.stopRepeating()
            captureSession?.close()
            captureSession = null
            cameraDevice?.close()
            cameraDevice = null
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
