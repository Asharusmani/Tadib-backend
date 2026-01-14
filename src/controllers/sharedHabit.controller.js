// ============================================
// FILE: controllers/sharedHabit.controller.js (NOTIFICATION FIX)
// ============================================
const SharedHabit = require('../models/sharedHabit.model');
const User = require('../models/user.model');
const Notification = require('../models/notification.model');
const NotificationService = require('../services/notification.service');
const MessagingService = require('../services/messaging.service');
const crypto = require('crypto');
const moment = require('moment');

// ========================================
// CREATE SHARED HABIT
// ========================================
exports.createSharedHabit = async (req, res) => {
  try {
    const { title, description, category, emails } = req.body;
    const creatorId = req.userId;

    console.log('📝 Creating shared habit:', { title, category, emails });

    // Validate required fields
    if (!title || !category) {
      return res.status(400).json({
        success: false,
        message: 'Title and category are required'
      });
    }

    // Create shared habit
    const sharedHabit = new SharedHabit({
      title,
      description: description || '',
      category,
      createdBy: creatorId,
      participants: [{
        userId: creatorId,
        email: req.user.email,
        status: 'accepted',
        joinedAt: new Date()
      }]
    });

    await sharedHabit.save();
    console.log('✅ Shared habit created:', sharedHabit._id);

    // If emails provided, send invites
    if (emails && emails.length > 0) {
      for (const email of emails) {
        try {
          await sendInvitation(sharedHabit._id, email, creatorId, req.user.email);
        } catch (inviteError) {
          console.error('⚠️ Failed to send invite to:', email, inviteError.message);
        }
      }
    }

    // Populate creator info
    await sharedHabit.populate('createdBy', 'username name email');

    res.status(201).json({
      success: true,
      message: 'Shared habit created successfully',
      data: sharedHabit
    });

  } catch (error) {
    console.error('❌ Create shared habit error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create shared habit'
    });
  }
};

// ========================================
// INVITE PARTICIPANT
// ========================================
exports.inviteParticipant = async (req, res) => {
  try {
    const { habitId } = req.params;
    const { email } = req.body;
    const inviterId = req.userId;

    console.log('📧 Inviting participant:', { habitId, email });

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required'
      });
    }

    const habit = await SharedHabit.findById(habitId);
    if (!habit) {
      return res.status(404).json({
        success: false,
        message: 'Habit not found'
      });
    }

    // Check if user is participant
    const isParticipant = habit.participants.some(
      p => p.userId && p.userId.toString() === inviterId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Only participants can invite others'
      });
    }

    // Check if already invited
    const alreadyInvited = habit.participants.some(
      p => p.email === email.toLowerCase()
    );

    if (alreadyInvited) {
      return res.status(400).json({
        success: false,
        message: 'User already invited or is a participant'
      });
    }

    const result = await sendInvitation(habitId, email, inviterId, req.user.email);

    res.json({
      success: true,
      message: result.message,
      inviteType: result.inviteType,
      inviteLink: result.inviteLink
    });

  } catch (error) {
    console.error('❌ Invite participant error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send invitation'
    });
  }
};

