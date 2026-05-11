import config from "../config/index.js";
import logger from "./logger.js";

class AIService {
  constructor() {
    this.enabled = config.ai.enabled;
    this.model = config.ai.model;
    this.conversations = new Map();
  }

  async processMessage(userId, message, context = {}) {
    if (!this.enabled) {
      return this.getFallbackResponse(message);
    }

    try {
      const conversation = this.getOrCreateConversation(userId);
      
      conversation.messages.push({
        role: "user",
        content: message,
        timestamp: new Date().toISOString()
      });

      const response = await this.generateResponse(conversation, context);

      conversation.messages.push({
        role: "assistant",
        content: response.message,
        timestamp: new Date().toISOString(),
        actions: response.actions
      });

      if (conversation.messages.length > 50) {
        conversation.messages = conversation.messages.slice(-50);
      }

      return response;
    } catch (err) {
      logger.error("AI service error", { userId, error: err.message });
      return this.getFallbackResponse(message);
    }
  }

  async generateResponse(conversation, context) {
    const systemPrompt = this.buildSystemPrompt(context);
    
    const messages = [
      { role: "system", content: systemPrompt },
      ...conversation.messages.slice(-10)
    ];

    return {
      message: this.getAIResponse(message = ""),
      actions: [],
      intent: "general_inquiry"
    };
  }

  buildSystemPrompt(context) {
    return `You are Fina, the AI assistant for ChangeAIPay - a secure, instant cryptocurrency payment platform.

Your capabilities:
- Help users with account management and transactions
- Explain Nano cryptocurrency and blockchain concepts
- Guide users through payment processes
- Provide support for wallet operations
- Assist with troubleshooting and FAQs

Context:
- User role: ${context.role || "user"}
- Language: ${context.language || "en"}
- Current page: ${context.page || "unknown"}

Guidelines:
- Be concise and helpful
- Use plain language for technical concepts
- Prioritize user security in all recommendations
- When unsure, suggest contacting human support
- Keep responses under 200 words`;
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

  getAIResponse(message) {
    const responses = {
      greeting: "Hello! I'm Fina, your ChangeAIPay assistant. How can I help you today?",
      balance: "To check your balance, go to your Dashboard. Your current Nano balance will be displayed there.",
      send: "To send Nano, go to the Send page, enter the recipient's wallet address and amount, then confirm the transaction.",
      receive: "To receive Nano, go to your Dashboard and use the Generate QR feature. Share the QR code with the sender.",
      transaction: "You can view all your transaction history in the History section of your Dashboard.",
      help: "I'm here to help! You can ask me about: sending/receiving Nano, checking your balance, transaction history, wallet setup, or any other questions about ChangeAIPay."
    };

    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes("hello") || lowerMessage.includes("hi") || lowerMessage.includes("hey")) {
      return responses.greeting;
    } else if (lowerMessage.includes("balance") || lowerMessage.includes("how much")) {
      return responses.balance;
    } else if (lowerMessage.includes("send") || lowerMessage.includes("transfer")) {
      return responses.send;
    } else if (lowerMessage.includes("receive") || lowerMessage.includes("qr")) {
      return responses.receive;
    } else if (lowerMessage.includes("transaction") || lowerMessage.includes("history")) {
      return responses.transaction;
    } else if (lowerMessage.includes("help")) {
      return responses.help;
    }
    
    return "I understand you're asking about ChangeAIPay. How can I assist you with your crypto transactions or account?";
  }

  getFallbackResponse(message) {
    return {
      message: this.getAIResponse(message),
      actions: [],
      intent: "fallback"
    };
  }

  clearConversation(userId) {
    this.conversations.delete(userId);
  }

  getConversationHistory(userId) {
    return this.conversations.get(userId)?.messages || [];
  }
}

const aiService = new AIService();

export const aiChat = async (userId, message, context = {}) => {
  return aiService.processMessage(userId, message, context);
};

export const clearChatHistory = (userId) => {
  aiService.clearConversation(userId);
};

export const getChatHistory = (userId) => {
  return aiService.getConversationHistory(userId);
};

export default aiService;