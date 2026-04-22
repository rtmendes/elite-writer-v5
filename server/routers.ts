import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { aiRouter } from "./routers/ai";
import { dataRouter } from "./routers/data";
import { newsRouter, intelligenceRouter } from "./routers/news";
import { mediaRouter } from "./routers/media";
import { kbRouter } from "./routers/kb";
import { googleRouter } from "./routers/google";
import { publicationsRouter } from "./routers/publications";
import { assetsRouter } from "./routers/assets";
import { feedsRouter, funnelsRouter } from "./routers/feeds";
import { researchRouter } from "./routers/research";
import { toolsRouter } from "./routers/tools";
import { agenticRouter } from "./routers/agentic";
import { productCreationRouter } from "./routers/products";
import { creativeRouter } from "./routers/creative";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Original routers
  ai: aiRouter,
  data: dataRouter,

  // Ported from elite-writer-app (57 API functions)
  news: newsRouter,
  intelligence: intelligenceRouter,
  media: mediaRouter,
  kb: kbRouter,
  google: googleRouter,
  publications: publicationsRouter,
  assets: assetsRouter,
  feeds: feedsRouter,
  funnels: funnelsRouter,
  research: researchRouter,
  tools: toolsRouter,

  // Integration features — Agentic Editor, Product Creation, Creative Generation
  agentic: agenticRouter,
  productCreation: productCreationRouter,
  creative: creativeRouter,
});

export type AppRouter = typeof appRouter;