// ============================================
// FIXED: Send Invitation Helper
// Replace lines 77-169 in sharedHabit.controller.js
// ============================================
async function sendInvitation(habitId, email, inviterId, inviterEmail) {
  const habit = await SharedHabit.findById(habitId).populate('createdBy', 'username name email');
  
  // ✅ Check if email is already in participants (any status)
  const existingParticipant = habit.participants.find(p => 
    p.email && p.email.toLowerCase() === email.toLowerCase()
  );

  if (existingParticipant) {
    if (existingParticipant.status === 'accepted') {
      throw new Error('User is already a participant');
    } else if (existingParticipant.status === 'pending') {
      throw new Error('Invitation already sent to this email');
    }
  }

  // Check if user exists in database
  const invitedUser = await User.findOne({ email: email.toLowerCase() });

  if (invitedUser) {
    // ✅ User exists - add with userId linked immediately
    habit.participants.push({
      userId: invitedUser._id,
      email: email.toLowerCase(),
      status: 'pending',
      invitedAt: new Date()
    });

    await habit.save();

    // Create notification
    try {
      const notification = new Notification({
        userId: invitedUser._id,
        type: 'habit_invitation',
        title: 'New Habit Invitation',
        body: `${inviterEmail} invited you to join "${habit.title}"`,
        relatedEntity: {
          entityType: 'shared_habit',
          entityId: habit._id
        },
        actions: [
          { actionType: 'accept', label: 'Accept' },
          { actionType: 'reject', label: 'Decline' }
        ],
        isRead: false
      });

      await notification.save();
      console.log('✅ In-app notification created for:', email);

    } catch (notifError) {
      console.error('⚠️ Failed to create notification:', notifError.message);
    }

    return {
      inviteType: 'in_app',
      message: 'In-app invitation sent successfully'
    };

  } else {
    // ✅ User doesn't exist - generate invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    habit.participants.push({
      email: email.toLowerCase(),
      status: 'pending',
      invitedAt: new Date(),
      inviteToken,
      inviteExpiry
      // ⚠️ No userId yet - will be linked when they sign up
    });

    await habit.save();

    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:8081'}/signup?inviteToken=${inviteToken}`;

    // ✅ FIXED: Use correct method name
    try {
      const emailResult = await MessagingService.sendInviteEmail({
        email: email,
        inviterName: inviterEmail,
        habitTitle: habit.title,
        inviteLink: inviteLink
      });
      
      if (emailResult.success) {
        if (emailResult.devMode) {
          console.log('📧 [DEV MODE] Invite link generated:', inviteLink);
        } else {
          console.log('✅ Email sent to:', email);
        }
      } else {
        console.error('⚠️ Email sending failed:', emailResult.error);
      }
    } catch (emailError) {
      console.error('⚠️ Email sending failed:', emailError.message);
    }

    return {
      inviteType: 'token',
      message: 'Invite link generated (user not registered)',
      inviteLink
    };
  }
}


// ========================================
// VERIFY INVITE TOKEN (PUBLIC)
// ========================================
exports.verifyInviteToken = async (req, res) => {
  try {
    const { token } = req.params;

    console.log('🔍 Verifying invite token:', token);

    const habit = await SharedHabit.findOne({
      'participants.inviteToken': token,
      'participants.inviteExpiry': { $gt: new Date() }
    }).populate('createdBy', 'username name email');

    if (!habit) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired invitation'
      });
    }

    const participant = habit.participants.find(p => p.inviteToken === token);

    res.json({
      success: true,
      data: {
        habitId: habit._id,
        habitTitle: habit.title,
        habitDescription: habit.description,
        category: habit.category,
        creatorName: habit.createdBy.username || habit.createdBy.name,
        invitedEmail: participant.email
      }
    });

  } catch (error) {
    console.error('❌ Verify token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify invitation'
    });
  }
};

// ========================================
// ACCEPT INVITE AFTER SIGNUP (WITH TOKEN)
// ========================================
exports.acceptInviteAfterSignup = async (req, res) => {
  try {
    const { inviteToken } = req.body;
    const userId = req.userId;

    console.log('✅ Accepting invite after signup:', { inviteToken, userId });

    const habit = await SharedHabit.findOne({
      'participants.inviteToken': inviteToken,
      'participants.inviteExpiry': { $gt: new Date() }
    }).populate('createdBy', 'username name email');

    if (!habit) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired invitation'
      });
    }

    const participantIndex = habit.participants.findIndex(
      p => p.inviteToken === inviteToken
    );

    if (participantIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found'
      });
    }

    // Get user info
    const acceptingUser = await User.findById(userId);
    const accepterName = acceptingUser.username || acceptingUser.name || acceptingUser.email;

    // Update participant
    habit.participants[participantIndex].userId = userId;
    habit.participants[participantIndex].status = 'accepted';
    habit.participants[participantIndex].joinedAt = new Date();
    habit.participants[participantIndex].inviteToken = undefined;
    habit.participants[participantIndex].inviteExpiry = undefined;

    await habit.save();

    // ✅ Create welcome notification for new user
    try {
      const welcomeNotification = new Notification({
        userId: userId,
        type: 'habit_invitation',
        title: 'Welcome to the habit!',
        body: `You've successfully joined "${habit.title}"`,
        relatedEntity: {
          entityType: 'shared_habit',
          entityId: habit._id
        },
        isRead: false
      });
      await welcomeNotification.save();
    } catch (notifError) {
      console.error('⚠️ Failed to create welcome notification:', notifError.message);
    }

    // ✅ NEW: Notify the creator that invitation was accepted
    try {
      const creatorNotification = new Notification({
        userId: habit.createdBy._id,
        type: 'habit_invitation',
        title: '✅ New Member Joined',
        body: `${accepterName} joined your habit "${habit.title}"!`,
        relatedEntity: {
          entityType: 'shared_habit',
          entityId: habit._id
        },
        isRead: false
      });
      await creatorNotification.save();
      console.log('✅ Creator notified of new member');
    } catch (notifError) {
      console.error('⚠️ Failed to notify creator:', notifError.message);
    }

    res.json({
      success: true,
      message: 'Successfully joined the habit',
      data: { habitId: habit._id }
    });

  } catch (error) {
    console.error('❌ Accept invite error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept invitation'
    });
  }
};

