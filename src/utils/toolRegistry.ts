// Step 5: Module-level singleton tool registry

import type {ToolDefinition} from '../types/tools';
import type {ActionDefinition} from '../types/actions';
import {TOOL_DEFINITIONS} from '../constants/toolDefinitions';
import {executeTool} from './toolExecutor';
import {executeAction} from './actionExecutor';

type ExternalTool = {
  definition: ToolDefinition;
  action: ActionDefinition;
};

const builtInNames = new Set(TOOL_DEFINITIONS.map(t => t.function.name));
const externalTools = new Map<string, ExternalTool>();

export const toolRegistry = {
  /**
   * Register an external tool with an action-based executor.
   * Built-in tool names cannot be overridden.
   */
  register(definition: ToolDefinition, action: ActionDefinition): boolean {
    const name = definition.function.name;
    if (builtInNames.has(name)) {
      console.warn(
        `[toolRegistry] Cannot override built-in tool: ${name}`,
      );
      return false;
    }
    externalTools.set(name, {definition, action});
    console.warn(`[toolRegistry] Registered external tool: ${name}`);
    return true;
  },

  /**
   * Unregister an external tool. Built-in tools are protected.
   */
  unregister(toolName: string): boolean {
    if (builtInNames.has(toolName)) {
      console.warn(
        `[toolRegistry] Cannot unregister built-in tool: ${toolName}`,
      );
      return false;
    }
    const removed = externalTools.delete(toolName);
    if (removed) {
      console.warn(`[toolRegistry] Unregistered external tool: ${toolName}`);
    }
    return removed;
  },

  /**
   * Get all tool definitions (built-in + external).
   */
  getAllDefinitions(): ToolDefinition[] {
    const external = Array.from(externalTools.values()).map(t => t.definition);
    return [...TOOL_DEFINITIONS, ...external];
  },

  /**
   * Execute a tool by name. Built-in tools use executeTool(),
   * external tools use executeAction().
   */
  async execute(toolName: string, argsJson: string): Promise<string> {
    // Check built-in first
    if (builtInNames.has(toolName)) {
      return executeTool(toolName, argsJson);
    }

    // Check external
    const ext = externalTools.get(toolName);
    if (ext) {
      return executeAction(ext.action, argsJson);
    }

    return JSON.stringify({error: `Unknown tool: ${toolName}`});
  },
};
