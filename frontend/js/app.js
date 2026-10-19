"use strict";

/* ===== Backend connection ===== */
// Same origin when served by Flask (python backend/app.py). Set window.API_BASE to point elsewhere.
const API_BASE = window.API_BASE || "";
async function api(path) {
 const res = await fetch(API_BASE + path, { headers: { Accept: "application/json" } });
 if (!res.ok) throw new Error(`${path} returned ${res.status}`);
 return res.json();
}

/* ===== Rules (mirror backend/quality_rules.py) ===== */
const SEV = ["Normal", "Monitor", "Severe", "Invalid"], COL = ["--ok", "--mon", "--sev", "--inv"];
const MAX_PRIORITY = 8;
const M = [
 { k: "lat", label: "Latency", unit: "ms", mon: 60, sev: 100, rev: 0, avg: "average_latency_ms" },
 { k: "thr", label: "Throughput", unit: "Mbps", mon: 10, sev: 5, rev: 1, avg: "average_throughput_mbps" },
 { k: "loss", label: "Packet loss", unit: "%", mon: 1, sev: 3, rev: 0, avg: "average_packet_loss_pct" },
 { k: "cong", label: "Congestion", unit: "%", mon: 70, sev: 85, rev: 0, avg: "average_congestion_pct" }];
const st = (m, v) => m.rev ? (v < m.sev ? 2 : v < m.mon ? 1 : 0) : (v > m.sev ? 2 : v > m.mon ? 1 : 0);

/* ===== Helpers ===== */
const $ = id => document.getElementById(id), css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = v => v == null || v === "" || Number.isNaN(+v) ? null : +v;
const fmt = v => v == null ? "–" : v;
const fmtTime = t => t ? String(t).replace("T", " ").slice(0, 16) : "";
const store = {
 get: k => { try { return localStorage.getItem(k) } catch { return null } },
 set: (k, v) => { try { localStorage.setItem(k, v) } catch { } }
};

// Backend record -> UI model
function toReading(r) {
 const s = SEV.indexOf(r.Severity);
 return {
  id: r.customer_id, t: fmtTime(r.timestamp), city: r.city, profile: r.profile,
  lat: num(r.latency_ms), thr: num(r.throughput_mbps), loss: num(r.packet_loss_pct), cong: num(r.congestion_pct),
  s: s < 0 ? 3 : s, prio: num(r.Priority_Score),
  why: Array.isArray(r.Reasons) && r.Reasons.length ? r.Reasons : ["No classification reasons provided"]
 };
}

/* ===== State ===== */
let data = [], CITIES = [], PROFILES = [], regions = [], summary = null;
let draftFilters = { city: "", sev: "", prof: "" }, pageNo = 1;
const pageSize = 10;

/* ===== Theme ===== */
const savedTheme = store.get("snqm-theme");
if (savedTheme === "light" || savedTheme === "dark") document.documentElement.dataset.theme = savedTheme;
const isDark = () => document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme:dark)").matches);
function updateThemeButton() { const dark = isDark(); $("themeToggle").textContent = dark ? "Light mode" : "Dark mode"; $("themeToggle").setAttribute("aria-pressed", String(dark)) }
function redrawThemed() { if (hist.length && !$("customer").hidden) drawCust(); if (data.length) { drawMap(); drawTiles() } }
$("themeToggle").onclick = () => { const next = isDark() ? "light" : "dark"; document.documentElement.dataset.theme = next; store.set("snqm-theme", next); updateThemeButton(); redrawThemed() };
matchMedia("(prefers-color-scheme:dark)").addEventListener("change", () => { updateThemeButton(); redrawThemed() });
updateThemeButton();

/* ===== Navigation ===== */
function page(p) {
 ["overview", "customers", "customer"].forEach(x => $(x).hidden = x !== p);
 const tab = p === "customer" ? "customers" : p;
 document.querySelectorAll(".tab").forEach(t => t.dataset.p === tab ? t.setAttribute("aria-current", "page") : t.removeAttribute("aria-current"));
 window.scrollTo(0, 0);
}
document.querySelectorAll(".tab").forEach(t => t.onclick = () => page(t.dataset.p));

/* ===== Health check ===== */
async function checkHealth() {
 const box = $("health");
 try {
  const res = await api("/api/health");
  const ok = res.status === "ok";
  box.className = "health" + (ok ? "" : " down");
  $("healthText").textContent = ok ? "System Status: OK" : "System Status: Degraded";
 } catch {
  box.className = "health down";
  $("healthText").textContent = "System Status: Offline";
 }
}

