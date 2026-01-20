const nodemailer = require('nodemailer');

// Email configuration
const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
};

// Create reusable transporter
let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport(emailConfig);
  }
  return transporter;
}

/**
 * Send password reset confirmation email to user
 * @param {string} userEmail - User's email address
 * @param {string} userName - User's full name
 * @param {string} adminName - Admin who reset the password
 */
async function sendPasswordResetEmail(userEmail, userName, adminName) {
  try {
    // Check if email is configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.log('⚠️ Email not configured - skipping email notification');
      return { success: false, message: 'Email not configured' };
    }

    const mailOptions = {
      from: `"KMTI File Management System" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: 'Your Password Has Been Reset',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset Confirmation</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              
              <p>Your password has been successfully reset by <strong>${adminName}</strong>.</p>
              
              <p>You can now log in to the KMTI File Management System with your new password.</p>
              
              <p><strong>Important Security Notes:</strong></p>
              <ul>
                <li>If you did not request this password reset, please contact your administrator immediately.</li>
                <li>We recommend changing your password after logging in.</li>
                <li>Never share your password with anyone.</li>
              </ul>
              
              <p>If you have any questions or concerns, please contact your system administrator.</p>
              
              <p>Best regards,<br>KMTI File Management System</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hello ${userName},

Your password has been successfully reset by ${adminName}.

You can now log in to the KMTI File Management System with your new password.

Important Security Notes:
- If you did not request this password reset, please contact your administrator immediately.
- We recommend changing your password after logging in.
- Never share your password with anyone.

If you have any questions or concerns, please contact your system administrator.

Best regards,
KMTI File Management System

---
This is an automated message. Please do not reply to this email.
      `
    };

    const info = await getTransporter().sendMail(mailOptions);
    console.log('✅ Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('❌ Error sending password reset email:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send password reset link email to user (self-service)
 * @param {string} userEmail - User's email address
 * @param {string} userName - User's full name
 * @param {string} resetToken - Password reset token
 */
async function sendPasswordResetLinkEmail(userEmail, userName, resetToken) {
  try {
    // Check if email is configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.log('⚠️ Email not configured - skipping reset link email');
      return { success: false, message: 'Email not configured' };
    }

    const resetLink = `http://localhost:5173/#/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: `"KMTI File Management System" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: 'Reset Your Password - KMTI File Management',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .button:hover { background: #2563eb; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
            .code { background: #f3f4f6; padding: 8px 12px; border-radius: 4px; font-family: monospace; display: inline-block; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Reset Your Password</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              
              <p>We received a request to reset your password for the KMTI File Management System.</p>
              
              <p>Click the button below to reset your password:</p>
              
              <p style="text-align: center;">
                <a href="${resetLink}" class="button">Reset Password</a>
              </p>
              
              <p>Or copy and paste this link into your browser:</p>
              <div class="code">${resetLink}</div>
              
              <div class="warning">
                <strong>⚠️ Important:</strong>
                <ul style="margin: 8px 0;">
                  <li>This link will expire in <strong>1 hour</strong></li>
                  <li>This link can only be used <strong>once</strong></li>
                  <li>If you didn't request this, please ignore this email or contact your administrator</li>
                </ul>
              </div>
              
              <p><strong>Alternative:</strong> If you prefer, you can also contact your administrator to reset your password manually.</p>
              
              <p>Best regards,<br>KMTI File Management System</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
              <p>If you have any questions, please contact your system administrator.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hello ${userName},

We received a request to reset your password for the KMTI File Management System.

Click this link to reset your password:
${resetLink}

IMPORTANT:
- This link will expire in 1 hour
- This link can only be used once
- If you didn't request this, please ignore this email or contact your administrator

Alternative: If you prefer, you can also contact your administrator to reset your password manually.

Best regards,
KMTI File Management System

---
This is an automated message. Please do not reply to this email.
If you have any questions, please contact your system administrator.
      `
    };

    const info = await getTransporter().sendMail(mailOptions);
    console.log('✅ Password reset link email sent:', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('❌ Error sending password reset link email:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test email configuration
 */
async function testEmailConfig() {
  try {
    await getTransporter().verify();
    console.log('✅ Email server is ready');
    return true;
  } catch (error) {
    console.error('❌ Email server error:', error.message);
    return false;
  }
}

module.exports = {
  sendPasswordResetEmail,
  sendPasswordResetLinkEmail,
  testEmailConfig
};
