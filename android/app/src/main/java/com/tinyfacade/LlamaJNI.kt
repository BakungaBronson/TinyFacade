package com.tinyfacade

import android.util.Log

/**
 * JNI wrapper for llama.cpp inference.
 * Links against the native inference_service library built via CMake.
 *
 * The native library is loaded lazily — if it's not available (e.g. CMake build
 * is not enabled), calls will return safe defaults.
 */
object LlamaJNI {

    private const val TAG = "LlamaJNI"
    private var nativeLoaded = false

    init {
        try {
            System.loadLibrary("inference_service")
            nativeLoaded = true
            Log.i(TAG, "Native inference library loaded")
        } catch (e: UnsatisfiedLinkError) {
            Log.w(TAG, "Native inference library not available: ${e.message}")
        }
    }

    fun isAvailable(): Boolean = nativeLoaded

    fun initModel(modelPath: String, nCtx: Int, nGpuLayers: Int): Long {
        if (!nativeLoaded) return 0L
        return nativeInitModel(modelPath, nCtx, nGpuLayers)
    }

    fun completion(
        handle: Long,
        prompt: String,
        nPredict: Int,
        temperature: Float,
        topP: Float,
        stopSequences: String,
        callback: InferenceTokenCallback
    ): String {
        if (!nativeLoaded) return """{"error":"Native library not loaded"}"""
        return nativeCompletion(handle, prompt, nPredict, temperature, topP, stopSequences, callback)
    }

    fun stopCompletion(handle: Long) {
        if (nativeLoaded) nativeStopCompletion(handle)
    }

    fun releaseModel(handle: Long) {
        if (nativeLoaded) nativeReleaseModel(handle)
    }

    private external fun nativeInitModel(modelPath: String, nCtx: Int, nGpuLayers: Int): Long
    private external fun nativeCompletion(
        handle: Long,
        prompt: String,
        nPredict: Int,
        temperature: Float,
        topP: Float,
        stopSequences: String,
        callback: InferenceTokenCallback
    ): String
    private external fun nativeStopCompletion(handle: Long)
    private external fun nativeReleaseModel(handle: Long)
}

/**
 * Callback interface for receiving tokens during completion.
 * Called from JNI native code.
 */
interface InferenceTokenCallback {
    fun onToken(token: String)
}
