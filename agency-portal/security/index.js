/**
 * Security Module Index
 * Main entry point for security features
 */

const config = require('./config');
const middleware = require('./middleware');
const validators = require('./validators');
const authRoutes = require('./auth/routes');

/**
 * Initialize security for Express app
 * Usage: app.use(security.initialize(app));
 */
function initialize(app) {
  return (req, res, next) => {
    // Apply security features based on configuration
    const securityMiddleware = [];

    // 1. Security headers (always apply first)
    if (config.features.securityHeaders) {
      securityMiddleware.push(middleware.helmet());
    }

    // 2. CORS protection
    if (config.features.corsProtection) {
      securityMiddleware.push(middleware.cors());
    } else {
      // Development mode - allow all origins
      securityMiddleware.push(middleware.devCors());
    }

    // 3. Sanitization (always apply)
    securityMiddleware.push(validators.sanitize);

    // Apply all middleware
    let index = 0;
    const executeMiddleware = (err) => {
      if (err) return next(err);

      if (index >= securityMiddleware.length) {
        return next();
      }

      const mw = securityMiddleware[index++];
      mw(req, res, executeMiddleware);
    };

    executeMiddleware();
  };
}

/**
 * Setup authentication routes
 * Usage: app.use('/api/auth', security.authRoutes);
 */
function setupAuthRoutes(app) {
  if (config.features.authentication) {
    app.use('/api/auth', authRoutes);
    console.log('✓ Authentication routes enabled at /api/auth');
  }
}

/**
 * Quick setup - apply all security features
 */
function quickSetup(app) {
  // Initialize base security
  app.use(initialize(app));

  // Setup auth routes
  setupAuthRoutes(app);

  // Apply rate limiting to /api routes
  if (config.features.rateLimiting) {
    app.use('/api/', middleware.rateLimit());
    console.log('✓ Rate limiting enabled for /api routes');
  }

  // Apply strict rate limiting to auth routes
  if (config.features.authentication && config.features.rateLimiting) {
    app.use('/api/auth/login', middleware.strictRateLimit());
    app.use('/api/auth/register', middleware.strictRateLimit());
    console.log('✓ Strict rate limiting enabled for auth endpoints');
  }

  console.log('✓ Security module initialized');
  console.log('  Features enabled:',
    Object.entries(config.features)
      .filter(([_, enabled]) => enabled)
      .map(([feature]) => feature)
      .join(', ') || 'none'
  );
}

// Export everything
module.exports = {
  // Configuration
  config,

  // Middleware
  middleware,

  // Validators
  validators,

  // Routes
  authRoutes,

  // Setup functions
  initialize,
  setupAuthRoutes,
  quickSetup,

  // Direct exports for convenience
  authenticate: middleware.authenticate,
  requireRole: middleware.requireRole,
  optionalAuth: middleware.optionalAuth,
  rateLimit: middleware.rateLimit,
  strictRateLimit: middleware.strictRateLimit,
};
