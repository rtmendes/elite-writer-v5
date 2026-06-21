export const ENV = {
  appId: process.env.VITE_APP_ID ?? "elite-writer-v5",
  // Dev gets a fixed placeholder so JWT signing works offline; prod must set a
  // real JWT_SECRET (empty there fails loudly, by design). This is a local dev
  // constant, not a real secret.
  cookieSecret: process.env.JWT_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "dev-insecure-jwt-secret"),
  databaseUrl: process.env.DATABASE_URL ?? "",
  // Direct API keys (standalone deployment - no Manus/Forge dependency)
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  perplexityApiKey: process.env.PERPLEXITY_API_KEY ?? "",
  // News APIs
  newsapiKey: process.env.NEWSAPI_KEY ?? "",
  mediastackKey: process.env.MEDIASTACK_KEY ?? "",
  gnewsKey: process.env.GNEWS_KEY ?? process.env.GNEWSAPI_KEY ?? "",
  // Image/Video generation
  stabilityAiKey: process.env.STABILITY_AI_KEY ?? "",
  runwareApiKey: process.env.RUNWARE_API_KEY ?? "",
  falAiApiKey: process.env.FAL_AI_API_KEY ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  piapiKey: process.env.PIAPI_KEY ?? "",
  // Multi-model routing
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  // Additional news APIs
  newsdataKey: process.env.NEWSDATA_KEY ?? "",
  // KIE intelligence
  kieApiKey: process.env.KIE_API_KEY ?? "",
  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  // YouTube
  youtubeApiKey: process.env.YOUTUBE_API_KEY ?? "",
  // Supabase (for KB vector search / legacy data)
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  // R2 object storage (cover images & media — keeps base64 out of the DB)
  r2AccountId: process.env.R2_ACCOUNT_ID ?? "",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  r2Bucket: process.env.R2_BUCKET ?? "elite-writer-media",
  r2PublicUrl: process.env.R2_PUBLIC_URL ?? "", // e.g. https://media.insightprofit.live or the r2.dev URL
  // App config
  braveApiKey: process.env.BRAVE_API_KEY ?? "",
  activepiecesWebhook: process.env.ACTIVEPIECES_WEBHOOK_URL ?? "",
  appUrl: process.env.APP_URL ?? "https://elitewriter.insightprofit.live",
  adminEmail: process.env.ADMIN_EMAIL ?? "",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // Affine (optional)
  affineWorkspaceUrl: process.env.AFFINE_WORKSPACE_URL ?? "",
  affineApiKey: process.env.AFFINE_API_KEY ?? "",
  // Legacy compat
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
