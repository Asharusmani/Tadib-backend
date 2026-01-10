// ============================================
// routes/notification.routes.js
// ============================================
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.middleware'); 

// All routes are protected (login required)
router.use(authenticate);

// Get all notifications
router.get('/', notificationController.getNotifications);

// Get unread count
router.get('/unread-count', notificationController.getUnreadCount);

// Mark single notification as read
router.patch('/:id/read', notificationController.markAsRead);

// Mark all as read
router.patch('/mark-all-read', notificationController.markAllAsRead);

// Delete notification
router.delete('/:id', notificationController.deleteNotification);

// ✅ NEW: Batch mark as read (optional - for better performance)
router.patch('/batch/mark-read', notificationController.batchMarkAsRead);



module.exports = router;


// ============================================
// routes/sharedHabit.routes.js (UPDATE THIS)
// ============================================
/*
const express = require('express');
const router = express.Router();
const sharedHabitController = require('../controllers/sharedHabit.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All routes protected
router.use(authenticate);

// ... your existing shared habit routes ...

// ✅ ADD THESE NEW ROUTES:

// Invite participant to shared habit
router.post('/:habitId/invite', sharedHabitController.inviteParticipant);

// Accept habit invitation
router.patch('/:habitId/accept', sharedHabitController.acceptInvitation);

// Reject/Decline habit invitation
router.patch('/:habitId/reject', sharedHabitController.rejectInvitation);

module.exports = router;
*/