/* ===================== LINKS ===================== */
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vThepfVPAV7nRGgU6vKdxlN7pBOiNFuQM9MwVVRyEmFVFgbHsW3KpjvlpVXsT65mLijkPVGa7JZqrc_/pub?gid=507475385&single=true&output=csv";

const FORM_URL = "https://forms.gle/3GgeJSzXh2sK1rHJ9";
const REPORT_URL = "https://forms.gle/beKtbsgbV8Rxr9jg7";

/* ===================== AVATARS ===================== */
const IMAGES_BASE = "images/professors/";
const DEFAULT_IMAGES = [
  "images/defaults/default1.jpg",
  "images/defaults/default2.jpg",
  "images/defaults/default3.jpg",
  "images/defaults/default4.jpg",
  "images/defaults/default5.jpg",
  "images/defaults/default6.jpg",
];
const IMAGE_EXT = "png";

/* ===================== HELPERS ===================== */
const $ = (id) => document.getElementById(id);

function hideLoadingAfter2s() {
  const loading = $("loading");
  if (!loading) return;
  setTimeout(() => { loading.style.display = "none"; }, 1250);
}

function slugifyName(name){
  return (name || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function hashString(str){
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function defaultAvatarFor(name){
  const h = hashString(name || "");
  return DEFAULT_IMAGES[h % DEFAULT_IMAGES.length];
}

function customAvatarUrl(name){
  const slug = slugifyName(name);
  if (!slug) return null;
  return `${IMAGES_BASE}${slug}.${IMAGE_EXT}`;
}

function verifiedIconSvg(){
  return `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 7.5 10.5 17 7 13.5"
        stroke="currentColor" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

function norm(s){ return (s ?? "").toString().trim(); }
function toNumber(x){
  const n = Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function fmt1(n){
  if (n == null) return "—";
  return (Math.round(n * 10) / 10).toFixed(1);
}
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function scoreClass(avg){
  if (avg == null) return {textClass:"score--mid", dotClass:"dot--mid"};
  if (avg >= 4.0) return {textClass:"score--good", dotClass:"dot--good"};
  if (avg >= 2.5) return {textClass:"score--mid", dotClass:"dot--mid"};
  return {textClass:"score--bad", dotClass:"dot--bad"};
}

/* ===================== THEME ===================== */
const THEME_KEY = "site_theme_v3";

function iconSun(){
  return `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" stroke="currentColor" stroke-width="2"/>
    <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M18.4 5.6l1.4-1.4M4.2 19.8l1.4-1.4"
      stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}
function iconMoon(){
  return `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5Z"
      stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  </svg>`;
}

function applyTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);

  const label = $("themeLabel");
  const icon = $("themeIcon");
  if (!label || !icon) return;

  if (theme === "light"){
    label.textContent = "Светлая";
    icon.innerHTML = iconSun();
  } else {
    label.textContent = "Тёмная";
    icon.innerHTML = iconMoon();
  }
}

function initTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  const theme = (saved === "light" || saved === "dark") ? saved : "dark";
  applyTheme(theme);

  const btn = $("themeToggle");
  if (btn){
    btn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "dark";
      applyTheme(current === "dark" ? "light" : "dark");
    });
  }
}

/* ===================== CSV PARSE ===================== */
function detectDelimiter(text){
  const head = text.split(/\r?\n/).find(l => l.trim().length) || "";
  const commas = (head.match(/,/g) || []).length;
  const tabs = (head.match(/\t/g) || []).length;
  return tabs > commas ? "\t" : ",";
}

function parseDelimited(text, delimiter){
  const rows = [];
  let cur = [];
  let val = "";
  let inQuotes = false;

  for (let i=0; i<text.length; i++){
    const ch = text[i];
    const next = text[i+1];

    if (ch === '"' && inQuotes && next === '"'){ val += '"'; i++; continue; }
    if (ch === '"'){ inQuotes = !inQuotes; continue; }

    if (ch === delimiter && !inQuotes){ cur.push(val); val = ""; continue; }

    if ((ch === "\n" || ch === "\r") && !inQuotes){
      if (ch === "\r" && next === "\n") i++;
      cur.push(val);
      rows.push(cur);
      cur = [];
      val = "";
      continue;
    }

    val += ch;
  }
  cur.push(val);
  rows.push(cur);

  return rows.filter(r => r.some(c => String(c ?? "").trim() !== ""));
}

function toObjects(grid){
  if (!grid.length) return [];
  const headers = grid[0].map(h => norm(h));
  const out = [];
  for (let i=1; i<grid.length; i++){
    const obj = {};
    for (let j=0; j<headers.length; j++){
      obj[headers[j]] = grid[i][j] ?? "";
    }
    out.push(obj);
  }
  return out;
}

/* ===================== AGGREGATION ===================== */
function mapInc(map, key){ if (!key) return; map.set(key, (map.get(key) || 0) + 1); }
function topN(map, n){ return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n).map(([k,v])=>({k,v})); }

