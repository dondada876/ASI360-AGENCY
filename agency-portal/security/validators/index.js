/**
 * Input Validators
 * Validation rules for API endpoints using express-validator
 */

const { body, param, query, validationResult } = require('express-validator');
const config = require('../config');

/**
 * Middleware to check validation results
 */
const checkValidation = (req, res, next) => {
  if (!config.features.inputValidation) {
    return next();
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array(),
    });
  }
  next();
};

/**
 * Client validation rules
 */
const clientValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Client name is required')
    .isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters')
    .escape(), // XSS protection

  body('domain')
    .trim()
    .notEmpty().withMessage('Domain is required')
    .isFQDN().withMessage('Invalid domain name')
    .toLowerCase(),

  body('contact_email')
    .trim()
    .notEmpty().withMessage('Contact email is required')
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail()
    .toLowerCase(),

  checkValidation,
];

/**
 * Content generation validation
 */
const contentGenerationValidation = [
  body('prompt')
    .trim()
    .notEmpty().withMessage('Prompt is required')
    .isLength({ min: 10, max: 5000 }).withMessage('Prompt must be between 10 and 5000 characters'),

  body('client_id')
    .optional()
    .trim()
    .isUUID().withMessage('Invalid client ID format'),

  checkValidation,
];

/**
 * Authentication validation
 */
const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail()
    .toLowerCase(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),

  checkValidation,
];

const registerValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail()
    .toLowerCase(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .custom((value) => {
      const AuthMiddleware = require('../middleware/auth');
      const validation = AuthMiddleware.validatePassword(value);
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }
      return true;
    }),

  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Name must be less than 100 characters')
    .escape(),

  checkValidation,
];

/**
 * UUID parameter validation
 */
const uuidParam = (paramName = 'id') => [
  param(paramName)
    .trim()
    .isUUID().withMessage(`Invalid ${paramName} format`),

  checkValidation,
];

/**
 * Pagination validation
 */
const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt(),

  checkValidation,
];

/**
 * Generic sanitization middleware
 */
const sanitize = (req, res, next) => {
  if (!config.features.inputValidation) {
    return next();
  }

  // Remove any fields that start with $ (MongoDB injection prevention)
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (key.startsWith('$')) {
        delete obj[key];
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);

  next();
};

module.exports = {
  client: clientValidation,
  contentGeneration: contentGenerationValidation,
  login: loginValidation,
  register: registerValidation,
  uuidParam,
  pagination: paginationValidation,
  sanitize,
  checkValidation,
};
