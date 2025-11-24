/**
 * Security Middleware Index
 * Exports all security middleware
 */

const AuthMiddleware = require('./auth');
const RateLimitMiddleware = require('./rateLimit');
const CorsMiddleware = require('./cors');
const HeadersMiddleware = require('./headers');

module.exports = {
  // Authentication
  authenticate: AuthMiddleware.authenticate,
  requireRole: AuthMiddleware.requireRole,
  optionalAuth: AuthMiddleware.optionalAuth,

  // Rate Limiting
  rateLimit: RateLimitMiddleware.general,
  strictRateLimit: RateLimitMiddleware.strict,
  customRateLimit: RateLimitMiddleware.custom,
  perUserRateLimit: RateLimitMiddleware.perUser,

  // CORS
  cors: CorsMiddleware.configure,
  devCors: CorsMiddleware.development,

  // Security Headers
  helmet: HeadersMiddleware.configure,
  essentialHeaders: HeadersMiddleware.essential,
};
