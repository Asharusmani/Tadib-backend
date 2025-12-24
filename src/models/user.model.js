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
  
  lastActive: { type: Date, default: Date.now },
  accountStatus: { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active' },
  verificationToken: String,
  isEmailVerified: { type: Boolean, default: false },
  resetPasswordToken: String,
  resetPasswordExpires: Date
}, {
  timestamps: true
});

// userSchema.pre('save', async function(next) {
//   if (!this.isModified('password')) return next();
//   this.password = await bcrypt.hash(this.password, 12);
//   next();
// });

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);