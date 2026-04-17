import SafeText from "./SafeText";
import { formatAmount } from "../utils/format";

export default function TransactionItem({ transaction }) {
  const direction = String(transaction?.direction || "").toLowerCase();
  const isIncoming = direction.includes("in") || direction.includes("receive");
  const amount = formatAmount(transaction?.amountNano);
  const counterparty =
    transaction?.counterpart?.email ||
    transaction?.counterpart?.walletAddress ||
    "Unknown";

  return (
    <article className={`transaction-row ${isIncoming ? "incoming" : "outgoing"}`}>
      <div className="tx-icon">{isIncoming ? "↓" : "↑"}</div>
      <div className="tx-main">
        <p className="tx-amount">
          {isIncoming ? "+" : "-"}
          {amount} XNO
        </p>
        <p className="tx-meta">
          <SafeText>{counterparty}</SafeText>
        </p>
      </div>
      <div className="tx-state">{isIncoming ? "Confirmed" : "Sent"}</div>
    </article>
  );
}

