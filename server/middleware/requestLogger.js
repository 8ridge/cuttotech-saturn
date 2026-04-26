// Request ID middleware for structured logging
import { randomUUID } from 'crypto';
import logger from '../utils/logger.js';

export function requestLoggerMiddleware(req, res, next) {
  // Generate unique request ID
  const requestId = randomUUID();
  
  // Attach to request object
  req.id = requestId;
  
  // Create child logger with requestId context
  req.log = logger.child({ requestId });
  
  // Log request start
  req.log.info({
    event: 'request_start',
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  
  // Log response when finished
  res.on('finish', () => {
    req.log.info({
      event: 'request_end',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime: res.responseTime || 'N/A',
    });
  });
  
  next();
}

