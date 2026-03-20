import {useCallback, useEffect, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {TOOL_DEFINITIONS} from '../constants/toolDefinitions';
import type {ToolDefinition} from '../types/tools';

const STORAGE_KEY = '@tinyfacade/tool_settings';

type ToolSettings = {
  globalEnabled: boolean;
  enabledTools: Record<string, boolean>;
};

const DEFAULT_SETTINGS: ToolSettings = {
  globalEnabled: false,
  enabledTools: {},
};

export function useToolSettings() {
  const [settings, setSettings] = useState<ToolSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: ToolSettings = JSON.parse(raw);
          // Merge with current TOOL_DEFINITIONS — new tools default to enabled
          const merged: Record<string, boolean> = {};
          for (const tool of TOOL_DEFINITIONS) {
            const name = tool.function.name;
            merged[name] =
              name in parsed.enabledTools ? parsed.enabledTools[name] : true;
          }
          setSettings({
            globalEnabled: parsed.globalEnabled,
            enabledTools: merged,
          });
        } else {
          // First run — all tools enabled by default
          const enabledTools: Record<string, boolean> = {};
          for (const tool of TOOL_DEFINITIONS) {
            enabledTools[tool.function.name] = true;
          }
          setSettings({globalEnabled: false, enabledTools});
        }
      } catch (err) {
        console.warn('[ToolSettings] Failed to load:', err);
      } finally {
        setLoaded(true);
      }
    }
    load();
  }, []);

  const persist = useCallback(async (next: ToolSettings) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn('[ToolSettings] Failed to persist:', err);
    }
  }, []);

  const toggleGlobal = useCallback(() => {
    setSettings(prev => {
      const next = {...prev, globalEnabled: !prev.globalEnabled};
      persist(next);
      return next;
    });
  }, [persist]);

  const toggleTool = useCallback(
    (toolName: string) => {
      setSettings(prev => {
        const next = {
          ...prev,
          enabledTools: {
            ...prev.enabledTools,
            [toolName]: !prev.enabledTools[toolName],
          },
        };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const isToolEnabled = useCallback(
    (toolName: string): boolean => {
      return settings.enabledTools[toolName] ?? true;
    },
    [settings.enabledTools],
  );

  const getEnabledTools = useCallback((): ToolDefinition[] => {
    if (!settings.globalEnabled) {
      return [];
    }
    return TOOL_DEFINITIONS.filter(
      t => settings.enabledTools[t.function.name] !== false,
    );
  }, [settings]);

  return {
    globalEnabled: settings.globalEnabled,
    enabledTools: settings.enabledTools,
    loaded,
    toggleGlobal,
    toggleTool,
    isToolEnabled,
    getEnabledTools,
  };
}
