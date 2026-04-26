import { useState } from "react";
import { authAPI } from "../api/client";

export default function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", role: "merchant" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = isRegister
        ? await authAPI.register(form)
        : await authAPI.login({ username: form.username, password: form.password });
      localStorage.setItem("token", res.data.token);
      onLogin(res.data.user);
    } catch (err) {
      const d = err.response?.data?.detail;
      setError(typeof d === "string" ? d : typeof d === "object" ? Object.values(d).flat().join(" ") : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "92vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="animate-fade-in-up" style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px",
            background: "linear-gradient(135deg, #6366f1, #06b6d4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, color: "white", fontSize: 24,
            boxShadow: "0 8px 32px rgba(99, 102, 241, 0.3)",
          }}>P</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "white", letterSpacing: "-0.03em" }}>
            Playto<span style={{ color: "#818cf8" }}>Pay</span> KYC
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", marginTop: 6 }}>
            {isRegister ? "Create your account to get started" : "Sign in to your account"}
          </p>
        </div>

        {/* Form */}
        <div className="glass-card" style={{ padding: 32 }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-user">Username</label>
              <input id="login-user" className="form-input" placeholder="Enter username"
                value={form.username} onChange={e => setForm({...form, username: e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="login-pass">Password</label>
              <input id="login-pass" type="password" className="form-input" placeholder="Enter password"
                value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
            </div>
            {isRegister && (
              <div className="form-group animate-fade-in">
                <label className="form-label" htmlFor="login-role">Role</label>
                <select id="login-role" className="form-select"
                  value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  <option value="merchant">Merchant</option>
                  <option value="reviewer">Reviewer</option>
                </select>
              </div>
            )}
            {error && (
              <div className="animate-fade-in" style={{
                fontSize: 13, padding: 14, borderRadius: 10, marginBottom: 20,
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5",
              }}>{error}</div>
            )}
            <button type="submit" className="btn-primary" disabled={loading}
              style={{ width: "100%", padding: 14, fontSize: 15 }}>
              {loading && <span className="spinner" />}
              {isRegister ? "Create Account" : "Sign In"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button type="button" onClick={() => { setIsRegister(!isRegister); setError(""); }}
              style={{ fontSize: 13, color: "#818cf8", background: "none", border: "none", cursor: "pointer" }}>
              {isRegister ? "Already have an account? Sign in" : "Don't have an account? Register"}
            </button>
          </div>
        </div>

        {/* Test creds */}
        <div className="glass-card" style={{ padding: 20, marginTop: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Demo Credentials
          </p>
          <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
            {[
              ["Merchant", "merchant_alice / alice123"],
              ["Merchant", "merchant_bob / bob12345"],
              ["Reviewer", "reviewer_charlie / charlie123"],
            ].map(([role, cred], i) => (
              <div key={i} style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#64748b", minWidth: 64 }}>{role}:</span>
                <span style={{ color: "#94a3b8", fontFamily: "monospace" }}>{cred}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
