# Architecture & Design Decisions

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND (React)                  │
│                  SendScreen.jsx                      │
│        - Shows pending/success/error states         │
│        - Calls POST /transaction/send                │
└────────────────────┬────────────────────────────────┘
                     │
         API → api.js → sendTransaction()
                     │
┌────────────────────▼────────────────────────────────┐
│              BACKEND (Express)                       │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │  Controller Layer                          │    │
│  │  transactionController.js                  │    │
│  │  - Input validation                        │    │
│  │  - Duplicate detection                     │    │
│  │  - Error classification                    │    │
│  │  - Response formatting                     │    │
│  └────────────────┬─────────────────────────┘    │
│                   │                               │
│  ┌────────────────▼─────────────────────────┐    │
│  │  Wallet Service Layer                    │    │
│  │  nanoWallet.js                           │    │
│  │  - sendNano() - High-level send          │    │
│  │  - getBalance() - Read balance           │    │
│  │  - confirmTransaction() - Check confirm  │    │
│  │  - autoReceive() - Auto-receive blocks   │    │
│  │  - pollConfirmation() - Poll status      │    │
│  └────────────────┬─────────────────────────┘    │
│                   │                               │
│  ┌────────────────▼─────────────────────────┐    │
│  │  Protocol Service Layer                  │    │
│  │  nano.js                                 │    │
│  │  - sendFromWallet() - PHASE 1-8          │    │
│  │  - waitForConfirmation() - PHASE 4       │    │
│  │  - generateReceiveBlock() - PHASE 3      │    │
│  │  - ERROR_TYPES constant                  │    │
│  └────────────────┬─────────────────────────┘    │
│                   │                               │
│  ┌────────────────▼─────────────────────────┐    │
│  │  RPC Client Layer                        │    │
│  │  rpcClient.js                            │    │
│  │  - callRpc() - Smart failover            │    │
│  │  - getNodeHealth() - Node health         │    │
│  │  - Health tracking & cooldown            │    │
│  └────────────────┬─────────────────────────┘    │
│                   │                               │
└───────────────────┼───────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
    RPC_1        RPC_2       RPC_3
    Primary     Secondary    Tertiary
    nano.to     proxy.nanos  some.nano
                cc            node.com
        │           │           │
        └───────────┼───────────┘
                    │
        ┌───────────▼───────────┐
        │   Nano Network        │
        │   (Live Mainnet)      │
        └───────────────────────┘

┌─────────────────────────────────────────────────────┐
│              DATABASE (MongoDB)                      │
│  - User documents                                   │
│  - Transaction records (history & audit)            │
│  - Wallet addresses & encrypted keys                │
└─────────────────────────────────────────────────────┘
```

---

## Data Flow: Send Payment

```
1. USER INITIATES
   Frontend: Click Send
   ├─ Validate inputs locally
   └─ Call POST /transaction/send

2. CONTROLLER (transactionController.js)
   ├─ Fetch sender from DB (with private key)
   ├─ Fetch receiver from DB
   ├─ Amount validation
   ├─ Convert Nano → Raw (10^30)
   ├─ Check for recent duplicates
   └─ Create Transaction(pending)

3. WALLET LAYER (nanoWallet.js)
   ├─ Call sendFromWallet()
   └─ Handle structured errors

4. PROTOCOL LAYER (nano.js) - PHASE 1-8
   ├─ Step 1: Fetch account_info
   ├─ Step 2: Validate account exists
   ├─ Step 3: Check balance (CRITICAL!)
   ├─ Step 4: Build state block
   ├─ Step 5: Generate PoW work
   ├─ Step 6: Sign block
   ├─ Step 7: Submit via process RPC
   └─ Return { txHash, success, warning? }

5. CONFIRMATION POLLING
   ├─ waitForConfirmation(txHash)
   ├─ Poll block_info up to 10 times
   └─ Update Transaction(confirmed)

6. RESPONSE
   ├─ Controller catches result
   ├─ Format response with success flag
   └─ Return to frontend

7. FRONTEND
   ├─ Show success state with hash
   ├─ Or pending state if not confirmed yet
   └─ Or error state with classification
```

---

## Error Handling Strategy

### By Layer

**Frontend Layer:**
```javascript
try {
  const result = await sendTransaction(form);
  if (result.success) {
    setStatus({ type: "success", ... })
  } else if (result.status === "pending") {
    setStatus({ type: "pending", ... })
  } else {
    setStatus({ type: "error", message: result.error })
  }
} catch (err) {
  setStatus({ type: "error", message: err.message })
}
```

**Controller Layer:**
```javascript
try {
  const result = await sendFromWallet(...);
  // sendFromWallet only returns on success
  // Update DB, return success response
} catch (error) {
  // error is: { status: "...", error: "...", balance: "..." }
  // Map status to HTTP code and response format
  const httpStatus = statusMap[error.status];
  return res.status(httpStatus).json(error);
}
```

**Service Layer (nano.js):**
```javascript
// Throws structured error objects, never Error()
throw {
  status: ERROR_TYPES.INSUFFICIENT_BALANCE,
  error: "Insufficient balance",
  balance: currentBalanceRaw,
  balanceNano: rawToNano(currentBalanceRaw)
};

