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
            setPackage("com.tinyfacade")
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

## Tool Calling

AIDL clients can leverage built-in and custom tools without managing the tool loop themselves. TinyFacade handles all orchestration: prompt building, parsing, execution, and iteration.

### Enabling Tools

Pass `enable_tools: true` in the `sendMessage` params Bundle:

```kotlin
val params = Bundle().apply {
    putInt("n_predict", 512)
    putFloat("temperature", 0.7f)
    putBoolean("enable_tools", true) // enable tool calling
}

service?.sendMessage(messagesJson, params, callback)
```

When enabled, the model can call tools (e.g., `get_current_time`, `calculate`) and TinyFacade runs the tool loop server-side. The AIDL client receives streamed tokens and the final response — the tool loop is transparent.

### Querying Available Tools

```kotlin
val toolsJson = service?.availableTools  // JSON array of tool definitions
```

Returns a JSON array of all registered tool definitions (built-in + custom).

### Registering Custom Tools

Custom tools use **action-based execution** — no arbitrary code runs on the host. You define a tool with a JSON schema and an action that specifies how to execute it.

```kotlin
val definition = """
{
  "type": "function",
  "function": {
    "name": "get_weather",
    "description": "Get current weather for a city",
    "parameters": {
      "type": "object",
      "properties": {
        "city": { "type": "string", "description": "City name" }
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

service?.registerTool(definition, action)
```

### Action Types

| Type | Status | Description |
|------|--------|-------------|
| `http` | Full | HTTP request with method/headers/body/timeout. Supports `{{param}}` templates. |
| `file` | Full | Read/write/list/exists. Sandboxed to `tinyfacade-tools/` directory. |
| `system` | Partial | `device_info` works; `battery`, `network`, `location`, `storage` are stubbed. |
| `intent` | Stubbed | Android Intent dispatch (requires future native module). |
| `content_resolver` | Stubbed | ContentResolver queries (requires future native module). |

### Unregistering Tools

```kotlin
service?.unregisterTool("get_weather")  // returns true if removed
```

Built-in tools cannot be unregistered.

## AIDL Interface Reference

### IInferenceService

| Method | Description |
|--------|-------------|
| `loadModel(path, params, callback)` | Load a GGUF model file |
| `sendMessage(messagesJson, params, callback)` | Run inference on messages |
| `isModelLoaded()` | Check if a model is currently loaded |
| `stopGeneration()` | Cancel in-progress generation |
| `releaseModel()` | Free model memory |
| `getAvailableTools()` | Get JSON array of all tool definitions |
| `registerTool(definitionJson, actionJson)` | Register a custom tool with action-based execution |
| `unregisterTool(toolName)` | Remove a custom tool (built-ins protected) |

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
- `enable_tools` (boolean, default false) — Enable tool calling orchestration

## Security

The service is protected by a `signature`-level permission. Only apps signed with the same certificate as Tiny Facade can bind to the service. For development, both apps must use the same debug keystore.

## Sample Client

See `sample-client/` for a complete working example.
