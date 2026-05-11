import logger from "./logger.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";

class FraudDetectionEngine {
  constructor() {
    this.riskWeights = {
      velocity: 30,
      amountAnomaly: 25,
      geoAnomaly: 20,
      newAccount: 15,
      microTransactions: 10,
      timePattern: 10,
      deviceFingerprint: 15,
      recipientRisk: 20
    };

    this.thresholds = {
      maxDailyTransactions: 50,
      maxHourlyTransactions: 15,
      maxDailyAmount: 10000,
      suspiciousMicroThreshold: 5,
      highRiskScore: 70,
      mediumRiskScore: 40
    };
  }

  async analyzeTransaction(userId, transactionData) {
    const user = await User.findById(userId).lean();
    const {
      recipient,
      amount,
      direction = "outgoing"
    } = transactionData;

    const analysis = {
      timestamp: new Date().toISOString(),
      userId,
      transactionAmount: amount,
      riskScore: 0,
      riskFactors: [],
      recommendations: [],
      requiresReview: false,
      autoBlock: false
    };

    try {
      const velocityCheck = await this.checkVelocity(userId);
      analysis.riskFactors.push(...velocityCheck.factors);
      analysis.riskScore += velocityCheck.score;
      analysis.recommendations.push(...velocityCheck.recommendations);

      const amountCheck = this.checkAmountAnomaly(userId, amount, user);
      analysis.riskFactors.push(...amountCheck.factors);
      analysis.riskScore += amountCheck.score;

      const microCheck = await this.checkMicroTransactions(userId, amount);
      analysis.riskFactors.push(...microCheck.factors);
      analysis.riskScore += microCheck.score;

      const recipientCheck = await this.checkRecipientRisk(userId, recipient);
      analysis.riskFactors.push(...recipientCheck.factors);
      analysis.riskScore += recipientCheck.score;

      const timeCheck = this.checkTimePattern();
      analysis.riskFactors.push(...timeCheck.factors);
      analysis.riskScore += timeCheck.score;

      if (user) {
        const accountAge = this.getAccountAge(user.createdAt);
        if (accountAge < 7) {
          analysis.riskFactors.push({
            factor: "new_account",
            description: "Account is less than 7 days old",
            severity: "medium"
          });
          analysis.riskScore += this.riskWeights.newAccount;
        }
      }

      analysis.riskScore = Math.min(analysis.riskScore, 100);

      analysis.requiresReview = analysis.riskScore >= this.thresholds.mediumRiskScore;
      analysis.autoBlock = analysis.riskScore >= this.thresholds.highRiskScore;

      logger.info("Fraud analysis completed", {
        userId,
        amount,
        riskScore: analysis.riskScore,
        requiresReview: analysis.requiresReview,
        autoBlock: analysis.autoBlock
      });

      return analysis;
    } catch (err) {
      logger.error("Fraud analysis error", { userId, error: err.message });
      return {
        ...analysis,
        error: err.message,
        riskScore: 0,
        requiresReview: false
      };
    }
  }