// Only returns on SUCCESS - never returns error objects
return { txHash, success: true, warning };
```

### Why This Works

1. **Clear Signal:** (throw/return) = (fail/succeed)
2. **Type Safe:** Error objects have consistent shape
3. **Controller Control:** Can add logging, map errors to HTTP codes
4. **Frontend Simple:** Check response.success and response.status
5. **Never Misleading:** If error is thrown, user never sees success

---

## Key Design Decisions

### 1. THROW Structured Objects Instead of Error()
```javascript
// ❌ Don't do this:
throw new Error("Insufficient balance");

// ✅ Do this:
throw { 
  status: "insufficient_balance",
  error: "Insufficient balance",
  balance: "..." 
};
```

**Why:** Can include context (balance) that HTTP Error can't

### 2. Balance Check BEFORE Spending
```javascript
// ❌ Bad: Check after signatures
sendFromWallet(...) {
  buildBlock();
  signBlock();
  if (balance < amount) throw Error(); // TOO LATE
}

// ✅ Good: Check first
sendFromWallet(...) {
  if (balance < amount) throw { status: "insufficient_balance" };
  buildBlock();
  signBlock();
}
```

**Why:** Prevents double-charge risk and waste of compute

### 3. Failover at RPC Layer, Not Higher
```javascript
// ✅ Correct approach - failover is transparent to caller
callRpc(payload) {
  for (node of RPC_NODES) {
    try { return fetch(node, payload); }
    catch { continue; }
  }
  return { success: false, error: "All failed" };
}

// Then ctrl call:
await callRpc(...); // Doesn't know about failover
```

**Why:** Isolates failover logic, simplifies higher layers

### 4. Structured Response Format
```json
{
  "success": boolean,
  "status": "classification",
  "error": "message",
  "tx_hash": "hash or null",
  "balance": "if relevant"
}
```

**Why:** 
- `success` - Quick JS truthiness check
- `status` - Specific classification (not just error/ok)
- `error` - Human-readable message for UI
- `tx_hash` - Never say "failed" if hash exists
- `balance` - Context for insufficient_balance error

### 5. Duplicate Detection at Controller
```javascript
// Check BEFORE creating Transaction
const recent = await Transaction.findOne({
  sender, receiver, amountRaw,
  status: { $in: ["pending", "submitted"] },
  timestamp: { $gte: Date.now() - 60000 }
});
if (recent) return existing tx_hash;
```

**Why:**
- Only works if check is early
- Prevents DB state inconsistency
- Returns existing hash, never re-sends

### 6. No Confirmation Polling in Responses
```javascript
// ✅ Don't await confirmation before returning
const { txHash } = await sendFromWallet(...);
transaction.status = "submitted";
await transaction.save();
return res.status(201).json({ success: true, tx_hash: txHash });

// Confirmation polling happens in background
waitForConfirmation(txHash).then(result => {
  if (result.confirmed) {
    transaction.status = "confirmed";
    transaction.save();
  }
});
```

**Why:** 
- User sees success immediately (tx accepted)
- Confirms later (can take 10+ seconds)
- Prevents response timeout
- Frontend can poll for confirmation status

---

## Extension Points

### Add New RPC Nodes
**File:** `backend/services/rpcClient.js`
```javascript
const RPC_NODES = [
  "https://rpc.nano.to",
  "https://proxy.nanos.cc/proxy",
  "https://node.somenano.com/proxy",
  "https://new.node.com/proxy"  // ← Add here
];
```

Health tracking automatic. No other changes needed.

### Add New Error Type
**File:** `backend/services/nano.js`
```javascript
const ERROR_TYPES = {
  // ... existing
  CUSTOM_ERROR: "custom_error"
};
```

**File:** `backend/controllers/transactionController.js`
```javascript
case ERROR_TYPES.CUSTOM_ERROR:
  httpStatus = 400;
  errorMsg = "Custom error message";
  break;
```

### Custom Receive Block Logic
**File:** `backend/services/nano.js` → `generateReceiveBlock()`
- Modify balance calculation
- Add memo block support
- Store additional metadata

### Change Confirmation Polling
**File:** `backend/services/nano.js` → `waitForConfirmation()`
```javascript
const attempts = 10;      // More attempts
const delayMs = 500;      // Faster polling
```

Or via environment:
```
RPC_CONFIRM_ATTEMPTS=30
RPC_CONFIRM_DELAY_MS=500
```

### Add Transaction Middleware
**File:** `backend/controllers/transactionController.js`
```javascript
// ADD NEW VALIDATION STEP
if (requiresWhitelist(recipient)) {
  const whitelisted = await checkWhitelist(recipient);
  if (!whitelisted) throw { status: "recipient_not_whitelisted" };
}
```

### Implement User Reputation
**File:** `backend/controllers/transactionController.js`
```javascript
// Track transaction count per user
const userTransactions = await Transaction.countDocuments({
  sender: sender._id,
  status: "confirmed"
});

