import logger from "./logger.js";
import wsManager from "./websocket.js";

class NotificationService {
  constructor() {
    this.notificationTypes = {
      transaction_received: {
        title: "Payment Received!",
        body: (data) => `You received ${data.amount} XNO from ${data.from}`
      },
      transaction_sent: {
        title: "Payment Sent",
        body: (data) => `You sent ${data.amount} XNO to ${data.to}`
      },
      transaction_confirmed: {
        title: "Transaction Confirmed",
        body: (data) => `Your transaction of ${data.amount} XNO is now confirmed`
      },
      balance_alert: {
        title: "Low Balance Alert",
        body: (data) => `Your balance is below ${data.threshold} XNO`
      },
      security_alert: {
        title: "Security Alert",
        body: (data) => data.message || "New login detected on your account"
      },
      ai_insight: {
        title: "AI Insight",
        body: (data) => data.message
      },
      weekly_summary: {
        title: "Weekly Summary",
        body: (data) => `You sent ${data.sent} and received ${data.received} XNO this week`
      },
      referral_reward: {
        title: "Referral Reward!",
        body: (data) => `You earned ${data.reward} XNO for inviting ${data.friend}`
      }
    };
  }

  async notify(userId, type, data) {
    const notificationType = this.notificationTypes[type];
    if (!notificationType) {
      logger.warn("Unknown notification type", { type, userId });
      return null;
    }

    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title: notificationType.title,
      body: notificationType.body(data),
      data,
      timestamp: new Date().toISOString(),
      read: false
    };

    wsManager.notifyNotification(userId, notification);

    logger.info("Notification sent", { userId, type, notificationId: notification.id });

    return notification;
  }

  async notifyTransaction(userId, transaction) {
    const type = transaction.direction === "incoming" 
      ? "transaction_received" 
      : "transaction_sent";
    
    return this.notify(userId, type, {
      amount: transaction.amount,
      from: transaction.fromAddress,
      to: transaction.toAddress,
      hash: transaction.hash
    });
  }

  async notifyTransactionConfirmed(userId, transaction) {
    return this.notify(userId, "transaction_confirmed", {
      amount: transaction.amount,
      hash: transaction.hash
    });
  }

  async notifyLowBalance(userId, balance, threshold = 10) {
    if (parseFloat(balance) >= threshold) return;
    
    return this.notify(userId, "balance_alert", {
      balance,
      threshold
    });
  }

  async notifySecurityAlert(userId, message) {
    return this.notify(userId, "security_alert", {
      message,
      type: "security"
    });
  }

  async sendAIInsight(userId, message, data = {}) {
    return this.notify(userId, "ai_insight", {
      message,
      ...data
    });
  }

  async sendWeeklySummary(userId, stats) {
    return this.notify(userId, "weekly_summary", {
      sent: stats.sent || "0",
      received: stats.received || "0",
      transactionCount: stats.transactionCount || 0
    });
  }

  async notifyReferralReward(userId, friendName, reward) {
    return this.notify(userId, "referral_reward", {
      friend: friendName,
      reward
    });
  }
}

const notificationService = new NotificationService();

export default notificationService;

export const notifyTransaction = (userId, transaction) => 
  notificationService.notifyTransaction(userId, transaction);

export const notifyTransactionConfirmed = (userId, transaction) => 
  notificationService.notifyTransactionConfirmed(userId, transaction);

export const notifyLowBalance = (userId, balance, threshold) => 
  notificationService.notifyLowBalance(userId, balance, threshold);

export const notifySecurityAlert = (userId, message) => 
  notificationService.notifySecurityAlert(userId, message);

export const sendAIInsight = (userId, message, data) => 
  notificationService.sendAIInsight(userId, message, data);

export const sendWeeklySummary = (userId, stats) => 
  notificationService.sendWeeklySummary(userId, stats);