/* ===== KPIs ===== */
function drawKpis() {
 const total = summary.total_customers;
 const items = [["Total Customers", total, -1, "--acc", "--acctint"], ["Normal Customers", summary.normal, 0, "--ok", "--oktint"], ["Monitor Customers", summary.monitor, 1, "--mon", "--montint"], ["Severe Customers", summary.severe, 2, "--sev", "--sevtint"], ["Invalid Records", summary.invalid, 3, "--inv", "--invtint"]];
 $("kpis").innerHTML = items.map(([l, n, k, v, t]) => `<button class="kpi${k < 0 ? " tot" : ""}" data-k="${k}" style="--c:var(${v});--t:var(${t})"><b>${n}</b><span>${l}${k < 0 ? "" : " · " + (total ? n / total * 100 : 0).toFixed(1) + "%"}</span></button>`).join("");
 $("kpis").querySelectorAll(".kpi").forEach(b => b.onclick = () => { $("sev").value = b.dataset.k < 0 ? "" : SEV[b.dataset.k]; pageNo = 1; refreshFilterUi(); render(); page("customers") });
}

/* ===== Filters ===== */
const opts = (el, l, a) => el.innerHTML = `<option value="">${l}</option>` + a.map(x => `<option>${esc(x)}</option>`).join("");
const committedFilters = () => ({ city: $("city").value, sev: $("sev").value, prof: $("prof").value });
const filtersEqual = (a, b) => a.city === b.city && a.sev === b.sev && a.prof === b.prof;
const matchesFilters = (d, f) => {
 const q = $("q").value.trim().toLowerCase();
 return (!q || [d.id, d.city, d.profile, SEV[d.s]].some(v => String(v ?? "").toLowerCase().includes(q))) && (!f.city || d.city === f.city) && (!f.sev || SEV[d.s] === f.sev) && (!f.prof || d.profile === f.prof);
};
const matchingCount = f => data.filter(d => matchesFilters(d, f)).length;
function renderFilterChips() {
 const groups = [["cityFilters", "city", CITIES], ["profFilters", "prof", PROFILES]];
 groups.forEach(([target, state, values]) => { $(target).innerHTML = ["All", ...values].map(v => `<button class="chip${(draftFilters[state] === "" && v === "All") || draftFilters[state] === v ? " active" : ""}" data-filter="${state}" data-value="${v === "All" ? "" : esc(v)}" type="button">${esc(v)}</button>`).join("") });
 const severityIndex = draftFilters.sev ? SEV.indexOf(draftFilters.sev) + 1 : 0; $("severityRange").value = severityIndex; $("severityValue").textContent = severityIndex ? SEV[severityIndex - 1] : "All severities";
 const n = matchingCount(draftFilters);
 $("filterMatch").textContent = `${n} matching customer${n === 1 ? "" : "s"}`;
 $("filterApply").disabled = filtersEqual(draftFilters, committedFilters());
}
function activePills() { return [["city", "City"], ["sev", "Severity"], ["prof", "Profile"]].filter(([id]) => $(id).value).map(([id, label]) => `<span class="filterPill">${label}: ${esc($(id).value)}</span>`) }
function refreshFilterUi() { const active = activePills(); $("filterCount").textContent = active.length ? String(active.length) : ""; renderFilterChips() }
function renderFilterSummary() {
 const active = activePills();
 $("activeFilters").innerHTML = active.length ? active.join("") + `<button class="clearLink" type="button" id="clearActive">Clear all</button>` : "";
 const clear = $("clearActive"); if (clear) clear.onclick = () => clearCommittedFilters();
}
function clearCommittedFilters() { ["city", "sev", "prof"].forEach(i => $(i).value = ""); draftFilters = { city: "", sev: "", prof: "" }; pageNo = 1; refreshFilterUi(); render() }
function closeFilterDialog() { $("filterModal").hidden = true; $("filterOpen").focus() }
$("filterOpen").onclick = () => { draftFilters = committedFilters(); renderFilterChips(); $("filterModal").hidden = false; $("filterClose").focus() };
$("filterClose").onclick = closeFilterDialog; $("filterScrim").onclick = closeFilterDialog;
$("filterClear").onclick = () => { draftFilters = { city: "", sev: "", prof: "" }; renderFilterChips() };
$("filterApply").onclick = () => { ["city", "sev", "prof"].forEach(i => $(i).value = draftFilters[i]); pageNo = 1; closeFilterDialog(); refreshFilterUi(); render() };
$("severityRange").oninput = e => { const value = +e.target.value; draftFilters.sev = value ? SEV[value - 1] : ""; renderFilterChips() };
document.querySelectorAll(".chips").forEach(group => group.addEventListener("click", e => { const chip = e.target.closest(".chip"); if (!chip) return; draftFilters[chip.dataset.filter] = chip.dataset.value; renderFilterChips() }));
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("filterModal").hidden) closeFilterDialog() });

