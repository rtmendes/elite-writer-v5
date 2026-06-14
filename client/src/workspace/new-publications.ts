// ── New outlets for beats the original 184 didn't cover ────────────────────
// Aviation / pilot training / women in aviation, homesteading, and ADHD /
// executive functioning. Researched June 2026 (audience, pay, submission,
// style). ensureNewPublications() inserts any of these not already in the
// live Publications table. Same shape as the seed; full style fields included.
export interface NewPub {
  name: string; category?: string; website?: string; pay?: string; payMax?: number;
  wordCount?: number; topics?: string; writingStyle?: string; editorStyle?: string;
  editorLikes?: string; doNotWrite?: string; targetAudience?: string; submission?: string;
  classification?: string; tier?: string;
}

export const NEW_PUBLICATIONS: NewPub[] = [
  {
    name: "AOPA Pilot", category: "Aviation", website: "https://www.aopa.org/news-and-media/publications/writers-guidelines",
    pay: "Paid on acceptance", payMax: 1000, wordCount: 2000,
    topics: "General aviation — flying technique, aircraft, avionics, advocacy, GA industry trends",
    writingStyle: "Feature articles 1,500–2,500 words for certificated pilots and aircraft owners; relevant to the audience with a new or unusual angle; rigorously fact-checked and entirely original.",
    editorLikes: "A fresh or unusual angle on technique, a notable aircraft, avionics, or a GA-industry trend; verified facts and sources.",
    doNotWrite: "Generic aviation pieces with no new angle; unverified claims.",
    targetAudience: "Certificated pilots and aircraft owners — veteran pilots and aviation enthusiasts.",
    submission: "AOPA Writers' Guidelines (aopa.org/news-and-media/publications/writers-guidelines). Original work only.",
    classification: "Freelance - Pay Per Article", tier: "Tier 3: Pitching Editors Directly",
  },
  {
    name: "Flying Magazine", category: "Aviation", website: "https://www.flyingmag.com",
    topics: "General aviation, aircraft reviews, technique, gear, the flying life",
    writingStyle: "Authoritative aviation journalism for pilots and aircraft owners — technique, aircraft, and the flying life.",
    targetAudience: "Pilots, aircraft owners, and aviation enthusiasts.",
    classification: "Freelance - Pay Per Article",
  },
  {
    name: "Plane & Pilot", category: "Aviation", website: "https://www.planeandpilotmag.com",
    pay: "$500/article", payMax: 500, wordCount: 2000,
    topics: "Lessons learned flying, reducing flight risk, GA aircraft, pilot proficiency",
    writingStyle: "1,500–2,500-word stories on lessons learned about flying and insightful takes on how pilots can reduce flight risk.",
    editorLikes: "Real lessons-learned narratives; actionable risk-reduction insight for pilots.",
    targetAudience: "General-aviation pilots and aircraft owners.",
    classification: "Freelance - Pay Per Article",
  },
  {
    name: "General Aviation News", category: "Aviation", website: "https://generalaviationnews.com",
    pay: "$75–$250/article", payMax: 250,
    topics: "GA news, pilots, aircraft, airports, the general-aviation community",
    targetAudience: "General-aviation pilots and enthusiasts.",
    classification: "Freelance - Pay Per Article",
  },
  {
    name: "Aviation for Women", category: "Aviation", website: "https://www.wai.org",
    topics: "Women in aviation and aerospace — careers, profiles, mentorship, industry news",
    writingStyle: "Profiles and features celebrating women across aviation/aerospace; inspiring, career- and mentorship-focused.",
    targetAudience: "Women in Aviation International members — women pilots, mechanics, engineers, and aspiring aviation professionals.",
    classification: "Contributor",
  },
  {
    name: "Mother Earth News", category: "Homesteading", website: "https://www.motherearthnews.com/sustainable-living/mother-earth-living-freelance-writer-guidelines/",
    pay: "Firsthand Reports $150 (1,500–2,000w); Country Lore $25–$100", payMax: 150,
    topics: "Sustainable homesteading, organic gardening, real food, country skills, renewable energy, natural health, livestock",
    writingStyle: "Informative, well-documented, tightly written in an engaging, energetic voice. Firsthand Reports = first-person sustainable-lifestyle stories (1,500–2,000 words).",
    editorLikes: "Practical, well-documented homesteading/sustainability how-to and firsthand reports; read the magazine before querying.",
    doNotWrite: "Vague, thinly-sourced pieces; content that ignores the sustainable-living focus.",
    targetAudience: "Homesteaders and sustainable-living readers, teens to 90+, from 1970s subscribers to eager newcomers.",
    submission: "Email queries to letters@MotherEarthNews.com.",
    classification: "Freelance - Pay Per Article",
  },
  {
    name: "ADDitude", category: "Health", website: "https://www.additudemag.com/contact-us/contributors-guidelines/",
    topics: "ADHD/ADD, executive functioning, learning disabilities — strategies, tools, parenting, adult ADHD",
    writingStyle: "Personal-experience blogging sharing the strategies and tools that work; evidence-based, practical, supportive. Blog posts 500–800 words.",
    editorLikes: "Lived experience + tested strategies for ADHD/executive functioning, from parents or adults living it; webinar experts hold an M.D./Ph.D./M.S.",
    doNotWrite: "Non-evidence-based claims; generic advice without lived experience.",
    targetAudience: "Children and adults with ADHD/ADD and their parents — the leading evidence-based ADHD audience.",
    submission: "Send a 500–800-word sample blog post via the Contributors' Guidelines page.",
    classification: "Contributor",
  },
];