if (userTransactions < 5 && amount > LIMIT) {
  throw { status: "daily_limit_exceeded" };
}
```

---

## Testing Strategy

### Unit Testing
```javascript
// Test error classification
test("insufficient_balance returns correct status", () => {
  const err = sendFromWallet({ amount: "1000000000000000000000000000000000" });
  expect(err.status).toBe("insufficient_balance");
});

// Test Nano conversion
test("nanoToRaw converts correctly", () => {
  expect(nanoToRaw("1")).toBe("1000000000000000000000000000000");
});

// Test RPC failover
test("callRpc retries after node failure", async () => {
  // Mock first node to fail
  // Mock second node to succeed
  // Verify health tracking updated
});
```

### Integration Testing
```javascript
// Full send flow
test("send creates transaction and broadcasts to RPC", async () => {
  const result = await transactionController.send(req, res);
  expect(result.success).toBe(true);
  expect(res.status).toBe(201);
  // Verify transaction in DB
  // Verify RPC called with correct block
});

// Error handling
test("duplicate sends blocked", async () => {
  await send(form);
  const dup = await send(form); // Same form immediately
  expect(dup.status).toBe("duplicate_send");
});
```

### Stress Testing
```bash
# Send 100 payments rapidly
for i in {1..100}; do
  curl -X POST http://localhost:5000/transaction/send \
    -H "Auth: $TOKEN" \
    -d "{\"recipient\": \"user$i@test.com\", \"amount\": \"0.1\"}"
done

# Monitor:
# - All succeed (99%+)
# - No duplicates
# - RPC failover if node goes down
# - DB stays consistent
```

---

## Configuration Best Practices

### Development
```env
RPC_TIMEOUT_MS=5000        # Quick feedback
RPC_RETRIES=0              # Fast fail
RPC_CONFIRM_ATTEMPTS=5     # Quick polls
RPC_CONFIRM_DELAY_MS=500   # Faster
LOG_LEVEL=DEBUG            # Verbose
```

### Staging
```env
RPC_TIMEOUT_MS=10000       # Reasonable
RPC_RETRIES=1              # One retry
RPC_CONFIRM_ATTEMPTS=15    # Good coverage
RPC_CONFIRM_DELAY_MS=1000  # Standard
LOG_LEVEL=INFO             # Important only
```

### Production
```env
RPC_TIMEOUT_MS=10000       # Proven good
RPC_RETRIES=2              # Good resilience
RPC_CONFIRM_ATTEMPTS=20    # Very thorough
RPC_CONFIRM_DELAY_MS=1000  # Standard
LOG_LEVEL=WARN             # Errors + warnings
```

---

## Performance Considerations

### Database Indexing
```javascript
// On Transaction model
db.transactions.createIndex({ sender: 1, timestamp: -1 });
db.transactions.createIndex({ status: 1, timestamp: -1 });
db.transactions.createIndex({ txHash: 1 }, { unique: true, sparse: true });
db.transactions.createIndex({ sender: 1, receiver: 1, amountRaw: 1, timestamp: -1 });
```

### Caching Layer (Future)
```javascript
// Could add Redis caching for:
// - Recent balance lookups
// - Block confirmation status (TTL 30s)
// - RPC health status (TTL 10s)
```

### Batch Processing (Future)
```javascript
// Could batch receive blocks:
// - Collect pending funds for user
// - Generate one receive for each send
// - Reduces RPC calls
```

---

## Security Review Checklist

- [ ] Private keys never logged or sent to frontend
- [ ] Auth required for all transaction endpoints
- [ ] CORS restricted to allowed origins
- [ ] SQL injection not possible (using MongoDB queries)
- [ ] Balance validation prevents over-spending
- [ ] Duplicate detection prevents double-charge
- [ ] All user inputs validated/sanitized
- [ ] Rate limiting on auth endpoints
- [ ] HTTPS enforced in production
- [ ] Database backups enabled
- [ ] Error messages don't leak sensitive info

---

## Future Enhancements

### Priority 1 (High Value)
- [ ] WebSocket support for real-time confirmation
- [ ] Batch payments (send to multiple recipients)
- [ ] Payment scheduling (send in future)
- [ ] Transaction memo/reference field

### Priority 2 (Medium Value)
- [ ] Multi-signature support
- [ ] Escrow/holdback feature
- [ ] Receive limits (max per transaction)
- [ ] User verification/KYC integration

### Priority 3 (Low Value)
- [ ] Mobile wallet integration
- [ ] Point-of-sale mode
- [ ] Merchant features
- [ ] API rate limiting per user

---

**This architecture is designed for:**
- ✅ Production reliability
- ✅ Easy troubleshooting
- ✅ Extensibility
- ✅ Investor confidence
- ✅ Day-2 operations
