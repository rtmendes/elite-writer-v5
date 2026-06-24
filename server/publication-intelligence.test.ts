import { describe, it, expect } from "vitest";
import {
  PUBLICATION_INTEL,
  PUBLICATION_INTEL_COUNT,
  getPublicationIntel,
  intelKeywords,
} from "../shared/publication-intelligence";

describe("publication-intelligence dataset", () => {
  it("loads the full canonical catalog with scoring algorithms", () => {
    expect(PUBLICATION_INTEL_COUNT).toBeGreaterThanOrEqual(120);
    const withScoring = PUBLICATION_INTEL.filter(p => p.scoringAlgorithm).length;
    expect(withScoring).toBeGreaterThanOrEqual(120);
  });

  it("resolves by display name and by slug", () => {
    const byName = getPublicationIntel("Forbes");
    expect(byName).not.toBeNull();
    expect(byName!.slug).toBe("forbes");
    const bySlug = getPublicationIntel("forbes");
    expect(bySlug?.name).toBe(byName!.name);
  });

  it("normalizes punctuation/casing when resolving", () => {
    const a = getPublicationIntel("EDTECH Magazine");
    const b = getPublicationIntel("edtech-magazine");
    expect(a).not.toBeNull();
    expect(a?.slug).toBe(b?.slug);
  });

  it("returns null for unknown publications", () => {
    expect(getPublicationIntel("Totally Made Up Outlet 9000")).toBeNull();
    expect(getPublicationIntel(undefined)).toBeNull();
  });

  it("exposes merged keyword + business-topic keywords for matching", () => {
    const forbes = getPublicationIntel("Forbes")!;
    const kw = intelKeywords(forbes);
    expect(Array.isArray(kw)).toBe(true);
    expect(kw.length).toBeGreaterThan(0);
    expect(kw.every(k => k === k.toLowerCase())).toBe(true);
  });
});
