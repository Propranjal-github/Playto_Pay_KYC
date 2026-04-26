import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { queueAPI } from "../api/client";
import StatusBadge from "../components/StatusBadge";

export default function SubmissionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [acting, setActing] = useState("");
  const [toast, setToast] = useState(null);

  useEffect(() => { load(); }, [id]);
  const load = async () => {
    try { setSub((await queueAPI.get(id)).data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const act = async (label, apiCall) => {
    setActing(label);
    try { const r = await apiCall; setSub(r.data); setReason(""); showToast(`${label} successfully!`); }
    catch (e) { showToast(e.response?.data?.detail || `Failed`, "error"); }
    finally { setActing(""); }
  };

  if (loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh"}}><div className="spinner" style={{width:36,height:36}} /></div>;
  if (!sub) return <div style={{textAlign:"center",padding:80}}><p style={{color:"#64748b"}}>Submission not found</p></div>;

  const can = sub.allowed_transitions?.length > 0;

  return (
    <div className="page-container animate-fade-in-up" style={{ maxWidth: 1000 }}>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => navigate("/reviewer")} className="btn-outline" style={{ padding: "8px 14px", fontSize: 12 }}>← Back</button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "white" }}>Submission #{sub.id}</h1>
            <p style={{ fontSize: 13, color: "#64748b" }}>by {sub.merchant_name} • {new Date(sub.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <StatusBadge status={sub.status} isAtRisk={sub.is_at_risk} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
        {/* Main */}
        <div style={{ display: "grid", gap: 20 }}>
          <InfoCard title="Personal Details">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <F label="Full Name" value={sub.full_name} />
              <F label="Email" value={sub.email} />
              <F label="Phone" value={sub.phone} />
            </div>
          </InfoCard>

          <InfoCard title="Business Details">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <F label="Business Name" value={sub.business_name} />
              <F label="Type" value={sub.business_type} cap />
              <F label="Monthly Volume" value={sub.monthly_volume_usd ? `$${Number(sub.monthly_volume_usd).toLocaleString()}` : null} />
            </div>
          </InfoCard>

          <InfoCard title={`Documents (${sub.documents?.length||0})`}>
            {(!sub.documents || sub.documents.length === 0)
              ? <p style={{ fontSize: 13, color: "#64748b" }}>No documents uploaded</p>
              : <div style={{ display: "grid", gap: 10 }}>
                  {sub.documents.map(doc => (
                    <div key={doc.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: 14, borderRadius: 10, background: "rgba(31,41,55,0.4)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: 10,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 800,
                          background: doc.mime_type === "application/pdf" ? "rgba(239,68,68,0.1)" : "rgba(6,182,212,0.1)",
                          color: doc.mime_type === "application/pdf" ? "#fca5a5" : "#67e8f9",
                        }}>{doc.mime_type === "application/pdf" ? "PDF" : "IMG"}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "white" }}>{doc.doc_type.replace("_"," ").toUpperCase()}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{doc.original_filename} • {(doc.file_size/1024).toFixed(1)} KB</div>
                        </div>
                      </div>
                      {doc.file_url && <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="btn-outline" style={{ padding: "5px 12px", fontSize: 11 }}>View</a>}
                    </div>
                  ))}
                </div>
            }
          </InfoCard>
        </div>

        {/* Sidebar */}
        <div style={{ display: "grid", gap: 20 }}>
          <InfoCard title="Timeline">
            <div style={{ display: "grid", gap: 14, fontSize: 13 }}>
              <Row label="Created" value={new Date(sub.created_at).toLocaleDateString()} />
              {sub.submitted_at && <Row label="Submitted" value={new Date(sub.submitted_at).toLocaleString()} />}
              {sub.hours_in_queue > 0 && <Row label="In Queue" value={`${Math.round(sub.hours_in_queue)}h`} warn={sub.is_at_risk} />}
              {sub.review_reason && (
                <div style={{ paddingTop: 12, borderTop: "1px solid rgba(51,65,85,0.4)" }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>LAST REVIEW NOTE</div>
                  <p style={{ fontSize: 13, color: "#e2e8f0" }}>{sub.review_reason}</p>
                </div>
              )}
            </div>
          </InfoCard>

          {can && (
            <InfoCard title="Actions">
              <div className="form-group">
                <label className="form-label">Reason / Note</label>
                <textarea className="form-input" rows={3} placeholder="Optional reason…" value={reason}
                  onChange={e => setReason(e.target.value)} style={{ resize: "vertical", fontFamily: "inherit" }} />
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {sub.status === "submitted" && (
                  <button className="btn-primary" style={{ width: "100%" }} disabled={!!acting}
                    onClick={() => act("Started review", queueAPI.startReview(id))}>
                    {acting === "Started review" && <span className="spinner" style={{width:14,height:14}} />}Start Review
                  </button>
                )}
                {sub.status === "under_review" && <>
                  <button className="btn-success" style={{ width: "100%" }} disabled={!!acting}
                    onClick={() => act("Approved", queueAPI.approve(id, reason))}>
                    {acting === "Approved" && <span className="spinner" style={{width:14,height:14}} />}Approve
                  </button>
                  <button className="btn-danger" style={{ width: "100%" }} disabled={!!acting}
                    onClick={() => act("Rejected", queueAPI.reject(id, reason))}>
                    {acting === "Rejected" && <span className="spinner" style={{width:14,height:14}} />}Reject
                  </button>
                  <button className="btn-warning" style={{ width: "100%" }} disabled={!!acting}
                    onClick={() => act("Requested info", queueAPI.requestInfo(id, reason))}>
                    {acting === "Requested info" && <span className="spinner" style={{width:14,height:14}} />}Request More Info
                  </button>
                </>}
              </div>
            </InfoCard>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ title, children }) {
  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 18 }}>{title}</div>
      {children}
    </div>
  );
}

function F({ label, value, cap }) {
  return <div><div className="info-field-label">{label}</div><div className="info-field-value" style={cap?{textTransform:"capitalize"}:{}}>{value||"—"}</div></div>;
}

function Row({ label, value, warn }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ fontWeight: 600, color: warn ? "#fca5a5" : "#e2e8f0" }}>{value}</span>
    </div>
  );
}
