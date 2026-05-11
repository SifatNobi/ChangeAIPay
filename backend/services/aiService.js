import config from "../config/index.js";
import logger from "./logger.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";

const INTENT_PATTERNS = {
  send: /send|transfer|pay|give|send to|transfer to|pay to/i,
  receive: /receive|get|request|ask for|qr|scan/i,
  balance: /balance|how much|how many|total|worth/i,
  history: /history|transactions|past|previous|recent|spent/i,
  split: /split|divide|share|dutch/i,
  convert: /convert|exchange|swap|change|trade/i,
  insight: /insight|analysis|spending| habits| pattern/i,
  help: /help|support|how|what|explain/i,
  recommendation: /recommend|suggest|advice|should/i
};

class FinaAI {
  constructor() {
    this.enabled = config.ai.enabled;
    this.conversations = new Map();
    this.userContexts = new Map();
  }

  detectIntent(message) {
    const lower = message.toLowerCase();
    
    for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
      if (pattern.test(message)) {
        return { intent, confidence: 0.9, matched: pattern.source };
      }
    }
    
    return { intent: "general", confidence: 0.5 };
  }

  extractAmount(message) {
    const patterns = [
      /(\$|USD|EUR|GBP)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(XNO|NANO|USD|EUR|GBP)?/i,
      /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:XNO|nano|dollars?|euros?)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          amount: parseFloat(match[2].replace(/,/g, "")),
          currency: match[3] || match[1]?.replace("$", "") || "USD"
        };
      }
    }
    return null;
  }

  extractRecipient(message) {
    const patterns = [
      /to\s+([A-Za-z\s]+?)(?:\s|$|\.|\?|!)/i,
      /([A-Za-z\s]+?)\s+(?:my|to)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1] && match[1].length > 2 && match[1].length < 30) {
        return match[1].trim();
      }
    }
    return null;
  }

  async processMessage(userId, message, context = {}) {
    try {
      const conversation = this.getOrCreateConversation(userId);
      const userContext = this.getOrCreateUserContext(userId);
      
      conversation.messages.push({
        role: "user",
        content: message,
        timestamp: new Date().toISOString()
      });

      const intent = this.detectIntent(message);
      const extractedAmount = this.extractAmount(message);
      const extractedRecipient = this.extractRecipient(message);
      
      const response = await this.handleIntent(intent, message, {
        ...context,
        ...userContext,
        amount: extractedAmount,
        recipient: extractedRecipient
      });

      conversation.messages.push({
        role: "assistant",
        content: response.message,
        timestamp: new Date().toISOString(),
        intent: intent.intent,
        actions: response.actions || []
      });

      if (response.contextUpdate) {
        Object.assign(userContext, response.contextUpdate);
      }

      return response;
    } catch (err) {
      logger.error("Fina AI error", { userId, error: err.message, message });
      return this.getFallbackResponse(message);
    }
  }

  async handleIntent(intent, message, context) {
    switch (intent.intent) {
      case "send":
        return await this.handleSendIntent(message, context);
      case "receive":
        return await this.handleReceiveIntent(message, context);
      case "balance":
        return await this.handleBalanceIntent(context);
      case "history":
        return await this.handleHistoryIntent(context);
      case "split":
        return await this.handleSplitIntent(message, context);
      case "convert":
        return await this.handleConvertIntent(message, context);
      case "insight":
        return await this.handleInsightIntent(context);
      case "recommendation":
        return await this.handleRecommendationIntent(context);
      case "help":
        return this.handleHelpIntent(message);
      default:
        return this.handleGeneralIntent(message, context);
    }
  }

  async handleSendIntent(message, context) {
    const { amount, recipient } = context;
    
    if (!amount || !recipient) {
      return {
        message: "I'd be happy to help you send crypto! To process your transfer, I need:\n• The amount you want to send\n• The recipient's name or wallet address\n\nCould you provide these details?",
        actions: [{ type: "collect_info", fields: ["amount", "recipient"] }],
        intent: "send_pending"
      };
    }

    return {
      message: `I'll help you send ${amount.amount} ${amount.currency} to ${recipient}. Before proceeding, please confirm on the Send page to complete this transaction.\n\n💡 Your transaction will be instant and fee-less!`,
      actions: [
        { type: "navigate", target: "/send" },
        { type: "prefill", amount: amount.amount, recipient: recipient }
      ],
      intent: "send_ready",
      contextUpdate: { pendingSend: { amount, recipient } }
    };
  }

  async handleReceiveIntent(message, context) {
    return {
      message: "To receive crypto, simply share your wallet address or QR code with the sender.\n\n📱 Quick steps:\n1. Go to your Dashboard\n2. Click 'Generate QR'\n3. Share the QR code or address\n\nThe payment will appear instantly in your wallet!",
      actions: [{ type: "navigate", target: "/dashboard" }],
      intent: "receive"
    };
  }

  async handleBalanceIntent(context) {
    const userId = context.userId;
    
    try {
      const user = await User.findById(userId).lean();
      const balance = user?.balance?.balanceNano || "0";
      const walletAddress = user?.walletAddress || "Not set up";
      
      return {
        message: `💰 Your current balance:\n\n• **${balance} XNO** (${Number(balance).toFixed(2)})\n\n📍 Wallet: \`${walletAddress.substring(0, 20)}...\`\n\nNeed to add funds or send some? Let me know!`,
        actions: [
          { type: "balance", value: balance },
          { type: "wallet", address: walletAddress }
        ],
        intent: "balance_check"
      };
    } catch (err) {
      return {
        message: "I couldn't retrieve your balance right now. Please check your Dashboard for the latest balance information.",
        intent: "balance_error"
      };
    }
  }

  async handleHistoryIntent(context) {
    const userId = context.userId;
    
    try {
      const transactions = await Transaction.find({ userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      if (!transactions.length) {
        return {
          message: "📊 You haven't made any transactions yet.\n\nYour transaction history will appear here once you send or receive crypto.",
          intent: "history_empty"
        };
      }

      const totalReceived = transactions
        .filter(t => t.direction === "incoming")
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
      
      const totalSent = transactions
        .filter(t => t.direction === "outgoing")
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      return {
        message: `📊 Transaction Summary (Last 10):\n\n• Total Received: **${totalReceived.toFixed(4)} XNO**\n• Total Sent: **${totalSent.toFixed(4)} XNO**\n• Transactions: ${transactions.length}\n\nMost recent: ${transactions[0]?.amount || "0"} XNO ${transactions[0]?.direction === "incoming" ? "received" : "sent"}`,
        actions: [
          { type: "transactions", count: transactions.length }
        ],
        intent: "history"
      };
    } catch (err) {
      return {
        message: "I'm having trouble fetching your transaction history. Please try again later.",
        intent: "history_error"
      };
    }
  }

  async handleSplitIntent(message, context) {
    const { amount } = context;
    
    const people = message.match(/(\d+)\s*(?:people|persons|people|split)/i);
    const count = people ? parseInt(people[1]) : 2;
    
    if (amount) {
      const each = amount.amount / count;
      return {
        message: `🧾 Split Details:\n\n• Total: ${amount.amount} ${amount.currency}\n• Split between: ${count} people\n• Each pays: **${each.toFixed(4)} ${amount.currency}**\n\nYou can collect from each person and send in one transaction to save on fees!`,
        actions: [
          { type: "split", total: amount.amount, each: each, count: count }
        ],
        intent: "split_calculated"
      };
    }
    
    return {
      message: "To help split a payment, please tell me:\n• The total amount\n• How many people to split between\n\nExample: 'Split $50 between 3 people'",
      intent: "split_pending"
    };
  }

  async handleConvertIntent(message, context) {
    return {
      message: "🔄 Currency Conversion\n\nI can help you understand the value, but direct conversion happens on exchanges. Here's a rough guide:\n\n• Nano (XNO) is traded on major exchanges\n• Rates fluctuate based on market prices\n\nWould you like me to help you send the crypto amount instead?",
      actions: [{ type: "info", message: "Conversion available on exchanges" }],
      intent: "convert"
    };
  }

  async handleInsightIntent(context) {
    const userId = context.userId;
    
    try {
      const transactions = await Transaction.find({ userId })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();

      if (!transactions.length) {
        return {
          message: "📊 Not enough data for insights yet. Keep using ChangeAIPay to build your spending profile!\n\nOnce you have more transactions, I can provide personalized insights.",
          intent: "insight_empty"
        };
      }

      const last7Days = transactions.filter(t => {
        const date = new Date(t.createdAt);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return date >= weekAgo;
      });

      const totalSpent = last7Days
        .filter(t => t.direction === "outgoing")
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      return {
        message: `📊 Your Spending Insights (Last 7 days):\n\n• Transactions: ${last7Days.length}\n• Total Sent: ${totalSpent.toFixed(4)} XNO\n• Avg per transaction: ${last7Days.length ? (totalSpent / last7Days.length).toFixed(4) : 0} XNO\n\n💡 Tip: All transactions are fee-less, so you're saving compared to traditional payment methods!`,
        intent: "insight"
      };
    } catch (err) {
      return {
        message: "I'm analyzing your spending patterns. Please check back later for detailed insights.",
        intent: "insight_error"
      };
    }
  }

  async handleRecommendationIntent(context) {
    return {
      message: "💡 Financial Tips:\n\n• **Save on fees**: All ChangeAIPay transactions are 100% fee-less!\n• **Instant settlements**: No waiting for bank processing\n• **Security**: Your keys, your crypto. Always keep your seed phrase safe.\n\nWould you like personalized recommendations based on your usage?",
      actions: [{ type: "recommendations" }],
      intent: "recommendation"
    };
  }

  handleHelpIntent(message) {
    const commands = [
      { cmd: "send money", desc: "Send crypto to another wallet" },
      { cmd: "check balance", desc: "View your current balance" },
      { cmd: "get qr code", desc: "Generate payment QR code" },
      { cmd: "split bill", desc: "Calculate split payments" },
      { cmd: "my history", desc: "View transaction history" },
      { cmd: "spending", desc: "Get spending insights" }
    ];

    return {
      message: `🆘 I'm here to help! Here are things I can do:\n\n${commands.map(c => `• **${c.cmd}** - ${c.desc}`).join("\n")}\n\nJust type what you'd like to do!`,
      intent: "help"
    };
  }

  handleGeneralIntent(message, context) {
    const greetings = /^(hi|hello|hey|good morning|good evening|good afternoon)/i;
    const thanks = /^(thanks|thank you|thx|ty)/i;
    
    if (greetings.test(message)) {
      return {
        message: "👋 Hello! I'm Fina, your ChangeAIPay assistant!\n\nI can help you send/receive crypto, check your balance, view transaction history, and provide spending insights.\n\nWhat would you like to do today?",
        intent: "greeting"
      };
    }
    
    if (thanks.test(message)) {
      return {
        message: "You're welcome! 😊 Let me know if there's anything else I can help with!",
        intent: "thanks"
      };
    }

    return {
      message: "I understand you're reaching out. I can help with:\n\n• 💸 Sending & receiving crypto\n• 💰 Checking your balance\n• 📊 Transaction history & insights\n• 🔄 Currency & payment help\n\nWhat would you like to do?",
      intent: "general"
    };
  }

  getOrCreateConversation(userId) {
    if (!this.conversations.has(userId)) {
      this.conversations.set(userId, {
        messages: [],
        createdAt: new Date(),
        metadata: {}
      });
    }
    return this.conversations.get(userId);
  }

  getOrCreateUserContext(userId) {
    if (!this.userContexts.has(userId)) {
      this.userContexts.set(userId, {
        lastTransaction: null,
        frequentRecipients: [],
        preferredAmount: null,
        onboardingComplete: false
      });
    }
    return this.userContexts.get(userId);
  }

  getFallbackResponse(message) {
    return {
      message: "I apologize, but I'm having trouble processing your request right now. Please try again or visit your Dashboard for direct access to all features.",
      actions: [{ type: "fallback" }],
      intent: "error"
    };
  }

  clearConversation(userId) {
    this.conversations.delete(userId);
    this.userContexts.delete(userId);
  }

  getConversationHistory(userId) {
    return this.conversations.get(userId)?.messages || [];
  }
}

const finaAI = new FinaAI();

export const aiChat = async (userId, message, context = {}) => {
  return finaAI.processMessage(userId, message, context);
};

export const clearChatHistory = (userId) => {
  finaAI.clearConversation(userId);
};

export const getChatHistory = (userId) => {
  return finaAI.getConversationHistory(userId);
};

export const detectIntent = (message) => finaAI.detectIntent(message);
export const extractAmount = (message) => finaAI.extractAmount(message);
export const extractRecipient = (message) => finaAI.extractRecipient(message);

export default finaAI;