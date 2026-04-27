import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { submissionAPI } from "../api/client";

const STEPS = ["Personal", "Business", "Documents", "Review"];
const BIZ_TYPES = ["", "agency", "freelancer", "startup", "enterprise", "other"];
const BIZ_LABELS = { "": "Select type…", agency: "Agency", freelancer: "Freelancer", startup: "Startup", enterprise: "Enterprise", other: "Other" };
const DOC_TYPES = [
  { value: "pan", label: "PAN Card", icon: "🪪" },
  { value: "aadhaar", label: "Aadhaar Card", icon: "🆔" },
  { value: "bank_statement", label: "Bank Statement", icon: "🏦" },
];

export default function MerchantKYC() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [subId, setSubId] = useState(id || null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", business_name: "", business_type: "", monthly_volume_usd: "" });
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [status, setStatus] = useState("draft");
  const [reviewReason, setReviewReason] = useState("");

  useEffect(() => { if (id) load(id); }, [id]);

  const load = async (sid) => {
    try {
      const { data } = await submissionAPI.get(sid);
      setForm({ full_name: data.full_name||"", email: data.email||"", phone: data.phone||"", business_name: data.business_name||"", business_type: data.business_type||"", monthly_volume_usd: data.monthly_volume_usd||"" });
      setDocuments(data.documents || []);
      setStatus(data.status);
      setReviewReason(data.review_reason || "");
      setSubId(sid);
    } catch { showToast("Failed to load submission", "error"); }
  };

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };
  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  const saveDraft = async () => {
    setSaving(true);
    try {
      const p = {...form}; if (!p.monthly_volume_usd) delete p.monthly_volume_usd;
      if (subId) { await submissionAPI.update(subId, p); }
      else { const r = await submissionAPI.create(p); setSubId(r.data.id); window.history.replaceState(null, "", `/kyc/${r.data.id}`); }
      showToast("Draft saved!");
    } catch (e) { showToast(e.response?.data?.detail || "Save failed", "error"); }
    finally { setSaving(false); }
  };

  const handleNext = async () => { if (step < 3) { await saveDraft(); setStep(step + 1); } };
  const handleBack = () => { if (step > 0) setStep(step - 1); };

  const upload = async (docType, file) => {
    if (!subId) await saveDraft();
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("doc_type", docType);
      const { data } = await submissionAPI.uploadDocument(subId, fd);
      setDocuments(prev => [...prev.filter(d => d.doc_type !== docType), data]);
      showToast(`${docType.replace("_"," ")} uploaded!`);
    } catch (e) {
      const d = e.response?.data?.detail;
      showToast(typeof d === "string" ? d : d?.file ? [].concat(d.file).join(" ") : "Upload failed", "error");
    } finally { setUploading(false); }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try { await saveDraft(); await submissionAPI.submit(subId); showToast("KYC submitted!"); setTimeout(() => navigate("/dashboard"), 1200); }
    catch (e) { showToast(e.response?.data?.detail || "Submit failed", "error"); }
    finally { setSubmitting(false); }
  };

  const ro = !["draft","more_info_requested"].includes(status);

  return (
    <div className="page-container animate-fade-in-up" style={{ maxWidth: 720 }}>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      {/* Review banner */}
      {status === "more_info_requested" && reviewReason && (
        <div style={{ marginBottom: 24, padding: 18, borderRadius: 14, background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.2)" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#c4b5fd", marginBottom: 4 }}>Reviewer requested more information:</p>
          <p style={{ fontSize: 14, color: "#d8b4fe" }}>{reviewReason}</p>
        </div>
      )}

      {/* Stepper */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 36, padding: "0 8px" }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: i < 3 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div className={`step-circle ${i < step ? "completed" : i === step ? "active" : "upcoming"}`}
                onClick={() => !ro && i <= step && setStep(i)} style={{ cursor: i <= step && !ro ? "pointer" : "default" }}>
                {i < step ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, marginTop: 8, color: i <= step ? "#a5b4fc" : "#475569" }}>{s}</span>
            </div>
            {i < 3 && <div className="step-connector" style={{ background: i < step ? "#6366f1" : "rgba(51,65,85,0.4)", marginTop: -20 }} />}
          </div>
        ))}
      </div>

      {/* Form Card */}
      <div className="glass-card" style={{ padding: 36 }}>
        {step === 0 && (
          <div className="animate-slide-in">
            <SectionHeader title="Personal Details" subtitle="Tell us about yourself" />
            <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" placeholder="John Doe" value={form.full_name} onChange={e=>set("full_name",e.target.value)} disabled={ro} /></div>
            <div className="form-group"><label className="form-label">Email Address</label><input type="email" className="form-input" placeholder="john@example.com" value={form.email} onChange={e=>set("email",e.target.value)} disabled={ro} /></div>
            <div className="form-group"><label className="form-label">Phone Number</label><input className="form-input" placeholder="+91-9876543210" value={form.phone} onChange={e=>set("phone",e.target.value)} disabled={ro} /></div>
          </div>
        )}

        {step === 1 && (
          <div className="animate-slide-in">
            <SectionHeader title="Business Details" subtitle="Tell us about your business" />
            <div className="form-group"><label className="form-label">Business Name</label><input className="form-input" placeholder="Acme Corp" value={form.business_name} onChange={e=>set("business_name",e.target.value)} disabled={ro} /></div>
            <div className="form-group"><label className="form-label">Business Type</label>
              <select className="form-select" value={form.business_type} onChange={e=>set("business_type",e.target.value)} disabled={ro}>
                {BIZ_TYPES.map(v => <option key={v} value={v}>{BIZ_LABELS[v]}</option>)}
              </select></div>
            <div className="form-group"><label className="form-label">Expected Monthly Volume (USD)</label><input type="number" className="form-input" placeholder="5000" value={form.monthly_volume_usd} onChange={e=>set("monthly_volume_usd",e.target.value)} disabled={ro} /></div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-slide-in">
            <SectionHeader title="Document Upload" subtitle="PDF, JPG, PNG — max 5 MB each" />
            <div style={{ display: "grid", gap: 12 }}>
              {DOC_TYPES.map(doc => {
                const up = documents.find(d => d.doc_type === doc.value);
                return (
                  <DropzoneCard 
                    key={doc.value} 
                    doc={doc} 
                    up={up} 
                    ro={ro} 
                    uploading={uploading} 
                    onUpload={(file) => upload(doc.value, file)} 
                  />
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-slide-in">
            <SectionHeader title="Review & Submit" subtitle="Verify your details before submitting" />
            <ReviewSection title="Personal Details">
              <ReviewField label="Name" value={form.full_name} />
              <ReviewField label="Email" value={form.email} />
              <ReviewField label="Phone" value={form.phone} />
            </ReviewSection>
            <ReviewSection title="Business Details">
              <ReviewField label="Business" value={form.business_name} />
              <ReviewField label="Type" value={form.business_type} capitalize />
              <ReviewField label="Volume" value={form.monthly_volume_usd ? `$${form.monthly_volume_usd}/mo` : null} />
            </ReviewSection>
            <ReviewSection title={`Documents (${documents.length}/3)`}>
              {documents.length < 3 ? <p style={{ fontSize: 13, color: "#fca5a5" }}>Missing required documents ({documents.length}/3 uploaded)</p>
                : documents.map(d => <div key={d.id} style={{ fontSize: 13, color: "#6ee7b7", padding: "4px 0", textTransform: "capitalize" }}>✓ {d.doc_type.replace("_"," ")} — {d.original_filename}</div>)}
            </ReviewSection>
          </div>
        )}

        {/* Nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(51,65,85,0.4)" }}>
          <button onClick={handleBack} className="btn-outline" style={{ visibility: step === 0 ? "hidden" : "visible" }}>← Back</button>
          <div style={{ display: "flex", gap: 10 }}>
            {!ro && step < 3 && <button onClick={saveDraft} className="btn-outline" disabled={saving}>{saving ? <span className="spinner" style={{width:14,height:14}} /> : "Save Draft"}</button>}
            {step < 3 ? <button onClick={handleNext} className="btn-primary">Next →</button>
              : !ro ? <button onClick={handleSubmit} className="btn-success" disabled={submitting || documents.length < 3}>{submitting && <span className="spinner" style={{width:14,height:14}} />}Submit for Review</button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function DropzoneCard({ doc, up, ro, uploading, onUpload }) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!ro && !uploading) setIsDragOver(true);
  };
  
  const handleDragLeave = () => {
    setIsDragOver(false);
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (ro || uploading) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div 
      className={`doc-card ${up ? "uploaded" : ""}`}
      style={{ 
        borderColor: isDragOver ? "#818cf8" : undefined,
        background: isDragOver ? "rgba(99,102,241,0.08)" : undefined,
        borderStyle: isDragOver ? "dashed" : "solid",
        borderWidth: isDragOver ? "2px" : "1px",
        padding: isDragOver ? "17px" : "18px", // compensate for border width to avoid jitters
        transition: "all 0.2s ease"
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", pointerEvents: isDragOver ? "none" : "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 24 }}>{doc.icon}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "white" }}>{doc.label}</div>
            {up ? (
              <div style={{ fontSize: 12, color: "#6ee7b7", marginTop: 2 }}>✓ {up.original_filename} ({(up.file_size/1024).toFixed(1)} KB)</div>
            ) : (
              <div style={{ fontSize: 12, color: isDragOver ? "#818cf8" : "#64748b", marginTop: 2, fontWeight: isDragOver ? 600 : 400 }}>
                {isDragOver ? "Drop file here to upload..." : "Not uploaded yet — drag & drop supported"}
              </div>
            )}
          </div>
        </div>
        {!ro && (
          <label className="btn-outline" style={{ padding: "7px 16px", fontSize: 12, cursor: "pointer" }}>
            {uploading ? <span className="spinner" style={{width:14,height:14}} /> : up ? "Replace" : "Upload"}
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }}
              onChange={e => e.target.files[0] && onUpload(e.target.files[0])} disabled={uploading || ro} />
          </label>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "white" }}>{title}</h2>
      <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{subtitle}</p>
    </div>
  );
}

function ReviewSection({ title, children }) {
  return (
    <div style={{ padding: 20, borderRadius: 12, background: "rgba(31,41,55,0.4)", marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{children}</div>
    </div>
  );
}

function ReviewField({ label, value, capitalize }) {
  return (
    <div>
      <div className="info-field-label">{label}</div>
      <div className="info-field-value" style={capitalize ? { textTransform: "capitalize" } : {}}>{value || "—"}</div>
    </div>
  );
}
