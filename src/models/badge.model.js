// models/badge.model.js
const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
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
    type: String, // URL or emoji
    required: true
  },
  category: {
    type: String,
    enum: ['streak', 'completion', 'social', 'special'],
    default: 'completion'
  },
  rarity: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  requirements: {
    type: {
      type: String,
      enum: ['streak', 'habits_completed', 'points', 'custom'],
      required: true
    },
    value: {
      type: Number,
      required: true
    },
    description: String
  },
  rewardPoints: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries
badgeSchema.index({ category: 1, rarity: 1 });
badgeSchema.index({ isActive: 1 });

module.exports = mongoose.model('Badge', badgeSchema);