/* ===== Customers table ===== */
function renderPagination(total) {
 const pages = Math.max(1, Math.ceil(total / pageSize)); pageNo = Math.min(pageNo, pages); const buttons = [];
 for (let i = 1; i <= pages; i++) buttons.push(`<button class="pageBtn${i === pageNo ? " active" : ""}" data-page="${i}" type="button" aria-label="Page ${i}" aria-current="${i === pageNo ? "page" : "false"}">${i}</button>`);
 $("pagination").innerHTML = pages > 1 ? `<button class="pageBtn" data-page="${pageNo - 1}" type="button" aria-label="Previous page" ${pageNo === 1 ? "disabled" : ""}>‹</button>${buttons.join("")}<span class="pageStatus">Page ${pageNo} of ${pages}</span><button class="pageBtn" data-page="${pageNo + 1}" type="button" aria-label="Next page" ${pageNo === pages ? "disabled" : ""}>›</button>` : "";
 $("pagination").querySelectorAll("[data-page]").forEach(b => b.onclick = () => { if (!b.disabled) { pageNo = +b.dataset.page; render() } });
}
function issueTags(d) {
 const tags = M.map(m => { const level = d[m.k] == null ? 3 : st(m, d[m.k]); return level ? `<span class="issueTag i${level}" title="${m.label}">${m.label}</span>` : "" }).filter(Boolean);
 return tags.length ? tags.join("") : "<span class=\"issueTag i0\">Normal</span>";
}
const avgPriority = r => { const v = r.filter(d => d.prio != null); return v.length ? v.reduce((sum, d) => sum + d.prio, 0) / v.length : 0 };
function renderCustomerSummary(r) {
 const city = $("city").value;
 const label = city ? `${esc(city)} customer summary` : "All customer summary";
 $("customerSummary").innerHTML = `<strong>${label}</strong><span>${r.length} matching · ${r.filter(d => d.s === 2).length} severe · ${r.filter(d => d.s === 1).length} monitor · Avg priority ${avgPriority(r).toFixed(1)} / ${MAX_PRIORITY}</span>`;
}
function render() {
 const r = data.filter(d => matchesFilters(d, committedFilters()));
 const m = $("sort").value;
 r.sort((a, b) => m == "prio" ? (b.prio ?? -1) - (a.prio ?? -1) : m == "lat" ? (b.lat ?? -1) - (a.lat ?? -1) : m == "loss" ? (b.loss ?? -1) - (a.loss ?? -1) : a.id.localeCompare(b.id));
 pageNo = Math.max(1, Math.min(pageNo, Math.max(1, Math.ceil(r.length / pageSize))));
 const start = r.length ? (pageNo - 1) * pageSize + 1 : 0; const visible = r.slice(Math.max(0, start - 1), Math.max(0, start - 1) + pageSize);
 $("count").textContent = `Showing ${start}–${Math.min(start + visible.length - 1, r.length)} of ${r.length} matching customers · ${data.length} total`;
 const cl = (mm, d) => d[mm.k] == null ? "" : ["", "warn", "hot"][st(mm, d[mm.k])];
 $("rows").innerHTML = r.length ? visible.map(d => `<tr class="s${d.s}" tabindex="0" data-id="${esc(d.id)}"><td><b>${esc(d.id)}</b></td><td>${esc(d.city)}</td><td>${esc(d.profile)}</td><td class="r ${cl(M[0], d)}">${fmt(d.lat)}</td><td class="r ${cl(M[1], d)}">${fmt(d.thr)}</td><td class="r ${cl(M[2], d)}">${fmt(d.loss)}</td><td class="r ${cl(M[3], d)}">${fmt(d.cong)}</td><td><span class="badge b${d.s}">${SEV[d.s]}</span></td><td class="r"><b>${fmt(d.prio)}</b></td><td class="issueTags">${issueTags(d)}</td><td><button class="vb" data-id="${esc(d.id)}">View history</button></td></tr>`).join("") : `<tr><td colspan="11" style="text-align:center;padding:28px;color:var(--mut)">No customers match these filters. Clear filters to see all.</td></tr>`;
 renderFilterSummary(); renderCustomerSummary(r); renderPagination(r.length);
}
$("q").addEventListener("input", () => { pageNo = 1; render() });
$("sort").addEventListener("change", () => { pageNo = 1; render() });
$("rows").addEventListener("click", e => { const r = e.target.closest("tr[data-id],button[data-id]"); if (r) openCust(r.dataset.id) });
$("rows").addEventListener("keydown", e => { if (e.key === "Enter") { const r = e.target.closest("tr[data-id]"); if (r) openCust(r.dataset.id) } });

