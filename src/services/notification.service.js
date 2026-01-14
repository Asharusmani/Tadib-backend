// ============================================
// FILE 2: services/notification.service.js (COMPLETE - REPLACE ENTIRE FILE)
// ============================================
const Notification = require('../models/notification.model');
const axios = require('axios');

class NotificationService {
  constructor() {
    this.notificationSocket = null;
  }

  // ✅ Initialize with socket reference
  setSocket(socket) {
    this.notificationSocket = socket;
    console.log('✅ NotificationService: Socket.IO reference set');
  }

  // ✅ CORE: Create notification with real-time push
  async createNotification(userId, notificationData) {
    const notification = await Notification.create({
      userId,
      ...notificationData
    });

    // ✅ SEND REAL-TIME NOTIFICATION
    if (this.notificationSocket) {
      this.notificationSocket.sendNotificationToUser(userId, notification);
    }
    
    return notification;
  }

  // ✅ Sign-in notification with device info
  async sendSignInNotification(userId, loginDetails) {
    const { device, browser, os, ipAddress, location, loginMethod } = loginDetails;
    
    const deviceEmoji = device.toLowerCase().includes('mobile') ? '📱' : 
                       device.toLowerCase().includes('tablet') ? '📱' : '💻';
    
    const locationText = location ? ` from ${location}` : '';
    const methodText = loginMethod ? ` via ${loginMethod}` : '';
    
    await this.createNotification(userId, {
      type: 'security_alert',
      title: `${deviceEmoji} New Sign-in Detected`,
      body: `Your account was accessed on ${device} using ${browser}${locationText}${methodText}`,
      securityMetadata: {
        deviceInfo: device,
        browser,
        os,
        ipAddress,
        location,
        loginTime: new Date()
      },
      actions: [{ actionType: 'view', label: 'View Details' }]
    });
  }

  // ✅ Schedule habit reminder
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

  // ✅ Completion notification
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

  // ✅ Quranic verse notification
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

  // ========================================
  // SHARED HABIT NOTIFICATIONS (WITH REAL-TIME)
  // ========================================

  // ✅ Send invitation notification
  async sendHabitInvitation(inviteeId, inviterName, habitTitle, habitId) {
    await this.createNotification(inviteeId, {
      type: 'habit_invitation',
      title: `Habit Invitation from ${inviterName}`,
      body: `${inviterName} invited you to join "${habitTitle}" habit. Accept to start tracking together!`,
      relatedEntity: {
        entityType: 'shared_habit',
        entityId: habitId
      },
      actions: [
        { actionType: 'accept', label: 'Accept' },
        { actionType: 'reject', label: 'Decline' }
      ]
    });
  }

  // ✅ Notify creator when invitation accepted
  async notifyInvitationAccepted(creatorId, accepterName, habitTitle, habitId) {
    await this.createNotification(creatorId, {
      type: 'habit_invitation',
      title: '✅ Invitation Accepted',
      body: `${accepterName} accepted your invitation to join "${habitTitle}" habit!`,
      relatedEntity: {
        entityType: 'shared_habit',
        entityId: habitId
      }
    });
  }

  // ✅ Notify creator when invitation declined
  async notifyInvitationDeclined(creatorId, declinerName, habitTitle, habitId) {
    await this.createNotification(creatorId, {
      type: 'habit_invitation',
      title: '❌ Invitation Declined',
      body: `${declinerName} declined your invitation to join "${habitTitle}" habit.`,
      relatedEntity: {
        entityType: 'shared_habit',
        entityId: habitId
      }
    });
  }

  // ✅ Notify all participants - Streak milestone (BULK with real-time)
  async notifyStreakMilestone(participantIds, habitTitle, streakCount, habitId) {
    const notifications = participantIds.map(userId => ({
      userId,
      type: 'streak_milestone',
      title: 'Streak Milestone! 🔥',
      body: `Streak ${streakCount}! Everyone completed "${habitTitle}" today!`,
      relatedEntity: {
        entityType: 'shared_habit',
        entityId: habitId
      },
      isRead: false,
      isDelivered: true,
      sentAt: new Date()
    }));
    
    const created = await Notification.insertMany(notifications);

    // ✅ Send real-time to all participants
    if (this.notificationSocket) {
      created.forEach((notification, index) => {
        this.notificationSocket.sendNotificationToUser(
          participantIds[index],
          notification
        );
      });
    }
  }

  // ✅ Notify pending participants (BULK with real-time)
  async notifyPendingParticipants(participantIds, completedByName, habitTitle, habitId) {
    const notifications = participantIds.map(userId => ({
      userId,
      type: 'task_reminder',
      title: 'Reminder ⏰',
      body: `${completedByName} completed "${habitTitle}". Don't break the streak!`,
      relatedEntity: {
        entityType: 'shared_habit',
        entityId: habitId
      },
      isRead: false,
      isDelivered: true,
      sentAt: new Date()
    }));
    
    const created = await Notification.insertMany(notifications);

    // ✅ Send real-time to all participants
    if (this.notificationSocket) {
      created.forEach((notification, index) => {
        this.notificationSocket.sendNotificationToUser(
          participantIds[index],
          notification
        );
      });
    }
  }

  // ✅ Notify streak broken (BULK with real-time)
  async notifyStreakBroken(participantIds, habitTitle, habitId) {
    const notifications = participantIds.map(userId => ({
      userId,
      type: 'streak_broken',
      title: 'Streak Broken 💔',
      body: `Streak broken for "${habitTitle}". Not everyone completed yesterday.`,
      relatedEntity: {
        entityType: 'shared_habit',
        entityId: habitId
      },
      isRead: false,
      isDelivered: true,
      sentAt: new Date()
    }));
    
    const created = await Notification.insertMany(notifications);

    // ✅ Send real-time to all participants
    if (this.notificationSocket) {
      created.forEach((notification, index) => {
        this.notificationSocket.sendNotificationToUser(
          participantIds[index],
          notification
        );
      });
    }
  }

  // ✅ Broadcast notification to all users
  async broadcastNotification(data) {
    const User = require('../models/user.model');
    const users = await User.find({ accountStatus: 'active' });
    
    const notifications = users.map(user => ({
      userId: user._id,
      ...data
    }));
    
    const created = await Notification.insertMany(notifications);
    
    // ✅ Send real-time to all users
    if (this.notificationSocket) {
      created.forEach((notification, index) => {
        this.notificationSocket.sendNotificationToUser(
          users[index]._id,
          notification
        );
      });
    }
    
    return { sent: users.length };
  }

  // ========================================
  // QUERY METHODS (No changes needed)
  // ========================================

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
    
    // ✅ Send updated unread count to user
    if (notification && this.notificationSocket) {
      this.notificationSocket.sendUnreadCount(userId);
    }
    
    return notification;
  }

  async getUnreadCount(userId) {
    return await Notification.countDocuments({ userId, isRead: false });
  }
}

module.exports = new NotificationService();
