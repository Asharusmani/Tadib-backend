const Habit = require('../models/habit.model');
const User = require('../models/user.model');
const notificationService = require('../services/notification.service');

// ✅ CREATE NEW HABIT
exports.createHabit = async (req, res) => {
  try {
    const habitData = {
      userId: req.userId,
      name: req.body.name,
      icon: req.body.icon,
      category: req.body.category,
      isNegative: req.body.isNegative || false,
      points: req.body.points || 10,
      skipDaysAllowed: req.body.skipDaysAllowed || 0,
      frequency: req.body.frequency || 'Daily',
      reminderTime: req.body.reminderTime,
      streak: 0,
      longestStreak: 0,
      completedDates: [],
      stats: {
        totalCompletions: 0,
        totalPointsEarned: 0
      }
    };

    const habit = await Habit.create(habitData);

    // ✅ CREATE NOTIFICATION when habit is created
    if (habit.reminderTime) {
      await notificationService.createNotification(req.userId, {
        type: 'task_reminder',
        title: `Reminder: ${habit.name}`,
        body: `Don't forget to complete your habit today!`,
        relatedEntity: {
          entityType: 'habit',
          entityId: habit._id
        }
      });
    }

    res.status(201).json({ 
      success: true, 
      habit 
    });
  } catch (error) {
    console.error('Create Habit Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// ✅ GET ALL USER HABITS (with auto streak reset)
exports.getUserHabits = async (req, res) => {
  try {
    const { status, category, date } = req.query;
    
    // 🔥 AUTO RESET DAILY STREAK IF MISSED
    const user = await User.findById(req.userId);

    if (user?.dailyStreak?.lastCompletedDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const last = new Date(user.dailyStreak.lastCompletedDate);
      last.setHours(0, 0, 0, 0);

      const diffDays = Math.floor(
        (today - last) / (1000 * 60 * 60 * 24)
      );

      // If more than 1 day gap, reset streak
      if (diffDays > 1) {
        user.dailyStreak.current = 0;
        await user.save();
      }
    }

    const filter = { 
      userId: req.userId, 
      isActive: true 
    };
    
    if (category) filter.category = category;
    if (status === 'paused') filter.isPaused = true;

    const habits = await Habit.find(filter).sort({ createdAt: -1 });

    // Check if habits are completed for specific date
    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      
      habits.forEach(habit => {
        habit._doc.completedToday = habit.completedDates.some(d => {
          const completionDate = new Date(d);
          completionDate.setHours(0, 0, 0, 0);
          return completionDate.getTime() === targetDate.getTime();
        });
      });
    }

    res.json({ 
      success: true, 
      habits,
      count: habits.length,
      dailyStreak: user?.dailyStreak || { current: 0, longest: 0 }
    });
  } catch (error) {
    console.error('Get Habits Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// ✅ GET SINGLE HABIT BY ID
exports.getHabitById = async (req, res) => {
  try {
    const habit = await Habit.findOne({ 
      _id: req.params.id, 
      userId: req.userId 
    });

    if (!habit) {
      return res.status(404).json({ 
        success: false,
        error: 'Habit not found' 
      });
    }

    res.json({ 
      success: true, 
      habit 
    });
  } catch (error) {
    console.error('Get Habit Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// ✅ UPDATE HABIT
exports.updateHabit = async (req, res) => {
  try {
    const allowedUpdates = [
      'name', 'icon', 'category', 'isNegative', 'points', 
      'skipDaysAllowed', 'frequency', 'reminderTime'
    ];
    
    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const habit = await Habit.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!habit) {
      return res.status(404).json({ 
        success: false,
        error: 'Habit not found' 
      });
    }

    res.json({ 
      success: true, 
      habit 
    });
  } catch (error) {
    console.error('Update Habit Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// ✅ DELETE HABIT (Soft delete)
exports.deleteHabit = async (req, res) => {
  try {
    const habit = await Habit.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { isActive: false },
      { new: true }
    );

    if (!habit) {
      return res.status(404).json({ 
        success: false,
        error: 'Habit not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Habit deleted successfully' 
    });
  } catch (error) {
    console.error('Delete Habit Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// ✅ COMPLETE HABIT (WITH GLOBAL DAILY STREAK LOGIC)
exports.completeHabit = async (req, res) => {
  try {
    const { notes } = req.body;
    const habit = await Habit.findOne({ 
      _id: req.params.id, 
      userId: req.userId 
    });

    if (!habit) {
      return res.status(404).json({ 
        success: false,
        error: 'Habit not found' 
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if already completed today
    const alreadyCompleted = habit.completedDates.some(date => {
      const completionDate = new Date(date);
      completionDate.setHours(0, 0, 0, 0);
      return completionDate.getTime() === today.getTime();
    });

    if (alreadyCompleted) {
      return res.status(400).json({ 
        success: false,
        error: 'Already completed today' 
      });
    }

    // Calculate points
    const pointsEarned = habit.isNegative ? -habit.points : habit.points;

    // Add completion date
    habit.completedDates.push(today);
    habit.lastCompletedDate = today;

    // Update streak (per habit)
    habit.updateStreak();

    // Update stats
    habit.stats.totalCompletions += 1;
    habit.stats.totalPointsEarned += pointsEarned;

    await habit.save();

    // Update user points
    const user = await User.findById(req.userId);
    if (user && user.gamification) {
      user.gamification.totalPoints = (user.gamification.totalPoints || 0) + pointsEarned;
    }

    // 🔥 GLOBAL DAILY STREAK LOGIC
    // Get all active habits
    const habits = await Habit.find({
      userId: req.userId,
      isActive: true,
      isPaused: false
    });

    // Check if ALL habits are completed today
    const allDoneToday = habits.every(h =>
      h.completedDates.some(d => {
        const cd = new Date(d);
        cd.setHours(0, 0, 0, 0);
        return cd.getTime() === today.getTime();
      })
    );

    if (allDoneToday) {
      // Initialize dailyStreak if not exists
      if (!user.dailyStreak) {
        user.dailyStreak = {
          current: 0,
          longest: 0,
          lastCompletedDate: null
        };
      }

      const last = user.dailyStreak.lastCompletedDate
        ? new Date(user.dailyStreak.lastCompletedDate)
        : null;

      if (!last) {
        // First time completing all habits
        user.dailyStreak.current = 1;
      } else {
        last.setHours(0, 0, 0, 0);
        const diffDays = Math.floor(
          (today - last) / (1000 * 60 * 60 * 24)
        );

        if (diffDays === 1) {
          // Consecutive day
          user.dailyStreak.current += 1;
        } else if (diffDays === 0) {
          // Same day (already completed)
          // Do nothing
        } else {
          // Gap in days, reset to 1
          user.dailyStreak.current = 1;
        }
      }

      // Update longest streak
      user.dailyStreak.longest = Math.max(
        user.dailyStreak.longest || 0,
        user.dailyStreak.current
      );

      user.dailyStreak.lastCompletedDate = today;
    }

    await user.save();

    // ✅✅✅ CREATE ACHIEVEMENT NOTIFICATION
    await notificationService.createNotification(req.userId, {
      type: 'achievement',
      title: '🎉 Habit Completed!',
      body: `You completed "${habit.name}" and earned ${pointsEarned} points! Current streak: ${habit.streak} days`,
      relatedEntity: {
        entityType: 'habit',
        entityId: habit._id
      }
    });

    // ✅ If all habits completed, send bonus notification
    if (allDoneToday) {
      await notificationService.createNotification(req.userId, {
        type: 'achievement',
        title: '🏆 All Habits Completed!',
        body: `Amazing! You completed all your habits today! Daily streak: ${user.dailyStreak.current} days`,
        relatedEntity: {
          entityType: 'habit',
          entityId: null
        }
      });
    }

    res.json({ 
      success: true, 
      habit,
      pointsEarned,
      totalPoints: user?.gamification?.totalPoints || 0,
      habitStreak: habit.streak,
      dailyStreak: user?.dailyStreak || { current: 0, longest: 0 },
      allHabitsCompleted: allDoneToday
    });
  } catch (error) {
    console.error('Complete Habit Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// ✅ UNCOMPLETE HABIT (Remove today's completion)
exports.uncompleteHabit = async (req, res) => {
  try {
    const habit = await Habit.findOne({ 
      _id: req.params.id, 
      userId: req.userId 
    });

    if (!habit) {
      return res.status(404).json({ 
        success: false,
        error: 'Habit not found' 
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find today's completion
    const completionIndex = habit.completedDates.findIndex(date => {
      const completionDate = new Date(date);
      completionDate.setHours(0, 0, 0, 0);
      return completionDate.getTime() === today.getTime();
    });

    if (completionIndex === -1) {
      return res.status(400).json({ 
        success: false,
        error: 'No completion found for today' 
      });
    }

    // Calculate points to deduct
    const pointsToDeduct = habit.isNegative ? -habit.points : habit.points;

    // Remove completion
    habit.completedDates.splice(completionIndex, 1);

    // Recalculate streak
    habit.updateStreak();

    // Update stats
    habit.stats.totalCompletions = Math.max(0, habit.stats.totalCompletions - 1);
    habit.stats.totalPointsEarned -= pointsToDeduct;

    await habit.save();

    // Update user points
    const user = await User.findById(req.userId);
    if (user && user.gamification) {
      user.gamification.totalPoints = (user.gamification.totalPoints || 0) - pointsToDeduct;
      await user.save();
    }

    res.json({ 
      success: true, 
      habit,
      habitStreak: habit.streak 
    });
  } catch (error) {
    console.error('Uncomplete Habit Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// ✅ USE BUFFER/SKIP DAY
exports.useBufferDay = async (req, res) => {
  try {
    const habit = await Habit.findOne({ 
      _id: req.params.id, 
      userId: req.userId 
    });

    if (!habit) {
      return res.status(404).json({ 
        success: false,
        error: 'Habit not found' 
      });
    }

    if (habit.bufferDaysUsed >= habit.skipDaysAllowed) {
      return res.status(400).json({ 
        success: false,
        error: 'No buffer days remaining' 
      });
    }

    habit.bufferDaysUsed += 1;
    await habit.save();

    res.json({ 
      success: true, 
      message: 'Buffer day used',
      remainingBufferDays: habit.skipDaysAllowed - habit.bufferDaysUsed,
      habit
    });
  } catch (error) {
    console.error('Buffer Day Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// ✅ GET STREAK STATS
exports.getStreakStats = async (req, res) => {
  try {
    const habit = await Habit.findOne({ 
      _id: req.params.id, 
      userId: req.userId 
    });

    if (!habit) {
      return res.status(404).json({ 
        success: false,
        error: 'Habit not found' 
      });
    }

    const user = await User.findById(req.userId);

    res.json({ 
      success: true, 
      habitStreaks: {
        current: habit.streak,
        longest: habit.longestStreak,
        lastCompletedDate: habit.lastCompletedDate,
        bufferDaysUsed: habit.bufferDaysUsed,
        bufferDaysAllowed: habit.skipDaysAllowed
      },
      dailyStreak: user?.dailyStreak || { current: 0, longest: 0 }
    });
  } catch (error) {
    console.error('Streak Stats Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// ✅ GET HABIT ANALYTICS
exports.getHabitAnalytics = async (req, res) => {
  try {
    const habit = await Habit.findOne({ 
      _id: req.params.id, 
      userId: req.userId 
    });

    if (!habit) {
      return res.status(404).json({ 
        success: false,
        error: 'Habit not found' 
      });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const last30Days = habit.completedDates
      .filter(date => new Date(date) >= thirtyDaysAgo)
      .sort((a, b) => new Date(b) - new Date(a));

    const completionRate = ((last30Days.length / 30) * 100).toFixed(2);

    res.json({ 
      success: true, 
      analytics: {
        totalCompletions: habit.stats.totalCompletions,
        currentStreak: habit.streak,
        longestStreak: habit.longestStreak,
        totalPointsEarned: habit.stats.totalPointsEarned,
        completionRate: parseFloat(completionRate),
        last30DaysCount: last30Days.length,
        last30DaysHistory: last30Days
      }
    });
  } catch (error) {
    console.error('Habit Analytics Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// ✅ GET OVERALL USER ANALYTICS
exports.getOverallAnalytics = async (req, res) => {
  try {
    const habits = await Habit.find({ 
      userId: req.userId, 
      isActive: true 
    });
    
    const totalHabits = habits.length;
    const totalCompletions = habits.reduce((sum, h) => sum + h.stats.totalCompletions, 0);
    const totalPoints = habits.reduce((sum, h) => sum + h.stats.totalPointsEarned, 0);
    
    const activeStreaks = habits.filter(h => h.streak > 0).length;
    const longestStreak = Math.max(...habits.map(h => h.longestStreak), 0);

    // Category breakdown
    const categoryBreakdown = {};
    habits.forEach(habit => {
      if (!categoryBreakdown[habit.category]) {
        categoryBreakdown[habit.category] = 0;
      }
      categoryBreakdown[habit.category]++;
    });

    const user = await User.findById(req.userId);

    res.json({ 
      success: true, 
      analytics: {
        totalHabits,
        totalCompletions,
        totalPoints,
        activeStreaks,
        longestStreak,
        categoryBreakdown,
        dailyStreak: user?.dailyStreak || { current: 0, longest: 0 }
      }
    });
  } catch (error) {
    console.error('Overall Analytics Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// ✅ PAUSE HABIT
exports.pauseHabit = async (req, res) => {
  try {
    const { pauseDuration } = req.body; // in days
    
    const habit = await Habit.findOne({ 
      _id: req.params.id, 
      userId: req.userId 
    });

    if (!habit) {
      return res.status(404).json({ 
        success: false,
        error: 'Habit not found' 
      });
    }

    habit.isPaused = true;
    habit.pausedUntil = new Date(Date.now() + pauseDuration * 24 * 60 * 60 * 1000);
    await habit.save();

    res.json({ 
      success: true, 
      habit,
      message: `Habit paused for ${pauseDuration} days`
    });
  } catch (error) {
    console.error('Pause Habit Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// ✅ RESUME HABIT
exports.resumeHabit = async (req, res) => {
  try {
    const habit = await Habit.findOne({ 
      _id: req.params.id, 
      userId: req.userId 
    });

    if (!habit) {
      return res.status(404).json({ 
        success: false,
        error: 'Habit not found' 
      });
    }

    habit.isPaused = false;
    habit.pausedUntil = undefined;
    await habit.save();

    res.json({ 
      success: true, 
      habit,
      message: 'Habit resumed successfully'
    });
  } catch (error) {
    console.error('Resume Habit Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};