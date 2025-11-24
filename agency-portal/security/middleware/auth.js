/**
 * Authentication Middleware
 * JWT-based authentication with refresh token support
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');

class AuthMiddleware {
  /**
   * Verify JWT token from Authorization header
   */
  static authenticate() {
    return (req, res, next) => {
      // Skip if authentication is disabled
      if (!config.features.authentication) {
        return next();
      }

      try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader) {
          return res.status(401).json({
            success: false,
            error: 'No authorization token provided'
          });
        }

        // Check format: "Bearer <token>"
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
          return res.status(401).json({
            success: false,
            error: 'Invalid authorization header format. Use: Bearer <token>'
          });
        }

        const token = parts[1];

        // Verify token
        jwt.verify(token, config.jwt.secret, (err, decoded) => {
          if (err) {
            if (err.name === 'TokenExpiredError') {
              return res.status(401).json({
                success: false,
                error: 'Token expired',
                code: 'TOKEN_EXPIRED'
              });
            }
            return res.status(403).json({
              success: false,
              error: 'Invalid token'
            });
          }

          // Attach user info to request
          req.user = decoded;
          next();
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          error: 'Authentication error'
        });
      }
    };
  }

  /**
   * Check if user has required role
   */
  static requireRole(...roles) {
    return (req, res, next) => {
      if (!config.features.authentication) {
        return next();
      }

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      next();
    };
  }

  /**
   * Optional authentication - attach user if token present, but don't require it
   */
  static optionalAuth() {
    return (req, res, next) => {
      if (!config.features.authentication) {
        return next();
      }

      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return next();
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return next();
      }

      const token = parts[1];

      jwt.verify(token, config.jwt.secret, (err, decoded) => {
        if (!err) {
          req.user = decoded;
        }
        next();
      });
    };
  }

  /**
   * Generate JWT access token
   */
  static generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role || 'user',
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }

  /**
   * Generate JWT refresh token
   */
  static generateRefreshToken(user) {
    return jwt.sign(
      {
        id: user.id,
        type: 'refresh',
      },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, config.jwt.refreshSecret);
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
      return decoded;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Hash password using bcrypt
   */
  static async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  /**
   * Compare password with hash
   */
  static async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Validate password strength
   */
  static validatePassword(password) {
    const errors = [];
    const { minLength, requireUppercase, requireLowercase, requireNumbers, requireSpecialChars } = config.password;

    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters long`);
    }

    if (requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

module.exports = AuthMiddleware;
