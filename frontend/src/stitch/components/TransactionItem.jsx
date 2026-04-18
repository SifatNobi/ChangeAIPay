import { useState } from "react";
import SafeText from "./SafeText";
import { formatAmount } from "../utils/format";

export default function TransactionItem({ transaction }) {
  const [copyStatus, setCopyStatus] = useState("");
  const direction = String(transaction?.direction || "").toLowerCase();
  const isIncoming = direction.includes("in") || direction.includes("receive");
  const amount = formatAmount(transaction?.amountNano);
  const counterparty =
    transaction?.counterpart?.email ||
    transaction?.counterpart?.walletAddress ||
    "Unknown";
  const status = transaction?.status || "pending";
  const txHash = transaction?.txHash;

  function copyHash() {
    if (!txHash || !navigator?.clipboard) return;
    navigator.clipboard.writeText(txHash).then(() => {
      setCopyStatus("Copied");
      setTimeout(() => setCopyStatus(""), 1800);
    });
  }

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
        {txHash && (
          <div className="tx-hash-row">
            <code>{`${txHash.slice(0, 16)}...`}</code>
            <button type="button" className="copy-button" onClick={copyHash}>
              {copyStatus || "Copy"}
            </button>
          </div>
        )}
      </div>
      <div className={`tx-state ${status}`}>
        {status === "success" ? "Confirmed" : status === "failed" ? "Failed" : "Pending"}
      </div>
    </article>
  );
}

