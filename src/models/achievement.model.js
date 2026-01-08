// models/achievement.model.js
const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'lifetime', 'special'],
    default: 'daily'
  },
  tier: {
    type: Number,
    min: 1,
    max: 5,
    default: 1
  },
  goal: {
    type: Number,
    required: true
  },
  unit: {
    type: String,
    enum: ['habits', 'days', 'points', 'tasks'],
    default: 'habits'
  },
  rewardPoints: {
    type: Number,
    default: 0
  },
  rewardBadge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Badge'
  },
  isRepeatable: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
achievementSchema.index({ category: 1, tier: 1 });
achievementSchema.index({ isActive: 1 });

module.exports = mongoose.model('Achievement', achievementSchema);