  async checkVelocity(userId) {
    const factors = [];
    let score = 0;
    const recommendations = [];

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [hourlyCount, dailyCount, dailyAmount] = await Promise.all([
      Transaction.countDocuments({
        userId,
        createdAt: { $gte: oneHourAgo },
        direction: "outgoing"
      }),
      Transaction.countDocuments({
        userId,
        createdAt: { $gte: oneDayAgo },
        direction: "outgoing"
      }),
      Transaction.aggregate([
        {
          $match: {
            userId,
            createdAt: { $gte: oneDayAgo },
            direction: "outgoing"
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $toDouble: "$amount" } }
          }
        }
      ])
    ]);

    if (hourlyCount >= this.thresholds.maxHourlyTransactions) {
      factors.push({
        factor: "high_velocity",
        description: `${hourlyCount} transactions in the last hour`,
        severity: "high"
      });
      score += this.riskWeights.velocity;
      recommendations.push("High transaction frequency detected");
    }

    if (dailyCount >= this.thresholds.maxDailyTransactions) {
      factors.push({
        factor: "excessive_daily_transactions",
        description: `${dailyCount} transactions in the last 24 hours`,
        severity: "medium"
      });
      score += this.riskWeights.velocity * 0.5;
    }

    const totalToday = dailyAmount[0]?.total || 0;
    if (totalToday >= this.thresholds.maxDailyAmount) {
      factors.push({
        factor: "high_daily_amount",
        description: `$${totalToday.toFixed(2)} sent in the last 24 hours`,
        severity: "high"
      });
      score += this.riskWeights.amountAnomaly;
      recommendations.push("Daily transaction limit approaching");
    }

    return { factors, score, recommendations };
  }

  checkAmountAnomaly(userId, amount, user) {
    const factors = [];
    let score = 0;

    const avgTransactionSize = 100;
    const maxSingleTransaction = 5000;

    if (amount > maxSingleTransaction) {
      factors.push({
        factor: "large_single_transaction",
        description: `Transaction of ${amount} exceeds maximum`,
        severity: "high"
      });
      score += this.riskWeights.amountAnomaly;
    }

    if (amount > avgTransactionSize * 10) {
      factors.push({
        factor: "amount_anomaly",
        description: `Amount is 10x+ above average`,
        severity: "medium"
      });
      score += this.riskWeights.amountAnomaly * 0.5;
    }

    return { factors, score };
  }

  async checkMicroTransactions(userId, amount) {
    const factors = [];
    let score = 0;

    if (amount <= this.thresholds.suspiciousMicroThreshold) {
      const recentMicros = await Transaction.countDocuments({
        userId,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        direction: "outgoing",
        amount: { $lte: this.thresholds.suspiciousMicroThreshold }
      });

      if (recentMicros >= 10) {
        factors.push({
          factor: "micro_transaction_abuse",
          description: `${recentMicros} micro-transactions in 24 hours`,
          severity: "medium"
        });
        score += this.riskWeights.microTransactions;
      }
    }

    return { factors, score };
  }

  async checkRecipientRisk(userId, recipient) {
    const factors = [];
    let score = 0;

    if (!recipient) return { factors, score };

    const recentToRecipient = await Transaction.countDocuments({
      userId,
      toAddress: recipient,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    if (recentToRecipient === 0) {
      factors.push({
        factor: "first_transaction_to_recipient",
        description: "First time sending to this recipient",
        severity: "low"
      });
      score += this.riskWeights.recipientRisk * 0.3;
    }

    const recipientAccountAge = await User.findOne({ walletAddress: recipient }).lean();
    if (recipientAccountAge) {
      const ageDays = this.getAccountAge(recipientAccountAge.createdAt);
      if (ageDays < 7) {
        factors.push({
          factor: "new_recipient_account",
          description: "Recipient account is also new",
          severity: "medium"
        });
        score += this.riskWeights.recipientRisk * 0.5;
      }
    }

    return { factors, score };
  }

  checkTimePattern() {
    const factors = [];
    let score = 0;
    const hour = new Date().getHours();

    if (hour >= 0 && hour < 5) {
      factors.push({
        factor: "unusual_time",
        description: "Transaction during unusual hours (midnight-5am)",
        severity: "low"
      });
      score += this.riskWeights.timePattern * 0.5;
    }

    return { factors, score };
  }

  getAccountAge(createdAt) {
    if (!createdAt) return 0;
    const created = new Date(createdAt);
    const now = new Date();
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
  }

  getRiskExplanation(analysis) {
    if (analysis.riskScore < this.thresholds.mediumRiskScore) {
      return "Transaction appears normal. No significant risk factors detected.";
    }

    const explanations = analysis.riskFactors
      .filter(f => f.severity !== "low")
      .map(f => f.description);

    return explanations.join("; ") || "Multiple risk factors detected.";
  }

  async generateSmartConfirmation(analysis, userId, transactionData) {
    const { amount } = transactionData;

    if (analysis.autoBlock) {
      return {
        action: "block",
        message: "Transaction blocked due to high risk score",
        requiresManualReview: true,
        explanation: this.getRiskExplanation(analysis)
      };
    }

    if (analysis.requiresReview) {
      return {
        action: "review",
        message: "Transaction flagged for additional verification",
        requiresConfirmation: true,
        verificationSteps: [
          "Confirm the recipient is correct",
          "Verify the amount is accurate",
          "Ensure you initiated this transaction"
        ],
        explanation: this.getRiskExplanation(analysis)
      };
    }

    return {
      action: "proceed",
      message: "Transaction appears legitimate",
      requiresConfirmation: false,
      explanation: "All security checks passed."
    };
  }
}

const fraudEngine = new FraudDetectionEngine();

export const analyzeTransaction = (userId, transactionData) => 
  fraudEngine.analyzeTransaction(userId, transactionData);

export const getSmartConfirmation = (analysis, userId, transactionData) => 
  fraudEngine.generateSmartConfirmation(analysis, userId, transactionData);

export const getRiskExplanation = (analysis) => 
  fraudEngine.getRiskExplanation(analysis);

export default fraudEngine;