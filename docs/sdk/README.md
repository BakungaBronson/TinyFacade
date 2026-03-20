# Tiny Facade Client SDK

Tiny Facade exposes an on-device AI inference service via Android AIDL. Any app signed with the same key (or granted the `com.tinyfacade.permission.USE_INFERENCE` signature permission) can bind to the service and run inference.

## Quick Start

### 1. Copy AIDL Files

Copy these AIDL files into your project's `src/main/aidl/com/tinyfacade/` directory:

- `IInferenceService.aidl`
- `IInferenceCallback.aidl`

### 2. Declare Permission

In your `AndroidManifest.xml`:

```xml
<uses-permission android:name="com.tinyfacade.permission.USE_INFERENCE" />
```

### 3. Bind to the Service

```kotlin
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Bundle
import android.os.IBinder
import com.tinyfacade.IInferenceService
import com.tinyfacade.IInferenceCallback

class InferenceClient(private val context: Context) {

    private var service: IInferenceService? = null

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName, binder: IBinder) {
            service = IInferenceService.Stub.asInterface(binder)
        }

        override fun onServiceDisconnected(name: ComponentName) {
            service = null
        }
    }

    fun bind() {
        val intent = Intent("com.tinyfacade.INFERENCE_SERVICE").apply {
            setPackage("com.llamavision")
        }
        context.bindService(intent, connection, Context.BIND_AUTO_CREATE)
    }

    fun unbind() {
        context.unbindService(connection)
    }
}
```

### 4. Load a Model

```kotlin
val params = Bundle().apply {
    putInt("n_ctx", 2048)
    putInt("n_gpu_layers", 99)
}

service?.loadModel("/path/to/model.gguf", params, object : IInferenceCallback.Stub() {
    override fun onToken(token: String) {}
    override fun onComplete(response: String, timingsJson: String) {}
    override fun onError(message: String) {
        Log.e("Client", "Load error: $message")
    }
    override fun onModelLoaded(success: Boolean) {
        Log.i("Client", "Model loaded: $success")
    }
})
```

### 5. Send a Message

```kotlin
val messagesJson = """
[
  {"role": "system", "content": "You are a helpful assistant."},
  {"role": "user", "content": "Hello!"}
]
""".trimIndent()

val params = Bundle().apply {
    putInt("n_predict", 512)
    putFloat("temperature", 0.7f)
    putFloat("top_p", 0.9f)
    putString("stop_sequences", """["<|end|>", "</s>"]""")
}

service?.sendMessage(messagesJson, params, object : IInferenceCallback.Stub() {
    override fun onToken(token: String) {
        // Called for each generated token — update UI here
        runOnUiThread { textView.append(token) }
    }

    override fun onComplete(response: String, timingsJson: String) {
        // Called when generation is complete
        Log.i("Client", "Complete: $response")
    }

    override fun onError(message: String) {
        Log.e("Client", "Error: $message")
    }

    override fun onModelLoaded(success: Boolean) {}
})
```

### 6. Stop / Release

```kotlin
// Stop current generation
service?.stopGeneration()

// Release model (frees memory)
service?.releaseModel()

// Check if a model is loaded
val loaded = service?.isModelLoaded() ?: false
```

## AIDL Interface Reference

### IInferenceService

| Method | Description |
|--------|-------------|
| `loadModel(path, params, callback)` | Load a GGUF model file |
| `sendMessage(messagesJson, params, callback)` | Run inference on messages |
| `isModelLoaded()` | Check if a model is currently loaded |
| `stopGeneration()` | Cancel in-progress generation |
| `releaseModel()` | Free model memory |

### IInferenceCallback (oneway)

| Method | Description |
|--------|-------------|
| `onToken(token)` | Streaming token during generation |
| `onComplete(response, timingsJson)` | Generation complete |
| `onError(message)` | Error occurred |
| `onModelLoaded(success)` | Model load result |

### Bundle Parameters

**loadModel params:**
- `n_ctx` (int, default 2048) — Context window size
- `n_gpu_layers` (int, default 99) — GPU layers to offload

**sendMessage params:**
- `n_predict` (int, default 512) — Max tokens to generate
- `temperature` (float, default 0.7) — Sampling temperature
- `top_p` (float, default 0.9) — Top-p sampling
- `stop_sequences` (String, default "[]") — JSON array of stop strings

## Security

The service is protected by a `signature`-level permission. Only apps signed with the same certificate as Tiny Facade can bind to the service. For development, both apps must use the same debug keystore.

## Sample Client

See `sample-client/` for a complete working example.
