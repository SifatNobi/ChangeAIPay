import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { getToken } from "../api";
import { sendAIChat, getAIHistory } from "../api";
import { FINA_AI_IMAGE } from "../constants/branding";
import "./AIAssistant.css";

const FINA_IMAGE = FINA_AI_IMAGE;

const PLAN_FEATURES = {
  free_trial: {
    chat: true,
    quickActions: ["balance", "receive", "help"],
    advanced: false
  },
  edge: {
    chat: true,
    quickActions: ["balance", "send", "receive", "history", "help"],
    advanced: false
  },
  prime: {
    chat: true,
    quickActions: ["balance", "send", "receive", "history", "insight", "help"],
    advanced: true
  },
  apex: {
    chat: true,
    quickActions: ["balance", "send", "receive", "history", "insight", "help"],
    advanced: true,
    autonomous: true
  }
};

const QUICK_ACTIONS = [
  { label: "💰 Check Balance", action: "check my balance", icon: "balance" },
  { label: "💸 Send Crypto", action: "send crypto", icon: "send" },
  { label: "📥 Receive", action: "how do I receive", icon: "receive" },
  { label: "📊 Transaction History", action: "show my transactions", icon: "history" },
  { label: "📈 Spending Insights", action: "my spending insights", icon: "insight" },
  { label: "🆘 Help", action: "help me", icon: "help" }
];

const GREETINGS = {
  morning: "Good morning! ☀️ Hope your day is off to a great start. How can I help you today?",
  afternoon: "Hey there! 👋 Hope you're having a wonderful afternoon. What can I do for you?",
  evening: "Good evening! 🌙 Hope you had a great day. How can I help you tonight?",
  night: "Hey! 🌟 Working late? I'm here to help. What do you need?"
};

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return GREETINGS.morning;
  if (hour >= 12 && hour < 17) return GREETINGS.afternoon;
  if (hour >= 17 && hour < 22) return GREETINGS.evening;
  return GREETINGS.night;
}

function getInitialMessage() {
  return {
    id: "welcome",
    role: "assistant",
    content: getTimeGreeting() + "\n\nI can help you with:\n• 💸 Sending & receiving crypto\n• 💰 Checking your balance\n• 📊 Transaction insights\n• 💡 Financial recommendations\n\nWhat would you like to do today?",
    timestamp: new Date().toISOString(),
    intent: "greeting"
  };
}

const INITIAL_MESSAGE = getInitialMessage();