/* ===== Customer detail (GET /api/customers/<id>/history) ===== */
let cur = null, hist = [], sel = 0, rangeSize = 24, cc = [], openToken = 0;
const setRangeButtons = () => document.querySelectorAll(".rangeBtn").forEach(b => { const active = +b.dataset.range === rangeSize; b.classList.toggle("active", active); b.setAttribute("aria-pressed", String(active)) });
function updateChartReadout(id, values, suffix, decimals) {
 const valid = values.filter(Number.isFinite); if (!valid.length) { $(id).textContent = "No readings available"; return }
 const latest = valid[valid.length - 1], average = valid.reduce((sum, value) => sum + value, 0) / valid.length, peak = Math.max(...valid);
 $(id).innerHTML = `<span><b>Latest</b> ${latest.toFixed(decimals)}${suffix}</span><span><b>Average</b> ${average.toFixed(decimals)}${suffix}</span><span><b>Peak</b> ${peak.toFixed(decimals)}${suffix}</span>`;
}
async function openCust(id) {
 const token = ++openToken;
 cur = data.find(x => x.id === id) || { id, city: "", profile: "", s: 3 };
 hist = []; cc.forEach(c => c.destroy()); cc = [];
 $("cinfo").innerHTML = `<div>Customer ID<b>${esc(id)}</b></div><div>Status<b>Loading history…</b></div>`;
 $("story").innerHTML = ""; $("why").innerHTML = ""; $("ts").innerHTML = "";
 page("customer");
 try {
  const res = await api(`/api/customers/${encodeURIComponent(id)}/history`);
  if (token !== openToken) return;
  hist = res.history.map(toReading);
 } catch (err) {
  if (token !== openToken) return;
  $("cinfo").innerHTML = `<div>Customer ID<b>${esc(id)}</b></div><div>Status<b>Could not load history</b></div>`;
  return;
 }
 if (!hist.length) return;
 sel = hist.length - 1; rangeSize = 24; setRangeButtons();
 $("ts").innerHTML = hist.map((h, i) => `<option value="${i}">${esc(h.t)}${i === hist.length - 1 ? " (latest)" : ""}</option>`).reverse().join("");
 $("ts").value = sel;
 renderCust();
}
$("back").onclick = () => { page("customers"); render() };
$("ts").onchange = () => { sel = +$("ts").value; renderCust() };
document.querySelectorAll(".rangeBtn").forEach(btn => btn.onclick = () => { rangeSize = +btn.dataset.range; setRangeButtons(); if (hist.length) drawCust() });
function renderCust() {
 const h = hist[sel], prev = hist[Math.max(0, sel - 1)];
 const delta = h.prio != null && prev.prio != null ? h.prio - prev.prio : 0;
 $("cinfo").innerHTML = `<div>Customer ID<b>${esc(cur.id)}</b></div><div>City<b>${esc(h.city || cur.city)}</b></div><div>Profile<b>${esc(h.profile || cur.profile)}</b></div><div>Latest severity<b><span class="badge b${cur.s}">${SEV[cur.s]}</span></b></div><div>Selected severity<b><span class="badge b${h.s}">${SEV[h.s]}</span></b></div><div>Priority Score<b>${fmt(h.prio)} / ${MAX_PRIORITY}</b></div>`;
 $("story").innerHTML = `<div class="storyCard"><span>Selected reading</span><b>${esc(h.t)}</b><small>Charts show the hourly readings up to this time.</small></div><div class="storyCard"><span>Quality signal</span><b>${SEV[h.s]} · ${fmt(h.prio)}/${MAX_PRIORITY}</b><small>${esc(h.why[0])}</small></div><div class="storyCard"><span>What changed</span><b>${sel === 0 ? "First reading" : delta > 0 ? "Worsening" : delta < 0 ? "Improving" : "Stable"}</b><small>${sel === 0 ? "No earlier reading to compare with" : delta === 0 ? "No priority-score change from the previous reading" : `${Math.abs(delta)} priority point${Math.abs(delta) === 1 ? "" : "s"} ${delta > 0 ? "higher" : "lower"} than the previous reading`}</small></div>`;
 $("why").innerHTML = h.why.map(w => `<li>${esc(w)}</li>`).join("");
 drawCust();
}
function drawCust() {
 cc.forEach(c => c.destroy());
 if (typeof Chart === "undefined") { cc = []; return }
 const windowEnd = sel + 1, windowStart = Math.max(0, windowEnd - rangeSize), H = hist.slice(windowStart, windowEnd), lb = H.map(h => h.t.slice(11, 16)), activeSel = H.length - 1, pr = H.map((_, j) => j == activeSel ? 7 : 2);
 const thr = (v, c) => ({ type: "line", label: "", data: H.map(() => v), borderColor: css(c), borderDash: [6, 4], borderWidth: 2, pointRadius: 0, order: 0 });
 const chartText = css("--chart-text"), chartGrid = css("--chart-grid");
 const congestionColor = reading => reading.cong > 85 ? "--sev" : reading.cong > 70 ? "--mon" : "--ok";
 const tooltipBase = { backgroundColor: css("--surf"), titleColor: css("--ink"), bodyColor: css("--ink"), borderColor: chartGrid, borderWidth: 1 };
 const opt = (t, max) => ({ maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { display: false }, tooltip: { ...tooltipBase, filter: item => item.datasetIndex === 0, callbacks: { title: items => items[0] ? H[items[0].dataIndex].t : "" } } }, scales: { x: { grid: { color: chartGrid }, ticks: { color: chartText, maxTicksLimit: 8, maxRotation: 0 } }, y: { beginAtZero: true, suggestedMax: max, grid: { color: chartGrid }, ticks: { color: chartText }, title: { display: true, text: t, color: chartText } } } });
 const line = (id, key, t, color, lines, max) => new Chart($(id), { type: "line", data: { labels: lb, datasets: [{ label: t, data: H.map(h => h[key]), borderColor: css(color), backgroundColor: "transparent", pointRadius: pr, pointHoverRadius: 7, pointBackgroundColor: css(color), borderWidth: 2.5, spanGaps: true, tension: .25, order: 1 }, ...lines] }, options: opt(t, max) });
 const thrValues = H.map(r => r.thr).filter(Number.isFinite);
 cc = [
  line("c4", "lat", "Latency (ms)", "--chart-a", [thr(60, "--mon"), thr(100, "--sev")], 120),
  new Chart($("c5"), { type: "bar", data: { labels: lb, datasets: [{ label: "Throughput (Mbps)", data: H.map(r => r.thr), backgroundColor: H.map((_, j) => j === activeSel ? css("--chart-b") : css("--chart-b") + "99"), borderColor: css("--chart-b"), borderWidth: 1, borderRadius: 4 }] }, options: opt("Mbps", Math.max(12, ...thrValues)) }),
  line("c6", "loss", "Packet loss (%)", "--chart-a", [thr(1, "--mon"), thr(3, "--sev")], 6),
  new Chart($("c7"), { type: "polarArea", data: { labels: lb, datasets: [{ label: "Congestion (%)", data: H.map(r => r.cong), backgroundColor: H.map((r, j) => { const tone = css(congestionColor(r)); return j === activeSel ? tone : tone + "99" }), borderColor: css("--chart-bg"), borderWidth: 2 }] }, options: { maintainAspectRatio: false, scales: { r: { beginAtZero: true, suggestedMax: 100, grid: { color: chartGrid }, ticks: { display: false } } }, plugins: { legend: { display: false }, tooltip: { ...tooltipBase, callbacks: { title: items => items[0] ? H[items[0].dataIndex].t : "", label: c => { const value = c.raw; const level = value > 85 ? "Severe" : value > 70 ? "Monitor" : "Normal"; return "Congestion: " + value + " % · " + level } } } } } })
 ];
 updateChartReadout("readout-c4", H.map(r => r.lat), " ms", 0);
 updateChartReadout("readout-c5", H.map(r => r.thr), " Mbps", 1);
 updateChartReadout("readout-c6", H.map(r => r.loss), " %", 2);
 updateChartReadout("readout-c7", H.map(r => r.cong), " %", 0);
}

