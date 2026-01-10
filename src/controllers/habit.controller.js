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
      habit,
      message: `Habit created successfully! Duration: ${habit.durationDays} days (${habit.frequency})`
    });
  } catch (error) {
    console.error('Create Habit Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// ✅ GET ALL USER HABITS - Auto-archive expired habits
exports.getUserHabits = async (req, res) => {
  try {
    const { status, category, date, includeExpired } = req.query;
    
    const user = await User.findById(req.userId);

    if (user?.dailyStreak?.lastCompletedDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const last = new Date(user.dailyStreak.lastCompletedDate);
      last.setHours(0, 0, 0, 0);

      const diffDays = Math.floor(
        (today - last) / (1000 * 60 * 60 * 24)
      );

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

    // ✅ CRITICAL: Only show habits that haven't expired yet
    if (!includeExpired) {
      const now = new Date();
      filter.endDate = { $gte: now };
      
      // ✅ Auto-archive expired habits in background
      Habit.updateMany(
        {
          userId: req.userId,
          isActive: true,
          endDate: { $lt: now }
        },
        {
          isActive: false
        }
      ).exec(); // Run without waiting
    }

    const habits = await Habit.find(filter).sort({ createdAt: -1 });

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

    const habitsWithExpiry = habits.map(habit => ({
      ...habit.toObject(),
      isExpired: habit.isExpired,
      remainingDays: habit.getRemainingDays(),
      completedToday: habit.completedToday
    }));

    res.json({ 
      success: true, 
      habits: habitsWithExpiry,
      count: habitsWithExpiry.length,
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
      habit: {
        ...habit.toObject(),
        isExpired: habit.isExpired,
        remainingDays: habit.getRemainingDays()
      }
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

    await habit.save();

    res.json({ 
      success: true, 
      habit,
      message: updates.frequency ? 'Habit updated! Dates recalculated.' : 'Habit updated successfully!'
    });
  } catch (error) {
    console.error('Update Habit Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// ✅ DELETE HABIT
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

// ✅ FIXED COMPLETE HABIT - Proper Daily Streak Logic
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

    if (habit.isExpired) {
      return res.status(400).json({ 
        success: false,
        error: 'This habit has expired. Duration complete.',
        isExpired: true
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

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

    const pointsEarned = habit.isNegative ? -habit.points : habit.points;

    habit.completedDates.push(today);
    habit.lastCompletedDate = today;
    habit.updateStreak();
    habit.stats.totalCompletions += 1;
    habit.stats.totalPointsEarned += pointsEarned;

    await habit.save();

    const user = await User.findById(req.userId);
    if (user && user.gamification) {
      user.gamification.totalPoints = (user.gamification.totalPoints || 0) + pointsEarned;
    }

    // ✅ FIXED: Only check ACTIVE & NON-EXPIRED habits for daily streak
    const now = new Date();
    const activeHabits = await Habit.find({
      userId: req.userId,
      isActive: true,
      isPaused: false,
      endDate: { $gte: now } // ✅ Only habits that haven't expired yet
    });

    console.log(`📊 Daily Streak Check: ${activeHabits.length} active non-expired habits`);

    // ✅ Check if ALL currently active habits are completed today
    const allDoneToday = activeHabits.length > 0 && activeHabits.every(h =>
      h.completedDates.some(d => {
        const cd = new Date(d);
        cd.setHours(0, 0, 0, 0);
        return cd.getTime() === today.getTime();
      })
    );

    console.log(`✅ All habits done today? ${allDoneToday}`);

    if (allDoneToday) {
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
        user.dailyStreak.current = 1;
      } else {
        last.setHours(0, 0, 0, 0);
        const diffDays = Math.floor(
          (today - last) / (1000 * 60 * 60 * 24)
        );

        if (diffDays === 1) {
          // ✅ Consecutive day - increment streak
          user.dailyStreak.current += 1;
        } else if (diffDays === 0) {
          // Same day - keep current streak
        } else {
          // ✅ Gap in days - reset to 1
          user.dailyStreak.current = 1;
        }
      }

      user.dailyStreak.longest = Math.max(
        user.dailyStreak.longest || 0,
        user.dailyStreak.current
      );

      user.dailyStreak.lastCompletedDate = today;

      console.log(`🔥 Daily Streak Updated: ${user.dailyStreak.current} days`);
    }

    await user.save();

    await notificationService.createNotification(req.userId, {
      type: 'achievement',
      title: '🎉 Habit Completed!',
      body: `You completed "${habit.name}" and earned ${pointsEarned} points! Streak: ${habit.streak} days. ${habit.getRemainingDays()} days remaining!`,
      relatedEntity: {
        entityType: 'habit',
        entityId: habit._id
      }
    });

    if (allDoneToday) {
      await notificationService.createNotification(req.userId, {
        type: 'achievement',
        title: '🏆 All Habits Completed!',
        body: `Amazing! You completed all your active habits today! Daily streak: ${user.dailyStreak.current} days`,
        relatedEntity: {
          entityType: 'habit',
          entityId: null
        }
      });
    }

    res.json({ 
      success: true, 
      habit: {
        ...habit.toObject(),
        isExpired: habit.isExpired,
        remainingDays: habit.getRemainingDays()
      },
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

// ✅ UNCOMPLETE HABIT
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

    const pointsToDeduct = habit.isNegative ? -habit.points : habit.points;

    habit.completedDates.splice(completionIndex, 1);
    habit.updateStreak();
    habit.stats.totalCompletions = Math.max(0, habit.stats.totalCompletions - 1);
    habit.stats.totalPointsEarned -= pointsToDeduct;

    await habit.save();

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

// ✅ USE BUFFER DAY
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

// ✅ PAUSE HABIT
exports.pauseHabit = async (req, res) => {
  try {
    const { pauseDuration } = req.body;
    
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
      data: {
        habitStreaks: {
          current: habit.streak,
          longest: habit.longestStreak,
          lastCompletedDate: habit.lastCompletedDate,
          bufferDaysUsed: habit.bufferDaysUsed,
          bufferDaysAllowed: habit.skipDaysAllowed,
          isExpired: habit.isExpired,
          remainingDays: habit.getRemainingDays(),
          startDate: habit.startDate,
          endDate: habit.endDate
        },
        dailyStreak: user?.dailyStreak || { current: 0, longest: 0 }
      }
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
      data: {
        totalCompletions: habit.stats.totalCompletions,
        currentStreak: habit.streak,
        longestStreak: habit.longestStreak,
        totalPointsEarned: habit.stats.totalPointsEarned,
        completionRate: parseFloat(completionRate),
        last30DaysCount: last30Days.length,
        last30DaysHistory: last30Days,
        isExpired: habit.isExpired,
        remainingDays: habit.getRemainingDays(),
        durationDays: habit.durationDays,
        frequency: habit.frequency
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
      isActive: true,
      endDate: { $gte: new Date() }
    });
    
    const totalHabits = habits.length;
    const totalCompletions = habits.reduce((sum, h) => sum + h.stats.totalCompletions, 0);
    const totalPoints = habits.reduce((sum, h) => sum + h.stats.totalPointsEarned, 0);
    
    const activeStreaks = habits.filter(h => h.streak > 0).length;
    const longestStreak = Math.max(...habits.map(h => h.longestStreak), 0);

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
      data: {
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

// ✅ GET CHART ANALYTICS - NEW
exports.getChartAnalytics = async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const userId = req.userId;
    
    console.log(`📊 Chart analytics requested: ${period} for user ${userId}`);
    
    const validPeriods = ['week', 'month', 'year'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid period. Use: ${validPeriods.join(', ')}` 
      });
    }
    
    let days, labels;
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    
    if (period === 'week') {
      days = 7;
      labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    } else if (period === 'month') {
      days = 28;
      labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    } else if (period === 'year') {
      days = 365;
      labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    }
    
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    console.log(`📅 Date range: ${startDate.toISOString()} to ${now.toISOString()}`);
    
    // Get all habits with completedDates in range
    const habits = await Habit.find({
      userId: userId,
      isActive: true
    });
    
    // Count completions from completedDates array
    const data = new Array(labels.length).fill(0);
    
    habits.forEach(habit => {
      habit.completedDates.forEach(completedDate => {
        const date = new Date(completedDate);
        
        if (date >= startDate && date <= now) {
          if (period === 'week') {
            const daysDiff = Math.floor((now - date) / (24 * 60 * 60 * 1000));
            const index = Math.max(0, Math.min(6, 6 - daysDiff));
            data[index]++;
          } 
          else if (period === 'month') {
            const daysDiff = Math.floor((now - date) / (24 * 60 * 60 * 1000));
            const weekIndex = Math.floor(daysDiff / 7);
            const index = Math.max(0, Math.min(3, 3 - weekIndex));
            data[index]++;
          } 
          else if (period === 'year') {
            const monthIndex = date.getMonth();
            data[monthIndex]++;
          }
        }
      });
    });
    
    const totalHabits = habits.length;
    const totalCompletions = habits.reduce((sum, h) => 
      h.completedDates.filter(d => {
        const date = new Date(d);
        return date >= startDate && date <= now;
      }).length + sum, 0
    );
    
    console.log(`📊 Chart data:`, { 
      labels: labels.slice(0, 3), 
      data: data.slice(0, 3), 
      totalHabits,
      totalCompletions
    });
    
    res.json({
      success: true,
      data: {
        labels,
        data,
        totalHabits,
        period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        totalCompletions
      }
    });
    
  } catch (error) {
    console.error('❌ Chart analytics error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch chart analytics'
    });
  }
};