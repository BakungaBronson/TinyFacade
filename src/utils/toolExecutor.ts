import {Platform} from 'react-native';

type ToolExecutorFn = (args: Record<string, any>) => Promise<string>;

function safeEval(expression: string): number {
  // Only allow safe math characters
  const sanitized = expression.replace(/[^0-9+\-*/().%\s^]/g, '');
  if (sanitized !== expression.trim()) {
    throw new Error('Invalid characters in expression');
  }
  // Replace ^ with ** for exponentiation
  const expr = sanitized.replace(/\^/g, '**');
  // Use Function constructor to evaluate safely
  return new Function(`"use strict"; return (${expr})`)() as number;
}

const executors: Record<string, ToolExecutorFn> = {
  get_current_time: async (args) => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    };
    if (args.timezone) {
      options.timeZone = args.timezone;
    }
    const formatted = now.toLocaleString(undefined, options);
    return JSON.stringify({
      formatted,
      iso: now.toISOString(),
      timestamp: now.getTime(),
    });
  },

  get_device_info: async () => {
    return JSON.stringify({
      platform: Platform.OS,
      version: Platform.Version,
      isTV: Platform.isTV,
    });
  },

  calculate: async (args) => {
    const expression = args.expression;
    if (!expression) {
      return JSON.stringify({error: 'No expression provided'});
    }
    try {
      const result = safeEval(expression);
      return JSON.stringify({expression, result});
    } catch (err: any) {
      return JSON.stringify({error: err.message || 'Failed to evaluate'});
    }
  },

  search_contacts: async (args) => {
    // Mock implementation
    const query = (args.query || '').toLowerCase();
    const mockContacts = [
      {name: 'Alice Johnson', phone: '+1-555-0101'},
      {name: 'Bob Smith', phone: '+1-555-0102'},
      {name: 'Charlie Brown', phone: '+1-555-0103'},
      {name: 'Diana Prince', phone: '+1-555-0104'},
      {name: 'Eve Wilson', phone: '+1-555-0105'},
    ];
    const matches = mockContacts.filter(c =>
      c.name.toLowerCase().includes(query),
    );
    return JSON.stringify({
      query: args.query,
      results: matches,
      note: 'Mock data — contact access not yet implemented',
    });
  },

  get_calendar_events: async (args) => {
    // Mock implementation
    const days = parseInt(args.days || '7', 10);
    const now = new Date();
    const mockEvents = [
      {
        title: 'Team Standup',
        date: new Date(now.getTime() + 86400000).toISOString(),
        duration: '30 min',
      },
      {
        title: 'Project Review',
        date: new Date(now.getTime() + 172800000).toISOString(),
        duration: '1 hour',
      },
      {
        title: 'Lunch with Alex',
        date: new Date(now.getTime() + 259200000).toISOString(),
        duration: '1 hour',
      },
    ];
    return JSON.stringify({
      days,
      events: mockEvents.filter(
        e => new Date(e.date).getTime() <= now.getTime() + days * 86400000,
      ),
      note: 'Mock data — calendar access not yet implemented',
    });
  },
};

export async function executeTool(
  toolName: string,
  argsJson: string,
): Promise<string> {
  const executor = executors[toolName];
  if (!executor) {
    return JSON.stringify({error: `Unknown tool: ${toolName}`});
  }

  let args: Record<string, any> = {};
  try {
    if (argsJson && argsJson.trim()) {
      args = JSON.parse(argsJson);
    }
  } catch {
    return JSON.stringify({error: 'Failed to parse tool arguments'});
  }

  return executor(args);
}
