// ============================================
// FILE 1: server.js (COMPLETE - REPLACE ENTIRE FILE)
// ============================================
const express = require('express');
const http = require('http'); // ✅ CHANGED: Import http
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const notificationRoutes = require('./routes/notification.routes'); 
const userRoutes = require('./routes/user.routes'); 
const cronService = require('./services/cron.service');
const notificationSocket = require('./socket/notificationSocket'); // ✅ NEW
const notificationService = require('./services/notification.service'); // ✅ NEW

require('dotenv').config();

const app = express();
const server = http.createServer(app); // ✅ CHANGED: Create HTTP server

// ========================================
// MIDDLEWARE
// ========================================

// Enable CORS for React Native + Socket.IO
app.use(cors({
  origin: '*', // In production, specify your frontend URL
  credentials: true
}));

app.use(helmet({
  crossOriginResourcePolicy: false, // Allow images to be loaded
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ✅ Serve static files (uploaded avatars)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate Limiting
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// ========================================
// IMPORT ROUTES
// ========================================
const authRoutes = require('./routes/auth.routes');
const habitRoutes = require('./routes/habit.routes');
const sharedHabitRoutes = require('./routes/sharedHabit.routes');

// ========================================
// DATABASE CONNECTION
// ========================================
let isDBConnected = false;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');
    console.log(`📍 Database: ${mongoose.connection.db.databaseName}`);
    isDBConnected = true;
    
    // ✅ Initialize cron jobs AFTER successful DB connection
    cronService.initializeCronJobs();
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.error('💡 Check your MONGO_URI in .env file');
    process.exit(1);
  });

// Handle MongoDB connection events
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB Disconnected');
  isDBConnected = false;
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB Reconnected');
  isDBConnected = true;
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB Error:', err.message);
});

// ========================================
// ✅ INITIALIZE SOCKET.IO (AFTER SERVER CREATION)
// ========================================
notificationSocket.initialize(server);
notificationService.setSocket(notificationSocket);
console.log('✅ Socket.IO initialized and connected to NotificationService');

// ========================================
// ROUTES
// ========================================
app.use('/api/auth', authRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/users', userRoutes); 
app.use('/api/notifications', notificationRoutes);
app.use('/api/shared-habits', sharedHabitRoutes);

// ========================================
// HEALTH CHECK
// ========================================
app.get('/health', (req, res) => {
  const healthcheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: isDBConnected ? 'Connected' : 'Disconnected',
    socketIO: notificationSocket.getConnectionCount(), // ✅ NEW
    cronJobs: cronService.getStatus(),
    environment: process.env.NODE_ENV || 'development',
    mongooseVersion: mongoose.version
  };
  
  const httpCode = isDBConnected ? 200 : 503;
  res.status(httpCode).json(healthcheck);
});

// ========================================
// CRON STATUS ENDPOINT (Optional - for debugging)
// ========================================
app.get('/api/admin/cron/status', (req, res) => {
  res.json(cronService.getStatus());
});

// ========================================
// ERROR HANDLING MIDDLEWARE
// ========================================
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  
  res.status(err.status || 500).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { 
        stack: err.stack,
        details: err 
      })
    }
  });
});

// ========================================
// 404 HANDLER
// ========================================
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// ========================================
// START SERVER
// ========================================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📍 API URL: http://localhost:${PORT}/api`);
  console.log(`💚 Health Check: http://localhost:${PORT}/health`);
  console.log(`📁 Uploads: http://localhost:${PORT}/uploads`);
  console.log(`🔌 Socket.IO: Enabled`); // ✅ NEW
  console.log('='.repeat(50) + '\n');
});

// ========================================
// GRACEFUL SHUTDOWN HANDLER
// ========================================
const gracefulShutdown = async (signal) => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📥 Received ${signal}. Starting graceful shutdown...`);
  console.log('='.repeat(50));
  
  // Stop accepting new requests
  server.close(async () => {
    console.log('🔌 HTTP server closed - no longer accepting connections');
    
    try {
      // 1️⃣ Disconnect all socket connections
      console.log('🔌 Disconnecting Socket.IO clients...');
      notificationSocket.disconnectAll();
      console.log('✅ Socket.IO clients disconnected');
      
      // 2️⃣ Stop cron jobs
      console.log('⏹️  Stopping cron jobs...');
      await cronService.stopAllJobs();
      console.log('✅ Cron jobs stopped');
      
      // 3️⃣ Close database connection
      console.log('💾 Closing database connection...');
      await mongoose.connection.close(false);
      console.log('✅ Database connection closed');
      
      console.log('\n✅ Graceful shutdown complete');
      process.exit(0);
      
    } catch (error) {
      console.error('❌ Error during shutdown:', error.message);
      process.exit(1);
    }
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('⚠️ Forcing shutdown after 30s timeout');
    process.exit(1);
  }, 30000);
};

// ========================================
// PROCESS EVENT LISTENERS
// ========================================

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('\n❌ UNCAUGHT EXCEPTION:', error.message);
  console.error(error.stack);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ UNHANDLED REJECTION at:', promise);
  console.error('Reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Log when process is about to exit
process.on('exit', (code) => {
  console.log(`\n👋 Process exited with code: ${code}`);
});

// ========================================
// EXPORT FOR TESTING
// ========================================
module.exports = { app, server };
