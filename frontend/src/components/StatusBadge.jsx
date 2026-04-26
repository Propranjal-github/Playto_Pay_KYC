const STATUS_CONFIG = {
  draft:               { label: "Draft",           bg: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.30)", text: "#94a3b8" },
  submitted:           { label: "Submitted",       bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.30)",  text: "#a5b4fc" },
  under_review:        { label: "Under Review",    bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.30)",  text: "#fbbf24" },
  approved:            { label: "Approved",        bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.30)",  text: "#6ee7b7" },
  rejected:            { label: "Rejected",        bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.30)",   text: "#fca5a5" },
  more_info_requested: { label: "More Info Needed", bg: "rgba(168,85,247,0.12)",  border: "rgba(168,85,247,0.30)",  text: "#c4b5fd" },
};

export default function StatusBadge({ status, isAtRisk }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span className="status-badge" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
        {c.label}
      </span>
      {isAtRisk && <span className="at-risk-badge">SLA AT RISK</span>}
    </div>
  );
}
