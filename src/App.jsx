import { useState, useEffect, useCallback, useMemo } from "react";

const TITLE_VARIANTS = [
  "forward deployed engineer",
  "forward deployed AI engineer",
  "AI deployment engineer",
  "AI deployment strategist",
  "applied AI engineer",
  "solutions engineer AI",
  "solutions architect AI",
  "AI consultant",
  "AI implementation engineer",
  "customer engineer AI",
  "technical account manager AI",
  "AI strategist",
  "implementation consultant AI",
  "professional services engineer AI",
  "field engineer AI",
  "AI integration engineer",
  "pre-sales engineer AI",
  "technical solutions engineer AI",
  "enterprise AI engineer",
  "AI success engineer",
  "solutions engineer LLM",
  "solutions engineer machine learning",
  "AI solutions consultant",
  "deployment strategist AI",
  "forward deployed software engineer",
];

const ATS_SITES = [
  { name: "Ashby", domain: "jobs.ashbyhq.com" },
  { name: "Greenhouse", domain: "job-boards.greenhouse.io" },
  { name: "Greenhouse (alt)", domain: "boards.greenhouse.io" },
  { name: "Lever", domain: "jobs.lever.co" },
  { name: "Workday", domain: "myworkdayjobs.com" },
  { name: "Rippling ATS", domain: "ats.rippling.com" },
];

const JOB_BOARDS = [
  { name: "LinkedIn", url: (q) => `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(q)}&location=New%20York%20City%20Metropolitan%20Area&f_WT=2` },
  { name: "Indeed", url: (q) => `https://www.indeed.com/jobs?q=${encodeURIComponent(q)}&l=New+York%2C+NY&sc=0kf%3Aattr(DSQF7)%3B` },
  { name: "Wellfound", url: () => "https://wellfound.com/role/l/ai-engineer/new-york" },
  { name: "Built In NYC", url: () => "https://www.builtinnyc.com/jobs/artificial-intelligence" },
  { name: "Y Combinator", url: () => "https://www.ycombinator.com/jobs" },
  { name: "startup.jobs", url: () => "https://startup.jobs/artificial-intelligence-jobs" },
  { name: "topstartups.io", url: () => "https://topstartups.io/jobs/?startup__markets=Artificial+Intelligence" },
  { name: "Otta", url: () => "https://otta.com" },
];

const STORAGE_KEY = "job-board-data-v2";

const TIER_COLORS = {
  T1: { bg: "#0d1f0d", border: "#1a5c1a", text: "#6ee86e", label: "Model Provider" },
  T2: { bg: "#0d1520", border: "#1a4a7a", text: "#6eb8e8", label: "FinServ / Enterprise AI" },
  T3: { bg: "#201a0d", border: "#7a6a1a", text: "#e8d86e", label: "Hot Startup" },
  T4: { bg: "#1a1015", border: "#5a2a3a", text: "#d89090", label: "Broader Fit" },
  manual: { bg: "#15151a", border: "#3a3a5a", text: "#b0b0d0", label: "Manual Add" },
};

const STATUS_OPTIONS = ["Not Applied", "Applied", "Screening", "Interview", "Offer", "Rejected", "Withdrawn"];
const STATUS_COLORS = {
  "Not Applied": "#555",
  Applied: "#3b82f6",
  Screening: "#8b5cf6",
  Interview: "#f59e0b",
  Offer: "#10b981",
  Rejected: "#ef4444",
  Withdrawn: "#6b7280",
};

