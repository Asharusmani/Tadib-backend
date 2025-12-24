// ============================================
// FILE: models/sharedHabit.model.js (FIXED)
// ============================================
const mongoose = require('mongoose');

const sharedHabitSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  category: { 
    type: String, 
    enum: ['spiritual', 'health', 'learning', 'discipline', 'custom'],
    default: 'custom'
  },
  
  // Creator of shared habit
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // All participants
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    email: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['pending', 'accepted', 'declined'], 
      default: 'pending' 
    },
    joinedAt: Date,
    invitedAt: { type: Date, default: Date.now }
  }],
  
  // Shared Streak Info
  sharedStreak: {
    current: { type: Number, default: 0 },
    longest: { type: Number, default: 0 },
    lastCompletedDate: Date,
    consecutiveDays: [{ type: Date }]
  },
  
  // Daily completion tracking
  dailyCompletions: [{
    date: { type: Date, required: true },
    completedBy: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      completedAt: { type: Date, default: Date.now }
    }],
    allCompleted: { type: Boolean, default: false },
    missedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    countedAsDay: { type: Boolean, default: false } // 🔧 FIX: Track if day already counted
  }],
  
  // Streak Rules
  rules: {
    requireAllParticipants: { type: Boolean, default: true },
    deadline: String, // e.g., "23:59"
    allowPartialCredit: { type: Boolean, default: false },
    minimumCompletionPercentage: { type: Number, default: 100 }
  },
  
  // Notifications
  notifications: {
    reminderEnabled: { type: Boolean, default: true },
    reminderTime: String,
    notifyOnStreak: { type: Boolean, default: true },
    notifyOnBreak: { type: Boolean, default: true }
  },
  
  // Stats
  stats: {
    totalDays: { type: Number, default: 0 }, // Total unique days
    successfulDays: { type: Number, default: 0 }, // Days when all completed
    failedDays: { type: Number, default: 0 }, // Days when not all completed
    successRate: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 }
  },
  
  isActive: { type: Boolean, default: true },
  
}, {
  timestamps: true
});

// Calculate success rate before saving
sharedHabitSchema.pre('save', async function () {
  if (this.stats.totalDays > 0) {
    this.stats.successRate = Math.round((this.stats.successfulDays / this.stats.totalDays) * 100);
  }
});

module.exports = mongoose.model('SharedHabit', sharedHabitSchema);
