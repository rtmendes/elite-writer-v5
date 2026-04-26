// Auto-generated agent roster with diverse headshots
// Each agent has a unique identity, role, and avatar

export interface Agent {
  id: string;
  name: string;
  role: string;
  avatar: string;
}

export const AGENTS: Record<string, Agent> = {
  "researcher": {
    "id": "researcher",
    "name": "Maya Chen",
    "role": "Research Agent",
    "avatar": "/agents/researcher.png"
  },
  "outliner": {
    "id": "outliner",
    "name": "Marcus Johnson",
    "role": "Outline Architect",
    "avatar": "/agents/outliner.png"
  },
  "drafter": {
    "id": "drafter",
    "name": "Sofia Andersson",
    "role": "Draft Writer",
    "avatar": "/agents/drafter.png"
  },
  "editor": {
    "id": "editor",
    "name": "Carlos Mendez",
    "role": "Enhancement Editor",
    "avatar": "/agents/editor.png"
  },
  "rewriter": {
    "id": "rewriter",
    "name": "Amara Okafor",
    "role": "Style Rewriter",
    "avatar": "/agents/rewriter.png"
  },
  "factchecker": {
    "id": "factchecker",
    "name": "Raj Patel",
    "role": "Fact Checker",
    "avatar": "/agents/factchecker.png"
  },
  "seo": {
    "id": "seo",
    "name": "Kenji Tanaka",
    "role": "SEO Optimizer",
    "avatar": "/agents/seo.png"
  },
  "continuator": {
    "id": "continuator",
    "name": "Zara Williams",
    "role": "Continuation Writer",
    "avatar": "/agents/continuator.png"
  },
  "scout": {
    "id": "scout",
    "name": "Thomas Fischer",
    "role": "Topic Scout",
    "avatar": "/agents/scout.png"
  },
  "proofreader": {
    "id": "proofreader",
    "name": "Isabella Reyes",
    "role": "Proofreader",
    "avatar": "/agents/proofreader.png"
  },
  "scorer": {
    "id": "scorer",
    "name": "Priya Sharma",
    "role": "Article Scorer",
    "avatar": "/agents/scorer.png"
  },
  "artdirector": {
    "id": "artdirector",
    "name": "David Osei",
    "role": "Art Director",
    "avatar": "/agents/artdirector.png"
  },
  "imagecreator": {
    "id": "imagecreator",
    "name": "Mei Lin",
    "role": "Image Creator",
    "avatar": "/agents/imagecreator.png"
  },
  "infographic": {
    "id": "infographic",
    "name": "Omar Hassan",
    "role": "Data Visualizer",
    "avatar": "/agents/infographic.png"
  },
  "analyst": {
    "id": "analyst",
    "name": "Catherine Sterling",
    "role": "Intelligence Analyst",
    "avatar": "/agents/analyst.png"
  },
  "deepresearch": {
    "id": "deepresearch",
    "name": "Arjun Krishnamurthy",
    "role": "Deep Researcher",
    "avatar": "/agents/deepresearch.png"
  },
  "quality": {
    "id": "quality",
    "name": "Elena Vasquez",
    "role": "Quality Guardian",
    "avatar": "/agents/quality.png"
  },
  "appbuilder": {
    "id": "appbuilder",
    "name": "Nia Thompson",
    "role": "Mini App Builder",
    "avatar": "/agents/appbuilder.png"
  }
};

export function getAgent(id: string): Agent {
  return AGENTS[id] || { id: "default", name: "AI Assistant", role: "General", avatar: "/agents/drafter.png" };
}
