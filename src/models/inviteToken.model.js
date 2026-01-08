// ============================================
// FILE: models/inviteToken.model.js (FIXED)
// ============================================
const mongoose = require('mongoose');
const crypto = require('crypto');

const inviteTokenSchema = new mongoose.Schema({
  token: { 
    type: String, 
    required: true, 
    unique: true,  // ✅ This already creates an index - no need for manual index
    default: () => crypto.randomBytes(32).toString('hex')
  },
  
  // Who sent the invite
  invitedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Email of person being invited
  invitedEmail: { 
    type: String, 
    required: true,
    lowercase: true,
    trim: true
  },
  
  // What they're being invited to
  habitId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'SharedHabit', 
    required: true 
  },
  
  // Token status
  status: {
    type: String,
    enum: ['pending', 'accepted', 'expired'],
    default: 'pending'
  },
  
  // When was it used
  usedAt: Date,
  
  // Expire after 7 days
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  }
  
}, {
  timestamps: true
});

// ✅ FIXED: Removed duplicate index on token (line 58)
// inviteTokenSchema.index({ token: 1 }); // ❌ DELETED THIS LINE

// ✅ Keep other useful compound indexes
inviteTokenSchema.index({ invitedEmail: 1, habitId: 1 });
inviteTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired tokens

module.exports = mongoose.model('InviteToken', inviteTokenSchema);