function getLocalResponse(userInput) {
  const input = userInput.toLowerCase().trim();

  if (/^(hi|hello|hey|howdy|greetings|sup|what'?s up|yo|hola)/i.test(input)) {
    const responses = [
      "Hey 👋 Hope you're having a great day. How can I help you today?",
      "Hello! 😊 So glad you're here. What can I help you with?",
      "Hi there! 💫 I'm Fina, ready to help. What's on your mind?",
      "Hey! Great to see you! How can I make your day easier?"
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (/^(how are you|how'?s it going|how do you feel|what'?s up with you)/i.test(input)) {
    const responses = [
      "I'm doing great, thanks for asking! 😊 I'm always happy when I get to help someone. What can I do for you?",
      "I'm wonderful! Ready to help you with anything you need. What's on your mind?",
      "Feeling fantastic and ready to assist! 💪 How can I help you today?"
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (/help|support|assist|what can you do|options|menu/i.test(input)) {
    return "I'm here to help! I can assist with:\n• Sending & receiving crypto\n• Checking your balance\n• Transaction history\n• Budgeting & savings goals\n• Merchant support\n• Payment guidance\n\nWhat would you like to know?";
  }

  if (/balance|money|funds|wallet|how much/i.test(input)) {
    return "You can check your balance on your dashboard. Would you like me to take you there? I can also help you understand your spending patterns if you'd like! 💰";
  }

  if (/send|pay|transfer|pay someone/i.test(input)) {
    return "To send crypto, go to the Send page. You can scan a QR code or enter the address manually. Need help with anything else? 💸";
  }

  if (/receive|get|accept|someone send/i.test(input)) {
    return "To receive crypto, go to the Receive page to get your wallet address or QR code. Share it with the sender and you'll receive the funds instantly! 📥";
  }

  if (/history|transactions|past|previous|activity/i.test(input)) {
    return "Your transaction history shows all your past sends and receives. You can filter by date, type, or amount. Want me to help you find something specific? 📊";
  }

  if (/goal|save|savings|budget|plan/i.test(input)) {
    return "Great idea! Setting savings goals is a smart move. You can create goals on the Goals page and track your progress. Want help setting one up? 🎯";
  }

  if (/merchant|business|store|sell|vendor/i.test(input)) {
    return "For merchants, we offer powerful tools to accept crypto payments! You can:\n• Generate payment QR codes\n• Track sales and revenue\n• Manage multiple locations\n• Get detailed analytics\n\nAre you a merchant looking for support? 🏪";
  }

  if (/pricing|plan|upgrade|subscription|cost|price/i.test(input)) {
    return "We have several plans to fit your needs:\n• Free Trial - Basic features to get started\n• Edge - More quick actions and tools\n• Prime - Advanced insights and analytics\n• Apex - Full autonomous features\n\nWant me to explain any plan in detail? 💎";
  }

  if (/thank|thanks|appreciate|grateful/i.test(input)) {
    const responses = [
      "You're so welcome! 😊 I'm always here if you need anything else.",
      "Happy to help! Don't hesitate to reach out anytime. 💫",
      "Anytime! That's what I'm here for. Have a wonderful day! 🌟"
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (/bye|goodbye|see you|later|gotta go/i.test(input)) {
    const responses = [
      "Goodbye! 👋 Take care and come back anytime you need help!",
      "See you later! It was great chatting with you. Have an amazing day! 😊",
      "Bye for now! Remember, I'm always here when you need me. 💫"
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (/insight|analytics|spending pattern|trend/i.test(input)) {
    return "Spending insights help you understand where your money goes. You can view your spending by category, time period, and trends over time. This helps you make smarter financial decisions! 📈";
  }

  if (/qr|scan|code/i.test(input)) {
    return "QR codes make payments super easy! You can scan a QR code to send payments or show yours to receive. Just use the camera icon on the Send or Receive page. 📷";
  }

  if (/error|problem|issue|not working|broken/i.test(input)) {
    return "I'm sorry you're experiencing issues! Let me help troubleshoot. Can you tell me more about what's happening? I'll do my best to get this sorted out for you. 🔧";
  }

  if (/safe|security|secure|protect/i.test(input)) {
    return "Security is super important! ChangeAIPay uses encryption and secure protocols to protect your funds. Always keep your credentials safe and never share your private keys. Want tips on staying secure? 🔒";
  }

  if (/fee|cost|charge/i.test(input)) {
    return "Transaction fees on ChangeAIPay are minimal! We use the Nano network which has near-zero fees. You'll always see the fee before confirming any transaction. 💡";
  }

  const fallbacks = [
    "That's an interesting question! Let me think about this... While I'm still learning, I'd recommend checking our help center or trying a more specific question. I'm here to help! 🤔",
    "I appreciate you asking! I want to make sure I give you the best answer. Could you rephrase that or ask something more specific? I'm great with payments, balances, and account help! 💭",
    "Hmm, I want to make sure I understand correctly. Could you tell me a bit more about what you're looking for? I'm really good at helping with crypto payments and account management! 😊"
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

function handleActionClick(action, onNavigate) {
  if (action.type === "navigate" && onNavigate) {
    onNavigate(action.target);
  }
}

function buildPaymentContextMessage(context) {
  const lines = [
    "I detected a scanned QR payment that is ready to review.",
    context.merchant ? `Merchant: ${context.merchant}` : "Merchant: unknown",
    `Recipient: ${context.recipient || context.destination || "unknown address"}`,
    `Amount: ${context.amount || "TBD"} ${context.currency || "XNO"}`,
  ];

  if (context.note) {
    lines.push(`Note: ${context.note}`);
  }
  if (context.reference) {
    lines.push(`Reference: ${context.reference}`);
  }

  if (context.currency && context.currency !== "XNO") {
    lines.push("This payment uses a non-XNO currency, so an FX conversion may be applied.");
  }

  const highValue = parseFloat(context.amount || "0") > 100;
  if (highValue) {
    lines.push("High-value payment detected. Please verify the merchant and recipient before sending.");
  }

  if (!context.merchant) {
    lines.push("I recommend confirming the merchant identity before completing this transfer.");
  } else {
    lines.push("If the merchant looks correct, you can continue to the send screen for confirmation.");
  }

  lines.push("I can help you choose the best route, explain the details, or warn you of suspicious activity.");
  return lines.join("\n");
}

export default function AIAssistant({ userId, subscription, paymentContext, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([getInitialMessage()]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const contextNotificationRef = useRef(null);
  const chatInitialized = useRef(false);
  const isLoadingRef = useRef(false);
  const inputRef = useRef("");

  const currentPlan = subscription?.plan || "free_trial";
  const planFeatures = PLAN_FEATURES[currentPlan] || PLAN_FEATURES.free_trial;

  const availableActions = useMemo(() => QUICK_ACTIONS.filter(action =>
    planFeatures.quickActions.includes(action.icon)
  ), [planFeatures.quickActions]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const loadHistory = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const data = await getAIHistory(token);
      if (data?.history?.length > 0) {
        setMessages([getInitialMessage(), ...data.history.slice(-10)]);
      }
    } catch (err) {
      console.log("No chat history");
    }
  }, []);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isLoadingRef.current) return;

    const userMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    const token = getToken();

    if (!token) {
      await new Promise(resolve => setTimeout(resolve, 800));
      const aiMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: getLocalResponse(text),
        timestamp: new Date().toISOString(),
        intent: "local"
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await sendAIChat(token, text.trim(), {
        page: "assistant",
        userId
      });

      const aiMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: response.message,
        timestamp: new Date().toISOString(),
        intent: response.intent,
        actions: response.actions || []
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      await new Promise(resolve => setTimeout(resolve, 600));
      const aiMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: getLocalResponse(text),
        timestamp: new Date().toISOString(),
        intent: "local"
      };
      setMessages((prev) => [...prev, aiMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const handleSend = useCallback(() => {
    sendMessage(inputRef.current);
  }, [sendMessage]);

  const handleQuickAction = useCallback((action) => {
    sendMessage(action);
  }, [sendMessage]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    if (chatInitialized.current) return;
    chatInitialized.current = true;
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const handleOpenAI = () => {
      setIsOpen(true);
      setIsMinimized(false);
    };
    window.addEventListener("open-ai-assistant", handleOpenAI);
    return () => window.removeEventListener("open-ai-assistant", handleOpenAI);
  }, []);

  useEffect(() => {
    const handleOpenGoals = () => {
      setIsOpen(true);
      setIsMinimized(false);
      setTimeout(() => {
        sendMessage("Show my financial goals and savings progress");
      }, 300);
    };
    window.addEventListener("open-goals", handleOpenGoals);
    return () => window.removeEventListener("open-goals", handleOpenGoals);
  }, [sendMessage]);

  useEffect(() => {
    if (!paymentContext?.rawValue) return;
    const contextSignature = `${paymentContext.rawValue}-${paymentContext.amount}-${paymentContext.recipient}`;
    if (contextNotificationRef.current === contextSignature) return;

    contextNotificationRef.current = contextSignature;
    setIsOpen(true);

    const assistantMessage = {
      id: `ctx_${Date.now()}`,
      role: "assistant",
      content: buildPaymentContextMessage(paymentContext),
      timestamp: new Date().toISOString(),
      intent: "payment_context"
    };

    setMessages((prev) => [...prev, assistantMessage]);
  }, [paymentContext]);

  if (!isOpen) {
    return (
      <button
        className="ai-floating-button"
        onClick={() => setIsOpen(true)}
        aria-label="Open AI Assistant"
      >
        <img src={FINA_IMAGE} alt="Fina AI Assistant" className="ai-float-avatar" />
        <span className="ai-float-indicator">AI</span>
        <span className="ai-float-pulse"></span>
      </button>
    );
  }

  return (
    <div className={`ai-chat-widget ${isMinimized ? "minimized" : ""}`}>
      <div className="ai-chat-header" onClick={() => setIsMinimized(!isMinimized)}>
        <div className="ai-header-info">
          <img src={FINA_IMAGE} alt="Fina" className="ai-header-avatar" />
          <div>
            <span className="ai-header-title">Fina AI</span>
            <span className="ai-header-status">Online</span>
          </div>
        </div>
        <button
          className="ai-header-action"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
        >
          ×
        </button>
      </div>

      {!isMinimized && (
        <>
          <div className="ai-chat-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`ai-message ${msg.role}`}>
                {msg.role === "assistant" && (
                  <img src={FINA_IMAGE} alt="Fina" className="ai-message-avatar" />
                )}
                <div className="ai-message-content">
                  <p style={{ whiteSpace: "pre-wrap" }}>{msg.content}</p>
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="ai-message-actions">
                      {msg.actions.map((action, i) => (
                        <button
                          key={i}
                          className="ai-action-btn"
                          onClick={() => handleActionClick(action, onNavigate)}
                        >
                          {getActionLabel(action)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="ai-message assistant">
                <img src={FINA_IMAGE} alt="Fina" className="ai-message-avatar" />
                <div className="ai-message-content">
                  <div className="ai-typing">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="ai-quick-actions">
            {availableActions.map((action, index) => (
              <button
                key={index}
                className="ai-quick-btn"
                onClick={() => handleQuickAction(action.action)}
              >
                {action.label}
              </button>
            ))}
          </div>

          <div className="ai-chat-input">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask Fina anything..."
              disabled={isLoading}
            />
            <button onClick={handleSend} disabled={!input.trim() || isLoading}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function getActionLabel(action) {
  if (action.type === "navigate") return "Go to Dashboard";
  if (action.type === "balance") return `Balance: ${action.value} XNO`;
  if (action.type === "transactions") return `${action.count} Transactions`;
  return action.type || "Action";
}

export { FINA_IMAGE, QUICK_ACTIONS, PLAN_FEATURES };
