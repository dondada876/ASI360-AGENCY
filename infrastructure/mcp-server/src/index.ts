#!/usr/bin/env node

/**
 * ASI 360 Supabase MCP Server
 * Enables Claude Desktop to query ASI 360 business data via natural language
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment');
  process.exit(1);
}

// Initialize Supabase client
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Define available tools
const tools: Tool[] = [
  {
    name: 'get_dashboard_summary',
    description: 'Get CEO dashboard summary with all key metrics (ventures, tasks, revenue, priorities)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'query_clients',
    description: 'Query client data with optional filters (type, industry, MRR)',
    inputSchema: {
      type: 'object',
      properties: {
        client_type: {
          type: 'string',
          enum: ['prospect', 'active', 'inactive', 'churned'],
          description: 'Filter by client type',
        },
        industry: {
          type: 'string',
          description: 'Filter by industry',
        },
        min_mrr: {
          type: 'number',
          description: 'Minimum monthly recurring revenue',
        },
        limit: {
          type: 'number',
          default: 10,
          description: 'Maximum number of results',
        },
      },
    },
  },
  {
    name: 'query_revenue',
    description: 'Get revenue data and trends for a date range',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD)',
        },
        end_date: {
          type: 'string',
          description: 'End date (YYYY-MM-DD)',
        },
        group_by: {
          type: 'string',
          enum: ['day', 'week', 'month', 'service_line', 'client'],
          description: 'How to group the results',
        },
      },
    },
  },
  {
    name: 'query_pipeline',
    description: 'Get sales pipeline status and opportunities',
    inputSchema: {
      type: 'object',
      properties: {
        stage: {
          type: 'string',
          enum: ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed-won', 'closed-lost'],
          description: 'Filter by pipeline stage',
        },
        min_value: {
          type: 'number',
          description: 'Minimum opportunity value',
        },
        assigned_to: {
          type: 'string',
          description: 'Filter by assigned user email',
        },
      },
    },
  },
  {
    name: 'query_leads',
    description: 'Get leads with optional filters (status, source, score)',
    inputSchema: {
      type: 'object',
      properties: {
        lead_status: {
          type: 'string',
          enum: ['new', 'contacted', 'qualified', 'unqualified', 'converted', 'dead'],
          description: 'Filter by lead status',
        },
        lead_source: {
          type: 'string',
          description: 'Filter by lead source (website, referral, google-ads, etc.)',
        },
        min_score: {
          type: 'number',
          description: 'Minimum lead score (0-100)',
        },
        limit: {
          type: 'number',
          default: 20,
          description: 'Maximum number of results',
        },
      },
    },
  },
  {
    name: 'query_tasks',
    description: 'Get tasks with filters (priority, status, venture, department)',
    inputSchema: {
      type: 'object',
      properties: {
        priority: {
          type: 'string',
          enum: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
          description: 'Filter by priority level',
        },
        status: {
          type: 'string',
          enum: ['S1', 'S2', 'S3', 'S4', 'S5'],
          description: 'Filter by status',
        },
        venture_id: {
          type: 'string',
          description: 'Filter by venture UUID',
        },
        department_code: {
          type: 'string',
          description: 'Filter by department code (e.g., CH01.1)',
        },
        due_date: {
          type: 'string',
          description: 'Filter by due date (YYYY-MM-DD)',
        },
        limit: {
          type: 'number',
          default: 20,
          description: 'Maximum number of results',
        },
      },
    },
  },
  {
    name: 'query_ventures',
    description: 'Get venture portfolio health and metrics',
    inputSchema: {
      type: 'object',
      properties: {
        strategic_priority: {
          type: 'string',
          enum: ['core', 'growth', 'experimental', 'divest', 'shutdown'],
          description: 'Filter by strategic priority',
        },
        min_health_score: {
          type: 'number',
          description: 'Minimum health score (0-100)',
        },
      },
    },
  },
  {
    name: 'log_time',
    description: 'Log time spent on an activity',
    inputSchema: {
      type: 'object',
      properties: {
        duration_minutes: {
          type: 'number',
          description: 'Duration in minutes',
        },
        activity_type: {
          type: 'string',
          enum: ['deep_work', 'meetings', 'admin', 'family', 'health', 'legal'],
          description: 'Type of activity',
        },
        venture_id: {
          type: 'string',
          description: 'Related venture UUID (optional)',
        },
        department_code: {
          type: 'string',
          description: 'Department code (e.g., CH01.1)',
        },
        description: {
          type: 'string',
          description: 'Activity description',
        },
        productivity_rating: {
          type: 'number',
          minimum: 1,
          maximum: 5,
          description: 'How productive (1-5)',
        },
      },
      required: ['duration_minutes', 'activity_type', 'description'],
    },
  },
  {
    name: 'get_client_health',
    description: 'Get client health status including engagement and value metrics',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          default: 10,
          description: 'Maximum number of results',
        },
        health_status: {
          type: 'string',
          enum: ['healthy', 'check_in_needed', 'at_risk', 'needs_attention'],
          description: 'Filter by health status',
        },
      },
    },
  },
  {
    name: 'get_daily_metrics',
    description: 'Get daily aggregated metrics for a specific date',
    inputSchema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date (YYYY-MM-DD), defaults to yesterday',
        },
      },
    },
  },
];

// Create MCP server
const server = new Server(
  {
    name: 'asi360-supabase',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list_tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle call_tool request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_dashboard_summary': {
        const { data, error } = await supabase.rpc('get_ceo_dashboard_summary');
        if (error) throw error;
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'query_clients': {
        let query = supabase
          .from('clients')
          .select('*')
          .order('monthly_recurring_revenue', { ascending: false });

        if (args.client_type) {
          query = query.eq('client_type', args.client_type);
        }
        if (args.industry) {
          query = query.eq('industry', args.industry);
        }
        if (args.min_mrr) {
          query = query.gte('monthly_recurring_revenue', args.min_mrr);
        }
        query = query.limit(args.limit || 10);

        const { data, error } = await query;
        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'query_revenue': {
        const { data, error } = await supabase.rpc('get_revenue_summary', {
          start_date: args.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end_date: args.end_date || new Date().toISOString().split('T')[0],
        });
        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'query_pipeline': {
        let query = supabase
          .from('opportunities')
          .select('*')
          .order('weighted_value', { ascending: false });

        if (args.stage) {
          query = query.eq('stage', args.stage);
        }
        if (args.min_value) {
          query = query.gte('estimated_value', args.min_value);
        }
        if (args.assigned_to) {
          query = query.eq('assigned_to', args.assigned_to);
        }

        const { data, error } = await query;
        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'query_leads': {
        let query = supabase
          .from('leads')
          .select('*')
          .order('lead_score', { ascending: false });

        if (args.lead_status) {
          query = query.eq('lead_status', args.lead_status);
        }
        if (args.lead_source) {
          query = query.eq('lead_source', args.lead_source);
        }
        if (args.min_score) {
          query = query.gte('lead_score', args.min_score);
        }
        query = query.limit(args.limit || 20);

        const { data, error } = await query;
        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'query_tasks': {
        let query = supabase
          .from('master_tasks')
          .select('*')
          .order('priority_level')
          .order('due_date');

        if (args.priority) {
          query = query.eq('priority_level', args.priority);
        }
        if (args.status) {
          query = query.eq('status', args.status);
        }
        if (args.venture_id) {
          query = query.eq('venture_id', args.venture_id);
        }
        if (args.department_code) {
          query = query.eq('department_code', args.department_code);
        }
        if (args.due_date) {
          query = query.eq('due_date', args.due_date);
        }
        query = query.limit(args.limit || 20);

        const { data, error } = await query;
        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'query_ventures': {
        let query = supabase
          .from('v_portfolio_health')
          .select('*');

        if (args.strategic_priority) {
          query = query.eq('strategic_priority', args.strategic_priority);
        }
        if (args.min_health_score) {
          query = query.gte('health_score', args.min_health_score);
        }

        const { data, error } = await query;
        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'log_time': {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const currentTime = now.toISOString().split('T')[1].substring(0, 8);

        // Calculate end time
        const endTime = new Date(now.getTime() + (args.duration_minutes * 60000));
        const endTimeStr = endTime.toISOString().split('T')[1].substring(0, 8);

        const { data, error } = await supabase
          .from('ceo_time_log')
          .insert({
            log_date: today,
            time_block_start: currentTime,
            time_block_end: endTimeStr,
            duration_minutes: args.duration_minutes,
            activity_type: args.activity_type,
            venture_id: args.venture_id || null,
            department_code: args.department_code || null,
            activity_description: args.description,
            productivity_rating: args.productivity_rating || null,
          })
          .select()
          .single();

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: `Time logged successfully: ${args.duration_minutes} minutes of ${args.activity_type}\n${JSON.stringify(data, null, 2)}`,
            },
          ],
        };
      }

      case 'get_client_health': {
        let query = supabase
          .from('v_client_health')
          .select('*')
          .order('monthly_recurring_revenue', { ascending: false });

        if (args.health_status) {
          query = query.eq('contact_health', args.health_status);
        }
        query = query.limit(args.limit || 10);

        const { data, error } = await query;
        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'get_daily_metrics': {
        const targetDate = args.date || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('daily_metrics')
          .select('*')
          .eq('metric_date', targetDate)
          .single();

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ASI 360 Supabase MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
