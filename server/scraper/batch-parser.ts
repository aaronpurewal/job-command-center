// Batch parser: sends job page HTML to the Anthropic Batch API
// for structured extraction at 50% token cost.
// Falls back to single-request parsing if batch is unavailable.

import { PARSE_SYSTEM_PROMPT, PARSE_FEW_SHOT_EXAMPLES } from "../agents/prompts/scrape-parse.js";

// Dynamic import to handle both CJS/ESM
let client: any;
async function getClient() {
  if (!client) {
    const mod = await import("@anthropic-ai/sdk");
    const Anthropic = (mod as any).default || mod;
    client = new Anthropic();
  }
  return client;
}

export interface RawPage {
  url: string;
  html: string;
  ats: string;
  source: string;
}

export interface ParsedJob {
  url: string;
  ats: string;
  source: string;
  is_job_posting: boolean;
  title: string | null;
  company: string | null;
  location: string | null;
  salary: string | null;
  seniority: string | null;
  employment_type: string | null;
  status: string | null;
  parse_failed: boolean;
  parse_fail_reason: string | null;
}

// Truncate HTML to avoid blowing up token limits.
// Strip script/style tags and limit to ~8000 chars of visible content.
function cleanHtml(html: string): string {
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length > 8000) {
    cleaned = cleaned.slice(0, 8000) + "\n[...truncated]";
  }
  return cleaned;
}

// Parse a single page using a direct API call (non-batch fallback)
export async function parseSinglePage(page: RawPage): Promise<ParsedJob> {
  const cleaned = cleanHtml(page.html);

  try {
    const anthropic = await getClient();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6-20250514",
      max_tokens: 400,
      system: PARSE_SYSTEM_PROMPT,
      messages: [
        ...PARSE_FEW_SHOT_EXAMPLES,
        { role: "user", content: cleaned },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(text);

    return {
      url: page.url,
      ats: page.ats,
      source: page.source,
      ...parsed,
    };
  } catch (e) {
    return {
      url: page.url,
      ats: page.ats,
      source: page.source,
      is_job_posting: false,
      title: null,
      company: null,
      location: null,
      salary: null,
      seniority: null,
      employment_type: null,
      status: null,
      parse_failed: true,
      parse_fail_reason: `parse_error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// Parse multiple pages using the Anthropic Batch API (50% off tokens).
// Polls for completion — small batches typically finish in minutes.
export async function batchParsePages(pages: RawPage[]): Promise<ParsedJob[]> {
  if (pages.length === 0) return [];

  // For very small batches, use direct calls instead
  if (pages.length <= 3) {
    const results: ParsedJob[] = [];
    for (const page of pages) {
      results.push(await parseSinglePage(page));
    }
    return results;
  }

  const requests = pages.map((page, i) => ({
    custom_id: `job-${i}`,
    params: {
      model: "claude-sonnet-4-6-20250514" as const,
      max_tokens: 400,
      system: PARSE_SYSTEM_PROMPT,
      messages: [
        ...PARSE_FEW_SHOT_EXAMPLES,
        { role: "user" as const, content: cleanHtml(page.html) },
      ],
    },
  }));

  try {
    const anthropic = await getClient();
    // Create the batch
    const batch = await anthropic.batches.create({ requests });
    console.log(`  Batch ${batch.id} created with ${pages.length} requests`);

    // Poll for completion
    let result = batch;
    while (result.processing_status === "in_progress") {
      await new Promise((r) => setTimeout(r, 5000)); // check every 5s
      result = await anthropic.batches.retrieve(batch.id);
      const counts = result.request_counts;
      console.log(
        `  Batch progress: ${counts.succeeded}/${counts.processing + counts.succeeded} ` +
          `(${counts.errored} errors)`,
      );
    }

    if (result.processing_status !== "ended") {
      console.error(`  Batch failed with status: ${result.processing_status}`);
      // Fallback to single parsing
      return Promise.all(pages.map(parseSinglePage));
    }

    // Retrieve results
    const parsed: ParsedJob[] = [];
    const resultStream = await anthropic.batches.results(batch.id);

    for await (const entry of resultStream) {
      const idx = parseInt(entry.custom_id.replace("job-", ""), 10);
      const page = pages[idx];

      if (entry.result.type === "succeeded") {
        try {
          const msg = entry.result.message;
          const text =
            msg.content[0].type === "text" ? msg.content[0].text : "";
          const data = JSON.parse(text);
          parsed.push({ url: page.url, ats: page.ats, source: page.source, ...data });
        } catch {
          parsed.push({
            url: page.url,
            ats: page.ats,
            source: page.source,
            is_job_posting: false,
            title: null,
            company: null,
            location: null,
            salary: null,
            seniority: null,
            employment_type: null,
            status: null,
            parse_failed: true,
            parse_fail_reason: "batch_result_parse_error",
          });
        }
      } else {
        parsed.push({
          url: page.url,
          ats: page.ats,
          source: page.source,
          is_job_posting: false,
          title: null,
          company: null,
          location: null,
          salary: null,
          seniority: null,
          employment_type: null,
          status: null,
          parse_failed: true,
          parse_fail_reason: `batch_error: ${entry.result.type}`,
        });
      }
    }

    return parsed;
  } catch (e) {
    console.error(`  Batch API failed, falling back to single parsing: ${e}`);
    return Promise.all(pages.map(parseSinglePage));
  }
}
