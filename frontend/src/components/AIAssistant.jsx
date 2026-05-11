import { useState, useCallback, useRef, useEffect } from "react";
import "./AIAssistant.css";

const FINA_IMAGE = "https://photos.app.goo.gl/ChtosMU8yiVXbFVa9";

const QUICK_ACTIONS = [
  { label: "Check Balance", action: "balance" },
  { label: "Send Crypto", action: "send" },
  { label: "Receive", action: "receive" },
  { label: "Transaction History", action: "history" },
  { label: "Help", action: "help" }
];

const INITIAL_MESSAGE = {
  id: "welcome",
  role: "assistant",
  content: "Hello! I'm Fina, your AI assistant for ChangeAIPay. How can I help you today?",
  timestamp: new Date().toISOString()
};

export default function AIAssistant({ userId, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await getAIResponse(userMessage.content);
      
      const aiMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: response.message,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      const errorMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: "I'm having trouble connecting. Please try again later.",
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading]);

  const handleQuickAction = useCallback((action) => {
    const actionMessages = {
      balance: "How can I check my balance?",
      send: "How do I send Nano?",
      receive: "How do I receive payments?",
      history: "Where can I see my transaction history?",
      help: "I need help with ChangeAIPay"
    };

    setInput(actionMessages[action] || "Help me");
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
                  <p>{msg.content}</p>
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
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.action}
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
              placeholder="Ask Fina..."
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

function getAIResponse(message) {
  const lower = message.toLowerCase();
  
  if (lower.includes("balance") || lower.includes("how much")) {
    return {
      message: "To check your balance, go to your Dashboard. Your current Nano balance is displayed there along with your wallet address. Would you like me to guide you there?"
    };
  } else if (lower.includes("send") || lower.includes("transfer")) {
    return {
      message: "To send Nano, click on 'Send' in the navigation, enter the recipient's wallet address and amount, then confirm the transaction. It's instant with zero fees!"
    };
  } else if (lower.includes("receive") || lower.includes("qr")) {
    return {
      message: "To receive Nano, go to your Dashboard and use the 'Generate QR' feature. Share the QR code with the sender, or copy your wallet address directly."
    };
  } else if (lower.includes("history") || lower.includes("transaction")) {
    return {
      message: "You can view all your transaction history in the History section of your Dashboard. Each transaction shows the amount, direction, status, and timestamp."
    };
  } else if (lower.includes("help") || lower.includes("support")) {
    return {
      message: "I'm here to help! You can ask me about:\n• Sending and receiving Nano\n• Checking your balance\n• Transaction history\n• Wallet setup\n• Security tips\n\nWhat would you like to know?"
    };
  } else if (lower.includes("fee") || lower.includes("cost")) {
    return {
      message: "ChangeAIPay has ZERO fees for all transactions! The Nano network processes payments instantly without any transaction costs. It's one of the main benefits of using Nano!"
    };
  } else if (lower.includes("nano") || lower.includes("crypto")) {
    return {
      message: "Nano is a decentralized, fee-less cryptocurrency that enables instant, feeless transactions. It's designed for everyday payments and is one of the fastest digital currencies available."
    };
  }
  
  return {
    message: "Thanks for reaching out! I'm here to help with any questions about ChangeAIPay, Nano payments, or your account. What would you like to know?"
  };
}

export { FINA_IMAGE, QUICK_ACTIONS };