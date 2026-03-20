package com.tinyfacade

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Bundle
import android.os.IBinder
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class InferenceServiceModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "InferenceServiceModule"
        private const val EVENT_ON_TOKEN = "onToken"
        private const val EVENT_ON_COMPLETE = "onComplete"
        private const val EVENT_ON_MODEL_LOADED = "onModelLoaded"
        private const val EVENT_ON_ERROR = "onError"
        private const val EVENT_EXTERNAL_INFERENCE_REQUEST = "onExternalInferenceRequest"
        private const val EVENT_EXTERNAL_LOAD_REQUEST = "onExternalLoadRequest"
        private const val EVENT_EXTERNAL_STOP_REQUEST = "onExternalStopRequest"
        private const val EVENT_EXTERNAL_RELEASE_REQUEST = "onExternalReleaseRequest"
    }

    init {
        InferenceService.moduleRef = this
    }

    private var serviceIntent: Intent? = null
    private var inferenceService: IInferenceService? = null
    private var isBound = false

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            inferenceService = IInferenceService.Stub.asInterface(service)
            isBound = true
            Log.i(TAG, "Bound to InferenceService")
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            inferenceService = null
            isBound = false
            Log.w(TAG, "Disconnected from InferenceService")
        }
    }

    override fun getName(): String = "InferenceServiceModule"

    override fun getConstants(): MutableMap<String, Any> {
        return mutableMapOf(
            "ON_TOKEN" to EVENT_ON_TOKEN,
            "ON_COMPLETE" to EVENT_ON_COMPLETE,
            "ON_MODEL_LOADED" to EVENT_ON_MODEL_LOADED,
            "ON_ERROR" to EVENT_ON_ERROR,
            "EXTERNAL_INFERENCE_REQUEST" to EVENT_EXTERNAL_INFERENCE_REQUEST,
            "EXTERNAL_LOAD_REQUEST" to EVENT_EXTERNAL_LOAD_REQUEST,
            "EXTERNAL_STOP_REQUEST" to EVENT_EXTERNAL_STOP_REQUEST,
            "EXTERNAL_RELEASE_REQUEST" to EVENT_EXTERNAL_RELEASE_REQUEST
        )
    }

    private fun emitEvent(eventName: String, params: Any?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    fun emitExternalEvent(eventName: String, bundle: Bundle?) {
        val params = if (bundle != null) {
            Arguments.createMap().apply {
                for (key in bundle.keySet()) {
                    when (val value = bundle.get(key)) {
                        is String -> putString(key, value)
                        is Int -> putInt(key, value)
                        is Float -> putDouble(key, value.toDouble())
                        is Double -> putDouble(key, value)
                        is Boolean -> putBoolean(key, value)
                    }
                }
            }
        } else {
            null
        }
        emitEvent(eventName, params)
    }

    // --- Service lifecycle methods ---

    @ReactMethod
    fun startService(promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(context, InferenceService::class.java)
            serviceIntent = intent
            context.startForegroundService(intent)
            Log.i(TAG, "Inference service started")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start service", e)
            promise.reject("SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopService(promise: Promise) {
        try {
            val context = reactApplicationContext
            if (isBound) {
                context.unbindService(serviceConnection)
                inferenceService = null
                isBound = false
            }
            val intent = serviceIntent ?: Intent(context, InferenceService::class.java)
            context.stopService(intent)
            serviceIntent = null
            Log.i(TAG, "Inference service stopped")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop service", e)
            promise.reject("SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isServiceRunning(promise: Promise) {
        promise.resolve(serviceIntent != null)
    }

    @ReactMethod
    fun bindToService(promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(context, InferenceService::class.java)
            val bound = context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
            if (bound) {
                Log.i(TAG, "Binding to InferenceService")
                promise.resolve(true)
            } else {
                promise.reject("BIND_ERROR", "Failed to bind to InferenceService")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to bind to service", e)
            promise.reject("BIND_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun unbindFromService(promise: Promise) {
        try {
            if (isBound) {
                reactApplicationContext.unbindService(serviceConnection)
                inferenceService = null
                isBound = false
                Log.i(TAG, "Unbound from InferenceService")
            }
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to unbind from service", e)
            promise.reject("UNBIND_ERROR", e.message, e)
        }
    }

    // --- Existing AIDL-forwarding methods (for in-app usage via the binder) ---

    @ReactMethod
    fun loadModel(path: String, params: ReadableMap?, promise: Promise) {
        val binder = inferenceService
        if (binder == null) {
            promise.reject("NOT_BOUND", "Not bound to InferenceService. Call bindToService() first.")
            return
        }

        try {
            val bundle = Bundle().apply {
                params?.let {
                    if (it.hasKey("n_ctx")) putInt("n_ctx", it.getInt("n_ctx"))
                    if (it.hasKey("n_gpu_layers")) putInt("n_gpu_layers", it.getInt("n_gpu_layers"))
                }
            }

            binder.loadModel(path, bundle, object : IInferenceCallback.Stub() {
                override fun onToken(token: String?) {}

                override fun onComplete(response: String?, timingsJson: String?) {}

                override fun onError(message: String?) {
                    promise.reject("LOAD_ERROR", message ?: "Unknown error loading model")
                    emitEvent(EVENT_ON_ERROR, message)
                }

                override fun onModelLoaded(success: Boolean) {
                    if (success) {
                        promise.resolve(true)
                        emitEvent(EVENT_ON_MODEL_LOADED, true)
                    } else {
                        promise.reject("LOAD_ERROR", "Model failed to load")
                        emitEvent(EVENT_ON_MODEL_LOADED, false)
                    }
                }
            })
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load model", e)
            promise.reject("LOAD_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun sendMessage(messagesJson: String, params: ReadableMap?, promise: Promise) {
        val binder = inferenceService
        if (binder == null) {
            promise.reject("NOT_BOUND", "Not bound to InferenceService. Call bindToService() first.")
            return
        }

        try {
            val bundle = Bundle().apply {
                params?.let {
                    if (it.hasKey("n_predict")) putInt("n_predict", it.getInt("n_predict"))
                    if (it.hasKey("temperature")) putFloat("temperature", it.getDouble("temperature").toFloat())
                    if (it.hasKey("top_p")) putFloat("top_p", it.getDouble("top_p").toFloat())
                    if (it.hasKey("stop_sequences")) putString("stop_sequences", it.getString("stop_sequences"))
                }
            }

            binder.sendMessage(messagesJson, bundle, object : IInferenceCallback.Stub() {
                override fun onToken(token: String?) {
                    token?.let { emitEvent(EVENT_ON_TOKEN, it) }
                }

                override fun onComplete(response: String?, timingsJson: String?) {
                    val result = Arguments.createMap().apply {
                        putString("response", response ?: "")
                        putString("timings", timingsJson ?: "{}")
                    }
                    emitEvent(EVENT_ON_COMPLETE, result)
                    promise.resolve(result)
                }

                override fun onError(message: String?) {
                    promise.reject("INFERENCE_ERROR", message ?: "Unknown inference error")
                    emitEvent(EVENT_ON_ERROR, message)
                }

                override fun onModelLoaded(success: Boolean) {}
            })
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send message", e)
            promise.reject("INFERENCE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isModelLoaded(promise: Promise) {
        val binder = inferenceService
        if (binder == null) {
            promise.reject("NOT_BOUND", "Not bound to InferenceService. Call bindToService() first.")
            return
        }
        try {
            promise.resolve(binder.isModelLoaded)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to check model status", e)
            promise.reject("SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopGeneration(promise: Promise) {
        val binder = inferenceService
        if (binder == null) {
            promise.reject("NOT_BOUND", "Not bound to InferenceService. Call bindToService() first.")
            return
        }
        try {
            binder.stopGeneration()
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop generation", e)
            promise.reject("SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun releaseModel(promise: Promise) {
        val binder = inferenceService
        if (binder == null) {
            promise.reject("NOT_BOUND", "Not bound to InferenceService. Call bindToService() first.")
            return
        }
        try {
            binder.releaseModel()
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to release model", e)
            promise.reject("SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getAvailableModels(promise: Promise) {
        val binder = inferenceService
        if (binder == null) {
            promise.reject("NOT_BOUND", "Not bound to InferenceService. Call bindToService() first.")
            return
        }
        try {
            val models = binder.availableModels
            val array = Arguments.createArray()
            models.forEach { array.pushString(it) }
            promise.resolve(array)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get available models", e)
            promise.reject("SERVICE_ERROR", e.message, e)
        }
    }

    // --- Model registration (llama.rn context → ModelHolder) ---

    @ReactMethod
    fun registerModel(contextId: Int, path: String, promise: Promise) {
        ModelHolder.register(contextId, path)
        Log.i(TAG, "Registered model: contextId=$contextId, path=$path")
        promise.resolve(true)
    }

    @ReactMethod
    fun unregisterModel(promise: Promise) {
        ModelHolder.clear()
        Log.i(TAG, "Unregistered model")
        promise.resolve(true)
    }

    @ReactMethod
    fun getLoadedModelPath(promise: Promise) {
        promise.resolve(ModelHolder.modelPath ?: "")
    }

    // --- Delivery methods (JS → AIDL callback) ---

    @ReactMethod
    fun deliverToken(token: String) {
        try {
            ModelHolder.pendingInferenceCallback?.onToken(token)
        } catch (e: Exception) {
            Log.w(TAG, "Error delivering token", e)
        }
    }

    @ReactMethod
    fun deliverComplete(response: String, timings: String) {
        try {
            ModelHolder.pendingInferenceCallback?.onComplete(response, timings)
        } catch (e: Exception) {
            Log.w(TAG, "Error delivering completion", e)
        }
        ModelHolder.pendingInferenceCallback = null
    }

    @ReactMethod
    fun deliverError(message: String) {
        try {
            ModelHolder.pendingInferenceCallback?.onError(message)
        } catch (e: Exception) {
            Log.w(TAG, "Error delivering error", e)
        }
        ModelHolder.pendingInferenceCallback = null
    }

    @ReactMethod
    fun deliverModelLoaded(success: Boolean) {
        try {
            ModelHolder.pendingLoadCallback?.onModelLoaded(success)
        } catch (e: Exception) {
            Log.w(TAG, "Error delivering model loaded", e)
        }
        ModelHolder.pendingLoadCallback = null
    }

    // --- Event emitter boilerplate ---

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN event emitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN event emitter
    }
}
