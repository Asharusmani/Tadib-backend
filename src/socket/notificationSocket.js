// ============================================
// 1. BACKEND: socket/notificationSocket.js (NEW FILE)
// ============================================
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');

class NotificationSocket {
  constructor() {
    this.io = null;
    this.userSockets = new Map(); // userId -> socketId mapping
  }

  initialize(server) {
    this.io = socketIO(server, {
      cors: {
        origin: process.env.CLIENT_URL || '*',
        methods: ['GET', 'POST']
      },
      transports: ['websocket', 'polling']
    });

    this.io.use(this.authenticateSocket.bind(this));
    this.io.on('connection', this.handleConnection.bind(this));

    console.log('✅ Notification Socket.IO initialized');
  }

  // Authenticate socket connection
  async authenticateSocket(socket, next) {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      
      next();
    } catch (error) {
      console.error('❌ Socket auth failed:', error);
      next(new Error('Authentication failed'));
    }
  }

  // Handle new socket connection
  handleConnection(socket) {
    const userId = socket.userId;
    console.log(`✅ User connected: ${userId} (socket: ${socket.id})`);

    // Store user's socket
    this.userSockets.set(userId, socket.id);

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${userId}`);
      this.userSockets.delete(userId);
    });

    // Send initial unread count
    this.sendUnreadCount(userId);
  }

  // ✅ Send notification to specific user
  sendNotificationToUser(userId, notification) {
    const socketId = this.userSockets.get(userId.toString());
    
    if (socketId) {
      this.io.to(socketId).emit('new_notification', notification);
      console.log(`✅ Sent notification to user ${userId}`);
      
      // Also send updated unread count
      this.sendUnreadCount(userId);
      return true;
    } else {
      console.log(`⚠️ User ${userId} not connected`);
      return false;
    }
  }

  // ✅ Send unread count to user
  async sendUnreadCount(userId) {
    const socketId = this.userSockets.get(userId.toString());
    
    if (socketId) {
      try {
        const Notification = require('../models/notification.model');
        const count = await Notification.countDocuments({ 
          userId, 
          isRead: false 
        });
        
        this.io.to(socketId).emit('unread_count_update', { unreadCount: count });
        console.log(`✅ Sent unread count to user ${userId}: ${count}`);
      } catch (error) {
        console.error('❌ Failed to send unread count:', error);
      }
    }
  }

  // ✅ Broadcast notification to multiple users
  sendNotificationToUsers(userIds, notification) {
    userIds.forEach(userId => {
      this.sendNotificationToUser(userId, notification);
    });
  }
}

module.exports = new NotificationSocket();
