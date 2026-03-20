import {
  NativeModules,
  NativeEventEmitter,
  Platform,
  type EmitterSubscription,
} from 'react-native';

const {InferenceServiceModule} = NativeModules;

const eventEmitter =
  Platform.OS === 'android' && InferenceServiceModule
    ? new NativeEventEmitter(InferenceServiceModule)
    : null;

export interface CompletionResult {
  response: string;
  timings: string;
}

export interface ModelParams {
  n_ctx?: number;
  n_gpu_layers?: number;
}

export interface InferenceParams {
  n_predict?: number;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string;
}

export interface ExternalInferenceRequest {
  messagesJson: string;
  nPredict: number;
  temperature: number;
  topP: number;
  stopSequences: string;
}

export interface ExternalLoadRequest {
  path: string;
  nCtx: number;
  nGpuLayers: number;
}

/**
 * TypeScript wrapper for the InferenceService native module.
 * Only available on Android.
 */
export const InferenceServiceBridge = {
  /**
   * Start the foreground inference service.
   * Shows a persistent notification.
   */
  async startService(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.warn('InferenceService is only available on Android');
      return false;
    }
    return InferenceServiceModule.startService();
  },

  /**
   * Stop the foreground inference service.
   */
  async stopService(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    return InferenceServiceModule.stopService();
  },

  /**
   * Check if the service is currently running.
   */
  async isServiceRunning(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    return InferenceServiceModule.isServiceRunning();
  },

  /**
   * Bind to the inference service to get access to AIDL methods.
   * Must be called after startService().
   */
  async bindToService(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    return InferenceServiceModule.bindToService();
  },

  /**
   * Unbind from the inference service.
   */
  async unbindFromService(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    return InferenceServiceModule.unbindFromService();
  },

  /**
   * Load a model from the given path.
   * Must be bound to the service first.
   */
  async loadModel(
    path: string,
    params?: ModelParams,
  ): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    return InferenceServiceModule.loadModel(path, params ?? {});
  },

  /**
   * Send a message for inference.
   * Emits 'onToken' events during generation and resolves with the complete result.
   */
  async sendMessage(
    messagesJson: string,
    params?: InferenceParams,
  ): Promise<CompletionResult> {
    if (Platform.OS !== 'android') {
      return {response: '', timings: '{}'};
    }
    return InferenceServiceModule.sendMessage(messagesJson, params ?? {});
  },

  /**
   * Get a list of available .gguf model file paths on device.
   * Scans app external files dir and Downloads folder.
   */
  async getAvailableModels(): Promise<string[]> {
    if (Platform.OS !== 'android') {
      return [];
    }
    return InferenceServiceModule.getAvailableModels();
  },

  /**
   * Check if a model is currently loaded.
   */
  async isModelLoaded(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    return InferenceServiceModule.isModelLoaded();
  },

  /**
   * Stop an in-progress generation.
   */
  async stopGeneration(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    return InferenceServiceModule.stopGeneration();
  },

  /**
   * Release the currently loaded model and free memory.
   */
  async releaseModel(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    return InferenceServiceModule.releaseModel();
  },

  // --- Model registration (llama.rn context → native ModelHolder) ---

  async registerModel(contextId: number, path: string): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    return InferenceServiceModule.registerModel(contextId, path);
  },

  async unregisterModel(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    return InferenceServiceModule.unregisterModel();
  },

  async getLoadedModelPath(): Promise<string> {
    if (Platform.OS !== 'android') {
      return '';
    }
    return InferenceServiceModule.getLoadedModelPath();
  },

  // --- Delivery methods (JS → AIDL callback) ---

  deliverToken(token: string): void {
    if (Platform.OS !== 'android') {
      return;
    }
    InferenceServiceModule.deliverToken(token);
  },

  deliverComplete(response: string, timings: string): void {
    if (Platform.OS !== 'android') {
      return;
    }
    InferenceServiceModule.deliverComplete(response, timings);
  },

  deliverError(message: string): void {
    if (Platform.OS !== 'android') {
      return;
    }
    InferenceServiceModule.deliverError(message);
  },

  deliverModelLoaded(success: boolean): void {
    if (Platform.OS !== 'android') {
      return;
    }
    InferenceServiceModule.deliverModelLoaded(success);
  },

  // --- Existing event listeners ---

  addTokenListener(callback: (token: string) => void): EmitterSubscription | null {
    if (!eventEmitter) {
      return null;
    }
    return eventEmitter.addListener('onToken', callback);
  },

  addCompletionListener(
    callback: (result: CompletionResult) => void,
  ): EmitterSubscription | null {
    if (!eventEmitter) {
      return null;
    }
    return eventEmitter.addListener('onComplete', callback);
  },

  addModelLoadedListener(
    callback: (success: boolean) => void,
  ): EmitterSubscription | null {
    if (!eventEmitter) {
      return null;
    }
    return eventEmitter.addListener('onModelLoaded', callback);
  },

  addErrorListener(
    callback: (message: string) => void,
  ): EmitterSubscription | null {
    if (!eventEmitter) {
      return null;
    }
    return eventEmitter.addListener('onError', callback);
  },

  // --- External AIDL request listeners ---

  addExternalInferenceRequestListener(
    callback: (request: ExternalInferenceRequest) => void,
  ): EmitterSubscription | null {
    if (!eventEmitter) {
      return null;
    }
    return eventEmitter.addListener('onExternalInferenceRequest', callback);
  },

  addExternalLoadRequestListener(
    callback: (request: ExternalLoadRequest) => void,
  ): EmitterSubscription | null {
    if (!eventEmitter) {
      return null;
    }
    return eventEmitter.addListener('onExternalLoadRequest', callback);
  },

  addExternalStopRequestListener(
    callback: () => void,
  ): EmitterSubscription | null {
    if (!eventEmitter) {
      return null;
    }
    return eventEmitter.addListener('onExternalStopRequest', callback);
  },

  addExternalReleaseRequestListener(
    callback: () => void,
  ): EmitterSubscription | null {
    if (!eventEmitter) {
      return null;
    }
    return eventEmitter.addListener('onExternalReleaseRequest', callback);
  },
};
