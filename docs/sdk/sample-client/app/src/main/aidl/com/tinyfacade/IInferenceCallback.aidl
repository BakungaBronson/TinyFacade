package com.tinyfacade;

oneway interface IInferenceCallback {
    void onToken(String token);
    void onComplete(String response, String timingsJson);
    void onError(String message);
    void onModelLoaded(boolean success);
}
