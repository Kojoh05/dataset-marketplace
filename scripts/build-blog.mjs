// KOJOH build step: turns published posts from Admin -> Blog into static pages Google can read.
// Runs on every Vercel deploy before apply-keywords.mjs (see vercel.json "buildCommand").
// Writes /blog/index.html and /blog/<slug>.html, adds the posts to sitemap.xml and llms.txt.
// It never fails the deploy: if anything goes wrong the committed blog/index.html ships unchanged.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const SITE = 'https://www.kojohhi.com';
const MD = require(path.join(ROOT, 'blog-md.js'));
const esc = MD.esc;

function cfg() {
  const src = fs.readFileSync(path.join(ROOT, 'supabase-config.js'), 'utf8');
  const url = (src.match(/https:\/\/[a-z0-9]+\.supabase\.co/) || [])[0];
  const key = (src.match(/eyJ[A-Za-z0-9._-]+/) || src.match(/sb_publishable_[A-Za-z0-9_-]+/) || [])[0];
  if (!url || !key) throw new Error('supabase config not found');
  return { url, key };
}

async function posts() {
  const c = cfg();
  const q = 'blog_posts?select=slug,title,description,body_md,cover_url,cover_alt,project_slug,tags,author,published_at,updated_at&status=eq.published&order=published_at.desc';
  const r = await fetch(`${c.url}/rest/v1/${q}`, { headers: { apikey: c.key, Authorization: `Bearer ${c.key}` } });
  if (!r.ok) throw new Error(`blog_posts: ${r.status} ${await r.text()}`);
  return r.json();
}

// project title, free or price, read from the static project page so the button is always right
function project(slug) {
  if (!slug) return null;
  const f = path.join(ROOT, 'projects', `${slug}.html`);
  if (!fs.existsSync(f)) return null;
  const s = fs.readFileSync(f, 'utf8');
  const title = ((s.match(/<h1 class="pj-h1">([^<]*)<\/h1>/) || [])[1] || slug).replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
  const free = /<span class="k-chip k-chip-brand">Free<\/span>/.test(s);
  const price = ((s.match(/<span class="pj-price">(?:<s>[^<]*<\/s>\s*)?([^<]*)<\/span>/) || [])[1] || '').trim();
  const img = (s.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] || '';
  return { slug, title, free, price, img };
}

const day = d => (d ? new Date(d) : new Date()).toISOString().slice(0, 10);
const nice = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
const abs = u => (!u ? '' : /^https?:/.test(u) ? u : SITE + (u.startsWith('/') ? u : '/' + u));
const ld = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/<\//g, '<\\/')}</script>`;