exports.acceptInvitation = async (req, res) => {
  try {
    const { habitId } = req.params;
    const userId = req.userId;

    console.log('✅ Accepting in-app invitation:', { habitId, userId });

    const habit = await SharedHabit.findById(habitId)
      .populate('createdBy', 'username name email')
      .populate('participants.userId', 'username name email');
      
    if (!habit) {
      return res.status(404).json({
        success: false,
        message: 'Habit not found'
      });
    }

    // ✅ FIX 1: Check for duplicate participation FIRST
    const alreadyParticipant = habit.participants.some(p => 
      p.userId && 
      p.userId._id.toString() === userId.toString() && 
      p.status === 'accepted'
    );

    if (alreadyParticipant) {
      return res.status(400).json({
        success: false,
        message: 'You are already a participant of this habit'
      });
    }

    // ✅ FIX 2: Find participant by email ONLY (more reliable for email invites)
    const userEmail = req.user.email.toLowerCase();
    const participantIndex = habit.participants.findIndex(p => 
      p.email && 
      p.email.toLowerCase() === userEmail &&
      p.status === 'pending'
    );

    console.log('🔍 Search results:', {
      userEmail,
      participantIndex,
      allParticipants: habit.participants.map(p => ({
        email: p.email,
        userId: p.userId?._id?.toString(),
        status: p.status
      }))
    });

    if (participantIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'No pending invitation found for your email'
      });
    }

    // Get user info before updating
    const acceptingUser = await User.findById(userId);
    const accepterName = acceptingUser.username || acceptingUser.name || acceptingUser.email;

    // ✅ FIX 3: Update using array index (more reliable than object reference)
    habit.participants[participantIndex].userId = userId;
    habit.participants[participantIndex].status = 'accepted';
    habit.participants[participantIndex].joinedAt = new Date();
    
    // Clear invite tokens if they exist
    habit.participants[participantIndex].inviteToken = undefined;
    habit.participants[participantIndex].inviteExpiry = undefined;

    await habit.save();

    console.log('✅ Participant updated successfully at index:', participantIndex);

    // ✅ Mark invitation notification as read
    try {
      await Notification.updateOne(
        {
          userId: userId,
          type: 'habit_invitation',
          'relatedEntity.entityId': habitId,
          isRead: false
        },
        {
          $set: {
            isRead: true,
            readAt: new Date()
          }
        }
      );
      console.log('✅ Invitation notification marked as read');
    } catch (notifError) {
      console.error('⚠️ Failed to mark notification as read:', notifError.message);
    }

    // ✅ Notify the creator
    try {
      const creatorNotification = new Notification({
        userId: habit.createdBy._id,
        type: 'habit_invitation',
        title: '✅ Invitation Accepted',
        body: `${accepterName} accepted your invitation to join "${habit.title}"!`,
        relatedEntity: {
          entityType: 'shared_habit',
          entityId: habit._id
        },
        isRead: false
      });
      await creatorNotification.save();
      console.log('✅ Creator notified of acceptance');
    } catch (notifError) {
      console.error('⚠️ Failed to notify creator:', notifError.message);
    }

    res.json({
      success: true,
      message: 'Invitation accepted successfully',
      data: {
        habitId: habit._id,
        habitTitle: habit.title
      }
    });

  } catch (error) {
    console.error('❌ Accept invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept invitation'
    });
  }
};

