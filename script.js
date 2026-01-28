/* ========= ВСТАВЬ СЮДА СВОИ ССЫЛКИ ========= */
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vThepfVPAV7nRGgU6vKdxlN7pBOiNFuQM9MwVVRyEmFVFgbHsW3KpjvlpVXsT65mLijkPVGa7JZqrc_/pub?gid=243273262&single=true&output=csv";

const FORM_URL = "https://forms.gle/3GgeJSzXh2sK1rHJ9";
const REPORT_URL = "https://forms.gle/beKtbsgbV8Rxr9jg7";

const $ = (id) => document.getElementById(id);

const state = {
  rows: [],
  agg: [],
  query: "",
  sort: "quality_desc",
};

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

    if (ch === delimiter && !inQuotes){
      cur.push(val);
      val = "";
      continue;
    }

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

/* ========= Aggregation ========= */
function mapInc(map, key, inc=1){
  if (!key) return;
  map.set(key, (map.get(key) || 0) + inc);
}

function topN(map, n){
  return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n).map(([k,v])=>({k,v}));
}

function scoreClass(avg){
  if (avg == null) return {textClass:"", dotClass:"dot--mid"};
  if (avg >= 4.0) return {textClass:"score--good", dotClass:"dot--good"};
  if (avg >= 2.5) return {textClass:"score--mid", dotClass:"dot--mid"};
  return {textClass:"score--bad", dotClass:"dot--bad"};
}

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
        prof,
        count: 0,
        sumQ: 0, qN: 0,
        sumS: 0, sN: 0,
        againYes: 0, againN: 0,
        attendance: new Map(),
        grades: new Map(),
        tags: new Map(),
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
      // if multiple tags are ever added like "Tag1, Tag2"
      const parts = tagRaw.split(/[;,]/).map(norm).filter(Boolean);
      if (parts.length){
        for (const p of parts) mapInc(a.tags, p);
      } else {
        mapInc(a.tags, tagRaw);
      }
    }
  }

  return [...by.values()].map(a => {
    const avgQ = a.qN ? a.sumQ / a.qN : null;
    const avgS = a.sN ? a.sumS / a.sN : null;
    const againPct = a.againN ? (a.againYes / a.againN) * 100 : null;
    return {
      ...a,
      avgQ,
      avgS,
      againPct,
      topTags: topN(a.tags, 3),
      topAttendance: topN(a.attendance, 3),
      topGrades: topN(a.grades, 4),
    };
  });
}

/* ========= UI ========= */
function applyFilters(){
  let arr = state.agg.slice();

  const q = state.query.trim().toLowerCase();
  if (q) arr = arr.filter(x => x.prof.toLowerCase().includes(q));

  const s = state.sort;
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

function render(){
  const grid = $("grid");
  const empty = $("empty");
  const status = $("status");

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

    const tagsHtml = a.topTags.length
      ? a.topTags.map(t => `<span class="pill"><strong>${escapeHtml(t.k)}</strong> · ${t.v}</span>`).join("")
      : `<span class="pill">Без тегов</span>`;

    const againText = (a.againN > 0)
      ? `${Math.round((a.againYes / a.againN) * 100)}%`
      : "—";

    const card = document.createElement("article");
    card.className = "profCard card";
    card.tabIndex = 0;

    card.innerHTML = `
      <div class="profTop">
        <div>
          <p class="profName">${escapeHtml(a.prof)}</p>
          <p class="muted" style="margin:6px 0 0 0">Отзывов: ${a.count}</p>
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

    card.addEventListener("click", () => openModal(a));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") openModal(a);
    });

    grid.appendChild(card);
  }
}

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

  const modal = $("modal");
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(){
  const modal = $("modal");
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

/* ========= Data load ========= */
async function load(){
  $("formLink").href = FORM_URL || "#";
  $("modalFormLink").href = FORM_URL || "#";
  $("reportLink").href = REPORT_URL || "#";

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

    state.rows = objects;
    state.agg = aggregate(objects);

    $("totalResponses").textContent = String(state.rows.length || 0);
    $("totalProfessors").textContent = String(state.agg.length || 0);

    render();

    
    setTimeout(() => {
    const loading = document.getElementById("loading");
    if (loading) loading.style.display = "none";
    }, 1250);

  } catch (e){
    if (status){
      status.classList.remove("hidden");
      status.querySelector(".status__title").textContent = "Не удалось загрузить данные";
      status.querySelector(".status__text").textContent =
        "Проверь: ссылка правильная, лист опубликован, и доступен по ссылке.";
    }
    console.error(e);
  }
}

/* ========= events ========= */
function init(){
  $("searchInput").addEventListener("input", (e) => {
    state.query = e.target.value || "";
    render();
  });

  $("sortSelect").addEventListener("change", (e) => {
    state.sort = e.target.value;
    render();
  });

  // modal close: backdrop, X, button
  $("modal").addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.dataset && t.dataset.close) closeModal();
  });

  // ESC close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  load();
}

init();


window.closeModal = closeModal;
