# KOJOH — Project Brief for Development

## WHAT IS KOJOH?

KOJOH is a dataset marketplace web application where job-seekers (primarily aspiring Data Analysts, Data Engineers, Product Analysts, and Quality Analysts) can discover and purchase unique, curated, realistic datasets designed specifically for building standout portfolio projects.

The core problem KOJOH solves: most students and job-seekers build portfolio projects using the same overused datasets (Titanic, Netflix, Superstore, Iris). Their portfolios become repetitive and indistinguishable. KOJOH provides datasets that come from real-world business observations, paired with project challenges that simulate actual workplace scenarios — so the user's portfolio looks like genuine work experience, not homework.

**One-line pitch:** "Datasets nobody else's portfolio is built on."

---

## BUSINESS MODEL

- **Free datasets**: unlimited access, full documentation quality — used as trust-building top-of-funnel
- **Paid datasets**: ₹49–199 INR — low-friction impulse pricing for the Indian student/job-seeker market
- **Each dataset is a complete project package**, not just a CSV:
  - dataset.csv
  - README.md
  - DATA_DICTIONARY.md
  - BUSINESS_CONTEXT.md
  - PROJECT_CHALLENGE.md (the user receives a real business problem to solve, not an exercise)
  - PROJECT_IDEAS.md (beginner/intermediate/advanced tiers)
  - ANALYSIS_GUIDE.md
  - LICENSE.md

- **Optional scarcity model** (not the default): some flagship datasets may have limited licenses (e.g. only 10 buyers), but most datasets are unlimited
- **Optional certification**: users can submit completed projects for manual review and receive a verified project completion certificate

---

## TARGET USERS (in priority order)

1. **Data Analyst job-seekers** — largest buyer pool, 0-2 years experience, actively building portfolios
2. **Data Engineer job-seekers** — underdog category, huge white space, almost no portfolio resources exist
3. **Product Analyst job-seekers** — high interview relevance, few realistic practice datasets
4. **Quality Analyst job-seekers** — biggest underdog, near-zero portfolio content exists for QA data work

---

## DATASET CATEGORIES (organized as "folders" in the UI)

### Folder 1: Data Analyst (4 datasets planned)
- UPI transaction fraud detection (India fintech)
- Quotation-to-order drop-off investigation
- AI agent adoption ROI in SMBs
- Subscription churn with hidden confounders

### Folder 2: Data Engineer (3 datasets planned)
- Messy multi-source data requiring ETL pipeline (inspired by real logistics fragmentation)
- Slowly-changing dimension / historical tracking scenario
- Broken referential integrity — find and fix the pipeline

### Folder 3: Product Analyst (3 datasets planned)
- A/B test with ambiguous/contradictory results
- Onboarding funnel with silent drop-off
- Feature adoption with wrong metric chosen

### Folder 4: Quality Analyst (3 datasets planned)
- Defect clustering across releases
- Test coverage vs. production incidents correlation
- Customer-reported issue triage and root-cause clustering

---

## CURRENT STATE OF THE PROJECT

### What exists right now:
- **Frontend prototype** (static HTML/CSS/JS) deployed on Vercel
- GitHub repo: https://github.com/YashCh05/dataset-marketplace
- PWA setup: manifest.json, sw.js, placeholder icons
- No backend, no auth, no database, no payments — pure static frontend

### File structure:
```
kojoh/
├── index.html        ← clean HTML, links to external CSS/JS
├── styles.css        ← all styles, organized by section with comments
├── script.js         ← typewriter animation, face animation, panel, theme toggle, PWA install, hamburger menu
├── manifest.json     ← PWA manifest
├── sw.js             ← service worker for offline caching
└── icons/
    ├── icon-180.png  ← placeholder (amber K on dark bg)
    ├── icon-192.png
    └── icon-512.png
```

---

## DESIGN SYSTEM

### Brand
- **Name**: KOJOH
- **Personality**: the two O's in KOJOH have animated eyebrows and pupils (like a face/character) — this is the brand mascot built into the typography itself

### Colors (Light theme — default)
```
--bg: #F4F1EA          (warm cream page background)
--card: #FFFFFF         (card/panel surfaces)
--text: #1C1A1E         (near-black primary text)
--muted: #7A7772        (secondary/caption text)
--line: #E4E0D6         (borders, dividers)
--accent: #F3B63A       (amber — CTAs, highlights)
```

### Colors (Dark theme)
```
--bg: #141317
--card: #1F1D22
--text: #EDEBE6
--muted: #9A968E
--line: #2C2A30
```

### Folder colors (each category has its own color)
```
Data Analyst:    #F3B63A (amber)      text: #4A3300
Data Engineer:   #B9A6F0 (purple)     text: #2E1F66
Product Analyst: #8FD3E8 (blue)       text: #0B3B47
Quality Analyst: #F5A8A0 (coral)      text: #5C1A12
```
Each folder has a slightly darker shade for the tab portion.

### Typography
- **Headings / Brand**: Space Grotesk (500, 600, 700)
- **Body / UI**: IBM Plex Sans (400, 500, 600)
- All sizing uses rem and clamp() for fluid responsive scaling