// ============================================
// FIXED: Reject Invitation (In-App)
// ============================================
exports.rejectInvitation = async (req, res) => {
  try {
    const { habitId } = req.params;
    const userId = req.userId;

    console.log('❌ Rejecting invitation:', { habitId, userId });

    const habit = await SharedHabit.findById(habitId)
      .populate('createdBy', 'username name email');
      
    if (!habit) {
      return res.status(404).json({
        success: false,
        message: 'Habit not found'
      });
    }

    // ✅ FIX: Find by email only
    const userEmail = req.user.email.toLowerCase();
    const participant = habit.participants.find(p => 
      p.email && 
      p.email.toLowerCase() === userEmail &&
      p.status === 'pending'
    );

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'No pending invitation found'
      });
    }

    // Get user info before removing
    const rejectingUser = await User.findById(userId);
    const rejecterName = rejectingUser.username || rejectingUser.name || rejectingUser.email;

    // ✅ Remove participant by email
    habit.participants = habit.participants.filter(p => 
      !(p.email && p.email.toLowerCase() === userEmail && p.status === 'pending')
    );

    await habit.save();

    // Mark notification as read
    try {
      await Notification.updateOne(
        {
          userId: userId,
          type: 'habit_invitation',
          'relatedEntity.entityId': habitId,
          isRead: false
        },
        {
          $set: {
            isRead: true,
            readAt: new Date()
          }
        }
      );
      console.log('✅ Invitation notification marked as read');
    } catch (notifError) {
      console.error('⚠️ Failed to mark notification as read:', notifError.message);
    }

    // Notify the creator
    try {
      const creatorNotification = new Notification({
        userId: habit.createdBy._id,
        type: 'habit_invitation',
        title: '❌ Invitation Declined',
        body: `${rejecterName} declined your invitation to join "${habit.title}".`,
        relatedEntity: {
          entityType: 'shared_habit',
          entityId: habit._id
        },
        isRead: false
      });
      await creatorNotification.save();
      console.log('✅ Creator notified of rejection');
    } catch (notifError) {
      console.error('⚠️ Failed to notify creator:', notifError.message);
    }

    res.json({
      success: true,
      message: 'Invitation rejected successfully'
    });

  } catch (error) {
    console.error('❌ Reject invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject invitation'
    });
  }
};

// ========================================
// GET MY SHARED HABITS
// ========================================
exports.getMySharedHabits = async (req, res) => {
  try {
    const userId = req.userId;

    console.log('📤 Fetching my shared habits');

    const habits = await SharedHabit.find({
      'participants.userId': userId,
      'participants.status': 'accepted',
      isActive: true
    })
    .populate('createdBy', 'username name email')
    .populate('participants.userId', 'username name email')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: habits
    });

  } catch (error) {
    console.error('❌ Get shared habits error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shared habits'
    });
  }
};

