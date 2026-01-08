// controllers/notification.controller.js (Optimized Version)
const notificationService = require('../services/notification.service');
const Notification = require('../models/notification.model');

// Cache for unread counts (in-memory, 30 second TTL)
const unreadCountCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const result = await notificationService.getUserNotifications(
      req.userId, 
      parseInt(page), 
      parseInt(limit)
    );
    
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await notificationService.markAsRead(
      req.params.id,
      req.userId
    );
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    // Invalidate unread count cache for this user
    unreadCountCache.delete(req.userId);
    
    res.json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.userId;
    const cacheKey = userId;
    
    // Check cache first
    const cached = unreadCountCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('✅ Unread count from cache');
      return res.json({ success: true, unreadCount: cached.count });
    }
    
    // Fetch from database
    const count = await notificationService.getUnreadCount(userId);
    
    // Cache the result
    unreadCountCache.set(cacheKey, {
      count,
      timestamp: Date.now()
    });
    
    console.log('✅ Unread count from DB, cached');
    res.json({ success: true, unreadCount: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    // Use bulk update for better performance
    const result = await Notification.updateMany(
      { userId: req.userId, isRead: false },
      { 
        $set: { 
          isRead: true, 
          readAt: new Date() 
        } 
      }
    );
    
    // Invalidate cache
    unreadCountCache.delete(req.userId);
    
    res.json({ 
      success: true, 
      message: 'All notifications marked as read',
      modified: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    // Invalidate cache if notification was unread
    if (!notification.isRead) {
      unreadCountCache.delete(req.userId);
    }
    
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Batch operations endpoint (optional enhancement)
exports.batchMarkAsRead = async (req, res) => {
  try {
    const { notificationIds } = req.body;
    
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json({ error: 'Invalid notification IDs' });
    }
    
    const result = await Notification.updateMany(
      { 
        _id: { $in: notificationIds },
        userId: req.userId,
        isRead: false
      },
      { 
        $set: { 
          isRead: true, 
          readAt: new Date() 
        } 
      }
    );
    
    // Invalidate cache
    unreadCountCache.delete(req.userId);
    
    res.json({ 
      success: true, 
      modified: result.modifiedCount 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Clear expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of unreadCountCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      unreadCountCache.delete(key);
    }
  }
}, 60000); // Clean up every minute

module.exports = exports;