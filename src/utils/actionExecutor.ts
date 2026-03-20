// Step 4: Action executor with {{param}} template interpolation

import {Platform} from 'react-native';
import {
  ExternalDirectoryPath,
  readFile,
  writeFile,
  readDir,
  exists,
  mkdir,
} from '@dr.pogodin/react-native-fs';
import type {ActionDefinition} from '../types/actions';

const SANDBOX_ROOT = `${ExternalDirectoryPath}/tinyfacade-tools`;

/**
 * Interpolate {{param}} placeholders in a template string with values from args.
 */
function interpolate(
  template: string,
  args: Record<string, any>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const val = args[key];
    return val !== undefined ? String(val) : '';
  });
}

/**
 * Validate and sandbox a file path — block path traversal.
 */
function sandboxPath(pathTemplate: string, args: Record<string, any>): string {
  const resolved = interpolate(pathTemplate, args);
  // Block path traversal
  if (resolved.includes('..')) {
    throw new Error('Path traversal not allowed');
  }
  // All paths relative to sandbox root
  const full = resolved.startsWith('/')
    ? resolved
    : `${SANDBOX_ROOT}/${resolved}`;
  if (!full.startsWith(SANDBOX_ROOT)) {
    throw new Error(`Path must be within ${SANDBOX_ROOT}`);
  }
  return full;
}

async function executeHttp(
  config: ActionDefinition & {type: 'http'},
  args: Record<string, any>,
): Promise<string> {
  const {method, url_template, headers, body_template, timeout_ms} =
    config.config;
  const url = interpolate(url_template, args);
  const body = body_template ? interpolate(body_template, args) : undefined;

  const controller = new AbortController();
  const timeout = timeout_ms || 10000;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const resp = await fetch(url, {
      method,
      headers: headers || undefined,
      body: method !== 'GET' ? body : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await resp.text();
    // Try to parse as JSON for cleaner output
    try {
      const json = JSON.parse(text);
      return JSON.stringify(json);
    } catch {
      return text.slice(0, 4096); // cap raw text
    }
  } catch (err: any) {
    clearTimeout(timer);
    return JSON.stringify({error: err.message || 'HTTP request failed'});
  }
}

async function executeFile(
  config: ActionDefinition & {type: 'file'},
  args: Record<string, any>,
): Promise<string> {
  const {operation, path_template, content_template} = config.config;
  const path = sandboxPath(path_template, args);

  // Ensure sandbox dir exists
  const sandboxExists = await exists(SANDBOX_ROOT);
  if (!sandboxExists) {
    await mkdir(SANDBOX_ROOT);
  }

  switch (operation) {
    case 'read': {
      const content = await readFile(path, 'utf8');
      return content;
    }
    case 'write': {
      const content = content_template
        ? interpolate(content_template, args)
        : args.content || '';
      await writeFile(path, content, 'utf8');
      return JSON.stringify({success: true, path});
    }
    case 'list': {
      const items = await readDir(path);
      return JSON.stringify(
        items.map(i => ({name: i.name, size: i.size, isDir: i.isDirectory()})),
      );
    }
    case 'exists': {
      const found = await exists(path);
      return JSON.stringify({exists: found, path});
    }
    default:
      return JSON.stringify({error: `Unknown file operation: ${operation}`});
  }
}

async function executeSystem(
  config: ActionDefinition & {type: 'system'},
): Promise<string> {
  const {query} = config.config;
  switch (query) {
    case 'device_info':
      return JSON.stringify({
        platform: Platform.OS,
        version: Platform.Version,
        isTV: Platform.isTV,
      });
    case 'battery':
    case 'network':
    case 'location':
    case 'storage':
      return JSON.stringify({
        error: `System query '${query}' is not yet implemented`,
        stub: true,
      });
    default:
      return JSON.stringify({error: `Unknown system query: ${query}`});
  }
}

async function executeIntent(
  _config: ActionDefinition & {type: 'intent'},
  _args: Record<string, any>,
): Promise<string> {
  return JSON.stringify({
    error: 'Intent actions require a native module (not yet implemented)',
    stub: true,
  });
}

async function executeContentResolver(
  _config: ActionDefinition & {type: 'content_resolver'},
  _args: Record<string, any>,
): Promise<string> {
  return JSON.stringify({
    error:
      'Content resolver actions require a native module (not yet implemented)',
    stub: true,
  });
}

/**
 * Execute an action definition with the given tool arguments.
 */
export async function executeAction(
  action: ActionDefinition,
  argsJson: string,
): Promise<string> {
  let args: Record<string, any> = {};
  try {
    if (argsJson && argsJson.trim()) {
      args = JSON.parse(argsJson);
    }
  } catch {
    return JSON.stringify({error: 'Failed to parse action arguments'});
  }

  try {
    switch (action.type) {
      case 'http':
        return await executeHttp(action as any, args);
      case 'file':
        return await executeFile(action as any, args);
      case 'system':
        return await executeSystem(action as any);
      case 'intent':
        return await executeIntent(action as any, args);
      case 'content_resolver':
        return await executeContentResolver(action as any, args);
      default:
        return JSON.stringify({
          error: `Unknown action type: ${(action as any).type}`,
        });
    }
  } catch (err: any) {
    return JSON.stringify({error: err.message || 'Action execution failed'});
  }
}