// ============================================
// FIXED: getSharedHabitDetails - TIME-BASED DAYS CALCULATION
// ============================================
exports.getSharedHabitDetails = async (req, res) => {
  try {
    const { habitId } = req.params;
    const userId = req.userId || req.user._id;

    console.log('=== GET HABIT DETAILS ===');
    console.log('habitId:', habitId);
    console.log('userId:', userId);

    const habit = await SharedHabit.findById(habitId)
      .populate('createdBy', 'username name email')
      .populate('participants.userId', 'username name email');

    if (!habit) {
      return res.status(404).json({ 
        success: false, 
        message: 'Habit not found' 
      });
    }

    console.log('✅ Habit found:', habit.title);

    // Check if user is participant
    const isParticipant = habit.participants.some(
      p => p.userId && p.userId._id.toString() === userId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({ 
        success: false, 
        message: 'You are not a participant of this habit' 
      });
    }

    // Get today's completion
    const today = moment().startOf('day').toDate();
    const todayCompletion = habit.dailyCompletions.find(
      dc => moment(dc.date).isSame(today, 'day')
    );

    // Build participants response with completion status
    const participantsResponse = habit.participants
      .filter(p => p.status === 'accepted')
      .map(p => {
        const user = p.userId;
        if (!user) return null;

        const isCompletedToday = todayCompletion 
          ? todayCompletion.completedBy.some(c => c.userId.toString() === user._id.toString())
          : false;

        const completionCount = habit.dailyCompletions.filter(dc =>
          dc.completedBy.some(c => c.userId.toString() === user._id.toString())
        ).length;

        const participantStreak = habit.sharedStreak.consecutiveDays.length;

        return {
          _id: p._id,
          userId: user._id,
          name: user.username || user.name || user.email.split('@')[0],
          email: user.email,
          status: p.status,
          role: user._id.toString() === habit.createdBy._id.toString() ? 'creator' : 'member',
          isCurrentUser: user._id.toString() === userId.toString(),
          isCompletedToday: isCompletedToday,
          completionCount: completionCount,
          currentStreak: participantStreak,
          joinedAt: p.joinedAt
        };
      })
      .filter(p => p !== null);

    console.log('👥 Participants:', participantsResponse.length);

    const totalDays = habit.stats.totalDays || 0;
    const successfulDays = habit.stats.successfulDays || 0;

    // ✅ FIXED: Calculate daysElapsed based on ACTUAL TIME, not completions
    const createdDate = moment(habit.createdAt).startOf('day');
    const currentDate = moment().startOf('day');
    const daysElapsed = currentDate.diff(createdDate, 'days') + 1; // +1 because day 1 starts immediately
    
    const totalDurationDays = 30;
    const daysRemaining = Math.max(0, totalDurationDays - daysElapsed);

    // ✅ FIXED: Progress percentage based on TIME, not success
    const progressPercentage = Math.min(
      Math.round((daysElapsed / totalDurationDays) * 100), 
      100
    );

    console.log('📅 Time calculations:', {
      createdDate: createdDate.format('YYYY-MM-DD'),
      currentDate: currentDate.format('YYYY-MM-DD'),
      daysElapsed,
      daysRemaining,
      progressPercentage
    });

    const response = {
      success: true,
      data: {
        sharedHabit: {
          _id: habit._id,
          title: habit.title,
          description: habit.description,
          category: habit.category,
          icon: 0,
          frequency: 'Daily',
          points: 20,
          skipDaysAllowed: 0,
          creator: habit.createdBy._id,
          creatorName: habit.createdBy.username || habit.createdBy.name || habit.createdBy.email,
          participants: participantsResponse,
          currentStreak: habit.sharedStreak.current,
          longestStreak: habit.sharedStreak.longest,
          createdAt: habit.createdAt,
          
          // ✅ TIME-BASED METRICS (for progress bar)
          durationDays: totalDurationDays,
          daysElapsed: daysElapsed,
          daysRemaining: daysRemaining,
          progressPercentage: progressPercentage,
          
          // ✅ SUCCESS-BASED METRICS (for stats)
          totalDays: totalDays,
          successfulDays: successfulDays,
          completionRate: habit.stats.successRate || 0,
          
          stats: {
            totalDays: habit.stats.totalDays,
            successfulDays: habit.stats.successfulDays,
            failedDays: habit.stats.failedDays,
            successRate: habit.stats.successRate
          },
          isActive: habit.isActive
        }
      }
    };

    console.log('✅ Sending response with', participantsResponse.length, 'participants');
    res.json(response);

  } catch (error) {
    console.error('❌ Get habit details error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ========================================
// COMPLETE TASK (FIXED STREAK LOGIC)
// ========================================
exports.completeTask = async (req, res) => {
  try {
    const { habitId } = req.params;
    const userId = req.userId;

    console.log('✅ Completing task:', { habitId, userId });

    const habit = await SharedHabit.findById(habitId);
    if (!habit) {
      return res.status(404).json({
        success: false,
        message: 'Habit not found'
      });
    }

    const participant = habit.participants.find(
      p => p.userId && p.userId.toString() === userId.toString() && p.status === 'accepted'
    );

    if (!participant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant of this habit'
      });
    }

    const today = moment().startOf('day').toDate();

    // Find or create today's completion
    let todayCompletion = habit.dailyCompletions.find(
      dc => moment(dc.date).isSame(today, 'day')
    );

    if (!todayCompletion) {
      todayCompletion = {
        date: today,
        completedBy: [],
        allCompleted: false,
        countedAsDay: false  // ✅ Track if we already counted this day
      };
      habit.dailyCompletions.push(todayCompletion);
    }

    // Check if user already completed
    const alreadyCompleted = todayCompletion.completedBy.some(
      c => c.userId.toString() === userId.toString()
    );

    if (alreadyCompleted) {
      return res.status(400).json({
        success: false,
        message: 'Already completed today'
      });
    }

    // Add user's completion
    todayCompletion.completedBy.push({
      userId: userId,
      completedAt: new Date()
    });

    // Get total accepted participants
    const acceptedParticipants = habit.participants.filter(p => p.status === 'accepted');
    
    // Check if ALL participants have completed
    const allCompleted = acceptedParticipants.every(p => 
      todayCompletion.completedBy.some(c => c.userId.toString() === p.userId.toString())
    );

    console.log('📊 Completion check:', {
      totalParticipants: acceptedParticipants.length,
      completedCount: todayCompletion.completedBy.length,
      allCompleted: allCompleted,
      alreadyCounted: todayCompletion.countedAsDay
    });

    // ✅ FIXED: Only update streak if ALL completed AND we haven't counted this day yet
    if (allCompleted && !todayCompletion.countedAsDay) {
      console.log('🎉 All participants completed! Updating streak...');
      
      todayCompletion.allCompleted = true;
      todayCompletion.countedAsDay = true;  // ✅ Mark as counted
      
      // Update stats
      habit.stats.successfulDays += 1;
      
      // Update streak
      habit.sharedStreak.current += 1;
      if (habit.sharedStreak.current > habit.sharedStreak.longest) {
        habit.sharedStreak.longest = habit.sharedStreak.current;
      }
      habit.sharedStreak.lastCompletedDate = today;
      habit.sharedStreak.consecutiveDays.push(today);
      
      console.log('✅ Streak updated:', {
        current: habit.sharedStreak.current,
        longest: habit.sharedStreak.longest
      });
    }

    // Update total days count
    habit.stats.totalDays = habit.dailyCompletions.length;

    // Recalculate success rate
    habit.stats.successRate = habit.stats.totalDays > 0
      ? Math.round((habit.stats.successfulDays / habit.stats.totalDays) * 100)
      : 0;

    await habit.save();

    res.json({
      success: true,
      message: 'Task completed successfully',
      allCompleted: allCompleted,
      currentStreak: habit.sharedStreak.current,
      completedCount: todayCompletion.completedBy.length,
      totalParticipants: acceptedParticipants.length
    });

  } catch (error) {
    console.error('❌ Complete task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete task'
    });
  }
};

