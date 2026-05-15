import { useState, useEffect } from "react";
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

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <div className="app-shell stitch-bg">
      <header className="topbar glass-card">
        <div className="brand-lockup">
          <BrandMark size={40} />
          <strong className="brand-title">ChangeAIPay</strong>
        </div>

        {/* Desktop Navigation */}
        <nav className="topnav topnav-desktop" aria-label="Main navigation">
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
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav"
        >
          <span />
          <span />
          <span />
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

      {/* Mobile Navigation Menu */}
      <nav
        id="mobile-nav"
        className={`topnav topnav-mobile ${mobileMenuOpen ? "open" : ""}`}
        role="navigation"
        aria-label="Mobile navigation"
        aria-hidden={!mobileMenuOpen}
      >
        <NavLink className="nav-link" to="/dashboard" onClick={closeMenu}>
          Home
        </NavLink>
        <NavLink className="nav-link" to="/send" onClick={closeMenu}>
          Send
        </NavLink>
        <a className="nav-link" href="#receive" onClick={closeMenu}>
          Receive
        </a>
        <a className="nav-link" href="#history" onClick={closeMenu}>
          History
        </a>
        <button
          className="nav-link logout-link"
          onClick={() => {
            closeMenu();
            onLogout();
          }}
          type="button"
        >
          Logout
        </button>
      </nav>

      <main className="page-shell">{children}</main>
    </div>
  );
}

