// controllers/user.controller.js
const User = require('../models/user.model');
const Habit = require('../models/habit.model');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { deleteFile, getFileUrl } = require('../config/upload');

// ============================================
// GET USER PROFILE
// ============================================
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('-password -resetPasswordToken -resetPasswordExpires -verificationToken')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
};

// ============================================
// UPDATE USER PROFILE
// ============================================
exports.updateProfile = async (req, res) => {
  try {
    const { name, bio, phoneNumber } = req.body;

    const updateData = {};
    if (name) updateData['profile.name'] = name;
    if (bio !== undefined) updateData['profile.bio'] = bio;
    if (phoneNumber !== undefined) updateData['profile.phoneNumber'] = phoneNumber;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};

// ============================================
// UPLOAD PROFILE AVATAR (LOCAL STORAGE)
// ============================================
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete old avatar file if exists
    if (user.profile.avatar) {
      try {
        const oldFilename = path.basename(user.profile.avatar);
        const oldFilePath = path.join(__dirname, '../uploads/avatars', oldFilename);
        await deleteFile(oldFilePath);
      } catch (deleteError) {
        console.warn('Failed to delete old avatar:', deleteError.message);
      }
    }

    // Generate new avatar URL
    const avatarUrl = getFileUrl(req.file.filename, req);

    // Update user avatar
    user.profile.avatar = avatarUrl;
    await user.save();

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: {
        avatar: avatarUrl
      }
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload avatar',
      error: error.message
    });
  }
};

// ============================================
// DELETE PROFILE AVATAR
// ============================================
exports.deleteAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete from local storage
    if (user.profile.avatar) {
      try {
        const filename = path.basename(user.profile.avatar);
        const filePath = path.join(__dirname, '../uploads/avatars', filename);
        await deleteFile(filePath);
      } catch (deleteError) {
        console.warn('Failed to delete avatar file:', deleteError.message);
      }
    }

    // Remove avatar from user
    user.profile.avatar = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Avatar deleted successfully'
    });
  } catch (error) {
    console.error('Delete avatar error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete avatar',
      error: error.message
    });
  }
};

// ============================================
// GET USER STATS
// ============================================
exports.getUserStats = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('gamification dailyStreak')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get active habits count
    const activeHabitsCount = await Habit.countDocuments({
      user: req.userId,
      status: 'active'
    });

    // Get completed habits today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const completedToday = await Habit.countDocuments({
      user: req.userId,
      status: 'active',
      'completionHistory.date': {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    res.json({
      success: true,
      data: {
        gamification: user.gamification,
        dailyStreak: user.dailyStreak,
        activeHabitsCount,
        completedToday
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
      error: error.message
    });
  }
};

// ============================================
// GET USER ACHIEVEMENTS (FIXED)
// ============================================
exports.getUserAchievements = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('gamification.badges gamification.achievements')
      // ✅ REMOVED .populate() calls since Badge/Achievement models don't exist yet
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        badges: user.gamification?.badges || [],
        achievements: user.gamification?.achievements || []
      }
    });
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch achievements',
      error: error.message
    });
  }
};

// ============================================
// UPDATE SETTINGS
// ============================================
exports.updateSettings = async (req, res) => {
  try {
    const { notifications, privacy, language, timezone } = req.body;

    const updateData = {};
    if (notifications) updateData['settings.notifications'] = notifications;
    if (privacy) updateData['settings.privacy'] = privacy;
    if (language) updateData['settings.language'] = language;
    if (timezone) updateData['settings.timezone'] = timezone;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updateData },
      { new: true }
    ).select('settings');

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: user.settings
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: error.message
    });
  }
};

// ============================================
// UPDATE NOTIFICATION SETTINGS
// ============================================
exports.updateNotificationSettings = async (req, res) => {
  try {
    const notifications = req.body;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: { 'settings.notifications': notifications } },
      { new: true }
    ).select('settings.notifications');

    res.json({
      success: true,
      message: 'Notification settings updated',
      data: user.settings.notifications
    });
  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification settings',
      error: error.message
    });
  }
};

// ============================================
// UPDATE PRIVACY SETTINGS
// ============================================
exports.updatePrivacySettings = async (req, res) => {
  try {
    const privacy = req.body;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: { 'settings.privacy': privacy } },
      { new: true }
    ).select('settings.privacy');

    res.json({
      success: true,
      message: 'Privacy settings updated',
      data: user.settings.privacy
    });
  } catch (error) {
    console.error('Update privacy settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update privacy settings',
      error: error.message
    });
  }
};

// ============================================
// CHANGE PASSWORD
// ============================================
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current and new password are required'
      });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password (will be hashed by pre-save middleware)
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
};

// ============================================
// DELETE ACCOUNT
// ============================================
exports.deleteAccount = async (req, res) => {
  try {
    // Delete all user's habits
    await Habit.deleteMany({ user: req.userId });

    // Delete user's avatar
    const user = await User.findById(req.userId);
    if (user?.profile?.avatar) {
      try {
        const filename = path.basename(user.profile.avatar);
        const filePath = path.join(__dirname, '../uploads/avatars', filename);
        await deleteFile(filePath);
      } catch (deleteError) {
        console.warn('Failed to delete avatar:', deleteError.message);
      }
    }

    // Delete user
    await User.findByIdAndDelete(req.userId);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account',
      error: error.message
    });
  }
};

// ============================================
// DEACTIVATE ACCOUNT
// ============================================
exports.deactivateAccount = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, {
      accountStatus: 'suspended'
    });

    res.json({
      success: true,
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    console.error('Deactivate account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate account',
      error: error.message
    });
  }
};

