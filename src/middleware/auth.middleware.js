// middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

// Simple logger that respects environment
const logger = {
  debug: (message, data) => {
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG_AUTH === 'true') {
      console.log(`[Auth] ${message}`, data || '');
    }
  },
  error: (message, error) => {
    console.error(`[Auth Error] ${message}`, error?.message || error);
  },
  info: (message) => {
    console.log(`[Auth] ${message}`);
  }
};

/**
 * Authentication middleware - Production ready with minimal logging
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        message: 'No authentication token provided' 
      });
    }

    // Extract token - handle both "Bearer token" and just "token"
    let token;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = authHeader;
    }

    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid authentication token' 
      });
    }
    
    // Check JWT_SECRET exists
    if (!process.env.JWT_SECRET) {
      logger.error('JWT_SECRET not found in environment');
      return res.status(500).json({ 
        success: false, 
        message: 'Server configuration error' 
      });
    }
    
    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      logger.debug('Token verified', { userId: decoded.userId });
    } catch (jwtError) {
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid token'
        });
      }
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false, 
          message: 'Token expired',
          expiredAt: jwtError.expiredAt
        });
      }
      
      throw jwtError;
    }
    
    // Find user by ID
    const userId = decoded.userId || decoded.id;
    
    if (!userId) {
      logger.error('No userId in token payload');
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token payload' 
      });
    }

    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      logger.debug('User not found', { userId });
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Check if user is active
    if (user.isActive === false) {
      logger.debug('User account deactivated', { email: user.email });
      return res.status(403).json({ 
        success: false, 
        message: 'Account is deactivated' 
      });
    }
    
    // Attach user to request object
    req.user = user;
    req.userId = user._id;
    
    logger.debug('Authentication successful', { email: user.email });
    next();
    
  } catch (error) {
    logger.error('Authentication failed', error);
    
    res.status(500).json({ 
      success: false, 
      message: 'Authentication failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Optional authentication middleware
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (authHeader) {
      let token;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else {
        token = authHeader;
      }
      
      if (token && token !== 'null' && token !== 'undefined') {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId || decoded.id).select('-password');
        
        if (user && user.isActive !== false) {
          req.user = user;
          req.userId = user._id;
        }
      }
    }
    
    next();
    
  } catch (error) {
    logger.debug('Optional auth failed silently', { error: error.message });
    next();
  }
};

/**
 * Role-based authorization middleware
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    if (!roles.includes(req.user.role)) {
      logger.debug('Authorization denied', { 
        userRole: req.user.role, 
        requiredRoles: roles 
      });
      return res.status(403).json({ 
        success: false, 
        message: 'Insufficient permissions' 
      });
    }
    
    next();
  };
};

/**
 * Pro subscription check middleware
 */
const isPro = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }
  
  if (req.user.subscription?.plan !== 'pro') {
    return res.status(403).json({ 
      success: false, 
      message: 'Pro subscription required' 
    });
  }
  
  next();
};

logger.info('Auth middleware loaded');

module.exports = {
  authenticate,
  optionalAuthenticate,
  authorize,
  isPro
};