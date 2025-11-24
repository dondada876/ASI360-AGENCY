/**
 * Security Headers Middleware
 * Add security headers using Helmet
 */

const helmet = require('helmet');
const config = require('../config');

class HeadersMiddleware {
  /**
   * Apply security headers
   */
  static configure() {
    if (!config.features.securityHeaders) {
      return (req, res, next) => next();
    }

    return helmet(config.helmet);
  }

  /**
   * Apply only essential headers (for gradual adoption)
   */
  static essential() {
    if (!config.features.securityHeaders) {
      return (req, res, next) => next();
    }

    return helmet({
      // XSS Protection
      xssFilter: true,

      // Prevent MIME type sniffing
      noSniff: true,

      // Force HTTPS
      hsts: config.helmet.hsts,

      // Hide powered by header
      hidePoweredBy: true,

      // Frame options
      frameguard: { action: 'deny' },
    });
  }
}

module.exports = HeadersMiddleware;
