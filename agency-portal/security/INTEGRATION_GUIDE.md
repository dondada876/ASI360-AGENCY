# Security Module Integration Example
# Add these lines to your existing server.js

# ============================================================================
# OPTION 1: Quick Setup (Enable All Security Features)
# ============================================================================

# Add at the top of server.js after other requires:
const security = require('./security');

# After creating Express app (after: const app = express();):
security.quickSetup(app);

# That's it! All security features are now enabled based on your .env config


# ============================================================================
# OPTION 2: Manual Setup (Granular Control)
# ============================================================================

# Add at the top of server.js:
const security = require('./security');

# After creating Express app:

# 1. Initialize base security (headers, CORS, sanitization)
app.use(security.initialize(app));

# 2. Setup authentication routes (if enabled)
security.setupAuthRoutes(app);

# 3. Apply rate limiting to API routes
app.use('/api/', security.rateLimit());

# 4. Apply strict rate limiting to auth endpoints
app.use('/api/auth/login', security.strictRateLimit());
app.use('/api/auth/register', security.strictRateLimit());


# ============================================================================
# OPTION 3: Protect Specific Routes
# ============================================================================

# Import security
const security = require('./security');

# Protect individual endpoints:

# Example 1: Require authentication
app.get('/api/clients',
  security.authenticate(),           # Require login
  async (req, res) => {
    # Your existing code
  }
);

# Example 2: Require authentication + validation
app.post('/api/clients',
  security.authenticate(),           # Require login
  security.validators.client,        # Validate input
  async (req, res) => {
    # Your existing code
  }
);

# Example 3: Require admin role
app.delete('/api/clients/:id',
  security.authenticate(),           # Require login
  security.requireRole('admin'),     # Only admins
  security.validators.uuidParam('id'), # Validate ID
  async (req, res) => {
    # Your existing code
  }
);

# Example 4: Optional authentication (if token provided, attach user)
app.get('/api/stats',
  security.optionalAuth(),           # Auth optional
  async (req, res) => {
    # req.user will be populated if token was provided
    const userId = req.user ? req.user.id : null;
    # Your existing code
  }
);

# Example 5: Custom rate limiting
app.post('/api/generate-content',
  security.customRateLimit({ max: 10, windowMs: 60000 }), # 10 per minute
  security.authenticate(),
  security.validators.contentGeneration,
  async (req, res) => {
    # Your existing code
  }
);


# ============================================================================
# COMPLETE EXAMPLE: Updated server.js with Security
# ============================================================================

```javascript
const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

# Import security module
const security = require('./security');

# Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

# Basic middleware (BEFORE security)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('combined'));

# Apply security (QUICK SETUP - one line!)
security.quickSetup(app);

# OR Manual setup for more control:
# app.use(security.initialize(app));
# security.setupAuthRoutes(app);
# app.use('/api/', security.rateLimit());

# Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

# Initialize Supabase and Anthropic (existing code)
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_KEY || 'placeholder-key'
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'placeholder-key',
});

# Routes

# Public routes (no auth required)
app.get('/', (req, res) => {
  res.render('dashboard', { title: 'ASI 360 Agency Portal', clients: [] });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'agency-portal',
    version: '1.0.0',
    security: {
      authentication: security.config.features.authentication,
      rateLimiting: security.config.features.rateLimiting,
      inputValidation: security.config.features.inputValidation,
    }
  });
});

# Protected routes (require authentication)
app.get('/api/clients',
  security.authenticate(),           # Require login
  async (req, res) => {
    try {
      const { data, error } = await supabase.from('clients').select('*');
      if (error) throw error;
      res.json({ success: true, clients: data || [] });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

app.post('/api/clients',
  security.authenticate(),           # Require login
  security.validators.client,        # Validate input
  async (req, res) => {
    try {
      const { name, domain, contact_email } = req.body;
      const { data, error } = await supabase
        .from('clients')
        .insert([{ name, domain, contact_email, status: 'active' }])
        .select();
      if (error) throw error;
      res.json({ success: true, client: data[0] });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

# Error handling middleware (LAST)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

# Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ASI 360 Agency Portal running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  # Log security status
  console.log('\nSecurity Status:');
  console.log('  Authentication:', security.config.features.authentication ? '✓ Enabled' : '✗ Disabled');
  console.log('  Rate Limiting:', security.config.features.rateLimiting ? '✓ Enabled' : '✗ Disabled');
  console.log('  Input Validation:', security.config.features.inputValidation ? '✓ Enabled' : '✗ Disabled');
  console.log('  CORS Protection:', security.config.features.corsProtection ? '✓ Enabled' : '✗ Disabled');
  console.log('  Security Headers:', security.config.features.securityHeaders ? '✓ Enabled' : '✗ Disabled');
});

module.exports = app;
```

# ============================================================================
# FRONTEND INTEGRATION EXAMPLE (dashboard.js)
# ============================================================================

# When authentication is enabled, store and use tokens:

```javascript
let authToken = localStorage.getItem('token');

async function login(email, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();

  if (data.success) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    authToken = data.token;
    loadClients(); # Reload protected data
  } else {
    alert('Login failed: ' + data.error);
  }
}

async function loadClients() {
  try {
    const headers = { 'Content-Type': 'application/json' };

    # Add token if available
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch('/api/clients', { headers });
    const data = await response.json();

    if (response.status === 401) {
      # Token expired, try refresh
      await refreshToken();
      return loadClients(); # Retry
    }

    # Process data...
  } catch (error) {
    console.error('Error:', error);
  }
}

async function refreshToken() {
  const refreshToken = localStorage.getItem('refreshToken');

  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });

  const data = await response.json();

  if (data.success) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    authToken = data.token;
  } else {
    # Refresh failed, logout
    logout();
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  authToken = null;
  window.location.href = '/login';
}
```