const SEED_DATA = [
  { id: "1", company: "Anthropic", role: "FDE, Applied AI", location: "NYC/SF/Remote", comp: "$180-280K+", tier: "T1", stage: "Series D", url: "https://job-boards.greenhouse.io/anthropic/jobs/4985877008", status: "Not Applied", fit: 10, note: "ICML co-author, Claude Certified prep" },
  { id: "2", company: "Anthropic", role: "FDE, Custom Agents (Regulated)", location: "NYC/SF", comp: "$180-280K+", tier: "T1", stage: "Series D", url: "https://job-boards.greenhouse.io/anthropic/jobs/5074695008", status: "Not Applied", fit: 10, note: "Regulated = finserv. IB background." },
  { id: "3", company: "OpenAI", role: "AI Deployment Engineer - Startups", location: "NYC/SF", comp: "$200-350K+", tier: "T1", stage: "Late", url: "https://openai.com/careers/", status: "Not Applied", fit: 10, note: "F2 case study is perfect proof." },
  { id: "4", company: "OpenAI", role: "AI Deployment Engineer - Enterprise", location: "NYC/SF", comp: "$200-350K+", tier: "T1", stage: "Late", url: "https://openai.com/careers/", status: "Not Applied", fit: 9, note: "InfoSec due diligence maps." },
  { id: "5", company: "xAI", role: "FDE - Enterprise", location: "SF/Palo Alto", comp: "$200-350K+", tier: "T1", stage: "Late", url: "https://job-boards.greenhouse.io/xai/jobs/4701523007", status: "Not Applied", fit: 8, note: "GTM team. Grok enterprise." },
  { id: "6", company: "Palantir", role: "Forward Deployed AI Engineer", location: "NYC", comp: "$150-250K+", tier: "T1", stage: "Public", url: "https://jobs.lever.co/palantir/636fc05c", status: "Not Applied", fit: 9, note: "Invented the FDE role." },
  { id: "7", company: "Google Cloud", role: "FDE, GenAI", location: "NYC", comp: "$180-300K+", tier: "T1", stage: "Public", url: "https://careers.google.com/jobs/results/120977245454901958", status: "Not Applied", fit: 9, note: "MCP servers, agentic AI." },
  { id: "8", company: "Salesforce", role: "AI FDE (Sr/Lead)", location: "NYC/Remote", comp: "$170-280K+", tier: "T1", stage: "Public", url: "https://careers.salesforce.com/en/jobs/jr305198/", status: "Not Applied", fit: 8, note: "Agentforce platform." },
  { id: "9", company: "Scale AI", role: "FDE, GenAI", location: "NYC/SF", comp: "$160-280K+", tier: "T1", stage: "Late", url: "https://scale.com/careers/4593571005", status: "Not Applied", fit: 9, note: "Live posting." },
  { id: "10", company: "Scale AI", role: "FDE, Enterprise", location: "SF/NYC", comp: "$160-280K+", tier: "T1", stage: "Late", url: "https://job-boards.greenhouse.io/scaleai/jobs/4597399005", status: "Not Applied", fit: 9, note: "Multi-agent, RAG, evals." },
  { id: "11", company: "Cohere", role: "Enterprise Solutions Engineer", location: "NYC/Remote", comp: "$150-250K+", tier: "T1", stage: "Series D", url: "https://cohere.com/careers", status: "Not Applied", fit: 8, note: "Your vendor eval lens fits." },
  { id: "12", company: "Mistral AI", role: "AI Developer Advocate", location: "NYC", comp: "$140-220K+", tier: "T1", stage: "Series B", url: "https://startup.jobs/company/mistral-ai", status: "Not Applied", fit: 7, note: "NYC role confirmed." },
  { id: "13", company: "Hebbia", role: "AI Strategist", location: "NYC", comp: "$150-250K+", tier: "T2", stage: "Series B", url: "https://careers.hebbia.ai/", status: "Not Applied", fit: 10, note: "You evaluated them at Jefferies." },
  { id: "14", company: "Ramp", role: "Applied AI Engineer", location: "NYC", comp: "$160-280K+", tier: "T2", stage: "Series D", url: "https://jobs.ashbyhq.com/ramp/d204e136", status: "Not Applied", fit: 9, note: "AI-first fintech. Perfect." },
  { id: "15", company: "Harvey", role: "Solutions Engineer", location: "NYC/SF", comp: "$150-250K+", tier: "T2", stage: "Series C", url: "https://jobs.ashbyhq.com/harvey", status: "Not Applied", fit: 8, note: "Legal AI. Prompt eng transfers." },
  { id: "16", company: "Glean", role: "Senior Solutions Engineer", location: "NYC/PA", comp: "$150-250K+", tier: "T2", stage: "Series D", url: "https://job-boards.greenhouse.io/gleanwork", status: "Not Applied", fit: 8, note: "Enterprise AI search/agents." },
  { id: "17", company: "Moment Technology", role: "AI Engineer", location: "NYC", comp: "$250-325K+", tier: "T2", stage: "Series B", url: "https://jobs.ashbyhq.com/moment/f8e990cd", status: "Not Applied", fit: 9, note: "Trading tech. $8T+ AUM. Series 79 differentiator." },
  { id: "18", company: "iCapital", role: "AI Forward Deployment Engineer", location: "NYC", comp: "$140-200K+", tier: "T2", stage: "Late", url: "https://job-boards.greenhouse.io/icapitalnetwork/jobs/8457208002", status: "Not Applied", fit: 9, note: "Alt investments fintech. NYC." },
  { id: "19", company: "Addepar", role: "Forward Deployed Engineer", location: "NYC", comp: "$150-230K+", tier: "T2", stage: "Series F", url: "https://www.addepar.com/careers", status: "Not Applied", fit: 8, note: "Wealth mgmt data platform." },
  { id: "20", company: "Datadog", role: "AI Engineer", location: "NYC", comp: "$170-280K+", tier: "T2", stage: "Public", url: "https://careers.datadoghq.com/", status: "Not Applied", fit: 7, note: "NYC. AI-driven features." },
  { id: "21", company: "Cresta", role: "FDE (AI Agent)", location: "Remote/SF", comp: "$150-250K+", tier: "T3", stage: "Series D", url: "https://job-boards.greenhouse.io/cresta/jobs/4759347008", status: "Not Applied", fit: 8, note: "Stanford AI lab. Sebastian Thrun." },
  { id: "22", company: "Baseten", role: "Forward Deployed Engineer", location: "SF/Remote", comp: "$150-230K+", tier: "T3", stage: "Series B", url: "https://jobs.ashbyhq.com/baseten/84c1801c", status: "Not Applied", fit: 7, note: "ML inference platform." },
  { id: "23", company: "Inkeep", role: "FDE, AI Agents", location: "Remote", comp: "$140-220K+", tier: "T3", stage: "Seed/A", url: "https://jobs.ashbyhq.com/inkeep/f277f68d", status: "Not Applied", fit: 7, note: "AI agents for developer docs." },
  { id: "24", company: "Synthflow AI", role: "Forward Deployed Engineer", location: "Remote", comp: "$130-200K+", tier: "T3", stage: "Series A", url: "https://jobs.ashbyhq.com/synthflow/b0cb2768", status: "Not Applied", fit: 6, note: "Voice AI. Enterprise deployment." },
  { id: "25", company: "Giga (GigaML)", role: "Sr/Staff FDE", location: "Remote/SF", comp: "$160-260K+", tier: "T3", stage: "Seed/A", url: "https://jobs.ashbyhq.com/gigaml/0bd3cb15", status: "Not Applied", fit: 7, note: "Top global brands." },
  { id: "26", company: "Labelbox", role: "Forward Deployed Engineer", location: "Remote", comp: "$140-220K+", tier: "T3", stage: "Series D", url: "https://job-boards.greenhouse.io/labelbox/jobs/4640927007", status: "Not Applied", fit: 6, note: "AI data infra. Frontier labs." },
  { id: "27", company: "Titan AI", role: "AI Application Engineer", location: "Remote", comp: "$140-220K+", tier: "T2", stage: "Seed", url: "https://jobs.ashbyhq.com/titan-ai/96cafb71", status: "Not Applied", fit: 8, note: "AI for banking." },
  { id: "28", company: "Parcha", role: "Applied AI Engineer", location: "Remote/SF", comp: "$140-220K+", tier: "T2", stage: "Seed", url: "https://jobs.ashbyhq.com/Parcha/16f20b99", status: "Not Applied", fit: 8, note: "Fintech compliance automation." },
  { id: "29", company: "Point72", role: "Applied AI Engineer", location: "NYC", comp: "$180-300K+", tier: "T4", stage: "Hedge Fund", url: "https://point72.com/careers", status: "Not Applied", fit: 8, note: "IB + Series 79 + AI unicorn." },
  { id: "30", company: "D.E. Shaw", role: "Applied AI Engineer", location: "NYC", comp: "$180-300K+", tier: "T4", stage: "Hedge Fund", url: "https://deshaw.com/careers", status: "Not Applied", fit: 8, note: "Greenfield AI projects." },
  { id: "31", company: "Stripe", role: "Solutions Architect", location: "NYC/Remote", comp: "$170-280K+", tier: "T4", stage: "Public", url: "https://stripe.com/jobs", status: "Not Applied", fit: 7, note: "Revenue automation FDE team." },
  { id: "32", company: "Databricks", role: "Solutions Architect - AI", location: "NYC/Remote", comp: "$170-280K+", tier: "T4", stage: "Late", url: "https://databricks.com/careers", status: "Not Applied", fit: 7, note: "Data + AI platform." },
  { id: "33", company: "DiligenceSquared", role: "AI Engineer / Finance", location: "Remote", comp: "$140-220K+", tier: "T4", stage: "YC Seed", url: "https://www.ycombinator.com/companies/diligencesquared", status: "Not Applied", fit: 8, note: "AI due diligence for PE. YOU are the user." },
  { id: "34", company: "Osmo", role: "FDE - Enterprise Solutions", location: "NYC/NJ", comp: "$150-230K+", tier: "T3", stage: "Series B", url: "https://jobs.ashbyhq.com/osmo/7f37ca45", status: "Not Applied", fit: 7, note: "Digital olfaction AI. NYC HQ." },
  { id: "35", company: "Serval", role: "Forward Deployed Engineer", location: "Remote/SF", comp: "$140-220K+", tier: "T3", stage: "Seed", url: "https://jobs.ashbyhq.com/Serval/f55f33e2", status: "Not Applied", fit: 7, note: "AI IT workflows." },
];

