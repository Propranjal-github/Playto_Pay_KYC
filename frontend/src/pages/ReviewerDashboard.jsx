import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { queueAPI } from "../api/client";
import StatusBadge from "../components/StatusBadge";

export default function ReviewerDashboard() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => { loadData(); }, [filter]);

  const loadData = async () => {
    try {
      const [q, m] = await Promise.all([queueAPI.list(filter || undefined), queueAPI.metrics()]);
      setSubmissions(q.data); setMetrics(m.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fmtH = (h) => { if (!h || h < 1) return "< 1h"; if (h < 24) return `${Math.round(h)}h`; return `${Math.floor(h/24)}d ${Math.round(h%24)}h`; };

  if (loading) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"60vh" }}><div className="spinner" style={{width:36,height:36}} /></div>;

  return (
    <div className="page-container animate-fade-in-up">
      <div className="page-header">
        <div>
          <h1 className="page-title">Review Queue</h1>
          <p className="page-subtitle">Monitor and process KYC applications</p>
        </div>
      </div>

      {/* Metrics */}
      {metrics && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
          {[
            { label: "In Queue", value: metrics.submissions_in_queue, color: "indigo", icon: "📥" },
            { label: "Avg Wait", value: fmtH(metrics.avg_time_in_queue_hours), color: "amber", icon: "⏱️" },
            { label: "Approval Rate (7d)", value: `${metrics.approval_rate_7d}%`, color: "emerald", icon: "✅" },
            { label: "Under Review", value: metrics.under_review, color: "cyan", icon: "🔍" },
          ].map((m, i) => (
            <div key={m.label} className={`metric-card animate-fade-in-up stagger-${i+1}`} data-color={m.color}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>{m.label}</span>
                <span style={{ fontSize: 20 }}>{m.icon}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "white", letterSpacing: "-0.02em" }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {[
          { v: "", l: "All" }, { v: "submitted", l: "Submitted" }, { v: "under_review", l: "Under Review" },
          { v: "approved", l: "Approved" }, { v: "rejected", l: "Rejected" },
        ].map(f => (
          <button key={f.v} className={`filter-pill ${filter === f.v ? "active" : ""}`} onClick={() => setFilter(f.v)}>
            {f.l}
          </button>
        ))}
      </div>

      {/* Table */}
      {submissions.length === 0 ? (
        <div className="glass-card" style={{ padding: "64px 32px", textAlign: "center" }}>
          <p style={{ color: "#64748b" }}>No submissions match this filter</p>
        </div>
      ) : (
        <div className="glass-card" style={{ overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th><th>Merchant</th><th>Business</th><th>Status</th><th>In Queue</th><th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map(sub => (
                <tr key={sub.id} onClick={() => navigate(`/reviewer/submission/${sub.id}`)}>
                  <td style={{ fontWeight: 700, color: "#a5b4fc" }}>#{sub.id}</td>
                  <td style={{ fontWeight: 600, color: "white" }}>{sub.merchant_name}</td>
                  <td>{sub.business_name || "—"}</td>
                  <td><StatusBadge status={sub.status} isAtRisk={sub.is_at_risk} /></td>
                  <td>{sub.hours_in_queue ? fmtH(sub.hours_in_queue) : "—"}</td>
                  <td style={{ fontSize: 13 }}>{sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
