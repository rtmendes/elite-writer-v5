/**
 * Academic Research Search — Multi-source academic API client.
 * Queries OpenAlex, CrossRef, and Semantic Scholar in parallel.
 * No API keys required — uses polite/free tiers.
 *
 * Sources: skills/research_sources_registry
 */

export interface AcademicResult {
  title: string;
  authors: string[];
  year: number | null;
  doi: string | null;
  url: string;
  abstract: string | null;
  citationCount: number | null;
  source: "openalex" | "crossref" | "semantic_scholar" | "pubmed";
  openAccessUrl: string | null;
}

const POLITE_EMAIL = "admin@insightprofit.live";
const TIMEOUT_MS = 12_000;

// ── OpenAlex (250M+ works) ──────────────────────────────────
async function searchOpenAlex(query: string, max: number): Promise<AcademicResult[]> {
  try {
    const params = new URLSearchParams({
      search: query,
      per_page: String(max),
      mailto: POLITE_EMAIL,
    });
    const resp = await fetch(`https://api.openalex.org/works?${params}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as any;

    return (data.results || []).map((w: any) => {
      const authors = (w.authorships || [])
        .slice(0, 5)
        .map((a: any) => a.author?.display_name || "")
        .filter(Boolean);

      let abstract: string | null = null;
      if (w.abstract_inverted_index) {
        const pairs: [number, string][] = [];
        for (const [word, positions] of Object.entries(w.abstract_inverted_index as Record<string, number[]>)) {
          for (const pos of positions) pairs.push([pos, word]);
        }
        pairs.sort((a, b) => a[0] - b[0]);
        abstract = pairs.map((p) => p[1]).join(" ").slice(0, 500);
      }

      return {
        title: w.display_name || w.title || "Untitled",
        authors,
        year: w.publication_year ?? null,
        doi: w.doi ?? null,
        url: w.id || "",
        abstract,
        citationCount: w.cited_by_count ?? null,
        source: "openalex" as const,
        openAccessUrl: w.open_access?.oa_url ?? null,
      };
    });
  } catch {
    return [];
  }
}

// ── CrossRef (150M+ DOI records) ────────────────────────────
async function searchCrossRef(query: string, max: number): Promise<AcademicResult[]> {
  try {
    const params = new URLSearchParams({ query, rows: String(max) });
    const resp = await fetch(`https://api.crossref.org/works?${params}`, {
      headers: {
        "User-Agent": `InsightProfit/1.0 (mailto:${POLITE_EMAIL})`,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as any;

    return (data.message?.items || []).map((item: any) => {
      const authors = (item.author || [])
        .slice(0, 5)
        .map((a: any) => `${a.given || ""} ${a.family || ""}`.trim())
        .filter(Boolean);

      let year: number | null = null;
      const dp = item["published-print"]?.["date-parts"]?.[0] || item["published-online"]?.["date-parts"]?.[0];
      if (dp?.[0]) year = dp[0];

      let title = item.title || "Untitled";
      if (Array.isArray(title)) title = title[0] || "Untitled";

      let abstract = item.abstract || null;
      if (abstract) abstract = abstract.replace(/<[^>]+>/g, "").slice(0, 500);

      return {
        title,
        authors,
        year,
        doi: item.DOI ?? null,
        url: item.URL || "",
        abstract,
        citationCount: item["is-referenced-by-count"] ?? null,
        source: "crossref" as const,
        openAccessUrl: null,
      };
    });
  } catch {
    return [];
  }
}

// ── Semantic Scholar (200M+ papers) ─────────────────────────
async function searchSemanticScholar(query: string, max: number): Promise<AcademicResult[]> {
  try {
    const params = new URLSearchParams({
      query,
      limit: String(max),
      fields: "title,abstract,authors,citationCount,url,openAccessPdf,year,externalIds",
    });
    const resp = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?${params}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!resp.ok) return [];
    const data = (await resp.json()) as any;

    return (data.data || []).map((p: any) => {
      const authors = (p.authors || []).slice(0, 5).map((a: any) => a.name || "").filter(Boolean);
      return {
        title: p.title || "Untitled",
        authors,
        year: p.year ?? null,
        doi: p.externalIds?.DOI ?? null,
        url: p.url || "",
        abstract: (p.abstract || "").slice(0, 500) || null,
        citationCount: p.citationCount ?? null,
        source: "semantic_scholar" as const,
        openAccessUrl: p.openAccessPdf?.url ?? null,
      };
    });
  } catch {
    return [];
  }
}

// ── PubMed / NCBI (36M+ biomedical) ────────────────────────
async function searchPubMed(query: string, max: number): Promise<AcademicResult[]> {
  try {
    const searchParams = new URLSearchParams({
      db: "pubmed",
      term: query,
      retmax: String(max),
      retmode: "json",
    });
    const searchResp = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!searchResp.ok) return [];
    const searchData = (await searchResp.json()) as any;
    const ids = searchData.esearchresult?.idlist || [];
    if (!ids.length) return [];

    const fetchParams = new URLSearchParams({
      db: "pubmed",
      id: ids.join(","),
      retmode: "json",
    });
    const fetchResp = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${fetchParams}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!fetchResp.ok) return [];
    const fetchData = (await fetchResp.json()) as any;
    const result = fetchData.result || {};

    return ids
      .filter((id: string) => result[id])
      .map((id: string) => {
        const item = result[id];
        const authors = (item.authors || []).slice(0, 5).map((a: any) => a.name || "").filter(Boolean);
        let year: number | null = null;
        if (item.pubdate && item.pubdate.length >= 4) {
          const y = parseInt(item.pubdate.slice(0, 4));
          if (!isNaN(y)) year = y;
        }
        const doiEntry = (item.articleids || []).find((e: any) => e.idtype === "doi");

        return {
          title: item.title || "Untitled",
          authors,
          year,
          doi: doiEntry?.value ?? null,
          url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
          abstract: null,
          citationCount: null,
          source: "pubmed" as const,
          openAccessUrl: null,
        };
      });
  } catch {
    return [];
  }
}