### Layout
- Body has a dark (#0A0A0A) frame/border effect created by html background + body margin (10px on desktop, 0 on mobile)
- Body has border-radius 20px top corners (desktop), 0 on mobile
- Max content width: 67.5rem, centered
- Page padding uses clamp(1.25rem, 4vw, 2.5rem)

### Navigation structure
- **Desktop**: KOJOH brand (left), dark hanging nav bar (center, position absolute, rounded bottom corners) with Home/About/Datasets links, profile pill with avatar + name (right)
- **Mobile (<36rem)**: hamburger icon + KOJOH (left), avatar-only circle (right), dark nav bar hidden, hamburger opens a dropdown mobile menu

### Profile panel
- Slides in from the right with smooth translateX animation
- Dark overlay behind it
- Contains: avatar, editable name, email with change button, Settings section with appearance toggle, Install KOJOH app button pinned to bottom

### Hero section
- Typewriter animation cycles between "KOJOH" (large, ~6.5rem) and "Datasets nobody else's portfolio is built on." (smaller, ~2.75rem)
- When "KOJOH" is fully typed: eyebrows appear on both O's (angled first → flat), pupils appear and drift around subtly
- Face disappears before text deletes, then tagline types out, cycle repeats
- Respects prefers-reduced-motion

### Folder cards
- Literal folder shape: a tab portion (darker shade, shows "X datasets" count) sits top-left, main body (lighter shade) below with rounded corners except top-left
- Square-ish aspect ratio (1 / 0.85) — room for future images/illustrations
- Big uppercase title: "DATA ANALYST", "DATA ENGINEER" etc.
- Hover: translateY(-2px)

### Search bar
- Full-width within content area
- 2px solid dark border (#1C1A1E), rounded pill shape
- Positioned between hero and folder grid

---

## PLANNED TECH STACK (for when backend is built)

- **Frontend**: Currently static HTML/CSS/JS → will migrate to Next.js
- **Hosting**: Vercel
- **Database**: Supabase / PostgreSQL
- **Auth**: Supabase Auth (Google + email/password, no phone OTP)
- **File storage**: Supabase Storage (signed URLs for dataset downloads)
- **Payments**: Razorpay (India)
- **Email**: Resend
- **Analytics**: PostHog (later, not for MVP)
- **Domain**: .com (not yet purchased)

---

## KEY TECHNICAL REQUIREMENTS (for future backend)

1. **Dataset download security**: login → ownership check → short-lived signed URL → download. No public file access.
2. **License enforcement**: if a dataset has limited licenses, use row-level locking or transactions to prevent race conditions on simultaneous purchases.
3. **Razorpay webhook idempotency**: payment webhooks can fire twice; order processing must be idempotent.
4. **Dataset delisting**: when all licenses are sold, use a `delisted_at` timestamp rather than deleting rows — existing owners keep access.
5. **Certificate verification**: public URL (ourwebsite.com/verify/ID) returns certificate details.

---

## MARKETING STRATEGY

- **Primary channel**: LinkedIn content (organic, no paid ads initially)
- **Content strategy**: post the process of creating datasets from real observations, show analysis walkthroughs, build in public
- **Growth loop**: content → website → free dataset → user builds project → posts on LinkedIn → tags KOJOH → new audience → repeat
- **Free datasets are the top of funnel** — they must be genuinely good, not dumbed down

---

## RULES FOR DEVELOPMENT

1. **Mobile-first responsive design** — test on mobile at every step
2. **Fluid sizing** — use rem, clamp(), auto-fit grids. No fixed px values for layout.
3. **Dark/light theme** — all colors via CSS custom properties, theme toggleable
4. **Clean separation** — HTML (structure), CSS (styles), JS (behavior) in separate files
5. **No frameworks yet** — pure HTML/CSS/JS until we decide to migrate to Next.js
6. **PWA compliant** — manifest, service worker, icons must stay valid
7. **Performance** — no heavy libraries, minimal dependencies, fast load
8. **Accessibility** — semantic HTML, aria labels on interactive elements, keyboard navigable
9. **The brand character (face on the O's) is important** — preserve the typewriter + face animation, it's the brand identity

---

## WHAT NEEDS TO BE BUILT NEXT

### Immediate (frontend, no backend needed):
- [ ] Fix remaining mobile responsiveness issues (content overflow on small screens)
- [ ] About section/page content
- [ ] Individual dataset detail view (what happens when you click a folder → click a dataset)
- [ ] Footer
- [ ] Proper loading states
- [ ] 404 page
- [ ] Better dark theme refinement

### Soon (requires backend decisions):
- [ ] Auth flow (signup/login pages)
- [ ] Dataset detail page with purchase flow
- [ ] User dashboard (purchased datasets, download history)
- [ ] Supabase integration
- [ ] Razorpay payment integration

### Later:
- [ ] Project submission + certification flow
- [ ] Admin panel for managing datasets
- [ ] Email flows (post-purchase engagement)
- [ ] Search functionality (actual filtering, not just a placeholder input)
- [ ] SEO optimization
- [ ] Analytics integration

---

## OWNER

**Yash Chauhan** — Data Analyst and Automation Specialist at INALSA Home Appliances (Tuareg Marketing Pvt. Ltd.), based in Noida, Delhi NCR. Building KOJOH as a solo side project to validate a real business idea. Prefers actionable, copy-paste-ready output over lengthy explanations. Currently handles all design, development, and content creation himself.

---

## IMPORTANT CONTEXT

- This is NOT a portfolio project or assignment — it's a real business attempt going from zero to first customer to revenue
- The dataset creation process (observe real business problems → research → design data model → generate with Python → validate → package) is the core competitive advantage
- Legal boundary: datasets are synthetic/observation-inspired, never based on actual employer data. Keep a hard wall between INALSA work observations and KOJOH dataset content.
- The name "KOJOH" is a working name — may change before official launch, but all branding/animation work is built around it for now