/* ===== Libya map (GET /api/regions) ===== */
const DIST=[{"k":"Nuqat al Khams","a":"المنطقة الغربية","p":"123 110 123 141 127 144 132 145 142 144 157 128 157 125 154 122 144 119 136 113","c":[137,130],"n":883,"r":13.5},{"k":"Jabal al Akhdar","a":"الجبل الأخضر","p":"520 118 512 125 512 141 524 158 524 168 521 177 521 191 522 193 529 193 535 191 533 176 537 153 537 126 536 121 532 118","c":[524,131],"n":1365,"r":13.0},{"k":"Tripoli","a":"طرابلس","p":"179 130 188 139 192 138 198 131 204 129 207 126 203 123 198 122 197 120 185 119 179 124","c":[189,128],"n":368,"r":8.5},{"k":"Derna","a":"درنة","p":"540 120 537 122 538 153 534 176 536 191 553 192 563 195 569 199 573 199 575 195 577 163 581 151 580 145 575 140 576 134 573 130 566 128 565 126 556 124 547 119","c":[558,155],"n":2921,"r":21.1},{"k":"Zawiya","a":"الزاوية","p":"178 125 165 123 158 126 158 128 144 142 144 144 148 146 168 145 168 141 177 132","c":[161,137],"n":522,"r":8.9},{"k":"Murqub","a":"المرقب","p":"187 140 191 154 219 152 239 155 247 143 247 140 243 137 236 135 227 129 219 127 217 125 208 126 204 130 198 132 192 139","c":[214,139],"n":1296,"r":13.9},{"k":"Marj","a":"المرج","p":"496 125 490 131 491 167 493 170 502 171 505 173 505 189 507 196 520 194 520 177 523 168 523 158 511 141 511 126","c":[505,157],"n":1624,"r":14.4},{"k":"Benghazi","a":"بنغازي","p":"486 131 481 132 464 145 455 159 456 174 461 186 469 193 471 197 481 201 492 200 505 195 504 173 493 171 490 167 489 132","c":[473,168],"n":2319,"r":18.0},{"k":"Jafara","a":"الجفارة","p":"180 131 178 131 169 141 170 145 179 145 186 141 185 137","c":[179,138],"n":178,"r":5.8},{"k":"Misrata","a":"مصراتة","p":"193 155 193 163 199 175 200 181 210 195 213 204 232 222 238 222 250 226 261 201 270 186 277 181 277 174 270 162 269 148 265 142 261 140 248 141 245 149 239 156 219 153","c":[237,185],"n":4506,"r":29.5},{"k":"Nalut","a":"نالوت","p":"131 145 127 145 121 142 103 148 98 151 92 158 88 159 84 167 78 171 70 173 69 183 72 190 73 207 66 219 54 231 40 238 48 256 54 265 55 274 57 277 57 294 59 302 68 302 71 305 79 305 94 297 98 300 98 303 111 307 135 306 137 304 135 294 126 279 124 248 122 245 122 231 120 226 120 219 135 199 130 176 134 156 134 147","c":[87,251],"n":10357,"r":36.5},{"k":"Jabal al Gharbi","a":"الجبل الغربي","p":"187 143 183 143 179 146 148 147 140 145 135 147 135 156 131 176 136 199 121 219 128 282 135 292 136 298 139 303 148 306 152 305 164 312 171 308 187 294 192 288 202 269 208 264 213 263 228 270 234 278 239 278 247 273 248 258 255 247 254 238 250 227 238 223 232 223 212 204 209 195 199 181 198 175 192 163","c":[173,231],"n":13897,"r":48.1},{"k":"Tobruk","a":"طبرق","p":"583 150 581 152 578 163 574 206 574 327 579 329 648 328 650 322 650 284 648 271 645 266 643 246 639 237 639 233 649 215 648 199 645 194 645 181 653 173 654 166 649 159 644 157 622 158 613 156 601 150","c":[612,291],"n":12864,"r":38.8},{"k":"Sirte","a":"سرت","p":"271 186 262 201 251 226 256 243 256 247 249 258 249 273 251 275 255 276 272 269 277 269 286 274 292 275 306 267 310 267 322 273 328 273 336 267 341 267 351 272 358 269 361 265 365 265 369 268 370 275 374 281 373 297 376 301 390 311 403 310 402 303 405 284 412 269 410 256 411 235 404 227 398 225 382 211 371 208 368 205 346 197 341 197 326 192 307 192 281 182 277 182","c":[294,229],"n":12523,"r":40.2},{"k":"Ajdabiya & Wahat","a":"اجدابيا والواحات","p":"412 235 411 256 413 269 406 284 403 306 405 311 414 312 416 314 417 372 648 372 650 367 650 333 648 329 579 330 573 327 573 200 569 200 563 196 553 193 536 192 515 195 513 197 505 196 500 199 481 202 471 198 466 191 457 210 448 221 430 232 423 234 417 233","c":[493,288],"n":30746,"r":81.0},{"k":"Wadi al Shatii","a":"وادي الشاطئ","p":"296 331 292 325 282 322 274 322 267 327 261 326 258 323 254 313 237 298 234 285 235 279 228 271 213 264 208 265 203 269 196 283 188 294 165 313 152 306 148 307 142 304 138 304 135 307 105 307 98 304 97 300 94 298 79 306 71 306 68 303 60 303 57 309 58 329 62 341 78 347 85 347 91 350 95 350 100 352 104 356 106 370 109 377 110 391 115 406 182 360 188 360 203 365 216 367 233 366 246 355 250 355 257 350 259 347 269 346 277 341 292 342 295 338","c":[210,326],"n":14765,"r":38.9},{"k":"Jufra","a":"الجفرة","p":"236 280 235 285 238 298 255 313 261 325 267 326 274 321 282 321 290 323 295 327 297 335 294 340 293 347 295 351 296 373 312 391 317 404 323 411 342 417 357 417 369 410 390 410 402 412 415 411 415 314 403 311 390 312 376 302 372 297 373 281 369 275 367 267 361 266 358 270 351 273 341 268 336 268 328 274 322 274 310 268 306 268 292 276 286 275 277 270 272 270 255 277 246 274","c":[355,356],"n":17580,"r":56.2},{"k":"Ghat","a":"غات","p":"61 342 57 348 54 358 55 371 59 381 58 393 55 397 45 401 42 404 41 413 54 430 64 447 64 463 69 468 72 477 76 479 89 477 117 487 119 486 119 482 117 479 117 473 113 460 113 439 110 434 110 425 115 407 112 403 112 398 109 391 108 377 105 370 103 356 95 351 91 351 85 348 78 348","c":[81,415],"n":7345,"r":31.6},{"k":"Wadi al Hayat","a":"وادي الحياة","p":"292 344 277 342 269 347 259 348 257 351 250 356 246 356 233 367 219 367 219 380 223 385 223 388 215 398 216 406 228 404 242 394 242 392 250 383 287 381 295 375 294 351","c":[276,363],"n":2732,"r":18.4},{"k":"Murzuq","a":"مرزق","p":"218 369 215 367 203 366 188 361 182 361 159 378 140 389 134 395 132 395 116 407 111 425 111 434 114 438 121 435 145 437 156 429 180 426 188 422 196 414 214 407 214 398 222 388 222 385 218 380","c":[188,389],"n":5170,"r":26.8},{"k":"Kufra","a":"الكفرة","p":"418 373 416 375 416 585 437 599 458 609 463 613 468 614 474 619 495 629 503 635 517 641 541 656 565 668 581 679 588 681 604 692 610 692 610 679 612 676 647 676 649 674 650 378 648 374","c":[533,491],"n":64117,"r":118.0},{"k":"Sabha","a":"سبها","p":"114 440 114 460 120 486 123 488 131 507 140 523 198 536 207 544 211 545 220 556 226 559 287 529 297 526 308 530 311 533 318 535 333 544 340 546 384 571 404 580 407 583 415 584 414 413 369 411 357 418 338 417 323 412 316 404 311 391 298 376 294 376 287 382 250 384 243 392 243 394 230 404 204 411 196 415 188 423 180 427 156 430 145 438 121 436","c":[235,476],"n":40021,"r":71.2}];
// City name in the data -> map district
const CITY2D = { Benghazi: "Benghazi", Tripoli: "Tripoli", Misrata: "Misrata", Tobruk: "Tobruk", Sabha: "Sabha", "Al Bayda": "Jabal al Akhdar", Derna: "Derna", Sirte: "Sirte", Zawiya: "Zawiya", Ghat: "Ghat", Murzuq: "Murzuq", Kufra: "Kufra", Ajdabiya: "Ajdabiya & Wahat", Marj: "Marj", Nalut: "Nalut" };
const LBL = { Tripoli: { x: 14, y: 34, ax: 60, ay: 56 }, Misrata: { x: 140, y: 22, ax: 175, ay: 44 }, Benghazi: { x: 380, y: 30, ax: 410, ay: 52 }, "Al Bayda": { x: 500, y: 30, ax: 520, ay: 52 }, Tobruk: { x: 590, y: 96, ax: 625, ay: 118 }, Sabha: { x: 14, y: 572, ax: 90, ay: 566 } };
const ST = [[0, [234, 243, 252]], [.5, [74, 144, 200]], [1, [8, 48, 107]]];
function shade(v) { const t = Math.max(0, Math.min(1, v / MAX_PRIORITY)); const i = t < .5 ? 0 : 1, [t0, c0] = ST[i], [t1, c1] = ST[i + 1], u = (t - t0) / (t1 - t0); return "rgb(" + c0.map((c, k) => Math.round(c + (c1[k] - c) * u)).join(",") + ")" }
function drawMap() {
 const stats = {};
 regions.forEach(r => { const k = CITY2D[r.city]; if (k) stats[k] = { c: r.city, sev: r.severe, mon: r.monitor, n: r.total_customers, avg: r.average_priority_score } });
 const avgText = t => t.avg == null ? "–" : t.avg.toFixed(1);
 $("regions").innerHTML = DIST.map(d => { const t = stats[d.k]; return `<polygon class="reg" tabindex="0" role="button" data-k="${d.k}" aria-label="${d.k}: ${t ? t.sev + " severe cases, average priority " + avgText(t) : "no customers"}" points="${d.p.replace(/(\d+) (\d+)/g, "$1,$2")}" style="fill:${t && t.avg != null ? shade(t.avg) : "var(--nd)"}"/>` }).join("")
  + DIST.filter(d => !stats[d.k] && d.r >= 26).map(d => `<text class="dn" x="${d.c[0]}" y="${d.c[1] + 3}">${d.k}</text>`).join("");
 $("callouts").innerHTML = Object.values(stats).filter(t => LBL[t.c]).map(t => { const L = LBL[t.c], q = DIST.find(d => d.k === CITY2D[t.c]).c; return `<path class="ldr" d="M${L.ax},${L.ay}L${q[0]},${q[1]}"/><circle cx="${q[0]}" cy="${q[1]}" r="3" style="fill:var(--ink)"/><text class="cn" x="${L.x}" y="${L.y}">${esc(t.c)}</text><text class="cval" x="${L.x}" y="${L.y + 16}">${avgText(t)} avg</text>` }).join("");
 const show = k => { const d = DIST.find(z => z.k === k), t = stats[k]; $("minfo").innerHTML = t ? `<div style="font-size:18px;font-weight:600">${esc(t.c)}</div><div class="meta" style="margin:0">${d.k} district</div><div class="kv"><span>Severe Cases</span><b>${t.sev}</b><span>Monitor Cases</span><b>${t.mon}</b><span>Customers</span><b>${t.n}</b><span>Avg Priority Score</span><b>${avgText(t)} / ${MAX_PRIORITY}</b></div>` : `<div style="font-size:18px;font-weight:600">${d.k}</div><div class="meta" style="margin:0">No customers in this district</div>` };
 $("regions").querySelectorAll(".reg").forEach(g => {
  ["mouseenter", "focus"].forEach(e => g.addEventListener(e, () => show(g.dataset.k)));
  const go = () => { show(g.dataset.k); const t = stats[g.dataset.k]; if (t) openCustomersForCity(t.c) };
  g.addEventListener("click", go);
  g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go() } });
 });
}
function openCustomersForCity(city) { $("city").value = city; draftFilters = { city, sev: $("sev").value, prof: $("prof").value }; pageNo = 1; refreshFilterUi(); render(); page("customers") }

