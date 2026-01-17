// routes/habit.routes.js (UPDATED WITH CHART ANALYTICS)
const express = require('express');
const router = express.Router();
const habitController = require('../controllers/habit.controller');
const { authenticate } = require('../middleware/auth.middleware');

// ✅ Protect all routes with authentication only
router.use(authenticate);

// ============================================
// ANALYTICS ROUTES (NO PRO REQUIRED)
// ============================================

// ✅ Overall analytics - REMOVED isPro middleware
router.get('/analytics/overall', habitController.getOverallAnalytics);

// ✅ NEW: Chart analytics for period-based data (week/month/year)
router.get('/analytics/chart', habitController.getChartAnalytics);

// ============================================
// CRUD OPERATIONS
// ============================================
router.post('/', habitController.createHabit);
router.get('/', habitController.getUserHabits);
router.get('/:id', habitController.getHabitById);
router.put('/:id', habitController.updateHabit);
router.delete('/:id', habitController.deleteHabit);

// ============================================
// HABIT ACTIONS
// ============================================
router.post('/:id/complete', habitController.completeHabit);
router.post('/:id/uncomplete', habitController.uncompleteHabit);
router.post('/:id/buffer', habitController.useBufferDay);

// ============================================
// PAUSE/RESUME
// ============================================
router.post('/:id/pause', habitController.pauseHabit);
router.post('/:id/resume', habitController.resumeHabit);

// ============================================
// INDIVIDUAL HABIT ANALYTICS
// ============================================
router.get('/:id/streaks', habitController.getStreakStats);
router.get('/:id/analytics', habitController.getHabitAnalytics);

module.exports = router;
  


