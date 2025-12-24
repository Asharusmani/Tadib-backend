const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  
  // ✅ Frontend sends 'name' not 'title'
  name: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: 50
  },
  
  // ✅ Icon index from frontend (0-15)
  icon: { 
    type: Number, 
    required: true,
    min: 0,
    max: 15
  },
  
  // ✅ Match frontend categories exactly (with capital letters)
  category: { 
    type: String, 
    enum: ['Spiritual', 'Health', 'Learning', 'Discipline'],
    required: true
  },
  
  // ✅ Boolean instead of enum string
  isNegative: { 
    type: Boolean, 
    default: false 
  },
  
  // ✅ Renamed from 'pointsValue'
  points: { 
    type: Number, 
    required: true, 
    default: 10,
    min: 5,
    max: 100
  },
  
  // ✅ Direct field (was nested in streaks.bufferDaysAllowed)
  skipDaysAllowed: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 5
  },
  
  // ✅ Match frontend values exactly
  frequency: { 
    type: String, 
    enum: ['Daily', 'Weekly', 'Monthly'],
    default: 'Daily' 
  },
  
  // ✅ Store as ISO string from frontend
  reminderTime: { 
    type: String, 
    required: true 
  },
  
  // ✅ Simplified streak tracking (per habit)
  streak: { 
    type: Number, 
    default: 0 
  },
  
  longestStreak: { 
    type: Number, 
    default: 0 
  },
  
  lastCompletedDate: { 
    type: Date 
  },
  
  // ✅ Simple array of completion dates (from frontend)
  completedDates: [{ 
    type: Date 
  }],
  
  // ✅ Stats for analytics
  stats: {
    totalCompletions: { type: Number, default: 0 },
    totalPointsEarned: { type: Number, default: 0 }
  },
  
  isActive: { 
    type: Boolean, 
    default: true 
  },
  
  isPaused: { 
    type: Boolean, 
    default: false 
  },
  
  pausedUntil: Date,
  
  // ✅ Track buffer days usage
  bufferDaysUsed: {
    type: Number,
    default: 0
  }
  
}, {
  timestamps: true // Creates createdAt and updatedAt automatically
});

// Indexes for better query performance
habitSchema.index({ userId: 1, isActive: 1 });
habitSchema.index({ userId: 1, category: 1 });
habitSchema.index({ userId: 1, createdAt: -1 });

// Virtual for checking if habit is completed today
habitSchema.virtual('completedToday').get(function() {
  if (!this.completedDates || this.completedDates.length === 0) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return this.completedDates.some(date => {
    const completionDate = new Date(date);
    completionDate.setHours(0, 0, 0, 0);
    return completionDate.getTime() === today.getTime();
  });
});

// Method to check streak (per habit)
habitSchema.methods.updateStreak = function() {
  if (this.completedDates.length === 0) {
    this.streak = 0;
    return;
  }

  // Sort dates in descending order
  const sortedDates = this.completedDates
    .map(d => new Date(d))
    .sort((a, b) => b - a);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentStreak = 0;
  let checkDate = new Date(today);

  for (let i = 0; i < sortedDates.length; i++) {
    const completionDate = new Date(sortedDates[i]);
    completionDate.setHours(0, 0, 0, 0);

    if (completionDate.getTime() === checkDate.getTime()) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (completionDate.getTime() < checkDate.getTime()) {
      break;
    }
  }

  this.streak = currentStreak;
  
  if (currentStreak > this.longestStreak) {
    this.longestStreak = currentStreak;
  }
};

module.exports = mongoose.model('Habit', habitSchema);