function generateSearchUrls() {
  const urls = [];
  const topTitles = [
    "forward deployed engineer",
    "forward deployed AI engineer",
    "AI deployment engineer",
    "AI deployment strategist",
    "applied AI engineer",
    "solutions engineer AI LLM",
    "AI consultant",
    "AI implementation engineer",
    "customer engineer AI",
    "AI strategist",
    "solutions architect AI",
    "technical account manager AI LLM",
    "enterprise AI engineer",
    "professional services engineer AI",
    "AI integration engineer",
  ];
  for (const site of ATS_SITES) {
    for (const title of topTitles) {
      urls.push({
        platform: `Google → ${site.name}`,
        query: `site:${site.domain} "${title}"`,
        url: `https://www.google.com/search?q=site%3A${site.domain}+%22${encodeURIComponent(title)}%22`,
      });
    }
  }
  for (const board of JOB_BOARDS) {
    for (const title of topTitles.slice(0, 6)) {
      const q = typeof board.url === "function" ? board.url(title) : board.url;
      urls.push({ platform: board.name, query: title, url: q });
    }
  }
  return urls;
}

export default function JobCommandCenter() {
  const [jobs, setJobs] = useState(SEED_DATA);
  const [view, setView] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [filterTier, setFilterTier] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("fit");
  const [showAdd, setShowAdd] = useState(false);
  const [newJob, setNewJob] = useState({ company: "", role: "", location: "", comp: "", tier: "T2", stage: "", url: "", note: "", fit: 7 });
  const [loaded, setLoaded] = useState(false);
  const [searchUrls] = useState(() => generateSearchUrls());
  const [searchFilter, setSearchFilter] = useState("");
  const [searchPlatform, setSearchPlatform] = useState("all");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setJobs(parsed);
      }
    } catch (e) { /* first load */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs)); } catch (e) {}
  }, [jobs, loaded]);

  const updateJob = useCallback((id, field, value) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, [field]: value } : j));
  }, []);

  const addJob = useCallback(() => {
    const id = String(Date.now());
    setJobs(prev => [...prev, { ...newJob, id, status: "Not Applied" }]);
    setNewJob({ company: "", role: "", location: "", comp: "", tier: "T2", stage: "", url: "", note: "", fit: 7 });
    setShowAdd(false);
  }, [newJob]);

  const deleteJob = useCallback((id) => {
    setJobs(prev => prev.filter(j => j.id !== id));
  }, []);

  const filtered = useMemo(() => {
    let f = jobs;
    if (search) {
      const s = search.toLowerCase();
      f = f.filter(j => j.company.toLowerCase().includes(s) || j.role.toLowerCase().includes(s) || j.note?.toLowerCase().includes(s));
    }
    if (filterTier !== "all") f = f.filter(j => j.tier === filterTier);
    if (filterStatus !== "all") f = f.filter(j => j.status === filterStatus);
    if (sortBy === "fit") f = [...f].sort((a, b) => (b.fit || 0) - (a.fit || 0));
    else if (sortBy === "company") f = [...f].sort((a, b) => a.company.localeCompare(b.company));
    else if (sortBy === "tier") f = [...f].sort((a, b) => a.tier.localeCompare(b.tier));
    else if (sortBy === "status") f = [...f].sort((a, b) => a.status.localeCompare(b.status));
    return f;
  }, [jobs, search, filterTier, filterStatus, sortBy]);

  const stats = useMemo(() => ({
    total: jobs.length,
    applied: jobs.filter(j => j.status === "Applied").length,
    interview: jobs.filter(j => j.status === "Interview" || j.status === "Screening").length,
    offer: jobs.filter(j => j.status === "Offer").length,
    notApplied: jobs.filter(j => j.status === "Not Applied").length,
    t1: jobs.filter(j => j.tier === "T1").length,
    t2: jobs.filter(j => j.tier === "T2").length,
    t3: jobs.filter(j => j.tier === "T3").length,
    t4: jobs.filter(j => j.tier === "T4").length,
  }), [jobs]);

  const filteredSearchUrls = useMemo(() => {
    let f = searchUrls;
    if (searchFilter) {
      const s = searchFilter.toLowerCase();
      f = f.filter(u => u.query.toLowerCase().includes(s) || u.platform.toLowerCase().includes(s));
    }
    if (searchPlatform !== "all") f = f.filter(u => u.platform.includes(searchPlatform));
    return f;
  }, [searchUrls, searchFilter, searchPlatform]);

  return (
    <div style={{ background: "#0a0a0f", color: "#e0e0e5", minHeight: "100vh", fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace", padding: "0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        input, select, textarea { font-family: inherit; }
      `}</style>

      {/* HEADER */}
      <div style={{ background: "linear-gradient(135deg, #0d0d15 0%, #1a0d2e 100%)", borderBottom: "1px solid #222", padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1400, margin: "0 auto" }}>
          <div>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "-0.5px" }}>
              <span style={{ color: "#8b5cf6" }}>⚡</span> JOB COMMAND CENTER
            </h1>
            <p style={{ fontSize: 11, color: "#666", marginTop: 4 }}>FDE / AI Deployment / Applied AI — Search & Track</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {["dashboard", "search", "scraper"].map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                background: view === v ? "#8b5cf6" : "transparent",
                color: view === v ? "#fff" : "#888",
                border: `1px solid ${view === v ? "#8b5cf6" : "#333"}`,
                padding: "6px 14px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px",
              }}>
                {v === "dashboard" ? "📋 Tracker" : v === "search" ? "🔍 Search URLs" : "🤖 Scraper"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "16px 24px" }}>
        {/* STATS BAR */}
        {view === "dashboard" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Total", val: stats.total, color: "#8b5cf6" },
                { label: "Not Applied", val: stats.notApplied, color: "#f59e0b" },
                { label: "Applied", val: stats.applied, color: "#3b82f6" },
                { label: "Interviewing", val: stats.interview, color: "#a855f7" },
                { label: "Offers", val: stats.offer, color: "#10b981" },
                { label: "T1", val: stats.t1, color: TIER_COLORS.T1.text },
                { label: "T2", val: stats.t2, color: TIER_COLORS.T2.text },
                { label: "T3", val: stats.t3, color: TIER_COLORS.T3.text },
                { label: "T4", val: stats.t4, color: TIER_COLORS.T4.text },
              ].map(s => (
                <div key={s.label} style={{ background: "#111118", border: "1px solid #222", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: "'Space Grotesk', sans-serif" }}>{s.val}</div>
                  <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* FILTERS */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
              <input placeholder="Search companies, roles, notes..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, minWidth: 200, background: "#111118", border: "1px solid #333", borderRadius: 6, padding: "8px 12px", color: "#e0e0e5", fontSize: 12 }} />
              <select value={filterTier} onChange={e => setFilterTier(e.target.value)}
                style={{ background: "#111118", border: "1px solid #333", borderRadius: 6, padding: "8px", color: "#e0e0e5", fontSize: 11 }}>
                <option value="all">All Tiers</option>
                {Object.entries(TIER_COLORS).filter(([k]) => k !== "manual").map(([k, v]) => <option key={k} value={k}>{k}: {v.label}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                style={{ background: "#111118", border: "1px solid #333", borderRadius: 6, padding: "8px", color: "#e0e0e5", fontSize: 11 }}>
                <option value="all">All Status</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                style={{ background: "#111118", border: "1px solid #333", borderRadius: 6, padding: "8px", color: "#e0e0e5", fontSize: 11 }}>
                <option value="fit">Sort: Fit Score</option>
                <option value="company">Sort: Company</option>
                <option value="tier">Sort: Tier</option>
                <option value="status">Sort: Status</option>
              </select>
              <button onClick={() => setShowAdd(!showAdd)} style={{
                background: showAdd ? "#ef4444" : "#10b981", color: "#fff", border: "none",
                padding: "8px 14px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600,
              }}>{showAdd ? "✕ Cancel" : "+ Add Job"}</button>
            </div>

            {/* ADD FORM */}
            {showAdd && (
              <div style={{ background: "#111118", border: "1px solid #333", borderRadius: 8, padding: 16, marginBottom: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                {[
                  ["company", "Company"], ["role", "Role Title"], ["location", "Location"], ["comp", "Comp Range"],
                  ["stage", "Stage/Size"], ["url", "Career URL"], ["note", "Notes"],
                ].map(([k, l]) => (
                  <input key={k} placeholder={l} value={newJob[k]} onChange={e => setNewJob(p => ({ ...p, [k]: e.target.value }))}
                    style={{ background: "#0a0a0f", border: "1px solid #333", borderRadius: 4, padding: "6px 8px", color: "#e0e0e5", fontSize: 11, gridColumn: k === "note" ? "span 2" : undefined }} />
                ))}
                <select value={newJob.tier} onChange={e => setNewJob(p => ({ ...p, tier: e.target.value }))}
                  style={{ background: "#0a0a0f", border: "1px solid #333", borderRadius: 4, padding: "6px 8px", color: "#e0e0e5", fontSize: 11 }}>
                  {Object.entries(TIER_COLORS).map(([k, v]) => <option key={k} value={k}>{k}: {v.label}</option>)}
                </select>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, color: "#888" }}>Fit:</span>
                  <input type="number" min="1" max="10" value={newJob.fit} onChange={e => setNewJob(p => ({ ...p, fit: +e.target.value }))}
                    style={{ background: "#0a0a0f", border: "1px solid #333", borderRadius: 4, padding: "6px", color: "#e0e0e5", fontSize: 11, width: 50 }} />
                  <button onClick={addJob} style={{ background: "#10b981", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 4, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Save</button>
                </div>
              </div>
            )}

            {/* JOB TABLE */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr>
                    {["Tier", "Company", "Role", "Location", "Comp", "Fit", "Status", "Notes", ""].map((h, i) => (
                      <th key={i} style={{ background: "#15151f", padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #333", color: "#888", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(j => {
                    const tc = TIER_COLORS[j.tier] || TIER_COLORS.manual;
                    return (
                      <tr key={j.id} style={{ borderBottom: "1px solid #1a1a25" }}>
                        <td style={{ padding: "8px 10px" }}>
                          <span style={{ background: tc.bg, color: tc.text, border: `1px solid ${tc.border}`, padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 600 }}>{j.tier}</span>
                        </td>
                        <td style={{ padding: "8px 10px", fontWeight: 600, color: "#fff" }}>
                          {j.url ? <a href={j.url} target="_blank" rel="noopener noreferrer" style={{ color: "#fff", textDecoration: "none", borderBottom: "1px dashed #555" }}>{j.company}</a> : j.company}
                          {j.stage && <div style={{ fontSize: 9, color: "#555", marginTop: 1 }}>{j.stage}</div>}
                        </td>
                        <td style={{ padding: "8px 10px", maxWidth: 200 }}>{j.role}</td>
                        <td style={{ padding: "8px 10px", color: "#888", fontSize: 10 }}>{j.location}</td>
                        <td style={{ padding: "8px 10px", color: "#10b981", fontSize: 10, whiteSpace: "nowrap" }}>{j.comp}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center" }}>
                          <span style={{ color: j.fit >= 9 ? "#10b981" : j.fit >= 7 ? "#f59e0b" : "#888", fontWeight: 700 }}>{j.fit}</span>
                        </td>
                        <td style={{ padding: "8px 6px" }}>
                          <select value={j.status} onChange={e => updateJob(j.id, "status", e.target.value)} style={{
                            background: STATUS_COLORS[j.status] + "22", color: STATUS_COLORS[j.status],
                            border: `1px solid ${STATUS_COLORS[j.status]}55`, borderRadius: 4, padding: "3px 6px", fontSize: 10, cursor: "pointer", fontWeight: 600,
                          }}>
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: "8px 10px", color: "#777", fontSize: 10, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{j.note}</td>
                        <td style={{ padding: "8px 6px" }}>
                          <button onClick={() => deleteJob(j.id)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 12 }} title="Delete">✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#555" }}>No jobs match your filters</div>}
            </div>
          </>
        )}

        {/* SEARCH URLS VIEW */}
        {view === "search" && (
          <>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, color: "#fff", marginBottom: 8 }}>
                🔍 Search URL Generator — <span style={{ color: "#8b5cf6" }}>{filteredSearchUrls.length}</span> queries
              </h2>
              <p style={{ fontSize: 11, color: "#666", marginBottom: 12 }}>Click any row to open the search. {TITLE_VARIANTS.length} title variants × {ATS_SITES.length} ATS platforms + {JOB_BOARDS.length} job boards = comprehensive coverage.</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <input placeholder="Filter queries..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)}
                  style={{ flex: 1, minWidth: 200, background: "#111118", border: "1px solid #333", borderRadius: 6, padding: "8px 12px", color: "#e0e0e5", fontSize: 12 }} />
                <select value={searchPlatform} onChange={e => setSearchPlatform(e.target.value)}
                  style={{ background: "#111118", border: "1px solid #333", borderRadius: 6, padding: "8px", color: "#e0e0e5", fontSize: 11 }}>
                  <option value="all">All Platforms</option>
                  {ATS_SITES.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  {JOB_BOARDS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ overflowX: "auto", maxHeight: "70vh", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                  <tr>
                    {["#", "Platform", "Query", ""].map((h, i) => (
                      <th key={i} style={{ background: "#15151f", padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #333", color: "#888", fontSize: 9, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSearchUrls.map((u, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #1a1a25", cursor: "pointer" }} onClick={() => window.open(u.url, "_blank")}>
                      <td style={{ padding: "6px 10px", color: "#555" }}>{i + 1}</td>
                      <td style={{ padding: "6px 10px" }}>
                        <span style={{ background: u.platform.includes("Google") ? "#1a0d2e" : "#0d1520", color: u.platform.includes("Google") ? "#a78bfa" : "#6eb8e8", padding: "2px 6px", borderRadius: 3, fontSize: 9 }}>{u.platform}</span>
                      </td>
                      <td style={{ padding: "6px 10px", fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>{u.query}</td>
                      <td style={{ padding: "6px 10px" }}>
                        <span style={{ color: "#3b82f6", fontSize: 10 }}>Open →</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* SCRAPER VIEW */}
        {view === "scraper" && (
          <>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, color: "#fff", marginBottom: 8 }}>
              🤖 Local Scraper Script
            </h2>
            <p style={{ fontSize: 11, color: "#666", marginBottom: 16 }}>Copy this Python script and run it on your M3 Max. It generates all search URLs and can be extended with Playwright/Selenium for automated scraping + auto-apply.</p>
            <div style={{ background: "#111118", border: "1px solid #333", borderRadius: 8, padding: 16, overflowX: "auto" }}>
              <pre style={{ fontSize: 10, color: "#a0d0a0", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{`#!/usr/bin/env python3
"""
JOB SCRAPER — FDE / AI Deployment Role Hunter
Run locally on your M3 Max. Requires: pip install requests beautifulsoup4 playwright
For auto-apply: pip install playwright && playwright install chromium
"""

import json, time, re, os
from urllib.parse import quote
from datetime import datetime

# ============================================================
# CONFIGURATION
# ============================================================

TITLE_VARIANTS = [
    "forward deployed engineer",
    "forward deployed AI engineer", 
    "AI deployment engineer",
    "AI deployment strategist",
    "applied AI engineer",
    "solutions engineer AI",
    "solutions architect AI",
    "AI consultant",
    "AI implementation engineer",
    "customer engineer AI",
    "technical account manager AI",
    "AI strategist",
    "implementation consultant AI",
    "professional services engineer AI",
    "field engineer AI",
    "AI integration engineer",
    "pre-sales engineer AI",
    "technical solutions engineer AI",
    "enterprise AI engineer",
    "AI success engineer",
    "solutions engineer LLM",
    "solutions engineer machine learning",
    "AI solutions consultant",
    "deployment strategist",
]

ATS_DOMAINS = [
    "jobs.ashbyhq.com",
    "job-boards.greenhouse.io",
    "boards.greenhouse.io",
    "jobs.lever.co",
    "myworkdayjobs.com",
    "ats.rippling.com",
]

LOCATION_FILTERS = ["NYC", "New York", "Remote", "Hybrid"]
MIN_SALARY = 100000

# ============================================================
# SEARCH URL GENERATION
# ============================================================

def generate_google_search_urls():
    """Generate all Google site: search URLs"""
    urls = []
    for domain in ATS_DOMAINS:
        for title in TITLE_VARIANTS:
            query = f'site:{domain} "{title}"'
            url = f"https://www.google.com/search?q={quote(query)}"
            urls.append({"platform": domain, "title": title, "url": url, "query": query})
    print(f"Generated {len(urls)} Google search URLs")
    return urls

def generate_linkedin_urls():
    """Generate LinkedIn Jobs search URLs"""
    urls = []
    for title in TITLE_VARIANTS:
        url = f"https://www.linkedin.com/jobs/search/?keywords={quote(title)}&location=New%20York%20City%20Metropolitan%20Area&f_WT=2"
        urls.append({"platform": "LinkedIn", "title": title, "url": url})
    return urls

def generate_indeed_urls():
    """Generate Indeed search URLs"""
    urls = []
    for title in TITLE_VARIANTS[:10]:  # Top 10 most relevant
        url = f"https://www.indeed.com/jobs?q={quote(title)}&l=New+York%2C+NY&sc=0kf%3Aattr(DSQF7)%3B"
        urls.append({"platform": "Indeed", "title": title, "url": url})
    return urls

# ============================================================
# SCRAPING (requires playwright)
# ============================================================

async def scrape_google_results(url, query):
    """Scrape Google search results for job listings"""
    from playwright.async_api import async_playwright
    
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url, wait_until="networkidle", timeout=15000)
        
        links = await page.query_selector_all("div.g a[href]")
        for link in links:
            href = await link.get_attribute("href")
            title_el = await link.query_selector("h3")
            title = await title_el.inner_text() if title_el else ""
            
            if href and any(d in href for d in ATS_DOMAINS):
                results.append({
                    "url": href,
                    "title": title,
                    "source_query": query,
                    "scraped_at": datetime.now().isoformat(),
                })
        
        await browser.close()
    return results

async def scrape_all():
    """Main scraping loop"""
    all_results = []
    urls = generate_google_search_urls()
    
    for i, entry in enumerate(urls):
        print(f"[{i+1}/{len(urls)}] Searching: {entry['query']}")
        try:
            results = await scrape_google_results(entry["url"], entry["query"])
            all_results.extend(results)
            print(f"  Found {len(results)} results")
        except Exception as e:
            print(f"  Error: {e}")
        time.sleep(2)  # Rate limiting
    
    # Deduplicate
    seen = set()
    unique = []
    for r in all_results:
        if r["url"] not in seen:
            seen.add(r["url"])
            unique.append(r)
    
    print(f"\\nTotal unique results: {len(unique)}")
    
    # Save
    with open("scraped_jobs.json", "w") as f:
        json.dump(unique, f, indent=2)
    
    return unique

# ============================================================
# AUTO-APPLY AGENT (Phase 2)
# ============================================================

async def auto_apply_greenhouse(url, resume_path, cover_letter):
    """Auto-fill Greenhouse application forms"""
    from playwright.async_api import async_playwright
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # Visible for review
        page = await browser.new_page()
        await page.goto(url, wait_until="networkidle")
        
        # Common Greenhouse form fields
        field_map = {
            "first_name": "Aaron",
            "last_name": "[YOUR LAST NAME]",
            "email": "[YOUR EMAIL]",
            "phone": "[YOUR PHONE]",
            "location": "New York, NY",
            "linkedin_profile": "[YOUR LINKEDIN]",
            "website": "[YOUR PORTFOLIO]",
        }
        
        for field_id, value in field_map.items():
            try:
                input_el = await page.query_selector(f'input[name*="{field_id}"], input[id*="{field_id}"]')
                if input_el:
                    await input_el.fill(value)
            except:
                pass
        
        # Upload resume
        try:
            file_input = await page.query_selector('input[type="file"]')
            if file_input:
                await file_input.set_input_files(resume_path)
        except:
            pass
        
        # Fill cover letter if text area exists
        try:
            cover_el = await page.query_selector('textarea[name*="cover_letter"], textarea[id*="cover_letter"]')
            if cover_el:
                await cover_el.fill(cover_letter)
        except:
            pass
        
        # PAUSE for manual review before submit
        print("\\n⚠️  REVIEW THE APPLICATION BEFORE SUBMITTING")
        print("   Press Enter to submit, or Ctrl+C to skip...")
        input()
        
        submit = await page.query_selector('button[type="submit"], input[type="submit"]')
        if submit:
            await submit.click()
            await page.wait_for_timeout(3000)
            print("✅ Application submitted!")
        
        await browser.close()

# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    import asyncio
    
    print("=" * 60)
    print("JOB SCRAPER — FDE / AI Deployment Role Hunter")
    print("=" * 60)
    print(f"Title variants: {len(TITLE_VARIANTS)}")
    print(f"ATS platforms: {len(ATS_DOMAINS)}")
    print(f"Total search combinations: {len(TITLE_VARIANTS) * len(ATS_DOMAINS)}")
    print()
    
    # Phase 1: Generate all search URLs
    google_urls = generate_google_search_urls()
    linkedin_urls = generate_linkedin_urls()
    indeed_urls = generate_indeed_urls()
    
    all_urls = google_urls + linkedin_urls + indeed_urls
    
    with open("search_urls.json", "w") as f:
        json.dump(all_urls, f, indent=2)
    print(f"Saved {len(all_urls)} search URLs to search_urls.json")
    
    # Phase 2: Scrape (uncomment to run)
    # asyncio.run(scrape_all())
    
    # Phase 3: Auto-apply (uncomment to run)
    # asyncio.run(auto_apply_greenhouse(
    #     "https://job-boards.greenhouse.io/anthropic/jobs/4985877008",
    #     "/path/to/resume.pdf",
    #     "Dear Hiring Manager, ..."
    # ))
`}</pre>
            </div>
            <div style={{ marginTop: 16, background: "#111118", border: "1px solid #333", borderRadius: 8, padding: 16 }}>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, color: "#fff", marginBottom: 8 }}>Setup Instructions</h3>
              <div style={{ fontSize: 11, color: "#999", lineHeight: 1.8 }}>
                <p><strong style={{ color: "#10b981" }}>1.</strong> Copy the script above and save as <code style={{ background: "#222", padding: "2px 6px", borderRadius: 3 }}>job_scraper.py</code></p>
                <p><strong style={{ color: "#10b981" }}>2.</strong> Install deps: <code style={{ background: "#222", padding: "2px 6px", borderRadius: 3 }}>pip install requests beautifulsoup4 playwright && playwright install chromium</code></p>
                <p><strong style={{ color: "#10b981" }}>3.</strong> Run: <code style={{ background: "#222", padding: "2px 6px", borderRadius: 3 }}>python job_scraper.py</code> — generates search_urls.json with {TITLE_VARIANTS.length * ATS_SITES.length + TITLE_VARIANTS.length + 10} URLs</p>
                <p><strong style={{ color: "#10b981" }}>4.</strong> Uncomment <code style={{ background: "#222", padding: "2px 6px", borderRadius: 3 }}>asyncio.run(scrape_all())</code> to actually scrape Google results</p>
                <p><strong style={{ color: "#10b981" }}>5.</strong> Results saved to scraped_jobs.json — add them to the Tracker tab above</p>
                <p style={{ marginTop: 8, color: "#f59e0b" }}>⚠️ The auto-apply agent runs in visible browser mode so you can review before submitting. It pre-fills all fields and pauses for your approval.</p>
              </div>
            </div>
            <div style={{ marginTop: 16, background: "#111118", border: "1px solid #333", borderRadius: 8, padding: 16 }}>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, color: "#fff", marginBottom: 8 }}>Search Coverage Stats</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, fontSize: 11, color: "#999" }}>
                <div><span style={{ color: "#8b5cf6", fontWeight: 700, fontSize: 18 }}>{TITLE_VARIANTS.length}</span><br/>Title Variants</div>
                <div><span style={{ color: "#8b5cf6", fontWeight: 700, fontSize: 18 }}>{ATS_SITES.length}</span><br/>ATS Platforms</div>
                <div><span style={{ color: "#8b5cf6", fontWeight: 700, fontSize: 18 }}>{TITLE_VARIANTS.length * ATS_SITES.length}</span><br/>Google site: Queries</div>
                <div><span style={{ color: "#3b82f6", fontWeight: 700, fontSize: 18 }}>{TITLE_VARIANTS.length}</span><br/>LinkedIn Queries</div>
                <div><span style={{ color: "#10b981", fontWeight: 700, fontSize: 18 }}>10</span><br/>Indeed Queries</div>
                <div><span style={{ color: "#f59e0b", fontWeight: 700, fontSize: 18 }}>{TITLE_VARIANTS.length * ATS_SITES.length + TITLE_VARIANTS.length + 10}</span><br/>Total Search URLs</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
