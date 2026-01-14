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

// ✅ GET SHARED HABIT DETAILS (COMPLETE WITH PARTICIPANTS)
exports.getSharedHabitDetails = async (req, res) => {
  try {
    const { habitId } = req.params;
    const userId = req.userId || req.user._id;

    console.log('=== GET HABIT DETAILS ===');
    console.log('habitId:', habitId);
    console.log('userId:', userId);

    const habit = await SharedHabit.findById(habitId)
      .populate('createdBy', 'username name email')
      .populate('participants.userId', 'username name email');

    if (!habit) {
      return res.status(404).json({ 
        success: false, 
        message: 'Habit not found' 
      });
    }

    console.log('✅ Habit found:', habit.title);

    // Check if user is participant
    const isParticipant = habit.participants.some(
      p => p.userId && p.userId._id.toString() === userId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({ 
        success: false, 
        message: 'You are not a participant of this habit' 
      });
    }

    // Get today's completion
    const today = moment().startOf('day').toDate();
    const todayCompletion = habit.dailyCompletions.find(
      dc => moment(dc.date).isSame(today, 'day')
    );

    // Build participants response with completion status
    const participantsResponse = habit.participants
      .filter(p => p.status === 'accepted') // Only show accepted participants
      .map(p => {
        const user = p.userId;
        const isCompletedToday = todayCompletion 
          ? todayCompletion.completedBy.some(c => c.userId.toString() === p.userId._id.toString())
          : false;

        // Count total completions for this participant
        const completionCount = habit.dailyCompletions.filter(dc =>
          dc.completedBy.some(c => c.userId.toString() === p.userId._id.toString())
        ).length;

        // Get participant's current streak
        const participantStreak = habit.sharedStreak.consecutiveDays.length;

        return {
          _id: p._id,
          userId: user._id,
          name: user.username || user.name || user.email.split('@')[0],
          email: user.email,
          status: p.status,
          role: p.userId._id.toString() === habit.createdBy._id.toString() ? 'creator' : 'member',
          isCurrentUser: p.userId._id.toString() === userId.toString(),
          isCompletedToday: isCompletedToday,
          completionCount: completionCount,
          currentStreak: participantStreak,
          joinedAt: p.joinedAt
        };
      });

    console.log('👥 Participants:', participantsResponse.length);

    // Calculate overall progress
    const totalDays = habit.stats.totalDays || 0;
    const successfulDays = habit.stats.successfulDays || 0;
    const progressPercentage = totalDays > 0 
      ? Math.round((successfulDays / totalDays) * 100) 
      : 0;

    // Get duration info
    const createdDate = new Date(habit.createdAt);
    const currentDate = new Date();
    const daysElapsed = Math.floor((currentDate - createdDate) / (1000 * 60 * 60 * 24));
    
    // Assuming default duration of 30 days if not specified
    const totalDurationDays = 30; // You can add this field to your model
    const daysRemaining = Math.max(0, totalDurationDays - daysElapsed);

    const response = {
      success: true,
      data: {
        sharedHabit: {
          _id: habit._id,
          title: habit.title,
          description: habit.description,
          category: habit.category,
          icon: 0, // You can add icon field to model
          frequency: 'Daily', // You can add this to model
          points: 20, // You can add this to model
          skipDaysAllowed: 0, // You can add this to model
          
          // Creator info
          creator: habit.createdBy._id,
          creatorName: habit.createdBy.username || habit.createdBy.name || habit.createdBy.email,
          
          // Participants with completion status
          participants: participantsResponse,
          
          // Streak info
          currentStreak: habit.sharedStreak.current,
          longestStreak: habit.sharedStreak.longest,
          
          // Duration info
          createdAt: habit.createdAt,
          durationDays: totalDurationDays,
          daysElapsed: daysElapsed,
          daysRemaining: daysRemaining,
          
          // Progress
          totalDays: totalDays,
          successfulDays: successfulDays,
          progressPercentage: progressPercentage,
          
          // Stats
          stats: {
            totalDays: habit.stats.totalDays,
            successfulDays: habit.stats.successfulDays,
            failedDays: habit.stats.failedDays,
            successRate: habit.stats.successRate
          },
          
          // Completion rate
          completionRate: habit.stats.successRate || 0,
          
          isActive: habit.isActive
        }
      }
    };

    console.log('✅ Sending response with', participantsResponse.length, 'participants');
    res.json(response);

  } catch (error) {
    console.error('❌ Get habit details error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
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