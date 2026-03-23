// Scrape Agent: Uses Claude Agent SDK WebSearch to find job URLs,
// then Anthropic Batch API to parse page content at 50% off.
//
// Usage:
//   npx tsx server/agents/scrape-agent.ts           # full scrape
//   npx tsx server/agents/scrape-agent.ts --quick    # ATS sites only (faster)

import { query } from "@anthropic-ai/claude-agent-sdk";
import { generateQueryMatrix, detectATS, type SearchQuery } from "../config/scrape-config.js";
import { batchParsePages, type RawPage } from "../scraper/batch-parser.js";
import { loadJobs, saveJobs, mergeNewJobs, isDuplicate } from "../scraper/dedup.js";

const QUICK_MODE = process.argv.includes("--quick");

interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

// Run a batch of search queries through the Agent SDK.
// The agent executes WebSearch for each query and returns structured results.
async function runSearchBatch(queries: SearchQuery[]): Promise<SearchResult[]> {
  const queryList = queries
    .map((q, i) => `${i + 1}. ${q.query}`)
    .join("\n");

  const systemPrompt = `You are a job search agent. Execute each Google search query provided and collect ALL result URLs.

For each query, call WebSearch with the exact query string. Collect every result URL, title, and snippet.

After running ALL queries, output a single JSON array of all results:
[{"url": "...", "title": "...", "snippet": "..."}, ...]

IMPORTANT:
- Execute EVERY query in the list — do not skip any
- Include ALL results from every query
- Deduplicate by URL (if the same URL appears in multiple queries, include it only once)
- Output ONLY the JSON array, no other text`;

  const allResults: SearchResult[] = [];

  try {
    for await (const message of query({
      prompt: `Execute these ${queries.length} Google search queries and return ALL results as JSON:\n\n${queryList}`,
      options: {
        systemPrompt,
        allowedTools: ["WebSearch"],
        maxTurns: queries.length + 5, // enough turns for all queries + processing
        permissionMode: "bypassPermissions",
      },
    })) {
      if ((message as any).type === "result" && (message as any).subtype === "success" && (message as any).result) {
        // Try to extract JSON array from the result
        const jsonMatch = (message as any).result.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]) as SearchResult[];
            allResults.push(...parsed);
          } catch {
            console.error("  Failed to parse agent search results as JSON");
          }
        }
      }
    }
  } catch (e) {
    console.error(`  Search batch failed: ${e}`);
  }

  return allResults;
}

