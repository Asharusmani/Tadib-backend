const mongoose = require('mongoose');

// ✅ Duration mapping
const FREQUENCY_DURATION = {
  'Daily': 1,
  'Weekly': 7,
  'Monthly': 30
};

const habitSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  
  name: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: 50
  },
  
  icon: { 
    type: Number, 
    required: true,
    min: 0,
    max: 15
  },
  
  category: { 
    type: String, 
    enum: ['Spiritual', 'Health', 'Learning', 'Discipline'],
    required: true
  },
  
  isNegative: { 
    type: Boolean, 
    default: false 
  },
  
  points: { 
    type: Number, 
    required: true, 
    default: 10,
    min: 5,
    max: 100
  },
  
  skipDaysAllowed: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 5
  },
  
  frequency: { 
    type: String, 
    enum: ['Daily', 'Weekly', 'Monthly'],
    default: 'Daily' 
  },
  
  reminderTime: { 
    type: String, 
    required: true 
  },
  
  // ✅ Date fields - set by pre-save hook
  startDate: {
    type: Date,
    default: Date.now
  },
  
  endDate: {
    type: Date
  },
  
  durationDays: {
    type: Number
  },
  
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
  
  completedDates: [{ 
    type: Date 
  }],
  
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
  
  bufferDaysUsed: {
    type: Number,
    default: 0
  }
  
}, {
  timestamps: true
});

// ========================================
// ✅ ONLY ONE PRE-SAVE HOOK (ASYNC VERSION)
// ========================================
habitSchema.pre('save', async function() {
  // Calculate dates for new habits or when frequency changes
  if (this.isNew || this.isModified('frequency')) {
    const daysToAdd = FREQUENCY_DURATION[this.frequency] || 1;
    
    if (!this.startDate) {
      this.startDate = new Date();
    }
    
    const endDate = new Date(this.startDate);
    endDate.setDate(endDate.getDate() + daysToAdd);
    this.endDate = endDate;
    this.durationDays = daysToAdd;
    
    console.log('✅ Dates calculated:', {
      name: this.name,
      frequency: this.frequency,
      duration: daysToAdd,
      start: this.startDate.toISOString(),
      end: this.endDate.toISOString()
    });
  }
  // No next() needed with async function
});

// ========================================
// INDEXES
// ========================================
habitSchema.index({ userId: 1, isActive: 1 });
habitSchema.index({ userId: 1, category: 1 });
habitSchema.index({ userId: 1, createdAt: -1 });
habitSchema.index({ userId: 1, endDate: 1 });

// ========================================
// VIRTUALS
// ========================================
habitSchema.virtual('isExpired').get(function() {
  if (!this.endDate) return false;
  return new Date() > this.endDate;
});

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

// ========================================
// METHODS
// ========================================
habitSchema.methods.getRemainingDays = function() {
  if (!this.endDate) return 0;
  const now = new Date();
  const diffTime = this.endDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

habitSchema.methods.updateStreak = function() {
  if (this.completedDates.length === 0) {
    this.streak = 0;
    return;
  }

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

// ========================================
// ENABLE VIRTUALS IN JSON/OBJECT
// ========================================
habitSchema.set('toJSON', { virtuals: true });
habitSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Habit', habitSchema);