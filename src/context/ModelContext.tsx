import React, {createContext, useContext, useEffect, useState} from 'react';
import {Platform} from 'react-native';
import {useModelStorage, type PersistedModel} from '../hooks/useModelStorage';
import {useModelScanner, type ScannedModel} from '../hooks/useModelScanner';
import {useLlama} from '../hooks/useLlama';
import {useServiceProxy} from '../hooks/useServiceProxy';
import {InferenceServiceBridge} from '../native/InferenceService';
import type {ChatMessage, ModelStatus} from '../types/chat';
import type {LlamaContext, NativeCompletionResult} from 'llama.rn';

type ModelContextValue = {
  // Model status
  modelStatus: ModelStatus;
  loadProgress: number;
  sendMessage: (
    messages: ChatMessage[],
    onToken: (token: string) => void,
  ) => Promise<NativeCompletionResult | null>;
  stopGeneration: () => void;
  getContext: () => LlamaContext | null;
  clearCacheIfNeeded: (sessionId: string) => Promise<void>;

  // Persisted model
  storageState: 'loading' | 'ready';
  persistedModel: PersistedModel | null;
  persistModel: (model: PersistedModel) => Promise<void>;
  clearPersistedModel: () => Promise<void>;

  // Scanner
  scanState: 'scanning' | 'done';
  models: ScannedModel[];
  selectedModel: ScannedModel | null;
  selectModel: (model: ScannedModel) => void;
  rescan: () => Promise<ScannedModel[]>;

  // Active model (resolved)
  activeModel: {name: string; path: string} | null;
  setActiveModel: (model: {name: string; path: string} | null) => void;
  resolvedModel: {name: string; path: string} | null;
};

const ModelContext = createContext<ModelContextValue | null>(null);

export function ModelProvider({children}: {children: React.ReactNode}) {
  const {storageState, persistedModel, persistModel, clearPersistedModel} =
    useModelStorage();
  const {scanState, models, selectedModel, selectModel, rescan} =
    useModelScanner();

  const [activeModel, setActiveModel] = useState<{
    name: string;
    path: string;
  } | null>(null);

  // Derive the model path to load — persisted takes priority
  const resolvedModel = activeModel ?? persistedModel;
  const modelPath = resolvedModel?.path ?? null;

  const {modelStatus, loadProgress, sendMessage, stopGeneration, getContext, clearCacheIfNeeded} =
    useLlama(modelPath);

  // Start foreground service on mount (Android only)
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    InferenceServiceBridge.startService();
    InferenceServiceBridge.bindToService();
    return () => {
      InferenceServiceBridge.unbindFromService();
    };
  }, []);

  // Proxy external AIDL requests through llama.rn
  useServiceProxy(getContext);

  const value: ModelContextValue = {
    modelStatus,
    loadProgress,
    sendMessage,
    stopGeneration,
    getContext,
    clearCacheIfNeeded,
    storageState,
    persistedModel,
    persistModel,
    clearPersistedModel,
    scanState,
    models,
    selectedModel,
    selectModel,
    rescan,
    activeModel,
    setActiveModel,
    resolvedModel,
  };

  return (
    <ModelContext.Provider value={value}>{children}</ModelContext.Provider>
  );
}

export function useModel(): ModelContextValue {
  const ctx = useContext(ModelContext);
  if (!ctx) {
    throw new Error('useModel must be used within a ModelProvider');
  }
  return ctx;
}