/* ===== Network health tiles + trend (GET /api/summary) ===== */
function drawTiles() {
 $("tiles").innerHTML = M.map(m => {
  const av = num(summary[m.avg]);
  const rule = m.rev ? `Normal from ${m.mon} ${m.unit} · Severe below ${m.sev} ${m.unit}` : `Normal up to ${m.mon} ${m.unit} · Severe above ${m.sev} ${m.unit}`;
  if (av == null) return `<div class="tile" style="--c:var(--inv);--t:var(--invtint)"><span>${m.label}</span><b>–</b><span class="badge b3">No data</span><small>${rule}</small></div>`;
  const l = st(m, av), val = av.toFixed(m.k == "loss" ? 2 : 1);
  return `<div class="tile" style="--c:var(${COL[l]});--t:var(${["--oktint", "--montint", "--sevtint"][l]})"><span>${m.label}</span><b>${val} ${m.unit}</b><span class="badge b${l}">${SEV[l]}</span><small>${rule}</small></div>`;
 }).join("");
}
function drawHealthTrend() {
 const currentScore = num(summary.average_priority_score), previousScore = num(summary.previous_average_priority_score);
 if (currentScore == null || previousScore == null) { $("healthTrend").className = "trendIndicator stable"; $("healthTrend").innerHTML = "<b>Stable</b><span>Not enough readings to compare</span>"; return }
 const delta = currentScore - previousScore, kind = delta > .25 ? "worsening" : delta < -.25 ? "improving" : "stable", direction = kind[0].toUpperCase() + kind.slice(1);
 const trendText = Math.abs(delta) < .01 ? "No priority-score change from the previous reading" : `${kind === "stable" ? "No meaningful change · " : ""}Avg priority ${currentScore.toFixed(2)} vs ${previousScore.toFixed(2)} in the previous reading`;
 $("healthTrend").className = `trendIndicator ${kind}`; $("healthTrend").innerHTML = `<b>${direction}</b><span>${trendText}</span>`;
}

