# ⚡ Job Command Center

Job search tracker + auto-apply agent for **Forward Deployed Engineer / AI Deployment / Applied AI** roles.

## What's Inside

### 🌐 Web App (`src/`)
A React job board with:
- **Tracker** — 35+ pre-loaded target companies across 4 tiers, with fit scores, status tracking, and notes
- **Search URLs** — 150+ pre-generated clickable Google `site:` searches across Ashby, Greenhouse, Lever, Workday, and 8 job boards, using 25 title variants
- **Scraper Info** — setup instructions and coverage stats

All data persists in `localStorage`.

### 🤖 Auto-Apply Agent (`auto_apply.py`)
A Playwright-based agent that:
1. Takes a job URL (Greenhouse, Ashby, or Lever)
2. Opens a **visible** browser window
3. Detects the ATS platform
4. Pre-fills: name, email, phone, LinkedIn, GitHub, website, current company, location, work authorization
5. Uploads your resume PDF
6. **Pauses for your review** — you fill in custom questions manually, then confirm

Supports single URL, interactive mode, and batch mode from a file.

## Setup

### Web App
```bash
npm install
npm run dev
```

Deploy to GitHub Pages:
```bash
npm run build
# push dist/ to gh-pages branch
```

### Auto-Apply Agent
```bash
pip install playwright
playwright install chromium
```

Edit `PROFILE` at the top of `auto_apply.py` with your info, then:
```bash
# Interactive mode
python auto_apply.py

# Single URL
python auto_apply.py https://job-boards.greenhouse.io/anthropic/jobs/4985877008

# Batch mode (reads urls.txt, pauses for review each time)
python auto_apply.py --batch urls.txt

# Batch mode, auto-submit (no pause — use carefully)
python auto_apply.py --batch urls.txt --auto
```

## Search Coverage

| Dimension | Count |
|-----------|-------|
| Title variants | 25 |
| ATS platforms (Google `site:` search) | 6 |
| Job boards | 8 |
| Google `site:` queries | 150 |
| LinkedIn queries | 25 |
| Indeed queries | 10 |
| **Total search URLs** | **185+** |

### Title Variants Searched
- Forward Deployed Engineer
- Forward Deployed AI Engineer
- AI Deployment Engineer / Strategist
- Applied AI Engineer
- Solutions Engineer (AI / LLM / ML)
- Solutions Architect (AI)
- AI Consultant
- AI Implementation Engineer
- Customer Engineer (AI)
- Technical Account Manager (AI / LLM)
- AI Strategist
- Professional Services Engineer (AI)
- Field Engineer (AI)
- AI Integration Engineer
- Pre-Sales Engineer (AI)
- Enterprise AI Engineer
- And more...

## Architecture

```
job-command-center/
├── src/
│   ├── App.jsx          # Main React app (tracker + search + scraper tabs)
│   └── main.jsx         # Entry point
├── auto_apply.py        # Playwright auto-apply agent
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

## License
MIT
