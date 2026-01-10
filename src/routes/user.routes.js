// routes/user.routes.js - PRODUCTION READY
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { upload } = require('../config/upload');

// ============================================
// PROFILE ROUTES
// ============================================

router.get('/profile', authenticate, userController.getUserProfile);
router.put('/profile', authenticate, userController.updateProfile);

// ✅ Avatar upload - OPTIMIZED ORDER
router.post(
  '/profile/avatar',
  authenticate,              // Sets req.userId
  upload.single('avatar'),   // Processes file
  userController.uploadAvatar
);

router.delete('/profile/avatar', authenticate, userController.deleteAvatar);

// ============================================
// STATS & ACHIEVEMENTS
// ============================================

router.get('/stats', authenticate, userController.getUserStats);
router.get('/achievements', authenticate, userController.getUserAchievements);

// ============================================
// SETTINGS
// ============================================

router.put('/settings', authenticate, userController.updateSettings);
router.put('/settings/notifications', authenticate, userController.updateNotificationSettings);
router.put('/settings/privacy', authenticate, userController.updatePrivacySettings);

// ============================================
// ACCOUNT MANAGEMENT
// ============================================

router.post('/change-password', authenticate, userController.changePassword);
router.delete('/account', authenticate, userController.deleteAccount);
router.post('/account/deactivate', authenticate, userController.deactivateAccount);
router.post('/account/reactivate', authenticate, userController.reactivateAccount);

// ============================================
// PUBLIC
// ============================================

router.get('/public/:userId', userController.getPublicProfile);

// ============================================
// PRO FEATURES
// ============================================

router.get('/pro/features', authenticate, userController.getProFeatures);
router.get('/pro/analytics', authenticate, userController.getProAnalytics);

// ============================================
// ERROR HANDLER
// ============================================
router.use((error, req, res, next) => {
  console.error('User routes error:', error.message);
  
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File too large. Maximum size is 5MB.'
    });
  }
  
  if (error.message?.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'An error occurred'
  });
});

module.exports = router;