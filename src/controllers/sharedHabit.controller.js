// ============================================
// FILE: controllers/sharedHabit.controller.js (FIXED)
// ============================================
const SharedHabit = require('../models/sharedHabit.model');
const User = require('../models/user.model');
const NotificationService = require('../services/notification.service');
const moment = require('moment');

// ✅ CREATE SHARED HABIT
exports.createSharedHabit = async (req, res) => {
  try {
    const userId = req.userId || req.user._id; // Support both formats
    
    const sharedHabit = await SharedHabit.create({
      ...req.body,
      createdBy: userId
    });
    
    res.status(201).json({ success: true, data: sharedHabit });
  } catch (error) {
    console.error('Create shared habit error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ INVITE PARTICIPANT
exports.inviteParticipant = async (req, res) => {
  try {
    const { habitId } = req.params;
    const { email } = req.body;
    const userId = req.userId || req.user._id;
    
    const sharedHabit = await SharedHabit.findById(habitId);
    
    if (!sharedHabit) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }
    
    // Check if user is creator
    if (sharedHabit.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Only creator can invite' });
    }
    
    // Add participant
    sharedHabit.participants.push({ email, status: 'pending' });
    await sharedHabit.save();
    
    res.json({ success: true, data: sharedHabit });
  } catch (error) {
    console.error('Invite participant error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ ACCEPT INVITATION (EMAIL-BASED - FIXED)
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
    console.log("All participants:", sharedHabit.participants);
    
    // Get user email to match with invitation
    const user = await User.findById(userId);
    if (!user) {
      console.log("❌ User not found");
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    console.log("✅ User found:", user.email);
    
    // Find participant by EMAIL (jo invitation send ki thi)
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
    
    // Update participant
    participant.userId = userId;
    participant.status = 'accepted';
    participant.joinedAt = new Date();
    
    console.log("✅ Participant updated:", participant);
    
    await sharedHabit.save();
    
    console.log("✅ Habit saved successfully");
    
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
// ✅ DECLINE INVITATION
exports.declineInvitation = async (req, res) => {
  try {
    const { habitId } = req.params;
    const userId = req.userId || req.user._id;
    
    const sharedHabit = await SharedHabit.findById(habitId);
    
    if (!sharedHabit) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }
    
    const participant = sharedHabit.participants.find(
      p => p.userId && p.userId.toString() === userId.toString()
    );
    
    if (participant) {
      participant.status = 'declined';
      await sharedHabit.save();
    }
    
    res.json({ success: true, message: 'Invitation declined' });
  } catch (error) {
    console.error('Decline invitation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ GET MY SHARED HABITS
exports.getMySharedHabits = async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    
    const habits = await SharedHabit.find({
      'participants.userId': userId,
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
      .populate('participants.userId', 'name email');
    
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

// ✅ COMPLETE TASK with proper day counting
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
          await NotificationService.sendNotification(participant.userId._id, {
            type: 'streak_milestone',
            message: `🔥 Streak ${sharedHabit.sharedStreak.current}! Everyone completed "${sharedHabit.title}" today!`,
            habitId: sharedHabit._id
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
        await NotificationService.sendNotification(participant.userId._id, {
          type: 'reminder',
          message: `⏰ ${completedUser.name || 'Someone'} completed "${sharedHabit.title}". Don't break the streak!`,
          habitId: sharedHabit._id
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
      p => p.userId.toString() !== userId.toString()
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
              await NotificationService.sendNotification(participant.userId, {
                type: 'streak_broken',
                message: `💔 Streak broken for "${habit.title}". Not everyone completed yesterday.`,
                habitId: habit._id
              });
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