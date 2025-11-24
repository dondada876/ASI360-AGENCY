/**
 * Security Configuration
 * Central configuration for all security features
 */

require('dotenv').config();

const config = {
  // Feature flags - enable/disable security features independently
  features: {
    authentication: process.env.ENABLE_AUTHENTICATION === 'true',
    rateLimiting: process.env.ENABLE_RATE_LIMITING === 'true',
    inputValidation: process.env.ENABLE_INPUT_VALIDATION === 'true',
    corsProtection: process.env.ENABLE_CORS_PROTECTION === 'true',
    securityHeaders: process.env.ENABLE_SECURITY_HEADERS === 'true',
  },

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-this-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // Rate limiting configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Too many requests from this IP, please try again later.',
  },

  // CORS configuration
  cors: {
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000'], // Default for development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },

  // Password requirements
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
  },

  // Admin configuration
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@asi360.com',
    password: process.env.ADMIN_PASSWORD, // Should be set in .env
  },

  // Security headers
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  },
};

// Validation: Warn if using default secrets in production
if (process.env.NODE_ENV === 'production') {
  if (config.jwt.secret === 'change-this-in-production') {
    console.error('⚠️  WARNING: Using default JWT_SECRET in production!');
    console.error('   Generate a new secret: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  }
  if (!config.admin.password) {
    console.error('⚠️  WARNING: ADMIN_PASSWORD not set in production!');
  }
}

module.exports = config;
