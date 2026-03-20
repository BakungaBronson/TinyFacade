#include <jni.h>
#include <string>
#include <android/log.h>

// Forward declarations for llama.cpp
// These will be linked from the llama.rn node_modules
#include "llama.h"
#include "common.h"

#define TAG "InferenceJNI"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

struct inference_context {
    llama_model * model;
    llama_context * ctx;
    llama_sampler * sampler;
    bool stop_requested;
};

extern "C" {

JNIEXPORT jlong JNICALL
Java_com_tinyfacade_LlamaJNI_initModel(
    JNIEnv *env,
    jobject /* this */,
    jstring modelPath,
    jint nCtx,
    jint nGpuLayers
) {
    const char *path = env->GetStringUTFChars(modelPath, nullptr);
    LOGI("initModel: %s, nCtx=%d, nGpuLayers=%d", path, nCtx, nGpuLayers);

    // Initialize llama backend
    llama_backend_init();

    // Load model
    auto model_params = llama_model_default_params();
    model_params.n_gpu_layers = nGpuLayers;

    llama_model * model = llama_model_load_from_file(path, model_params);
    env->ReleaseStringUTFChars(modelPath, path);

    if (!model) {
        LOGE("Failed to load model");
        return 0;
    }

    // Create context
    auto ctx_params = llama_context_default_params();
    ctx_params.n_ctx = nCtx;
    ctx_params.n_batch = 512;

    llama_context * ctx = llama_init_from_model(model, ctx_params);
    if (!ctx) {
        LOGE("Failed to create context");
        llama_model_free(model);
        return 0;
    }

    // Create sampler chain
    auto sampler = llama_sampler_chain_init(llama_sampler_chain_default_params());
    llama_sampler_chain_add(sampler, llama_sampler_init_temp(0.7f));
    llama_sampler_chain_add(sampler, llama_sampler_init_top_p(0.9f, 1));
    llama_sampler_chain_add(sampler, llama_sampler_init_dist(42));

    auto * inf_ctx = new inference_context();
    inf_ctx->model = model;
    inf_ctx->ctx = ctx;
    inf_ctx->sampler = sampler;
    inf_ctx->stop_requested = false;

    LOGI("Model loaded successfully");
    return reinterpret_cast<jlong>(inf_ctx);
}

JNIEXPORT jstring JNICALL
Java_com_tinyfacade_LlamaJNI_completion(
    JNIEnv *env,
    jobject /* this */,
    jlong handle,
    jstring prompt,
    jint nPredict,
    jfloat temperature,
    jfloat topP,
    jstring stopSequences,
    jobject callback
) {
    auto * inf_ctx = reinterpret_cast<inference_context *>(handle);
    if (!inf_ctx || !inf_ctx->ctx) {
        return env->NewStringUTF("{\"error\":\"Invalid context\"}");
    }

    inf_ctx->stop_requested = false;

    const char *prompt_cstr = env->GetStringUTFChars(prompt, nullptr);
    std::string prompt_str(prompt_cstr);
    env->ReleaseStringUTFChars(prompt, prompt_cstr);

    // Get callback method
    jclass callbackClass = env->GetObjectClass(callback);
    jmethodID onTokenMethod = env->GetMethodID(callbackClass, "onToken", "(Ljava/lang/String;)V");

    // Tokenize prompt
    const llama_vocab * vocab = llama_model_get_vocab(inf_ctx->model);
    std::vector<llama_token> tokens(prompt_str.size() + 16);
    int n_tokens = llama_tokenize(vocab, prompt_str.c_str(), prompt_str.size(),
                                   tokens.data(), tokens.size(), true, true);
    if (n_tokens < 0) {
        tokens.resize(-n_tokens);
        n_tokens = llama_tokenize(vocab, prompt_str.c_str(), prompt_str.size(),
                                   tokens.data(), tokens.size(), true, true);
    }
    tokens.resize(n_tokens);

    // Evaluate prompt
    llama_batch batch = llama_batch_get_one(tokens.data(), tokens.size());
    if (llama_decode(inf_ctx->ctx, batch) != 0) {
        return env->NewStringUTF("{\"error\":\"Failed to evaluate prompt\"}");
    }

    // Generate tokens
    std::string result_text;
    int n_generated = 0;

    for (int i = 0; i < nPredict; i++) {
        if (inf_ctx->stop_requested) {
            break;
        }

        llama_token new_token = llama_sampler_sample(inf_ctx->sampler, inf_ctx->ctx, -1);

        if (llama_vocab_is_eog(vocab, new_token)) {
            break;
        }

        char buf[256];
        int n = llama_token_to_piece(vocab, new_token, buf, sizeof(buf), 0, true);
        if (n > 0) {
            std::string token_str(buf, n);
            result_text += token_str;
            n_generated++;

            // Send token via callback
            jstring jtoken = env->NewStringUTF(token_str.c_str());
            env->CallVoidMethod(callback, onTokenMethod, jtoken);
            env->DeleteLocalRef(jtoken);
        }

        // Prepare next batch
        llama_batch next_batch = llama_batch_get_one(&new_token, 1);
        if (llama_decode(inf_ctx->ctx, next_batch) != 0) {
            break;
        }
    }

    // Build result JSON
    std::string json = "{\"text\":\"";
    // Escape the text for JSON
    for (char c : result_text) {
        switch (c) {
            case '"': json += "\\\""; break;
            case '\\': json += "\\\\"; break;
            case '\n': json += "\\n"; break;
            case '\r': json += "\\r"; break;
            case '\t': json += "\\t"; break;
            default: json += c;
        }
    }
    json += "\",\"tokens_generated\":" + std::to_string(n_generated) + "}";

    // Clear KV cache for next completion
    llama_memory_clear(llama_get_memory(inf_ctx->ctx), true);

    return env->NewStringUTF(json.c_str());
}

JNIEXPORT void JNICALL
Java_com_tinyfacade_LlamaJNI_stopCompletion(
    JNIEnv * /* env */,
    jobject /* this */,
    jlong handle
) {
    auto * inf_ctx = reinterpret_cast<inference_context *>(handle);
    if (inf_ctx) {
        inf_ctx->stop_requested = true;
    }
}

JNIEXPORT void JNICALL
Java_com_tinyfacade_LlamaJNI_releaseModel(
    JNIEnv * /* env */,
    jobject /* this */,
    jlong handle
) {
    auto * inf_ctx = reinterpret_cast<inference_context *>(handle);
    if (inf_ctx) {
        if (inf_ctx->sampler) {
            llama_sampler_free(inf_ctx->sampler);
        }
        if (inf_ctx->ctx) {
            llama_free(inf_ctx->ctx);
        }
        if (inf_ctx->model) {
            llama_model_free(inf_ctx->model);
        }
        delete inf_ctx;
        LOGI("Model released");
    }
}

} // extern "C"
