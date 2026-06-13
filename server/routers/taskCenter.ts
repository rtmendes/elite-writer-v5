/**
 * Task Center — ports the old app's single AI-task entry point into v5.
 * One console to (a) fire any proactive agent job on demand and (b) hand a
 * one-off instruction to any of the 18 agent personas (free model + its SOP).
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM, TIER } from "../_core/llm";
import { skillBlockFor } from "../_core/skills";
import { AGENT_PERSONAS } from "./agents";
import { PROACTIVE_JOBS, type ProactiveJobName } from "../_core/proactiveAgents";

const JOBS: { name: ProactiveJobName; label: string; description: string }[] = [
  { name: "scout", label: "News scout", description: "Find fresh news-pegged article ideas for your beats" },
  { name: "scorer", label: "Idea scorer", description: "Score un-scored pipeline ideas for acceptance & pay" },
  { name: "guardian", label: "Quality guardian", description: "Run the 8-point quality gate on packages heading to editors" },
  { name: "opportunities", label: "Opportunity scout", description: "Exa sweep for live paid writing opportunities" },
  { name: "modelwatch", label: "Model quality watch", description: "Benchmark free vs paid models on the house anchors" },
  { name: "sourcesrefresh", label: "Feed sources refresh", description: "Pull + screen all followed sources; purge stale items" },
];

export const taskCenterRouter = router({
  jobs: protectedProcedure.query(() => JOBS),

  personas: protectedProcedure.query(() =>
    Object.entries(AGENT_PERSONAS).map(([id, p]) => ({ id, name: p.name, role: p.role }))),

  runJob: protectedProcedure
    .input(z.object({ name: z.enum(["scout", "scorer", "guardian", "opportunities", "modelwatch", "sourcesrefresh"]) }))
    .mutation(async ({ input }) => {
      const job = PROACTIVE_JOBS[input.name as ProactiveJobName];
      if (!job) throw new Error(`Unknown job: ${input.name}`);
      // Jobs are self-guarded (gap-limited) and write to the workspace DBs; fire and report.
      await job();
      return { ok: true, ran: input.name };
    }),

  submit: protectedProcedure
    .input(z.object({ persona: z.string().min(1), instruction: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const persona = AGENT_PERSONAS[input.persona];
      if (!persona) throw new Error(`Unknown agent: ${input.persona}`);
      const sop = await skillBlockFor(input.persona);
      const res = await invokeLLM({
        model: TIER.freeBig,
        maxTokens: 4000,
        messages: [
          { role: "system", content: persona.systemPrompt + sop },
          { role: "user", content: input.instruction },
        ],
      });
      return {
        agent: persona.name,
        role: persona.role,
        output: res.choices?.[0]?.message?.content ?? "",
        model: res.model,
      };
    }),
});
