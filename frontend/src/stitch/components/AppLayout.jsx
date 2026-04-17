import { NavLink } from "react-router-dom";
import BrandMark from "./BrandMark";

export default function AppLayout({ profile, onLogout, children }) {
  return (
    <div className="app-shell stitch-bg">
      <header className="topbar glass-card">
        <div className="brand-lockup">
          <BrandMark size={40} />
          <strong className="brand-title">ChangeAIPay</strong>
        </div>

        <nav className="topnav">
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
      </header>

      <main className="page-shell">{children}</main>
    </div>
  );
}