/* ===== Needs attention ===== */
function renderAttention() {
 const urgent = data.filter(d => d.s === 2 || d.s === 1).sort((a, b) => b.s - a.s || (b.prio ?? 0) - (a.prio ?? 0)).slice(0, 5);
 $("attentionSummary").textContent = urgent.length ? `${urgent.length} customers shown` : "No active issues";
 $("attentionList").innerHTML = urgent.length ? urgent.map(d => `<button class="attentionItem" type="button" data-id="${esc(d.id)}"><strong>${esc(d.id)}</strong><span>${esc(d.city)} · ${esc(d.profile)} · ${SEV[d.s]} · Priority ${fmt(d.prio)}</span><small>${esc(d.why[0])}</small></button>`).join("") : "<div class=\"meta\">No customers need attention.</div>";
 $("attentionList").querySelectorAll("[data-id]").forEach(b => b.onclick = () => openCust(b.dataset.id));
}

/* ===== Boot ===== */
function showError(err) {
 const box = $("apiError");
 box.innerHTML = `Could not load data from the backend (${esc(err.message)}). Start it with <code>python backend/app.py</code> and open <code>http://127.0.0.1:5001</code>.`;
 box.hidden = false;
 $("upd").textContent = "No data loaded";
}
async function init() {
 page("overview");
 checkHealth(); setInterval(checkHealth, 30000);
 try {
  const [opt, sum, cust, reg] = await Promise.all([api("/api/options"), api("/api/summary"), api("/api/customers"), api("/api/regions")]);
  CITIES = opt.cities; PROFILES = opt.profiles; summary = sum; regions = reg.regions; data = cust.map(toReading);
 } catch (err) { showError(err); return }
 $("apiError").hidden = true;
 $("upd").textContent = `Last Data Update: ${fmtTime(summary.last_data_updated)}`;
 opts($("city"), "All cities", CITIES); opts($("sev"), "All severities", SEV); opts($("prof"), "All profiles", PROFILES);
 drawKpis(); refreshFilterUi(); render(); drawMap(); drawTiles(); drawHealthTrend(); renderAttention();
}
init();
