/**
 * Content Quality Enforcement Engine
 * 
 * Real-time quality checks for publication-grade articles:
 * 1. AI Slop Detection — flags overused AI-generated phrases
 * 2. US English Enforcement — catches British spellings
 * 3. Readability Checks — sentence length, passive voice, filler words
 * 4. Publication Standards — word count, source density
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI Slop Phrases — common low-quality AI writing patterns
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const AI_SLOP_PHRASES: Array<{ pattern: RegExp; phrase: string; severity: 'high' | 'medium' | 'low'; fix: string }> = [
  // High severity — instant credibility killers
  { pattern: /\bdelve(?:s|d)?\s+into\b/gi, phrase: 'delve into', severity: 'high', fix: 'explore / examine / investigate' },
  { pattern: /\bin today'?s rapidly (?:evolving|changing)\b/gi, phrase: "in today's rapidly evolving", severity: 'high', fix: 'Remove — adds nothing. State the specific change.' },
  { pattern: /\bit'?s (?:important|worth) (?:to )?not(?:e|ing) that\b/gi, phrase: "it's important to note", severity: 'high', fix: 'Delete entirely — just state the fact.' },
  { pattern: /\blet'?s (?:dive|delve)\b/gi, phrase: "let's dive/delve", severity: 'high', fix: 'Remove — just start the section.' },
  { pattern: /\bgame[\s-]?changer\b/gi, phrase: 'game-changer', severity: 'high', fix: 'State the specific impact instead.' },
  { pattern: /\bparadigm shift\b/gi, phrase: 'paradigm shift', severity: 'high', fix: 'Describe the actual change.' },
  { pattern: /\bunlock(?:s|ing|ed)?\s+(?:the\s+)?(?:full\s+)?potential\b/gi, phrase: 'unlock potential', severity: 'high', fix: 'State specific benefit.' },
  { pattern: /\bin (?:the\s+)?(?:this\s+)?(?:ever[\s-])?(?:evolving|changing) (?:landscape|world)\b/gi, phrase: 'in this evolving landscape', severity: 'high', fix: 'Name the specific context.' },
  { pattern: /\bseamless(?:ly)?\b/gi, phrase: 'seamlessly', severity: 'high', fix: 'Describe actual integration/experience.' },
  { pattern: /\btapestry\s+of\b/gi, phrase: 'tapestry of', severity: 'high', fix: 'Use a specific description.' },
  { pattern: /\bleverage(?:s|d|ing)?\b/gi, phrase: 'leverage', severity: 'high', fix: 'use / apply / employ' },

  // Medium severity — overused but sometimes acceptable
  { pattern: /\brobust\b/gi, phrase: 'robust', severity: 'medium', fix: 'strong / comprehensive / detailed' },
  { pattern: /\bcutting[\s-]?edge\b/gi, phrase: 'cutting-edge', severity: 'medium', fix: 'advanced / latest / state-of-the-art' },
  { pattern: /\bholistic\s+approach\b/gi, phrase: 'holistic approach', severity: 'medium', fix: 'comprehensive method / full-spectrum strategy' },
  { pattern: /\bsyn(?:ergy|ergies|ergistic)\b/gi, phrase: 'synergy', severity: 'medium', fix: 'collaboration / combined effect / cooperation' },
  { pattern: /\bpivot(?:s|ed|ing)?\b/gi, phrase: 'pivot', severity: 'medium', fix: 'shift / change direction / adapt' },
  { pattern: /\bscalable?\b/gi, phrase: 'scalable', severity: 'medium', fix: 'Be specific about growth capacity.' },
  { pattern: /\bstakeholder(?:s)?\b/gi, phrase: 'stakeholders', severity: 'medium', fix: 'Name who: investors / customers / employees' },
  { pattern: /\bactionable\s+insights?\b/gi, phrase: 'actionable insights', severity: 'medium', fix: 'practical findings / specific recommendations' },
  { pattern: /\bfoster(?:s|ed|ing)?\s+(?:a\s+)?(?:culture|environment|sense)\b/gi, phrase: 'foster a culture', severity: 'medium', fix: 'build / encourage / create' },
  { pattern: /\btransformative\b/gi, phrase: 'transformative', severity: 'medium', fix: 'Describe the specific transformation.' },
  { pattern: /\bworld[\s-]?class\b/gi, phrase: 'world-class', severity: 'medium', fix: 'Quantify the excellence.' },
  { pattern: /\bvibrant\b/gi, phrase: 'vibrant', severity: 'medium', fix: 'active / thriving / lively' },
  { pattern: /\brevolution(?:ize|izing|ized|ary)\b/gi, phrase: 'revolutionize', severity: 'medium', fix: 'Describe the specific change.' },

  // Low severity — watch for overuse
  { pattern: /\bnavigat(?:e|es|ed|ing)\s+(?:the\s+)?(?:complex|challenging)\b/gi, phrase: 'navigate complex', severity: 'low', fix: 'manage / handle / work through' },
  { pattern: /\bshed(?:s|ding)?\s+light\b/gi, phrase: 'shed light', severity: 'low', fix: 'reveal / clarify / explain' },
  { pattern: /\binnovative\s+solution\b/gi, phrase: 'innovative solution', severity: 'low', fix: 'Name the solution specifically.' },
  { pattern: /\bin\s+(?:the\s+)?(?:final|last)\s+analysis\b/gi, phrase: 'in the final analysis', severity: 'low', fix: 'ultimately / in summary' },
  { pattern: /\bat the end of the day\b/gi, phrase: 'at the end of the day', severity: 'low', fix: 'ultimately / finally' },
  { pattern: /\bmoving forward\b/gi, phrase: 'moving forward', severity: 'low', fix: 'next / going ahead / from here' },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// British → US English corrections
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const BRITISH_TO_US: Array<{ pattern: RegExp; british: string; american: string }> = [
  // -our → -or
  { pattern: /\bcolour(?:s|ed|ful|ing|less)?\b/gi, british: 'colour', american: 'color' },
  { pattern: /\bfavour(?:s|ed|ite|able|ably|ing)?\b/gi, british: 'favour', american: 'favor' },
  { pattern: /\bhonour(?:s|ed|able|ably|ary|ing)?\b/gi, british: 'honour', american: 'honor' },
  { pattern: /\blabour(?:s|ed|er|ers|ing)?\b/gi, british: 'labour', american: 'labor' },
  { pattern: /\bhumour(?:s|ed|ous|ously|ing|less)?\b/gi, british: 'humour', american: 'humor' },
  { pattern: /\bneighbour(?:s|hood|hoods|ing|ly)?\b/gi, british: 'neighbour', american: 'neighbor' },
  { pattern: /\bbehaviour(?:s|al|ism|ist)?\b/gi, british: 'behaviour', american: 'behavior' },
  { pattern: /\brumour(?:s|ed|monger)?\b/gi, british: 'rumour', american: 'rumor' },
  { pattern: /\bsavour(?:s|ed|y|ing)?\b/gi, british: 'savour', american: 'savor' },
  { pattern: /\bglamour(?:s|ous|ize)?\b/gi, british: 'glamour', american: 'glamor' },
  { pattern: /\bendeavour(?:s|ed|ing)?\b/gi, british: 'endeavour', american: 'endeavor' },

  // -ise → -ize
  { pattern: /\borganis(?:e|es|ed|ing|ation|ations)\b/gi, british: 'organise', american: 'organize' },
  { pattern: /\brealis(?:e|es|ed|ing|ation)\b/gi, british: 'realise', american: 'realize' },
  { pattern: /\brecognis(?:e|es|ed|ing|ation)\b/gi, british: 'recognise', american: 'recognize' },
  { pattern: /\bmaximis(?:e|es|ed|ing|ation)\b/gi, british: 'maximise', american: 'maximize' },
  { pattern: /\bminimis(?:e|es|ed|ing|ation)\b/gi, british: 'minimise', american: 'minimize' },
  { pattern: /\boptimis(?:e|es|ed|ing|ation)\b/gi, british: 'optimise', american: 'optimize' },
  { pattern: /\bauthoris(?:e|es|ed|ing|ation)\b/gi, british: 'authorise', american: 'authorize' },
  { pattern: /\bcustomis(?:e|es|ed|ing|ation)\b/gi, british: 'customise', american: 'customize' },
  { pattern: /\bspecialis(?:e|es|ed|ing|ation)\b/gi, british: 'specialise', american: 'specialize' },
  { pattern: /\bapologis(?:e|es|ed|ing)\b/gi, british: 'apologise', american: 'apologize' },
  { pattern: /\banalys(?:e|es|ed|ing)\b/gi, british: 'analyse', american: 'analyze' },
  { pattern: /\bcritici[sz](?:e|es|ed|ing)\b/gi, british: 'criticise', american: 'criticize' },
  { pattern: /\bemphasise\b/gi, british: 'emphasise', american: 'emphasize' },
  { pattern: /\bsummarise\b/gi, british: 'summarise', american: 'summarize' },
  { pattern: /\butilis(?:e|es|ed|ing|ation)\b/gi, british: 'utilise', american: 'utilize' },
  { pattern: /\bprioritise\b/gi, british: 'prioritise', american: 'prioritize' },

  // -re → -er
  { pattern: /\bcentre(?:s|d)?\b/gi, british: 'centre', american: 'center' },
  { pattern: /\btheatre(?:s)?\b/gi, british: 'theatre', american: 'theater' },
  { pattern: /\bfibre(?:s)?\b/gi, british: 'fibre', american: 'fiber' },
  { pattern: /\blitre(?:s)?\b/gi, british: 'litre', american: 'liter' },
  { pattern: /\bmetre(?:s)?\b/gi, british: 'metre', american: 'meter' },
  { pattern: /\bsombre\b/gi, british: 'sombre', american: 'somber' },
  { pattern: /\blustre\b/gi, british: 'lustre', american: 'luster' },
  { pattern: /\bmeagre\b/gi, british: 'meagre', american: 'meager' },

  // -ence → -ense, -ce → -se
  { pattern: /\bdefence(?:s)?\b/gi, british: 'defence', american: 'defense' },
  { pattern: /\boffence(?:s)?\b/gi, british: 'offence', american: 'offense' },
  { pattern: /\blicence(?:s)?\b/gi, british: 'licence', american: 'license' },
  { pattern: /\bpractise(?:s|d)?\b/gi, british: 'practise', american: 'practice' },

  // -ll- → -l-
  { pattern: /\btravelling\b/gi, british: 'travelling', american: 'traveling' },
  { pattern: /\btravelled\b/gi, british: 'travelled', american: 'traveled' },
  { pattern: /\btraveller(?:s)?\b/gi, british: 'traveller', american: 'traveler' },
  { pattern: /\bcancelling\b/gi, british: 'cancelling', american: 'canceling' },
  { pattern: /\bcancelled\b/gi, british: 'cancelled', american: 'canceled' },
  { pattern: /\bmodelling\b/gi, british: 'modelling', american: 'modeling' },
  { pattern: /\bmodelled\b/gi, british: 'modelled', american: 'modeled' },
  { pattern: /\bjewellery\b/gi, british: 'jewellery', american: 'jewelry' },
  { pattern: /\bfuelling\b/gi, british: 'fuelling', american: 'fueling' },
  { pattern: /\bfuelled\b/gi, british: 'fuelled', american: 'fueled' },

  // Misc
  { pattern: /\bgrey\b/gi, british: 'grey', american: 'gray' },
  { pattern: /\bjudgement\b/gi, british: 'judgement', american: 'judgment' },
  { pattern: /\benquir(?:y|ies|e|es|ed|ing)\b/gi, british: 'enquiry', american: 'inquiry' },
  { pattern: /\bprogramme(?:s)?\b/gi, british: 'programme', american: 'program' },
  { pattern: /\bcheque(?:s)?\b/gi, british: 'cheque', american: 'check' },
  { pattern: /\bplough(?:s|ed|ing)?\b/gi, british: 'plough', american: 'plow' },
  { pattern: /\bstorey(?:s)?\b/gi, british: 'storey', american: 'story' },
  { pattern: /\bskeptical\b/gi, british: 'sceptical', american: 'skeptical' }, // US prefers -k-
  { pattern: /\bsceptic(?:s|al|ism)?\b/gi, british: 'sceptic', american: 'skeptic' },
  { pattern: /\bfoetus\b/gi, british: 'foetus', american: 'fetus' },
  { pattern: /\baeroplane(?:s)?\b/gi, british: 'aeroplane', american: 'airplane' },
  { pattern: /\bwhilst\b/gi, british: 'whilst', american: 'while' },
  { pattern: /\bamongst\b/gi, british: 'amongst', american: 'among' },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Readability checks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const FILLER_WORDS = [
  /\bvery\b/gi, /\breally\b/gi, /\bjust\b/gi, /\bbasically\b/gi,
  /\bliterally\b/gi, /\bactually\b/gi, /\bsimply\b/gi, /\btotally\b/gi,
  /\babsolutely\b/gi, /\bdefinitely\b/gi, /\bcertainly\b/gi, /\bobviously\b/gi,
  /\bclearly\b/gi, /\bquite\b/gi, /\brather\b/gi,
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type QualityIssue = {
  type: 'slop' | 'british' | 'readability' | 'structure';
  severity: 'high' | 'medium' | 'low' | 'info';
  message: string;
  fix: string;
  phrase: string;
  count: number;
  position?: number; // char index of first occurrence
};

export type QualityReport = {
  issues: QualityIssue[];
  stats: {
    slopCount: number;
    britishCount: number;
    fillerCount: number;
    avgSentenceLength: number;
    longSentences: number;
    paragraphs: number;
    readingGradeLevel: number;
  };
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  passesGate: boolean;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main checker
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function checkContentQuality(content: string, opts?: {
  minWordCount?: number;
  maxSlopAllowed?: number;
  blockOnBritish?: boolean;
}): QualityReport {
  const text = content || '';
  const issues: QualityIssue[] = [];

  // 1. AI Slop Detection
  let totalSlop = 0;
  for (const slop of AI_SLOP_PHRASES) {
    const matches = text.match(slop.pattern);
    if (matches && matches.length > 0) {
      totalSlop += matches.length;
      issues.push({
        type: 'slop',
        severity: slop.severity,
        message: `AI slop: "${slop.phrase}" (×${matches.length})`,
        fix: slop.fix,
        phrase: slop.phrase,
        count: matches.length,
        position: text.search(slop.pattern),
      });
    }
  }

  // 2. British English Detection
  let totalBritish = 0;
  for (const brit of BRITISH_TO_US) {
    const matches = text.match(brit.pattern);
    if (matches && matches.length > 0) {
      totalBritish += matches.length;
      issues.push({
        type: 'british',
        severity: 'medium',
        message: `British spelling: "${brit.british}" → "${brit.american}" (×${matches.length})`,
        fix: `Replace with US English: ${brit.american}`,
        phrase: brit.british,
        count: matches.length,
        position: text.search(brit.pattern),
      });
    }
  }

  // 3. Filler words
  let totalFiller = 0;
  for (const filler of FILLER_WORDS) {
    const matches = text.match(filler);
    if (matches && matches.length > 0) {
      totalFiller += matches.length;
    }
  }
  if (totalFiller > 5) {
    issues.push({
      type: 'readability',
      severity: totalFiller > 15 ? 'medium' : 'low',
      message: `${totalFiller} filler words detected (very, really, just, basically, etc.)`,
      fix: 'Remove filler words to tighten prose. Each one weakens your point.',
      phrase: 'filler words',
      count: totalFiller,
    });
  }

  // 4. Sentence length analysis
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const sentenceLengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avgLength = sentenceLengths.length > 0 ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length : 0;
  const longSentences = sentenceLengths.filter(l => l > 35).length;

  if (longSentences > 0) {
    issues.push({
      type: 'readability',
      severity: longSentences > 3 ? 'medium' : 'low',
      message: `${longSentences} sentence(s) over 35 words — hard to follow`,
      fix: 'Break long sentences into 2-3 shorter ones. Vary rhythm: short punch, then longer explanation.',
      phrase: 'long sentences',
      count: longSentences,
    });
  }

  // 5. Paragraph count
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  if (wordCount > 500 && paragraphs < 4) {
    issues.push({
      type: 'structure',
      severity: 'medium',
      message: `Only ${paragraphs} paragraphs for ${wordCount} words — needs more breaks`,
      fix: 'Add paragraph breaks every 100-200 words. Each paragraph should cover one idea.',
      phrase: 'paragraph density',
      count: paragraphs,
    });
  }

  // 6. Flesch-Kincaid-like reading level estimate
  const totalSyllables = text.split(/\s+/).reduce((sum, word) => sum + estimateSyllables(word), 0);
  const totalWords = wordCount;
  const totalSentences = Math.max(sentences.length, 1);
  const gradeLevel = totalWords > 30
    ? Math.round(0.39 * (totalWords / totalSentences) + 11.8 * (totalSyllables / totalWords) - 15.59)
    : 0;

  // Sort issues by severity (high first)
  const severityOrder = { high: 0, medium: 1, low: 2, info: 3 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Calculate grade
  const highCount = issues.filter(i => i.severity === 'high').length;
  const medCount = issues.filter(i => i.severity === 'medium').length;
  let grade: QualityReport['grade'] = 'A';
  if (highCount >= 5 || totalSlop >= 10) grade = 'F';
  else if (highCount >= 3 || totalSlop >= 7) grade = 'D';
  else if (highCount >= 1 || medCount >= 5 || totalSlop >= 4) grade = 'C';
  else if (medCount >= 2 || totalSlop >= 2 || totalBritish >= 3) grade = 'B';

  // Pass gate check
  const maxSlop = opts?.maxSlopAllowed ?? 3;
  const passesGate = totalSlop <= maxSlop && (opts?.blockOnBritish ? totalBritish === 0 : true) && grade !== 'F' && grade !== 'D';

  return {
    issues,
    stats: {
      slopCount: totalSlop,
      britishCount: totalBritish,
      fillerCount: totalFiller,
      avgSentenceLength: Math.round(avgLength),
      longSentences,
      paragraphs,
      readingGradeLevel: Math.max(0, gradeLevel),
    },
    grade,
    passesGate,
  };
}

function estimateSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  let count = 0;
  const vowels = 'aeiouy';
  let prevVowel = false;
  for (const ch of w) {
    const isVowel = vowels.includes(ch);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }
  if (w.endsWith('e') && count > 1) count--;
  if (w.endsWith('le') && w.length > 3 && !vowels.includes(w[w.length - 3])) count++;
  return Math.max(1, count);
}

// Grade color helpers
export function getGradeColor(grade: QualityReport['grade']): string {
  switch (grade) {
    case 'A': return 'text-green-400';
    case 'B': return 'text-blue-400';
    case 'C': return 'text-yellow-400';
    case 'D': return 'text-orange-400';
    case 'F': return 'text-red-400';
  }
}

export function getGradeBgColor(grade: QualityReport['grade']): string {
  switch (grade) {
    case 'A': return 'bg-green-500/10 border-green-500/20 text-green-400';
    case 'B': return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
    case 'C': return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
    case 'D': return 'bg-orange-500/10 border-orange-500/20 text-orange-400';
    case 'F': return 'bg-red-500/10 border-red-500/20 text-red-400';
  }
}