function aggregate(rows){
  const by = new Map();

  for (const r of rows){
    const prof = norm(r["Chose your professor"]);
    if (!prof) continue;

    const q = toNumber(r["Общее качество"]);
    const s = toNumber(r["Уровень строгости"]);
    const again = norm(r["Взяли бы вы курс у этого преподавателя снова?"]);
    const att = norm(r["Посещение и отметка?"]);
    const grade = norm(r["Оценка которую вы получили у этого преподавателя?"]);
    const tagRaw = norm(r["Выберите тег который близко описывает преподавателя"]);

    if (!by.has(prof)){
      by.set(prof, {
        prof, count:0,
        sumQ:0, qN:0,
        sumS:0, sN:0,
        againYes:0, againN:0,
        attendance:new Map(),
        grades:new Map(),
        tags:new Map(),
      });
    }

    const a = by.get(prof);
    a.count++;

    if (q != null){ a.sumQ += q; a.qN++; }
    if (s != null){ a.sumS += s; a.sN++; }

    if (again){
      a.againN++;
      if (again.toLowerCase() === "да") a.againYes++;
    }

    mapInc(a.attendance, att);
    mapInc(a.grades, grade);

    if (tagRaw){
      const parts = tagRaw.split(/[;,]/).map(norm).filter(Boolean);
      if (parts.length) for (const p of parts) mapInc(a.tags, p);
      else mapInc(a.tags, tagRaw);
    }
  }

  return [...by.values()].map(a => ({
    ...a,
    avgQ: a.qN ? a.sumQ / a.qN : null,
    avgS: a.sN ? a.sumS / a.sN : null,
    topTags: topN(a.tags, 3),
  }));
}

/* ===================== APP STATE ===================== */
const appState = { rows: [], agg: [], query: "", sort: "quality_desc" };

function applyFilters(){
  let arr = appState.agg.slice();
  const q = appState.query.trim().toLowerCase();
  if (q) arr = arr.filter(x => x.prof.toLowerCase().includes(q));

  const s = appState.sort;
  arr.sort((a,b) => {
    if (s === "quality_desc") return (b.avgQ ?? -1) - (a.avgQ ?? -1);
    if (s === "quality_asc") return (a.avgQ ?? 1e9) - (b.avgQ ?? 1e9);
    if (s === "responses_desc") return b.count - a.count;
    if (s === "strict_desc") return (b.avgS ?? -1) - (a.avgS ?? -1);
    if (s === "strict_asc") return (a.avgS ?? 1e9) - (b.avgS ?? 1e9);
    if (s === "name_asc") return a.prof.localeCompare(b.prof, "en");
    return 0;
  });

  return arr;
}

/* ===================== MODAL ===================== */
function renderMiniTable(rows, h1, h2){
  if (!rows.length) return `<div class="muted">Нет данных</div>`;
  const tr = rows.map(r => `<tr><td>${escapeHtml(r.k)}</td><td>${r.v}</td></tr>`).join("");
  return `
    <table class="table">
      <thead><tr><th>${escapeHtml(h1)}</th><th>${escapeHtml(h2)}</th></tr></thead>
      <tbody>${tr}</tbody>
    </table>
  `;
}

