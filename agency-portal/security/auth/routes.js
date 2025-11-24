/**
 * Authentication Routes
 * Endpoints for user authentication
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const AuthMiddleware = require('../middleware/auth');
const validators = require('../validators');
const config = require('../config');

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_KEY || ''
);

/**
 * POST /api/auth/register
 * Register a new user (admin only)
 */
router.post('/register',
  AuthMiddleware.authenticate(),
  AuthMiddleware.requireRole('admin'),
  validators.register,
  async (req, res) => {
    try {
      const { email, password, name, role } = req.body;

      // Check if user already exists
      const { data: existingUser } = await supabase
        .table('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'User with this email already exists',
        });
      }

      // Hash password
      const hashedPassword = await AuthMiddleware.hashPassword(password);

      // Create user
      const { data: newUser, error } = await supabase
        .table('users')
        .insert([
          {
            email,
            password_hash: hashedPassword,
            name: name || null,
            role: role || 'user',
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Generate tokens
      const token = AuthMiddleware.generateToken(newUser);
      const refreshToken = AuthMiddleware.generateRefreshToken(newUser);

      res.json({
        success: true,
        message: 'User registered successfully',
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
        },
        token,
        refreshToken,
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Registration failed',
      });
    }
  }
);

/**
 * POST /api/auth/login
 * Login and get tokens
 */
router.post('/login',
  validators.login,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Get user from database
      const { data: user, error } = await supabase
        .table('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
        });
      }

      // Check password
      const passwordMatch = await AuthMiddleware.comparePassword(
        password,
        user.password_hash
      );

      if (!passwordMatch) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
        });
      }

      // Generate tokens
      const token = AuthMiddleware.generateToken(user);
      const refreshToken = AuthMiddleware.generateRefreshToken(user);

      // Update last login
      await supabase
        .table('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
        refreshToken,
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed',
      });
    }
  }
);

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required',
      });
    }

    // Verify refresh token
    const decoded = AuthMiddleware.verifyRefreshToken(refreshToken);

    // Get user
    const { data: user, error } = await supabase
      .table('users')
      .select('*')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
      });
    }

    // Generate new tokens
    const newToken = AuthMiddleware.generateToken(user);
    const newRefreshToken = AuthMiddleware.generateRefreshToken(user);

    res.json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken,
    });

  } catch (error) {
    console.error('Refresh error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid refresh token',
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout (client should delete tokens)
 */
router.post('/logout',
  AuthMiddleware.authenticate(),
  (req, res) => {
    // In a stateless JWT system, logout is handled client-side
    // For added security, you could maintain a token blacklist in Redis
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }
);

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me',
  AuthMiddleware.authenticate(),
  async (req, res) => {
    try {
      const { data: user, error } = await supabase
        .table('users')
        .select('id, email, name, role, created_at, last_login')
        .eq('id', req.user.id)
        .single();

      if (error || !user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      res.json({
        success: true,
        user,
      });

    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user info',
      });
    }
  }
);

module.exports = router;
