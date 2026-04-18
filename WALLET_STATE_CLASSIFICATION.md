# Wallet State Classification System

## Overview

The wallet state classification system provides clear, structured responses that help users understand their wallet's current condition at every step of the payment flow. Instead of generic "failed" responses, the system returns specific wallet states that guide users toward resolution.

## Wallet States

Five primary wallet states are used throughout the system:

### 1. **`ready`** - Wallet is ready to send
- **Condition**: Account exists and has balance > 0 XNO
- **User Action**: Can send transactions immediately
- **HTTP Status**: 200 (for balance check), 201 (for successful send)
- **Example**: User has 5.2 XNO in their wallet

### 2. **`needs_funding`** - Account exists but has no balance
- **Condition**: Account is activated but balance == 0
- **User Action**: Must receive Nano to this wallet first
- **HTTP Status**: 400 (insufficient funds error)
- **Message**: "Your wallet has insufficient balance. Send some Nano to your wallet first."
- **Example**: User's wallet exists but has 0 XNO

### 3. **`not_activated`** - Account has never received Nano
- **Condition**: Account doesn't exist on the Nano network yet
- **User Action**: Must send/receive Nano first to activate the account
- **HTTP Status**: 400 (account not opened error)
- **Message**: "Your wallet has not been activated yet. Please receive Nano first."
- **Example**: Freshly created user wallet with no deposits

### 4. **`processing`** - Transaction submitted, awaiting confirmation
- **Condition**: Transaction hash received from network, confirmation pending
- **User Action**: Wallet is temporarily locked; check status later
- **HTTP Status**: 201 (successful submission)
- **Message**: "Transaction submitted successfully"
- **Example**: Transaction sent, awaiting network confirmation

### 5. **`failed`** - RPC error or signing failure
- **Condition**: Network failure, signing error, or other technical issue
- **User Action**: Retry the operation or contact support
- **HTTP Status**: 502 (server error)
- **Message**: "Failed to [operation]"
- **Example**: RPC node unreachable, cryptographic signing failed

---

## Implementation Details

### Wallet State Detection Flow

The state is determined in the following order:

```
1. Check if account exists on network
   ↓
   ├─ NO → state = "not_activated"
   │
   └─ YES → Check balance
            ↓
            ├─ balance == 0 → state = "needs_funding"
            │
            └─ balance > 0 → state = "ready"

2. On Send Attempt
   ├─ If state != "ready" → Reject immediately with appropriatestate
   │
   └─ If state == "ready" → Attempt send
      ↓
      ├─ Success (hash received) → state = "processing"
      │
      └─ Error → Set appropriate state based on error type
```

### Service Layer Updates

#### `nanoWallet.js` - `getBalance(account)`

Returns wallet state alongside balance information:

```json
{
  "success": true,
  "balance": "1000000000000000000000000",
  "balanceNano": "1.0",
  "state": "ready",
  "exists": true,
  "message": "Wallet ready"
}
```

States returned:
- `ready`: Account exists and has balance
- `needs_funding`: Account exists but balance is 0
- `not_activated`: Account doesn't exist
- `failed`: RPC error occurred

#### `nanoWallet.js` - `sendNano({ privateKey, fromAddress, toAddress, amountNano })`

**STEP 3: Pre-Send State Checking**

1. Calls `getBalance(fromAddress)` before attempting send
2. Checks wallet state immediately:
   - If `not_activated` → throws error with state: "not_activated"
   - If `needs_funding` → throws error with state: "needs_funding"
   - If `ready` → proceeds to send

**STEP 4: Success Response**

Returns wallet state after send:

```json
{
  "success": true,
  "state": "processing",
  "tx_hash": "ABC123...",
  "message": "Transaction submitted successfully",
  "confirmation": {
    "confirmed": false,
    "pending": true
  }
}
```

### Controller Layer Updates

#### `transactionController.js` - `send()` endpoint

**STEP 5: State Classification in Responses**

Success response includes state:
```json
{
  "success": true,
  "state": "processing",
  "status": "success",
  "tx_hash": "ABC123...",
  "message": "Payment submitted successfully",
  "transaction": { ... }
}
```

Error response includes state mapped from error type:
```json
{
  "success": false,
  "state": "needs_funding",
  "status": "insufficient_balance",
  "error": "Insufficient balance",
  "balance": "0",
  "balanceNano": "0"
}
```

