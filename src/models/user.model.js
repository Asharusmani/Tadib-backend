// models/user.model.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    trim: true 
  },
  password: { 
    type: String, 
    required: function() { return !this.socialAuth; }
  },
  
  // ✅ User role for authorization
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  },
  
  socialAuth: {
    provider: { type: String, enum: ['google', 'facebook', 'apple'] },
    providerId: String,
    accessToken: String
  },
  
  biometricEnabled: { type: Boolean, default: false },
  
  profile: {
    name: { type: String, required: true },
    avatar: String,
    bio: String,
    phoneNumber: String
  },
  
  islamicGoals: {
    dailyQuranPages: { type: Number, default: 1 },
    fajrPrayer: { type: Boolean, default: true },
    dhikrCount: { type: Number, default: 100 },
    sunnahActs: [{ type: String }],
    preferredQuranicTopics: [{ type: String }]
  },
  
  gamification: {
    totalPoints: { type: Number, default: 0 },
    currentLevel: { type: Number, default: 1 },
    experiencePoints: { type: Number, default: 0 },
    pointsSpent: { type: Number, default: 0 },
    badges: [{
      badgeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Badge' },
      earnedAt: { type: Date, default: Date.now }
    }],
    achievements: [{
      achievementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Achievement' },
      progress: { type: Number, default: 0 },
      completed: { type: Boolean, default: false },
      completedAt: Date
    }]
  },

  dailyStreak: {
    current: { type: Number, default: 0 },
    longest: { type: Number, default: 0 },
    lastCompletedDate: { type: Date }
  },
  
  subscription: {
    plan: { type: String, enum: ['free', 'pro'], default: 'free' },
    startDate: Date,
    endDate: Date,
    autoRenew: { type: Boolean, default: false }
  },
  
  settings: {
    notifications: {
      taskReminders: { type: Boolean, default: true },
      groupActivity: { type: Boolean, default: true },
      quranicVerses: { type: Boolean, default: true },
      achievements: { type: Boolean, default: true }
    },
    privacy: {
      profileVisibility: { type: String, enum: ['public', 'friends', 'private'], default: 'public' },
      showInLeaderboards: { type: Boolean, default: true }
    },
    language: { type: String, default: 'en' },
    timezone: { type: String, default: 'UTC' }
  },
  
  // ✅ Account management fields
  lastActive: { type: Date, default: Date.now },
  accountStatus: { 
    type: String, 
    enum: ['active', 'suspended', 'deleted'], 
    default: 'active' 
  },
  suspensionReason: String,
  
  // ✅ Email verification
  verificationToken: String,
  isEmailVerified: { type: Boolean, default: false },
  
  // ✅ Password reset
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  
  // ✅ Soft delete flag (for isActive checks in middleware)
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// ============================================
// INDEXES FOR BETTER PERFORMANCE
// ============================================
userSchema.index({ email: 1 });
userSchema.index({ 'socialAuth.provider': 1, 'socialAuth.providerId': 1 });
userSchema.index({ accountStatus: 1 });
userSchema.index({ role: 1 });

// ============================================
// VIRTUAL FIELDS
// ============================================

// Check if user is pro
userSchema.virtual('isPro').get(function() {
  return this.subscription?.plan === 'pro' && 
         this.subscription?.endDate && 
         new Date(this.subscription.endDate) > new Date();
});

// Check if account is suspended
userSchema.virtual('isSuspended').get(function() {
  return this.accountStatus === 'suspended';
});

// ============================================
// MIDDLEWARE - ✅ FIXED
// ============================================

