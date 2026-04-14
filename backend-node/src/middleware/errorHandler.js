// src/middleware/errorHandler.js
// Central error handler – catches everything thrown in async route handlers.
// All controllers use: throw new AppError('msg', statusCode)
// or simply let unexpected errors bubble up here.

export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // distinguishes our errors from crashes
  }
}

// Wraps async route handlers so we don't need try/catch in every controller.
// Usage: router.post('/route', asyncHandler(myController))
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Must be registered LAST in server.js (after all routes).
// Express identifies it as an error handler via the 4-argument signature.
 
export const globalErrorHandler = (err, req, res, next) => {
  const status = err.statusCode || 500;
  const isDev = process.env.NODE_ENV === "development";

  console.error(`[ERROR] ${req.method} ${req.path} → ${status}: ${err.message}`);
  if (isDev) console.error(err.stack);

  res.status(status).json({
    success: false,
    error: err.message || "Internal server error",
    // Only expose stack trace locally – never in production
    ...(isDev && { stack: err.stack }),
  });
};