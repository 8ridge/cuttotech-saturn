// Client UUID middleware - tracks anonymous users via cookies
import { v4 as uuidv4 } from 'uuid';
import { COOKIE_NAME, COOKIE_MAX_AGE } from '../config/monetization.js';

/**
 * Middleware to ensure every request has a client UUID
 * Sets a cookie if it doesn't exist, or reads existing cookie
 * Stores UUID in req.clientUuid for use in routes
 */
export function clientUuidMiddleware(req, res, next) {
  // Check if cookie exists
  const existingUuid = req.cookies[COOKIE_NAME];

  if (!existingUuid) {
    // Generate new UUID
    const newUuid = uuidv4();
    
    // Set cookie
    res.cookie(COOKIE_NAME, newUuid, {
      httpOnly: true,
      path: '/',
      maxAge: COOKIE_MAX_AGE,
      secure: process.env.NODE_ENV === 'production', // Only secure in production (HTTPS required)
      sameSite: 'lax' // CSRF protection
    });

    // Store in request object
    req.clientUuid = newUuid;
    
    console.log('🍪 New client UUID generated:', newUuid);
  } else {
    // Use existing UUID from cookie
    req.clientUuid = existingUuid;
  }

  // Continue to next middleware
  next();
}

