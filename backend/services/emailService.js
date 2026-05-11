import nodemailer from "nodemailer";
import config from "../config/index.js";
import logger from "./logger.js";

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    if (config.nodeEnv === "production" && config.smtp?.host) {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass
        }
      });
    }
  }

  async sendEmail(to, subject, html, options = {}) {
    if (!this.transporter) {
      logger.info("Email (simulated)", { to, subject });
      return { simulated: true };
    }

    try {
      const result = await this.transporter.sendMail({
        from: config.smtp.from || "noreply@changeaipay.com",
        to,
        subject,
        html,
        ...options
      });

      logger.info("Email sent", { to, subject, messageId: result.messageId });
      return result;
    } catch (err) {
      logger.error("Email failed", { to, subject, error: err.message });
      throw err;
    }
  }

  async sendTransactionReceipt(user, transaction) {
    const isIncoming = transaction.direction === "incoming";
    const subject = isIncoming 
      ? `💰 You received ${transaction.amount} XNO!`
      : `✅ Payment sent: ${transaction.amount} XNO`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Transaction Receipt</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #000; font-family: 'Segoe UI', sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #000; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #121212; border: 1px solid rgba(84, 195, 255, 0.2); border-radius: 16px;">
                <tr>
                  <td style="padding: 32px;">
                    <h1 style="color: #fff; font-size: 24px; margin: 0 0 24px;">
                      ${isIncoming ? "💰 Payment Received!" : "✅ Payment Sent"}
                    </h1>
                    
                    <div style="background: linear-gradient(135deg, rgba(84, 195, 255, 0.1), rgba(30, 107, 224, 0.1)); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                      <p style="color: rgba(255,255,255,0.6); font-size: 14px; margin: 0 0 8px;">Amount</p>
                      <p style="color: #54c3ff; font-size: 32px; font-weight: 700; margin: 0;">${transaction.amount} XNO</p>
                    </div>

                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                          <p style="color: rgba(255,255,255,0.6); font-size: 12px; margin: 0;">${isIncoming ? "From" : "To"}</p>
                          <p style="color: #fff; font-size: 14px; margin: 4px 0 0; font-family: monospace;">${isIncoming ? transaction.fromAddress : transaction.toAddress}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                          <p style="color: rgba(255,255,255,0.6); font-size: 12px; margin: 0;">Transaction Hash</p>
                          <p style="color: #fff; font-size: 14px; margin: 4px 0 0; font-family: monospace;">${transaction.hash?.substring(0, 20)}...</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;">
                          <p style="color: rgba(255,255,255,0.6); font-size: 12px; margin: 0;">Status</p>
                          <p style="color: #00d67d; font-size: 14px; margin: 4px 0 0; font-weight: 600;">✓ Confirmed</p>
                        </td>
                      </tr>
                    </table>

                    <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin-top: 24px;">
                      This transaction was processed on the Nano network with zero fees.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  async sendPaymentReminder(user, payment) {
    const subject = "⏰ Payment reminder";
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="background: #000; color: #fff; padding: 40px 20px; font-family: sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background: #121212; border-radius: 16px; padding: 32px; border: 1px solid rgba(84, 195, 255, 0.2);">
          <h1 style="color: #54c3ff;">⏰ Payment Reminder</h1>
          <p>You have a pending payment request for <strong>${payment.amount} XNO</strong>.</p>
          <p style="color: rgba(255,255,255,0.6);">From: ${payment.from}</p>
          <a href="#" style="display: inline-block; background: linear-gradient(135deg, #0f2760, #1e6be0); color: #fff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; margin-top: 20px;">
            View Payment Request
          </a>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  async sendLowBalanceAlert(user, balance, threshold) {
    const subject = "⚠️ Low Balance Alert";
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="background: #000; color: #fff; padding: 40px 20px; font-family: sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background: #121212; border-radius: 16px; padding: 32px; border: 1px solid rgba(255, 193, 7, 0.3);">
          <h1 style="color: #ffc107;">⚠️ Low Balance Alert</h1>
          <p>Your wallet balance is below your threshold.</p>
          <div style="background: rgba(255, 193, 7, 0.1); border-radius: 12px; padding: 20px; margin: 20px 0;">
            <p style="color: rgba(255,255,255,0.6); font-size: 14px; margin: 0;">Current Balance</p>
            <p style="color: #ffc107; font-size: 28px; font-weight: 700; margin: 8px 0 0;">${balance} XNO</p>
          </div>
          <p style="color: rgba(255,255,255,0.6); font-size: 14px;">Your threshold: ${threshold} XNO</p>
          <a href="#" style="display: inline-block; background: linear-gradient(135deg, #0f2760, #1e6be0); color: #fff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; margin-top: 20px;">
            Add Funds
          </a>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  async sendFraudAlert(user, alert) {
    const subject = "🔒 Security Alert - Suspicious Activity";
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="background: #000; color: #fff; padding: 40px 20px; font-family: sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background: #121212; border-radius: 16px; padding: 32px; border: 1px solid rgba(255, 144, 139, 0.3);">
          <h1 style="color: #ff908b;">🔒 Security Alert</h1>
          <p>We detected unusual activity on your account:</p>
          <div style="background: rgba(255, 144, 139, 0.1); border-radius: 12px; padding: 20px; margin: 20px 0;">
            <p style="color: #fff; font-size: 16px; margin: 0;">${alert.description}</p>
            <p style="color: rgba(255,255,255,0.6); font-size: 14px; margin-top: 8px;">${alert.explanation}</p>
          </div>
          <p style="color: rgba(255,255,255,0.6); font-size: 14px;">If this wasn't you, please secure your account immediately.</p>
          <a href="#" style="display: inline-block; background: linear-gradient(135deg, #0f2760, #1e6be0); color: #fff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; margin-top: 20px;">
            Review Activity
          </a>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  async sendGoalUpdate(user, goal) {
    const progress = (goal.current / goal.target) * 100;
    const subject = progress >= 100 ? "🎉 Goal Achieved!" : "📊 Goal Progress Update";
    
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="background: #000; color: #fff; padding: 40px 20px; font-family: sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background: #121212; border-radius: 16px; padding: 32px; border: 1px solid rgba(84, 195, 255, 0.2);">
          <h1 style="color: #54c3ff;">${progress >= 100 ? "🎉" : "📊"} ${goal.name}</h1>
          <div style="background: rgba(84, 195, 255, 0.1); border-radius: 12px; padding: 20px; margin: 20px 0;">
            <div style="background: rgba(84, 195, 255, 0.2); border-radius: 8px; height: 12px; overflow: hidden;">
              <div style="background: linear-gradient(90deg, #54c3ff, #1e6be0); height: 100%; width: ${progress}%;"></div>
            </div>
            <p style="color: #fff; margin-top: 12px;">${goal.current} / ${goal.target} XNO (${progress.toFixed(0)}%)</p>
          </div>
          ${progress < 100 ? `<p style="color: rgba(255,255,255,0.6);">Keep going! You're making great progress.</p>` : ""}
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  async sendWelcomeEmail(user) {
    const subject = "👋 Welcome to ChangeAIPay!";
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #000; font-family: 'Segoe UI', sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #000; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #121212; border: 1px solid rgba(84, 195, 255, 0.2); border-radius: 16px;">
                <tr>
                  <td style="padding: 40px 32px; text-align: center;">
                    <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #0f2760, #1e6be0); border-radius: 50%; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center; font-size: 36px;">
                      🚀
                    </div>
                    <h1 style="color: #fff; font-size: 28px; margin: 0 0 16px;">Welcome to ChangeAIPay!</h1>
                    <p style="color: rgba(255,255,255,0.7); font-size: 16px; margin: 0 0 32px; line-height: 1.6;">
                      Your instant, fee-less cryptocurrency payment platform is ready. Start sending and receiving Nano with zero fees!
                    </p>
                    <a href="#" style="display: inline-block; background: linear-gradient(135deg, #0f2760, #1e6be0); color: #fff; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
                      Get Started
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 32px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <p style="color: rgba(255,255,255,0.5); font-size: 13px; margin: 0; text-align: center;">
                      Powered by Nano network • Instant settlement • Zero fees
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  async sendMarketingEmail(user, campaign) {
    const { subject, content } = campaign;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="background: #000; color: #fff; padding: 40px 20px; font-family: sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background: #121212; border-radius: 16px; padding: 32px; border: 1px solid rgba(84, 195, 255, 0.2);">
          ${content}
          <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin-top: 32px;">
            You're receiving this because you signed up for ChangeAIPay updates.
            <br><a href="#" style="color: #54c3ff;">Unsubscribe</a>
          </p>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(user.email, subject, html);
  }
}

const emailService = new EmailService();

export default emailService;

export const sendTransactionReceipt = (user, transaction) => 
  emailService.sendTransactionReceipt(user, transaction);

export const sendPaymentReminder = (user, payment) => 
  emailService.sendPaymentReminder(user, payment);

export const sendLowBalanceAlert = (user, balance, threshold) => 
  emailService.sendLowBalanceAlert(user, balance, threshold);

export const sendFraudAlert = (user, alert) => 
  emailService.sendFraudAlert(user, alert);

export const sendGoalUpdate = (user, goal) => 
  emailService.sendGoalUpdate(user, goal);

export const sendWelcomeEmail = (user) => 
  emailService.sendWelcomeEmail(user);

export const sendMarketingEmail = (user, campaign) => 
  emailService.sendMarketingEmail(user, campaign);