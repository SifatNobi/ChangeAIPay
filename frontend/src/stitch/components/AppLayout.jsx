import { useState } from "react";
import { NavLink } from "react-router-dom";
import BrandMark from "./BrandMark";

export default function AppLayout({ profile, onLogout, children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="app-shell stitch-bg">
      <header className="topbar glass-card">
        <div className="brand-lockup">
          <BrandMark size={40} />
          <strong className="brand-title">ChangeAIPay</strong>
        </div>

        {/* Desktop Navigation */}
        <nav className="topnav topnav-desktop">
          <NavLink className="nav-link" to="/dashboard">
            Home
          </NavLink>
          <NavLink className="nav-link" to="/send">
            Send
          </NavLink>
          <a className="nav-link" href="#receive">
            Receive
          </a>
          <a className="nav-link" href="#history">
            History
          </a>
        </nav>

        <button className="ghost-button" onClick={onLogout} type="button">
          Logout
        </button>

        {/* Mobile Hamburger Button */}
        <button
          className={`hamburger-button ${mobileMenuOpen ? "active" : ""}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          type="button"
          aria-label="Toggle menu"
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <nav className="topnav topnav-mobile">
          <NavLink
            className="nav-link"
            to="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
          >
            Home
          </NavLink>
          <NavLink
            className="nav-link"
            to="/send"
            onClick={() => setMobileMenuOpen(false)}
          >
            Send
          </NavLink>
          <a
            className="nav-link"
            href="#receive"
            onClick={() => setMobileMenuOpen(false)}
          >
            Receive
          </a>
          <a
            className="nav-link"
            href="#history"
            onClick={() => setMobileMenuOpen(false)}
          >
            History
          </a>
          <button
            className="nav-link logout-link"
            onClick={() => {
              setMobileMenuOpen(false);
              onLogout();
            }}
            type="button"
          >
            Logout
          </button>
        </nav>
      )}

      <main className="page-shell">{children}</main>
    </div>
  );
}

