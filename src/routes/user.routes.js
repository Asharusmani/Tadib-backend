// routes/user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

// ✅ All routes require authentication
router.use(authenticate);

// ============================================
// PROFILE ROUTES
// ============================================

// Get user profile
router.get('/profile', userController.getUserProfile);

// Update user profile
router.put('/profile', userController.updateProfile);

// Upload profile avatar
router.post('/profile/avatar', upload.single('avatar'), userController.uploadAvatar);

// Delete profile avatar
router.delete('/profile/avatar', userController.deleteAvatar);

// ============================================
// STATS ROUTES
// ============================================

// Get user stats (streaks, points, habits count)
router.get('/stats', userController.getUserStats);

// ============================================
// ACHIEVEMENTS ROUTES
// ============================================

// Get user achievements and badges
router.get('/achievements', userController.getUserAchievements);

// ============================================
// SETTINGS ROUTES
// ============================================

// Update user settings
router.put('/settings', userController.updateSettings);

// Update notification preferences
router.put('/settings/notifications', userController.updateNotificationSettings);

// Update privacy settings
router.put('/settings/privacy', userController.updatePrivacySettings);

// ============================================
// ACCOUNT MANAGEMENT
// ============================================

// Change password
router.post('/change-password', userController.changePassword);

// Delete account
router.delete('/account', userController.deleteAccount);

// Deactivate account
router.post('/account/deactivate', userController.deactivateAccount);

module.exports = router;