// ============================================
// REACTIVATE ACCOUNT
// ============================================
exports.reactivateAccount = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      { accountStatus: 'active' },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Account reactivated successfully',
      data: user
    });
  } catch (error) {
    console.error('Reactivate account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reactivate account',
      error: error.message
    });
  }
};

// ============================================
// GET PUBLIC PROFILE
// ============================================
exports.getPublicProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select('profile gamification dailyStreak createdAt settings.privacy')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check privacy settings
    if (user.settings?.privacy?.profileVisibility === 'private') {
      return res.status(403).json({
        success: false,
        message: 'This profile is private'
      });
    }

    // Return limited public data
    const publicData = {
      name: user.profile.name,
      avatar: user.profile.avatar,
      bio: user.profile.bio,
      level: user.gamification?.currentLevel || 1,
      badges: user.gamification?.badges || [],
      joinedDate: user.createdAt
    };

    // Only show streak if user allows
    if (user.settings?.privacy?.showInLeaderboards) {
      publicData.currentStreak = user.dailyStreak?.current || 0;
    }

    res.json({
      success: true,
      data: publicData
    });
  } catch (error) {
    console.error('Get public profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch public profile',
      error: error.message
    });
  }
};

// ============================================
// ADMIN ROUTES
// ============================================

// Get all users (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status, plan } = req.query;

    const filter = {};
    
    if (search) {
      filter.$or = [
        { 'profile.name': { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      filter.accountStatus = status;
    }
    
    if (plan) {
      filter['subscription.plan'] = plan;
    }

    const users = await User.find(filter)
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 })
      .lean();

    const count = await User.countDocuments(filter);

    res.json({
      success: true,
      data: {
        users,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        totalUsers: count
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};

// Get user by ID (admin only)
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select('-password')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's habits count
    const habitsCount = await Habit.countDocuments({ user: userId });

    res.json({
      success: true,
      data: {
        ...user,
        habitsCount
      }
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
  }
};

// Update user role (admin only)
exports.updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['user', 'admin', 'moderator'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User role updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role',
      error: error.message
    });
  }
};

// Suspend user account (admin only)
exports.suspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        accountStatus: 'suspended',
        suspensionReason: reason
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User suspended successfully',
      data: user
    });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to suspend user',
      error: error.message
    });
  }
};

// Delete user by admin
exports.deleteUserByAdmin = async (req, res) => {
  try {
    const { userId } = req.params;

    // Delete user's habits
    await Habit.deleteMany({ user: userId });

    // Delete user
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user by admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
};

// ============================================
// PRO SUBSCRIPTION ROUTES
// ============================================

// Get pro features
exports.getProFeatures = async (req, res) => {
  try {
    const proFeatures = {
      unlimitedHabits: true,
      advancedAnalytics: true,
      customReminders: true,
      prioritySupport: true,
      exportData: true,
      themesCustomization: true,
      aiInsights: true
    };

    res.json({
      success: true,
      data: proFeatures
    });
  } catch (error) {
    console.error('Get pro features error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pro features',
      error: error.message
    });
  }
};

// Get pro analytics
exports.getProAnalytics = async (req, res) => {
  try {
    const userId = req.userId;

    const habits = await Habit.find({ user: userId }).lean();

    const analytics = {
      totalCompletions: habits.reduce((sum, h) => sum + (h.completionHistory?.length || 0), 0),
      averageCompletionRate: calculateAverageCompletionRate(habits),
      mostProductiveDay: getMostProductiveDay(habits),
      longestStreakEver: habits.reduce((max, h) => Math.max(max, h.streak?.longest || 0), 0),
      habitsByCategory: groupHabitsByCategory(habits),
      weeklyTrends: getWeeklyTrends(habits),
      monthlyProgress: getMonthlyProgress(habits)
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Get pro analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pro analytics',
      error: error.message
    });
  }
};

// Helper functions for pro analytics
function calculateAverageCompletionRate(habits) {
  if (habits.length === 0) return 0;
  
  const totalRate = habits.reduce((sum, habit) => {
    const completions = habit.completionHistory?.length || 0;
    const daysSinceCreation = Math.floor(
      (Date.now() - new Date(habit.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    const rate = daysSinceCreation > 0 ? (completions / daysSinceCreation) * 100 : 0;
    return sum + rate;
  }, 0);
  
  return (totalRate / habits.length).toFixed(2);
}

function getMostProductiveDay(habits) {
  const dayCounts = {};
  
  habits.forEach(habit => {
    habit.completionHistory?.forEach(completion => {
      const day = new Date(completion.date).getDay();
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
  });
  
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const mostProductiveDay = Object.keys(dayCounts).reduce((a, b) => 
    dayCounts[a] > dayCounts[b] ? a : b, '0'
  );
  
  return days[parseInt(mostProductiveDay)];
}

function groupHabitsByCategory(habits) {
  const categories = {};
  
  habits.forEach(habit => {
    const category = habit.category || 'Uncategorized';
    categories[category] = (categories[category] || 0) + 1;
  });
  
  return categories;
}

function getWeeklyTrends(habits) {
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  
  const trends = habits.map(habit => {
    const recentCompletions = habit.completionHistory?.filter(
      c => new Date(c.date) >= lastWeek
    ).length || 0;
    
    return {
      habitName: habit.name,
      completions: recentCompletions
    };
  });
  
  return trends;
}

function getMonthlyProgress(habits) {
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  
  const progress = habits.map(habit => {
    const monthCompletions = habit.completionHistory?.filter(
      c => new Date(c.date) >= lastMonth
    ).length || 0;
    
    return {
      habitName: habit.name,
      completions: monthCompletions,
      target: 30,
      percentage: ((monthCompletions / 30) * 100).toFixed(2)
    };
  });
  
  return progress;
}