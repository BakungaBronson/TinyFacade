import type {ToolDefinition} from '../types/tools';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description:
        'Get the current date and time in the specified timezone or the device local timezone.',
      parameters: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description:
              'IANA timezone name (e.g. "America/New_York"). Defaults to device local time.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_device_info',
      description:
        'Get information about the current device (platform, OS version, etc.).',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate',
      description:
        'Evaluate a mathematical expression and return the result. Supports basic arithmetic (+, -, *, /, **, %).',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description:
              'The mathematical expression to evaluate (e.g. "2 + 3 * 4").',
          },
        },
        required: ['expression'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_contacts',
      description:
        'Search for contacts by name. Returns matching contact names and phone numbers.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The name or partial name to search for.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_calendar_events',
      description:
        'Get upcoming calendar events for the specified number of days.',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'string',
            description:
              'Number of days ahead to look for events (default: "7").',
          },
        },
      },
    },
  },
];