function head({ title, desc, canon, img, type }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canon}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="KOJOH">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canon}">
${img ? `<meta property="og:image" content="${esc(img)}">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="${esc(img)}">` : '<meta name="twitter:card" content="summary">'}
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-96.png" sizes="96x96" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="alternate" type="application/rss+xml" title="KOJOH Blog" href="${SITE}/blog/rss.xml">
<script src="/theme.js"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/pages.css">
<link rel="stylesheet" href="/nav.css">
<link rel="stylesheet" href="/kojoh-ui.css">
<link rel="stylesheet" href="/projects.css">
<link rel="stylesheet" href="/blog.css">
<script src="/nav.js"></script>`;
}
const foot = `
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
<script src="/supabase-config.js"></script>
<script src="/config.js"></script>
</body>
</html>
`;

const ORG = { '@type': 'Organization', name: 'KOJOH', url: SITE + '/', logo: { '@type': 'ImageObject', url: SITE + '/icons/icon-512.png' } };

function card(p) {
  const r = MD.render(p.body_md);
  return `<a class="bl-card" href="/blog/${p.slug}">${p.cover_url ? `<img src="${esc(p.cover_url)}" alt="${esc(p.cover_alt || p.title)}" loading="lazy" width="1200" height="630">` : '<span class="bl-card-noimg" aria-hidden="true"></span>'}`
    + `<span class="bl-card-body"><b>${esc(p.title)}</b>${p.description ? `<span>${esc(p.description)}</span>` : ''}<small>${nice(p.published_at)} · ${r.minutes} min read</small></span></a>`;
}

export function postPage(p, all) {
  const r = MD.render(p.body_md), pr = project(p.project_slug), canon = `${SITE}/blog/${p.slug}`;
  const img = abs(p.cover_url) || (pr && pr.img) || `${SITE}/og-image.png`;
  const desc = p.description || r.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 155);
  const more = all.filter(x => x.slug !== p.slug).slice(0, 4);
  const cta = pr ? `<aside class="bl-cta"><span class="bl-cta-kicker">${pr.free ? 'Free project' : 'Project'}</span><b>${esc(pr.title)}</b>`
    + `<p>${pr.free ? 'Do it yourself on the real messy files, with a guided brief, tasks and an AI coach prompt. Free after sign-in.' : `Do it yourself on the real messy files, with a guided brief, tasks and a reviewed certificate. ${esc(pr.price)}, one-time.`}</p>`
    + `<a class="k-btn k-btn-brand k-btn-lg" href="/projects/${pr.slug}">${pr.free ? 'Open the free project' : 'See the project'} &rarr;</a></aside>` : '';
  const toc = r.toc.length >= 3 ? `<nav class="bl-toc" aria-label="In this post"><b>In this post</b><ol>${r.toc.map(t => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ol></nav>` : '';
  const data = [
    { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: desc, image: [img], datePublished: p.published_at, dateModified: p.updated_at || p.published_at,
      author: p.author === 'KOJOH team' ? ORG : { '@type': 'Person', name: p.author }, publisher: ORG, mainEntityOfPage: canon, url: canon, wordCount: r.words, inLanguage: 'en',
      keywords: (p.tags || []).join(', '), ...(pr ? { about: { '@type': 'Dataset', name: pr.title, url: `${SITE}/projects/${pr.slug}` } } : {}) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Blog', item: `${SITE}/blog` },
      { '@type': 'ListItem', position: 2, name: p.title, item: canon }] }
  ];
  return head({ title: `${p.title} | KOJOH Blog`, desc, canon, img, type: 'article' })
    + `\n<meta property="article:published_time" content="${esc(p.published_at)}">\n${ld(data)}\n</head>\n<body>
<header class="page-header"><span class="page-title">Blog</span></header>
<main class="page-wrap pj bl">
<nav class="k-crumbs" aria-label="Breadcrumb"><a href="/blog">Blog</a>${pr ? `<span aria-hidden="true">/</span><a href="/projects/${pr.slug}">${esc(pr.title.split(':')[0])}</a>` : ''}</nav>
<article>
<h1 class="pj-h1">${esc(p.title)}</h1>
<p class="bl-meta">${esc(p.author)} · <time datetime="${esc(p.published_at)}">${nice(p.published_at)}</time> · ${r.minutes} min read</p>
${p.description ? `<p class="pj-lead">${esc(p.description)}</p>` : ''}
${p.cover_url ? `<figure class="bl-cover"><img src="${esc(p.cover_url)}" alt="${esc(p.cover_alt || p.title)}" width="1200" height="630" loading="eager"></figure>` : ''}
${toc}
<div class="bl-body">
${r.html}
</div>
${cta}
${(p.tags || []).length ? `<div class="pj-chips bl-tags">${p.tags.map(t => `<span class="k-chip">${esc(t)}</span>`).join('')}</div>` : ''}
</article>
${more.length ? `<section class="pj-sec"><h2>More from the blog</h2><div class="bl-grid">${more.map(card).join('')}</div></section>` : ''}
<p class="bl-back"><a href="/blog">&larr; All posts</a> · <a href="/free">Free projects</a> · <a href="/projects">All projects</a></p>
</main>` + foot;
}

export function indexPage(all) {
  const canon = `${SITE}/blog`, title = 'KOJOH Blog: Data Guides and Project Walkthroughs';
  const desc = 'Free guides on messy real-world datasets: how to clean, analyse and present them in SQL, Python, Excel and Power BI, with a portfolio project for each.';
  const data = { '@context': 'https://schema.org', '@type': 'Blog', name: 'KOJOH Blog', url: canon, description: desc, publisher: ORG,
    blogPost: all.slice(0, 30).map(p => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}/blog/${p.slug}`, datePublished: p.published_at })) };
  return head({ title, desc, canon, img: `${SITE}/og-image.png`, type: 'website' }) + `\n${ld(data)}\n</head>\n<body>
<header class="page-header"><span class="page-title">Blog</span></header>
<main class="page-wrap pj bl">
<h1 class="pj-h1">Data guides and project walkthroughs</h1>
<p class="pj-lead">How to find, clean and analyse messy business data, explained one dataset at a time. Every guide links to a project you can do yourself on the real files, and most of them are free.</p>
${all.length ? `<div class="bl-grid bl-grid-main">${all.map(card).join('')}</div>` : '<p class="bl-empty">The first guide is on its way. Meanwhile, start with a <a href="/free">free project</a>.</p>'}
<p class="bl-back"><a href="/free">Free projects</a> · <a href="/projects">All projects</a> · <a href="/blog/rss.xml">RSS</a></p>
</main>` + foot;
}

