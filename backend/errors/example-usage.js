/**
 * Example Usage of Error Handling System
 *
 * This file demonstrates how to use the error handling system in your routes.
 * DO NOT import this file - it's just for reference/documentation.
 */

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalError,
  UnsupportedMediaTypeError
} = require('./AppError');

const router = express.Router();

// Example 1: Basic async route with validation
router.post('/example/create', asyncHandler(async (req, res) => {
  const { name, email } = req.body;

  // Validation
  if (!name || !email) {
    throw new ValidationError('Name and email are required');
  }

  if (!email.includes('@')) {
    throw new ValidationError('Invalid email format');
  }

  // Simulate creation
  const item = { id: 1, name, email };
  res.status(201).json({ success: true, item });
}));

// Example 2: Authentication check
router.get('/example/protected', asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new UnauthorizedError('Please login to access this resource');
  }

  res.json({ message: 'Protected data', user });
}));

// Example 3: Permission check
router.delete('/example/admin-only', asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new UnauthorizedError('Authentication required');
  }

  if (!user.roles?.includes('admin')) {
    throw new ForbiddenError('Admin access required');
  }

  res.json({ message: 'Admin action completed' });
}));

// Example 4: Resource lookup with 404
router.get('/example/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Simulate database lookup
  const item = null; // await db.findById(id);

  if (!item) {
    throw new NotFoundError(`Item with id ${id} not found`);
  }

  res.json(item);
}));

// Example 5: Duplicate resource handling
router.post('/example/register', asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Simulate checking for existing user
  const existingUser = true; // await db.findByEmail(email);

  if (existingUser) {
    throw new ConflictError('User with this email already exists');
  }

  res.status(201).json({ message: 'User created' });
}));

// Example 6: Rate limiting
router.post('/example/login', asyncHandler(async (req, res) => {
  const attempts = 11; // Simulate too many attempts

  if (attempts > 10) {
    throw new RateLimitError('Too many login attempts. Please try again later.', 900); // retry after 15 minutes
  }

  res.json({ message: 'Login successful' });
}));

// Example 7: File upload validation
router.post('/example/upload', asyncHandler(async (req, res) => {
  const fileType = req.file?.mimetype;

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];

  if (!allowedTypes.includes(fileType)) {
    throw new UnsupportedMediaTypeError('Only JPEG, PNG, and GIF images are supported');
  }

  res.json({ message: 'File uploaded successfully' });
}));

// Example 8: Validation with field-specific details
router.post('/example/complex-validation', asyncHandler(async (req, res) => {
  const { username, password, email } = req.body;
  const errors = {};

  if (!username || username.length < 3) {
    errors.username = 'Username must be at least 3 characters';
  }

  if (!password || password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }

  if (!email || !email.includes('@')) {
    errors.email = 'Valid email is required';
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Validation failed', errors);
  }

  res.json({ message: 'Validation passed' });
}));

// Example 9: Catching specific errors and re-throwing as custom errors
router.post('/example/database-operation', asyncHandler(async (req, res) => {
  try {
    // Simulate database operation
    // await db.query('INSERT INTO users...');
    throw new Error('DUPLICATE_KEY');
  } catch (error) {
    if (error.message === 'DUPLICATE_KEY') {
      throw new ConflictError('Record already exists');
    }
    if (error.message === 'CONNECTION_FAILED') {
      throw new InternalError('Database connection failed');
    }
    // Re-throw unknown errors
    throw error;
  }
}));

// Example 10: Manual error handling (when you need more control)
router.post('/example/manual', async (req, res, next) => {
  try {
    const result = await someComplexOperation();

    // Custom response format
    res.json({
      success: true,
      data: result,
      metadata: { timestamp: new Date() }
    });
  } catch (error) {
    // Transform error if needed
    if (error.code === 'CUSTOM_ERROR') {
      return next(new ValidationError(error.message));
    }
    // Pass through to error handler
    next(error);
  }
});

// Example of what the frontend receives:

/*
Success Response:
{
  "success": true,
  "item": { ... }
}

Error Response (ValidationError):
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "statusCode": 400,
    "requestId": "a1b2c3d4-e5f6-4789-a0b1-c2d3e4f5g6h7",
    "timestamp": "2025-01-18T12:34:56.789Z",
    "details": {
      "email": "Invalid format",
      "password": "Too short"
    }
  }
}

Error Response (RateLimitError):
{
  "success": false,
  "error": {
    "message": "Too many login attempts. Please try again later.",
    "statusCode": 429,
    "requestId": "a1b2c3d4-e5f6-4789-a0b1-c2d3e4f5g6h7",
    "timestamp": "2025-01-18T12:34:56.789Z",
    "retryAfter": 900
  }
}
*/

module.exports = router;
