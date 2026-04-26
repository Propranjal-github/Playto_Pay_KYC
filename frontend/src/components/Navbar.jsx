import { Link, useLocation } from "react-router-dom";

export default function Navbar({ user, onLogout }) {
  const location = useLocation();
  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "rgba(10, 14, 26, 0.85)",
      backdropFilter: "blur(16px) saturate(180%)",
      borderBottom: "1px solid rgba(71, 85, 105, 0.3)",
    }}>
      <div style={{
        maxWidth: 1200, margin: "0 auto", padding: "0 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 64,
      }}>
        {/* Logo */}
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg, #6366f1, #06b6d4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, color: "white", fontSize: 15,
          }}>P</div>
          <span style={{ fontWeight: 700, color: "white", fontSize: 18, letterSpacing: "-0.02em" }}>
            Playto<span style={{ color: "#818cf8" }}>Pay</span>
          </span>
        </Link>

        {/* Nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {user.role === "merchant" && (
            <>
              <NavLink to="/dashboard" active={isActive("/dashboard")}>My Submissions</NavLink>
              <NavLink to="/kyc" active={isActive("/kyc")}>New KYC</NavLink>
            </>
          )}
          {user.role === "reviewer" && (
            <NavLink to="/reviewer" active={isActive("/reviewer")}>Review Queue</NavLink>
          )}

          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            marginLeft: 16, paddingLeft: 20,
            borderLeft: "1px solid rgba(71, 85, 105, 0.5)",
          }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "white" }}>{user.username}</div>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "capitalize" }}>{user.role}</div>
            </div>
            <button onClick={onLogout} className="btn-outline" style={{ padding: "7px 14px", fontSize: 12 }}>
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function NavLink({ to, active, children }) {
  return (
    <Link
      to={to}
      style={{
        padding: "8px 16px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        color: active ? "#a5b4fc" : "#94a3b8",
        background: active ? "rgba(99, 102, 241, 0.08)" : "transparent",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        if (!active) e.target.style.color = "#e2e8f0";
      }}
      onMouseLeave={(e) => {
        if (!active) e.target.style.color = "#94a3b8";
      }}
    >
      {children}
    </Link>
  );
}