Error to State Mapping:
- `INSUFFICIENT_BALANCE` → state: "needs_funding"
- `ACCOUNT_NOT_OPENED` → state: "not_activated"
- `RPC_FAILED` → state: "failed"
- `INVALID_INPUT` → state: "failed"
- `BLOCK_FAILURE` → state: "failed"

#### `walletController.js` - endpoints updated

**Balance Endpoint** (`GET /wallet/balance`):
```json
{
  "success": true,
  "balance": "1000000000000000000000000",
  "balanceNano": "1.0",
  "state": "ready",
  "message": "Wallet ready"
}
```

**Send Payment Endpoint** (`POST /wallet/send`):

Returns state in response:
```json
{
  "success": true,
  "state": "processing",
  "txHash": "ABC123..."
}
```

**Dashboard Endpoint** (`GET /dashboard`):
```json
{
  "user": { ... },
  "wallet": {
    "balance": "1000000000000000000000000",
    "balanceNano": "1.0",
    "state": "ready"
  },
  "recentTransactions": [ ... ]
}
```

---

## Frontend Integration

The frontend receives wallet state in every response and can display appropriate UI:

### State → UI Mapping

| State | Icon | Color | Action |
|-------|------|-------|--------|
| `ready` | ✅ | Green | "Ready to send" |
| `needs_funding` | ⚠️ | Yellow | "Send Nano to your wallet" |
| `not_activated` | ❌ | Red | "Receive Nano first to activate" |
| `processing` | ⏳ | Blue | "Please wait, confirming..." |
| `failed` | ❌ | Red | "Try again or contact support" |

### Example Frontend Logic

```javascript
// Check wallet state before allowing send
const walletData = await getBalance();
if (walletData.state !== "ready") {
  return showMessage(walletData.message, walletData.state);
}

// After send attempt
try {
  const result = await sendNano(...);
  if (result.state === "processing") {
    showMessage("Payment submitted! Awaiting confirmation...", "processing");
  }
} catch (error) {
  showError(error.message, error.state);
}
```

---

## Error Prevention Rules

### ✅ Do's
- Always check wallet state BEFORE attempting send
- Return appropriate state based on error type
- Use state to guide user actions
- Include balance info with "needs_funding" responses
- Clear messaging tied to specific states

### ❌ Don'ts
- Don't return generic "failed" for wallet state issues
- Don't mark transaction as "failed" if RPC accepted it
- Don't throw errors for non-activated accounts without clear message
- Don't proceed with send if state is not "ready"
- Don't confuse "not_activated" with "needs_funding"

---

## HTTP Status Code Mapping

| Wallet State | HTTP Status | Meaning |
|--------------|------------|---------|
| `ready` | 200, 201 | Operation successful |
| `needs_funding` | 400 | Client error - needs action |
| `not_activated` | 400 | Client error - needs activation |
| `processing` | 201 | Accepted, awaiting confirmation |
| `failed` | 502 | Server error - retry or report |

---

## Testing Scenarios

### Test Case 1: Not Activated Wallet
1. Create new user (no wallet activity)
2. Check balance → state: "not_activated"
3. Try to send → error with state: "not_activated"
4. Receive Nano → automatically activates
5. Check balance → state: "ready" (if balance > 0) or "needs_funding" (if balance == 0)

### Test Case 2: Zero Balance
1. Create wallet, activate, then spend all Nano
2. Check balance → state: "needs_funding"
3. Try to send → error with state: "needs_funding"
4. Receive more Nano → state: "ready"

### Test Case 3: Successful Send
1. User has balance → state: "ready"
2. Send Nano → returns state: "processing"
3. Receive confirmation → state becomes "ready" for next send

### Test Case 4: RPC Failure
1. All RPC nodes down
2. Send attempt → error with state: "failed"
3. User can retry once nodes are back

---

## Migration Notes

For existing applications:

1. **Database**: No schema changes required. State is computed on-the-fly.
2. **API Version**: No breaking changes. State is added as new field to responses.
3. **Frontend**: Update to parse `state` field and adjust UI accordingly.
4. **Logging**: Add state to transaction logs: `[state: ${state}]`

---

## Summary

The wallet state classification system provides:
- ✅ Clear feedback for users at every step
- ✅ Immediate prevention of invalid operations
- ✅ Accurate error categorization
- ✅ Simplified frontend logic with state-based decisions
- ✅ No more mysterious "failed" responses without context
