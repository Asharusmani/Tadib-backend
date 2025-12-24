const express = require('express');
const router = express.Router();
const habitController = require('../controllers/habit.controller');
const { authenticate, isPro } = require('../middleware/auth.middleware'); // ✅ Changed to 'middlewares'

// Remove debug logs now
// ✅ Protect all routes with authentication
router.use(authenticate);

// ✅ Pro feature: Overall analytics - MUST come before /:id routes
router.get('/analytics/overall', isPro, habitController.getOverallAnalytics);

// CRUD Operations
router.post('/', habitController.createHabit);
router.get('/', habitController.getUserHabits);
router.get('/:id', habitController.getHabitById);
router.put('/:id', habitController.updateHabit);
router.delete('/:id', habitController.deleteHabit);

// Habit Actions
router.post('/:id/complete', habitController.completeHabit);
router.post('/:id/uncomplete', habitController.uncompleteHabit);
router.post('/:id/buffer', habitController.useBufferDay);

// Pause/Resume
router.post('/:id/pause', habitController.pauseHabit);
router.post('/:id/resume', habitController.resumeHabit);

// Analytics
router.get('/:id/streaks', habitController.getStreakStats);
router.get('/:id/analytics', habitController.getHabitAnalytics);

module.exports = router;