// ✅ Hash password before saving (FIXED - removed next() with async)
userSchema.pre('save', async function() {
  // Only hash password if it's modified
  if (!this.isModified('password')) return;
  
  // Don't hash if using social auth
  if (this.socialAuth?.provider) return;
  
  // Check if password is already hashed (bcrypt hashes start with $2a$ or $2b$)
  if (this.password && !this.password.startsWith('$2a$') && !this.password.startsWith('$2b$')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
});

// ✅ Update lastActive on every save (FIXED - removed next())
userSchema.pre('save', function() {
  this.lastActive = new Date();
});

// ✅ Sync isActive with accountStatus (FIXED - removed next())
userSchema.pre('save', function() {
  this.isActive = this.accountStatus === 'active';
});

// ============================================
// METHODS
// ============================================

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Add points and update level
userSchema.methods.addPoints = async function(points) {
  this.gamification.totalPoints += points;
  this.gamification.experiencePoints += points;
  
  // Level up logic (100 points per level)
  const newLevel = Math.floor(this.gamification.experiencePoints / 100) + 1;
  if (newLevel > this.gamification.currentLevel) {
    this.gamification.currentLevel = newLevel;
  }
  
  await this.save();
  return this.gamification;
};

// Award badge
userSchema.methods.awardBadge = async function(badgeId) {
  const hasBadge = this.gamification.badges.some(
    b => b.badgeId.toString() === badgeId.toString()
  );
  
  if (!hasBadge) {
    this.gamification.badges.push({
      badgeId,
      earnedAt: new Date()
    });
    await this.save();
  }
  
  return this.gamification.badges;
};

// Update achievement progress
userSchema.methods.updateAchievement = async function(achievementId, progress) {
  const achievement = this.gamification.achievements.find(
    a => a.achievementId.toString() === achievementId.toString()
  );
  
  if (achievement) {
    achievement.progress = progress;
    if (progress >= 100 && !achievement.completed) {
      achievement.completed = true;
      achievement.completedAt = new Date();
    }
  } else {
    this.gamification.achievements.push({
      achievementId,
      progress,
      completed: progress >= 100,
      completedAt: progress >= 100 ? new Date() : undefined
    });
  }
  
  await this.save();
  return this.gamification.achievements;
};

// Update daily streak
userSchema.methods.updateStreak = async function(completed = true) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const lastCompleted = this.dailyStreak.lastCompletedDate 
    ? new Date(this.dailyStreak.lastCompletedDate)
    : null;
  
  if (lastCompleted) {
    lastCompleted.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((today - lastCompleted) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 1 && completed) {
      // Consecutive day
      this.dailyStreak.current += 1;
    } else if (daysDiff > 1) {
      // Streak broken
      this.dailyStreak.current = completed ? 1 : 0;
    }
    // If daysDiff === 0, same day completion (don't increment)
  } else if (completed) {
    // First completion
    this.dailyStreak.current = 1;
  }
  
  // Update longest streak
  if (this.dailyStreak.current > this.dailyStreak.longest) {
    this.dailyStreak.longest = this.dailyStreak.current;
  }
  
  if (completed) {
    this.dailyStreak.lastCompletedDate = today;
  }
  
  await this.save();
  return this.dailyStreak;
};

// Check if subscription is active
userSchema.methods.hasActiveSubscription = function() {
  if (this.subscription.plan === 'free') return false;
  
  const now = new Date();
  return this.subscription.endDate && new Date(this.subscription.endDate) > now;
};

// Upgrade to pro
userSchema.methods.upgradeToPro = async function(duration = 30) {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + duration);
  
  this.subscription = {
    plan: 'pro',
    startDate,
    endDate,
    autoRenew: false
  };
  
  await this.save();
  return this.subscription;
};

// ============================================
// STATIC METHODS
// ============================================

// Find by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Find active users
userSchema.statics.findActiveUsers = function() {
  return this.find({ accountStatus: 'active', isActive: true });
};

// Find pro users
userSchema.statics.findProUsers = function() {
  return this.find({ 
    'subscription.plan': 'pro',
    'subscription.endDate': { $gt: new Date() }
  });
};

// Get leaderboard
userSchema.statics.getLeaderboard = async function(limit = 10) {
  return this.find({
    accountStatus: 'active',
    'settings.privacy.showInLeaderboards': true
  })
  .select('profile.name profile.avatar gamification.totalPoints dailyStreak')
  .sort({ 'gamification.totalPoints': -1 })
  .limit(limit)
  .lean();
};

// ============================================
// QUERY HELPERS
// ============================================

// Only active accounts
userSchema.query.active = function() {
  return this.where({ accountStatus: 'active', isActive: true });
};

// Only verified emails
userSchema.query.verified = function() {
  return this.where({ isEmailVerified: true });
};

// Only pro users
userSchema.query.pro = function() {
  return this.where({ 'subscription.plan': 'pro' });
};

// ============================================
// EXPORT
// ============================================

module.exports = mongoose.model('User', userSchema);