// ── Deep per-publication style enrichment ──────────────────────────────────
// Curated/researched style + voice + audience detail that goes BEYOND the
// imported swipe-file (which is mostly one-liners). Applied to the live
// Publications rows by ensurePublicationEnrichment() so the agents' brand/
// publication matching writes in each outlet's real register.
//
// Keyed by a normalized publication name; matched leniently (equals or
// row-name-includes-key). Add outlets in batches — fields provided here
// OVERWRITE the matching column because this data is higher quality.
export interface PubEnrichment {
  match: string; // normalized name fragment to find the row by
  writingStyle?: string;
  editorLikes?: string;
  editorStyle?: string;
  doNotWrite?: string;
  targetAudience?: string;
  submission?: string;
}

export const PUBLICATION_ENRICHMENT: PubEnrichment[] = [
  {
    match: "success",
    writingStyle: "Personal and professional development for self-made achievers. AP style with in-house exceptions. Take a broad topic (e.g. leadership) and hone to ONE specific angle. Essays with anecdotes that illustrate real experience, backed by research and relevant examples, always with tangible takeaways that explain the 'how' behind the message.",
    editorLikes: "Compelling, well-written pieces on personal development, professional growth, soft skills, and self-discovery; demonstrated expertise and tangible, actionable advice; a clear single angle with practical takeaways.",
    doNotWrite: "Biased promotion of a product or company; old information or unoriginal ideas; broad claims lacking evidence; bare personality profiles with no reader takeaway.",
    targetAudience: "Aspirational, self-responsible achievers — entrepreneurs, micro-business owners, and professionals who own their growth and income and want practical tips, traits, and tactics to improve personally and professionally.",
    submission: "Editor Kristen Tribe oversees the freelancer/contributor program. News-pegged pitch idea + writing samples required. Monday.com pitch form.",
  },
  {
    match: "inc",
    writingStyle: "Fresh perspectives and original insight — never generic business advice. 'Profiles with a purpose': someone doing something in business that carries a clear takeaway for founders. Concise and specific.",
    editorLikes: "An original angle backed by data/stats or a breaking-news peg; real business experience (strategies, mistakes, successes) over products; a clear, transferable reader takeaway.",
    doNotWrite: "Generic business advice; product or company promotion; personality profiles with no takeaway; recycled ideas.",
    targetAudience: "CEOs, founders, and small-to-medium business owners; startup and tech business leaders — NOT internet marketers or online-hustle audiences.",
    submission: "Pitch in a few sentences to contributors@inc.com (or Graham Winfrey / the Inc. columnist proposal form).",
  },
  {
    match: "fast company",
    writingStyle: "Lively, polished writing that balances research or news with memorable anecdotes and examples. Op-ed, not content marketing — introduce a new idea and advance the conversation. 600–900 words.",
    editorLikes: "New ideas and trends that engage readers; a POV supported by real business experience; Work Life topics (productivity, creativity, career, hiring, culture, entrepreneurship, innovation) or Impact topics (climate, sustainability, social justice).",
    doNotWrite: "Over-the-top self-promotion; dense jargon; abstract blanket assertions; press releases, abstracts, or outlines (send complete pieces).",
    targetAudience: "Business leaders, innovators, and creative professionals shaping the future of work.",
    submission: "Complete, unpublished articles (600–900 words) to submissions@fastcompany.com. No pay, but strong promotion.",
  },
  {
    match: "entrepreneur",
    writingStyle: "Conversational and direct; authentic first-hand expertise. A genuinely contrarian angle + data backing the claim + clear practical application for the founder/executive reader.",
    editorLikes: "Personal stories and lessons learned first-hand — successes, struggles, pivots; contrarian angles backed by data; actionable insight; writers open to revisions.",
    doNotWrite: "Promotional material, advertorials, or paid placements disguised as journalism; generic advice.",
    targetAudience: "Entrepreneurs, startup founders, small business owners, and executives seeking solutions, new ideas, and inspiration.",
  },
  {
    match: "business insider",
    writingStyle: "Juicy, fun, entertaining, and insightful — the reader hops paragraph to paragraph. Minimal jargon. Often as-told-to format (mention it in the pitch if used).",
    editorLikes: "Actionable insight and fresh perspectives for a 'go-getter' audience; a specific sub-audience with clear pain points (e.g. Gen Z creators, millennial-mom side-hustlers); as-told-to stories.",
    doNotWrite: "Jargon-heavy or medical tone; non-exclusive pitches (all pitches must be exclusive); unverified claims — editors require proof (emails, screenshots, documentation).",
    targetAudience: "Entrepreneurship, tech, and economy 'go-getters' — broad but ambitious; aspiring creators, side-hustlers, millennials and Gen Z.",
  },
  {
    match: "forbes",
    writingStyle: "Bylined op-ed/analysis from a subject-matter authority writing in ONE specific lane. Three story types Forbes loves: Innovation (changing an industry with new ideas/tech), Impact (real-world outcomes/community benefit), Inspiration (overcoming adversity — especially founders and small businesses).",
    editorLikes: "A unique, authoritative perspective targeted to the right editor's beat; genuine thought leadership with clear value to Forbes' audience.",
    doNotWrite: "Mass/untargeted pitches; pitching outside an editor's beat (a fintech story to a healthcare writer); promotional fluff.",
    targetAudience: "Business owners, C-suite executives, investors, and financial professionals.",
    submission: "Pitch the relevant contributor editor for your beat. Forbes Councils requires $500k+ revenue or 3+ years as a recognized coach.",
  },
  {
    match: "cnbc make it",
    writingStyle: "Career- and money-oriented for a YOUNGER reader — write to them, not a C-suite peer. 600–900 words, anchored on a specific data point; every piece connects to the reader's financial or career self-interest.",
    editorLikes: "A specific data point or finding; proprietary research, internal data, or quantified outcomes; brevity and specificity (≤150-word pitch).",
    doNotWrite: "Opinion dressed as analysis; positions stated without evidence; writing to executives instead of the career-building reader.",
    targetAudience: "Young professionals and millennials focused on earning more, spending smarter, and building wealth.",
  },
  {
    match: "kiplinger",
    writingStyle: "Practical, present-tense personal finance that matters to real people right now. Sections: Ahead (finance/economic news), Investing (stocks/funds), Your Money (taxes, insurance, college saving), Rewards (big-ticket advice).",
    editorLikes: "Stories that are important to real people in the present moment; clear, actionable money guidance.",
    doNotWrite: "Executive profiles or stories about how great a CEO/CFO is — emphatically not published.",
    targetAudience: "Highly educated, managerial readers (~70% male, ~$70k+ household income) focused on retirement, investing, taxes, and building long-term wealth.",
  },
  {
    match: "women's health",
    writingStyle: "The newest, most innovative stories in the women's-health sphere — burgeoning trends, new tools reshaping an industry, investigations, women pushing boundaries, medical-progress stories. Feature the voices of real women.",
    editorLikes: "A specific STORY (not a topic), with a data/quantitative measure, real-women voices, and a service element (sidebar or how-to); timely hooks turned around fast.",
    doNotWrite: "Pitches that are too broad or vague; a topic instead of a story; ideas already covered elsewhere.",
    targetAudience: "Women seeking science-backed wellness, fitness, and nutrition — readers who want to live happier, healthier lives.",
  },
  {
    match: "parents",
    writingStyle: "Fresh, current, well-researched service journalism for millennial parents of kids under 10. Parenting changes daily — keep it current; practical and reassuring, never judgmental.",
    editorLikes: "Pregnancy and kids'-health angles; genuinely fresh takes not already on the site (check site:parents.com first); clear service value for new-generation moms and dads.",
    doNotWrite: "Recycled topics already covered; judgmental or preachy tone; thin, unresearched takes.",
    targetAudience: "Millennial moms and dads with children under age 10.",
  },
  {
    match: "black enterprise",
    writingStyle: "Thought-provoking commentary and actionable insight on personal finance, small business, and careers for Black professionals and entrepreneurs — deep dives plus practical steps.",
    editorLikes: "Personal finance, small business, and careers (plus tech, lifestyle, development); pitches sent to the SPECIFIC section editor; relationship-built, well-targeted ideas.",
    doNotWrite: "Identical mass pitches to every editor; wrong editor name/title; generic, unfocused ideas.",
    targetAudience: "Black professionals, entrepreneurs, executives, and investors building generational wealth.",
  },
];
