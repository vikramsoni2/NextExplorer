# Error Handling System

This directory contains the centralized error handling system for the backend API.

## Overview

The error handling system provides:
- **Custom error classes** for different HTTP error types
- **Centralized error handler middleware** that formats all errors consistently
- **AsyncHandler utility** to automatically catch errors in async route handlers
- **Structured error responses** suitable for frontend notification centers

## Error Response Format

All errors are returned in this standardized format:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "statusCode": 400,
    "requestId": "uuid-v4",
    "timestamp": "2025-01-18T12:34:56.789Z"
  }
}
```

Additional fields may be included based on the error type:
- `details`: For validation errors with field-specific information
- `retryAfter`: For rate limit errors indicating when to retry
- `stack`: Only in development mode for debugging

## Available Error Classes

### AppError (Base Class)
Base class for all operational errors. Extend this to create custom error types.

```javascript
const { AppError } = require('../errors/AppError');
throw new AppError('Something went wrong', 500);
```

### ValidationError (400)
For input validation failures.

```javascript
const { ValidationError } = require('../errors/AppError');
throw new ValidationError('Invalid email format');

// With field details
throw new ValidationError('Validation failed', {
  email: 'Invalid format',
  password: 'Too short'
});
```

### UnauthorizedError (401)
For authentication failures.

```javascript
const { UnauthorizedError } = require('../errors/AppError');
throw new UnauthorizedError('Invalid credentials');
```

### ForbiddenError (403)
For authorization/permission failures.

```javascript
const { ForbiddenError } = require('../errors/AppError');
throw new ForbiddenError('Path is read-only');
```

### NotFoundError (404)
For missing resources.

```javascript
const { NotFoundError } = require('../errors/AppError');
throw new NotFoundError('File not found');
```

### ConflictError (409)
For resource state conflicts.

```javascript
const { ConflictError } = require('../errors/AppError');
throw new ConflictError('User already exists');
```

### RateLimitError (429)
For rate limiting.

```javascript
const { RateLimitError } = require('../errors/AppError');
throw new RateLimitError('Too many login attempts', retryAfterSeconds);
```

### InternalError (500)
For unexpected server errors.

```javascript
const { InternalError } = require('../errors/AppError');
throw new InternalError('Database connection failed');
```

### UnsupportedMediaTypeError (415)
For unsupported file/media types.

```javascript
const { UnsupportedMediaTypeError } = require('../errors/AppError');
throw new UnsupportedMediaTypeError('File type not supported');
```

## Using in Routes

### Method 1: AsyncHandler (Recommended)

Wrap your route handlers with `asyncHandler` to automatically catch errors:

```javascript
const asyncHandler = require('../utils/asyncHandler');
const { ValidationError, NotFoundError } = require('../errors/AppError');

router.post('/items', asyncHandler(async (req, res) => {
  const { name } = req.body;

  if (!name) {
    throw new ValidationError('Name is required');
  }

  const item = await createItem(name);

  if (!item) {
    throw new NotFoundError('Item not found');
  }

  res.json(item);
}));
```

### Method 2: Manual Error Handling

For routes that need custom error handling:

```javascript
router.post('/items', async (req, res, next) => {
  try {
    // Your route logic
  } catch (error) {
    // Transform to custom error if needed
    if (error.code === 'DUPLICATE_KEY') {
      return next(new ConflictError('Item already exists'));
    }
    // Pass through to error handler
    next(error);
  }
});
```

## Logging

All errors are automatically logged with structured context:
- Request ID (for tracing)
- HTTP method and URL
- User information (if authenticated)
- Error status code and message
- Full stack trace (for server errors)

Check logs using the request ID to trace errors across systems.
