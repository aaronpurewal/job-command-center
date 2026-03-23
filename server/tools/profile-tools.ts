// Custom MCP tools for loading the user's profile and resume.
// These are registered as an in-process MCP server via the Agent SDK.

import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";

const PROJECT_ROOT = process.cwd();

export function loadProfileFromDisk(): Record<string, string> {
  const profilePath = join(PROJECT_ROOT, "profile.yaml");
  if (!existsSync(profilePath)) {
    throw new Error(
      "profile.yaml not found. Copy profile.example.yaml → profile.yaml and fill in your details.",
    );
  }
  const raw = readFileSync(profilePath, "utf-8");
  return parseYaml(raw) as Record<string, string>;
}

const loadProfile = tool(
  "load_profile",
  "Load the applicant's profile data from profile.yaml. Returns all profile fields as JSON.",
  {},
  async () => {
    try {
      const profile = loadProfileFromDisk();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(profile, null, 2) }],
      };
    } catch (e) {
      return {
        content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
        isError: true,
      };
    }
  },
  { annotations: { readOnlyHint: true } },
);

const getResumeText = tool(
  "get_resume_text",
  "Extract text content from the applicant's resume PDF. Returns the full text for use in answering custom questions.",
  {},
  async () => {
    const resumePath = join(PROJECT_ROOT, "resume.pdf");
    if (!existsSync(resumePath)) {
      return {
        content: [
          {
            type: "text" as const,
            text: "resume.pdf not found in project root. The applicant needs to add their resume.",
          },
        ],
        isError: true,
      };
    }

    try {
      // Dynamic import for pdf-parse (CommonJS module)
      const pdfParse = (await import("pdf-parse")).default;
      const buffer = readFileSync(resumePath);
      const data = await pdfParse(buffer);
      return {
        content: [{ type: "text" as const, text: data.text }],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to parse resume.pdf: ${e instanceof Error ? e.message : String(e)}`,
          },
        ],
        isError: true,
      };
    }
  },
  { annotations: { readOnlyHint: true } },
);

const getResumePath = tool(
  "get_resume_path",
  "Get the absolute file path to resume.pdf for uploading to application forms.",
  {},
  async () => {
    const resumePath = join(PROJECT_ROOT, "resume.pdf");
    if (!existsSync(resumePath)) {
      return {
        content: [{ type: "text" as const, text: "resume.pdf not found in project root." }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text" as const, text: resumePath }],
    };
  },
  { annotations: { readOnlyHint: true } },
);

export const profileServer = createSdkMcpServer({
  name: "profile",
  version: "1.0.0",
  tools: [loadProfile, getResumeText, getResumePath],
});
