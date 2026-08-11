/* ============================================================
   FINCRIME COMMAND v21 — LIVE ENGINE (js/live.js)
   - Real web-search data via our own /api/claude Vercel proxy
   - Auto-sync every 12 hours (cached in localStorage per browser)
   - Feeds the globe: red pulsing dots + red country fill
   ============================================================ */

(function () {
  var TTL = 12 * 60 * 60 * 1000; // 12 hours
  var API = "/api/claude";

  /* ---------------- helpers ---------------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
  function cacheGet(k) {
    try { var o = JSON.parse(localStorage.getItem(k)); if (o && Date.now() - o.t < TTL) return o; } catch (e) {}
    return null;
  }
  function cacheSet(k, v) { try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), v: v })); } catch (e) {} }
  function oldestCacheTime() {
    var keys = ["fm_fatf", "fm_media", "fm_iqtfs", "fm_fx", "fm_lists"], min = Infinity;
    keys.forEach(function (k) { try { var o = JSON.parse(localStorage.getItem(k)); if (o && o.t < min) min = o.t; } catch (e) {} });
    return min === Infinity ? 0 : min;
  }
  window.flagEmoji = flagEmoji;
  function flagEmoji(iso2) {
    if (!iso2 || iso2.length !== 2) return "🏳";
    var A = 0x1F1E6;
    return String.fromCodePoint(A + iso2.toUpperCase().charCodeAt(0) - 65, A + iso2.toUpperCase().charCodeAt(1) - 65);
  }

  function setSync(txt, busy) {
    var chip = $("syncChip");
    if (chip) { chip.textContent = "● " + txt; chip.style.color = busy ? "#ffb454" : ""; }
  }

  /* ---------------- API proxy ---------------- */
  function askCode() {
    var c = sessionStorage.getItem("fm_code");
    if (c === null) { c = prompt("Access code (leave empty if none):") || ""; sessionStorage.setItem("fm_code", c); }
    return c;
  }
  function callClaude(prompt, useSearch) {
    return fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-access-code": askCode() },
      body: JSON.stringify({ prompt: prompt, useSearch: !!useSearch })
    }).then(function (r) {
      if (r.status === 401) { sessionStorage.removeItem("fm_code"); throw new Error("Wrong access code — reload page"); }
      return r.json().then(function (d) {
        if (!r.ok) throw new Error(d.error || ("API " + r.status));
        return d.text || "";
      });
    });
  }
  function extractJson(raw) {
    var c = raw.replace(/```json|```/g, "").trim();
    var a = c.indexOf("["), o = c.indexOf("{");
    var isArr = a !== -1 && (o === -1 || a < o);
    var s = isArr ? a : o, e = isArr ? c.lastIndexOf("]") : c.lastIndexOf("}");
    if (s === -1 || e === -1) throw new Error("no json");
    return JSON.parse(c.slice(s, e + 1));
  }

  /* ---------------- prompts ---------------- */
  var ITEM_RULES = '\nRules:\n- Only items actually found via web search from the named sources. NEVER invent an item, date, or URL.\n- Each item must carry the real source URL you found.\n- "summary": 2 short factual English sentences (analyst tone).\n- "summary_ar": faithful formal Arabic translation of the summary (فصحى مهنية).\n- "country": short English country name; "countryKey": the country name exactly as used in Natural Earth world GeoJSON (e.g. "United States of America", "Iran", "Russia", "United Kingdom", "Iraq"); use null for global items.\n- "iso2": ISO 3166-1 alpha-2 code of the country (e.g. "IQ", "IR"), null for global items.\n- "lat"/"lng": approximate coordinates of the concerned country/city (numbers), null if global.\n- "priority": "Critical" (list changes, designations, major fines), "High" (binding guidance, enforcement), "Medium" (reports, events).\nRespond ONLY with a JSON array, no fences, no preamble:\n[{"title":"...","source":"FATF","date":"YYYY-MM-DD","url":"https://...","summary":"...","summary_ar":"...","country":"Iran","countryKey":"Iran","iso2":"IR","lat":32.4,"lng":53.6,"priority":"High"}]';

  function pFATF() {
    return "You are the intelligence desk of an AML/CFT operations room. Use web search NOW for the LATEST official FATF and FATF-style regional body (MENAFATF, MONEYVAL, APG, CFATF, GIABA, EAG, ESAAMLG, GAFILAT) news covering ALL countries: plenary outcomes, black/grey list changes, mutual evaluation reports, follow-up reports, new standards and guidance. Sources: fatf-gafi.org and official FSRB sites only. Max 8 items, most recent first." + ITEM_RULES;
  }
  function pMedia() {
    return "You are the intelligence desk of an AML/CFT operations room. Use web search NOW for the LATEST 10 news items from trusted secondary media — prioritise Reuters (reuters.com), then AP, Bloomberg, FT — strictly about: money laundering, terrorist financing, sanctions, bank compliance fines, financial crime, fraud, and cybercrime with financial impact. Exactly the 10 most recent relevant items, newest first." + ITEM_RULES;
  }
  function pIQTFS() {
    return "You are the intelligence desk of an Iraqi AML/CFT compliance team. Use web search NOW for the LATEST 10 items about IQTFS and Iraqi sanctions: the Iraqi Committee for Freezing Terrorists Funds / Office of Combating Money Laundering and Terrorist Financing (aml.iq, IQTFS platform), Iraqi local sanctions and freezing decisions, UN Security Council listings adopted in Iraq, Central Bank of Iraq sanctions circulars, and OFAC designations targeting Iraq-linked persons or entities. Sources: aml.iq, cbi.iq, un.org, ofac.treasury.gov, and reputable press covering these. Max 10 items, newest first. Set countryKey to \"Iraq\" and coordinates to Baghdad unless the item concerns another country." + ITEM_RULES;
  }
  function pFX() {
    return 'Use web search NOW to find the CURRENT USD/IQD exchange rates in Iraq:\n1) The OFFICIAL Central Bank of Iraq rate (cbi.iq).\n2) The PARALLEL (black) market rate in Baghdad today — from Iraqi financial news sites or currency trackers.\nRespond ONLY with JSON, no fences:\n{"official": 1310, "parallel": 1520, "as_of": "YYYY-MM-DD", "note": "one short English line on the trend", "note_ar": "same line in Arabic", "src_official": "https://...", "src_parallel": "https://..."}\nNumbers = IQD per 1 USD. Only report rates you actually found; never guess.';
  }
  function pLists() {
    return 'Use web search NOW to find the CURRENT official FATF lists on fatf-gafi.org:\n1) "High-Risk Jurisdictions subject to a Call for Action" (black list).\n2) "Jurisdictions under Increased Monitoring" (grey list).\nRespond ONLY with JSON, no fences:\n{"as_of":"Month YYYY","black":[{"name":"Iran","iso2":"IR","geo":"Iran"}],"grey":[{"name":"Algeria","iso2":"DZ","geo":"Algeria"}]}\n"geo" = the country name exactly as in Natural Earth world GeoJSON. Be exact and complete per the latest FATF statement.';
  }

  /* ---------------- normalize + apply ---------------- */
  function normItems(arr, layer, baseId) {
    if (!Array.isArray(arr)) return [];
    return arr.filter(function (it) { return it && it.title && it.url; }).map(function (it, i) {
      var lat = typeof it.lat === "number" ? it.lat : null;
      var lng = typeof it.lng === "number" ? it.lng : null;
      return {
        id: baseId + i,
        country: it.country || "Global",
        iso2: (it.iso2 && String(it.iso2).length === 2) ? String(it.iso2).toUpperCase() : null,
        countryKey: it.countryKey || null,
        coord: (lat !== null && lng !== null) ? [lng, lat] : [0, 0],
        hasGeo: lat !== null && lng !== null,
        layer: layer,
        source: String(it.source || "—"),
        body: String(it.source || "—"),
        date: String(it.date || ""),
        priority: ["Critical", "High", "Medium"].indexOf(it.priority) >= 0 ? it.priority : "Medium",
        title: String(it.title),
        summary: String(it.summary || ""),
        brief: String(it.summary || ""),
        impact: "Review the original source and assess operational relevance for screening, EDD and monitoring.",
        ar: String(it.summary_ar || ""),
        url: String(it.url)
      };
    });
  }

  function renderMini(el, items) {
    if (!el) return;
    if (!items.length) { el.innerHTML = '<div class="mini-loading">No verified items in this sync.</div>'; return; }
    el.innerHTML = items.map(function (x) {
      return '<div class="mini-item" data-fid="' + x.id + '">' +
        '<div class="mini-meta"><span class="pr pr-' + x.priority + '">' + x.priority + '</span>' + (x.iso2 ? '<span class="mini-flag">' + flagEmoji(x.iso2) + '</span>' : '') + '<b>' + esc(x.source) + '</b><span>' + esc(x.date) + '</span></div>' +
        '<div class="mini-title">' + esc(x.title) + '</div></div>';
    }).join("");
    el.querySelectorAll(".mini-item").forEach(function (n) {
      n.addEventListener("click", function () {
        var id = Number(n.dataset.fid);
        var x = window.INTEL.find(function (i) { return i.id === id; });
        if (!x) return;
        if (x.hasGeo && typeof focusEvent === "function") focusEvent(id, false);
        else if (typeof openModal === "function") openModal(x);
      });
    });
  }

  function renderFX(fx) {
    var el = $("fxBody");
    if (!el) return;
    if (!fx || !fx.official) { el.innerHTML = '<div class="mini-loading">Rate sync failed — press SYNC NOW.</div>'; return; }
    var spread = (fx.parallel && fx.official) ? Math.round((fx.parallel - fx.official) / fx.official * 1000) / 10 : null;
    el.innerHTML =
      '<div class="fx-grid">' +
      '<div class="fx-box"><small>OFFICIAL (CBI)</small><b>' + esc(fx.official) + '</b><span>IQD / USD</span></div>' +
      '<div class="fx-box warn"><small>PARALLEL MARKET</small><b>' + esc(fx.parallel || "—") + '</b><span>IQD / USD</span></div>' +
      '</div>' +
      (spread !== null ? '<div class="fx-spread">SPREAD: <b>+' + spread + '%</b> over official</div>' : "") +
      '<div class="fx-note">' + esc(fx.note || "") + '</div>' +
      '<div class="fx-note ar-inline" dir="rtl">' + esc(fx.note_ar || "") + '</div>' +
      '<div class="fx-links">' +
      (fx.src_official ? '<a href="' + esc(fx.src_official) + '" target="_blank" rel="noopener">CBI ↗</a>' : "") +
      (fx.src_parallel ? '<a href="' + esc(fx.src_parallel) + '" target="_blank" rel="noopener">Market ↗</a>' : "") +
      '</div><div class="fx-asof">as of ' + esc(fx.as_of || "latest sync") + '</div>';
  }

  function renderLists(ls) {
    var el = $("fatfListsBody");
    if (!el) return;
    if (!ls || !Array.isArray(ls.black)) { el.innerHTML = '<div class="mini-loading">List sync failed — press SYNC NOW.</div>'; return; }
    var asOf = $("listsAsOf"); if (asOf) asOf.textContent = (ls.as_of || "").toUpperCase();
    window.FATF_LISTS = ls;
    function chips(a, cls) {
      return (a || []).map(function (c) {
        return '<span class="flag-chip ' + cls + '">' + flagEmoji(c.iso2) + ' ' + esc(c.name) + '</span>';
      }).join("");
    }
    el.innerHTML =
      '<div class="lists-block"><small class="lb-black">■ BLACK LIST — CALL FOR ACTION (' + ls.black.length + ')</small><div class="flag-row">' + chips(ls.black, "black") + '</div></div>' +
      '<div class="lists-block"><small class="lb-grey">■ GREY LIST — INCREASED MONITORING (' + (ls.grey || []).length + ')</small><div class="flag-row">' + chips(ls.grey, "grey") + '</div></div>';
  }

  function applyAll(res) {
    var fatf = normItems(res.fatf, "fatf", 1000);
    var media = normItems(res.media, "aml", 2000).slice(0, 10);
    var iq = normItems(res.iqtfs, "iqtfs", 3000).slice(0, 10);

    // Rebuild the shared intel array IN PLACE so app.js (map, feed, timeline) sees it
    window.INTEL.length = 0;
    [].concat(fatf, media, iq).forEach(function (x) { window.INTEL.push(x); });

    renderMini($("fatfList"), fatf);
    renderMini($("mediaList"), media);
    renderMini($("iqtfsList"), iq);
    renderFX(res.fx);
    renderLists(res.lists);

    // Ticker
    var t = window.INTEL.slice(0, 12).map(function (x) { return "[" + x.source + "] " + x.title; });
    if (t.length) window.TICKER_ITEMS = t;

    // Globe: refresh points + red country fills (app.js globals)
    if (typeof refreshMap === "function") { try { refreshMap(); } catch (e) {} }
  }

  /* ---------------- sync engine (12h) ---------------- */
  var JOBS = [
    { key: "fm_fatf", out: "fatf", run: function () { return callClaude(pFATF(), true).then(extractJson); } },
    { key: "fm_media", out: "media", run: function () { return callClaude(pMedia(), true).then(extractJson); } },
    { key: "fm_iqtfs", out: "iqtfs", run: function () { return callClaude(pIQTFS(), true).then(extractJson); } },
    { key: "fm_fx", out: "fx", run: function () { return callClaude(pFX(), true).then(extractJson); } },
    { key: "fm_lists", out: "lists", run: function () { return callClaude(pLists(), true).then(extractJson); } }
  ];
  var syncing = false;

  function syncAll(force) {
    if (syncing) return;
    syncing = true;
    setSync("SYNCING…", true);
    var res = {};
    var tasks = JOBS.map(function (j) {
      var hit = force ? null : cacheGet(j.key);
      if (hit) { res[j.out] = hit.v; return Promise.resolve(); }
      return j.run().then(function (v) { res[j.out] = v; cacheSet(j.key, v); })
        .catch(function () { var old = null; try { old = JSON.parse(localStorage.getItem(j.key)); } catch (e) {} res[j.out] = old ? old.v : null; });
    });
    Promise.all(tasks).then(function () {
      applyAll(res);
      syncing = false;
      updateSyncLabel();
    });
  }

  function updateSyncLabel() {
    var t = oldestCacheTime();
    if (!t) { setSync("LIVE — NOT SYNCED", false); return; }
    var ageH = (Date.now() - t) / 3600000;
    var nextH = Math.max(0, 12 - ageH);
    setSync("LIVE · SYNCED " + (ageH < 1 ? Math.round(ageH * 60) + "m" : ageH.toFixed(1) + "h") + " AGO · NEXT IN " + nextH.toFixed(1) + "h", false);
  }

  /* ---------------- globe pulse (red moving dot) ---------------- */
  var phase = 0;
  setInterval(function () {
    try {
      if (typeof map !== "undefined" && map.getLayer && map.getLayer("halo")) {
        phase += 0.25;
        var k = (Math.sin(phase) + 1) / 2; // 0..1
        map.setPaintProperty("halo", "circle-opacity", 0.08 + 0.20 * k);
        map.setPaintProperty("halo", "circle-stroke-opacity", 0.25 + 0.5 * k);
        map.setPaintProperty("halo", "circle-radius",
          ["interpolate", ["linear"], ["zoom"], 0, 11 + 7 * k, 5, 22 + 10 * k]);
      }
    } catch (e) {}
  }, 130);

  /* ---------------- boot ---------------- */
  var btn = $("syncNow");
  if (btn) btn.addEventListener("click", function () { syncAll(true); });

  // First load: use 12h cache if fresh, otherwise fetch. Map may still be loading;
  // refreshMap() guards internally, and app.js re-reads INTEL on map load.
  syncAll(false);

  // Watchdog: every 30 min, if the cache is older than 12h, resync automatically.
  setInterval(function () {
    updateSyncLabel();
    if (Date.now() - oldestCacheTime() >= TTL) syncAll(true);
  }, 30 * 60 * 1000);
  setInterval(updateSyncLabel, 60 * 1000);
})();
