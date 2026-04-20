<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ChangeAIPay</title>
    <meta
      name="description"
      content="ChangeAIPay is a Nano-powered fintech demo for instant zero-fee payments."
    />
    <link rel="icon" href="/assets/icon-CQwnqlEn.png" type="image/png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap"
      rel="stylesheet"
    />

    <script src="https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js"></script>
    <script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-BW-k_VPG.css">
  </head>
  <body>
    <div id="app">
      <!-- Auth Section -->
      <div id="auth-section" class="auth-shell">
        <div class="stitch-orb orb-a"></div>
        <div class="stitch-orb orb-b"></div>
        <header class="auth-topbar">
          <div class="brand-lockup">
            <div class="brand-mark">
              <img src="/assets/icon-CQwnqlEn.png" alt="ChangeAIPay" class="brand-icon" />
            </div>
            <h1 class="brand-title">ChangeAIPay</h1>
          </div>
        </header>
        <div class="auth-panel">
          <div class="hero-copy">
            <div class="hero-badge">
              <img src="/assets/icon-CQwnqlEn.png" alt="" class="badge-icon" />
              <span>The Future of Value</span>
            </div>
            <h1>
              Zero-fee instant payments
              <span class="hero-highlight"> with Nano</span>
            </h1>
            <p class="muted">
              Experience the world's most efficient digital currency protocol.
            </p>
          </div>

          <div class="card auth-card glass-card auth-surface login-surface">
            <div class="brand-lockup auth-brand">
              <div class="brand-mark">
                <img src="/assets/icon-CQwnqlEn.png" alt="ChangeAIPay" class="brand-icon" />
              </div>
              <strong>ChangeAIPay</strong>
            </div>
            <h2 id="auth-title">Login</h2>

            <form id="auth-form" class="form-stack" novalidate>
              <div id="register-fields" style="display: none;">
                <input name="name" placeholder="Name" />
              </div>
              <input name="email" placeholder="Email" type="email" required />
              <input
                name="password"
                type="password"
                placeholder="Password"
                required
                minlength="8"
              />

              <div id="auth-error" class="status error" style="display: none;"></div>

              <button class="primary-button auth-cta" type="submit" id="auth-submit">
                Login
              </button>
            </form>

            <p class="switch-copy">
              <a id="switch-auth" href="#" class="ghost-link">
                Need an account? Register
              </a>
            </p>
          </div>
        </div>
        <section class="card glass-card auth-about-card">
          <span class="eyebrow">Instant, zero-fee payments using Nano</span>
          <h2>Save fees and settle instantly</h2>
          <p class="muted">
            Merchants can save up to 2�5% per transaction. Consumers avoid hidden fees. Savings may vary based on usage.
          </p>
          <div class="compare-grid">
            <div>
              <strong>Traditional payments</strong>
              <p>2�5% fees</p>
            </div>
            <div>
              <strong>Our system</strong>
              <p>0% fees</p>
            </div>
          </div>
        </section>

        <!-- Demo Video Section -->
        <section id="demo-section" class="demo-section demo-section-auth">
          <video id="demo-video" autoplay muted loop playsinline>
            <source src="/assets/demo.mp4" type="video/mp4">
            Your browser does not support the video tag.
          </video>
          <button id="mute-btn" class="video-control-btn mute-btn" aria-label="Toggle mute">?? Mute</button>
          <button id="sound-btn" class="video-control-btn sound-btn" aria-label="Toggle sound">?? Sound</button>
        </section>

        <section class="card glass-card auth-waitlist-card">
          <span class="eyebrow">Join the waitlist</span>
          <p class="muted">Submit your email to reserve early access and product updates.</p>
          <form id="waitlist-form" class="form-stack">
            <input
              id="waitlist-email"
              name="waitlistEmail"
              placeholder="Email"
              type="email"
              required
            />
            <button class="primary-button auth-cta" type="submit" id="waitlist-submit">
              Join waitlist
            </button>
          </form>
          <div id="waitlist-status" class="status" style="display: none;"></div>
        </section>
        <div class="auth-meta">Powered by Nano Protocol � Instant settlement � Zero-fee</div>
      </div>

      <!-- Dashboard Section -->
      <div id="dashboard-section" class="app-shell" style="display: none;">
        <header class="topbar glass-card">
          <div class="brand-lockup">
            <div class="brand-mark">
              <img src="/assets/icon-CQwnqlEn.png" alt="ChangeAIPay" class="brand-icon" />
            </div>
            <strong class="brand-title">ChangeAIPay</strong>
          </div>

          <nav class="topnav topnav-desktop">
            <a class="nav-link active" href="#dashboard" data-route="dashboard">
              Home
            </a>
            <a class="nav-link" href="#send" data-route="send">
              Send
            </a>
            <a class="nav-link" href="#receive" data-route="receive">
              Receive
            </a>
            <a class="nav-link" href="#history" data-route="history">
              History
            </a>
          </nav>

          <button class="ghost-button" id="logout-btn" type="button">
            Logout
          </button>

          <button
            class="hamburger-button"
            id="hamburger-btn"
            type="button"
            aria-label="Toggle menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </header>

        <!-- Mobile Navigation Menu -->
        <nav class="topnav topnav-mobile" id="mobile-menu" style="display: none;">
          <a
            class="nav-link"
            href="#dashboard"
            data-route="dashboard"
          >
            Home
          </a>
          <a
            class="nav-link"
            href="#send"
            data-route="send"
          >
            Send
          </a>
          <a
            class="nav-link"
            href="#receive"
            data-route="receive"
          >
            Receive
          </a>
          <a
            class="nav-link"
            href="#history"
            data-route="history"
          >
            History
          </a>
          <button
            class="nav-link logout-link"
            id="mobile-logout-btn"
            type="button"
          >
            Logout
          </button>
        </nav>

        <main class="page-shell">
          <!-- Dashboard Content -->
          <div id="dashboard-content">
            <header class="merchant-header card glass-card">
              <div>
                <span class="eyebrow">Merchant HQ</span>
                <h1 class="merchant-name" id="merchant-name">CyberNexus Systems</h1>
                <div class="wallet-chip">
                  <span>wallet</span>
                  <span class="mono" id="wallet-address">nano_3x...7u8</span>
                </div>
              </div>
              <div class="pill confirmed">Network: Live</div>
            </header>

            <section class="card hero-panel glass-card neon-sheen">
              <div class="section-heading">
                <div>
                  <span class="eyebrow">Current Treasury</span>
                  <h1>Dashboard</h1>
                </div>
                <div class="pill confirmed">Live</div>
              </div>

              <p class="muted">Balance and recent activity for your ChangeAIPay wallet. Scan QR to pay instantly.</p>
              <div class="summary-card">
                <span class="eyebrow">Current Treasury</span>
                <strong id="balance-amount">0.00 XNO</strong>
              </div>
              <div class="hero-actions">
                <a class="primary-button action-pill" href="#receive" data-route="receive">
                  Generate QR
                </a>
                <a class="ghost-button action-pill" href="#history" data-route="history">
                  History
                </a>
              </div>
            </section>

            <section class="receive-grid">
              <article class="card qr-card glass-card" id="receive-section">
                <div class="section-heading">
                  <div>
                    <span class="eyebrow">Receive</span>
                    <h2>Payment QR</h2>
                  </div>
                </div>

                <label class="field-label" for="receive-amount">
                  Enter Amount (XNO)
                </label>
                <input
                  id="receive-amount"
                  name="receive-amount"
                  placeholder="0.00"
                />

                <div id="qr-container">
                  <div class="empty-qr">
                    <p class="muted">Add amount to generate QR</p>
                  </div>
                </div>

                <div class="wallet-panel">
                  <span class="wallet-label">Wallet Address</span>
                  <code id="receive-wallet-address">Wallet not available</code>
                </div>
              </article>

              <article class="card glass-card market-card">
                <span class="eyebrow">History</span>
                <h2>Recent Flux</h2>
                <p class="muted">Ledger activity from your account.</p>
                <div class="market-bars">
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <div class="pill" id="transaction-count">0 entries</div>
              </article>
            </section>

            <section class="card glass-card" id="history-section">
              <div class="section-heading">
                <div>
                  <span class="eyebrow">History</span>
                  <h2>Transactions</h2>
                </div>
              </div>

              <div class="list-grid" id="transaction-list">
                <div class="empty-state">
                  No transactions yet � your payments will appear here.
                </div>
              </div>
            </section>

            <section class="card glass-card">
              <span class="eyebrow">Why choose ChangeAIPay</span>
              <h2>Instant, zero-fee payments using Nano</h2>
              <p class="muted">
                Merchants can save up to 2�5% per transaction. Consumers avoid hidden fees. Savings may vary based on usage.
              </p>
              <div class="compare-grid">
                <div class="compare-card">
                  <strong>Traditional payments</strong>
                  <p>2�5% fees</p>
                </div>
                <div class="compare-card highlight">
                  <strong>Our system</strong>
                  <p>0% fees</p>
                </div>
              </div>
              <div class="trust-list">
                <p>Powered by Nano network</p>
                <p>Instant settlement</p>
                <p>Transparent, no hidden fees</p>
              </div>
            </section>
          </div>

          <!-- Send Content -->
          <div id="send-content" style="display: none;">
            <section class="card form-card glass-card send-surface">
              <span class="eyebrow">Quick Transfer</span>
              <h1>Send Nano</h1>
              <p class="muted">Real-time transfer with zero-fee Nano settlement.</p>

              <form id="send-form">
                <input
                  id="send-recipient"
                  name="recipient"
                  placeholder="Recipient (email or Nano address)"
                  required
                />
                <input
                  id="send-amount"
                  name="amount"
                  placeholder="Amount (XNO)"
                  required
                />

                <div class="qr-scan-actions">
                  <button
                    type="button"
                    class="ghost-button"
                    id="scan-qr-btn"
                  >
                    Scan QR
                  </button>
                  <span class="muted">Use your camera to autofill a Nano address.</span>
                </div>

                <div class="qr-scanner-container" id="qr-scanner-container" style="display: none;">
                  <div id="qr-scanner"></div>
                  <button type="button" class="ghost-button" id="stop-scanner-btn">
                    Stop scanner
                  </button>
                </div>

                <div id="scan-error" class="status error" style="display: none;"></div>
                <div id="send-status" class="status" style="display: none;"></div>

                <div class="trust-note">Powered by Nano network � Instant settlement</div>

                <button class="primary-button" type="submit" id="send-submit">
                  Send
                </button>
              </form>
            </section>
          </div>
        </main>
      </div>
    </div>
    <script src="script.js"></script>
  </body>
</html>

