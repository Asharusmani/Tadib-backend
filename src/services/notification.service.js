// services/notification.service.js
const Notification = require('../models/notification.model');
const axios = require('axios');

class NotificationService {
  async createNotification(userId, notificationData) {
    const notification = await Notification.create({
      userId,
      ...notificationData
    });
    
    return notification;
  }

  // ✅ NEW: Sign-in notification with device info
  async sendSignInNotification(userId, loginDetails) {
    const { device, browser, os, ipAddress, location, loginMethod } = loginDetails;
    
    // Device emoji based on type
    const deviceEmoji = device.toLowerCase().includes('mobile') ? '📱' : 
                       device.toLowerCase().includes('tablet') ? '📱' : '💻';
    
    // Location display
    const locationText = location ? ` from ${location}` : '';
    
    // Login method (for social login)
    const methodText = loginMethod ? ` via ${loginMethod}` : '';
    
    await this.createNotification(userId, {
      type: 'security_alert',
      title: `${deviceEmoji} New Sign-in Detected`,
      body: `Your account was accessed on ${device} using ${browser}${locationText}${methodText}`,
      securityMetadata: {
        deviceInfo: device,
        browser: browser,
        os: os,
        ipAddress: ipAddress,
        location: location,
        loginTime: new Date()
      },
      actions: [
        { actionType: 'view', label: 'View Details' }
      ]
    });
  }

  async scheduleHabitReminder(habit) {
    const reminderTime = new Date();
    const [hours, minutes] = habit.reminder.time.split(':');
    reminderTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    await this.createNotification(habit.userId, {
      type: 'task_reminder',
      title: `Time for: ${habit.title}`,
      body: 'Complete your habit and earn points!',
      relatedEntity: {
        entityType: 'habit',
        entityId: habit._id
      },
      scheduledFor: reminderTime,
      actions: [
        { actionType: 'complete', label: 'Mark Complete' },
        { actionType: 'snooze', label: 'Snooze 15 min' }
      ]
    });
  }

  async sendCompletionNotification(user, habit, pointsEarned) {
    await this.createNotification(user._id, {
      type: 'achievement',
      title: '🎉 Great Job!',
      body: `You completed "${habit.title}" and earned ${pointsEarned} points!`,
      relatedEntity: {
        entityType: 'habit',
        entityId: habit._id
      }
    });
  }

  async sendQuranicVerse(userId, topic = null) {
    try {
      const response = await axios.get('https://api.alquran.cloud/v1/ayah/random');
      const ayah = response.data.data;
      
      await this.createNotification(userId, {
        type: 'quranic_verse',
        title: `${ayah.surah.englishName} - Ayah ${ayah.numberInSurah}`,
        body: ayah.text,
        quranicContent: {
          surah: ayah.surah.name,
          ayah: ayah.numberInSurah,
          translation: ayah.text,
          topic: topic || 'General'
        }
      });
    } catch (error) {
      console.error('Quranic verse notification error:', error);
    }
  }

  async broadcastNotification(data) {
    const User = require('../models/user.model');
    const users = await User.find({ accountStatus: 'active' });
    
    const notifications = users.map(user => ({
      userId: user._id,
      ...data
    }));
    
    await Notification.insertMany(notifications);
    
    return { sent: users.length };
  }

  async getUserNotifications(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Notification.countDocuments({ userId });
    
    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    
    return notification;
  }

  async getUnreadCount(userId) {
    return await Notification.countDocuments({ userId, isRead: false });
  }
}

module.exports = new NotificationService();