# Elite Writer App - Roadmap

## Current Features (v1.0)
- [x] Quick Write editor with AI scoring accordion
- [x] 11-dimension real-time scoring (Clarity, Hook, Voice, Data, Originality, Pub Fit, Timeliness, Actionable, Expertise, Readability, Conclusion)
- [x] Zoom controls (70%-150%)
- [x] Resizable sidebar with drag handle
- [x] Export to Markdown, TXT, HTML, Word, PDF
- [x] Google Docs export (copy + open new doc)
- [x] Publication style analysis API
- [x] Cloudflare Functions for secure API calls

## Future Releases

### v1.1 - Editor Enhancements
- [ ] Full Google Docs API integration with OAuth (create doc directly, return share link)
- [ ] Real-time collaboration via Google Docs embed
- [ ] Auto-save to Google Drive

### v1.2 - Advanced Scoring
- [ ] Score history tracking with trend graphs
- [ ] Publication-specific scoring weights
- [ ] A/B headline testing with AI

### v1.3 - Style Learning
- [ ] Import articles via URL scraping
- [ ] Aggregated style insights per publication
- [ ] Style comparison tool

### v1.4 - Workflow Automation
- [ ] Pitch templates per publication
- [ ] Email integration for pitch sending
- [ ] Submission tracking dashboard

---

## Notes

**Google Docs API Integration (Future)**
- Requires Google Cloud project setup
- OAuth 2.0 for user authentication
- Scopes needed: `https://www.googleapis.com/auth/documents`
- Will enable: direct doc creation, share link generation, real-time sync
