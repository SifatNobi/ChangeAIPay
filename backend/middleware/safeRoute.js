export default function safeRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      console.error("Route error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Route failed" });
      }
    }
  };
}
