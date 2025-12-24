// services/cron.service.js
const cron = require('node-cron');
const sharedHabitController = require('../controllers/sharedHabit.controller');

class CronService {
  initializeCronJobs() {
    // Run every day at 00:01
    cron.schedule('1 0 * * *', async () => {
      console.log('Running streak check cron job...');
      await sharedHabitController.checkAndResetStreaks();
    });
    
    console.log('✅ Cron jobs initialized');
  }
}

module.exports = new CronService();