package com.example.tinyfacadeclient

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Bundle
import android.os.IBinder
import android.util.Log
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.tinyfacade.IInferenceCallback
import com.tinyfacade.IInferenceService

/**
 * Sample client app demonstrating AIDL binding to the Tiny Facade inference service.
 *
 * Prerequisites:
 * 1. Tiny Facade must be installed
 * 2. A model must be downloaded/available
 * 3. Both apps must share the same signing key (debug keystore for dev)
 */
class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "TinyFacadeClient"
    }

    private var inferenceService: IInferenceService? = null
    private var isBound = false

    private lateinit var statusText: TextView
    private lateinit var outputText: TextView
    private lateinit var inputEdit: EditText
    private lateinit var sendButton: Button
    private lateinit var bindButton: Button

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName, binder: IBinder) {
            inferenceService = IInferenceService.Stub.asInterface(binder)
            isBound = true
            Log.i(TAG, "Connected to inference service")
            runOnUiThread {
                statusText.text = "Connected to Tiny Facade"
                sendButton.isEnabled = true
            }
        }

        override fun onServiceDisconnected(name: ComponentName) {
            inferenceService = null
            isBound = false
            Log.i(TAG, "Disconnected from inference service")
            runOnUiThread {
                statusText.text = "Disconnected"
                sendButton.isEnabled = false
            }
        }
    }

    private val inferenceCallback = object : IInferenceCallback.Stub() {
        override fun onToken(token: String) {
            runOnUiThread {
                outputText.append(token)
            }
        }

        override fun onComplete(response: String, timingsJson: String) {
            Log.i(TAG, "Completion done. Timings: $timingsJson")
            runOnUiThread {
                statusText.text = "Complete"
                sendButton.isEnabled = true
            }
        }

        override fun onError(message: String) {
            Log.e(TAG, "Error: $message")
            runOnUiThread {
                statusText.text = "Error: $message"
                sendButton.isEnabled = true
            }
        }

        override fun onModelLoaded(success: Boolean) {
            Log.i(TAG, "Model loaded: $success")
            runOnUiThread {
                statusText.text = if (success) "Model loaded" else "Model load failed"
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Simple programmatic layout for demo purposes
        val layout = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }

        statusText = TextView(this).apply { text = "Not connected"; textSize = 16f }
        layout.addView(statusText)

        bindButton = Button(this).apply {
            text = "Bind to Tiny Facade"
            setOnClickListener { bindToService() }
        }
        layout.addView(bindButton)

        inputEdit = EditText(this).apply {
            hint = "Type a message..."
            setSingleLine(false)
            minLines = 3
        }
        layout.addView(inputEdit)

        sendButton = Button(this).apply {
            text = "Send"
            isEnabled = false
            setOnClickListener { sendMessage() }
        }
        layout.addView(sendButton)

        outputText = TextView(this).apply {
            text = ""
            textSize = 14f
            setPadding(0, 16, 0, 0)
        }
        layout.addView(outputText)

        setContentView(layout)
    }

    private fun bindToService() {
        val intent = Intent("com.tinyfacade.INFERENCE_SERVICE").apply {
            setPackage("com.tinyfacade")
        }
        val bound = bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
        if (!bound) {
            statusText.text = "Failed to bind — is Tiny Facade installed?"
        }
    }

    private fun sendMessage() {
        val userText = inputEdit.text.toString().trim()
        if (userText.isEmpty()) return

        val messagesJson = """
        [
          {"role": "system", "content": "You are a helpful assistant."},
          {"role": "user", "content": "${userText.replace("\"", "\\\"")}"}
        ]
        """.trimIndent()

        val params = Bundle().apply {
            putInt("n_predict", 256)
            putFloat("temperature", 0.7f)
            putFloat("top_p", 0.9f)
        }

        outputText.text = ""
        statusText.text = "Generating..."
        sendButton.isEnabled = false

        inferenceService?.sendMessage(messagesJson, params, inferenceCallback)
    }

    override fun onDestroy() {
        if (isBound) {
            unbindService(serviceConnection)
            isBound = false
        }
        super.onDestroy()
    }
}
