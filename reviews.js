// === KOJOH REVIEWS ===
// kojohReviews(el, { datasetId, owned }) renders the reviews block on a dataset page:
// the average, the spread of stars, the top 5, and a form for owners (one review per account).
(function () {
  function css() {
    if (document.getElementById('kRevCss')) return;
    var st = document.createElement('style'); st.id = 'kRevCss';
    st.textContent = ''
      + ':root{--k-star:#1F9D55}html[data-theme="dark"]{--k-star:#3DD68C}'
      + '.krv{margin-top:2.5rem;border-top:1px solid var(--line);padding-top:2rem}'
      + '.krv h2{font-family:"Space Grotesk",sans-serif;font-size:1.35rem;margin:0 0 1rem}'
      + '.krv-sum{display:grid;grid-template-columns:auto minmax(0,1fr);gap:1.5rem 2rem;align-items:center;background:var(--card,#fff);border:1px solid var(--line);border-radius:18px;padding:1.25rem 1.4rem}'
      + '@media (max-width:36rem){.krv-sum{grid-template-columns:1fr}}'
      + '.krv-avg{font-family:"Space Grotesk",sans-serif;font-size:2.6rem;font-weight:700;line-height:1}'
      + '.krv-avg small{display:block;font-family:inherit;font-size:.8rem;font-weight:500;color:var(--muted);margin-top:.35rem}'
      + '.krv-count{display:block;font-size:.8rem;color:var(--muted);margin-top:.3rem}'
      + '.krv-stars{color:var(--k-star);letter-spacing:.08em;font-size:1rem;white-space:nowrap}'
      + '.krv-stars .off{color:var(--line)}'
      + '.krv-bars{display:flex;flex-direction:column;gap:.3rem}'
      + '.krv-bar{display:grid;grid-template-columns:2.2rem 1fr 2rem;gap:.6rem;align-items:center;font-size:.78rem;color:var(--muted)}'
      + '.krv-bar i{display:block;height:6px;border-radius:999px;background:var(--line);overflow:hidden}'
      + '.krv-bar i b{display:block;height:100%;background:var(--k-star);border-radius:999px}'
      + '.krv-list{list-style:none;margin:1.1rem 0 0;padding:0;display:flex;flex-direction:column;gap:.8rem}'
      + '.krv-item{background:var(--card,#fff);border:1px solid var(--line);border-radius:16px;padding:1rem 1.15rem}'
      + '.krv-head{display:flex;flex-wrap:wrap;align-items:center;gap:.35rem .7rem;font-size:.85rem}'
      + '.krv-head b{font-weight:600}'
      + '.krv-head time{color:var(--muted);font-size:.78rem}'
      + '.krv-tag{font-size:.68rem;font-weight:600;padding:.12rem .5rem;border-radius:999px;border:1px solid var(--line);color:var(--muted)}'
      + '.krv-tag.v{color:#2F7D4F;border-color:rgba(47,125,79,.35)}'
      + 'html[data-theme="dark"] .krv-tag.v{color:#6FCF97}'
      + '.krv-body{margin:.55rem 0 0;font-size:.9rem;line-height:1.6;white-space:pre-wrap}'
      + '.krv-reply{margin-top:.7rem;background:var(--bg);border-radius:10px;padding:.6rem .8rem;font-size:.84rem;line-height:1.55}'
      + '.krv-reply b{display:block;font-size:.72rem;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:.15rem}'
      + '.krv-form{margin-top:1.1rem;background:var(--card,#fff);border:1px solid var(--line);border-radius:16px;padding:1.1rem 1.2rem;display:flex;flex-direction:column;gap:.7rem}'
      + '.krv-form h3{margin:0;font-size:1rem}'
      + '.krv-pick{display:flex;gap:.2rem}'
      + '.krv-pick button{font:inherit;font-size:1.6rem;line-height:1;background:none;border:0;cursor:pointer;color:var(--line);padding:0 .1rem}'
      + '.krv-pick button.on{color:var(--k-star)}'
      + '.krv-form textarea{font:inherit;font-size:.9rem;min-height:6.5rem;border:1px solid var(--line);border-radius:12px;padding:.7rem .85rem;background:var(--bg);color:var(--text);resize:vertical}'
      + '.krv-row{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;justify-content:space-between}'
      + '.krv-row small{color:var(--muted);font-size:.78rem}'
      + '.krv-note{color:var(--muted);font-size:.875rem;margin:1rem 0 0}'
      + '.krv-err{color:#B5562A;font-size:.82rem}';
    document.head.appendChild(st);
  }
  function stars(n) {
    var h = '<span class="krv-stars" aria-label="' + n + ' out of 5">';
    for (var i = 1; i <= 5; i++) h += i <= Math.round(n) ? '&#9733;' : '<span class="off">&#9733;</span>';
    return h + '</span>';
  }
  function fmtDate(v) { try { return new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } }

  window.kojohStars = stars;

  window.kojohReviews = async function (el, opts) {
    if (!el || !opts || !opts.datasetId) return;
    css();
    var S = window.kojohSupa && window.kojohSupa(), esc = window.kojohEsc;
    if (!S) return;
    var uid = null, mine = null, stats = null, top = [], all = null, showAll = false, editing = false, rating = 0, msg = '';
    try { var ss = await S.auth.getSession(); uid = ss.data && ss.data.session && ss.data.session.user.id; } catch (e) {}

    async function load() {
      var r = await Promise.all([
        S.from('dataset_review_stats').select('*').eq('dataset_id', opts.datasetId).maybeSingle(),
        S.from('reviews').select('id, user_id, rating, body, reviewer_name, verified_owner, added_by_admin, featured, admin_reply, created_at, status')
          .eq('dataset_id', opts.datasetId).eq('status', 'visible')
          .order('featured', { ascending: false }).order('rating', { ascending: false }).order('created_at', { ascending: false }).limit(5),
        uid ? S.from('reviews').select('id, rating, body, status, created_at').eq('dataset_id', opts.datasetId).eq('user_id', uid).maybeSingle() : Promise.resolve({ data: null })
      ]);
      if (r[0].error && r[1].error) { el.innerHTML = ''; return false; }   // reviews not switched on yet: show nothing
      stats = r[0].data || null; top = r[1].data || []; mine = r[2].data || null;
      return true;
    }
    async function loadAll() {
      var r = await S.from('reviews').select('id, user_id, rating, body, reviewer_name, verified_owner, added_by_admin, featured, admin_reply, created_at')
        .eq('dataset_id', opts.datasetId).eq('status', 'visible').order('created_at', { ascending: false }).limit(60);
      all = r.data || [];
    }
    function item(v) {
      return '<li class="krv-item"><div class="krv-head">' + stars(v.rating) + '<b>' + esc(v.reviewer_name || 'KOJOH learner') + '</b>'
        + (v.verified_owner ? '<span class="krv-tag v">Verified owner</span>' : '')
        + (v.added_by_admin ? '<span class="krv-tag">Added by the KOJOH team</span>' : '')
        + '<time>' + fmtDate(v.created_at) + '</time></div>'
        + '<p class="krv-body">' + esc(v.body) + '</p>'
        + (v.admin_reply ? '<div class="krv-reply"><b>Reply from KOJOH</b>' + esc(v.admin_reply) + '</div>' : '') + '</li>';
    }
    function form() {
      if (!uid) return '<p class="krv-note">Reviews come from people who have this project. <a href="/auth">Log in</a> to leave yours.</p>';
      if (!opts.owned && !mine) return '<p class="krv-note">Reviews come from people who have this project. Get it, and you can review it here.</p>';
      if (mine && !editing) {
        return '<div class="krv-form"><h3>Your review' + (mine.status === 'hidden' ? ' (hidden by the KOJOH team)' : '') + '</h3>'
          + '<div>' + stars(mine.rating) + '</div><p class="krv-body" style="margin:0">' + esc(mine.body) + '</p>'
          + '<div class="krv-row"><small>Posted ' + fmtDate(mine.created_at) + '</small><span><button type="button" class="k-btn" data-rv="edit">Edit</button> '
          + '<button type="button" class="k-btn" data-rv="delete">Delete</button></span></div></div>';
      }
      var r = rating || (mine && mine.rating) || 0;
      var pick = ''; for (var i = 1; i <= 5; i++) pick += '<button type="button" data-star="' + i + '" class="' + (i <= r ? 'on' : '') + '" aria-label="' + i + ' star' + (i > 1 ? 's' : '') + '">&#9733;</button>';
      return '<div class="krv-form"><h3>' + (mine ? 'Edit your review' : 'Review this project') + '</h3>'
        + '<div class="krv-pick" role="group" aria-label="Your rating">' + pick + '</div>'
        + '<textarea id="krvText" maxlength="1200" placeholder="What did you learn? What was hard? Who would you recommend it to?">' + esc(mine && editing ? mine.body : '') + '</textarea>'
        + '<div class="krv-row"><small>One review per project. At least 20 characters.</small><span>'
        + (editing ? '<button type="button" class="k-btn" data-rv="cancel">Cancel</button> ' : '')
        + '<button type="button" class="k-btn k-btn-brand" data-rv="save">' + (mine ? 'Save' : 'Post review') + '</button></span></div>'
        + (msg ? '<div class="krv-err">' + esc(msg) + '</div>' : '') + '</div>';
    }
    function render() {
      var n = stats ? stats.review_count : 0;
      var h = '<section class="krv" id="reviews"><h2>Reviews</h2>';
      if (n) {
        var bars = '';
        for (var s = 5; s >= 1; s--) { var c = stats['r' + s] || 0; bars += '<div class="krv-bar"><span>' + s + ' &#9733;</span><i><b style="width:' + Math.round(100 * c / n) + '%"></b></i><span>' + c + '</span></div>'; }
        h += '<div class="krv-sum"><div><div class="krv-avg">' + Number(stats.avg_rating).toFixed(1) + '</div>' + stars(stats.avg_rating)
          + '<small class="krv-count">' + n + ' review' + (n === 1 ? '' : 's') + '</small></div><div class="krv-bars">' + bars + '</div></div>';
        var list = showAll && all ? all : top;
        h += '<ul class="krv-list">' + list.map(item).join('') + '</ul>';
        if (n > 5) h += '<p style="margin:.8rem 0 0"><button type="button" class="k-btn" data-rv="all">' + (showAll ? 'Show top 5' : 'Show all ' + n + ' reviews') + '</button></p>';
      } else {
        h += '<p class="krv-note" style="margin-top:0">No reviews yet. People who work through this project can review it here.</p>';
      }
      h += form() + '</section>';
      el.innerHTML = h;
    }
    el.addEventListener('click', async function (e) {
      var st = e.target.closest('[data-star]');
      if (st) { rating = +st.getAttribute('data-star'); Array.prototype.forEach.call(el.querySelectorAll('[data-star]'), function (b) { b.classList.toggle('on', +b.getAttribute('data-star') <= rating); }); return; }
      var b = e.target.closest('[data-rv]'); if (!b) return;
      var act = b.getAttribute('data-rv');
      if (act === 'all') { showAll = !showAll; if (showAll && !all) await loadAll(); render(); return; }
      if (act === 'edit') { editing = true; rating = mine.rating; msg = ''; render(); return; }
      if (act === 'cancel') { editing = false; msg = ''; render(); return; }
      if (act === 'delete') {
        if (!window.confirm('Delete your review?')) return;
        var d = await S.from('reviews').delete().eq('id', mine.id);
        if (d.error) { window.kojohToast && window.kojohToast((window.kojohFriendly || String)(d.error.message), { kind: 'error' }); return; }
        mine = null; rating = 0; await load(); render(); return;
      }
      if (act === 'save') {
        var text = (document.getElementById('krvText').value || '').trim();
        if (!rating) { msg = 'Pick a star rating.'; render(); return; }
        if (text.length < 20) { msg = 'Write at least 20 characters.'; var keep = text; render(); document.getElementById('krvText').value = keep; return; }
        b.disabled = true;
        var res = mine ? await S.from('reviews').update({ rating: rating, body: text }).eq('id', mine.id)
                       : await S.from('reviews').insert({ dataset_id: opts.datasetId, user_id: uid, rating: rating, body: text });
        if (res.error) { msg = /duplicate|unique/i.test(res.error.message) ? 'You have already reviewed this project.' : (window.kojohFriendly || String)(res.error.message); b.disabled = false; render(); return; }
        editing = false; msg = ''; await load(); if (showAll) await loadAll(); render();
        window.kojohToast && window.kojohToast('Thanks for your review.');
      }
    });
    if (await load()) render();
  };
})();
