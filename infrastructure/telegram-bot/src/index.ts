/**
 * ASI 360 Telegram Bot
 * Mobile access to business intelligence and data
 */

import { Telegraf, Context } from 'telegraf';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const AUTHORIZED_USER_ID = process.env.AUTHORIZED_USER_ID;

if (!TELEGRAM_BOT_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Required environment variables not set');
  console.error('Required: TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Initialize clients
const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

// Authorization middleware
const authorize = (ctx: Context, next: () => Promise<void>) => {
  if (AUTHORIZED_USER_ID && ctx.from?.id.toString() !== AUTHORIZED_USER_ID) {
    ctx.reply('⛔ Unauthorized. This bot is for ASI 360 CEO use only.');
    return;
  }
  return next();
};

// Helper: Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Helper: Format date
const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// =============================================================================
// COMMAND: /start
// =============================================================================

bot.command('start', authorize, async (ctx) => {
  const welcomeMessage = `
🚀 *ASI 360 Intelligence Bot*

Your mobile command center for business data.

*Quick Commands:*
/dashboard - CEO summary
/revenue [period] - Revenue data
/pipeline - Sales opportunities
/leads - Recent leads
/tasks [priority] - Task list
/clients - Client list
/ventures - Portfolio health
/log [time] [activity] - Log time

*Natural Language:*
Just type your question:
• "How many leads today?"
• "Show me at-risk clients"
• "What's my revenue this week?"

Type /help for full command list.
  `;
  ctx.replyWithMarkdown(welcomeMessage);
});

// =============================================================================
// COMMAND: /help
// =============================================================================

bot.command('help', authorize, async (ctx) => {
  const helpMessage = `
📚 *ASI 360 Bot Commands*

*Dashboard & Overview:*
/dashboard - Full CEO dashboard summary
/ventures - Portfolio health across all ventures

*Sales & Revenue:*
/revenue [today|week|month|year] - Revenue summary
/pipeline - Current sales pipeline
/leads [status] - Lead list
/clients [type] - Client list

*Tasks & Time:*
/tasks [P1|P2|P3] - Task list by priority
/today - Today's priorities
/log <time> <activity> - Log time spent

*Analytics:*
/metrics [date] - Daily metrics
/health - Client health status

*Natural Language:*
Ask anything about your business:
• "How many meetings do I have?"
• "Which clients need follow-up?"
• "Show me yesterday's metrics"
• "What's my MRR?"

The bot uses AI to understand your questions.
  `;
  ctx.replyWithMarkdown(helpMessage);
});

// =============================================================================
// COMMAND: /dashboard
// =============================================================================

bot.command('dashboard', authorize, async (ctx) => {
  try {
    const { data, error } = await supabase.rpc('get_ceo_dashboard_summary');

    if (error) throw error;

    const summary = data[0];

    const message = `
📊 *CEO Dashboard Summary*

*Portfolio:*
• Ventures: ${summary.total_ventures} (${summary.healthy_ventures} healthy, ${summary.critical_ventures} critical)

*Tasks:*
• P1 Tasks: ${summary.total_p1_tasks}
• Overdue: ${summary.overdue_tasks}
• Today's Priorities: ${summary.today_priorities}

*Revenue:*
• This Week: ${formatCurrency(summary.weekly_revenue)}

*Personal:*
• Time with Ashé Today: ${Math.round(summary.ashe_time_today / 60)}h ${summary.ashe_time_today % 60}m
• This Week: ${Math.round(summary.ashe_time_week / 60)}h ${summary.ashe_time_week % 60}m

*Legal Fund:*
• Balance: ${formatCurrency(summary.legal_fund)}

_Updated: ${new Date().toLocaleString()}_
    `;

    ctx.replyWithMarkdown(message);
  } catch (error) {
    console.error('Dashboard error:', error);
    ctx.reply(`❌ Error fetching dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// =============================================================================
// COMMAND: /revenue
// =============================================================================

bot.command('revenue', authorize, async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    const period = args[1] || 'month';

    let startDate: string;
    const today = new Date();

    switch (period.toLowerCase()) {
      case 'today':
        startDate = today.toISOString().split('T')[0];
        break;
      case 'week':
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate = weekAgo.toISOString().split('T')[0];
        break;
      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        startDate = monthStart.toISOString().split('T')[0];
        break;
      case 'year':
        const yearStart = new Date(today.getFullYear(), 0, 1);
        startDate = yearStart.toISOString().split('T')[0];
        break;
      default:
        startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    }

    const endDate = today.toISOString().split('T')[0];

    const { data, error } = await supabase.rpc('get_revenue_summary', {
      start_date: startDate,
      end_date: endDate,
    });

    if (error) throw error;

    const summary = data[0];

    const message = `
💰 *Revenue Summary* (${period})

*Total Revenue:* ${formatCurrency(summary.total_revenue)}
• Recurring: ${formatCurrency(summary.recurring_revenue)}
• One-time: ${formatCurrency(summary.one_time_revenue)}

*Transactions:* ${summary.transaction_count}

_Period: ${formatDate(startDate)} - ${formatDate(endDate)}_
    `;

    ctx.replyWithMarkdown(message);
  } catch (error) {
    console.error('Revenue error:', error);
    ctx.reply(`❌ Error fetching revenue: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// =============================================================================
// COMMAND: /pipeline
// =============================================================================

bot.command('pipeline', authorize, async (ctx) => {
  try {
    const { data, error } = await supabase
      .from('v_sales_pipeline')
      .select('*');

    if (error) throw error;

    let message = '🎯 *Sales Pipeline*\n\n';

    if (!data || data.length === 0) {
      message += '_No opportunities in pipeline_';
    } else {
      for (const stage of data) {
        message += `*${stage.stage}*\n`;
        message += `• Opportunities: ${stage.opportunity_count}\n`;
        message += `• Total Value: ${formatCurrency(stage.total_value)}\n`;
        message += `• Weighted: ${formatCurrency(stage.weighted_value)}\n`;
        message += `• Avg Probability: ${Math.round(stage.avg_probability)}%\n\n`;
      }

      const totalValue = data.reduce((sum, stage) => sum + parseFloat(stage.total_value), 0);
      const totalWeighted = data.reduce((sum, stage) => sum + parseFloat(stage.weighted_value), 0);

      message += `*TOTAL*\n`;
      message += `• Total Value: ${formatCurrency(totalValue)}\n`;
      message += `• Weighted Value: ${formatCurrency(totalWeighted)}`;
    }

    ctx.replyWithMarkdown(message);
  } catch (error) {
    console.error('Pipeline error:', error);
    ctx.reply(`❌ Error fetching pipeline: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// =============================================================================
// COMMAND: /leads
// =============================================================================

bot.command('leads', authorize, async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    const status = args[1] || 'new';

    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('lead_status', status)
      .order('lead_score', { ascending: false })
      .limit(10);

    if (error) throw error;

    let message = `📋 *Leads* (${status})\n\n`;

    if (!data || data.length === 0) {
      message += `_No ${status} leads found_`;
    } else {
      for (const lead of data) {
        message += `*${lead.full_name}* - ${lead.company_name || 'No company'}\n`;
        message += `• Score: ${lead.lead_score}/100\n`;
        message += `• Source: ${lead.lead_source}\n`;
        message += `• Email: ${lead.email}\n\n`;
      }
    }

    ctx.replyWithMarkdown(message);
  } catch (error) {
    console.error('Leads error:', error);
    ctx.reply(`❌ Error fetching leads: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// =============================================================================
// COMMAND: /tasks
// =============================================================================

bot.command('tasks', authorize, async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    const priority = args[1] || 'P1';

    const { data, error } = await supabase
      .from('master_tasks')
      .select('*')
      .eq('priority_level', priority)
      .in('status', ['S1', 'S2', 'S3'])
      .order('due_date')
      .limit(15);

    if (error) throw error;

    let message = `✅ *Tasks* (${priority})\n\n`;

    if (!data || data.length === 0) {
      message += `_No ${priority} tasks found_`;
    } else {
      for (const task of data) {
        const emoji = task.status === 'S1' ? '⏸' : task.status === 'S2' ? '🔄' : '✓';
        message += `${emoji} *${task.task_identifier}*\n`;
        message += `${task.task_description}\n`;
        if (task.due_date) {
          message += `Due: ${formatDate(task.due_date)}\n`;
        }
        message += `Pomodoros: ${task.pomodoros_completed}/${task.pomodoros_total}\n\n`;
      }
    }

    ctx.replyWithMarkdown(message);
  } catch (error) {
    console.error('Tasks error:', error);
    ctx.reply(`❌ Error fetching tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// =============================================================================
// COMMAND: /clients
// =============================================================================

bot.command('clients', authorize, async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    const clientType = args[1] || 'active';

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('client_type', clientType)
      .order('monthly_recurring_revenue', { ascending: false })
      .limit(10);

    if (error) throw error;

    let message = `👥 *Clients* (${clientType})\n\n`;

    if (!data || data.length === 0) {
      message += `_No ${clientType} clients found_`;
    } else {
      for (const client of data) {
        message += `*${client.company_name}*\n`;
        message += `• MRR: ${formatCurrency(client.monthly_recurring_revenue || 0)}\n`;
        message += `• LTV: ${formatCurrency(client.lifetime_value || 0)}\n`;
        if (client.industry) {
          message += `• Industry: ${client.industry}\n`;
        }
        message += `\n`;
      }
    }

    ctx.replyWithMarkdown(message);
  } catch (error) {
    console.error('Clients error:', error);
    ctx.reply(`❌ Error fetching clients: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// =============================================================================
// COMMAND: /ventures
// =============================================================================

bot.command('ventures', authorize, async (ctx) => {
  try {
    const { data, error } = await supabase
      .from('v_portfolio_health')
      .select('*');

    if (error) throw error;

    let message = '🏢 *Venture Portfolio*\n\n';

    if (!data || data.length === 0) {
      message += '_No ventures found_';
    } else {
      for (const venture of data) {
        const statusEmoji = venture.health_status === 'healthy' ? '🟢' :
                           venture.health_status === 'caution' ? '🟡' : '🔴';

        message += `${statusEmoji} *${venture.venture_name}*\n`;
        message += `• Health: ${venture.health_score}/100\n`;
        message += `• Stage: ${venture.venture_stage}\n`;
        message += `• ARR: ${formatCurrency(venture.current_arr || 0)}\n`;
        message += `• Critical Tasks: ${venture.critical_tasks}\n`;
        if (venture.overdue_tasks > 0) {
          message += `• ⚠️ Overdue: ${venture.overdue_tasks}\n`;
        }
        message += `\n`;
      }
    }

    ctx.replyWithMarkdown(message);
  } catch (error) {
    console.error('Ventures error:', error);
    ctx.reply(`❌ Error fetching ventures: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// =============================================================================
// COMMAND: /log
// =============================================================================

bot.command('log', authorize, async (ctx) => {
  try {
    const args = ctx.message.text.split(' ').slice(1);

    if (args.length < 2) {
      ctx.reply('Usage: /log <duration> <activity>\nExample: /log 90 family time with Ashé');
      return;
    }

    const duration = parseInt(args[0]);
    const activity = args.slice(1).join(' ');

    if (isNaN(duration) || duration <= 0) {
      ctx.reply('⚠️ Duration must be a positive number (in minutes)');
      return;
    }

    // Determine activity type from keywords
    let activityType = 'admin';
    if (activity.toLowerCase().includes('ashé') || activity.toLowerCase().includes('family')) {
      activityType = 'family';
    } else if (activity.toLowerCase().includes('health') || activity.toLowerCase().includes('exercise')) {
      activityType = 'health';
    } else if (activity.toLowerCase().includes('meeting')) {
      activityType = 'meetings';
    } else if (activity.toLowerCase().includes('legal')) {
      activityType = 'legal';
    } else if (activity.toLowerCase().includes('dev') || activity.toLowerCase().includes('code')) {
      activityType = 'deep_work';
    }

    const now = new Date();
    const endTime = new Date(now.getTime() + duration * 60000);

    const { error } = await supabase
      .from('ceo_time_log')
      .insert({
        log_date: now.toISOString().split('T')[0],
        time_block_start: now.toISOString().split('T')[1].substring(0, 8),
        time_block_end: endTime.toISOString().split('T')[1].substring(0, 8),
        duration_minutes: duration,
        activity_type: activityType,
        activity_description: activity,
      });

    if (error) throw error;

    ctx.reply(`✅ Logged ${duration} minutes of ${activityType}: ${activity}`);
  } catch (error) {
    console.error('Log error:', error);
    ctx.reply(`❌ Error logging time: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// =============================================================================
// NATURAL LANGUAGE HANDLER
// =============================================================================

bot.on('text', authorize, async (ctx) => {
  const query = ctx.message.text;

  // Skip if it's a command
  if (query.startsWith('/')) return;

  // If no Anthropic API key, provide helpful message
  if (!anthropic) {
    ctx.reply('⚠️ Natural language queries require ANTHROPIC_API_KEY to be configured.\nUse /help to see available commands.');
    return;
  }

  try {
    ctx.reply('🤔 Processing your question...');

    // Use Claude to interpret and route the query
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: `You are a helpful assistant for ASI 360 business data queries.
      Based on the user's question, respond with a concise answer and suggest which command they should use.
      Available commands: /dashboard, /revenue, /pipeline, /leads, /tasks, /clients, /ventures, /log

      If the question is about general information, answer it directly.
      If it requires specific data, suggest the appropriate command.`,
      messages: [{ role: 'user', content: query }],
    });

    const answer = response.content[0].type === 'text' ? response.content[0].text : 'Unable to process query';
    ctx.replyWithMarkdown(answer);
  } catch (error) {
    console.error('Natural language error:', error);
    ctx.reply('❌ Error processing natural language query. Try using specific commands (/help).');
  }
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
  ctx.reply('❌ An error occurred. Please try again or contact support.');
});

// =============================================================================
// START BOT
// =============================================================================

async function main() {
  console.log('🤖 ASI 360 Telegram Bot starting...');

  // Test Supabase connection
  const { error } = await supabase.from('clients').select('count').limit(1);
  if (error) {
    console.error('❌ Failed to connect to Supabase:', error.message);
    process.exit(1);
  }

  console.log('✅ Supabase connection successful');

  // Launch bot
  await bot.launch();
  console.log('✅ Bot is running!');

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
