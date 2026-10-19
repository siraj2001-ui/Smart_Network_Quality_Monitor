// Dashboard logic: fetches data from the REST API and renders KPIs + table.
// Owner: Ayat. Uses textContent (not innerHTML) so data can never inject markup.

const els = {
  rows: document.getElementById("rows"),
  status: document.getElementById("status"),
  search: document.getElementById("search"),
  city: document.getElementById("city"),
  severity: document.getElementById("severity"),
  profile: document.getElementById("profile"),
  sort: document.getElementById("sort"),
  reset: document.getElementById("reset"),
};

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

function setStatus(msg, isError = false) {
  els.status.textContent = msg;
  els.status.classList.toggle("error", isError);
}

function fillSelect(select, values) {
  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });
}

async function loadSummary() {
  const s = await getJSON("/api/summary");
  document.getElementById("kpi-total").textContent = s.total_customers;
  document.getElementById("kpi-normal").textContent = s.normal;
  document.getElementById("kpi-monitor").textContent = s.monitor;
  document.getElementById("kpi-severe").textContent = s.severe;
  document.getElementById("kpi-invalid").textContent = s.invalid;
}

async function loadOptions() {
  const o = await getJSON("/api/options");
  fillSelect(els.city, o.cities);
  fillSelect(els.severity, o.severities);
  fillSelect(els.profile, o.profiles);
}

function cell(text, className) {
  const td = document.createElement("td");
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function fmt(value) {
  return value === null || value === undefined ? "-" : value;
}

function renderRows(customers) {
  els.rows.replaceChildren();
  customers.forEach((c) => {
    const tr = document.createElement("tr");
    tr.appendChild(cell(c.customer_id));
    tr.appendChild(cell(fmt(c.city)));
    tr.appendChild(cell(fmt(c.profile)));
    tr.appendChild(cell(fmt(c.latency_ms), "num"));
    tr.appendChild(cell(fmt(c.throughput_mbps), "num"));
    tr.appendChild(cell(fmt(c.packet_loss_pct), "num"));
    tr.appendChild(cell(fmt(c.congestion_pct), "num"));

    const sev = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `badge ${c.severity}`;
    badge.textContent = c.severity;
    sev.appendChild(badge);
    tr.appendChild(sev);

    tr.appendChild(cell(fmt(c.priority_score), "num"));

    const reasons = document.createElement("td");
    const ul = document.createElement("ul");
    ul.className = "reasons";
    c.reasons.forEach((r) => {
      const li = document.createElement("li");
      li.textContent = r;
      ul.appendChild(li);
    });
    reasons.appendChild(ul);
    tr.appendChild(reasons);

    els.rows.appendChild(tr);
  });
}

async function loadCustomers() {
  const params = new URLSearchParams();
  if (els.search.value.trim()) params.set("search", els.search.value.trim());
  if (els.city.value) params.set("city", els.city.value);
  if (els.severity.value) params.set("severity", els.severity.value);
  if (els.profile.value) params.set("profile", els.profile.value);
  if (els.sort.value) params.set("sort", els.sort.value);

  try {
    const customers = await getJSON(`/api/customers?${params}`);
    renderRows(customers);
    setStatus(`Showing ${customers.length} customer(s)`);
  } catch (err) {
    setStatus(`Could not load customers: ${err.message}`, true);
  }
}

let searchTimer;
els.search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadCustomers, 250);
});
[els.city, els.severity, els.profile, els.sort].forEach((el) =>
  el.addEventListener("change", loadCustomers)
);
els.reset.addEventListener("click", () => {
  els.search.value = "";
  [els.city, els.severity, els.profile, els.sort].forEach((el) => (el.value = ""));
  loadCustomers();
});

(async function init() {
  try {
    await Promise.all([loadSummary(), loadOptions()]);
  } catch (err) {
    setStatus(`Could not load dashboard: ${err.message}`, true);
    return;
  }
  loadCustomers();
})();
