# AIDL Inference Service — Integration Guide

## Architecture Overview

Tiny Facade exposes an on-device AI inference engine via an Android [AIDL](https://developer.android.com/develop/background-work/services/aidl) interface. The service runs as a **foreground service** (persistent notification) so the OS doesn't kill it during long inference tasks.

Key components:

- **`InferenceService`** — a bound foreground service that hosts the llama.cpp runtime via JNI
- **`IInferenceService.aidl`** — the AIDL interface clients bind to
- **`IInferenceCallback.aidl`** — a one-way callback for streaming tokens, completion events, and errors
- **Signature-level permission** (`com.tinyfacade.permission.USE_INFERENCE`) — only apps signed with the same key can bind

```
┌─────────────────┐         AIDL (Binder IPC)         ┌──────────────────┐
│  Client App     │ ──────────────────────────────────▶│  Tiny Facade     │
│  (test-client)  │◀────── IInferenceCallback ────────│  InferenceService│
└─────────────────┘                                    └──────────────────┘
```

## Prerequisites

1. **Same signing key** — The service uses `android:protectionLevel="signature"`. Both the host app and client must be signed with the same debug/release keystore.

2. **Copy AIDL files** — Your client project needs identical copies of:
   - `com/tinyfacade/IInferenceService.aidl`
   - `com/tinyfacade/IInferenceCallback.aidl`

3. **Declare the permission** in your client's `AndroidManifest.xml`:
   ```xml
   <uses-permission android:name="com.tinyfacade.permission.USE_INFERENCE" />
   ```

4. **Enable AIDL** in your `build.gradle.kts`:
   ```kotlin
   android {
       buildFeatures { aidl = true }
       sourceSets {
           getByName("main") { aidl.srcDirs("src/main/aidl") }
       }
   }
   ```

## Step-by-Step Integration

### 1. Bind to the Service

```kotlin
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import com.tinyfacade.IInferenceService

private var service: IInferenceService? = null

private val connection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
        service = IInferenceService.Stub.asInterface(binder)
    }
    override fun onServiceDisconnected(name: ComponentName?) {
        service = null
    }
}

// Bind
val intent = Intent("com.tinyfacade.INFERENCE_SERVICE").apply {
    setPackage("com.tinyfacade")
}
bindService(intent, connection, Context.BIND_AUTO_CREATE)
```

### 2. Discover Available Models

```kotlin
val models: List<String> = service!!.availableModels
// Returns absolute paths, e.g.:
// ["/storage/emulated/0/Download/model.gguf",
//  "/storage/emulated/0/Android/data/com.tinyfacade/files/phi-3.gguf"]
```

### 3. Load a Model

```kotlin
import android.os.Bundle
import com.tinyfacade.IInferenceCallback

val params = Bundle().apply {
    putInt("n_ctx", 2048)       // context window size
    putInt("n_gpu_layers", 99)  // GPU layers (-1 or 99 = all)
}

service!!.loadModel(modelPath, params, object : IInferenceCallback.Stub() {
    override fun onModelLoaded(success: Boolean) {
        if (success) { /* ready for inference */ }
    }
    override fun onToken(token: String?) {}
    override fun onComplete(response: String?, timingsJson: String?) {}
    override fun onError(message: String?) { /* handle error */ }
})
```

### 4. Run Inference with Streaming

```kotlin
val messagesJson = """[{"role":"user","content":"Hello!"}]"""
val inferParams = Bundle().apply {
    putInt("n_predict", 512)
    putFloat("temperature", 0.7f)
    putFloat("top_p", 0.9f)
}

service!!.sendMessage(messagesJson, inferParams, object : IInferenceCallback.Stub() {
    override fun onToken(token: String?) {
        // Called for each generated token — update UI here
    }
    override fun onComplete(response: String?, timingsJson: String?) {
        // Full response available
    }
    override fun onError(message: String?) { /* handle error */ }
    override fun onModelLoaded(success: Boolean) {}
})
```

### 5. Stop Generation Mid-Stream

```kotlin
service!!.stopGeneration()
```

### 6. Release Model and Unbind

```kotlin
service!!.releaseModel()
unbindService(connection)
service = null
```

## Lifecycle Diagram

```
startService()  ──▶  bind()  ──▶  getAvailableModels()
                       │
                       ▼
                  loadModel()
                       │
                       ▼
               ┌─ sendMessage() ◀──┐
               │       │           │
               │   onToken()...    │  (repeatable)
               │       │           │
               │   onComplete() ───┘
               │
               ▼
          releaseModel()
               │
               ▼
           unbind()  ──▶  stopService()
```

## Running the Test Client

The `test-client/` directory contains a standalone Kotlin app that exercises the full AIDL lifecycle.

### Build and Install

```bash
# From the project root
cd test-client
./gradlew installDebug
```

### Usage

1. **Install and open the main Tiny Facade app** first (so the service process exists)
2. **Open the test client** ("AIDL Test Client" in launcher)
3. **Tap Bind** — the Spinner auto-populates with discovered `.gguf` models
4. **Select a model** from the dropdown
5. **Tap Load** — wait for "Model loaded successfully" in the log
6. **Tap Send** — tokens stream in real-time in the log area
7. **Tap Stop** mid-stream to cancel generation
8. **Tap Release** → **Unbind** when done

### Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `bindService` returns false | Main app not installed or wrong package | Ensure Tiny Facade is installed |
| `SecurityException` on bind | Signing key mismatch | Use the same `debug.keystore` |
| Spinner is empty | No `.gguf` files on device | Copy a model to Downloads or the app's external files dir |
| `onError: No model loaded` | Called `sendMessage` before `loadModel` completed | Wait for `onModelLoaded(true)` |
