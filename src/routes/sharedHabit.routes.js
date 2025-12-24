// ============================================
// FILE: routes/sharedHabit.routes.js (FIXED)
// ============================================
const express = require('express');
const router = express.Router();
const sharedHabitController = require('../controllers/sharedHabit.controller');

// Import authenticate middleware correctly - NOTE: middlewares (plural)
const authMiddleware = require('../middleware/auth.middleware');

// Debug: Check what we got
console.log('🔍 Auth middleware object:', authMiddleware);
console.log('🔍 Authenticate type:', typeof authMiddleware.authenticate);

// Use the authenticate function
const authenticate = authMiddleware.authenticate;

// Verify middleware is loaded correctly
if (typeof authenticate !== 'function') {
  console.error('❌ authenticate middleware is not a function!');
  console.error('❌ Received:', authenticate);
  throw new Error('Authentication middleware failed to load');
}

// Create & Invite
router.post('/', authenticate, sharedHabitController.createSharedHabit);
router.post('/:habitId/invite', authenticate, sharedHabitController.inviteParticipant);

// Accept/Decline Invitation
router.post('/:habitId/accept', authenticate, sharedHabitController.acceptInvitation);
router.post('/:habitId/decline', authenticate, sharedHabitController.declineInvitation);

// Complete Task
router.post('/:habitId/complete', authenticate, sharedHabitController.completeTask);
router.post('/:habitId/undo', authenticate, sharedHabitController.undoCompletion);

// Get Shared Habits - FIXED ORDER (specific routes before :habitId)
router.get('/', authenticate, sharedHabitController.getMySharedHabits);
router.get('/:habitId/history', authenticate, sharedHabitController.getCompletionHistory);
router.get('/:habitId/streak', authenticate, sharedHabitController.getStreakInfo);
router.get('/:habitId', authenticate, sharedHabitController.getSharedHabitDetails);

// Leave/Delete
router.delete('/:habitId/leave', authenticate, sharedHabitController.leaveSharedHabit);
router.delete('/:habitId', authenticate, sharedHabitController.deleteSharedHabit);

// Debug logging
console.log('✅ Shared Habit routes loaded successfully');
console.log('Available controller methods:', Object.keys(sharedHabitController));

module.exports = router;