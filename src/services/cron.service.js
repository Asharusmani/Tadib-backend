// services/cron.service.js
const cron = require('node-cron');
const sharedHabitController = require('../controllers/sharedHabit.controller');
const Notification = require('../models/notification.model');

class CronService {
  constructor() {
    this.isStreakCheckRunning = false;
    this.isNotificationCheckRunning = false;
    this.isCleanupRunning = false;
  }

  initializeCronJobs() {
    // Run every day at 00:01 - Check and reset streaks
    cron.schedule('1 0 * * *', async () => {
      if (this.isStreakCheckRunning) {
        console.log('⏭️ Skipping streak check - already running');
        return;
      }

      this.isStreakCheckRunning = true;
      const startTime = Date.now();
      console.log('🔄 [Cron] Starting daily streak check...');
      
      try {
        await sharedHabitController.checkAndResetStreaks();
        const duration = Date.now() - startTime;
        console.log(`✅ [Cron] Streak check completed in ${duration}ms`);
      } catch (error) {
        console.error('❌ [Cron] Streak check error:', error.message);
      } finally {
        this.isStreakCheckRunning = false;
      }
    });

    // Run every minute - Check and send scheduled notifications
    cron.schedule('* * * * *', async () => {
      if (this.isNotificationCheckRunning) {
        console.log('⏭️ Skipping notification check - already running');
        return;
      }

      this.isNotificationCheckRunning = true;
      
      try {
        const now = new Date();
        
        // Use lean() for better performance and limit the query
        const pendingNotifications = await Notification.find({
          scheduledFor: { $lte: now },
          isDelivered: false,
          sentAt: null
        })
        .limit(100) // Process max 100 at a time
        .lean();

        if (pendingNotifications.length > 0) {
          console.log(`📬 [Cron] Delivering ${pendingNotifications.length} notifications`);
          
          // Batch update for better performance
          const notificationIds = pendingNotifications.map(n => n._id);
          
          await Notification.updateMany(
            { _id: { $in: notificationIds } },
            { 
              $set: { 
                isDelivered: true, 
                sentAt: new Date() 
              } 
            }
          );
          
          console.log(`✅ [Cron] ${pendingNotifications.length} notifications delivered`);
        }
      } catch (error) {
        console.error('❌ [Cron] Notification error:', error.message);
      } finally {
        this.isNotificationCheckRunning = false;
      }
    });

    // Run every hour at minute 5 - Clean up old read notifications
    cron.schedule('5 * * * *', async () => {
      if (this.isCleanupRunning) {
        console.log('⏭️ Skipping cleanup - already running');
        return;
      }

      this.isCleanupRunning = true;
      
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        const result = await Notification.deleteMany({
          isRead: true,
          readAt: { $lt: thirtyDaysAgo }
        });
        
        if (result.deletedCount > 0) {
          console.log(`🗑️ [Cron] Cleaned up ${result.deletedCount} old notifications`);
        }
      } catch (error) {
        console.error('❌ [Cron] Cleanup error:', error.message);
      } finally {
        this.isCleanupRunning = false;
      }
    });
    
    console.log('✅ [Cron] All cron jobs initialized');
    console.log('📅 [Cron] Schedule: Streaks (00:01), Notifications (every minute), Cleanup (hourly at :05)');
  }

  // Graceful shutdown
  stopAllJobs() {
    console.log('🛑 [Cron] Stopping all cron jobs...');
    cron.getTasks().forEach(task => task.stop());
    console.log('✅ [Cron] All jobs stopped');
  }
}

module.exports = new CronService();