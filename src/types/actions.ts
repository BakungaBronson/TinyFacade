// Step 3: Action type definitions for the five execution primitives

export type HttpAction = {
  type: 'http';
  config: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    url_template: string;
    headers?: Record<string, string>;
    body_template?: string;
    timeout_ms?: number;
  };
};

export type SystemAction = {
  type: 'system';
  config: {
    query: 'battery' | 'network' | 'location' | 'storage' | 'device_info';
  };
};

export type IntentAction = {
  type: 'intent';
  config: {
    action: string;
    uri_template?: string;
    extras?: Record<string, string>;
    type?: string;
  };
};

export type ContentResolverAction = {
  type: 'content_resolver';
  config: {
    uri: string;
    projection?: string[];
    selection?: string;
    selection_args?: string[];
    sort_order?: string;
  };
};

export type FileAction = {
  type: 'file';
  config: {
    operation: 'read' | 'write' | 'list' | 'exists';
    path_template: string;
    content_template?: string;
  };
};

export type ActionDefinition =
  | HttpAction
  | SystemAction
  | IntentAction
  | ContentResolverAction
  | FileAction;