function openModal(a){
  const modal = $("modal");
  if (!modal) return;

  $("modalTitle").textContent = a.prof;

  const againText = (a.againN > 0)
    ? `${Math.round((a.againYes / a.againN) * 100)}% (Да: ${a.againYes} / ${a.againN})`
    : "—";

  $("modalSubtitle").textContent = `Отзывов: ${a.count} · Снова бы взяли: ${againText}`;

  const sc = scoreClass(a.avgQ);

  $("modalBody").innerHTML = `
    <div class="kpis" style="margin-top:0">
      <div class="kpi">
        <div class="kpi__label">Общее качество</div>
        <div class="kpi__value ${sc.textClass}">
          <span class="scoreDot ${sc.dotClass}"></span>${fmt1(a.avgQ)} / 5
        </div>
        <div class="kpi__sub">оценок: ${a.qN}</div>
      </div>
      <div class="kpi">
        <div class="kpi__label">Строгость</div>
        <div class="kpi__value">${fmt1(a.avgS)} / 5</div>
        <div class="kpi__sub">оценок: ${a.sN}</div>
      </div>
    </div>

    <h3 style="margin:14px 0 6px 0">Теги</h3>
    ${renderMiniTable(topN(a.tags, 12), "Тег", "Кол-во")}

    <h3 style="margin:14px 0 6px 0">Посещение</h3>
    ${renderMiniTable(topN(a.attendance, 8), "Вариант", "Кол-во")}

    <h3 style="margin:14px 0 6px 0">Оценки</h3>
    ${renderMiniTable(topN(a.grades, 8), "Оценка", "Кол-во")}
  `;

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(){
  const modal = $("modal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

/* ===================== RENDER ===================== */
function render(){
  const grid = $("grid");
  const empty = $("empty");
  const status = $("status");
  if (!grid) return;

  const arr = applyFilters();
  grid.innerHTML = "";
  if (status) status.classList.add("hidden");

  if (!arr.length){
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  for (const a of arr){
    const sc = scoreClass(a.avgQ);
    const againText = (a.againN > 0) ? `${Math.round((a.againYes / a.againN) * 100)}%` : "—";

    const card = document.createElement("article");
    card.className = "profCard card";
    card.tabIndex = 0;

    // IMPORTANT: по умолчанию ставим дефолт и НЕ verified.
    const fallback = defaultAvatarFor(a.prof);
    const tryCustom = customAvatarUrl(a.prof);

    const tagsHtml = a.topTags.length
      ? a.topTags.map(t => `<span class="pill"><strong>${escapeHtml(t.k)}</strong> · ${t.v}</span>`).join("")
      : `<span class="pill">Без тегов</span>`;

    card.innerHTML = `
      <div class="profTop">
        <div class="profHead">
          <img class="profAvatar" data-avatar="1" src="${fallback}" alt="${escapeHtml(a.prof)}" loading="lazy" />
          <div>
            <div class="profNameRow">
              <p class="profName">${escapeHtml(a.prof)}</p>
              <span class="verifiedBadge hidden" data-verified="1" title="Верифицировано">
                ${verifiedIconSvg()}
              </span>
            </div>
            <p class="muted" style="margin:6px 0 0 0">Отзывов: ${a.count}</p>
          </div>
        </div>

        <span class="badge">Снова бы взяли: ${againText}</span>
      </div>

      <div class="kpis">
        <div class="kpi">
          <div class="kpi__label">Общее качество</div>
          <div class="kpi__value ${sc.textClass}">
            <span class="scoreDot ${sc.dotClass}"></span>${fmt1(a.avgQ)} / 5
          </div>
          <div class="kpi__sub">оценок: ${a.qN}</div>
        </div>

        <div class="kpi">
          <div class="kpi__label">Строгость</div>
          <div class="kpi__value">${fmt1(a.avgS)} / 5</div>
          <div class="kpi__sub">оценок: ${a.sN}</div>
        </div>
      </div>

      <div class="pills">${tagsHtml}</div>
    `;

    // Click to open modal
    card.addEventListener("click", () => openModal(a));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") openModal(a);
    });

    // Try load custom avatar:
    const img = card.querySelector('[data-avatar="1"]');
    const badge = card.querySelector('[data-verified="1"]');

    if (tryCustom && img){
      const test = new Image();
      test.onload = () => {
        img.src = tryCustom;
        img.classList.add("profAvatar--verified");
        if (badge) badge.classList.remove("hidden");
      };
      test.onerror = () => {
        // stay on default, no verified
      };
      test.src = tryCustom;
    } else {
      // no custom path -> keep default
      if (badge) badge.classList.add("hidden");
    }

    grid.appendChild(card);
  }
}

/* ===================== LOAD ===================== */
async function loadProfessors(){
  const formLink = $("formLink");
  const modalForm = $("modalFormLink");
  const reportLink = $("reportLink");
  if (formLink) formLink.href = FORM_URL || "#";
  if (modalForm) modalForm.href = FORM_URL || "#";
  if (reportLink) reportLink.href = REPORT_URL || "#";

  const status = $("status");
  if (status){
    status.classList.remove("hidden");
    status.querySelector(".status__title").textContent = "Загрузка…";
  }

  try {
    const res = await fetch(SHEET_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    const delim = detectDelimiter(text);
    const grid = parseDelimited(text, delim);
    const objects = toObjects(grid);

    appState.rows = objects;
    appState.agg = aggregate(objects);

    const totalResponses = $("totalResponses");
    const totalProf = $("totalProfessors");
    if (totalResponses) totalResponses.textContent = String(appState.rows.length || 0);
    if (totalProf) totalProf.textContent = String(appState.agg.length || 0);

    render();
  } catch (e){
    if (status){
      status.classList.remove("hidden");
      status.querySelector(".status__title").textContent = "Не удалось загрузить данные";
      status.querySelector(".status__text").textContent = "Проверь ссылку и доступ к опубликованному листу.";
    }
    console.error(e);
  } finally {
    hideLoadingAfter2s();
  }
}

/* ===================== INIT ===================== */
function initApp(){
  initTheme();

  const grid = $("grid");
  if (!grid) { hideLoadingAfter2s(); return; }

  $("searchInput").addEventListener("input", (e) => {
    appState.query = e.target.value || "";
    render();
  });

  $("sortSelect").addEventListener("change", (e) => {
    appState.sort = e.target.value;
    render();
  });

  const modal = $("modal");
  if (modal){
    modal.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.dataset && t.dataset.close) closeModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  loadProfessors();
}

initApp();