// Fetch page HTML using a lightweight agent call with WebFetch
async function fetchPageHtml(url: string): Promise<string | null> {
  try {
    for await (const message of query({
      prompt: `Fetch this URL and return the raw HTML content: ${url}`,
      options: {
        allowedTools: ["WebFetch"],
        maxTurns: 2,
        permissionMode: "bypassPermissions",
      },
    })) {
      if ((message as any).type === "result" && (message as any).subtype === "success" && (message as any).result) {
        return (message as any).result;
      }
    }
  } catch {
    return null;
  }
  return null;
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
  const existingCount = jobsData.jobs.length;
  console.log(`Existing jobs in database: ${existingCount}`);

  // Step 1: Run search queries in batches to avoid context overflow
  // Group queries into batches of ~15 per agent session
  const BATCH_SIZE = 15;
  const allSearchResults: SearchResult[] = [];
  const errors: { source: string; query: string; error: string; timestamp: string }[] = [];

  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(queries.length / BATCH_SIZE);
    console.log(`\n  Search batch ${batchNum}/${totalBatches} (${batch.length} queries)...`);

    try {
      const results = await runSearchBatch(batch);
      console.log(`  → Found ${results.length} results`);
      allSearchResults.push(...results);
    } catch (e) {
      console.error(`  Batch ${batchNum} failed: ${e}`);
      for (const q of batch) {
        errors.push({
          source: q.siteName,
          query: q.query,
          error: String(e),
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < queries.length) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // Step 2: Dedup search results against existing jobs
  const uniqueUrls = new Map<string, SearchResult>();
  for (const result of allSearchResults) {
    if (!isDuplicate(jobsData.jobs, result.url) && !uniqueUrls.has(result.url)) {
      uniqueUrls.set(result.url, result);
    }
  }

  console.log(`\n  Total search results: ${allSearchResults.length}`);
  console.log(`  After dedup: ${uniqueUrls.size} new unique URLs`);

  if (uniqueUrls.size === 0) {
    console.log("  No new jobs found. Done.");
    jobsData.last_scraped = new Date().toISOString();
    jobsData.scrape_stats = {
      total_queries: queries.length,
      new_jobs_found: 0,
      duplicates_skipped: allSearchResults.length,
      detail_fetch_failed: 0,
    };
    jobsData.scrape_errors = errors;
    saveJobs(jobsData);
    return;
  }

  // Step 3: Fetch page HTML for each new URL
  console.log(`\n  Fetching ${uniqueUrls.size} pages for parsing...`);
  const rawPages: RawPage[] = [];
  let fetchFailed = 0;
  let fetchCount = 0;

  for (const [url, result] of uniqueUrls) {
    fetchCount++;
    if (fetchCount % 10 === 0) {
      console.log(`  Fetched ${fetchCount}/${uniqueUrls.size}...`);
    }

    const html = await fetchPageHtml(url);
    if (html) {
      rawPages.push({
        url,
        html,
        ats: detectATS(url),
        source: "google_site_search",
      });
    } else {
      fetchFailed++;
      // Still add the job with basic info from search snippet
      const newJob = {
        url,
        title: result.title || null,
        company: null,
        ats: detectATS(url),
        location: null,
        salary: null,
        seniority: null,
        source: "google_site_search",
        scrape_detail_failed: true,
      };
      mergeNewJobs(jobsData, [newJob]);
    }

    // Small delay between fetches
    await new Promise((r) => setTimeout(r, 500));
  }

  // Step 4: Parse pages using Batch API (50% off)
  console.log(`\n  Parsing ${rawPages.length} pages via Batch API...`);
  const parsedJobs = await batchParsePages(rawPages);

  // Step 5: Add parsed jobs to database
  const validJobs = parsedJobs
    .filter((j) => j.is_job_posting && j.status !== "closed")
    .map((j) => ({
      url: j.url,
      title: j.title,
      company: j.company,
      ats: j.ats,
      location: j.location,
      salary: j.salary,
      seniority: j.seniority,
      source: j.source,
      scrape_detail_failed: j.parse_failed,
    }));

  const newCount = mergeNewJobs(jobsData, validJobs);

  // Step 6: Save results
  jobsData.last_scraped = new Date().toISOString();
  jobsData.scrape_stats = {
    total_queries: queries.length,
    new_jobs_found: newCount,
    duplicates_skipped: allSearchResults.length - uniqueUrls.size,
    detail_fetch_failed: fetchFailed + parsedJobs.filter((j) => j.parse_failed).length,
  };
  jobsData.scrape_errors = errors;
  saveJobs(jobsData);

  // Summary
  console.log("\n=== Scrape Complete ===");
  console.log(`  Queries executed: ${queries.length}`);
  console.log(`  New jobs found: ${newCount}`);
  console.log(`  Duplicates skipped: ${allSearchResults.length - uniqueUrls.size}`);
  console.log(`  Fetch/parse failures: ${fetchFailed + parsedJobs.filter((j) => j.parse_failed).length}`);
  console.log(`  Total jobs in database: ${jobsData.jobs.length}`);
  if (errors.length > 0) {
    console.log(`  Scrape errors: ${errors.length}`);
    for (const err of errors.slice(0, 5)) {
      console.log(`    - ${err.source}: ${err.error}`);
    }
  }
}

main().catch(console.error);
