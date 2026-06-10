// Elite Writer V5 — Publication-Specific Article Instructions (SOPs)
// Gap #2 Fix: AI agent instructions tailored to each publication's audience, format, and editorial preferences
// Used by scoring engine, draft generation, pitch creation, and content filters

export interface PublicationSOP {
  publicationId: string;
  audienceProfile: string;
  contentFormatRules: string;
  toneGuidelines: string;
  exampleAngles: string[];
  contentFilters: ContentFilter[];
  enhancementPrompts: Record<string, string>;
  scoringWeightOverrides?: Partial<Record<string, number>>;
}

export interface ContentFilter {
  dimension: string;
  rule: string;
  threshold: number;
  action: 'warn' | 'block' | 'enhance';
  fix: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DETAILED SOPS — Top Tier Publications
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PUBLICATION_SOPS: Record<string, PublicationSOP> = {
  'forbes': {
    publicationId: 'forbes',
    audienceProfile: 'Business leaders, entrepreneurs, investors, and aspiring professionals. 150M+ monthly visitors. Readers expect practical business insights with authority.',
    contentFormatRules: 'Thought leadership format. First-person "I" voice common for contributor pieces. Data + personal experience hybrid. 800-1500 words optimal. Clear subheadings every 200-300 words. Listicle format works well for contributor network.',
    toneGuidelines: 'Authoritative yet accessible. Expert positioning without academic jargon. Confident assertions backed by data. No hedging language ("maybe", "perhaps"). Direct and actionable.',
    exampleAngles: [
      'Why [Industry Trend] Will Reshape [Sector] By 2027',
      'I Built a $10M Business Using This One Counterintuitive Strategy',
      'The Hidden Cost of [Popular Practice] That Nobody Talks About',
      '5 Data-Backed Strategies to [Achieve Business Goal]',
      'What [Major Company]\'s Latest Move Tells Us About [Trend]'
    ],
    contentFilters: [
      { dimension: 'data_evidence', rule: 'Forbes requires data backing', threshold: 6, action: 'block', fix: 'Add 2-3 statistics, research citations, or named company examples' },
      { dimension: 'expertise_depth', rule: 'Must demonstrate domain expertise', threshold: 6, action: 'warn', fix: 'Include personal experience, case studies, or industry-specific insights' },
      { dimension: 'hook_engagement', rule: 'Forbes readers scroll fast', threshold: 6.5, action: 'enhance', fix: 'Strengthen opening with a provocative stat or contrarian claim' },
    ],
    enhancementPrompts: {
      publication_fit: 'Rewrite to match Forbes contributor voice: first-person authority, data-backed claims, clear business takeaways. Add "Forbes-worthy" opening that promises specific value.',
      data_evidence: 'Add 3+ data points: market size, growth %, company revenue, research findings. Name specific companies and cite sources.',
      hook_engagement: 'Open with a surprising statistic or bold claim. Forbes readers need to know the value in the first sentence.',
    },
    scoringWeightOverrides: { data_evidence: 1.5, expertise_depth: 1.3, hook_engagement: 1.2 },
  },

  'bloomberg': {
    publicationId: 'bloomberg',
    audienceProfile: 'C-suite executives, institutional investors, policy makers, financial professionals. 85M monthly traffic. Terminal-level data literacy expected.',
    contentFormatRules: 'Investigative/analytical journalism. Named sources required (minimum 3). Global scope preferred. 2000-4000 words. Data-driven with original analysis. No press release rewrites.',
    toneGuidelines: 'Authoritative and measured. Financial terminology used without definition. Precise language — no superlatives without data backing. Bloomberg Terminal-level sophistication.',
    exampleAngles: [
      'Inside the [Industry]\'s $XB Problem That Wall Street Is Ignoring',
      'How [Country/Company] Is Quietly Reshaping [Global Market]',
      'The Data Behind [Controversial Policy]: What the Numbers Actually Show',
      'Exclusive: [Company] Internal Documents Reveal [Strategy Shift]',
    ],
    contentFilters: [
      { dimension: 'data_evidence', rule: 'Bloomberg requires financial data', threshold: 7, action: 'block', fix: 'Add financial data: market cap, revenue figures, basis points, specific percentages with sources' },
      { dimension: 'publication_fit', rule: 'Must meet Bloomberg standards', threshold: 7, action: 'block', fix: 'Add named sources (3+ required), financial data points, and global scope' },
      { dimension: 'originality_angle', rule: 'No commodity news', threshold: 7, action: 'warn', fix: 'Add original analysis, exclusive data, or contrarian interpretation' },
    ],
    enhancementPrompts: {
      publication_fit: 'Rewrite to Bloomberg standards: add named sources with titles, financial data points, market context. Remove all promotional language. Add "according to" attributions.',
      data_evidence: 'Add Bloomberg-caliber data: specific dollar amounts, basis point changes, YoY comparisons, market share percentages. Cite Bloomberg Terminal data where possible.',
      voice_tone: 'Adopt Bloomberg\'s measured, precise tone. Replace superlatives with specific numbers. Remove casual language. Every claim needs attribution.',
    },
    scoringWeightOverrides: { data_evidence: 1.6, originality_angle: 1.3, publication_fit: 1.4 },
  },

  'harvard-business-review': {
    publicationId: 'harvard-business-review',
    audienceProfile: 'Senior leaders, MBA graduates, management consultants, academic researchers. Readers expect evidence-based insights with practical application.',
    contentFormatRules: 'Research-backed analysis. Case study format preferred. 1500-3000 words. Academic rigor with practical takeaways. Clear framework or model. Co-authorship with credentialed experts valued.',
    toneGuidelines: 'Scholarly but accessible. Evidence-based claims. Structured argumentation. No clickbait. Nuanced — acknowledge counterarguments. Framework-oriented thinking.',
    exampleAngles: [
      'What [X Years] of Data Tells Us About [Management Practice]',
      'A Better Framework for [Business Challenge]',
      'The Research Is Clear: [Conventional Wisdom] Is Wrong',
      'Case Study: How [Company] Transformed [Process] — And What Others Can Learn',
    ],
    contentFilters: [
      { dimension: 'data_evidence', rule: 'HBR requires research citations', threshold: 7, action: 'block', fix: 'Add academic research citations, named studies, or systematic data analysis' },
      { dimension: 'actionability', rule: 'Must have practical frameworks', threshold: 7, action: 'warn', fix: 'Add a clear framework, model, or step-by-step methodology that leaders can implement' },
      { dimension: 'clarity_structure', rule: 'Structured argumentation required', threshold: 7, action: 'enhance', fix: 'Add clear thesis statement, logical progression, and numbered takeaways' },
    ],
    enhancementPrompts: {
      publication_fit: 'Restructure for HBR: clear thesis, research citations, practical framework, nuanced conclusion. Remove casual tone. Add "Implications for Leaders" section.',
      data_evidence: 'Replace anecdotes with research: cite named studies, sample sizes, and methodology. Add "according to research published in [journal]" attributions.',
      actionability: 'Add an actionable framework with 3-5 steps. Include a "How to Apply This" section with specific recommendations for different organizational contexts.',
    },
    scoringWeightOverrides: { data_evidence: 1.5, actionability: 1.3, clarity_structure: 1.3 },
  },

  'wired': {
    publicationId: 'wired',
    audienceProfile: 'Tech-curious professionals, digital culture enthusiasts, science-minded readers. Long-form narrative journalism fans. Expect cultural impact analysis.',
    contentFormatRules: 'Long-form narrative tech journalism. 2000-5000 words. Vivid scene-setting and character development. Cultural impact angle required. No listicles. No product reviews without narrative wrapper.',
    toneGuidelines: 'Narrative and literary. Scene-setting openings. Character-driven storytelling. Scientific accuracy with accessible explanation. Intellectual curiosity as default mode.',
    exampleAngles: [
      'Inside the Lab Where [Scientists] Are [Ambitious Goal]',
      'The Untold Story of [Technology] and the People It Left Behind',
      'What Happens When [AI/Technology] Meets [Human Domain]',
      '[Person]\'s Radical Bet on [Technology] Could Change Everything',
    ],
    contentFilters: [
      { dimension: 'hook_engagement', rule: 'Wired needs narrative hooks', threshold: 7, action: 'block', fix: 'Open with a vivid scene, person, or moment — not a topic statement. Show, don\'t tell.' },
      { dimension: 'originality_angle', rule: 'No commodity tech news', threshold: 7, action: 'warn', fix: 'Add cultural impact angle, human stories, or unexpected connections' },
      { dimension: 'voice_tone', rule: 'Must be narrative voice', threshold: 6.5, action: 'enhance', fix: 'Convert analytical voice to narrative. Add scenes, dialogue, and sensory details.' },
    ],
    enhancementPrompts: {
      publication_fit: 'Rewrite opening as a narrative scene. Add a protagonist. Weave data into story. End with broader cultural implication. Wired readers want to FEEL the technology\'s impact.',
      hook_engagement: 'Replace topic-statement opening with a scene: describe a specific moment, place, person. "On a Tuesday morning in [place], [person] was doing [specific thing] when..."',
      originality_angle: 'Find the human story inside the tech story. What\'s the cultural tension? Who are the characters? What\'s at stake beyond the technology itself?',
    },
    scoringWeightOverrides: { hook_engagement: 1.4, originality_angle: 1.4, voice_tone: 1.3 },
  },

  'the-atlantic': {
    publicationId: 'the-atlantic',
    audienceProfile: 'Educated general audience interested in ideas, policy, culture, and society. Expect nuanced argumentation and historical context. Long-form essay readers.',
    contentFormatRules: 'Essay-length arguments (2000-6000 words). Historical context required. Expert synthesis with original analysis. Contrarian viewpoints welcome. Feature reporting with narrative elements.',
    toneGuidelines: 'Intellectual and measured. Historical awareness. Willingness to sit with complexity. No simple answers to hard questions. Elegant prose valued.',
    exampleAngles: [
      'The Real Reason [Social Phenomenon] Is Happening — And Why We\'re Wrong About It',
      'What [Historical Period/Event] Can Teach Us About [Current Crisis]',
      'The Quiet Revolution in [Domain] That Will Define the Next Decade',
      'Against [Popular Idea]: The Case for [Contrarian Position]',
    ],
    contentFilters: [
      { dimension: 'expertise_depth', rule: 'Atlantic requires intellectual depth', threshold: 7, action: 'block', fix: 'Add historical context, expert quotes, and nuanced analysis. Address counterarguments.' },
      { dimension: 'originality_angle', rule: 'Must offer original argument', threshold: 7.5, action: 'warn', fix: 'Develop a clear thesis that goes beyond conventional wisdom. What insight does this add?' },
      { dimension: 'clarity_structure', rule: 'Essay structure needed', threshold: 7, action: 'enhance', fix: 'Structure as an essay: clear thesis, supporting evidence, counterargument, synthesis, conclusion' },
    ],
    enhancementPrompts: {
      publication_fit: 'Restructure as an Atlantic essay: historical opening, clear thesis in paragraph 3, evidence building, honest engagement with counterarguments, synthesis conclusion.',
      originality_angle: 'What is YOUR argument? The Atlantic publishes ideas, not summaries. Take a position. What does everyone else get wrong? What\'s the deeper pattern?',
      expertise_depth: 'Add historical precedent and expert synthesis. Name specific thinkers, studies, and historical moments. Show how current moment connects to larger patterns.',
    },
    scoringWeightOverrides: { originality_angle: 1.5, expertise_depth: 1.4, clarity_structure: 1.2 },
  },

  'fast-company': {
    publicationId: 'fast-company',
    audienceProfile: 'Innovation-focused professionals, designers, startup founders, creative leaders. Expect profiles of innovators and analysis of design thinking.',
    contentFormatRules: 'Innovation profiles + analysis. 1000-2000 words. Design thinking angle valued. Company/person profiles with broader lessons. Visual storytelling encouraged.',
    toneGuidelines: 'Energetic and forward-looking. Optimistic about innovation but not naive. Design-aware language. Celebrating creative problem-solving.',
    exampleAngles: [
      'How [Company] Redesigned [Process] — And Why It\'s a Model for Every Industry',
      'This [Role/Person] Is Solving [Problem] in a Way Nobody Expected',
      'The Design Principle That [Company] Used to [Achievement]',
      'Why [Emerging Practice] Is the Future of [Industry]',
    ],
    contentFilters: [
      { dimension: 'originality_angle', rule: 'Must have innovation angle', threshold: 6.5, action: 'warn', fix: 'Frame around innovation, design thinking, or creative problem-solving. What\'s new here?' },
    ],
    enhancementPrompts: {
      publication_fit: 'Frame around innovation and design. Lead with the creative solution. Add "lessons for other industries" section. Use Fast Company\'s optimistic-but-rigorous tone.',
    },
    scoringWeightOverrides: { originality_angle: 1.3, hook_engagement: 1.2 },
  },

  'vox': {
    publicationId: 'vox',
    audienceProfile: 'Curious general audience wanting to understand complex topics. Policy-interested readers. Expect explainer-format journalism.',
    contentFormatRules: 'Explainer format: "Everything you need to know about X." Data-heavy but accessible. 1500-3000 words. Clear structure with subheadings as questions. Cards/FAQs format works.',
    toneGuidelines: 'Accessible and explanatory. No assumed knowledge. "Here\'s what\'s actually going on" framing. Data-driven but conversational.',
    exampleAngles: [
      'Everything You Need to Know About [Complex Topic]',
      'The Real Debate About [Policy Issue], Explained',
      'Why [Trend] Is Happening — And What It Means for You',
      '[Number] Charts That Explain [Issue] Better Than Any Article',
    ],
    contentFilters: [
      { dimension: 'clarity_structure', rule: 'Explainer format required', threshold: 7, action: 'enhance', fix: 'Restructure with question-based subheadings. Add "What is X?" → "Why does it matter?" → "What happens next?" flow.' },
    ],
    enhancementPrompts: {
      publication_fit: 'Restructure as a Vox explainer: question-based subheadings, no assumed knowledge, data visualizations described, clear "so what" conclusions per section.',
    },
    scoringWeightOverrides: { clarity_structure: 1.4, data_evidence: 1.2 },
  },

  'huffpost': {
    publicationId: 'huffpost',
    audienceProfile: 'Broad general audience. Progressive-leaning. Personal essays perform well. Identity, health, parenting, and social justice topics.',
    contentFormatRules: 'Personal essays with universal resonance. 800-1500 words. First-person voice. Vulnerability valued. News-pegged personal takes welcome.',
    toneGuidelines: 'Personal, relatable, emotionally honest. Conversational. Can be funny or serious but must feel authentic.',
    exampleAngles: [
      'I [Did Unexpected Thing] and Here\'s What It Taught Me About [Bigger Theme]',
      'What Nobody Tells You About [Life Experience]',
      'I\'m a [Identity], and [Current Event] Hits Different',
    ],
    contentFilters: [
      { dimension: 'hook_engagement', rule: 'Personal hook required', threshold: 6.5, action: 'enhance', fix: 'Open with a specific personal moment or scene. HuffPost readers connect through vulnerability.' },
    ],
    enhancementPrompts: {
      publication_fit: 'Add personal stake and emotional honesty. Open with a specific scene from your experience. Connect personal story to universal theme.',
    },
    scoringWeightOverrides: { hook_engagement: 1.4, voice_tone: 1.3 },
  },

  'cosmopolitan': {
    publicationId: 'cosmopolitan',
    audienceProfile: 'Young women (18-34). Relationships, career, wellness, beauty, sex, pop culture. Expect relatable, voice-driven content.',
    contentFormatRules: 'Relatable, voice-driven. 800-1500 words. Trend-forward. Mix of personal experience and reported elements. Listicle format welcome.',
    toneGuidelines: 'Fun, confident, slightly irreverent. Best friend giving advice energy. No lecturing. Inclusive language.',
    exampleAngles: [
      '[Number] Things That Happen When You [Relatable Experience]',
      'I Tried [Trend] for [Time Period] — Here\'s My Honest Review',
      'The [Career/Love/Health] Advice I Wish I\'d Gotten at [Age]',
    ],
    contentFilters: [
      { dimension: 'voice_tone', rule: 'Must match Cosmo voice', threshold: 6.5, action: 'enhance', fix: 'Add conversational tone, relatable examples, and "best friend" energy. Remove formal/academic language.' },
    ],
    enhancementPrompts: {
      publication_fit: 'Rewrite in Cosmo voice: conversational, confident, slightly cheeky. Add relatable examples. Use "you" directly. Include pop culture references.',
    },
    scoringWeightOverrides: { voice_tone: 1.4, hook_engagement: 1.3 },
  },

  'scientific-american': {
    publicationId: 'scientific-american',
    audienceProfile: 'Science-literate general audience. Expect peer-reviewed research translation. 1500-3000 words. Expert-authored preferred.',
    contentFormatRules: 'Research translation for lay audience. 1500-3000 words. Must cite specific studies. Expert-authored or heavily expert-sourced. No sensationalism.',
    toneGuidelines: 'Precise and measured. Scientific rigor without jargon overload. Excitement about discovery but restrained claims.',
    exampleAngles: [
      'New Research Reveals [Surprising Finding] About [Scientific Topic]',
      'The Science Behind [Phenomenon] Is More Complex Than You Think',
      'How [Technology] Is Transforming Our Understanding of [Field]',
    ],
    contentFilters: [
      { dimension: 'data_evidence', rule: 'Must cite research', threshold: 7.5, action: 'block', fix: 'Cite specific peer-reviewed studies with authors, journals, and sample sizes. No unsourced claims.' },
      { dimension: 'expertise_depth', rule: 'Expert-level accuracy required', threshold: 7, action: 'block', fix: 'Verify scientific accuracy. Add methodology descriptions and limitations of cited research.' },
    ],
    enhancementPrompts: {
      publication_fit: 'Add research citations with journal names, lead authors, and sample sizes. Remove sensational language. Add "limitations" acknowledgment for each study cited.',
      data_evidence: 'Every major claim needs a specific study citation. Format: "A [year] study in [Journal] by [Author] et al. found that [specific finding] (n=[sample])."',
    },
    scoringWeightOverrides: { data_evidence: 1.6, expertise_depth: 1.5 },
  },

  'the-verge': {
    publicationId: 'the-verge',
    audienceProfile: 'Tech-savvy consumers, digital culture followers, gadget enthusiasts. Expect consumer tech coverage with cultural context.',
    contentFormatRules: 'Consumer tech + digital culture. 800-2500 words. Strong opinions welcome. Reviews, analysis, and features. Visual-forward.',
    toneGuidelines: 'Opinionated but fair. Culturally aware. Witty. Can be passionate about technology\'s impact on daily life.',
    exampleAngles: [
      'I Used [New Technology] for a Week and [Verdict]',
      'Why [Tech Company]\'s Latest Move Is [Good/Bad] for Everyone',
      'The Real Problem With [Popular Technology] Nobody Is Talking About',
    ],
    contentFilters: [
      { dimension: 'voice_tone', rule: 'Must have distinct voice', threshold: 6.5, action: 'enhance', fix: 'Add personal opinion and cultural context. The Verge values distinctive voices with clear points of view.' },
    ],
    enhancementPrompts: {
      publication_fit: 'Add clear editorial voice and cultural context. What does this tech mean for people\'s daily lives? Take a stance.',
    },
    scoringWeightOverrides: { voice_tone: 1.3, originality_angle: 1.2 },
  },

  'time': {
    publicationId: 'time',
    audienceProfile: 'Broad educated audience. Global perspective. Breaking news to feature profiles. Expect authoritative reporting with narrative elements.',
    contentFormatRules: 'Authoritative reporting with narrative elements. 1500-3000 words. Global perspective valued. Named sources required. Person-of-the-Year profile style.',
    toneGuidelines: 'Authoritative and measured. Historically aware. Clear prose. No jargon. Accessible to broad audience.',
    exampleAngles: [
      'How [Person/Organization] Is Changing [Field] — And What It Means for the World',
      'Inside [Institution/Country]\'s Plan to [Ambitious Goal]',
      'The [Number] People Shaping [Domain] in 2026',
    ],
    contentFilters: [
      { dimension: 'expertise_depth', rule: 'Authoritative sourcing needed', threshold: 7, action: 'warn', fix: 'Add named expert sources, institutional quotes, and historical context.' },
    ],
    enhancementPrompts: {
      publication_fit: 'Add global perspective and named sources. Frame in terms of historical significance. TIME readers expect "this matters because..." framing.',
    },
    scoringWeightOverrides: { expertise_depth: 1.3, publication_fit: 1.2 },
  },

  'inc': {
    publicationId: 'inc',
    audienceProfile: 'Small business owners, startup founders, ambitious professionals. Practical growth advice. "How I built this" stories.',
    contentFormatRules: '800-1500 words. Practical advice format. Numbered lists work well. Founder profiles with actionable lessons. Data appreciated but stories drive.',
    toneGuidelines: 'Encouraging and practical. "You can do this too" energy. Founder voice welcome. No academic language.',
    exampleAngles: [
      'How I Grew My Business [X]% by Doing [Specific Thing]',
      'The [Number]-Step System That [Achievement]',
      'Why Every Small Business Should [Action] in 2026',
    ],
    contentFilters: [
      { dimension: 'actionability', rule: 'Must be actionable', threshold: 6.5, action: 'enhance', fix: 'Add specific steps readers can implement. Include cost/time estimates and tool recommendations.' },
    ],
    enhancementPrompts: {
      publication_fit: 'Make it actionable for small business owners. Add specific steps, tools, costs. Use founder-voice. "Here\'s exactly what I did and what you can do too."',
    },
    scoringWeightOverrides: { actionability: 1.4, hook_engagement: 1.2 },
  },

  'new-york-times': {
    publicationId: 'new-york-times',
    audienceProfile: 'Educated general audience. The paper of record. Highest editorial standards. 100M+ monthly readers.',
    contentFormatRules: 'Feature reporting, investigative journalism, opinion essays. 1500-5000 words. Multiple named sources. Original reporting required. No aggregation.',
    toneGuidelines: 'Precise, authoritative, understated. "Show, don\'t tell" journalism. Let facts speak. Elegant prose valued.',
    exampleAngles: [
      'Deep investigation into [systemic issue]',
      'Profile of [person/community] at the center of [trend/crisis]',
      'Data analysis revealing [previously unknown pattern]',
    ],
    contentFilters: [
      { dimension: 'data_evidence', rule: 'Original reporting standard', threshold: 8, action: 'block', fix: 'This requires original reporting with 5+ named sources, document review, and independent verification.' },
      { dimension: 'clarity_structure', rule: 'NYT structural standards', threshold: 7.5, action: 'warn', fix: 'Follow NYT structure: compelling lede, nut graf by paragraph 4, chronological or thematic evidence, kicker ending.' },
    ],
    enhancementPrompts: {
      publication_fit: 'This needs NYT-level rigor: 5+ named sources, document citations, independent verification. Remove all opinion from reporting sections. Add "but critics say..." balance.',
    },
    scoringWeightOverrides: { data_evidence: 1.6, clarity_structure: 1.4, originality_angle: 1.3 },
  },

  'slate': {
    publicationId: 'slate',
    audienceProfile: 'Intellectually curious readers who enjoy contrarian takes and cultural analysis. 20M+ monthly visitors.',
    contentFormatRules: 'Contrarian analysis and cultural commentary. 1000-2500 words. Strong thesis. "Actually, here\'s why the conventional wisdom is wrong" format.',
    toneGuidelines: 'Smart and slightly provocative. Contrarian but well-argued. Witty but substantive. Not afraid to be unpopular.',
    exampleAngles: [
      'Actually, [Popular Opinion] Is Wrong. Here\'s Why.',
      'The Problem With How We Think About [Topic]',
      'What Everyone Gets Wrong About [Cultural Phenomenon]',
    ],
    contentFilters: [
      { dimension: 'originality_angle', rule: 'Must be contrarian or fresh', threshold: 7, action: 'warn', fix: 'Strengthen the contrarian angle. What does everyone else get wrong? What\'s the surprising truth?' },
    ],
    enhancementPrompts: {
      publication_fit: 'Sharpen the contrarian thesis. Lead with what everyone gets wrong. Build the counter-argument with evidence. Slate readers want to feel smarter after reading.',
    },
    scoringWeightOverrides: { originality_angle: 1.5, voice_tone: 1.2 },
  },

  'newsweek': {
    publicationId: 'newsweek',
    audienceProfile: 'General news audience interested in current affairs, politics, culture, and opinion.',
    contentFormatRules: 'News features and opinion pieces. 1000-2000 words. Timely and news-pegged. Multiple perspectives.',
    toneGuidelines: 'News magazine voice. Authoritative but accessible. Can include opinion in clearly labeled opinion pieces.',
    exampleAngles: [
      'What [Current Event] Means for [Broader Issue]',
      'Why [Policy/Trend] Is Dividing [Group]',
    ],
    contentFilters: [
      { dimension: 'timeliness', rule: 'Must be news-pegged', threshold: 6.5, action: 'warn', fix: 'Connect to a current news event or trending topic. Add dates and timely references.' },
    ],
    enhancementPrompts: {
      publication_fit: 'Strengthen the news peg. What happened this week that makes this relevant NOW? Add recent quotes and developments.',
    },
    scoringWeightOverrides: { timeliness: 1.4 },
  },

  'vanity-fair': {
    publicationId: 'vanity-fair',
    audienceProfile: 'Affluent, culturally sophisticated readers. Celebrity profiles, investigative reporting, cultural commentary.',
    contentFormatRules: 'Narrative features and profiles. 2000-6000 words. Scene-setting and character development. Glamour meets substance.',
    toneGuidelines: 'Sophisticated and literary. Scene-setting prose. Name-dropping is acceptable when relevant. Elegant and detailed.',
    exampleAngles: [
      'Inside [Celebrity/Mogul]\'s [Ambitious Project/Comeback/Scandal]',
      'The Secret World of [Exclusive Community/Industry]',
    ],
    contentFilters: [
      { dimension: 'voice_tone', rule: 'VF literary standard', threshold: 7, action: 'enhance', fix: 'Elevate prose quality. Add scene-setting, sensory details, and cultural references. VF expects literary journalism.' },
    ],
    enhancementPrompts: {
      publication_fit: 'Add literary quality: vivid scenes, cultural context, sophisticated vocabulary. VF profiles need character, tension, and social commentary.',
    },
    scoringWeightOverrides: { voice_tone: 1.4, hook_engagement: 1.3 },
  },

  'psychology-today': {
    publicationId: 'psychology-today',
    audienceProfile: 'General audience interested in psychology, relationships, mental health, and self-improvement.',
    contentFormatRules: '1000-2000 words. Research-backed but accessible. Personal anecdotes + research synthesis. Self-help angle valued.',
    toneGuidelines: 'Warm, empathetic, and evidence-based. Therapist-meets-journalist voice. No pathologizing language.',
    exampleAngles: [
      'The Psychology Behind [Common Behavior] — And What to Do About It',
      'New Research Shows [Finding] About [Psychological Topic]',
      'Why [Relationship Pattern] Is More Common Than You Think',
    ],
    contentFilters: [
      { dimension: 'data_evidence', rule: 'Must cite psychological research', threshold: 6.5, action: 'warn', fix: 'Add citations to psychological research. Name researchers, institutions, and journals.' },
    ],
    enhancementPrompts: {
      publication_fit: 'Blend personal insight with research. Cite 2-3 psychological studies. Add self-reflection questions for the reader. Use warm, non-clinical language.',
    },
    scoringWeightOverrides: { data_evidence: 1.3, voice_tone: 1.2 },
  },

  'national-geographic': {
    publicationId: 'national-geographic',
    audienceProfile: 'Curious readers fascinated by science, exploration, nature, culture, and history. All ages.',
    contentFormatRules: 'Visual storytelling + narrative science journalism. 2000-4000 words. On-the-ground reporting valued. Conservation angle always welcome.',
    toneGuidelines: 'Wonder and awe paired with scientific rigor. Immersive narrative. Respect for indigenous perspectives. Environmental consciousness.',
    exampleAngles: [
      'The [Ecosystem/Species] Scientists Are Racing to Save Before It\'s Too Late',
      'Inside the [Remote Location] Where [Discovery]',
      'What [Ancient Civilization] Can Teach Us About [Modern Challenge]',
    ],
    contentFilters: [
      { dimension: 'hook_engagement', rule: 'Must evoke wonder', threshold: 7, action: 'enhance', fix: 'Open with a vivid scene from the field. Nat Geo readers want to feel transported to the location.' },
    ],
    enhancementPrompts: {
      publication_fit: 'Add immersive narrative: describe the place, the people, the moment of discovery. Use sensory language. Connect to conservation or cultural preservation.',
    },
    scoringWeightOverrides: { hook_engagement: 1.4, voice_tone: 1.3, expertise_depth: 1.2 },
  },

  'well-good': {
    publicationId: 'well-good',
    audienceProfile: 'Health-conscious millennials and Gen Z. Wellness, fitness, nutrition, mental health, and self-care.',
    contentFormatRules: '800-1500 words. Expert-sourced wellness advice. Trend-forward. Practical tips with scientific backing.',
    toneGuidelines: 'Warm, approachable, and empowering. Expert voices quoted frequently. No shame-based language. Body-positive.',
    exampleAngles: [
      'A [Specialist] Explains Why [Wellness Trend] Actually Works',
      'The [Number] Signs of [Health Topic], According to Experts',
    ],
    contentFilters: [
      { dimension: 'data_evidence', rule: 'Must quote health experts', threshold: 6, action: 'warn', fix: 'Add quotes from named health professionals (RD, MD, therapist, etc.) with credentials.' },
    ],
    enhancementPrompts: {
      publication_fit: 'Add 2-3 expert quotes with full credentials. Use Well+Good\'s empowering tone. Add practical "what you can do" takeaways.',
    },
    scoringWeightOverrides: { actionability: 1.3, data_evidence: 1.2 },
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GENERIC CATEGORY SOPs — For publications without specific SOPs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CATEGORY_SOPS: Record<string, Partial<PublicationSOP>> = {
  'Business': {
    contentFormatRules: 'Data-backed analysis or thought leadership. 800-2000 words. Clear business takeaways. Named companies and figures.',
    toneGuidelines: 'Professional and authoritative. Data-driven claims. Practical business insights.',
    contentFilters: [
      { dimension: 'data_evidence', rule: 'Business pubs need data', threshold: 6, action: 'warn', fix: 'Add business data: revenue, growth %, market size, company examples.' },
      { dimension: 'actionability', rule: 'Must have business takeaways', threshold: 6, action: 'enhance', fix: 'Add "What this means for your business" or action items.' },
    ],
    enhancementPrompts: {
      publication_fit: 'Add business-relevant data, named companies, and practical takeaways. Business readers want to know "so what does this mean for me?"',
    },
  },
  'All Topics': {
    contentFormatRules: '800-2000 words. Clear structure with subheadings. Accessible to general audience.',
    toneGuidelines: 'Clear, engaging, and accessible. Avoid jargon. Tell stories with data.',
    contentFilters: [
      { dimension: 'readability', rule: 'General audience accessibility', threshold: 6, action: 'enhance', fix: 'Simplify complex terms. Add explanations for technical concepts. Use shorter sentences.' },
    ],
    enhancementPrompts: {
      publication_fit: 'Make accessible to a general audience. Define any technical terms. Add relatable examples.',
    },
  },
  'Tech': {
    contentFormatRules: 'Tech analysis, reviews, or investigative reporting. 1000-2500 words. Technical accuracy required.',
    toneGuidelines: 'Knowledgeable and opinionated but fair. Technical precision with accessible explanation.',
    contentFilters: [
      { dimension: 'expertise_depth', rule: 'Technical accuracy required', threshold: 6.5, action: 'warn', fix: 'Verify technical claims. Add version numbers, specifications, and proper technology names.' },
    ],
    enhancementPrompts: {
      publication_fit: 'Ensure technical accuracy. Add specific product names, version numbers, and comparisons. Tech readers expect precision.',
    },
  },
  'Science and Tech': {
    contentFormatRules: 'Research-backed science or tech journalism. Cite studies. 1500-3000 words.',
    toneGuidelines: 'Precise and curious. Scientific rigor with accessible language.',
    contentFilters: [
      { dimension: 'data_evidence', rule: 'Must cite research', threshold: 7, action: 'warn', fix: 'Add specific research citations with journal names and authors.' },
    ],
    enhancementPrompts: {
      publication_fit: 'Add research citations and methodology descriptions. Maintain scientific precision while keeping language accessible.',
    },
  },
  'Health': {
    contentFormatRules: 'Evidence-based health content. Expert sources required. 1000-2000 words. No medical misinformation.',
    toneGuidelines: 'Empathetic, evidence-based, and empowering. Never prescriptive without professional context.',
    contentFilters: [
      { dimension: 'data_evidence', rule: 'Must cite health research', threshold: 6.5, action: 'block', fix: 'Add citations to medical/health research. Quote named health professionals with credentials (MD, RD, PhD).' },
    ],
    enhancementPrompts: {
      publication_fit: 'Add expert quotes with credentials. Include "consult your doctor" disclaimers where appropriate. Cite peer-reviewed research.',
    },
  },
  'Travel': {
    contentFormatRules: 'Destination features, travel guides, or personal narratives. 1000-2500 words. Sensory writing valued.',
    toneGuidelines: 'Evocative and immersive. Transport the reader. Specific details over generic descriptions.',
    contentFilters: [
      { dimension: 'voice_tone', rule: 'Must be immersive', threshold: 6.5, action: 'enhance', fix: 'Add sensory details: sights, sounds, smells, tastes. Name specific places, streets, dishes.' },
    ],
    enhancementPrompts: {
      publication_fit: 'Add specific place names, local terms, sensory details. Travel writing should make the reader feel they\'re there.',
    },
  },
  'Lifestyle': {
    contentFormatRules: 'Trend-driven content with personal voice. 800-1500 words. Relatable and practical.',
    toneGuidelines: 'Relatable, warm, and practical. Like a knowledgeable friend sharing advice.',
    contentFilters: [
      { dimension: 'voice_tone', rule: 'Must be relatable', threshold: 6, action: 'enhance', fix: 'Add personal touches and relatable examples. Lifestyle readers connect through shared experience.' },
    ],
    enhancementPrompts: {
      publication_fit: 'Add personal voice and relatable examples. Include practical tips. Lifestyle content should feel like advice from a trusted friend.',
    },
  },
  "Women's Topics": {
    contentFormatRules: 'Voice-driven content relevant to women. 800-2000 words. Intersectional and inclusive.',
    toneGuidelines: 'Empowering, inclusive, and authentic. No condescension. Celebrate diverse perspectives.',
    contentFilters: [
      { dimension: 'voice_tone', rule: 'Must be empowering and inclusive', threshold: 6.5, action: 'enhance', fix: 'Ensure inclusive language. Add diverse perspectives. Empower rather than prescribe.' },
    ],
    enhancementPrompts: {
      publication_fit: 'Use inclusive language. Feature diverse voices and perspectives. Frame content as empowering, not prescriptive.',
    },
  },
  'Food': {
    contentFormatRules: 'Food culture, recipes-as-stories, restaurant features. 1000-2500 words. Sensory writing essential.',
    toneGuidelines: 'Passionate about food. Sensory and evocative. Cultural appreciation without appropriation.',
    contentFilters: [
      { dimension: 'voice_tone', rule: 'Must evoke food culture', threshold: 6.5, action: 'enhance', fix: 'Add sensory descriptions of food: flavors, textures, aromas. Cultural context for dishes.' },
    ],
    enhancementPrompts: {
      publication_fit: 'Add food-specific sensory details. Describe flavors, cooking processes, cultural context. Food writing should make readers hungry.',
    },
  },
  'Finance': {
    contentFormatRules: 'Financial analysis or practical finance advice. Data-heavy. 1000-2000 words.',
    toneGuidelines: 'Precise and authoritative. Numbers-driven. Practical financial advice without jargon overload.',
    contentFilters: [
      { dimension: 'data_evidence', rule: 'Financial data required', threshold: 7, action: 'block', fix: 'Add specific financial data: percentages, dollar amounts, market figures, named sources.' },
    ],
    enhancementPrompts: {
      publication_fit: 'Add financial data points and market context. Finance readers expect precision — no vague claims.',
    },
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUBLIC API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Get SOP for a specific publication (falls back to category SOP) */
export function getPublicationSOP(publicationId: string, category?: string): PublicationSOP | null {
  // Check specific SOP first
  if (PUBLICATION_SOPS[publicationId]) {
    return PUBLICATION_SOPS[publicationId];
  }
  
  // Fall back to category SOP
  if (category && CATEGORY_SOPS[category]) {
    const catSop = CATEGORY_SOPS[category];
    return {
      publicationId,
      audienceProfile: catSop.contentFormatRules || '',
      contentFormatRules: catSop.contentFormatRules || '',
      toneGuidelines: catSop.toneGuidelines || '',
      exampleAngles: [],
      contentFilters: catSop.contentFilters || [],
      enhancementPrompts: catSop.enhancementPrompts || {},
      scoringWeightOverrides: undefined,
    };
  }
  
  return null;
}

/** Get all content filters for a publication */
export function getContentFilters(publicationId: string, category?: string): ContentFilter[] {
  const sop = getPublicationSOP(publicationId, category);
  return sop?.contentFilters || [];
}

/** Get scoring weight overrides for a publication */
export function getScoringWeights(publicationId: string): Record<string, number> {
  const sop = PUBLICATION_SOPS[publicationId];
  const defaultWeights: Record<string, number> = {
    clarity_structure: 1, hook_engagement: 1.2, voice_tone: 1, data_evidence: 1.3,
    originality_angle: 1.1, publication_fit: 1.2, timeliness: 0.8, actionability: 0.9,
    expertise_depth: 1.1, readability: 1, conclusion_cta: 0.8,
  };
  if (sop?.scoringWeightOverrides) {
    const merged: Record<string, number> = { ...defaultWeights };
    for (const [k, v] of Object.entries(sop.scoringWeightOverrides)) {
      if (typeof v === "number") merged[k] = v;
    }
    return merged;
  }
  return defaultWeights;
}

/** Check content against publication filters and return violations */
export function checkContentFilters(
  scores: Record<string, number>,
  publicationId: string,
  category?: string
): { passed: boolean; violations: Array<ContentFilter & { currentScore: number }> } {
  const filters = getContentFilters(publicationId, category);
  const violations: Array<ContentFilter & { currentScore: number }> = [];
  
  for (const filter of filters) {
    const score = scores[filter.dimension];
    if (score !== undefined && score < filter.threshold) {
      violations.push({ ...filter, currentScore: score });
    }
  }
  
  return {
    passed: violations.filter(v => v.action === 'block').length === 0,
    violations,
  };
}

/** Generate AI enhancement prompt based on violations */
export function getEnhancementPrompt(publicationId: string, weakDimensions: string[], category?: string): string {
  const sop = getPublicationSOP(publicationId, category);
  if (!sop) return '';
  
  const prompts: string[] = [];
  for (const dim of weakDimensions) {
    if (sop.enhancementPrompts[dim]) {
      prompts.push(`[${dim}]: ${sop.enhancementPrompts[dim]}`);
    }
  }
  
  if (sop.contentFormatRules) {
    prompts.push(`\n[Format Rules]: ${sop.contentFormatRules}`);
  }
  if (sop.toneGuidelines) {
    prompts.push(`[Tone]: ${sop.toneGuidelines}`);
  }
  
  return prompts.join('\n\n');
}

/** Get the full AI system prompt addition for a publication */
export function getPublicationSystemPrompt(publicationId: string, category?: string): string {
  const sop = getPublicationSOP(publicationId, category);
  if (!sop) return '';
  
  return `
=== PUBLICATION-SPECIFIC INSTRUCTIONS: ${publicationId.toUpperCase()} ===
Audience: ${sop.audienceProfile}
Format: ${sop.contentFormatRules}
Tone: ${sop.toneGuidelines}
${sop.exampleAngles.length > 0 ? `Example Angles:\n${sop.exampleAngles.map(a => `  • ${a}`).join('\n')}` : ''}
===`;
}

/** List all publications with specific SOPs */
export function getPublicationsWithSOPs(): string[] {
  return Object.keys(PUBLICATION_SOPS);
}

/** Get all available SOPs */
export function getAllSOPs(): Record<string, PublicationSOP> {
  return { ...PUBLICATION_SOPS };
}
