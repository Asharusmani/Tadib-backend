// ============================================
// 1. UPDATE: models/notification.model.js
// ============================================

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  
  type: { 
    type: String, 
    enum: [
      'task_reminder', 
      'group_activity', 
      'challenge_update', 
      'achievement', 
      'quranic_verse', 
      'system',
      'security_alert'  // ✅ NEW: Security notifications
    ],
    required: true
  },
  
  title: { type: String, required: true },
  body: String,
  
  relatedEntity: {
    entityType: { type: String, enum: ['habit', 'group', 'challenge', 'badge'] },
    entityId: mongoose.Schema.Types.ObjectId
  },
  
  actions: [{
    actionType: { type: String, enum: ['complete', 'snooze', 'decline', 'view'] },
    label: String
  }],
  
  quranicContent: {
    surah: String,
    ayah: String,
    translation: String,
    topic: String
  },
  
  // ✅ NEW: Security/Login metadata
  securityMetadata: {
    deviceInfo: String,
    browser: String,
    os: String,
    ipAddress: String,
    location: String,
    loginTime: Date
  },
  
  scheduledFor: Date,
  sentAt: Date,
  
  isRead: { type: Boolean, default: false },
  readAt: Date,
  isDelivered: { type: Boolean, default: false }
}, {
  timestamps: true
});

module.exports = mongoose.model('Notification', notificationSchema);