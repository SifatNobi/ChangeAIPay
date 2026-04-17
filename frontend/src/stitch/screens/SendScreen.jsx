import { useState } from "react";

export default function SendScreen({ sendTransaction }) {
  const [form, setForm] = useState({ recipient: "", amount: "" });
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: "idle", message: "" });
    try {
      await sendTransaction(form);
      setForm({ recipient: "", amount: "" });
      setStatus({ type: "ok", message: "Transaction sent." });
    } catch (err) {
      setStatus({ type: "error", message: err?.message || "Failed to send transaction." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack-lg stitch-bg stitch-send-screen">
      <section className="card form-card glass-card send-surface stitch-send-card">
        <span className="eyebrow">Quick Transfer</span>
        <h1>Send Nano</h1>
        <p className="muted">Real-time transfer with zero-fee Nano settlement.</p>

        <form onSubmit={submit}>
          <input
            name="recipient"
            onChange={(e) => setForm({ ...form, recipient: e.target.value })}
            placeholder="Recipient (email or Nano address)"
            value={form.recipient}
            required
          />
          <input
            name="amount"
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="Amount (XNO)"
            value={form.amount}
            required
          />
          {status.type === "error" && <div className="status error">{status.message}</div>}
          {status.type === "ok" && <div className="status">{status.message}</div>}
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send"}
          </button>
        </form>
      </section>
    </div>
  );
}

