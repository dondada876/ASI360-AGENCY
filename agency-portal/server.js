const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('combined'));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_KEY || 'placeholder-key'
);

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'placeholder-key',
});

// Routes
app.get('/', (req, res) => {
  res.render('dashboard', {
    title: 'ASI 360 Agency Portal',
    clients: []
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'agency-portal',
    version: '1.0.0'
  });
});

// Client management endpoints
app.get('/api/clients', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      clients: data || []
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/clients', async (req, res) => {
  try {
    const { name, domain, contact_email } = req.body;

    const { data, error } = await supabase
      .from('clients')
      .insert([
        { name, domain, contact_email, status: 'active' }
      ])
      .select();

    if (error) throw error;

    res.json({
      success: true,
      client: data[0]
    });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// AI-powered content generation endpoint
app.post('/api/generate-content', async (req, res) => {
  try {
    const { prompt, client_id } = req.body;

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt || 'Generate a welcome page for a new WordPress site.'
        }
      ],
    });

    res.json({
      success: true,
      content: message.content[0].text
    });
  } catch (error) {
    console.error('Error generating content:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Docker container management endpoints
app.get('/api/containers', (req, res) => {
  // This would integrate with Docker API in production
  res.json({
    success: true,
    containers: [
      { name: 'client1_wordpress', status: 'running', uptime: '5d 3h' },
      { name: 'jccix_wordpress', status: 'running', uptime: '5d 3h' }
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ASI 360 Agency Portal running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Supabase URL: ${process.env.SUPABASE_URL || 'not configured'}`);
});

module.exports = app;
