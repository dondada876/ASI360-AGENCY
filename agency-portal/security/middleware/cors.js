/**
 * CORS Middleware
 * Configure Cross-Origin Resource Sharing
 */

const cors = require('cors');
const config = require('../config');

class CorsMiddleware {
  /**
   * CORS middleware with configuration
   */
  static configure() {
    if (!config.features.corsProtection) {
      // If CORS protection disabled, allow all origins (development mode)
      return cors();
    }

    const corsOptions = {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) {
          return callback(null, true);
        }

        // Check if origin is in whitelist
        if (config.cors.origin.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: config.cors.credentials,
      methods: config.cors.methods,
      allowedHeaders: config.cors.allowedHeaders,
      exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
      maxAge: 86400, // 24 hours
    };

    return cors(corsOptions);
  }

  /**
   * Permissive CORS for development
   */
  static development() {
    return cors({
      origin: true,
      credentials: true,
    });
  }
}

module.exports = CorsMiddleware;