// // ========================================
// // UNDO COMPLETION
// // ========================================
// exports.undoCompletion = async (req, res) => {
//   try {
//     const { habitId } = req.params;
//     const userId = req.userId;

//     console.log('↩️ Undoing completion:', { habitId, userId });

//     const habit = await SharedHabit.findById(habitId);
//     if (!habit) {
//       return res.status(404).json({
//         success: false,
//         message: 'Habit not found'
//       });
//     }

//     const today = moment().startOf('day').toDate();
//     const todayCompletion = habit.dailyCompletions.find(
//       dc => moment(dc.date).isSame(today, 'day')
//     );

//     if (!todayCompletion) {
//       return res.status(400).json({
//         success: false,
//         message: 'No completion found for today'
//       });
//     }

//     todayCompletion.completedBy = todayCompletion.completedBy.filter(
//       c => c.userId.toString() !== userId.toString()
//     );

//     if (todayCompletion.completedBy.length === 0) {
//       habit.dailyCompletions = habit.dailyCompletions.filter(
//         dc => !moment(dc.date).isSame(today, 'day')
//       );
      
//       habit.stats.totalDays = habit.dailyCompletions.length;
//       habit.sharedStreak.current = 0;
//       habit.sharedStreak.consecutiveDays = [];
//     }

//     habit.stats.successRate = habit.stats.totalDays > 0
//       ? Math.round((habit.stats.successfulDays / habit.stats.totalDays) * 100)
//       : 0;

//     await habit.save();

//     res.json({
//       success: true,
//       message: 'Completion undone successfully'
//     });

