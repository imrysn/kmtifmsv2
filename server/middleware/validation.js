const Joi = require('joi');

/**
 * Validation Middleware
 * Validates request body against Joi schema
 */
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Return all errors, not just the first one
      stripUnknown: true // Remove unknown fields
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, '') // Remove quotes from Joi messages
      }));

      // Create a user-friendly summary message
      const firstError = errors[0];
      let userMessage = 'Please check your input';

      if (firstError.field === 'password') {
        userMessage = firstError.message;
      } else if (errors.length === 1) {
        userMessage = firstError.message;
      } else {
        userMessage = `Please fix ${errors.length} validation errors`;
      }

      return res.status(400).json({
        success: false,
        message: userMessage,
        errors
      });
    }

    // Replace req.body with validated and sanitized value
    req.body = value;
    next();
  };
};

/**
 * Common validation schemas
 */
const schemas = {
  // User registration/creation
  createUser: Joi.object({
    fullName: Joi.string().min(2).max(100).required()
      .messages({
        'string.min': 'Full name must be at least 2 characters',
        'string.max': 'Full name cannot exceed 100 characters',
        'any.required': 'Full name is required'
      }),
    username: Joi.string().alphanum().min(3).max(30).required()
      .messages({
        'string.alphanum': 'Username must contain only letters and numbers',
        'string.min': 'Username must be at least 3 characters',
        'string.max': 'Username cannot exceed 30 characters',
        'any.required': 'Username is required'
      }),
    email: Joi.string().email().required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    password: Joi.string().min(8).max(100).required()
      .pattern(/^(?=.*[A-Za-z])(?=.*\d)/)
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.max': 'Password cannot exceed 100 characters',
        'string.pattern.base': 'Password must contain both letters and numbers',
        'any.required': 'Password is required'
      }),
    role: Joi.string().valid('USER', 'TEAM_LEADER', 'ADMIN').default('USER'),
    team: Joi.string().max(50).default('General'),
    // Admin info (for logging)
    adminId: Joi.number().optional(),
    adminUsername: Joi.string().optional(),
    adminRole: Joi.string().optional(),
    adminTeam: Joi.string().optional()
  }),

  // User login
  login: Joi.object({
    email: Joi.string().required()
      .messages({
        'any.required': 'Email or username is required'
      }),
    password: Joi.string().required()
      .messages({
        'any.required': 'Password is required'
      }),
    loginType: Joi.string().valid('user', 'admin').default('user')
  }),

  // Password reset
  resetPassword: Joi.object({
    password: Joi.string().min(8).max(100).required()
      .pattern(/^(?=.*[A-Za-z])(?=.*\d)/)
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.max': 'Password cannot exceed 100 characters',
        'string.pattern.base': 'Password must contain both letters and numbers',
        'any.required': 'Password is required'
      }),
    adminId: Joi.number().optional(),
    adminUsername: Joi.string().optional(),
    adminRole: Joi.string().optional(),
    adminTeam: Joi.string().optional()
  }),

  // Update user
  updateUser: Joi.object({
    fullName: Joi.string().min(2).max(100).optional(),
    username: Joi.string().alphanum().min(3).max(30).optional(),
    email: Joi.string().email().optional(),
    role: Joi.string().valid('USER', 'TEAM_LEADER', 'ADMIN').optional(),
    team: Joi.string().max(50).optional(),
    adminId: Joi.number().optional(),
    adminUsername: Joi.string().optional(),
    adminRole: Joi.string().optional(),
    adminTeam: Joi.string().optional()
  }).min(1), // At least one field must be provided

  // Forgot password
  forgotPassword: Joi.object({
    email: Joi.string().required()
      .messages({
        'any.required': 'Email or username is required'
      })
  }),

  // Team creation
  createTeam: Joi.object({
    name: Joi.string().min(2).max(50).required()
      .messages({
        'string.min': 'Team name must be at least 2 characters',
        'string.max': 'Team name cannot exceed 50 characters',
        'any.required': 'Team name is required'
      }),
    description: Joi.string().max(500).optional().allow(''),
    adminId: Joi.number().optional(),
    adminUsername: Joi.string().optional(),
    adminRole: Joi.string().optional(),
    adminTeam: Joi.string().optional()
  }),

  // File comment
  fileComment: Joi.object({
    comment: Joi.string().min(1).max(1000).required()
      .messages({
        'string.min': 'Comment cannot be empty',
        'string.max': 'Comment cannot exceed 1000 characters',
        'any.required': 'Comment is required'
      }),
    userId: Joi.number().optional(),
    username: Joi.string().optional(),
    role: Joi.string().optional(),
    team: Joi.string().optional()
  }),

  // Assignment
  createAssignment: Joi.object({
    title: Joi.string().min(3).max(200).required()
      .messages({
        'string.min': 'Title must be at least 3 characters',
        'string.max': 'Title cannot exceed 200 characters',
        'any.required': 'Title is required'
      }),
    description: Joi.string().max(2000).optional().allow(''),
    dueDate: Joi.date().iso().min('now').optional()
      .messages({
        'date.min': 'Due date cannot be in the past'
      }),
    assignedTo: Joi.number().required()
      .messages({
        'any.required': 'Assigned user is required'
      }),
    priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH').default('MEDIUM'),
    adminId: Joi.number().optional(),
    adminUsername: Joi.string().optional(),
    adminRole: Joi.string().optional(),
    adminTeam: Joi.string().optional()
  })
};

/**
 * Validate ID parameter
 */
const validateId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = parseInt(req.params[paramName]);

    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${paramName}. Must be a positive number.`
      });
    }

    req.params[paramName] = id;
    next();
  };
};

/**
 * Sanitize string to prevent XSS
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') {
    return str;
  }

  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

module.exports = {
  validate,
  schemas,
  validateId,
  sanitizeString
};
