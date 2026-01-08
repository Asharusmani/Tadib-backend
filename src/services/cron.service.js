// services/cron.service.js
const cron = require('node-cron');
const sharedHabitController = require('../controllers/sharedHabit.controller');
const Notification = require('../models/notification.model');

class CronService {
  constructor() {
    this.tasks = {};
    this.locks = {
      streakCheck: false,
      notificationCheck: false,
      cleanup: false
    };
  }

  initializeCronJobs() {
    console.log('🚀 [Cron] Initializing cron jobs...');
    
    // ========================================
    // 1️⃣ DAILY STREAK CHECK - 00:01 AM
    // ========================================
    this.tasks.streakCheck = cron.schedule('1 0 * * *', async () => {
      if (this.locks.streakCheck) {
        console.log('⏭️ [Streak] Job already running, skipping...');
        return;
      }

      this.locks.streakCheck = true;
      const startTime = Date.now();
      console.log(`\n${'='.repeat(50)}`);
      console.log('🔄 [STREAK CHECK] Starting...');
      console.log(`⏰ Time: ${new Date().toLocaleString()}`);
      console.log('='.repeat(50));
      
      try {
        await sharedHabitController.checkAndResetStreaks();
        const duration = Date.now() - startTime;
        console.log(`✅ [STREAK CHECK] Completed in ${duration}ms`);
      } catch (error) {
        console.error('❌ [STREAK CHECK] Error:', error.message);
        console.error(error.stack);
      } finally {
        this.locks.streakCheck = false;
        console.log('🔓 [STREAK CHECK] Lock released\n');
      }
    }, {
      scheduled: true,
      timezone: "Asia/Karachi"
    });

    // ========================================
    // 2️⃣ NOTIFICATION DELIVERY - Every 5 Minutes
    // ========================================
    this.tasks.notificationCheck = cron.schedule('*/5 * * * *', async () => {
      if (this.locks.notificationCheck) {
        console.log('⏭️ [Notifications] Job already running, skipping...');
        return;
      }

      this.locks.notificationCheck = true;
      const startTime = Date.now();
      
      try {
        const now = new Date();
        
        // ✅ Optimized query with lean() and limit
        const pendingNotifications = await Notification.find({
          scheduledFor: { $lte: now },
          isDelivered: false,
          sentAt: null
        })
        .select('_id userId title body type') // Only select needed fields
        .limit(50) // Process 50 at a time to avoid blocking
        .lean()
        .maxTimeMS(5000); // Timeout after 5 seconds

        if (pendingNotifications.length > 0) {
          console.log(`📬 [Notifications] Delivering ${pendingNotifications.length} pending notifications`);
          
          // ✅ Batch update - much faster
          const notificationIds = pendingNotifications.map(n => n._id);
          
          const updateResult = await Notification.updateMany(
            { _id: { $in: notificationIds } },
            { 
              $set: { 
                isDelivered: true, 
                sentAt: now
              } 
            },
            { maxTimeMS: 5000 }
          );
          
          const duration = Date.now() - startTime;
          console.log(`✅ [Notifications] ${updateResult.modifiedCount} delivered in ${duration}ms`);
        } else {
          // Silent if no notifications
          // console.log('📭 [Notifications] No pending notifications');
        }
      } catch (error) {
        console.error('❌ [Notifications] Error:', error.message);
        if (error.name === 'MongooseError') {
          console.error('🔌 [Notifications] Database connection issue');
        }
      } finally {
        this.locks.notificationCheck = false;
      }
    }, {
      scheduled: true,
      timezone: "Asia/Karachi"
    });

    // ========================================
    // 3️⃣ CLEANUP OLD NOTIFICATIONS - Every 6 Hours
    // ========================================
    this.tasks.cleanup = cron.schedule('0 */6 * * *', async () => {
      if (this.locks.cleanup) {
        console.log('⏭️ [Cleanup] Job already running, skipping...');
        return;
      }

      this.locks.cleanup = true;
      const startTime = Date.now();
      console.log('\n🗑️ [CLEANUP] Starting old notification cleanup...');
      
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        const result = await Notification.deleteMany({
          isRead: true,
          readAt: { $lt: thirtyDaysAgo }
        }).maxTimeMS(10000); // 10 second timeout
        
        const duration = Date.now() - startTime;
        
        if (result.deletedCount > 0) {
          console.log(`✅ [CLEANUP] Deleted ${result.deletedCount} old notifications in ${duration}ms`);
        } else {
          console.log(`📭 [CLEANUP] No old notifications to delete (${duration}ms)`);
        }
      } catch (error) {
        console.error('❌ [CLEANUP] Error:', error.message);
      } finally {
        this.locks.cleanup = false;
        console.log('🔓 [CLEANUP] Lock released\n');
      }
    }, {
      scheduled: true,
      timezone: "Asia/Karachi"
    });

    // ========================================
    // ✅ LOG INITIALIZATION STATUS
    // ========================================
    console.log('\n✅ [Cron] All jobs initialized successfully!');
    console.log('📅 [Cron] Schedules:');
    console.log('   📊 Streak Check:     00:01 daily');
    console.log('   📬 Notifications:    Every 5 minutes');
    console.log('   🗑️  Cleanup:          Every 6 hours');
    console.log('   🌍 Timezone:         Asia/Karachi\n');
  }

  // ========================================
  // 📊 GET CRON STATUS
  // ========================================
  getStatus() {
    return {
      initialized: Object.keys(this.tasks).length > 0,
      tasks: Object.keys(this.tasks).map(name => ({
        name,
        running: this.locks[name] || false
      })),
      locks: this.locks
    };
  }

  // ========================================
  // 🛑 GRACEFUL SHUTDOWN
  // ========================================
  async stopAllJobs() {
    console.log('\n🛑 [Cron] Graceful shutdown initiated...');
    
    // Wait for running jobs to complete (max 30 seconds)
    const maxWaitTime = 30000;
    const startWait = Date.now();
    
    while (Object.values(this.locks).some(lock => lock === true)) {
      if (Date.now() - startWait > maxWaitTime) {
        console.log('⚠️ [Cron] Force stopping - jobs took too long');
        break;
      }
      console.log('⏳ [Cron] Waiting for running jobs to complete...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Stop all cron tasks
    Object.entries(this.tasks).forEach(([name, task]) => {
      if (task) {
        task.stop();
        console.log(`✅ [Cron] Stopped: ${name}`);
      }
    });
    
    this.tasks = {};
    console.log('✅ [Cron] All jobs stopped successfully\n');
  }

  // ========================================
  // 🔄 MANUAL TRIGGER (for testing)
  // ========================================
  async manualTrigger(jobName) {
    console.log(`🔧 [Cron] Manual trigger: ${jobName}`);
    
    switch(jobName) {
      case 'streakCheck':
        if (!this.locks.streakCheck) {
          this.locks.streakCheck = true;
          try {
            await sharedHabitController.checkAndResetStreaks();
            console.log('✅ Manual streak check completed');
          } finally {
            this.locks.streakCheck = false;
          }
        }
        break;
        
      case 'notificationCheck':
        if (!this.locks.notificationCheck) {
          this.locks.notificationCheck = true;
          try {
            const now = new Date();
            const result = await Notification.updateMany(
              { scheduledFor: { $lte: now }, isDelivered: false },
              { isDelivered: true, sentAt: now }
            );
            console.log(`✅ Manual notification check: ${result.modifiedCount} delivered`);
          } finally {
            this.locks.notificationCheck = false;
          }
        }
        break;
        
      default:
        console.log('❌ Unknown job name');
    }
  }
}

module.exports = new CronService();