// ── Unified Search ──────────────────────────────────────────

export interface AcademicSearchOptions {
  maxPerSource?: number;
  includePubMed?: boolean;
  sources?: Array<"openalex" | "crossref" | "semantic_scholar" | "pubmed">;
}

/**
 * Search multiple academic databases in parallel and return
 * deduplicated, citation-ranked results.
 */
export async function academicSearch(
  query: string,
  options: AcademicSearchOptions = {}
): Promise<AcademicResult[]> {
  const max = options.maxPerSource ?? 5;
  const activeSources = options.sources ?? [
    "openalex",
    "crossref",
    "semantic_scholar",
    ...(options.includePubMed ? ["pubmed" as const] : []),
  ];

  const fns: Record<string, (q: string, m: number) => Promise<AcademicResult[]>> = {
    openalex: searchOpenAlex,
    crossref: searchCrossRef,
    semantic_scholar: searchSemanticScholar,
    pubmed: searchPubMed,
  };

  const tasks = activeSources.filter((s) => fns[s]).map((s) => fns[s](query, max));
  const results = (await Promise.allSettled(tasks))
    .filter((r): r is PromiseFulfilledResult<AcademicResult[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);

  // Deduplicate by DOI
  const seenDois = new Set<string>();
  const deduped: AcademicResult[] = [];
  for (const r of results) {
    if (r.doi) {
      const key = r.doi.toLowerCase().replace("https://doi.org/", "");
      if (seenDois.has(key)) continue;
      seenDois.add(key);
    }
    deduped.push(r);
  }

  // Sort by citation count (desc), nulls last
  deduped.sort((a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0));
  return deduped;
}

/**
 * Format academic results as a compact string for LLM context injection.
 */
export function formatForLLM(results: AcademicResult[], maxResults = 10): string {
  if (!results.length) return "No academic sources found.";
  
  return results.slice(0, maxResults).map((r, i) => {
    const authors = r.authors.slice(0, 3).join(", ");
    const yearStr = r.year ? ` (${r.year})` : "";
    const citeStr = r.citationCount ? ` [${r.citationCount.toLocaleString()} citations]` : "";
    const doiStr = r.doi ? `\n   DOI: ${r.doi}` : "";
    const absStr = r.abstract ? `\n   Summary: ${r.abstract.slice(0, 150)}...` : "";
    return `${i + 1}. "${r.title}"${yearStr}${citeStr}\n   By: ${authors || "Unknown"}${doiStr}${absStr}`;
  }).join("\n\n");
}
