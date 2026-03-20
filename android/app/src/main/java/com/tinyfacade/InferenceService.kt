package com.tinyfacade

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.IBinder
import android.util.Log
import java.io.File

class InferenceService : Service() {

    companion object {
        private const val TAG = "InferenceService"
        private const val CHANNEL_ID = "tinyfacade_inference"
        private const val NOTIFICATION_ID = 1

        @Volatile
        var moduleRef: InferenceServiceModule? = null
    }

    private val binder: IInferenceService.Stub = object : IInferenceService.Stub() {

        override fun loadModel(path: String, params: Bundle?, callback: IInferenceCallback?) {
            if (ModelHolder.modelPath == path && ModelHolder.isLoaded) {
                Log.i(TAG, "Model already loaded at: $path")
                callback?.onModelLoaded(true)
                return
            }

            ModelHolder.pendingLoadCallback = callback

            val nCtx = params?.getInt("n_ctx", 2048) ?: 2048
            val nGpuLayers = params?.getInt("n_gpu_layers", 99) ?: 99

            Log.i(TAG, "Requesting JS to load model: $path")
            moduleRef?.emitExternalEvent("onExternalLoadRequest", Bundle().apply {
                putString("path", path)
                putInt("nCtx", nCtx)
                putInt("nGpuLayers", nGpuLayers)
            })
                ?: run {
                    Log.e(TAG, "InferenceServiceModule not registered")
                    callback?.onError("InferenceServiceModule not available")
                    ModelHolder.pendingLoadCallback = null
                }
        }

        override fun sendMessage(messagesJson: String, params: Bundle?, callback: IInferenceCallback?) {
            if (!ModelHolder.isLoaded) {
                callback?.onError("No model loaded")
                return
            }

            ModelHolder.pendingInferenceCallback = callback

            val nPredict = params?.getInt("n_predict", 512) ?: 512
            val temperature = params?.getFloat("temperature", 0.7f) ?: 0.7f
            val topP = params?.getFloat("top_p", 0.9f) ?: 0.9f
            val stopSeqs = params?.getString("stop_sequences", "[]") ?: "[]"
            val enableTools = params?.getBoolean("enable_tools", false) ?: false

            Log.i(TAG, "Routing inference request to JS (enableTools=$enableTools)")
            moduleRef?.emitExternalEvent("onExternalInferenceRequest", Bundle().apply {
                putString("messagesJson", messagesJson)
                putInt("nPredict", nPredict)
                putFloat("temperature", temperature)
                putFloat("topP", topP)
                putString("stopSequences", stopSeqs)
                putBoolean("enableTools", enableTools)
            })
                ?: run {
                    Log.e(TAG, "InferenceServiceModule not registered")
                    callback?.onError("InferenceServiceModule not available")
                    ModelHolder.pendingInferenceCallback = null
                }
        }

        override fun isModelLoaded(): Boolean = ModelHolder.isLoaded

        override fun getLoadedModelPath(): String = ModelHolder.modelPath ?: ""

        override fun stopGeneration() {
            Log.i(TAG, "Routing stop request to JS")
            moduleRef?.emitExternalEvent("onExternalStopRequest", null)
        }

        override fun releaseModel() {
            Log.i(TAG, "Routing release request to JS")
            moduleRef?.emitExternalEvent("onExternalReleaseRequest", null)
        }

        override fun getAvailableTools(): String {
            return ModelHolder.availableToolsJson ?: "[]"
        }

        override fun registerTool(toolDefinitionJson: String, actionJson: String): Boolean {
            Log.i(TAG, "Routing registerTool to JS")
            moduleRef?.emitExternalEvent("onExternalRegisterTool", Bundle().apply {
                putString("toolDefinitionJson", toolDefinitionJson)
                putString("actionJson", actionJson)
            }) ?: run {
                Log.e(TAG, "InferenceServiceModule not registered")
                return false
            }
            return true
        }

        override fun unregisterTool(toolName: String): Boolean {
            Log.i(TAG, "Routing unregisterTool to JS: $toolName")
            moduleRef?.emitExternalEvent("onExternalUnregisterTool", Bundle().apply {
                putString("toolName", toolName)
            }) ?: run {
                Log.e(TAG, "InferenceServiceModule not registered")
                return false
            }
            return true
        }

        override fun getAvailableModels(): List<String> {
            val models = mutableListOf<String>()
            val dirs = listOfNotNull(
                this@InferenceService.getExternalFilesDir(null),
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            )
            for (dir in dirs) {
                try {
                    if (dir.exists() && dir.canRead()) {
                        dir.listFiles()?.filter {
                            it.isFile && it.extension.equals("gguf", ignoreCase = true)
                        }?.forEach { models.add(it.absolutePath) }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error scanning ${dir.absolutePath}", e)
                }
            }
            Log.i(TAG, "Found ${models.size} available model(s)")
            return models
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
        Log.i(TAG, "InferenceService created")
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onDestroy() {
        Log.i(TAG, "InferenceService destroyed")
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Inference Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps the AI inference engine running"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("Tiny Facade")
            .setContentText("AI inference service is running")
            .setSmallIcon(android.R.drawable.ic_menu_manage)
            .setOngoing(true)
            .build()
    }
}