//   } catch (error) {
//     console.error('❌ Undo completion error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to undo completion'
//     });
//   }
// };

// ========================================
// LEAVE SHARED HABIT
// ========================================
exports.leaveSharedHabit = async (req, res) => {
  try {
    const { habitId } = req.params;
    const userId = req.userId;

    console.log('🚪 Leaving habit:', { habitId, userId });

    const habit = await SharedHabit.findById(habitId);
    if (!habit) {
      return res.status(404).json({
        success: false,
        message: 'Habit not found'
      });
    }

    if (habit.createdBy.toString() === userId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Creator cannot leave. Delete the habit instead.'
      });
    }

    habit.participants = habit.participants.filter(
      p => !(p.userId && p.userId.toString() === userId.toString())
    );

    await habit.save();

    res.json({
      success: true,
      message: 'Left habit successfully'
    });

  } catch (error) {
    console.error('❌ Leave habit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave habit'
    });
  }
};

// ========================================
// DELETE SHARED HABIT (CREATOR ONLY)
// ========================================
exports.deleteSharedHabit = async (req, res) => {
  try {
    const { habitId } = req.params;
    const userId = req.userId;

    console.log('🗑️ Deleting habit:', { habitId, userId });

    const habit = await SharedHabit.findById(habitId);
    if (!habit) {
      return res.status(404).json({
        success: false,
        message: 'Habit not found'
      });
    }

    if (habit.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only creator can delete the habit'
      });
    }

    await SharedHabit.findByIdAndDelete(habitId);

    // Notify participants
    for (const participant of habit.participants) {
      if (participant.userId && participant.userId.toString() !== userId.toString()) {
        try {
          const notification = new Notification({
            userId: participant.userId,
            type: 'system',
            title: 'Habit Deleted',
            body: `The habit "${habit.title}" has been deleted by the creator`,
            relatedEntity: {
              entityType: 'shared_habit',
              entityId: habit._id
            },
            isRead: false
          });
          await notification.save();
        } catch (notifError) {
          console.error('⚠️ Failed to create notification:', notifError.message);
        }
      }
    }

    res.json({
      success: true,
      message: 'Habit deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete habit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete habit'
    });
  }
};

// ========================================
// GET COMPLETION HISTORY
// ========================================
exports.getCompletionHistory = async (req, res) => {
  try {
    const { habitId } = req.params;
    const userId = req.userId;

    const habit = await SharedHabit.findById(habitId)
      .populate('participants.userId', 'username name email');

    if (!habit) {
      return res.status(404).json({
        success: false,
        message: 'Habit not found'
      });
    }

    const isParticipant = habit.participants.some(
      p => p.userId && p.userId._id.toString() === userId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: habit.dailyCompletions
    });

  } catch (error) {
    console.error('❌ Get history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch history'
    });
  }
};

// ========================================
// GET STREAK INFO
// ========================================
exports.getStreakInfo = async (req, res) => {
  try {
    const { habitId } = req.params;
    const userId = req.userId;

    const habit = await SharedHabit.findById(habitId);
    if (!habit) {
      return res.status(404).json({
        success: false,
        message: 'Habit not found'
      });
    }

    const isParticipant = habit.participants.some(
      p => p.userId && p.userId.toString() === userId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: habit.sharedStreak
    });

  } catch (error) {
    console.error('❌ Get streak error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch streak info'
    });
  }
};

