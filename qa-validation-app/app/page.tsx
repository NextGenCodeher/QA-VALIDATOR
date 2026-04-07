"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { LayoutDashboard, Package, Download, Upload, FlaskConical, Plus, BrainCircuit, FolderOpen, AlertTriangle, FileText, Search, Play, Box, Check, Save, CheckCircle, XCircle, Info, ChevronLeft, ChevronRight } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Session {
  id: string;
  name: string;
  filename: string;
  total_questions: number;
  validated_count: number;
  avg_score: number | null;
  created_at: string;
  updated_at: string;
}

interface QAPair {
  id: string;
  session_id: string;
  question: string;
  answer: string;
  row_index: number;
  validation_id: string | null;
  validation_score: number | null;
  comments: string | null;
  validated_at: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Progress {
  validated: number;
  total: number;
}

interface Toast {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface ExportRecord {
  id: string;
  session_id: string;
  session_name: string;
  filename: string;
  filepath: string;
  total_rows: number;
  validated_rows: number;
  exported_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────
function scoreColor(score: number | null): string {
  if (score === null) return "var(--text-muted)";
  if (score < 40) return "var(--score-low)";
  if (score < 70) return "var(--score-mid)";
  return "var(--score-high)";
}

function scoreLabel(score: number | null): string {
  if (score === null) return "Not Rated";
  if (score < 40) return "Low";
  if (score < 70) return "Moderate";
  return "High";
}

function scoreClass(score: number | null): string {
  if (score === null) return "score-pending";
  if (score < 40) return "score-low";
  if (score < 70) return "score-mid";
  return "score-high";
}

function sliderFillColor(score: number): string {
  if (score < 40) return "linear-gradient(90deg, #ef4444, #f97316)";
  if (score < 70) return "linear-gradient(90deg, #f97316, #f59e0b)";
  return "linear-gradient(90deg, #22c55e, #16a34a)";
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function pct(a: number, b: number): number {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast system
// ─────────────────────────────────────────────────────────────────────────────
const TOAST_DURATION = 3500;

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => onRemove(t.id)}>
          <span className="toast-icon flex items-center justify-center">
            {t.type === "success" ? <CheckCircle size={16} /> : t.type === "error" ? <XCircle size={16} /> : <Info size={16} />}
          </span>
          <span className="toast-message">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload Modal
// ─────────────────────────────────────────────────────────────────────────────
function UploadModal({
  onClose,
  onSuccess,
  addToast,
}: {
  onClose: () => void;
  onSuccess: (session: Session) => void;
  addToast: (t: Omit<Toast, "id">) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sessionName, setSessionName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file");
      return;
    }
    setFile(f);
    setSessionName(f.name.replace(/\.csv$/i, ""));
    setError("");
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("sessionName", sessionName || file.name.replace(/\.csv$/i, ""));

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Upload failed");
      addToast({ type: "success", message: `Uploaded "${data.session.name}" (${data.session.total_questions} rows)` });
      onSuccess(data.session);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setError(msg);
      addToast({ type: "error", message: msg });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title flex items-center gap-2"><Upload size={18} className="text-accent" /> Upload CSV Dataset</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div
            className={`dropzone ${dragOver ? "drag-over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files[0]);
            }}
          >
            <input
              type="file"
              accept=".csv"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
              id="file-input"
            />
            <span className="dropzone-icon flex justify-center">{file ? <FileText size={48} strokeWidth={1.5} style={{ color: "var(--success)" }} /> : <FolderOpen size={48} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />}</span>
            <p className="dropzone-title">
              {file ? file.name : "Drop your CSV file here"}
            </p>
            <p className="dropzone-sub">
              {file
                ? `${(file.size / 1024).toFixed(1)} KB — Click to change`
                : "or click to browse — CSV with Question & Answer columns"}
            </p>
          </div>

          {file && (
            <div className="form-group mt-4">
              <label className="form-label" htmlFor="session-name">Session Name</label>
              <input
                id="session-name"
                type="text"
                className="form-input"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="e.g. Medical Q&A Batch 1"
              />
            </div>
          )}

          {error && (
            <div style={{
              background: "var(--danger-bg)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "var(--radius-sm)",
              padding: "12px 14px",
              fontSize: "13px",
              color: "var(--danger)",
              marginTop: "12px",
            }}>
              <div className="flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>
            </div>
          )}

          <div style={{
            background: "var(--bg-elevated)",
            borderRadius: "var(--radius-sm)",
            padding: "12px 14px",
            marginTop: "14px",
            fontSize: "12px",
            color: "var(--text-muted)",
          }}>
            <strong style={{ color: "var(--text-secondary)" }}>Required CSV columns:</strong>
            {" "}<code style={{ color: "var(--accent-light)" }}>Question</code>
            {" "}and{" "}
            <code style={{ color: "var(--info)" }}>Answer</code>
            {" "}(column names are auto-detected)
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={uploading}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={!file || uploading}
            id="upload-submit-btn"
          >
            {uploading ? (
              <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Uploading…</>
            ) : (
              <><Play size={16} /> Upload & Parse</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QA Card Component
// ─────────────────────────────────────────────────────────────────────────────
function QACard({
  pair,
  index,
  onSave,
  saving,
}: {
  pair: QAPair;
  index: number;
  onSave: (pairId: string, score: number, comments: string) => void;
  saving: boolean;
}) {
  const [score, setScore] = useState(pair.validation_score ?? 50);
  const [comments, setComments] = useState(pair.comments ?? "");
  const [isDirty, setIsDirty] = useState(false);
  const [localSaved, setLocalSaved] = useState(false);

  // Sync if pair changes (e.g. navigation)
  useEffect(() => {
    setScore(pair.validation_score ?? 50);
    setComments(pair.comments ?? "");
    setIsDirty(false);
    setLocalSaved(false);
  }, [pair.id, pair.validation_score, pair.comments]);

  const isValidated = pair.validation_score !== null;
  const isLow = isValidated && pair.validation_score! < 40;

  const handleScoreChange = (val: number) => {
    setScore(val);
    setIsDirty(true);
    setLocalSaved(false);
  };

  const handleSave = async () => {
    await onSave(pair.id, score, comments);
    setIsDirty(false);
    setLocalSaved(true);
  };

  const fillPct = score;
  const cardClass = `qa-card ${isValidated ? "validated" : ""} ${isLow ? "low-confidence" : ""}`;

  return (
    <div className={cardClass} id={`qa-card-${pair.id}`}>
      {/* Card Header */}
      <div className="qa-card-header">
        <div className="qa-index">#{index + 1}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          {isLow && (
            <span className="badge badge-danger flex items-center gap-1" title="Low confidence score">
              <AlertTriangle size={12} /> Low Confidence
            </span>
          )}
          {(localSaved || (isValidated && !isDirty)) && !isDirty && (
            <div className="saving-indicator">
              <div className="save-dot" />
              <span>Saved</span>
            </div>
          )}
          {isDirty && (
            <span className="badge badge-warning">Unsaved changes</span>
          )}
        </div>
        <span className={`qa-score-badge ${scoreClass(isValidated ? pair.validation_score : null)}`}>
          {isValidated && !isDirty ? `${pair.validation_score} / 100` : isDirty ? `${score} / 100` : "—"}
        </span>
      </div>

      {/* Q&A Content */}
      <div className="qa-content">
        <div className="qa-field">
          <div className="qa-field-label">
            <span className="label-dot label-dot-question" />
            Question
          </div>
          <div className="qa-field-text">{pair.question || <em style={{ color: "var(--text-muted)" }}>Empty</em>}</div>
        </div>
        <div className="qa-field">
          <div className="qa-field-label">
            <span className="label-dot label-dot-answer" />
            Generated Answer
          </div>
          <div className="qa-field-text">{pair.answer || <em style={{ color: "var(--text-muted)" }}>Empty</em>}</div>
        </div>
      </div>

      {/* Slider */}
      <div className="slider-section">
        <div className="slider-header">
          <span className="slider-label">Validation Score</span>
          <span className="slider-value-display" style={{ color: scoreColor(score) }}>
            {score}
          </span>
        </div>
        <div className="slider-wrap">
          <div className="slider-track">
            <div
              className="slider-fill"
              style={{
                width: `${fillPct}%`,
                background: sliderFillColor(score),
              }}
            />
          </div>
          <input
            type="range"
            id={`slider-${pair.id}`}
            className="score-slider"
            min={0}
            max={100}
            value={score}
            onChange={(e) => handleScoreChange(Number(e.target.value))}
            style={{ marginTop: "-13px" }}
          />
          <div className="slider-markers">
            <span className="slider-marker" style={{ color: "var(--score-low)" }}>0 Incorrect</span>
            <span className="slider-marker">50 Partial</span>
            <span className="slider-marker" style={{ color: "var(--score-high)" }}>100 Correct</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {[0, 25, 50, 75, 100].map((v) => (
            <button
              key={v}
              className={`btn btn-sm ${score === v ? "btn-primary" : "btn-ghost"}`}
              style={{ flex: 1, padding: "6px 4px", fontSize: "12px" }}
              onClick={() => handleScoreChange(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Comments */}
      <div className="comments-section">
        <label className="form-label" htmlFor={`comments-${pair.id}`}>Expert Comments (optional)</label>
        <textarea
          id={`comments-${pair.id}`}
          className="comments-textarea"
          value={comments}
          onChange={(e) => { setComments(e.target.value); setIsDirty(true); setLocalSaved(false); }}
          placeholder="Add notes about this answer's accuracy, issues, or context…"
          rows={2}
        />
      </div>

      {/* Action Bar */}
      <div className="action-bar">
        <div style={{ flex: 1 }}>
          {pair.validated_at && !isDirty && (
            <span className="text-sm text-muted">
              Last validated: {formatDate(pair.validated_at)}
            </span>
          )}
          {isDirty && (
            <span className="text-sm" style={{ color: "var(--warning)" }}>
              ● {scoreLabel(score)} confidence — {score}/100
            </span>
          )}
        </div>
        <button
          className={`btn ${isDirty || !isValidated ? "btn-primary" : "btn-secondary"}`}
          onClick={handleSave}
          disabled={saving}
          id={`save-btn-${pair.id}`}
        >
          {saving ? (
            <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Saving…</>
          ) : isValidated && !isDirty ? (
            <><Check size={14} /> Update Score</>
          ) : (
            <><Save size={14} /> Save Validation</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports Page
// ─────────────────────────────────────────────────────────────────────────────
function ExportsPage({ addToast }: { addToast: (t: Omit<Toast, "id">) => void }) {
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/export?list=1");
        const data = await res.json();
        if (res.ok) setExports(data.exports || []);
      } catch {
        addToast({ type: "error", message: "Failed to load exports" });
      } finally {
        setLoading(false);
      }
    })();
  }, [addToast]);

  const handleReDownload = async (exp: ExportRecord) => {
    setDownloading(exp.id);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: exp.filename }),
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = exp.filename;
      a.click();
      URL.revokeObjectURL(url);
      addToast({ type: "success", message: `Re-downloaded "${exp.filename}"` });
    } catch {
      addToast({ type: "error", message: "Re-download failed — file may have been deleted" });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title flex items-center gap-2"><Package size={20} className="text-accent" /> Exported Files</h1>
            <p className="page-sub">
              All exports are saved to the <code style={{ color: "var(--accent-light)", fontSize: 12 }}>qa-validation-app/exports/</code> folder on disk
            </p>
          </div>
          <span className="badge badge-default">{exports.length} exports</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title flex items-center gap-2"><FileText size={16} /> Export History</h2>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="flex items-center justify-center" style={{ padding: "40px 0" }}>
              <div className="spinner" />
            </div>
          ) : exports.length === 0 ? (
            <div className="empty-state" style={{ textAlign: "center", padding: "40px 20px" }}>
              <div className="empty-icon text-muted flex justify-center mb-4"><Package size={48} strokeWidth={1.5} /></div>
              <h3 className="empty-title font-semibold text-lg mb-2">No exports yet</h3>
              <p className="empty-sub">When you export a session, a copy is saved here and on disk so you can always find it.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Session", "Filename", "Rows", "Validated", "Exported At", ""].map((h) => (
                      <th key={h} style={{
                        padding: "12px 20px",
                        textAlign: "left",
                        fontSize: "11px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.7px",
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {exports.map((exp) => (
                    <tr key={exp.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "14px" }}>{exp.session_name}</div>
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <span className="text-sm text-muted font-mono" style={{ wordBreak: "break-all" }}>{exp.filename}</span>
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{exp.total_rows}</span>
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <span className="badge" style={{
                          background: exp.validated_rows === exp.total_rows ? "var(--success-bg)" : "var(--warning-bg)",
                          color: exp.validated_rows === exp.total_rows ? "var(--success)" : "var(--warning)",
                        }}>
                          {exp.validated_rows}/{exp.total_rows}
                        </span>
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <span className="text-sm text-muted">{formatDate(exp.exported_at)}</span>
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => handleReDownload(exp)}
                          disabled={downloading === exp.id}
                          id={`redownload-${exp.id}`}
                        >
                          {downloading === exp.id ? (
                            <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Downloading…</>
                          ) : <><Download size={14} /> Re-download</>}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {exports.length > 0 && (
        <div style={{
          marginTop: 16,
          padding: "12px 16px",
          background: "var(--bg-elevated)",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
          fontSize: 12,
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <FolderOpen size={16} />
          <span>Files are saved on disk at: <code style={{ color: "var(--accent-light)" }}>qa-validation-app\exports\</code></span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation Page
// ─────────────────────────────────────────────────────────────────────────────
function ValidationPage({
  session,
  addToast,
  onBack,
}: {
  session: Session;
  addToast: (t: Omit<Toast, "id">) => void;
  onBack: () => void;
}) {
  const [pairs, setPairs] = useState<QAPair[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [progress, setProgress] = useState<Progress>({ validated: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "validated" | "pending" | "low">("all");
  const [exporting, setExporting] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const fetchPairs = useCallback(
    async (page = 1, f = filter) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/qa?session_id=${session.id}&page=${page}&limit=10&filter=${f}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setPairs(data.pairs);
        setPagination(data.pagination);
        setProgress(data.progress);
      } catch {
        addToast({ type: "error", message: "Failed to load Q&A pairs" });
      } finally {
        setLoading(false);
      }
    },
    [session.id, filter, addToast]
  );

  useEffect(() => {
    fetchPairs(1, filter);
    setCurrentPage(1);
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchPairs(currentPage, filter);
  }, [currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (pairId: string, score: number, comments: string) => {
    setSavingId(pairId);
    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qa_pair_id: pairId,
          session_id: session.id,
          validation_score: score,
          comments,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      addToast({ type: "success", message: `Score ${score}/100 saved ✓` });

      // Update local state
      setPairs((prev) =>
        prev.map((p) =>
          p.id === pairId
            ? { ...p, validation_score: score, comments, validated_at: data.validation?.validated_at || new Date().toISOString() }
            : p
        )
      );
      setProgress((prev) => {
        const wasValidated = pairs.find((p) => p.id === pairId)?.validation_score !== null;
        return { ...prev, validated: wasValidated ? prev.validated : prev.validated + 1 };
      });
    } catch (e: unknown) {
      addToast({ type: "error", message: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSavingId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/export?session_id=${session.id}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${session.name}_validated.csv`;
      a.click();
      URL.revokeObjectURL(url);
      addToast({ type: "success", message: "Export downloaded successfully!" });
    } catch {
      addToast({ type: "error", message: "Export failed" });
    } finally {
      setExporting(false);
    }
  };

  const progressPct = pct(progress.validated, progress.total);

  return (
    <div>
      {/* Page Header */}
      <div ref={topRef} className="page-header">
        <div className="flex items-center gap-3 mb-4">
          <button className="btn btn-ghost btn-sm flex items-center gap-1" onClick={onBack} id="back-btn">
            <ChevronLeft size={16} /> Back
          </button>
          <div style={{ flex: 1 }}>
            <h1 className="page-title flex items-center gap-2"><FileText size={20} className="text-accent" /> {session.name}</h1>
            <p className="page-sub">
              {session.filename} ·{" "}
              {formatDate(session.created_at)}
            </p>
          </div>
          <button
            className="btn btn-success btn-sm"
            onClick={handleExport}
            disabled={exporting}
            id="export-btn"
          >
            {exporting ? (
              <><div className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> Exporting…</>
            ) : (
              <><Download size={14} /> Export CSV</>
            )}
          </button>
        </div>

        {/* Progress */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ padding: "16px 20px" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                Validation Progress
              </span>
              <span className="font-mono text-sm" style={{ color: "var(--accent-light)" }}>
                {progress.validated} / {progress.total} reviewed ({progressPct}%)
              </span>
            </div>
            <div className="progress-wrap">
              <div className="progress-bar" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <span className="text-sm text-muted">Filter:</span>
        {(["all", "pending", "validated", "low"] as const).map((f) => (
          <button
            key={f}
            id={`filter-${f}`}
            className={`filter-chip ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? <><Box size={14} /> All</> : f === "pending" ? <><Play size={14} /> Pending</> : f === "validated" ? <><Check size={14} /> Validated</> : <><AlertTriangle size={14} /> Low Confidence</>}
          </button>
        ))}
      </div>

      {/* QA List */}
      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: "60px 0" }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : pairs.length === 0 ? (
        <div className="empty-state" style={{ textAlign: "center", padding: "40px 20px" }}>
          <div className="empty-icon text-muted flex justify-center mb-4"><Search size={48} strokeWidth={1.5} /></div>
          <h3 className="empty-title font-semibold text-lg mb-2">No questions found</h3>
          <p className="empty-sub text-muted">Try changing the filter or this session has no Q&A pairs.</p>
        </div>
      ) : (
        <div className="qa-list">
          {pairs.map((pair, i) => (
            <QACard
              key={pair.id}
              pair={pair}
              index={(currentPage - 1) * (pagination?.limit || 10) + i}
              onSave={handleSave}
              saving={savingId === pair.id}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-sm text-muted">
            Showing {(pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </span>
          <div className="pagination">
            <button
              className="page-btn flex items-center justify-center"
              disabled={currentPage === 1}
              onClick={() => { setCurrentPage((p) => p - 1); topRef.current?.scrollIntoView({ behavior: "smooth" }); }}
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  className={`page-btn ${currentPage === page ? "active" : ""}`}
                  onClick={() => { setCurrentPage(page); topRef.current?.scrollIntoView({ behavior: "smooth" }); }}
                >
                  {page}
                </button>
              );
            })}
            <button
              className="page-btn flex items-center justify-center"
              disabled={currentPage === pagination.totalPages}
              onClick={() => { setCurrentPage((p) => p + 1); topRef.current?.scrollIntoView({ behavior: "smooth" }); }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Page
// ─────────────────────────────────────────────────────────────────────────────
function DashboardPage({
  sessions,
  loading,
  onSelectSession,
  onDeleteSession,
  onUpload,
  addToast,
}: {
  sessions: Session[];
  loading: boolean;
  onSelectSession: (s: Session) => void;
  onDeleteSession: (id: string) => void;
  onUpload: () => void;
  addToast: (t: Omit<Toast, "id">) => void;
}) {
  const totalValidated = sessions.reduce((s, sess) => s + (sess.validated_count || 0), 0);
  const totalQA = sessions.reduce((s, sess) => s + sess.total_questions, 0);
  const avgScores = sessions.filter((s) => s.avg_score !== null).map((s) => s.avg_score!);
  const overallAvg =
    avgScores.length > 0 ? Math.round(avgScores.reduce((a, b) => a + b, 0) / avgScores.length) : null;

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete session "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/sessions?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      onDeleteSession(id);
      addToast({ type: "info", message: `Session "${name}" deleted` });
    } catch {
      addToast({ type: "error", message: "Failed to delete session" });
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title flex items-center gap-2"><BrainCircuit size={20} className="text-accent" /> Validation Dashboard</h1>
            <p className="page-sub">Manage and review your ML Q&A validation sessions</p>
          </div>
          <button className="btn btn-primary" onClick={onUpload} id="new-session-btn">
            <Plus size={16} /> New Session
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Total Sessions</div>
          <div className="stat-value">{sessions.length}</div>
          <div className="stat-sub">uploaded datasets</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Q&A Pairs</div>
          <div className="stat-value">{totalQA.toLocaleString()}</div>
          <div className="stat-sub">across all sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Validated</div>
          <div className="stat-value" style={{ color: "var(--success)" }}>
            {totalValidated.toLocaleString()}
          </div>
          <div className="stat-sub">{pct(totalValidated, totalQA)}% complete</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Score</div>
          <div
            className="stat-value"
            style={{ color: overallAvg !== null ? scoreColor(overallAvg) : "var(--text-muted)" }}
          >
            {overallAvg !== null ? overallAvg : "—"}
          </div>
          <div className="stat-sub">out of 100</div>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title flex items-center gap-2"><FolderOpen size={16} /> Validation Sessions</h2>
          <span className="badge badge-default">{sessions.length} sessions</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="flex items-center justify-center" style={{ padding: "40px 0" }}>
              <div className="spinner" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="empty-state" style={{ padding: "40px 20px", textAlign: "center" }}>
              <div className="empty-icon text-muted flex justify-center mb-4"><FolderOpen size={48} strokeWidth={1.5} /></div>
              <h3 className="empty-title font-semibold text-lg mb-2">No sessions yet</h3>
              <p className="empty-sub text-muted">Upload a CSV file to start validating your ML-generated Q&A pairs</p>
              <button className="btn btn-primary mt-4" onClick={onUpload}>
                <Upload size={16} /> Upload CSV
              </button>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Session Name", "File", "Questions", "Progress", "Avg Score", "Last Updated", ""].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "12px 20px",
                          textAlign: "left",
                          fontSize: "11px",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.7px",
                          color: "var(--text-muted)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((sess) => {
                    const prog = pct(sess.validated_count, sess.total_questions);
                    return (
                      <tr
                        key={sess.id}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          transition: "background var(--transition)",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                        onClick={() => onSelectSession(sess)}
                      >
                        <td style={{ padding: "14px 20px" }}>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "14px" }}>
                            {sess.name}
                          </div>
                        </td>
                        <td style={{ padding: "14px 20px" }}>
                          <span className="text-sm text-muted font-mono">{sess.filename}</span>
                        </td>
                        <td style={{ padding: "14px 20px" }}>
                          <span className="font-mono" style={{ color: "var(--text-secondary)" }}>
                            {sess.total_questions}
                          </span>
                        </td>
                        <td style={{ padding: "14px 20px", minWidth: 150 }}>
                          <div className="flex items-center gap-2">
                            <div className="progress-wrap" style={{ flex: 1 }}>
                              <div className="progress-bar" style={{ width: `${prog}%` }} />
                            </div>
                            <span className="text-sm font-mono" style={{ color: "var(--accent-light)", minWidth: 36 }}>
                              {prog}%
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "14px 20px" }}>
                          {sess.avg_score !== null ? (
                            <span
                              className="badge"
                              style={{
                                background:
                                  sess.avg_score < 40
                                    ? "var(--danger-bg)"
                                    : sess.avg_score < 70
                                    ? "var(--warning-bg)"
                                    : "var(--success-bg)",
                                color: scoreColor(sess.avg_score),
                              }}
                            >
                              {sess.avg_score}/100
                            </span>
                          ) : (
                            <span className="text-muted text-sm">—</span>
                          )}
                        </td>
                        <td style={{ padding: "14px 20px" }}>
                          <span className="text-sm text-muted">{formatDate(sess.updated_at)}</span>
                        </td>
                        <td style={{ padding: "14px 20px" }}>
                          <div
                            className="flex gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => onSelectSession(sess)}
                              id={`review-btn-${sess.id}`}
                            >
                              Review
                            </button>
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => handleDelete(sess.id, sess.name)}
                              style={{ color: "var(--danger)", padding: "6px" }}
                              id={`delete-btn-${sess.id}`}
                              title="Delete"
                            >
                              <AlertTriangle size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root App
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [showExports, setShowExports] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Omit<Toast, "id">) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), TOAST_DURATION);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      if (res.ok) setSessions(data.sessions);
    } catch {
      addToast({ type: "error", message: "Failed to load sessions" });
    } finally {
      setSessionsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleUploadSuccess = (session: Session) => {
    setShowUpload(false);
    fetchSessions();
    setActiveSession(session);
    setShowExports(false);
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSession?.id === id) setActiveSession(null);
  };

  return (
    <div className="app-shell">
      {/* Navbar */}
      <nav className="navbar">
        <a className="navbar-brand" href="#" onClick={() => setActiveSession(null)}>
          <div>
            <div className="brand-text">Q&A Validator</div>
            <div className="brand-sub">ML Expert Review Platform</div>
          </div>
        </a>
        <div className="navbar-actions">
          <span className="text-sm text-muted">
            {sessions.length} session{sessions.length !== 1 ? "s" : ""}
          </span>
          <button className="btn btn-primary btn-sm" onClick={() => setShowUpload(true)} id="nav-upload-btn">
            <Upload size={16} /> Upload CSV
          </button>
        </div>
      </nav>

      <div className="main-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-title">Sessions</div>
          </div>
          <div className="session-list">
            <div
              className={`session-card-sidebar ${!activeSession && !showExports ? "active" : ""}`}
              onClick={() => { setActiveSession(null); setShowExports(false); }}
              id="sidebar-dashboard"
            >
              <div className="session-card-name flex items-center gap-2"><LayoutDashboard size={14} /> Dashboard</div>
              <div className="session-card-meta">{sessions.length} sessions total</div>
            </div>
            <div
              className={`session-card-sidebar ${showExports ? "active" : ""}`}
              onClick={() => { setShowExports(true); setActiveSession(null); }}
              id="sidebar-exports"
            >
              <div className="session-card-name flex items-center gap-2"><Package size={14} /> Exports</div>
              <div className="session-card-meta">Download history</div>
            </div>
            {sessions.map((s) => {
              const prog = pct(s.validated_count, s.total_questions);
              return (
                <div
                  key={s.id}
                  className={`session-card-sidebar ${activeSession?.id === s.id ? "active" : ""}`}
                  onClick={() => setActiveSession(s)}
                  id={`sidebar-session-${s.id}`}
                >
                  <div className="session-card-name">{s.name}</div>
                  <div className="session-card-meta">
                    {s.validated_count}/{s.total_questions} · {prog}% done
                    {s.avg_score !== null && ` · Avg ${s.avg_score}`}
                  </div>
                  <div className="progress-wrap" style={{ marginTop: 6, height: 3 }}>
                    <div className="progress-bar" style={{ width: `${prog}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: "12px 8px", borderTop: "1px solid var(--border)" }}>
            <button className="btn btn-primary w-full" onClick={() => setShowUpload(true)}>
              <Plus size={16} /> New Session
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {activeSession ? (
            <ValidationPage
              key={activeSession.id}
              session={activeSession}
              addToast={addToast}
              onBack={() => { setActiveSession(null); fetchSessions(); }}
            />
          ) : showExports ? (
            <ExportsPage addToast={addToast} />
          ) : (
            <DashboardPage
              sessions={sessions}
              loading={sessionsLoading}
              onSelectSession={(s) => { setActiveSession(s); setShowExports(false); }}
              onDeleteSession={handleDeleteSession}
              onUpload={() => setShowUpload(true)}
              addToast={addToast}
            />
          )}
        </main>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadSuccess}
          addToast={addToast}
        />
      )}

      {/* Toasts */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
