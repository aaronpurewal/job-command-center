// Scrape Agent: Uses Claude Agent SDK WebSearch to find job URLs,
// then plain HTTP fetch + Anthropic API for page parsing.
//
// Usage:
//   npx tsx server/agents/scrape-agent.ts           # full scrape
//   npx tsx server/agents/scrape-agent.ts --quick    # ATS sites only

import { config } from "dotenv";
config();

import { query } from "@anthropic-ai/claude-agent-sdk";
import { generateQueryMatrix, detectATS } from "../config/scrape-config.js";
import { parseSinglePage } from "../scraper/batch-parser.js";
import { loadJobs, saveJobs, mergeNewJobs, isDuplicate } from "../scraper/dedup.js";

const QUICK_MODE = process.argv.includes("--quick");

interface SearchResult { url: string; title: string; }

// URLs that are search/index pages, not actual job postings
const JUNK_URL_PATTERNS = [
  /wellfound\.com\/jobs\?/, // wellfound search results page
  /startup\.jobs\/roles\//, // startup.jobs category pages
  /startup\.jobs\/interview-questions\//, // interview prep pages
  /startup\.jobs\/artificial-intelligence-jobs$/, // index page
  /startup\.jobs\/jobs\?/, // search results
  /startup\.jobs\/company\//, // company profiles (not job posts)
  /indeed\.com/, // removed entirely
  /news\.ycombinator\.com/, // HN comments
  /greenhouse\.io\/job-board$/, // greenhouse index
  /greenhouse\.io\/embed\//, // embed widgets
  /jobs\.ashbyhq\.com\/?$/, // ashby index
];

// Titles that indicate non-job-posting content
const JUNK_TITLE_PATTERNS = [
  /^link$/i,
  /^view$/i,
  /^ask hn/i,
  /^comment on/i,
  /^i analyzed/i,
  /^what (is|are)/i,
  /^why /i,
  /search directly/i,
  /^greenhouse\.io/,
  /^jobs\.ashbyhq\.com$/,
  /March 2026\)$/,  // "Mistral AI Jobs (March 2026)"
];

// Extract URLs from agent result text (markdown links, bare URLs)
function extractUrls(text: string): SearchResult[] {
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)) {
    const url = match[2].replace(/\/+$/, "");
    let title = match[1].trim();

    // Skip junk URLs
    if (JUNK_URL_PATTERNS.some((p) => p.test(url))) continue;

    // Skip junk titles
    if (JUNK_TITLE_PATTERNS.some((p) => p.test(title))) continue;

    // If title is just "Link" or a bare URL, try to extract from URL slug
    if (/^(link|view)$/i.test(title) || title.includes(".com")) {
      const slug = url.split("/").pop()?.replace(/[-_]/g, " ").replace(/[a-f0-9]{8,}/g, "").trim();
      if (slug && slug.length > 3) {
        title = slug.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      } else {
        continue; // Can't extract a meaningful title, skip
      }
    }

    if (!seen.has(url)) {
      seen.add(url);
      results.push({ url, title });
    }
  }

  return results;
}

// Fetch page content using plain HTTP (no agent overhead)
async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    return html;
  } catch {
    return null;
  }
}

