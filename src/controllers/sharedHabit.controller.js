// ============================================
// FILE: controllers/sharedHabit.controller.js (COMPLETE FIXED)
// ============================================
const SharedHabit = require('../models/sharedHabit.model');
const InviteToken = require('../models/inviteToken.model');
const User = require('../models/user.model');
const NotificationService = require('../services/notification.service');
const MessagingService = require('../services/messaging.service');
const moment = require('moment');
const Notification = require('../models/notification.model');

// ============================================
// FILE: controllers/sharedHabit.controller.js
// REPLACE ONLY THE createSharedHabit FUNCTION
// ============================================

// Add these requires at the top of your controller file if not already there:



// ✅ CREATE SHARED HABIT (FIXED)
exports.createSharedHabit = async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const {
      name,           // Frontend sends 'name'
      icon,
      category,
      isNegative,
      points,
      skipDaysAllowed,
      frequency,
      reminderTime
    } = req.body;

    console.log('📥 Received habit data:', req.body);

    // ✅ Validate required fields
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Habit name is required'
      });
    }

    if (icon === null || icon === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Icon is required'
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category is required'
      });
    }

    // ✅ Map category names to match SharedHabit model enum
    // Model enum: ['spiritual', 'health', 'learning', 'discipline', 'custom']
    const categoryMap = {
      'Spiritual': 'spiritual',
      'Health': 'health',
      'Learning': 'learning',      // ✅ Direct match
      'Discipline': 'discipline',   // ✅ Direct match
    };

    const mappedCategory = categoryMap[category] || 'custom';

    console.log('📊 Category mapping:', {
      original: category,
      mapped: mappedCategory
    });

    // ✅ Calculate duration based on frequency
    const durationMap = {
      'Daily': 30,
      'Weekly': 12,
      'Monthly': 6
    };

    const durationDays = durationMap[frequency] || 30;

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);

    console.log('✅ Dates calculated:', {
      name,
      frequency,
      duration: durationDays,
      start: startDate.toISOString(),
      end: endDate.toISOString()
    });

    // Get user email for participants array
    const User = require('../models/user.model');
    const creator = await User.findById(userId);

    if (!creator) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // ✅ Create SharedHabit with correct field mapping
    const sharedHabit = new SharedHabit({
      title: name,  // ✅ Map 'name' to 'title'
      description: `${frequency} ${name}`,
      category: mappedCategory,  // ✅ Use mapped category
      createdBy: userId,
      
      // ✅ Add creator as first accepted participant with email
      participants: [{
        userId: userId,
        email: creator.email,
        status: 'accepted',
        joinedAt: new Date()
      }],
      
      // Shared streak initialization
      sharedStreak: {
        current: 0,
        longest: 0,
        consecutiveDays: []
      },
      
      // Daily completions array (empty initially)
      dailyCompletions: [],
      
      // Rules
      rules: {
        requireAllParticipants: true,
        allowPartialCredit: false,
        minimumCompletionPercentage: 100
      },
      
      // Notifications
      notifications: {
        reminderEnabled: true,
        reminderTime: reminderTime ? new Date(reminderTime).toTimeString().slice(0, 5) : '09:00',
        notifyOnStreak: true,
        notifyOnBreak: true
      },
      
      // Stats initialization
      stats: {
        totalDays: 0,
        successfulDays: 0,
        failedDays: 0,
        successRate: 0,
        totalPoints: 0
      },
      
      isActive: true
    });

    await sharedHabit.save();

    console.log('✅ Shared habit created:', {
      id: sharedHabit._id,
      title: sharedHabit.title,
      category: sharedHabit.category,
      participants: sharedHabit.participants.length,
      creator: creator.email
    });

    // ✅ Return response in format expected by frontend
    res.status(201).json({
      success: true,
      message: `Shared habit "${name}" created successfully! Duration: ${durationDays} days (${frequency})`,
      habit: {
        _id: sharedHabit._id,
        title: sharedHabit.title,
        description: sharedHabit.description,
        category: sharedHabit.category,
        createdBy: sharedHabit.createdBy,
        participants: sharedHabit.participants,
        sharedStreak: sharedHabit.sharedStreak,
        stats: sharedHabit.stats,
        isActive: sharedHabit.isActive,
        createdAt: sharedHabit.createdAt,
        durationDays: durationDays  // ✅ Include this for frontend display
      }
    });

  } catch (error) {
    console.error('❌ Create shared habit error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create shared habit',
      error: error.message
    });
  }
};

