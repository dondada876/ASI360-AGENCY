/**
 * Rate Limiting Middleware
 * Protect API endpoints from abuse
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');

class RateLimitMiddleware {
  /**
   * General API rate limiter
   */
  static general() {
    if (!config.features.rateLimiting) {
      return (req, res, next) => next();
    }

    return rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      message: {
        success: false,
        error: config.rateLimit.message,
      },
      standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
      legacyHeaders: false, // Disable `X-RateLimit-*` headers
      // Skip rate limiting for certain IPs (e.g., localhost in development)
      skip: (req) => {
        if (process.env.NODE_ENV === 'development' && req.ip === '::1') {
          return true;
        }
        return false;
      },
    });
  }

  /**
   * Strict rate limiter for sensitive endpoints (auth)
   */
  static strict() {
    if (!config.features.rateLimiting) {
      return (req, res, next) => next();
    }

    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 requests per window
      message: {
        success: false,
        error: 'Too many attempts, please try again later',
      },
      skipSuccessfulRequests: true, // Don't count successful requests
    });
  }

  /**
   * Flexible rate limiter with custom config
   */
  static custom(options = {}) {
    if (!config.features.rateLimiting) {
      return (req, res, next) => next();
    }

    const defaults = {
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      message: {
        success: false,
        error: config.rateLimit.message,
      },
    };

    return rateLimit({ ...defaults, ...options });
  }

  /**
   * Rate limiter based on user ID (requires authentication)
   */
  static perUser(maxRequests = 100) {
    if (!config.features.rateLimiting) {
      return (req, res, next) => next();
    }

    return rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: maxRequests,
      keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise fall back to IP
        return req.user ? req.user.id : req.ip;
      },
      message: {
        success: false,
        error: 'Rate limit exceeded for your account',
      },
    });
  }
}

module.exports = RateLimitMiddleware;