function rss(all) {
  const x = s => esc(s).replace(/&#x27;/g, "'");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>KOJOH Blog</title><link>${SITE}/blog</link><description>Data guides and project walkthroughs from KOJOH</description>\n`
    + all.slice(0, 30).map(p => `<item><title>${x(p.title)}</title><link>${SITE}/blog/${p.slug}</link><guid>${SITE}/blog/${p.slug}</guid><pubDate>${new Date(p.published_at).toUTCString()}</pubDate><description>${x(p.description || '')}</description></item>`).join('\n')
    + '\n</channel></rss>\n';
}

async function main() {
  const all = (await posts()).filter(p => /^[a-z0-9-]+$/.test(p.slug));
  const dir = path.join(ROOT, 'blog');
  fs.mkdirSync(dir, { recursive: true });
  for (const p of all) fs.writeFileSync(path.join(dir, `${p.slug}.html`), postPage(p, all));
  fs.writeFileSync(path.join(dir, 'index.html'), indexPage(all));
  fs.writeFileSync(path.join(dir, 'rss.xml'), rss(all));
  // project pages link back to the guides written about them (build copy only)
  const byProj = {};
  for (const p of all) if (p.project_slug) (byProj[p.project_slug] ||= []).push(p);
  for (const [slug, list] of Object.entries(byProj)) {
    const f = path.join(ROOT, 'projects', `${slug}.html`);
    if (!fs.existsSync(f)) continue;
    let h = fs.readFileSync(f, 'utf8');
    const block = `<section class="pj-sec"><h2>Guides for this project</h2><ul class="pj-rel">${list.slice(0, 5).map(p => `<li><a href="/blog/${p.slug}">${esc(p.title)}</a><span>Blog guide</span></li>`).join('')}</ul></section>\n`;
    const anchor = '<section class="pj-sec"><h2>More projects</h2>';
    h = h.includes(anchor) ? h.replace(anchor, block + anchor) : h.replace('</main>', block + '</main>');
    fs.writeFileSync(f, h);
  }
  if (all.length) {
    const sm = path.join(ROOT, 'sitemap.xml');
    let s = fs.readFileSync(sm, 'utf8');
    const add = all.filter(p => !s.includes(`${SITE}/blog/${p.slug}<`))
      .map(p => `  <url><loc>${SITE}/blog/${p.slug}</loc><lastmod>${day(p.updated_at || p.published_at)}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`).join('\n');
    if (add) fs.writeFileSync(sm, s.replace('</urlset>', add + '\n</urlset>'));
    const lines = ['', '## Blog (guides)', ...all.map(p => `- [${p.title}](${SITE}/blog/${p.slug}): ${p.description || ''}`)];
    for (const f of ['llms.txt', 'llms-full.txt']) { const fp = path.join(ROOT, f); if (fs.existsSync(fp)) fs.appendFileSync(fp, lines.join('\n') + '\n'); }
  }
  console.log(`[blog] ${all.length} posts`);
}

if (process.argv[1] && process.argv[1].endsWith('build-blog.mjs')) {
  main().catch(e => console.log('[blog] skipped, committed pages unchanged:', e.message)).finally(() => process.exit(0));
}
