import { useState, useEffect, useCallback, useMemo } from "react";

const API_BASE = "/api";

const ATS_COLORS = {
  greenhouse: "#2ea44f",
  ashby: "#6366f1",
  lever: "#8b5cf6",
  workday: "#f59e0b",
  linkedin: "#0a66c2",
  indeed: "#2164f3",
  wellfound: "#000",
  yc: "#f26522",
  unknown: "#555",
};

const STATUS_STYLES = {
  new: { bg: "transparent", text: "#10b981", label: "New" },
  applied: { bg: "#111118", text: "#555", label: "Applied" },
  skipped: { bg: "#111118", text: "#444", label: "Skipped" },
};

export default function JobCommandCenter() {
  const [data, setData] = useState({ newToday: [], previouslySeen: [], applied: [], skipped: [], total: 0, last_scraped: null, scrape_stats: null, scrape_errors: [] });
  const [view, setView] = useState("board");
  const [search, setSearch] = useState("");
  const [filterATS, setFilterATS] = useState("all");
  const [scraping, setScraping] = useState(false);
  const [applying, setApplying] = useState(null);
  const [statusMsg, setStatusMsg] = useState("");

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/jobs`);
      if (res.ok) setData(await res.json());
    } catch { /* server not running */ }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Poll for updates every 10s while scraping
  useEffect(() => {
    if (!scraping) return;
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, [scraping, fetchJobs]);

  const handleScrape = async (quick = false) => {
    setScraping(true);
    setStatusMsg("Scraping... check terminal for progress.");
    try {
      const res = await fetch(`${API_BASE}/scrape`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quick }) });
      const result = await res.json();
      if (!res.ok) setStatusMsg(result.error || "Scrape failed");
      else setStatusMsg(`Scrape started (${result.mode} mode). Refresh in a few minutes.`);
    } catch { setStatusMsg("Failed to start scrape. Is the server running?"); }
    // Keep polling for ~5 min then stop
    setTimeout(() => { setScraping(false); fetchJobs(); }, 300000);
  };

  const handleApply = async (jobId) => {
    setApplying(jobId);
    setStatusMsg("Apply agent started. Check terminal for interaction.");
    try {
      const res = await fetch(`${API_BASE}/apply/${jobId}`, { method: "POST" });
      const result = await res.json();
      setStatusMsg(result.message || "Apply started");
    } catch { setStatusMsg("Failed to start apply agent."); }
    setTimeout(() => { setApplying(null); fetchJobs(); }, 5000);
  };

  const handleApplyAllNew = async () => {
    setStatusMsg("Batch apply started. Check terminal for interaction.");
    try {
      const res = await fetch(`${API_BASE}/apply-all-new`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 10 }) });
      const result = await res.json();
      setStatusMsg(result.message || "Batch apply started");
    } catch { setStatusMsg("Failed to start batch apply."); }
  };

  const filterJobs = (jobs) => {
    let f = jobs;
    if (search) {
      const s = search.toLowerCase();
      f = f.filter(j => (j.title || "").toLowerCase().includes(s) || (j.company || "").toLowerCase().includes(s) || (j.location || "").toLowerCase().includes(s));
    }
    if (filterATS !== "all") f = f.filter(j => j.ats === filterATS);
    return f;
  };

  const allATS = useMemo(() => {
    const all = [...data.newToday, ...data.previouslySeen, ...data.applied];
    return [...new Set(all.map(j => j.ats))].sort();
  }, [data]);

  const formatDate = (iso) => {
    if (!iso) return "Never";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const JobRow = ({ job, greyed = false }) => (
    <tr style={{ opacity: greyed ? 0.4 : 1, borderBottom: "1px solid #1a1a22" }}>
      <td style={{ padding: "10px 12px", fontSize: 12, maxWidth: 280 }}>
        <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ color: greyed ? "#555" : "#c4b5fd", textDecoration: "none" }}>
          {job.title || "Untitled"}
        </a>
      </td>
      <td style={{ padding: "10px 8px", fontSize: 12, color: greyed ? "#444" : "#e0e0e5" }}>{job.company || "—"}</td>
      <td style={{ padding: "10px 8px", fontSize: 11, color: greyed ? "#444" : "#888" }}>{job.location || "—"}</td>
      <td style={{ padding: "10px 8px", fontSize: 11, color: job.salary ? (greyed ? "#444" : "#10b981") : "#333" }}>{job.salary || "—"}</td>
      <td style={{ padding: "10px 8px" }}>
        <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: `${ATS_COLORS[job.ats] || "#555"}22`, color: ATS_COLORS[job.ats] || "#555", textTransform: "uppercase", fontWeight: 600 }}>
          {job.ats}
        </span>
      </td>
      <td style={{ padding: "10px 8px", fontSize: 10, color: "#555" }}>{job.date_found}</td>
      <td style={{ padding: "10px 8px" }}>
        {greyed ? (
          <span style={{ fontSize: 10, color: "#555" }}>Applied {job.date_applied ? formatDate(job.date_applied) : ""}</span>
        ) : (
          <button onClick={() => handleApply(job.id)} disabled={applying === job.id}
            style={{ background: applying === job.id ? "#333" : "#8b5cf6", color: "#fff", border: "none", padding: "4px 12px", borderRadius: 4, fontSize: 10, cursor: "pointer", fontWeight: 600 }}>
            {applying === job.id ? "..." : "Apply"}
          </button>
        )}
      </td>
    </tr>
  );

  const JobTable = ({ jobs, greyed = false }) => (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ borderBottom: "1px solid #222" }}>
          {["Title", "Company", "Location", "Salary", "ATS", "Found", ""].map(h => (
            <th key={h} style={{ padding: "8px 12px", fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "left", fontWeight: 600 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {jobs.map(j => <JobRow key={j.id} job={j} greyed={greyed} />)}
      </tbody>
    </table>
  );

  const SectionHeader = ({ title, count, color = "#8b5cf6" }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "20px 0 8px", padding: "0 4px" }}>
      <div style={{ width: 3, height: 16, background: color, borderRadius: 2 }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: "#e0e0e5", fontFamily: "'Space Grotesk', sans-serif" }}>{title}</span>
      <span style={{ fontSize: 11, color: "#555" }}>({count})</span>
    </div>
  );

  return (
    <div style={{ background: "#0a0a0f", color: "#e0e0e5", minHeight: "100vh", fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #111; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        input, select { font-family: inherit; }
        button:hover:not(:disabled) { filter: brightness(1.15); }
        tr:hover { background: #111118 !important; }
      `}</style>

      {/* HEADER */}
      <div style={{ background: "linear-gradient(135deg, #0d0d15 0%, #1a0d2e 100%)", borderBottom: "1px solid #222", padding: "16px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1400, margin: "0 auto" }}>
          <div>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: "-0.5px" }}>
              <span style={{ color: "#8b5cf6" }}>&#9889;</span> JOB COMMAND CENTER
            </h1>
            <p style={{ fontSize: 10, color: "#555", marginTop: 2 }}>FDE / AI Deployment / Applied AI</p>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#444", marginRight: 8 }}>
              Last scraped: {formatDate(data.last_scraped)}
            </span>
            <button onClick={() => handleScrape(false)} disabled={scraping}
              style={{ background: scraping ? "#333" : "#10b981", color: "#fff", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>
              {scraping ? "Scraping..." : "Scrape Now"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "12px 24px" }}>
        {/* STATUS MESSAGE */}
        {statusMsg && (
          <div style={{ background: "#111118", border: "1px solid #333", borderRadius: 6, padding: "8px 14px", marginBottom: 12, fontSize: 11, color: "#888", display: "flex", justifyContent: "space-between" }}>
            <span>{statusMsg}</span>
            <button onClick={() => setStatusMsg("")} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 11 }}>x</button>
          </div>
        )}

        {/* STATS BAR */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 12 }}>
          {[
            { label: "Total", val: data.total, color: "#8b5cf6" },
            { label: "New Today", val: data.newToday?.length || 0, color: "#10b981" },
            { label: "Previously Seen", val: data.previouslySeen?.length || 0, color: "#f59e0b" },
            { label: "Applied", val: data.applied?.length || 0, color: "#3b82f6" },
            { label: "Fetch Errors", val: data.scrape_stats?.detail_fetch_failed || 0, color: "#ef4444" },
          ].map(s => (
            <div key={s.label} style={{ background: "#111118", border: "1px solid #1a1a22", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color, fontFamily: "'Space Grotesk', sans-serif" }}>{s.val}</div>
              <div style={{ fontSize: 8, color: "#555", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* SCRAPE ERRORS BANNER */}
        {data.scrape_errors?.length > 0 && (
          <div style={{ background: "#1a1111", border: "1px solid #3a1515", borderRadius: 6, padding: "6px 12px", marginBottom: 12, fontSize: 10, color: "#ef4444" }}>
            Blocked sources: {data.scrape_errors.map(e => e.source).filter((v, i, a) => a.indexOf(v) === i).join(", ")}
          </div>
        )}

        {/* FILTERS + APPLY ALL */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input placeholder="Search titles, companies, locations..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 200, background: "#111118", border: "1px solid #222", borderRadius: 6, padding: "8px 12px", color: "#e0e0e5", fontSize: 12 }} />
          <select value={filterATS} onChange={e => setFilterATS(e.target.value)}
            style={{ background: "#111118", border: "1px solid #222", borderRadius: 6, padding: "8px", color: "#e0e0e5", fontSize: 11 }}>
            <option value="all">All ATS</option>
            {allATS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {(data.newToday?.length > 0 || data.previouslySeen?.length > 0) && (
            <button onClick={handleApplyAllNew}
              style={{ background: "#7c3aed", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>
              Apply All New ({(data.newToday?.length || 0) + (data.previouslySeen?.length || 0)})
            </button>
          )}
          <button onClick={fetchJobs} style={{ background: "#222", color: "#888", border: "1px solid #333", padding: "8px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
            Refresh
          </button>
        </div>

        {/* NEW TODAY */}
        {filterJobs(data.newToday || []).length > 0 && (
          <>
            <SectionHeader title="New Today" count={filterJobs(data.newToday).length} color="#10b981" />
            <div style={{ background: "#0d0d15", border: "1px solid #1a2a1a", borderRadius: 8, overflow: "hidden" }}>
              <JobTable jobs={filterJobs(data.newToday)} />
            </div>
          </>
        )}

        {/* PREVIOUSLY SEEN */}
        {filterJobs(data.previouslySeen || []).length > 0 && (
          <>
            <SectionHeader title="Previously Seen" count={filterJobs(data.previouslySeen).length} color="#f59e0b" />
            <div style={{ background: "#0d0d15", border: "1px solid #222", borderRadius: 8, overflow: "hidden" }}>
              <JobTable jobs={filterJobs(data.previouslySeen)} />
            </div>
          </>
        )}

        {/* APPLIED (greyed out) */}
        {filterJobs(data.applied || []).length > 0 && (
          <>
            <SectionHeader title="Applied" count={filterJobs(data.applied).length} color="#3b82f6" />
            <div style={{ background: "#0a0a10", border: "1px solid #1a1a22", borderRadius: 8, overflow: "hidden" }}>
              <JobTable jobs={filterJobs(data.applied)} greyed={true} />
            </div>
          </>
        )}

        {/* EMPTY STATE */}
        {data.total === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#444" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#128269;</div>
            <div style={{ fontSize: 14, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 8 }}>No jobs yet</div>
            <div style={{ fontSize: 11, color: "#333" }}>Click "Scrape Now" to search for jobs across ATS platforms and job boards.</div>
          </div>
        )}
      </div>
    </div>
  );
}
