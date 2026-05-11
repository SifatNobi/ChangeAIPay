import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import config from "../config/index.js";
import logger from "./logger.js";

class WebSocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Map();
    this.subscriptions = new Map();
  }

  initialize(server) {
    this.wss = new WebSocketServer({
      server,
      path: config.websocket.path
    });

    this.wss.on("connection", (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on("error", (error) => {
      logger.error("WebSocket server error", { error: error.message });
    });

    logger.info("WebSocket server initialized", { path: config.websocket.path });
  }

  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    const ip = req.socket.remoteAddress;
    
    logger.info("New WebSocket connection", { clientId, ip });

    this.clients.set(clientId, {
      ws,
      ip,
      userId: null,
      authenticated: false,
      subscriptions: new Set(),
      connectedAt: new Date()
    });

    ws.on("message", (data) => this.handleMessage(clientId, data));
    
    ws.on("close", () => this.handleDisconnect(clientId));
    
    ws.on("error", (error) => {
      logger.error("WebSocket client error", { clientId, error: error.message });
    });

    ws.send(JSON.stringify({
      type: "welcome",
      data: { clientId, serverTime: new Date().toISOString() }
    }));
  }

  handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data.toString());
      const { type, payload } = message;

      switch (type) {
        case "auth":
          this.handleAuth(clientId, payload);
          break;
        case "subscribe":
          this.handleSubscribe(clientId, payload);
          break;
        case "unsubscribe":
          this.handleUnsubscribe(clientId, payload);
          break;
        case "ping":
          this.sendToClient(clientId, { type: "pong", data: { timestamp: Date.now() } });
          break;
        default:
          logger.warn("Unknown WebSocket message type", { clientId, type });
      }
    } catch (err) {
      logger.error("Failed to parse WebSocket message", { clientId, error: err.message });
    }
  }

  handleAuth(clientId, { token }) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      const client = this.clients.get(clientId);
      
      if (client) {
        client.userId = decoded.userId;
        client.authenticated = true;
        
        this.sendToClient(clientId, {
          type: "auth_success",
          data: { userId: decoded.userId }
        });
        
        logger.info("WebSocket client authenticated", { clientId, userId: decoded.userId });
      }
    } catch (err) {
      this.sendToClient(clientId, {
        type: "auth_error",
        data: { error: "Invalid token" }
      });
    }
  }

  handleSubscribe(clientId, { channel }) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    
    this.subscriptions.get(channel).add(clientId);
    client.subscriptions.add(channel);
    
    this.sendToClient(clientId, {
      type: "subscribed",
      data: { channel }
    });
  }

  handleUnsubscribe(clientId, { channel }) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.delete(channel);
    
    const channelClients = this.subscriptions.get(channel);
    if (channelClients) {
      channelClients.delete(clientId);
    }
    
    this.sendToClient(clientId, {
      type: "unsubscribed",
      data: { channel }
    });
  }

  handleDisconnect(clientId) {
    const client = this.clients.get(clientId);
    
    if (client) {
      for (const channel of client.subscriptions) {
        const channelClients = this.subscriptions.get(channel);
        if (channelClients) {
          channelClients.delete(clientId);
        }
      }
      
      logger.info("WebSocket client disconnected", {
        clientId,
        userId: client.userId,
        duration: Date.now() - client.connectedAt.getTime()
      });
    }
    
    this.clients.delete(clientId);
  }

  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify(message));
    }
  }

  broadcast(channel, message) {
    const channelClients = this.subscriptions.get(channel);
    if (!channelClients) return;

    const payload = JSON.stringify(message);
    
    for (const clientId of channelClients) {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === 1) {
        client.ws.send(payload);
      }
    }
  }

  sendToUser(userId, message) {
    for (const [clientId, client] of this.clients) {
      if (client.userId === userId && client.ws.readyState === 1) {
        client.ws.send(JSON.stringify(message));
      }
    }
  }

  notifyTransaction(userId, transaction) {
    this.sendToUser(userId, {
      type: "transaction_update",
      data: transaction
    });
  }

  notifyBalance(userId, balance) {
    this.sendToUser(userId, {
      type: "balance_update",
      data: balance
    });
  }

  notifyNotification(userId, notification) {
    this.sendToUser(userId, {
      type: "notification",
      data: notification
    });
  }

  generateClientId() {
    return `ws_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  getStats() {
    return {
      totalClients: this.clients.size,
      authenticatedClients: [...this.clients.values()].filter(c => c.authenticated).length,
      channels: this.subscriptions.size,
      subscriptions: [...this.subscriptions.entries()].map(([channel, clients]) => ({
        channel,
        count: clients.size
      }))
    };
  }
}

const wsManager = new WebSocketManager();

export default wsManager;