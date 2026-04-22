/**
 * Tools Router — 3 endpoints ported from elite-writer-app
 * Covers: affine-create-page, affine-folders, mcp/index
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";

const AFFINE_BASE = "https://app.affine.pro";

async function affineRequest(path: string, options: RequestInit = {}) {
  if (!ENV.affineApiKey) throw new Error("AFFINE_API_KEY not configured");

  const resp = await fetch(`${AFFINE_BASE}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.affineApiKey}`,
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Affine API error (${resp.status}): ${body.slice(0, 200)}`);
  }

  return resp.json();
}

export const toolsRouter = router({
  // Create a page in Affine
  affineCreatePage: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      title: z.string().min(1),
      content: z.string().optional(),
      parentId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const data = await affineRequest(`/workspaces/${input.workspaceId}/pages`, {
        method: "POST",
        body: JSON.stringify({
          title: input.title,
          content: input.content || "",
          parentId: input.parentId,
        }),
      });

      return {
        success: true,
        pageId: data.id,
        url: `${AFFINE_BASE}/workspace/${input.workspaceId}/${data.id}`,
      };
    }),

  // List Affine workspace folders
  affineFolders: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
    }))
    .query(async ({ input }) => {
      const data = await affineRequest(`/workspaces/${input.workspaceId}/pages`);

      // Filter to folder-like pages (those with children)
      return {
        success: true,
        folders: (data as any[]).filter((p: any) => p.isFolder || p.children?.length > 0),
        totalPages: (data as any[]).length,
      };
    }),

  // MCP-compatible tool listing (for AI agents)
  mcpList: protectedProcedure.query(() => ({
    tools: [
      {
        name: "research",
        description: "Search the web and return comprehensive research on a topic",
        parameters: { query: "string", focusArea: "string?" },
      },
      {
        name: "generate_image",
        description: "Generate an editorial-quality image from a text prompt",
        parameters: { prompt: "string", style: "editorial|infographic" },
      },
      {
        name: "generate_draft",
        description: "Generate an article draft from a topic and research",
        parameters: { topic: "string", research: "string?", style: "string?" },
      },
      {
        name: "score_article",
        description: "Score an article on multiple quality dimensions",
        parameters: { content: "string" },
      },
      {
        name: "generate_pitch",
        description: "Generate a publication pitch for an article",
        parameters: { articleTitle: "string", publicationName: "string?" },
      },
      {
        name: "search_kb",
        description: "Search the knowledge base for relevant information",
        parameters: { query: "string" },
      },
      {
        name: "send_email",
        description: "Send an email via Gmail integration",
        parameters: { to: "string", subject: "string", body: "string" },
      },
      {
        name: "create_doc",
        description: "Create a Google Doc with content",
        parameters: { title: "string", content: "string?" },
      },
    ],
  })),
});
