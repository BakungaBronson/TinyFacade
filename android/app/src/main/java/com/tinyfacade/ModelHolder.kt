package com.tinyfacade

object ModelHolder {
    @Volatile var contextId: Int = -1
    @Volatile var modelPath: String? = null
    val isLoaded: Boolean get() = contextId >= 0 && modelPath != null

    @Volatile var pendingInferenceCallback: IInferenceCallback? = null
    @Volatile var pendingLoadCallback: IInferenceCallback? = null
    @Volatile var availableToolsJson: String? = null

    fun register(id: Int, path: String) {
        contextId = id
        modelPath = path
    }

    fun clear() {
        contextId = -1
        modelPath = null
    }
}