// ========================================
// UNDO COMPLETION (FIXED STREAK LOGIC)
// ========================================
exports.undoCompletion = async (req, res) => {
  try {
    const { habitId } = req.params;
    const userId = req.userId;

    console.log('↩️ Undoing completion:', { habitId, userId });

    const habit = await SharedHabit.findById(habitId);
    if (!habit) {
      return res.status(404).json({
        success: false,
        message: 'Habit not found'
      });
    }

    const today = moment().startOf('day').toDate();
    const todayCompletion = habit.dailyCompletions.find(
      dc => moment(dc.date).isSame(today, 'day')
    );

    if (!todayCompletion) {
      return res.status(400).json({
        success: false,
        message: 'No completion found for today'
      });
    }

    // Check if user had completed
    const userCompleted = todayCompletion.completedBy.some(
      c => c.userId.toString() === userId.toString()
    );

    if (!userCompleted) {
      return res.status(400).json({
        success: false,
        message: 'You have not completed today'
      });
    }

    // ✅ Check if this day was counted (all participants had completed)
    const wasCountedAsDay = todayCompletion.countedAsDay;

    console.log('📊 Before undo:', {
      completedCount: todayCompletion.completedBy.length,
      wasCountedAsDay: wasCountedAsDay,
      currentStreak: habit.sharedStreak.current
    });

    // Remove user's completion
    todayCompletion.completedBy = todayCompletion.completedBy.filter(
      c => c.userId.toString() !== userId.toString()
    );

    // ✅ FIXED: If this day was counted and now it's incomplete, reverse the streak
    if (wasCountedAsDay) {
      console.log('⚠️ Day was counted, reversing streak...');
      
      todayCompletion.allCompleted = false;
      todayCompletion.countedAsDay = false;
      
      // Reverse streak increment
      if (habit.stats.successfulDays > 0) {
        habit.stats.successfulDays -= 1;
      }
      
      if (habit.sharedStreak.current > 0) {
        habit.sharedStreak.current -= 1;
      }
      
      // Remove today from consecutive days
      habit.sharedStreak.consecutiveDays = habit.sharedStreak.consecutiveDays.filter(
        d => !moment(d).isSame(today, 'day')
      );
      
      console.log('✅ Streak reversed:', {
        current: habit.sharedStreak.current,
        successfulDays: habit.stats.successfulDays
      });
    }

    // If no one has completed today, remove the entire day entry
    if (todayCompletion.completedBy.length === 0) {
      console.log('🗑️ Removing entire day entry (no completions left)');
      
      habit.dailyCompletions = habit.dailyCompletions.filter(
        dc => !moment(dc.date).isSame(today, 'day')
      );
    }

    // Update total days count
    habit.stats.totalDays = habit.dailyCompletions.length;

    // Recalculate success rate
    habit.stats.successRate = habit.stats.totalDays > 0
      ? Math.round((habit.stats.successfulDays / habit.stats.totalDays) * 100)
      : 0;

    await habit.save();

    res.json({
      success: true,
      message: 'Completion undone successfully',
      currentStreak: habit.sharedStreak.current,
      successfulDays: habit.stats.successfulDays
    });

  } catch (error) {
    console.error('❌ Undo completion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to undo completion'
    });
  }
};

// ========================================
// CHECK AND RESET STREAKS (FIXED)
// ========================================
exports.checkAndResetStreaks = async () => {
  try {
    console.log('🔄 Running streak check...');
    const yesterday = moment().subtract(1, 'day').startOf('day').toDate();
    
    const activeHabits = await SharedHabit.find({ isActive: true });
    
    for (const habit of activeHabits) {
      const yesterdayCompletion = habit.dailyCompletions.find(
        dc => moment(dc.date).isSame(yesterday, 'day')
      );
      
      // ✅ Check if yesterday was NOT completed by all participants
      if (!yesterdayCompletion || !yesterdayCompletion.allCompleted) {
        console.log(`⚠️ Habit "${habit.title}" - Streak broken (yesterday not completed)`);
        
        if (habit.sharedStreak.current > 0) {
          // Reset streak
          habit.sharedStreak.current = 0;
          habit.sharedStreak.consecutiveDays = [];
          habit.stats.failedDays += 1;
          
          await habit.save();
          
          console.log(`✅ Habit "${habit.title}" - Streak reset`);
          
          // Notify all participants
          const acceptedParticipants = habit.participants.filter(p => p.status === 'accepted');
          
          for (const participant of acceptedParticipants) {
            try {
              const notification = new Notification({
                userId: participant.userId,
                type: 'habit_streak',
                title: '💔 Streak Broken',
                body: `Your shared streak for "${habit.title}" has been reset. Start fresh today!`,
                relatedEntity: {
                  entityType: 'shared_habit',
                  entityId: habit._id
                },
                isRead: false
              });
              await notification.save();
            } catch (notifError) {
              console.error('⚠️ Failed to notify participant:', notifError.message);
            }
          }
        }
      }
    }
    
    console.log('✅ Streak check completed');
    
  } catch (error) {
    console.error('❌ Check streaks error:', error);
  }
};

module.exports = exports;