/**
 * ✅ FIXED: Invite participant with email included
 * Add this to: controllers/sharedHabit.controller.js
 */

exports.inviteParticipant = async (req, res) => {
  try {
    const { habitId } = req.params;
    const { email } = req.body;
    const inviterId = req.userId; // The person sending the invite

    console.log('=== INVITE PARTICIPANT DEBUG ===');
    console.log('habitId:', habitId);
    console.log('email:', email);
    console.log('inviterId:', inviterId);

    // Find the shared habit
    const sharedHabit = await SharedHabit.findById(habitId);
    if (!sharedHabit) {
      return res.status(404).json({ 
        success: false, 
        error: 'Shared habit not found' 
      });
    }

    // ✅ Get inviter's information
    const inviter = await User.findById(inviterId).select('username email');
    if (!inviter) {
      return res.status(404).json({ 
        success: false, 
        error: 'Inviter not found' 
      });
    }

    console.log('Inviter:', inviter.username || inviter.email);

    // Find the user being invited
    const invitee = await User.findOne({ email }).select('_id username email');
    
    if (!invitee) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found with this email' 
      });
    }

    console.log('Invitee found:', invitee.username || invitee.email);

    // Check if already a participant
    const isAlreadyParticipant = sharedHabit.participants.some(
      p => p.userId.toString() === invitee._id.toString() || p.email === email
    );

    if (isAlreadyParticipant) {
      return res.status(400).json({ 
        success: false, 
        error: 'User is already a participant' 
      });
    }

    // ✅ CRITICAL FIX: Include email in the participant object
    sharedHabit.participants.push({
      userId: invitee._id,
      email: invitee.email,  // ← THIS WAS MISSING!
      status: 'pending',
      joinedAt: null,
      invitedAt: new Date()
    });

    await sharedHabit.save();
    console.log('✅ Added user to participants (pending) with email');

    // ✅ CREATE NOTIFICATION WITH SENDER NAME AND ACTIONS
    const notification = await Notification.create({
      userId: invitee._id,
      type: 'habit_invitation',
      title: `Habit Invitation from ${inviter.username || inviter.email}`,
      body: `${inviter.username || inviter.email} invited you to join "${sharedHabit.title}" habit. Accept to start tracking together!`,
      
      // ✅ Link to the shared habit
      relatedEntity: {
        entityType: 'shared_habit',
        entityId: sharedHabit._id
      },
      
      // ✅ ADD ACTION BUTTONS
      actions: [
        {
          actionType: 'accept',
          label: 'Accept'
        },
        {
          actionType: 'reject',
          label: 'Decline'
        }
      ],
      
      isRead: false,
      isDelivered: true,
      sentAt: new Date()
    });

    console.log('✅ Notification created with actions:', notification._id);

    // Return updated habit with inviter info
    const populatedHabit = await SharedHabit.findById(habitId)
      .populate('createdBy', 'username email')
      .populate('participants.userId', 'username email');

    res.status(200).json({
      success: true,
      message: 'Invitation sent successfully',
      habit: populatedHabit,
      notification: notification
    });

  } catch (error) {
    console.error('❌ Error inviting participant:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};


// ============================================
// REPLACE acceptInvitation() function with this:
// ============================================

// ✅ ACCEPT INVITATION (IN-APP - Existing User) - WITH NOTIFICATION TO CREATOR
exports.acceptInvitation = async (req, res) => {
  try {
    const { habitId } = req.params;
    const userId = req.userId || req.user._id;

    console.log("=== ACCEPT INVITATION DEBUG ===");
    console.log("habitId:", habitId);
    console.log("userId:", userId);
    
    const sharedHabit = await SharedHabit.findById(habitId);
    
    if (!sharedHabit) {
      console.log("❌ Habit not found in database");
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }
    
    console.log("✅ Habit found:", sharedHabit.title);
    
    // Get user email
    const user = await User.findById(userId);
    if (!user) {
      console.log("❌ User not found");
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    console.log("✅ User found:", user.email);
    console.log("All participants:", sharedHabit.participants);
    
    // Find participant by email
    const participant = sharedHabit.participants.find(
      p => p.email === user.email && p.status === 'pending'
    );
    
    console.log("Participant found:", participant);
    
    if (!participant) {
      console.log("❌ No pending invitation found for email:", user.email);
      return res.status(404).json({ 
        success: false, 
        message: 'No pending invitation found for your email' 
      });
    }
    
    // Accept invitation
    participant.userId = userId;
    participant.status = 'accepted';
    participant.joinedAt = new Date();
    
    console.log("✅ Participant updated:", participant);
    
    await sharedHabit.save();
    
    console.log("✅ Habit saved successfully");
    
    // ✅✅✅ NEW: SEND NOTIFICATION TO CREATOR
    try {
      const creator = await User.findById(sharedHabit.createdBy);
      
      if (creator) {
        const accepterName = user.username || user.name || user.email.split('@')[0];
        
        await Notification.create({
          userId: creator._id,
          type: 'habit_invitation',
          title: '✅ Invitation Accepted',
          body: `${accepterName} accepted your invitation to join "${sharedHabit.title}" habit!`,
          
          relatedEntity: {
            entityType: 'shared_habit',
            entityId: sharedHabit._id
          },
          
          isRead: false,
          isDelivered: true,
          sentAt: new Date()
        });
        
        console.log(`✅ Acceptance notification sent to creator: ${creator.email}`);
      }
    } catch (notifError) {
      console.error('⚠️ Failed to send acceptance notification:', notifError);
      // Don't fail the request if notification fails
    }
    
    res.json({ 
      success: true, 
      message: 'Invitation accepted successfully',
      data: sharedHabit 
    });
    
  } catch (error) {
    console.error('❌ Accept invitation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};


// ============================================
// REPLACE declineInvitation() function with this:
// ============================================

// ✅ DECLINE INVITATION - WITH NOTIFICATION TO CREATOR
exports.declineInvitation = async (req, res) => {
  try {
    const { habitId } = req.params;
    const userId = req.userId || req.user._id;
    
    const sharedHabit = await SharedHabit.findById(habitId);
    
    if (!sharedHabit) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }
    
    const user = await User.findById(userId);
    
    // Find by email OR userId
    const participant = sharedHabit.participants.find(
      p => (p.email === user.email || (p.userId && p.userId.toString() === userId.toString())) 
           && p.status === 'pending'
    );
    
    if (participant) {
      participant.status = 'declined';
      await sharedHabit.save();
      
      // ✅✅✅ NEW: SEND NOTIFICATION TO CREATOR
      try {
        const creator = await User.findById(sharedHabit.createdBy);
        
        if (creator) {
          const declinerName = user.username || user.name || user.email.split('@')[0];
          
          await Notification.create({
            userId: creator._id,
            type: 'habit_invitation',
            title: '❌ Invitation Declined',
            body: `${declinerName} declined your invitation to join "${sharedHabit.title}" habit.`,
            
            relatedEntity: {
              entityType: 'shared_habit',
              entityId: sharedHabit._id
            },
            
            isRead: false,
            isDelivered: true,
            sentAt: new Date()
          });
          
          console.log(`✅ Decline notification sent to creator: ${creator.email}`);
        }
      } catch (notifError) {
        console.error('⚠️ Failed to send decline notification:', notifError);
        // Don't fail the request if notification fails
      }
    }
    
    res.json({ success: true, message: 'Invitation declined' });
  } catch (error) {
    console.error('Decline invitation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};


/**
 * ✅ NEW: Reject invitation
 */
exports.rejectInvitation = async (req, res) => {
  try {
    const { habitId } = req.params;
    const userId = req.userId;

    const sharedHabit = await SharedHabit.findById(habitId);
    if (!sharedHabit) {
      return res.status(404).json({ 
        success: false, 
        error: 'Shared habit not found' 
      });
    }

    // Remove from participants
    sharedHabit.participants = sharedHabit.participants.filter(
      p => p.userId.toString() !== userId.toString()
    );
    
    await sharedHabit.save();

    // Mark notification as read
    await Notification.updateMany(
      {
        userId: userId,
        'relatedEntity.entityId': habitId,
        'relatedEntity.entityType': 'shared_habit',
        type: 'habit_invitation'
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    res.status(200).json({
      success: true,
      message: 'Invitation declined'
    });

  } catch (error) {
    console.error('❌ Error rejecting invitation:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// // ✅ ACCEPT INVITATION (IN-APP - Existing User)
// exports.acceptInvitation = async (req, res) => {
//   try {
//     const { habitId } = req.params;
//     const userId = req.userId || req.user._id;

//     console.log("=== ACCEPT INVITATION DEBUG ===");
//     console.log("habitId:", habitId);
//     console.log("userId:", userId);
    
//     const sharedHabit = await SharedHabit.findById(habitId);
    
//     if (!sharedHabit) {
//       console.log("❌ Habit not found in database");
//       return res.status(404).json({ success: false, message: 'Habit not found' });
//     }
    
//     console.log("✅ Habit found:", sharedHabit.title);
    
//     // Get user email
//     const user = await User.findById(userId);
//     if (!user) {
//       console.log("❌ User not found");
//       return res.status(404).json({ success: false, message: 'User not found' });
//     }
    
//     console.log("✅ User found:", user.email);
//     console.log("All participants:", sharedHabit.participants);
    
//     // Find participant by email
//     const participant = sharedHabit.participants.find(
//       p => p.email === user.email && p.status === 'pending'
//     );
    
//     console.log("Participant found:", participant);
    
//     if (!participant) {
//       console.log("❌ No pending invitation found for email:", user.email);
//       return res.status(404).json({ 
//         success: false, 
//         message: 'No pending invitation found for your email' 
//       });
//     }
    
//     // Accept invitation
//     participant.userId = userId;
//     participant.status = 'accepted';
//     participant.joinedAt = new Date();
    
//     console.log("✅ Participant updated:", participant);
    
//     await sharedHabit.save();
    
//     console.log("✅ Habit saved successfully");
    
//     res.json({ 
//       success: true, 
//       message: 'Invitation accepted successfully',
//       data: sharedHabit 
//     });
    
//   } catch (error) {
//     console.error('❌ Accept invitation error:', error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// ✅ VERIFY INVITE TOKEN (For new users - NO AUTH NEEDED)
exports.verifyInviteToken = async (req, res) => {
  try {
    const { token } = req.params;
    
    console.log("=== VERIFY INVITE TOKEN ===");
    console.log("token:", token);
    
    const inviteToken = await InviteToken.findOne({ token, status: 'pending' })
      .populate('invitedBy', 'name email')
      .populate('habitId', 'title description');
    
    if (!inviteToken) {
      console.log("❌ Token not found or already used");
      return res.status(404).json({ 
        success: false, 
        message: 'Invalid or expired invite link' 
      });
    }
    
    console.log("✅ Token found, checking expiry...");
    
    // Check if expired
    if (new Date() > inviteToken.expiresAt) {
      console.log("❌ Token expired");
      inviteToken.status = 'expired';
      await inviteToken.save();
      
      return res.status(400).json({ 
        success: false, 
        message: 'Invite link has expired' 
      });
    }
    
    console.log("✅ Token valid");
    
    res.json({ 
      success: true, 
      data: {
        email: inviteToken.invitedEmail,
        inviterName: inviteToken.invitedBy.name,
        habitTitle: inviteToken.habitId.title,
        habitDescription: inviteToken.habitId.description
      }
    });
    
  } catch (error) {
    console.error('❌ Verify token error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ ACCEPT INVITE AFTER SIGNUP (New users)
exports.acceptInviteAfterSignup = async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.userId || req.user._id;
    
    console.log("=== ACCEPT INVITE AFTER SIGNUP ===");
    console.log("token:", token);
    console.log("userId:", userId);
    
    const inviteToken = await InviteToken.findOne({ token, status: 'pending' });
    
    if (!inviteToken) {
      console.log("❌ Invalid token");
      return res.status(404).json({ 
        success: false, 
        message: 'Invalid invite token' 
      });
    }
    
    console.log("✅ Token valid, finding habit...");
    
    const user = await User.findById(userId);
    const sharedHabit = await SharedHabit.findById(inviteToken.habitId);
    
    if (!sharedHabit) {
      console.log("❌ Habit not found");
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }
    
    console.log("✅ Habit found, updating participant...");
    
    // Find participant by email
    const participant = sharedHabit.participants.find(
      p => p.email === inviteToken.invitedEmail && p.status === 'pending'
    );
    
    if (participant) {
      participant.userId = userId;
      participant.status = 'accepted';
      participant.joinedAt = new Date();
      
      await sharedHabit.save();
      console.log("✅ Participant updated");
    } else {
      console.log("⚠️ Participant not found, adding new...");
      // If participant entry doesn't exist, create it
      sharedHabit.participants.push({
        userId: userId,
        email: inviteToken.invitedEmail,
        status: 'accepted',
        joinedAt: new Date()
      });
      await sharedHabit.save();
    }
    
    // Mark token as used
    inviteToken.status = 'accepted';
    inviteToken.usedAt = new Date();
    await inviteToken.save();
    
    console.log("✅ Token marked as accepted");
    
    res.json({ 
      success: true, 
      message: 'Successfully joined habit',
      data: sharedHabit 
    });
    
  } catch (error) {
    console.error('❌ Accept invite after signup error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// // ✅ DECLINE INVITATION
// exports.declineInvitation = async (req, res) => {
//   try {
//     const { habitId } = req.params;
//     const userId = req.userId || req.user._id;
    
//     const sharedHabit = await SharedHabit.findById(habitId);
    
//     if (!sharedHabit) {
//       return res.status(404).json({ success: false, message: 'Habit not found' });
//     }
    
//     const user = await User.findById(userId);
    
//     // Find by email OR userId
//     const participant = sharedHabit.participants.find(
//       p => (p.email === user.email || (p.userId && p.userId.toString() === userId.toString())) 
//            && p.status === 'pending'
//     );
    
//     if (participant) {
//       participant.status = 'declined';
//       await sharedHabit.save();
//     }
    
//     res.json({ success: true, message: 'Invitation declined' });
//   } catch (error) {
//     console.error('Decline invitation error:', error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// ✅ GET MY SHARED HABITS
exports.getMySharedHabits = async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    
    const habits = await SharedHabit.find({
      'participants.userId': userId,
      'participants.status': 'accepted',
      isActive: true
    }).populate('participants.userId', 'name email');
    
    res.json({ success: true, data: habits });
  } catch (error) {
    console.error('Get shared habits error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ GET SHARED HABIT DETAILS
exports.getSharedHabitDetails = async (req, res) => {
  try {
    const habit = await SharedHabit.findById(req.params.habitId)
      .populate('participants.userId', 'name email')
      .populate('createdBy', 'name email');
    
    if (!habit) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }
    
    res.json({ success: true, data: habit });
  } catch (error) {
    console.error('Get habit details error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ GET COMPLETION HISTORY
exports.getCompletionHistory = async (req, res) => {
  try {
    const habit = await SharedHabit.findById(req.params.habitId);
    
    if (!habit) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }
    
    res.json({ success: true, data: habit.dailyCompletions });
  } catch (error) {
    console.error('Get completion history error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ GET STREAK INFO
exports.getStreakInfo = async (req, res) => {
  try {
    const habit = await SharedHabit.findById(req.params.habitId);
    
    if (!habit) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }
    
    res.json({ success: true, data: habit.sharedStreak });
  } catch (error) {
    console.error('Get streak info error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ COMPLETE TASK
exports.completeTask = async (req, res) => {
  try {
    const { habitId } = req.params;
    const userId = req.userId || req.user._id;
    
    const sharedHabit = await SharedHabit.findById(habitId).populate('participants.userId');
    
    if (!sharedHabit) {
      return res.status(404).json({ success: false, message: 'Shared habit not found' });
    }
    
    // Check if user is participant
    const isParticipant = sharedHabit.participants.some(
      p => p.userId && p.userId._id.toString() === userId.toString() && p.status === 'accepted'
    );
    
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'You are not a participant' });
    }
    
    const today = moment().startOf('day').toDate();
    
    // Find or create today's completion record
    let todayCompletion = sharedHabit.dailyCompletions.find(
      dc => moment(dc.date).isSame(today, 'day')
    );
    
    if (!todayCompletion) {
      todayCompletion = {
        date: today,
        completedBy: [],
        allCompleted: false,
        missedBy: [],
        countedAsDay: false
      };
      sharedHabit.dailyCompletions.push(todayCompletion);
    }
    
    // Check if already completed today
    const alreadyCompleted = todayCompletion.completedBy.some(
      c => c.userId.toString() === userId.toString()
    );
    
    if (alreadyCompleted) {
      return res.status(400).json({ 
        success: false, 
        message: 'You already completed this task today' 
      });
    }
    
    // Mark as completed
    todayCompletion.completedBy.push({
      userId: userId,
      completedAt: new Date()
    });
    
    // Increment totalDays only ONCE per day
    if (!todayCompletion.countedAsDay) {
      sharedHabit.stats.totalDays += 1;
      todayCompletion.countedAsDay = true;
    }
    
    // Get all ACCEPTED participants
    const acceptedParticipants = sharedHabit.participants.filter(p => p.status === 'accepted');
    const totalAcceptedCount = acceptedParticipants.length;
    const completedCount = todayCompletion.completedBy.length;
    
    // Check if ALL participants completed
    const allCompleted = completedCount >= totalAcceptedCount;
    todayCompletion.allCompleted = allCompleted;
    
    if (allCompleted) {
      // ALL COMPLETED - INCREMENT STREAK!
      sharedHabit.sharedStreak.current += 1;
      sharedHabit.sharedStreak.lastCompletedDate = new Date();
      sharedHabit.sharedStreak.consecutiveDays.push(today);
      
      if (sharedHabit.sharedStreak.current > sharedHabit.sharedStreak.longest) {
        sharedHabit.sharedStreak.longest = sharedHabit.sharedStreak.current;
      }
      
      sharedHabit.stats.successfulDays += 1;
      
      // Notify all participants about streak
      if (sharedHabit.notifications.notifyOnStreak) {
        for (const participant of acceptedParticipants) {
          await NotificationService.createNotification(participant.userId._id, {
            type: 'streak_milestone',
            title: 'Streak Milestone! 🔥',
            body: `Streak ${sharedHabit.sharedStreak.current}! Everyone completed "${sharedHabit.title}" today!`,
            relatedEntity: {
              entityType: 'shared_habit',
              entityId: sharedHabit._id
            }
          });
        }
      }
    } else {
      // Not everyone completed yet - send reminder to others
      const notCompletedYet = acceptedParticipants.filter(
        p => !todayCompletion.completedBy.some(c => c.userId.toString() === p.userId._id.toString())
      );
      
      const completedUser = req.user || await User.findById(userId);
      
      for (const participant of notCompletedYet) {
        await NotificationService.createNotification(participant.userId._id, {
          type: 'reminder',
          title: 'Reminder ⏰',
          body: `${completedUser.name || 'Someone'} completed "${sharedHabit.title}". Don't break the streak!`,
          relatedEntity: {
            entityType: 'shared_habit',
            entityId: sharedHabit._id
          }
        });
      }
    }
    
    await sharedHabit.save();
    
    res.json({
      success: true,
      message: allCompleted ? 'All completed! Streak increased!' : 'Task completed. Waiting for others.',
      data: {
        habitId: sharedHabit._id,
        currentStreak: sharedHabit.sharedStreak.current,
        allCompleted: allCompleted,
        completedCount: completedCount,
        totalParticipants: totalAcceptedCount,
        pointsEarned: allCompleted ? 20 : 0,
        stats: {
          totalDays: sharedHabit.stats.totalDays,
          successfulDays: sharedHabit.stats.successfulDays,
          successRate: sharedHabit.stats.successRate
        }
      }
    });
    
  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ UNDO COMPLETION
exports.undoCompletion = async (req, res) => {
  try {
    const { habitId } = req.params;
    const userId = req.userId || req.user._id;
    
    const sharedHabit = await SharedHabit.findById(habitId);
    
    if (!sharedHabit) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }
    
    const today = moment().startOf('day').toDate();
    const todayCompletion = sharedHabit.dailyCompletions.find(
      dc => moment(dc.date).isSame(today, 'day')
    );
    
    if (!todayCompletion) {
      return res.status(400).json({ success: false, message: 'No completion found for today' });
    }
    
    const completionIndex = todayCompletion.completedBy.findIndex(
      c => c.userId.toString() === userId.toString()
    );
    
    if (completionIndex === -1) {
      return res.status(400).json({ success: false, message: 'You have not completed this task today' });
    }
    
    // Remove completion
    todayCompletion.completedBy.splice(completionIndex, 1);
    
    // Recalculate if all completed
    const acceptedParticipants = sharedHabit.participants.filter(p => p.status === 'accepted');
    const allCompleted = todayCompletion.completedBy.length >= acceptedParticipants.length;
    
    // If it WAS all completed but now it's not, revert streak
    if (todayCompletion.allCompleted && !allCompleted) {
      sharedHabit.sharedStreak.current = Math.max(0, sharedHabit.sharedStreak.current - 1);
      sharedHabit.stats.successfulDays = Math.max(0, sharedHabit.stats.successfulDays - 1);
      
      if (sharedHabit.sharedStreak.consecutiveDays.length > 0) {
        sharedHabit.sharedStreak.consecutiveDays.pop();
      }
    }
    
    todayCompletion.allCompleted = allCompleted;
    
    // If no one has completed today anymore, reset countedAsDay
    if (todayCompletion.completedBy.length === 0) {
      todayCompletion.countedAsDay = false;
      sharedHabit.stats.totalDays = Math.max(0, sharedHabit.stats.totalDays - 1);
    }
    
    await sharedHabit.save();
    
    res.json({
      success: true,
      message: 'Completion undone',
      data: {
        currentStreak: sharedHabit.sharedStreak.current,
        completedCount: todayCompletion.completedBy.length
      }
    });
    
  } catch (error) {
    console.error('Undo completion error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ LEAVE SHARED HABIT
exports.leaveSharedHabit = async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const habit = await SharedHabit.findById(req.params.habitId);
    
    if (!habit) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }
    
    habit.participants = habit.participants.filter(
      p => !p.userId || p.userId.toString() !== userId.toString()
    );
    
    await habit.save();
    
    res.json({ success: true, message: 'Left habit successfully' });
  } catch (error) {
    console.error('Leave habit error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ DELETE SHARED HABIT
exports.deleteSharedHabit = async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const habit = await SharedHabit.findById(req.params.habitId);
    
    if (!habit) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }
    
    if (habit.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Only creator can delete' });
    }
    
    habit.isActive = false;
    await habit.save();
    
    res.json({ success: true, message: 'Habit deleted successfully' });
  } catch (error) {
    console.error('Delete habit error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ CHECK AND RESET STREAKS (Cron job function)
exports.checkAndResetStreaks = async () => {
  try {
    const yesterday = moment().subtract(1, 'day').startOf('day').toDate();
    
    const activeHabits = await SharedHabit.find({ isActive: true });
    
    for (const habit of activeHabits) {
      const yesterdayCompletion = habit.dailyCompletions.find(
        dc => moment(dc.date).isSame(yesterday, 'day')
      );
      
      // If yesterday exists but not all completed - RESET STREAK
      if (yesterdayCompletion && !yesterdayCompletion.allCompleted) {
        
        if (habit.sharedStreak.current > 0) {
          habit.sharedStreak.current = 0;
          habit.sharedStreak.consecutiveDays = [];
          habit.stats.failedDays += 1;
          
          if (habit.notifications.notifyOnBreak) {
            const acceptedParticipants = habit.participants.filter(p => p.status === 'accepted');
            
            for (const participant of acceptedParticipants) {
              if (participant.userId) {
                await NotificationService.createNotification(participant.userId, {
                  type: 'streak_broken',
                  title: 'Streak Broken 💔',
                  body: `Streak broken for "${habit.title}". Not everyone completed yesterday.`,
                  relatedEntity: {
                    entityType: 'shared_habit',
                    entityId: habit._id
                  }
                });
              }
            }
          }
          
          await habit.save();
        }
      }
      
      // If yesterday doesn't exist at all and there was a streak - also break it
      if (!yesterdayCompletion && habit.sharedStreak.current > 0) {
        habit.sharedStreak.current = 0;
        habit.sharedStreak.consecutiveDays = [];
        habit.stats.failedDays += 1;
        await habit.save();
      }
    }
    
    console.log('✅ Streak check completed at', new Date().toISOString());
    
  } catch (error) {
    console.error('❌ Check streaks error:', error);
  }
};