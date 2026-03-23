import { readFileSync, writeFileSync, existsSync } from "fs";
import { randomBytes } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const JOBS_PATH = join(__dirname, "../data/jobs.json");

export interface Job {
  id: string;
  url: string;
  title: string | null;
  company: string | null;
  ats: string;
  location: string | null;
  salary: string | null;
  seniority: string | null;
  source: string;
  date_found: string;
  date_applied: string | null;
  status: "new" | "applied" | "skipped";
  scrape_detail_failed: boolean;
}

export interface JobsData {
  jobs: Job[];
  last_scraped: string | null;
  scrape_stats: {
    total_queries: number;
    new_jobs_found: number;
    duplicates_skipped: number;
    detail_fetch_failed: number;
  } | null;
  scrape_errors: { source: string; query: string; error: string; timestamp: string }[];
}

export function loadJobs(): JobsData {
  if (!existsSync(JOBS_PATH)) {
    return { jobs: [], last_scraped: null, scrape_stats: null, scrape_errors: [] };
  }
  const raw = readFileSync(JOBS_PATH, "utf-8");
  return JSON.parse(raw) as JobsData;
}

export function saveJobs(data: JobsData): void {
  writeFileSync(JOBS_PATH, JSON.stringify(data, null, 2));
}

export function generateId(): string {
  return randomBytes(6).toString("hex");
}

// Normalize URL for dedup: strip trailing slashes, query params, fragments
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove common tracking params
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    u.searchParams.delete("ref");
    u.searchParams.delete("source");
    u.searchParams.delete("gh_jid");
    u.hash = "";
    return u.toString().replace(/\/+$/, "");
  } catch {
    return url.replace(/\/+$/, "");
  }
}

// Check if a URL already exists in the jobs list
export function isDuplicate(jobs: Job[], url: string): boolean {
  const normalized = normalizeUrl(url);
  return jobs.some((j) => normalizeUrl(j.url) === normalized);
}

// Add new jobs, skipping duplicates. Returns count of new jobs added.
export function mergeNewJobs(
  existing: JobsData,
  newJobs: Omit<Job, "id" | "date_found" | "date_applied" | "status">[],
): number {
  const today = new Date().toISOString().split("T")[0];
  let added = 0;

  for (const job of newJobs) {
    if (isDuplicate(existing.jobs, job.url)) continue;

    existing.jobs.push({
      ...job,
      id: generateId(),
      date_found: today,
      date_applied: null,
      status: "new",
    });
    added++;
  }

  return added;
}

// Mark a job as applied
export function markApplied(data: JobsData, jobId: string): boolean {
  const job = data.jobs.find((j) => j.id === jobId);
  if (!job) return false;
  job.status = "applied";
  job.date_applied = new Date().toISOString();
  return true;
}

// Get jobs grouped by status
export function getJobsByStatus(data: JobsData) {
  const today = new Date().toISOString().split("T")[0];
  return {
    newToday: data.jobs.filter((j) => j.status === "new" && j.date_found === today),
    previouslySeen: data.jobs.filter((j) => j.status === "new" && j.date_found !== today),
    applied: data.jobs.filter((j) => j.status === "applied"),
    skipped: data.jobs.filter((j) => j.status === "skipped"),
  };
}
