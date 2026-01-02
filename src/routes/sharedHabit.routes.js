// ============================================
// FILE: routes/sharedHabit.routes.js (UPDATED)
// ============================================
const express = require('express');
const router = express.Router();
const sharedHabitController = require('../controllers/sharedHabit.controller');
const authMiddleware = require('../middleware/auth.middleware');

const authenticate = authMiddleware.authenticate;

// Create & Invite
router.post('/', authenticate, sharedHabitController.createSharedHabit);
router.post('/:habitId/invite', authenticate, sharedHabitController.inviteParticipant);

// ✅ NEW: Verify invite token (public - no auth needed)
router.get('/invite/:token/verify', sharedHabitController.verifyInviteToken);

// ✅ NEW: Accept invite after signup
router.post('/invite/accept', authenticate, sharedHabitController.acceptInviteAfterSignup);

// Accept/Decline Invitation (in-app)
router.post('/:habitId/accept', authenticate, sharedHabitController.acceptInvitation);
router.post('/:habitId/decline', authenticate, sharedHabitController.declineInvitation);

// Complete Task
router.post('/:habitId/complete', authenticate, sharedHabitController.completeTask);
router.post('/:habitId/undo', authenticate, sharedHabitController.undoCompletion);

// Get Shared Habits
router.get('/', authenticate, sharedHabitController.getMySharedHabits);
router.get('/:habitId/history', authenticate, sharedHabitController.getCompletionHistory);
router.get('/:habitId/streak', authenticate, sharedHabitController.getStreakInfo);
router.get('/:habitId', authenticate, sharedHabitController.getSharedHabitDetails);

// Leave/Delete
router.delete('/:habitId/leave', authenticate, sharedHabitController.leaveSharedHabit);
router.delete('/:habitId', authenticate, sharedHabitController.deleteSharedHabit);

router.get('/test-email', authenticate, async (req, res) => {
  const MessagingService = require('../services/messaging.service');
  const result = await MessagingService.testEmailConfig();
  res.json(result);
});

module.exports = router;