async function main() {
  console.log("\n=== Job Command Center — Scrape Agent ===\n");

  const allQueries = generateQueryMatrix();
  const queries = QUICK_MODE
    ? allQueries.filter((q) => q.siteOperator.includes("site:"))
    : allQueries;

  console.log(`Mode: ${QUICK_MODE ? "QUICK (ATS sites only)" : "FULL"}`);
  console.log(`Queries to execute: ${queries.length}`);

  const jobsData = loadJobs();
  console.log(`Existing jobs in database: ${jobsData.jobs.length}`);

  // Step 1: Run all searches via Agent SDK (one query() call per search)
  const allSearchResults: SearchResult[] = [];
  const errors: { source: string; query: string; error: string; timestamp: string }[] = [];

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    console.log(`\n  [${i + 1}/${queries.length}] ${q.siteName}: ${q.query.slice(0, 80)}...`);

    try {
      for await (const message of query({
        prompt: `Search Google for: ${q.query}\n\nList every result with title and URL.`,
        options: {
          allowedTools: ["WebSearch"],
          maxTurns: 3,
          permissionMode: "bypassPermissions",
        },
      })) {
        const msg = message as any;
        if (msg.type === "result" && msg.subtype === "success" && msg.result) {
          const urls = extractUrls(msg.result);
          console.log(`    → ${urls.length} results`);
          allSearchResults.push(...urls);
        }
      }
    } catch (e) {
      console.error(`    ✗ Search failed: ${e}`);
      errors.push({ source: q.siteName, query: q.query, error: String(e), timestamp: new Date().toISOString() });
    }

    // Delay between searches
    await new Promise((r) => setTimeout(r, 1500));
  }

  // Step 2: Dedup
  const uniqueUrls = new Map<string, SearchResult>();
  for (const result of allSearchResults) {
    if (!isDuplicate(jobsData.jobs, result.url) && !uniqueUrls.has(result.url)) {
      uniqueUrls.set(result.url, result);
    }
  }

  console.log(`\n  Total search results: ${allSearchResults.length}`);
  console.log(`  Unique new URLs: ${uniqueUrls.size}`);

  if (uniqueUrls.size === 0) {
    console.log("  No new jobs found.");
    jobsData.last_scraped = new Date().toISOString();
    jobsData.scrape_stats = { total_queries: queries.length, new_jobs_found: 0, duplicates_skipped: allSearchResults.length, detail_fetch_failed: 0 };
    jobsData.scrape_errors = errors;
    saveJobs(jobsData);
    return;
  }

  // Step 3: Fetch pages with plain HTTP + parse with Anthropic API
  console.log(`\n  Fetching & parsing ${uniqueUrls.size} pages...`);
  let fetchCount = 0;
  let fetchFailed = 0;
  let parseSuccess = 0;

  for (const [url, result] of uniqueUrls) {
    fetchCount++;
    process.stdout.write(`  [${fetchCount}/${uniqueUrls.size}] `);

    const html = await fetchPage(url);
    if (!html) {
      fetchFailed++;
      // Add with basic search snippet info
      mergeNewJobs(jobsData, [{
        url, title: result.title || null, company: null, ats: detectATS(url),
        location: null, salary: null, seniority: null, source: "google_site_search", scrape_detail_failed: true,
      }]);
      console.log(`⚠ Fetch failed — added with title: ${result.title}`);
      continue;
    }

    try {
      const parsed = await parseSinglePage({ url, html, ats: detectATS(url), source: "google_site_search" });

      if (parsed.is_job_posting && parsed.status !== "closed") {
        mergeNewJobs(jobsData, [{
          url, title: parsed.title || result.title || null, company: parsed.company,
          ats: parsed.ats, location: parsed.location, salary: parsed.salary,
          seniority: parsed.seniority, source: parsed.source, scrape_detail_failed: false,
        }]);
        parseSuccess++;
        console.log(`✓ ${parsed.title} @ ${parsed.company} | ${parsed.location || '?'} | ${parsed.salary || 'no salary'}`);
      } else if (parsed.status === "closed") {
        console.log(`✗ Closed`);
      } else if (!parsed.is_job_posting) {
        console.log(`✗ Not a job posting`);
      } else if (parsed.parse_failed) {
        // Add with basic info on parse failure
        mergeNewJobs(jobsData, [{
          url, title: result.title || null, company: null, ats: detectATS(url),
          location: null, salary: null, seniority: null, source: "google_site_search", scrape_detail_failed: true,
        }]);
        console.log(`⚠ Parse failed: ${parsed.parse_fail_reason}`);
      }
    } catch (e) {
      fetchFailed++;
      console.log(`✗ Parse error: ${e}`);
    }

    // Small delay to respect rate limits
    await new Promise((r) => setTimeout(r, 300));
  }

  // Step 4: Save
  const today = new Date().toISOString().split("T")[0];
  const newCount = jobsData.jobs.filter((j) => j.date_found === today && j.status === "new").length;

  jobsData.last_scraped = new Date().toISOString();
  jobsData.scrape_stats = {
    total_queries: queries.length, new_jobs_found: newCount,
    duplicates_skipped: allSearchResults.length - uniqueUrls.size, detail_fetch_failed: fetchFailed,
  };
  jobsData.scrape_errors = errors;
  saveJobs(jobsData);

  console.log("\n=== Scrape Complete ===");
  console.log(`  Queries: ${queries.length} | New jobs: ${newCount} | Parse success: ${parseSuccess} | Failures: ${fetchFailed}`);
  console.log(`  Total in database: ${jobsData.jobs.length}`);
}

main().catch(console.error);
