package com.tinyfacade.testclient

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.tinyfacade.IInferenceCallback
import com.tinyfacade.IInferenceService
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {

    private var service: IInferenceService? = null
    private var isBound = false
    private var isLoading = false
    private var loadStartTime = 0L

    private lateinit var spinnerModels: Spinner
    private lateinit var editPrompt: EditText
    private lateinit var textLog: TextView
    private lateinit var scrollLog: ScrollView
    private lateinit var btnLoad: Button
    private lateinit var chkEnableTools: CheckBox

    private val modelPaths = mutableListOf<String>()
    private val timeFormat = SimpleDateFormat("HH:mm:ss.SSS", Locale.US)
    private val handler = Handler(Looper.getMainLooper())

    private val loadingTicker = object : Runnable {
        override fun run() {
            if (isLoading) {
                val elapsed = (System.currentTimeMillis() - loadStartTime) / 1000
                btnLoad.text = "Loading... ${elapsed}s"
                handler.postDelayed(this, 1000)
            }
        }
    }

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            service = IInferenceService.Stub.asInterface(binder)
            isBound = true
            log("Bound to InferenceService")
            discoverModels()
            checkLoadedModel()
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            service = null
            isBound = false
            log("Disconnected from InferenceService")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        spinnerModels = findViewById(R.id.spinnerModels)
        editPrompt = findViewById(R.id.editPrompt)
        textLog = findViewById(R.id.textLog)
        scrollLog = findViewById(R.id.scrollLog)
        btnLoad = findViewById(R.id.btnLoad)
        chkEnableTools = findViewById(R.id.chkEnableTools)

        findViewById<Button>(R.id.btnBind).setOnClickListener { doBind() }
        btnLoad.setOnClickListener { doLoad() }
        findViewById<Button>(R.id.btnSend).setOnClickListener { doSend() }
        findViewById<Button>(R.id.btnStop).setOnClickListener { doStop() }
        findViewById<Button>(R.id.btnRelease).setOnClickListener { doRelease() }
        findViewById<Button>(R.id.btnUnbind).setOnClickListener { doUnbind() }
        findViewById<Button>(R.id.btnTools).setOnClickListener { doQueryTools() }
        findViewById<Button>(R.id.btnRegister).setOnClickListener { doRegisterWeatherTool() }

        log("Ready. Tap Bind to connect to InferenceService.")
    }

    private fun doBind() {
        if (isBound) {
            log("Already bound")
            return
        }
        log("Binding...")
        val intent = Intent("com.tinyfacade.INFERENCE_SERVICE").apply {
            setPackage("com.tinyfacade")
        }
        val ok = bindService(intent, connection, Context.BIND_AUTO_CREATE)
        if (!ok) {
            log("ERROR: bindService returned false. Is the main app installed?")
        }
    }

    private fun discoverModels() {
        try {
            val models = service?.availableModels ?: emptyList()
            modelPaths.clear()
            modelPaths.addAll(models)
            val displayNames = models.map { it.substringAfterLast('/') }
            val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, displayNames)
            adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
            spinnerModels.adapter = adapter
            log("Discovered ${models.size} model(s)")
        } catch (e: Exception) {
            log("ERROR discovering models: ${e.message}")
        }
    }

    private fun checkLoadedModel() {
        try {
            val svc = service ?: return
            if (svc.isModelLoaded) {
                val loadedPath = svc.loadedModelPath
                val fileName = loadedPath.substringAfterLast('/')
                log("Model already loaded: $fileName")

                // Auto-select the loaded model in the spinner
                val idx = modelPaths.indexOf(loadedPath)
                if (idx >= 0) {
                    spinnerModels.setSelection(idx)
                }
            } else {
                log("No model currently loaded in main app")
            }
        } catch (e: Exception) {
            log("ERROR checking loaded model: ${e.message}")
        }
    }

    private fun doLoad() {
        val svc = requireBound() ?: return
        if (modelPaths.isEmpty()) {
            log("No models available")
            return
        }
        if (isLoading) {
            log("Already loading, please wait...")
            return
        }
        val idx = spinnerModels.selectedItemPosition
        val path = modelPaths[idx]
        val fileName = path.substringAfterLast('/')

        // Smart reuse: skip if the main app already has this model loaded
        try {
            if (svc.isModelLoaded && svc.loadedModelPath == path) {
                log("Model already loaded: $fileName — ready to use")
                return
            }
        } catch (e: Exception) {
            log("WARN: Could not check loaded state: ${e.message}")
        }

        log("Loading model: $fileName (this may take 30s-2min for large models)")

        isLoading = true
        loadStartTime = System.currentTimeMillis()
        btnLoad.isEnabled = false
        handler.post(loadingTicker)

        val params = Bundle().apply {
            putInt("n_ctx", 2048)
            putInt("n_gpu_layers", 99)
        }

        try {
            svc.loadModel(path, params, object : IInferenceCallback.Stub() {
                override fun onToken(token: String?) {}
                override fun onComplete(response: String?, timingsJson: String?) {}
                override fun onError(message: String?) {
                    runOnUiThread {
                        finishLoading()
                        log("ERROR loading: $message")
                    }
                }
                override fun onModelLoaded(success: Boolean) {
                    runOnUiThread {
                        val elapsed = (System.currentTimeMillis() - loadStartTime) / 1000
                        finishLoading()
                        if (success) {
                            log("Model loaded successfully (took ${elapsed}s)")
                        } else {
                            log("ERROR: model failed to load (after ${elapsed}s)")
                        }
                    }
                }
            })
        } catch (e: Exception) {
            finishLoading()
            log("ERROR calling loadModel: ${e.message}")
        }
    }

    private fun finishLoading() {
        isLoading = false
        handler.removeCallbacks(loadingTicker)
        btnLoad.text = "Load"
        btnLoad.isEnabled = true
    }

    private fun doSend() {
        val svc = requireBound() ?: return
        if (isLoading) {
            log("Model is still loading, please wait...")
            return
        }
        val prompt = editPrompt.text.toString().ifBlank { "Hello" }
        val toolsEnabled = chkEnableTools.isChecked
        log("Sending prompt: $prompt (tools=${if (toolsEnabled) "ON" else "OFF"})")

        val messagesJson = """[{"role":"user","content":"$prompt"}]"""
        val params = Bundle().apply {
            putInt("n_predict", 512)
            putFloat("temperature", 0.7f)
            putFloat("top_p", 0.9f)
            putBoolean("enable_tools", toolsEnabled)
        }

        svc.sendMessage(messagesJson, params, object : IInferenceCallback.Stub() {
            override fun onToken(token: String?) {
                token?.let { t ->
                    runOnUiThread { appendToLog(t) }
                }
            }

            override fun onComplete(response: String?, timingsJson: String?) {
                runOnUiThread { log("\n[Generation complete]") }
            }

            override fun onError(message: String?) {
                runOnUiThread { log("ERROR: $message") }
            }

            override fun onModelLoaded(success: Boolean) {}
        })
    }

    private fun doQueryTools() {
        val svc = requireBound() ?: return
        try {
            val toolsJson = svc.availableTools
            log("Available tools: $toolsJson")
        } catch (e: Exception) {
            log("ERROR querying tools: ${e.message}")
        }
    }

    private fun doRegisterWeatherTool() {
        val svc = requireBound() ?: return
        try {
            val definition = """
                {
                  "type": "function",
                  "function": {
                    "name": "get_weather",
                    "description": "Get current weather for a city using wttr.in",
                    "parameters": {
                      "type": "object",
                      "properties": {
                        "city": {
                          "type": "string",
                          "description": "City name (e.g. Tokyo, London, New York)"
                        }
                      },
                      "required": ["city"]
                    }
                  }
                }
            """.trimIndent()

            val action = """
                {
                  "type": "http",
                  "config": {
                    "method": "GET",
                    "url_template": "https://wttr.in/{{city}}?format=j1",
                    "timeout_ms": 10000
                  }
                }
            """.trimIndent()

            val ok = svc.registerTool(definition, action)
            if (ok) {
                log("Registered weather tool (get_weather)")
            } else {
                log("Failed to register weather tool")
            }
        } catch (e: Exception) {
            log("ERROR registering tool: ${e.message}")
        }
    }

    private fun doStop() {
        val svc = requireBound() ?: return
        try {
            svc.stopGeneration()
            log("Stop requested")
        } catch (e: Exception) {
            log("ERROR stopping: ${e.message}")
        }
    }

    private fun doRelease() {
        val svc = requireBound() ?: return
        try {
            svc.releaseModel()
            log("Model released")
        } catch (e: Exception) {
            log("ERROR releasing: ${e.message}")
        }
    }

    private fun doUnbind() {
        if (!isBound) {
            log("Not bound")
            return
        }
        unbindService(connection)
        service = null
        isBound = false
        log("Unbound from service")
    }

    private fun requireBound(): IInferenceService? {
        if (!isBound || service == null) {
            log("ERROR: Not bound to service. Tap Bind first.")
            return null
        }
        return service
    }

    private fun log(msg: String) {
        val ts = timeFormat.format(Date())
        textLog.append("[$ts] $msg\n")
        scrollToBottom()
    }

    private fun appendToLog(text: String) {
        textLog.append(text)
        scrollToBottom()
    }

    private fun scrollToBottom() {
        scrollLog.post { scrollLog.fullScroll(View.FOCUS_DOWN) }
    }

    override fun onDestroy() {
        handler.removeCallbacks(loadingTicker)
        if (isBound) {
            unbindService(connection)
            isBound = false
        }
        super.onDestroy()
    }
}
