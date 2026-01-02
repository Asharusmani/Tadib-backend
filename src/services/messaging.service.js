// ============================================
// FILE: services/messaging.service.js (FIXED WITH ERROR HANDLING)
// ============================================
const nodemailer = require('nodemailer');

class MessagingService {
  constructor() {
    // Check if email credentials exist
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.warn('⚠️ WARNING: Email credentials not configured in .env');
      console.warn('⚠️ Invite links will be generated but emails will not be sent');
      this.emailTransporter = null;
    } else {
      try {
        this.emailTransporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
          }
        });
        console.log('✅ Email service initialized');
      } catch (error) {
        console.error('❌ Email transporter setup failed:', error.message);
        this.emailTransporter = null;
      }
    }
  }
  
  async sendInviteEmail({ email, inviterName, habitTitle, inviteLink }) {
    try {
      // If email not configured, just log and return success
      if (!this.emailTransporter) {
        console.log('📧 [DEV MODE] Email would be sent to:', email);
        console.log('📧 [DEV MODE] Invite link:', inviteLink);
        return { 
          success: true, 
          devMode: true,
          message: 'Email service not configured - link generated for manual use'
        };
      }
      
      const mailOptions = {
        from: `"${process.env.APP_NAME || 'Habit Tracker'}" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `${inviterName} invited you to join "${habitTitle}"`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                background: #f7f9fc; 
                padding: 20px; 
                margin: 0;
                line-height: 1.6;
              }
              .container { 
                background: white; 
                padding: 40px; 
                border-radius: 12px; 
                max-width: 600px; 
                margin: 0 auto; 
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
              }
              .header h1 {
                color: #333;
                margin: 0;
                font-size: 28px;
              }
              .emoji {
                font-size: 48px;
                margin-bottom: 10px;
              }
              .content {
                color: #555;
                font-size: 16px;
              }
              .inviter {
                color: #4CAF50;
                font-weight: bold;
              }
              .habit-box {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                border-radius: 8px;
                margin: 25px 0;
                text-align: center;
              }
              .habit-box h2 {
                margin: 0;
                font-size: 24px;
              }
              .cta-container {
                text-align: center;
                margin: 30px 0;
              }
              .button { 
                background: #4CAF50; 
                color: white !important; 
                padding: 16px 40px; 
                text-decoration: none; 
                border-radius: 8px; 
                display: inline-block; 
                font-weight: bold;
                font-size: 16px;
                transition: background 0.3s;
              }
              .button:hover { 
                background: #45a049; 
              }
              .benefits {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
              }
              .benefits ul {
                margin: 10px 0;
                padding-left: 20px;
              }
              .benefits li {
                margin: 8px 0;
                color: #666;
              }
              .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 2px solid #eee;
                text-align: center;
              }
              .footer p {
                color: #999;
                font-size: 13px;
                margin: 5px 0;
              }
              .link-box {
                background: #f0f0f0;
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;
                word-break: break-all;
                font-size: 12px;
                color: #666;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="emoji">🎯</div>
                <h1>You're Invited!</h1>
              </div>
              
              <div class="content">
                <p>Hey there!</p>
                <p><span class="inviter">${inviterName}</span> has invited you to join a habit challenge:</p>
                
                <div class="habit-box">
                  <h2>"${habitTitle}"</h2>
                </div>
                
                <div class="benefits">
                  <h3 style="margin-top: 0; color: #333;">Why join?</h3>
                  <ul>
                    <li>🤝 Build habits together with accountability</li>
                    <li>🔥 Track shared streaks and celebrate wins</li>
                    <li>📊 Monitor progress as a team</li>
                    <li>🏆 Earn points and achievements</li>
                  </ul>
                </div>
                
                <div class="cta-container">
                  <a href="${inviteLink}" class="button">Accept Invitation</a>
                </div>
                
                <div class="link-box">
                  <strong>Or copy this link:</strong><br>
                  ${inviteLink}
                </div>
              </div>
              
              <div class="footer">
                <p><strong>This invitation expires in 7 days.</strong></p>
                <p>If you didn't expect this invitation, you can safely ignore this email.</p>
                <p style="margin-top: 15px;">© ${new Date().getFullYear()} ${process.env.APP_NAME || 'Habit Tracker'}. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };
      
      await this.emailTransporter.sendMail(mailOptions);
      console.log(`✅ Invite email sent successfully to ${email}`);
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ Email send error:', error.message);
      // Return error but don't throw - let controller handle it
      return { 
        success: false, 
        error: error.message,
        fallback: true 
      };
    }
  }
  
  // Test email configuration
  async testEmailConfig() {
    if (!this.emailTransporter) {
      return { success: false, message: 'Email not configured' };
    }
    
    try {
      await this.emailTransporter.verify();
      return { success: true, message: 'Email configuration is valid' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = new MessagingService();