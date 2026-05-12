import { useState, useCallback, useRef, useEffect } from "react";
import { getToken } from "../api";
import { sendAIChat, getAIHistory } from "../api";
import { FINA_AI_IMAGE } from "../constants/branding";
import "./AIAssistant.css";

const FINA_IMAGE = FINA_AI_IMAGE;

const QUICK_ACTIONS = [
  { label: "💰 Check Balance", action: "check my balance", icon: "balance" },
  { label: "💸 Send Crypto", action: "send crypto", icon: "send" },
  { label: "📥 Receive", action: "how do I receive", icon: "receive" },
  { label: "📊 Transaction History", action: "show my transactions", icon: "history" },
  { label: "📈 Spending Insights", action: "my spending insights", icon: "insight" },
  { label: "🆘 Help", action: "help me", icon: "help" }
];

const INITIAL_MESSAGE = {
  id: "welcome",
  role: "assistant",
  content: "👋 Hello! I'm Fina, your ChangeAIPay AI assistant!\n\nI can help you with:\n• 💸 Sending & receiving crypto\n• 💰 Checking your balance\n• 📊 Transaction insights\n• 💡 Financial recommendations\n\nWhat would you like to do today?",
  timestamp: new Date().toISOString(),
  intent: "greeting"
};

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

export default function AIAssistant({ userId, paymentContext, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const token = getToken();
  const contextNotificationRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    loadHistory();
  }, [token]);

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

  const loadHistory = async () => {
    const token = getToken();
    if (!token) return;

    try {
      const data = await getAIHistory(token);
      if (data?.history?.length > 0) {
        setMessages([INITIAL_MESSAGE, ...data.history.slice(-10)]);
      }
    } catch (err) {
      console.log("No chat history");
    }
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const token = getToken();
    if (!token) {
      setError("Please login to chat with Fina.");
      return;
    }

    const userMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await sendAIChat(token, input.trim(), {
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
      const errorMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: "I apologize, but I'm having trouble processing your request right now. Please try again.",
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, errorMessage]);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, userId]);

  const handleQuickAction = useCallback((action) => {
    setInput(action);
  }, []);

  const handleKeyPress = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

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
            {error && (
              <div className="ai-error">
                <span>⚠️ Connection issue. Try again.</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="ai-quick-actions">
            {QUICK_ACTIONS.map((action, index) => (
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

export { FINA_IMAGE, QUICK_ACTIONS };