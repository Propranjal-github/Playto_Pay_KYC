import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { submissionAPI } from "../api/client";
import StatusBadge from "../components/StatusBadge";

export default function MerchantDashboard() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSubmissions(); }, []);
  const loadSubmissions = async () => {
    try { setSubmissions((await submissionAPI.list()).data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return <Loader />;

  return (
    <div className="page-container animate-fade-in-up">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Submissions</h1>
          <p className="page-subtitle">Track and manage your KYC applications</p>
        </div>
        <Link to="/kyc" className="btn-primary" style={{ fontSize: 14 }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" d="M12 4v16m8-8H4"/>
          </svg>
          New Application
        </Link>
      </div>

      {submissions.length === 0 ? (
        <div className="glass-card" style={{ padding: "64px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.6 }}>📋</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "white", marginBottom: 8 }}>No submissions yet</h3>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 24, maxWidth: 320, margin: "0 auto 24px" }}>
            Start your KYC application to begin collecting payments with PlaytoPay.
          </p>
          <Link to="/kyc" className="btn-primary">Start KYC Application</Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {submissions.map((sub, i) => (
            <Link key={sub.id} to={`/kyc/${sub.id}`}
              className="glass-card animate-fade-in-up"
              style={{ display: "block", padding: "20px 24px", animationDelay: `${i * 0.05}s` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#a5b4fc", fontWeight: 800, fontSize: 13,
                  }}>#{sub.id}</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "white" }}>
                      {sub.business_name || "Untitled Application"}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      {sub.full_name || "No name"} • {new Date(sub.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <StatusBadge status={sub.status} />
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#475569" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                  </svg>
                </div>
              </div>
              {sub.status === "more_info_requested" && (
                <div style={{
                  marginTop: 12, padding: 12, borderRadius: 10, fontSize: 12,
                  background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)", color: "#c4b5fd",
                }}>
                  ⚠️ Reviewer has requested more information. Click to update your submission.
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Loader() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  );
}
