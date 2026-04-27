import jwt from "jsonwebtoken";

function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "Server misconfigured" });

    const payload = jwt.verify(token, secret);
    req.user = { id: payload.sub };
    return next();
  } catch (_err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export default auth;
export { auth };

