import { useState, useEffect } from "react";
import { COMPANY_LOGO } from "../../constants/branding";

export default function AdminDashboard({ token }) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalTransactions: 0,
    volume24h: "0"
  });
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setStats(data.stats || stats);
      setUsers(data.users || []);
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error("Failed to load admin data:", err);
    }
  };

  return (
    <div className="admin-dashboard stitch-bg">
      <header className="admin-header card glass-card">
        <div className="admin-brand">
          <img src={COMPANY_LOGO} alt="Admin" className="admin-avatar" />
          <div>
            <h1>Admin Dashboard</h1>
            <span className="admin-role">System Administrator</span>
          </div>
        </div>
        <div className="admin-actions">
          <button className="ghost-button">Settings</button>
          <button className="ghost-button">Logout</button>
        </div>
      </header>

      <section className="admin-stats">
        <div className="stat-card card glass-card">
          <span className="stat-label">Total Users</span>
          <strong className="stat-value">{stats.totalUsers}</strong>
        </div>
        <div className="stat-card card glass-card">
          <span className="stat-label">Active Users</span>
          <strong className="stat-value">{stats.activeUsers}</strong>
        </div>
        <div className="stat-card card glass-card">
          <span className="stat-label">Total Transactions</span>
          <strong className="stat-value">{stats.totalTransactions}</strong>
        </div>
        <div className="stat-card card glass-card">
          <span className="stat-label">24h Volume</span>
          <strong className="stat-value">{stats.volume24h} XNO</strong>
        </div>
      </section>

      <section className="admin-content">
        <div className="card glass-card admin-section">
          <h2>Recent Users</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td><span className={`status-badge ${user.status}`}>{user.status}</span></td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card glass-card admin-section">
          <h2>Recent Transactions</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Hash</th>
                <th>Amount</th>
                <th>From</th>
                <th>To</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id}>
                  <td className="mono">{tx.hash?.substring(0, 16)}...</td>
                  <td>{tx.amount} XNO</td>
                  <td className="mono">{tx.from?.substring(0, 12)}...</td>
                  <td className="mono">{tx.to?.substring(0, 12)}...</td>
                  <td><span className={`status-badge ${tx.status}`}>{tx.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}