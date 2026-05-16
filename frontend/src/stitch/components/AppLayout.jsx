import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import BrandMark from "./BrandMark";

export default function AppLayout({ profile, onLogout, children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        closeMenu();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [mobileMenuOpen]);

  const closeMenu = () => setMobileMenuOpen(false);

  const handleGoals = () => {
    closeMenu();
    window.dispatchEvent(new CustomEvent("open-goals"));
  };

  const handleAIInsights = () => {
    closeMenu();
    window.dispatchEvent(new CustomEvent("open-ai-assistant"));
  };

  return (
    <div className="app-shell stitch-bg">
      <header className="topbar glass-card">
        <div className="brand-lockup">
          <BrandMark size={40} />
          <strong className="brand-title">ChangeAIPay</strong>
        </div>

        {/* Hamburger Button - Right Side */}
        <button
          className={`hamburger-button ${mobileMenuOpen ? "active" : ""}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          type="button"
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav"
        >
          <span className="hamburger-inner">
            <span />
            <span />
            <span />
          </span>
        </button>
      </header>

      {/* Dark Overlay */}
      {mobileMenuOpen && (
        <div
          className="mobile-overlay"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      {/* Right-Side Navigation Drawer */}
      <nav
        id="mobile-nav"
        className={`topnav topnav-mobile ${mobileMenuOpen ? "open" : ""}`}
        role="navigation"
        aria-label="Mobile navigation"
        aria-hidden={!mobileMenuOpen}
      >
        <div className="drawer-header">
          <span className="drawer-title">Menu</span>
          <button className="drawer-close" onClick={(e) => { e.stopPropagation(); closeMenu(); }} aria-label="Close menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <NavLink className="nav-link" to="/dashboard" onClick={closeMenu}>
          <span className="nav-icon">🏠</span> Home
        </NavLink>
        <NavLink className="nav-link" to="/send" onClick={closeMenu}>
          <span className="nav-icon">📤</span> Send
        </NavLink>
        <NavLink className="nav-link" to="/receive" onClick={closeMenu}>
          <span className="nav-icon">📥</span> Receive
        </NavLink>
        <NavLink className="nav-link" to="/history" onClick={closeMenu}>
          <span className="nav-icon">📋</span> History
        </NavLink>
        <NavLink className="nav-link" to="/pricing" onClick={closeMenu}>
          <span className="nav-icon">💎</span> Pricing
        </NavLink>
        <button
          className="nav-link nav-link-action"
          onClick={(e) => {
            e.preventDefault();
            handleAIInsights();
          }}
          type="button"
        >
          <span className="nav-icon">🤖</span> AI Insights
        </button>
        <button
          className="nav-link nav-link-action"
          onClick={(e) => {
            e.preventDefault();
            handleGoals();
          }}
          type="button"
        >
          <span className="nav-icon">🎯</span> Goals
        </button>
        <div className="drawer-divider" />
        <button
          className="nav-link logout-link"
          onClick={() => {
            closeMenu();
            onLogout();
          }}
          type="button"
        >
          <span className="nav-icon">🚪</span> Logout
        </button>
      </nav>

      <main className="page-shell">{children}</main>
    </div>
  );
}

