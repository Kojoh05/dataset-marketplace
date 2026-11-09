// KOJOH build step: writes the keywords from Admin -> SEO keywords into the static pages.
// Runs on every Vercel deploy (see vercel.json "buildCommand"). It only edits the build copy,
// never the repo, and it never fails the deploy: if anything goes wrong the pages ship unchanged.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MAX_SHOWN = 12;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const uniq = arr => { const seen = new Set(); return arr.filter(k => { const l = String(k).toLowerCase().trim(); if (!l || seen.has(l)) return false; seen.add(l); return true; }); };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

function cfg() {
  const src = fs.readFileSync(path.join(ROOT, 'supabase-config.js'), 'utf8');
  const url = (src.match(/https:\/\/[a-z0-9]+\.supabase\.co/) || [])[0];
  const key = (src.match(/eyJ[A-Za-z0-9._-]+/) || src.match(/sb_publishable_[A-Za-z0-9_-]+/) || [])[0];
  if (!url || !key) throw new Error('supabase config not found');
  return { url, key };
}

async function get(c, q) {
  const r = await fetch(`${c.url}/rest/v1/${q}`, { headers: { apikey: c.key, Authorization: `Bearer ${c.key}` } });
  if (!r.ok) throw new Error(`${q}: ${r.status} ${await r.text()}`);
  return r.json();
}

function setMetaKeywords(html, kws) {
  const tag = `<meta name="keywords" content="${esc(kws.join(', '))}">`;
  if (/<meta name="keywords"[^>]*>/.test(html)) return html.replace(/<meta name="keywords"[^>]*>/, tag);
  return html.replace(/(<meta name="description"[^>]*>)/, `$1\n${tag}`);
}

function editLd(html, fn) {
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (m, body) => {
    try {
      const data = JSON.parse(body.replace(/<\\\//g, '</'));
      (Array.isArray(data) ? data : [data]).forEach(fn);
      return `<script type="application/ld+json">${JSON.stringify(data).replace(/<\//g, '<\\/')}</script>`;
    } catch (e) { return m; }
  });
}

function chips(kws, cls, style) {
  return kws.slice(0, MAX_SHOWN).map(k => `<span class="${cls}"${style ? ` style="${style}"` : ''}>${esc(k)}</span>`).join('');
}

function projectPage(html, kws, primary) {
  // 1. Google title: primary keyword first
  if (primary) {
    html = html.replace(/<title>([^<]*)<\/title>/, (m, t) => {
      const plain = t.replace(/&amp;/g, '&').replace(/&#x27;/g, "'");
      const i = plain.indexOf(': ');
      const rest = i > 0 ? plain.slice(i + 2) : 'Data Project | KOJOH';
      let nt = `${cap(primary)}: ${rest}`;
      if (nt.length > 65) nt = `${cap(primary)} | KOJOH`;
      return `<title>${esc(nt)}</title>`;
    });
    const nt = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
    if (nt) html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${nt}$2`);
  }
  // 2. meta keywords + Dataset schema keywords
  html = setMetaKeywords(html, kws);
  html = editLd(html, o => { if (o && o['@type'] === 'Dataset') o.keywords = uniq([...kws, ...(o.keywords || [])]); });
  // 3. visible "people also search for" block
  const block = `<!--kw--><section class="pj-sec"><h2>People also search for this project as</h2><div class="pj-chips">${chips(kws, 'k-chip')}</div></section>\n`;
  const anchor = '<section class="pj-sec"><h2>More projects</h2>';
  html = html.includes(anchor) ? html.replace(anchor, block + anchor) : html.replace('</main>', block + '</main>');
  return html;
}

function sitePage(html, kws) {
  html = setMetaKeywords(html, kws);
  html = editLd(html, o => {
    if (o && ['Organization', 'WebSite', 'CollectionPage'].includes(o['@type'])) o.keywords = uniq([...kws, ...(o.keywords || [])]).join(', ');
  });
  const block = `<!--kw--><section style="max-width:56rem;margin:2rem auto 0;padding:0 1rem"><h2 style="font-family:'Space Grotesk',sans-serif;font-size:1.1rem;margin:0 0 .6rem">Popular searches</h2>`
    + `<div style="display:flex;flex-wrap:wrap;gap:.4rem">${chips(kws, 'k-chip', 'display:inline-block;font-size:.78rem;padding:.25rem .65rem;border:1px solid var(--line,#ddd);border-radius:999px')}</div></section>\n`;
  return html.replace('</main>', block + '</main>');
}

async function main() {
  const c = cfg();
  const [ds, kw] = await Promise.all([
    get(c, 'datasets?select=id,slug,title&is_published=eq.true'),
    get(c, 'seo_keywords?select=dataset_id,keyword,is_primary&order=is_primary.desc,created_at.asc'),
  ]);
  const bySlug = {}, siteKw = [];
  const idToSlug = Object.fromEntries(ds.map(d => [d.id, d.slug]));
  for (const k of kw) {
    if (!k.dataset_id) { siteKw.push(k.keyword.trim()); continue; }
    const slug = idToSlug[k.dataset_id]; if (!slug) continue;
    (bySlug[slug] ||= { kws: [], primary: null });
    bySlug[slug].kws.push(k.keyword.trim());
    if (k.is_primary) bySlug[slug].primary = k.keyword.trim();
  }
  let n = 0;
  for (const [slug, v] of Object.entries(bySlug)) {
    const f = path.join(ROOT, 'projects', `${slug}.html`);
    if (!fs.existsSync(f)) continue;
    const kws = uniq(v.kws);
    fs.writeFileSync(f, projectPage(fs.readFileSync(f, 'utf8'), kws, v.primary)); n++;
  }
  const site = uniq(siteKw);
  if (site.length) for (const p of ['welcome.html', 'projects/index.html']) {
    const f = path.join(ROOT, p);
    if (fs.existsSync(f)) fs.writeFileSync(f, sitePage(fs.readFileSync(f, 'utf8'), site));
  }
  // llms.txt / llms-full.txt: tell AI assistants which searches each project answers
  const lines = ['', '## Search terms', site.length ? `KOJOH: ${site.join('; ')}` : ''];
  for (const d of ds) if (bySlug[d.slug]) lines.push(`- ${d.title.replace(/\s*\(Free\)\s*$/, '')} (https://www.kojohhi.com/projects/${d.slug}): ${uniq(bySlug[d.slug].kws).join('; ')}`);
  for (const p of ['llms.txt', 'llms-full.txt']) {
    const f = path.join(ROOT, p);
    if (fs.existsSync(f)) fs.appendFileSync(f, lines.join('\n') + '\n');
  }
  console.log(`[keywords] ${n} project pages, ${site.length} site keywords`);
}

main().catch(e => console.log('[keywords] skipped, pages unchanged:', e.message)).finally(() => process.exit(0));
