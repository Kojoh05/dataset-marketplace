// KOJOH blog markdown renderer. One file, used by the website build (Node) and the admin preview (browser),
// so what you preview in admin is exactly what goes live. Supports: # headings, paragraphs, **bold**, *italic*,
// `code`, [links](url), ![images](url "caption"), - and 1. lists, > quotes, ``` code blocks, | tables |, ---.
(function (root) {
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function slugify(s) { return String(s).toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); }
  function safeUrl(u) { u = String(u).trim(); return /^(https?:\/\/|\/|#|mailto:)/i.test(u) ? u : '#'; }

  function inline(t) {
    var codes = [];
    t = String(t).replace(/`([^`]+)`/g, function (m, c) { codes.push('<code>' + esc(c) + '</code>'); return '\u0000' + (codes.length - 1) + '\u0000'; });
    t = esc(t);
    t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, function (m, alt, url) {
      return '<img src="' + esc(safeUrl(url.replace(/&amp;/g, '&'))) + '" alt="' + alt + '" loading="lazy">';
    });
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, txt, url) {
      var u = safeUrl(url.replace(/&amp;/g, '&')), ext = /^https?:\/\//i.test(u) && !/^https?:\/\/(www\.)?kojohhi\.com/i.test(u);
      return '<a href="' + esc(u) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + txt + '</a>';
    });
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    return t.replace(/\u0000(\d+)\u0000/g, function (m, i) { return codes[+i]; });
  }

  function render(md) {
    var lines = String(md || '').replace(/\r\n?/g, '\n').split('\n'), out = [], toc = [], i = 0, para = [];
    function flush() { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } }
    while (i < lines.length) {
      var l = lines[i], m;
      if (/^```/.test(l)) {
        flush(); var lang = l.slice(3).trim(), buf = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
        out.push('<pre class="bl-code"' + (lang ? ' data-lang="' + esc(lang) + '"' : '') + '><code>' + esc(buf.join('\n')) + '</code></pre>'); i++; continue;
      }
      if ((m = l.match(/^(#{2,4})\s+(.+)$/))) {
        flush(); var lv = m[1].length, txt = inline(m[2]), id = slugify(m[2]);
        if (lv === 2) toc.push({ id: id, text: m[2].replace(/[*`]/g, '') });
        out.push('<h' + lv + ' id="' + id + '">' + txt + '</h' + lv + '>'); i++; continue;
      }
      if (/^---+\s*$/.test(l)) { flush(); out.push('<hr>'); i++; continue; }
      if ((m = l.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/))) {
        flush();
        out.push('<figure class="bl-fig"><img src="' + esc(safeUrl(m[2])) + '" alt="' + esc(m[1]) + '" loading="lazy">' + (m[3] ? '<figcaption>' + inline(m[3]) + '</figcaption>' : '') + '</figure>');
        i++; continue;
      }
      if (/^\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        flush();
        var cells = function (r) { return r.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); }); };
        var head = cells(l), rows = []; i += 2;
        while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
        out.push('<div class="bl-table"><table><thead><tr>' + head.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>'
          + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>');
        continue;
      }
      if (/^>\s?/.test(l)) {
        flush(); var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; }
        out.push('<blockquote>' + inline(q.join(' ')) + '</blockquote>'); continue;
      }
      if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
        flush(); var ordered = /^\s*\d+\./.test(l), items = [];
        while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
          var it = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''); i++;
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) { it += ' ' + lines[i].trim(); i++; }
          items.push('<li>' + inline(it) + '</li>');
        }
        out.push((ordered ? '<ol>' : '<ul>') + items.join('') + (ordered ? '</ol>' : '</ul>')); continue;
      }
      if (!l.trim()) { flush(); i++; continue; }
      para.push(l.trim()); i++;
    }
    flush();
    var html = out.join('\n'), words = String(md || '').replace(/[#*`>|!\[\]()\-]/g, ' ').split(/\s+/).filter(Boolean).length;
    return { html: html, toc: toc, words: words, minutes: Math.max(1, Math.round(words / 200)) };
  }

  var api = { render: render, slugify: slugify, esc: esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KojohMD = api;
})(typeof window !== 'undefined' ? window : globalThis);
