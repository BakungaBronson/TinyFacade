package com.tinyfacade;

import android.os.Bundle;
import com.tinyfacade.IInferenceCallback;

interface IInferenceService {
    void loadModel(String path, in Bundle params, IInferenceCallback callback);
    void sendMessage(String messagesJson, in Bundle params, IInferenceCallback callback);
    boolean isModelLoaded();
    void stopGeneration();
    void releaseModel();
    List<String> getAvailableModels();
    String getLoadedModelPath();
}
