/* hero.js */

const EVENT_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTF0Fwu2o_2tG9oJByJxNcbHt67qoLSQ3qp79kGToTnX9X0kmCYKIuTlIPDRM2fNpzkuOKkgxeQtgzD/pub?gid=0&single=true&output=csv";
const NOTICE_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTF0Fwu2o_2tG9oJByJxNcbHt67qoLSQ3qp79kGToTnX9X0kmCYKIuTlIPDRM2fNpzkuOKkgxeQtgzD/pub?gid=1522867519&single=true&output=csv";
const SLOT_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTF0Fwu2o_2tG9oJByJxNcbHt67qoLSQ3qp79kGToTnX9X0kmCYKIuTlIPDRM2fNpzkuOKkgxeQtgzD/pub?gid=728306151&single=true&output=csv";
const NOTICES_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTF0Fwu2o_2tG9oJByJxNcbHt67qoLSQ3qp79kGToTnX9X0kmCYKIuTlIPDRM2fNpzkuOKkgxeQtgzD/pub?gid=729967944&single=true&output=csv";
const RIG_OPTIONS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTF0Fwu2o_2tG9oJByJxNcbHt67qoLSQ3qp79kGToTnX9X0kmCYKIuTlIPDRM2fNpzkuOKkgxeQtgzD/pub?gid=177450489&single=true&output=csv";


// DOM
const $notice = document.getElementById("authorNotice");
const $eventList = document.getElementById("eventList");
const $slotGrid = document.getElementById("slotGrid");
const $noticesBody = document.getElementById("noticesBody");
const $rigOptionsBody = document.getElementById("rigOptionsBody");

// ---------- utils ----------
function driveToDirectImage(url) {
  const u = normalizeValue(url);
  if (!u) return "";

  if (/^https:\/\/lh3\.googleusercontent\.com\/d\//i.test(u)) {
    return u;
  }

  let id = "";

  const m1 = u.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) id = m1[1];

  if (!id) {
    const m2 = u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m2) id = m2[1];
  }

  if (!id && /^[a-zA-Z0-9_-]{10,}$/.test(u)) {
    id = u;
  }
  if (!id) return u;

  return `https://lh3.googleusercontent.com/d/${id}`;
}

function escapeHTML(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeKey(s) {
  return String(s ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeValue(s) {
  return String(s ?? "").trim();
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];

    if (c === '"' && inQuotes && n === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (c === "," && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }
    if ((c === "\n" || c === "\r") && !inQuotes) {
      if (c === "\r" && n === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some(v => String(v).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    cur += c;
  }

  if (cur.length || row.length) {
    row.push(cur);
    if (row.some(v => String(v).trim() !== "")) rows.push(row);
  }
  return rows;
}

function rowsToObjects(rows) {
  if (!rows || rows.length < 2) return [];
  const header = rows[0].map(normalizeKey);
  const data = rows.slice(1);

  return data.map(r => {
    const obj = {};
    header.forEach((h, idx) => {
      if (!h) return;
      obj[h] = normalizeValue(r[idx] ?? "");
    });
    return obj;
  });
}

async function fetchCSV(url) {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}\n${text.slice(0, 200)}`);
  return text;
}

function hasPlaceholder(url) {
  return !url || url.startsWith("PASTE_");
}

function isVisibleFlag(v) {
  return normalizeValue(v).toUpperCase() === "O";
}

// ---------- 공지 ----------
function renderNotice(text, { isError = false } = {}) {
  if (!$notice) return;

  const safe = escapeHTML(text);
  $notice.innerHTML = `
    <div class="notice__icon">✦</div>
    <div class="notice__text">${isError ? `<strong>공지 로드 실패</strong><br/>${safe}` : safe}</div>
  `;
}

async function loadNotice() {
  if (!$notice) return;

  if (hasPlaceholder(NOTICE_CSV_URL)) {
    renderNotice("NOTICE_CSV_URL이 설정되지 않았습니다. (공지 시트의 pub CSV 링크를 넣어주세요)");
    return;
  }

  try {
    const csv = await fetchCSV(NOTICE_CSV_URL);
    const rows = parseCSV(csv);
    const headerKeys = rows[0]?.map(normalizeKey) ?? [];

    const required = ["공지사항", "노출 여부"];
    const missing = required.filter(k => !headerKeys.includes(k));
    if (missing.length) {
      renderNotice(`공지 시트 헤더를 인식하지 못했습니다: ${missing.join(", ")}`, { isError: true });
      return;
    }

    const objects = rowsToObjects(rows);
    const visible = objects.find(o => isVisibleFlag(o["노출 여부"]));
    const msg = visible?.["공지사항"] || "현재 공지사항이 없습니다.";
    renderNotice(msg);
  } catch (err) {
    console.error(err);
    renderNotice(err.message, { isError: true });
  }
}

// ---------- 이벤트 ----------
function renderEvents(items) {
  if (!$eventList) return;

  if (!items.length) {
    $eventList.innerHTML = `
      <article class="eventCard">
        <div class="eventCard__top">
          <div class="eventCard__title">현재 진행 중인 이벤트가 없습니다.</div>
        </div>
        <div class="eventCard__desc">시트에서 ‘노출 여부’를 O로 설정하면 표시됩니다.</div>
      </article>
    `;
    return;
  }

  $eventList.innerHTML = items.map(ev => {
    const title = escapeHTML(ev["이벤트 제목"]);
    const desc = escapeHTML(ev["이벤트 설명"]);
    const badge = escapeHTML(ev["배지"]);

    return `
      <article class="eventCard">
        <div class="eventCard__top">
          <div class="eventCard__title">${title || "제목 없음"}</div>
          ${badge ? `<div class="eventCard__badge">${badge}</div>` : ""}
        </div>
        ${desc ? `<div class="eventCard__desc">${desc}</div>` : ""}
      </article>
    `;
  }).join("");
}

async function loadEvents() {
  if (!$eventList) return;
  $eventList.innerHTML = `
    <div class="skeleton" aria-hidden="true">
      <div class="skLine"></div>
      <div class="skLine skLine--short"></div>
    </div>
  `;

  try {
    const csv = await fetchCSV(EVENT_CSV_URL);
    const rows = parseCSV(csv);
    const headerKeys = rows[0]?.map(normalizeKey) ?? [];

    const required = ["이벤트 제목", "이벤트 설명", "배지", "노출 여부"];
    const missing = required.filter(k => !headerKeys.includes(k));
    if (missing.length) {
      $eventList.innerHTML = `
        <article class="eventCard">
          <div class="eventCard__top">
            <div class="eventCard__title">이벤트 시트 헤더 인식 실패</div>
          </div>
          <div class="eventCard__desc">누락: ${escapeHTML(missing.join(", "))}</div>
          <div class="eventCard__desc">인식된 헤더: ${escapeHTML(headerKeys.join(" | "))}</div>
        </article>
      `;
      return;
    }

    const objects = rowsToObjects(rows);
    const visible = objects.filter(o => isVisibleFlag(o["노출 여부"]));
    renderEvents(visible);
  } catch (err) {
    console.error(err);
    $eventList.innerHTML = `
      <article class="eventCard">
        <div class="eventCard__top">
          <div class="eventCard__title">이벤트를 불러오지 못했습니다.</div>
        </div>
        <div class="eventCard__desc">${escapeHTML(err.message)}</div>
      </article>
    `;
  }
}

// ---------- 슬롯 ----------
function monthSortKey(m) {
  const s = normalizeValue(m);
  const num = Number((s.match(/\d+/) || [])[0]);
  return Number.isFinite(num) ? num : 9999;
}

function slotIndexKey(v) {
  const n = Number((String(v).match(/\d+/) || [])[0]);
  return Number.isFinite(n) ? n : 9999;
}

function normalizeSlotType(type) {
  const t = normalizeValue(type);

  if (t.includes("빈")) return { cls: "slot--open", symbol: "○" };
  if (t.includes("마감")) return { cls: "slot--closed", symbol: "●" };
  if (t.includes("협업")) return { cls: "slot--collab", symbol: "♥" };
  return { cls: "slot--open", symbol: "○" };
}

function renderSlots(grouped) {
  if (!$slotGrid) return;

  const months = Object.keys(grouped).sort((a, b) => monthSortKey(a) - monthSortKey(b));

  if (!months.length) {
    $slotGrid.innerHTML = `
      <div class="slotMonth">
        <div class="slotMonth__title">슬롯 정보 없음</div>
        <div class="slotRow">
          <div class="slot slot--closed">시트에서 데이터를 입력해주세요</div>
          <div class="slot slot--closed">월/슬롯 번호/슬롯 타입</div>
          <div class="slot slot--closed">형식으로 작성</div>
        </div>
      </div>
    `;
    return;
  }

  $slotGrid.innerHTML = months.map(month => {
    const slots = grouped[month]
      .slice()
      .sort((a, b) => slotIndexKey(a["슬롯 번호"]) - slotIndexKey(b["슬롯 번호"]));

    const byNo = new Map();
    slots.forEach(s => byNo.set(String(slotIndexKey(s["슬롯 번호"])), s));

    const cells = [1, 2, 3].map(no => {
      const row = byNo.get(String(no));
      const info = normalizeSlotType(row?.["슬롯 타입"]);
      return `<div class="slot ${info.cls}">${info.symbol} ${escapeHTML(info.label)}</div>`;
    }).join("");

    return `
      <div class="slotMonth">
        <div class="slotMonth__title">${escapeHTML(month)}</div>
        <div class="slotRow">${cells}</div>
      </div>
    `;
  }).join("");
}

async function loadSlots() {
  if (!$slotGrid) return;

  if (hasPlaceholder(SLOT_CSV_URL)) {
    return;
  }

  try {
    const csv = await fetchCSV(SLOT_CSV_URL);
    const rows = parseCSV(csv);
    const headerKeys = rows[0]?.map(normalizeKey) ?? [];

    const required = ["월", "슬롯 번호", "슬롯 타입"];
    const missing = required.filter(k => !headerKeys.includes(k));
    if (missing.length) {
      $slotGrid.innerHTML = `
        <div class="slotMonth">
          <div class="slotMonth__title">슬롯 시트 헤더 인식 실패</div>
          <div class="slotRow">
            <div class="slot slot--closed">누락: ${escapeHTML(missing.join(", "))}</div>
            <div class="slot slot--closed">인식된 헤더</div>
            <div class="slot slot--closed">${escapeHTML(headerKeys.join(" | "))}</div>
          </div>
        </div>
      `;
      return;
    }

    const objects = rowsToObjects(rows);

    const cleaned = objects.filter(o =>
      normalizeValue(o["월"]) && normalizeValue(o["슬롯 번호"]) && normalizeValue(o["슬롯 타입"])
    );

    const grouped = {};
    cleaned.forEach(o => {
      const month = normalizeValue(o["월"]);
      grouped[month] = grouped[month] || [];
      grouped[month].push(o);
    });

    renderSlots(grouped);
  } catch (err) {
    console.error(err);
    $slotGrid.innerHTML = `
      <div class="slotMonth">
        <div class="slotMonth__title">슬롯을 불러오지 못했습니다</div>
        <div class="slotRow">
          <div class="slot slot--closed">${escapeHTML(err.message)}</div>
          <div class="slot slot--closed">CSV 공개 설정 확인</div>
          <div class="slot slot--closed">또는 링크 확인</div>
        </div>
      </div>
    `;
  }
}

// ---------- 공지사항 섹션 ----------
function orderKey(v) {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 999999;
}

function cleanBracketText(s) {
  return normalizeValue(s)
    .replace(/^\[\s*/, "")
    .replace(/\s*\]$/, "")
    .trim();
}

function splitLines(text) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);
}

function renderNotices(introLines, groups, { isError = false, headerKeys = [] } = {}) {
  if (!$noticesBody) return;

  if (isError) {
    $noticesBody.innerHTML = `
      <article class="noticesError">
        <div class="noticesError__title">공지사항을 불러오지 못했습니다.</div>
        <div class="noticesError__desc">${escapeHTML(introLines || "")}</div>
        ${headerKeys.length ? `<div class="noticesError__desc">인식된 헤더: ${escapeHTML(headerKeys.join(" | "))}</div>` : ""}
      </article>
    `;
    return;
  }

  const introHTML = introLines.length
    ? `<div class="noticesIntro">${introLines.map(t => `<p class="noticesP">${escapeHTML(t)}</p>`).join("")}</div>`
    : "";

  const groupNames = Object.keys(groups);
  const groupsHTML = groupNames.map(name => {
  const items = groups[name] || [];
  const title = escapeHTML(name);
  const count = items.length;

  const lis = items.map(t => `<li>${escapeHTML(t)}</li>`).join("");

  return `
    <section class="noticeGroup">
      <div class="noticeGroup__top">
        <div class="noticeGroup__titleRow">
          <div class="noticeGroup__title">${title}</div>
          <div class="noticeGroup__meta">${count}개 항목</div>
        </div>
      </div>

      <ul class="noticeList">
        ${lis}
      </ul>
    </section>
  `;
  }).join("");


  if (!introHTML && !groupsHTML) {
    $noticesBody.innerHTML = `<div class="noticesEmpty">현재 표시할 공지사항이 없습니다. (시트에서 ‘노출 여부’를 O로 설정해주세요)</div>`;
    return;
  }

  $noticesBody.innerHTML = `${introHTML}${groupsHTML}`;
}

async function loadNoticesSection() {
  if (!$noticesBody) return;

  if (hasPlaceholder(NOTICES_CSV_URL)) {
    $noticesBody.innerHTML = `<div class="noticesEmpty">NOTICES_CSV_URL이 설정되지 않았습니다.</div>`;
    return;
  }

  $noticesBody.innerHTML = `
    <div class="skeleton" aria-hidden="true">
      <div class="skLine"></div>
      <div class="skLine skLine--short"></div>
      <div class="skLine"></div>
    </div>
  `;

  try {
    const csv = await fetchCSV(NOTICES_CSV_URL);
    const rows = parseCSV(csv);
    const headerKeys = rows[0]?.map(normalizeKey) ?? [];

    const required = ["그룹", "텍스트", "순서", "노출 여부"];
    const missing = required.filter(k => !headerKeys.includes(k));
    if (missing.length) {
      renderNotices([`시트 헤더를 인식하지 못했습니다: ${missing.join(", ")}`], {}, { isError: true, headerKeys });
      return;
    }

    const objects = rowsToObjects(rows)
      .filter(o => isVisibleFlag(o["노출 여부"]))
      .sort((a, b) => orderKey(a["순서"]) - orderKey(b["순서"]));

    const introLines = [];
    const groups = {};

    objects.forEach(o => {
      const group = cleanBracketText(o["그룹"]);
      const lines = splitLines(o["텍스트"]);
      if (!lines.length) return;

      if (!group) {
        lines.forEach(t => introLines.push(t));
        return;
      }

      groups[group] = groups[group] || [];
      lines.forEach(t => groups[group].push(t));
    });

    renderNotices(introLines, groups);
  } catch (err) {
    console.error(err);
    renderNotices([err.message], {}, { isError: true });
  }
}

// ---------- init ----------
loadNotice();
loadEvents();
loadSlots();
loadNoticesSection();

/* =========================
   COLLAB AUTHORS
========================= */

const COLLAB_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTF0Fwu2o_2tG9oJByJxNcbHt67qoLSQ3qp79kGToTnX9X0kmCYKIuTlIPDRM2fNpzkuOKkgxeQtgzD/pub?gid=1181631648&single=true&output=csv";

(function initCollab() {
  const $toggle = document.getElementById("collabToggle");
  const $panel = document.getElementById("collabPanel");
  const $list = document.getElementById("collabList");
  const $state = document.getElementById("collabState");
  const $count = document.getElementById("collabCount");

  if (!$toggle || !$panel || !$list) return;

  function escapeHTML(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeKey(s) {
    return String(s ?? "")
      .replace(/^\uFEFF/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeValue(s) {
    return String(s ?? "").trim();
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const n = text[i + 1];

      if (c === '"' && inQuotes && n === '"') {
        cur += '"';
        i++;
        continue;
      }
      if (c === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (c === "," && !inQuotes) {
        row.push(cur);
        cur = "";
        continue;
      }
      if ((c === "\n" || c === "\r") && !inQuotes) {
        if (c === "\r" && n === "\n") i++;
        row.push(cur);
        cur = "";
        if (row.some(v => String(v).trim() !== "")) rows.push(row);
        row = [];
        continue;
      }
      cur += c;
    }
    if (cur.length || row.length) {
      row.push(cur);
      if (row.some(v => String(v).trim() !== "")) rows.push(row);
    }
    return rows;
  }

  function rowsToObjects(rows) {
    if (!rows || rows.length < 2) return [];
    const header = rows[0].map(normalizeKey);
    const data = rows.slice(1);

    return data.map(r => {
      const obj = {};
      header.forEach((h, idx) => {
        if (!h) return;
        obj[h] = normalizeValue(r[idx] ?? "");
      });
      return obj;
    });
  }

  async function fetchCSV(url) {
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}\n${text.slice(0, 160)}`);
    return text;
  }

  function isVisibleFlag(v) {
    return normalizeValue(v).toUpperCase() === "O";
  }
  
  function setExpanded(open) {
  $toggle.classList.toggle("is-open", open);
  $toggle.setAttribute("aria-expanded", open ? "true" : "false");

  if (open) {
    $panel.classList.add("is-open");
    $panel.style.maxHeight = "0px";
    requestAnimationFrame(() => {
      $panel.style.maxHeight = $panel.scrollHeight + "px";
    });
    return;
  }

  $panel.classList.remove("is-open");
  $panel.style.maxHeight = $panel.scrollHeight + "px";
  requestAnimationFrame(() => {
    $panel.style.maxHeight = "0px";
  });
}


  function normalizeUrl(raw) {
  const u = String(raw ?? "").trim();
  if (!u) return "";

  const clean = u.replace(/\s+/g, "");

  if (/^https?:\/\//i.test(clean)) return clean;

  if (clean.startsWith("//")) return `https:${clean}`;

  if (clean.startsWith("/")) return clean;

  return `https://${clean}`;
 }

  // ----- render -----
  const MAX_ITEMS = 4;

  function discountToItems(text) {
    const lines = String(text ?? "")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);

    return lines;
  }

  function ensureNim(name) {
  const n = normalizeValue(name);
  if (!n) return "";
  return n.endsWith("님") ? n : `${n}님`;
}

  function render(items) {
    const visible = items.filter(x => isVisibleFlag(x["노출 여부"]));
    if ($count) $count.textContent = `${visible.length}명`;

    if (!visible.length) {
      $list.innerHTML = "";
      if ($state) $state.textContent = "현재 노출 중인 협업 작가가 없습니다. (노출 여부를 O로 설정해주세요)";
      return;
    }

    if ($state) $state.textContent = "";

    $list.innerHTML = visible.map(a => {
      const rawName = a["작가명"];
      const nameWithNim = ensureNim(rawName);
      const name = escapeHTML(nameWithNim);

      const rawImg = (a["이미지 URL"] || "").trim();
      const img = driveToDirectImage(rawImg);
      const linkRaw = a["페이지 링크"] || "";
      const link = normalizeUrl(linkRaw);

      const discountRaw = a["할인 문구"] || "";

      const href = link ? escapeHTML(link) : "#";

      const lines = discountToItems(discountRaw);
      const shown = lines.slice(0, MAX_ITEMS);
      const hiddenCount = Math.max(0, lines.length - shown.length);

      const listHtml = shown.length
        ? `<ul class="collabCard__list">
            ${shown.map(t => `<li>${escapeHTML(t)}</li>`).join("")}
            ${hiddenCount ? `<li class="collabTiny">+ ${hiddenCount}개 더 있음</li>` : ``}
          </ul>`
        : `<div class="collabTiny" style="margin:10px 0 12px;">할인 문구가 없습니다.</div>`;

      const safeHref = link ? escapeHTML(link) : "#";
      const targetAttr = link ? ` target="_blank" rel="noopener noreferrer"` : "";


      return `
        <a class="collabCard" href="${safeHref}"${targetAttr}>
          <div class="collabCard__media">
            ${img
              ? `<img src="${escapeHTML(img)}" alt="${name}" loading="lazy" />`
              : `<div style="width:100%;height:100%;display:grid;place-items:center;color:rgba(13,27,54,.45);font-weight:900;">NO IMAGE</div>`
            }
          </div>

          <div class="collabCard__body">
            <div class="collabCard__nameRow">
              <div class="collabCard__name">${name || "작가명"}</div>
              <div class="collabCard__badge">COLLAB</div>
            </div>

            ${listHtml}

          </div>
        </a>
      `;
    }).join("");
  }

  async function load() {
    if (!COLLAB_CSV_URL || COLLAB_CSV_URL.startsWith("PASTE_")) {
      if ($state) $state.textContent = "COLLAB_CSV_URL이 설정되지 않았습니다. (collab_authors 시트의 pub CSV 링크를 넣어주세요)";
      if ($count) $count.textContent = "0명";
      return;
    }

    if ($state) $state.textContent = "불러오는 중…";
    $list.innerHTML = "";

    try {
      const csv = await fetchCSV(COLLAB_CSV_URL);
      const rows = parseCSV(csv);
      const headerKeys = rows[0]?.map(normalizeKey) ?? [];

      const required = ["작가명", "이미지 URL", "할인 문구", "페이지 링크", "노출 여부"];
      const missing = required.filter(k => !headerKeys.includes(k));
      if (missing.length) {
        if ($state) {
          $state.innerHTML =
            `헤더를 인식하지 못했습니다.<br/>
             누락: ${escapeHTML(missing.join(", "))}<br/>
             인식된 헤더: ${escapeHTML(headerKeys.join(" | "))}`;
        }
        if ($count) $count.textContent = "0명";
        return;
      }

      const objects = rowsToObjects(rows);
      render(objects);
    } catch (err) {
      console.error(err);
      if ($state) $state.textContent = `불러오지 못했습니다: ${err.message}`;
      if ($count) $count.textContent = "0명";
    }
  }

// ----- events -----
$toggle.addEventListener("click", () => {
  const open = $toggle.getAttribute("aria-expanded") !== "true";
  setExpanded(open);

  if (open) {
    requestAnimationFrame(() => {
      $panel.style.maxHeight = $panel.scrollHeight + "px";
    });
  }
});

setExpanded(false);

if ($count) $count.textContent = "불러오는 중…";
load();

})();


/* =========================
   RIG DETAIL
========================= */
const RIG_DETAIL_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTF0Fwu2o_2tG9oJByJxNcbHt67qoLSQ3qp79kGToTnX9X0kmCYKIuTlIPDRM2fNpzkuOKkgxeQtgzD/pub?gid=1309877908&single=true&output=csv";

const $rigDetailBody = document.getElementById("rigDetailBody");

async function loadRigDetail() {
  if (!$rigDetailBody) return;

  if (!RIG_DETAIL_CSV_URL || RIG_DETAIL_CSV_URL.startsWith("PASTE_")) {
    $rigDetailBody.innerHTML = `<div class="mini">rig_detail 시트 URL이 설정되지 않았습니다.</div>`;
    return;
  }

  try {
    const csv = await fetchCSV(RIG_DETAIL_CSV_URL);
    const rows = parseCSV(csv);
    const headerKeys = rows[0]?.map(normalizeKey) ?? [];

    const required = ["그룹", "이미지 제목", "이미지 URL"];
    const missing = required.filter(k => !headerKeys.includes(k));
    if (missing.length) {
      $rigDetailBody.innerHTML =
        `<div class="mini">시트 헤더 누락: ${missing.join(", ")}</div>`;
      return;
    }

    const objects = rowsToObjects(rows);

    const groups = {};
    objects.forEach(o => {
      const group = normalizeValue(o["그룹"]);
      const rawUrl = normalizeValue(o["이미지 URL"]);
      const imgUrl = driveToDirectImage(rawUrl);
      const title = normalizeValue(o["이미지 제목"]);

      if (!group || !imgUrl) return;

      groups[group] = groups[group] || [];
      groups[group].push({ title, url: imgUrl });
    });

    renderRigDetail(groups);
  } catch (err) {
    console.error(err);
    $rigDetailBody.innerHTML = `<div class="mini">불러오지 못했습니다: ${escapeHTML(err.message)}</div>`;
  }
}

function renderRigDetail(groups) {
  const groupNames = Object.keys(groups);
  if (!groupNames.length) {
    $rigDetailBody.innerHTML = `<div class="mini">표시할 데이터가 없습니다.</div>`;
    return;
  }

  $rigDetailBody.innerHTML = groupNames.map(group => {
    const items = groups[group];

    const imagesHTML = items.map(item => `
      <div class="rigDetailItem">
        <div class="rigDetailItem__img">
          <img src="${escapeHTML(item.url)}" loading="lazy" />
        </div>
        ${
          item.title
            ? `<div class="rigDetailItem__label">${escapeHTML(item.title)}</div>`
            : ``
        }
      </div>
    `).join("");

    return `
      <section class="rigDetailGroup">
        <div class="rigDetailGroup__title">${escapeHTML(group)}</div>
        <div class="rigDetailGrid">
          ${imagesHTML}
        </div>
      </section>
    `;
  }).join("");
}

// init
loadRigDetail();


async function loadRigOptions() {
  if (!$rigOptionsBody) return;

  if (!RIG_OPTIONS_CSV_URL || RIG_OPTIONS_CSV_URL.startsWith("PASTE_")) {
    $rigOptionsBody.innerHTML = `<div class="mini">rig_options 시트 URL이 설정되지 않았습니다.</div>`;
    return;
  }

  $rigOptionsBody.innerHTML = `
    <div class="skeleton" aria-hidden="true">
      <div class="skLine"></div>
      <div class="skLine skLine--short"></div>
    </div>
  `;

  try {
    const csv = await fetchCSV(RIG_OPTIONS_CSV_URL);
    const rows = parseCSV(csv);

    // 헤더 검증
    const headerKeys = rows[0]?.map(normalizeKey) ?? [];
    const required = ["구분", "옵션명", "설명", "순서", "표시 여부"];
    const missing = required.filter(k => !headerKeys.includes(k));
    if (missing.length) {
      $rigOptionsBody.innerHTML = `<div class="mini">시트 헤더 누락: ${escapeHTML(missing.join(", "))}</div>`;
      return;
    }

    const objects = rowsToObjects(rows)
      .filter(o => isVisibleFlag2(o["표시 여부"]))
      .sort((a, b) => orderKey(a["순서"]) - orderKey(b["순서"]));

    const groups = groupByType(objects);

    renderRigOptionsV2(groups);
  } catch (err) {
    console.error(err);
    $rigOptionsBody.innerHTML = `<div class="mini">불러오지 못했습니다: ${escapeHTML(err.message)}</div>`;
  }
}

function isVisibleFlag2(v) {
  const s = normalizeValue(v).toLowerCase();
  return ["o", "ㅇ", "y", "yes", "true", "1", "표시", "노출"].includes(s);
}

function groupByType(list) {
  const out = new Map();
  list.forEach(o => {
    const t = normalizeValue(o["구분"]) || "기타";
    if (!out.has(t)) out.set(t, []);
    out.get(t).push(o);
  });
  return out;
}

function renderRigOptionsV2(groupsMap) {
  if (!$rigOptionsBody) return;

  const typeOrder = (t) => {
    const s = String(t);
    if (s.includes("기본")) return 0;
    if (s.includes("추가")) return 1;
    return 2;
  };

  const types = Array.from(groupsMap.keys()).sort((a, b) => typeOrder(a) - typeOrder(b));

  const col = (title, items) => {
    const lis = items.map(o => {
    const name = escapeHTML(o["옵션명"]);
    const descRaw = normalizeValue(o["설명"]);

    const desc = descRaw
      ? escapeHTML(descRaw)
          .replace(/\\n/g, "\n")
          .replace(/\r\n|\n|\r/g, "<br>")
      : "";

      const dataAttrs =
        `data-type="${escapeHTML(o["구분"])}" ` +
        `data-name="${escapeHTML(o["옵션명"])}" `;

      return `
        <li class="rigOptionsItem" ${dataAttrs}>
          <div class="rigOptionsItem__name">${name || "옵션명"}</div>
          ${desc ? `<div class="rigOptionsItem__desc">${desc}</div>` : ``}
        </li>
      `;
    }).join("");

    return `
      <section class="rigOptionsCol">
        <div class="rigOptionsCol__top">
          <div class="rigOptionsCol__title">${escapeHTML(title)}</div>
          <div class="rigOptionsCol__meta">${items.length}개</div>
        </div>
        <ul class="rigOptionsList">
          ${lis || `<li class="rigOptionsItem"><div class="rigOptionsItem__name">표시할 항목이 없습니다.</div></li>`}
        </ul>
      </section>
    `;
  };

  $rigOptionsBody.innerHTML = types.map(t => col(t, groupsMap.get(t) || [])).join("");
}

// init
loadRigOptions();


/* =========================
   PORTFOLIO
========================= */
const PORTFOLIO_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTF0Fwu2o_2tG9oJByJxNcbHt67qoLSQ3qp79kGToTnX9X0kmCYKIuTlIPDRM2fNpzkuOKkgxeQtgzD/pub?gid=1162193432&single=true&output=csv";

const $slider = document.querySelector(".portfolioSlider");
const $track = document.getElementById("portfolioTrack");
const $dots = document.getElementById("portfolioDots");
const $title = document.getElementById("portfolioTitle");
const $desc = document.getElementById("portfolioDesc");
const $prev = document.querySelector(".portfolioNav--prev");
const $next = document.querySelector(".portfolioNav--next");

let portfolioItems = [];
let portfolioSlides = [];
let realCount = 0;

let cur = 1;
let isMoving = false;

function youtubeToEmbed(url) {
  const u = String(url ?? "");
  let id = "";
  const m1 = u.match(/v=([a-zA-Z0-9_-]+)/);
  const m2 = u.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (m1) id = m1[1];
  if (m2) id = m2[1];
  return id ? `https://www.youtube.com/embed/${id}` : "";
}

function youtubeId(url) {
  const u = String(url ?? "");
  const m1 = u.match(/v=([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = u.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return "";
}

function youtubeThumb(url) {
  const id = youtubeId(url);
  if (!id) return "";

  return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
}

function toRealIndex(loopIndex) {
  if (realCount <= 0) return 0;
  let r = loopIndex - 1; // 1 -> 0
  r = ((r % realCount) + realCount) % realCount;
  return r;
}

function setTrackTransition(on) {
  if (!$track) return;
  $track.style.transition = on ? "transform .45s cubic-bezier(.22,.61,.36,1)" : "none";
}

function centerTo(loopIndex, animate = true) {
  if (!$slider || !$track) return;
  const slides = portfolioSlides;
  const target = slides[loopIndex];
  if (!target) return;

  setTrackTransition(animate);

  const sliderW = $slider.clientWidth;
  const x = target.offsetLeft + (target.offsetWidth / 2) - (sliderW / 2);
  $track.style.transform = `translate3d(${-x}px, 0, 0)`;

  slides.forEach((el, i) => el.classList.toggle("is-active", i === loopIndex));

  const real = toRealIndex(loopIndex);
  document.querySelectorAll(".portfolioDot").forEach((d, i) => {
    d.classList.toggle("is-active", i === real);
  });

  const curItem = portfolioItems[real];
  if ($title) $title.textContent = curItem?.["제목"] || "";
  if ($desc) $desc.textContent = curItem?.["설명"] || "";
}

function go(delta) {
  if (isMoving || realCount <= 1) return;
  isMoving = true;
  cur += delta;
  centerTo(cur, true);
}

function onTrackTransitionEnd() {
  if (realCount <= 1) { isMoving = false; return; }

  const needJumpToLast = (cur === 0);
  const needJumpToFirst = (cur === realCount + 1);

  if (!needJumpToLast && !needJumpToFirst) {
    isMoving = false;
    return;
  }

  $slider?.classList.add("is-jump");
  setTrackTransition(false);

  requestAnimationFrame(() => {
    cur = needJumpToLast ? realCount : 1;
    centerTo(cur, false);

    requestAnimationFrame(() => {
      setTrackTransition(true);
      $slider?.classList.remove("is-jump");
      isMoving = false;
    });
  });
}

function renderPortfolio(items) {
  portfolioItems = items;
  realCount = items.length;

  if (!$track || !$dots) return;

  if (realCount === 0) {
    $track.innerHTML = "";
    $dots.innerHTML = "";
    if ($title) $title.textContent = "";
    if ($desc) $desc.textContent = "";
    return;
  }

  // dot
  $dots.innerHTML = items.map((_, i) =>
    `<div class="portfolioDot ${i === 0 ? "is-active" : ""}"></div>`
  ).join("");

  const last = items[realCount - 1];
  const first = items[0];

function normalizeUrl(raw) {
  const u = String(raw ?? "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("//")) return `https:${u}`;
  return `https://${u}`;
}

function youtubeWatchUrl(url) {
  const id = youtubeId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : normalizeUrl(url);
}

    const makeSlide = (o, isClone = false) => {
      const yurl = o["유튜브 URL"];
      const title = o["제목"] || "YouTube";
      const thumb = youtubeThumb(yurl);
      const watch = youtubeWatchUrl(yurl);

      const safeThumb = escapeHTML(thumb);
      const safeTitle = escapeHTML(title);
      const safeWatch = escapeHTML(watch);
      return `
        <div class="portfolioItem${isClone ? " is-clone" : ""}" ${isClone ? `aria-hidden="true"` : ""}>
          <a class="ytCard" href="${safeWatch}" target="_blank" rel="noopener noreferrer"
            aria-label="${safeTitle} (새 탭에서 열기)">
            <div class="ytThumb" role="img" aria-label="${safeTitle}"
                style="background-image:url('${safeThumb}')">
              <div class="ytPlay" aria-hidden="true"></div>
            </div>
          </a>
        </div>
      `;
    };


  $track.innerHTML =
    makeSlide(last, true) +
    items.map(o => makeSlide(o, false)).join("") +
    makeSlide(first, true);

  portfolioSlides = Array.from($track.querySelectorAll(".portfolioItem"));

  cur = 1;

  requestAnimationFrame(() => {
    centerTo(cur, false);
  });
}

async function loadPortfolio() {
  const csv = await fetchCSV(PORTFOLIO_CSV_URL);
  const rows = parseCSV(csv);
  const headerKeys = rows[0]?.map(normalizeKey) ?? [];

  const required = ["제목", "유튜브 URL", "설명", "순서", "표시 여부"];
  const missing = required.filter(k => !headerKeys.includes(k));
  if (missing.length) return;

  const items = rowsToObjects(rows)
    .filter(o => isVisibleFlag(o["표시 여부"]))
    .sort((a, b) => orderKey(a["순서"]) - orderKey(b["순서"]));

  renderPortfolio(items);
}

$prev?.addEventListener("click", () => go(-1));
$next?.addEventListener("click", () => go(1));

$track?.addEventListener("transitionend", (e) => {
  if (e.target !== $track) return;
  if (e.propertyName !== "transform") return;
  onTrackTransitionEnd();
});

window.addEventListener("resize", () => {
  if (!portfolioSlides.length) return;
  centerTo(cur, false);
});

// init
loadPortfolio();




/* =========================
   APPLY FORM + CALCULATOR
========================= */
const RIG_FORM_CHOICES_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTF0Fwu2o_2tG9oJByJxNcbHt67qoLSQ3qp79kGToTnX9X0kmCYKIuTlIPDRM2fNpzkuOKkgxeQtgzD/pub?gid=1012615422&single=true&output=csv";

(function initRigApplyForm() {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // --- DOM ---
  const $estimateTotal =
    document.getElementById("calc_total") ||
    document.getElementById("estimateTotal") ||
    document.getElementById("calcTotal") ||
    document.getElementById("quoteTotal");

  const $estimateLine =
    document.getElementById("calc_line") ||
    document.getElementById("estimateLine") ||
    document.getElementById("calcLine") ||
    document.getElementById("quoteLine");

  const $baseRigSelect =
    document.getElementById("f_base_rig") ||
    document.getElementById("baseRigSelect") ||
    $('[data-group="base_rig"]') ||
    $('[data-rig-group="base_rig"] select');

  const $privacySelect =
    document.getElementById("f_privacy") ||
    document.getElementById("privacySelect") ||
    $('[data-group="privacy"]') ||
    $('[data-rig-group="privacy"] select');

  const $collabWrap =
    document.getElementById("f_collab_discount") ||
    document.getElementById("collabRadios") ||
    $('[data-group="collab_discount"]') ||
    $('[data-rig-group="collab_discount"]');

  const $unitWrap = document.querySelector(".unitGrid") || document.getElementById("unitOptions");
  const $faceAnimWrap = document.getElementById("f_face_anim") || document.getElementById("faceAnimOptions");
  const $otherAddWrap = document.getElementById("f_other_add") || document.getElementById("otherAddOptions");
  const $hint = (id) => document.getElementById(id);

  // --- utils ---
  function normalizeKey(s) {
    return String(s ?? "")
      .replace(/^\uFEFF/, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  function normalizeValue(s) {
    return String(s ?? "").trim();
  }
  function isVisibleFlag(v) {
    return normalizeValue(v).toUpperCase() === "O";
  }
  function toNumber(v, fallback = 0) {
    const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : fallback;
  }
  function orderKey(v) {
    const n = toNumber(v, NaN);
    return Number.isFinite(n) ? n : 999999;
  }
  function fmtKRW(n) {
    const x = Math.round(Number(n) || 0);
    return x.toLocaleString("ko-KR");
  }
  function escapeHTML(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const n = text[i + 1];

      if (c === '"' && inQuotes && n === '"') {
        cur += '"';
        i++;
        continue;
      }
      if (c === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (c === "," && !inQuotes) {
        row.push(cur);
        cur = "";
        continue;
      }
      if ((c === "\n" || c === "\r") && !inQuotes) {
        if (c === "\r" && n === "\n") i++;
        row.push(cur);
        cur = "";
        if (row.some(v => String(v).trim() !== "")) rows.push(row);
        row = [];
        continue;
      }
      cur += c;
    }

    if (cur.length || row.length) {
      row.push(cur);
      if (row.some(v => String(v).trim() !== "")) rows.push(row);
    }
    return rows;
  }

  function rowsToObjects(rows) {
    if (!rows || rows.length < 2) return [];
    const header = rows[0].map(normalizeKey);
    return rows.slice(1).map(r => {
      const obj = {};
      header.forEach((h, idx) => {
        if (!h) return;
        obj[h] = normalizeValue(r[idx] ?? "");
      });
      return obj;
    });
  }

  async function fetchCSV(url) {
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}\n${text.slice(0, 200)}`);
    return text;
  }

  // --- state ---
  let rows = [];
  let byGroup = {};

  function groupBy(items) {
    const map = {};
    items.forEach(o => {
      const g = normalizeValue(o["그룹"]);
      if (!g) return;
      map[g] = map[g] || [];
      map[g].push(o);
    });
    Object.keys(map).forEach(k => {
      map[k] = map[k].slice().sort((a, b) => orderKey(a["순서"]) - orderKey(b["순서"]));
    });
    return map;
  }

  function setEstimate(total, line) {
    if ($estimateTotal) $estimateTotal.textContent = total === null ? "-" : `${fmtKRW(total)}원`;
    if ($estimateLine) $estimateLine.textContent = line ?? "-";
  }

  // --- renderers ---
  function renderBaseRig(items) {
    if (!$baseRigSelect || !items?.length) return;

    const $sel = $baseRigSelect.tagName === "SELECT" ? $baseRigSelect : $("select", $baseRigSelect);
    if (!$sel) return;

    $sel.innerHTML =
      `<option value="">선택</option>` +
      items
        .map(o => {
          const value = normalizeValue(o["값"]);
          const label = normalizeValue(o["라벨"]) || value;
          const price = toNumber(o["가격"], 0);
          return `<option value="${escapeHTML(value)}" data-price="${price}">${escapeHTML(label)}</option>`;
        })
        .join("");

    const firstReal = $sel.querySelector('option[value]:not([value=""])');
    if (firstReal) $sel.value = firstReal.value;

    $sel.addEventListener("change", recalc);
  }

  function renderPrivacy(items) {
    if (!$privacySelect || !items?.length) return;

    const $sel = $privacySelect.tagName === "SELECT" ? $privacySelect : $("select", $privacySelect);
    if (!$sel) return;

    $sel.innerHTML = items
      .map(o => {
        const value = normalizeValue(o["값"]);
        const label = normalizeValue(o["라벨"]) || value;
        const mult = toNumber(o["가격"], 1);
        return `<option value="${escapeHTML(value)}" data-mult="${mult}">${escapeHTML(label)}</option>`;
      })
      .join("");

    if ($sel.options.length) $sel.selectedIndex = 0;

    $sel.addEventListener("change", recalc);
  }

  function renderCollab(items) {
    if (!$collabWrap || !items?.length) return;

    const existing = $$('input[type="radio"]', $collabWrap);
    if (existing.length) {
      existing.forEach(r => {
        const found = items.find(o => normalizeValue(o["값"]).toUpperCase() === normalizeValue(r.value).toUpperCase());
        if (found) r.dataset.price = String(toNumber(found["가격"], 0));
        r.addEventListener("change", recalc);
      });
      if (!existing.some(r => r.checked)) existing[0].checked = true;
      return;
    }

    $collabWrap.innerHTML = `
      <div class="radioRow">
        ${items
          .map((o, idx) => {
            const value = normalizeValue(o["값"]);
            const label = normalizeValue(o["라벨"]) || value;
            const price = toNumber(o["가격"], 0);
            const checked = idx === 0 ? "checked" : "";
            return `
              <label class="radioItem radioPill">
                <input type="radio"
                  name="collab_discount"
                  value="${escapeHTML(value)}"
                  data-price="${price}"
                  ${checked}
                />
                <span>${escapeHTML(label)}</span>
                ${
                  price
                    ? `<span class="mini radioPill__meta">
                        ${price > 0 ? "+" : ""}${fmtKRW(price)}원
                      </span>`
                    : ""
                }
              </label>
            `;
          })
          .join("")}
      </div>
    `;
    $$('input[type="radio"]', $collabWrap).forEach(r => r.addEventListener("change", recalc));
  }

  function renderUnitGroup(groupKey, items) {
    if (!$unitWrap || !items?.length) return;

    const $sel = $(`select[data-unit-group="${groupKey}"]`, $unitWrap);
    if (!$sel) return;

    const o = items[0];
    const unitPrice = toNumber(o["가격"], 0);
    const min = Math.max(0, toNumber(o["최소"], 0));
    const max = Math.max(min, toNumber(o["최대"], min));

    $sel.dataset.unitGroup = groupKey;
    $sel.dataset.unitPrice = String(unitPrice);

    $sel.innerHTML = Array.from({ length: max - min + 1 }, (_, i) => min + i)
      .map(v => `<option value="${v}">${v}개</option>`)
      .join("");

    $sel.value = String(min);
    $sel.addEventListener("change", recalc);

    const hintEl = $hint(`hint_${groupKey}`);
    if (hintEl) {
      hintEl.textContent = unitPrice ? `개당 +${fmtKRW(unitPrice)}원` : "";
    }
  }

  function renderCheckGroup(groupKey, items, wrapEl) {
    if (!wrapEl || !items?.length) return;

    const isGridItself = wrapEl.classList?.contains("checkGrid");
    const $grid = isGridItself ? wrapEl : wrapEl.querySelector(".checkGrid") || wrapEl;
    const existing = $$('input[type="checkbox"]', $grid);
    if (existing.length) {
      existing.forEach(chk => {
        const found = items.find(o => normalizeValue(o["값"]) === normalizeValue(chk.value));
        if (found) chk.dataset.price = String(toNumber(found["가격"], 0));
        chk.dataset.group = groupKey;
        chk.addEventListener("change", recalc);
      });
      return;
    }

    $grid.innerHTML = items
      .map(o => {
        const value = normalizeValue(o["값"]);
        const label = normalizeValue(o["라벨"]) || value;
        const price = toNumber(o["가격"], 0);
        return `
          <label class="checkItem checkPill">
            <input type="checkbox"
              value="${escapeHTML(value)}"
              data-price="${price}"
              data-group="${escapeHTML(groupKey)}"
            />
            <span>${escapeHTML(label)}</span>
            ${
              price
                ? `<span class="mini checkPill__meta">
                    ${price > 0 ? "+" : ""}${fmtKRW(price)}원
                  </span>`
                : ""
            }
          </label>
        `;
      })
      .join("");

    $$('input[type="checkbox"]', $grid).forEach(chk => chk.addEventListener("change", recalc));
  }

  // --- getters (calc) ---
  function getBaseRig() {
    const $sel = $baseRigSelect?.tagName === "SELECT" ? $baseRigSelect : $("select", $baseRigSelect);
    if (!$sel) return { label: "", price: 0 };

    const opt = $sel.selectedOptions?.[0];
    if (!opt || !opt.value) return { label: "", price: 0 };

    return {
      label: opt.textContent?.trim() || "기본 리깅",
      price: toNumber(opt.dataset.price, 0),
    };
  }

  function getPrivacyMult() {
    const $sel = $privacySelect?.tagName === "SELECT" ? $privacySelect : $("select", $privacySelect);
    if (!$sel) return { label: "", mult: 1 };

    const opt = $sel.selectedOptions?.[0];
    if (!opt) return { label: "", mult: 1 };

    const mult = toNumber(opt.dataset.mult, 1) || 1;
    const label = opt.textContent?.trim() || "";
    return { label, mult };
  }

  function getCollab() {
    if (!$collabWrap) return { label: "", price: 0 };

    const checked =
      $('input[type="radio"][name="collab_discount"]:checked', $collabWrap) ||
      $('input[type="radio"]:checked', $collabWrap);

    if (!checked) return { label: "", price: 0 };

    const price = toNumber(checked.dataset.price, 0);
    const v = normalizeValue(checked.value).toUpperCase();
    // Label policy: keep neat
    if (v === "YES") return { label: "협업 할인", price };
    return { label: "협업(해당 없음)", price: 0 };
  }

  function getUnits() {
    if (!$unitWrap) return [];
    const selects = $$('select[data-unit-group]', $unitWrap);

    return selects
      .map($sel => {
        const group = $sel.dataset.unitGroup || "";
        const unitPrice = toNumber($sel.dataset.unitPrice, 0);
        const count = toNumber($sel.value, 0);
        const label =
          $sel.closest(".fRow")?.querySelector(".fLabel")?.textContent?.trim() ||
          group;

        return {
          group,
          label: label.replace(/\(.*?\)\s*$/, "").trim(),
          count,
          unitPrice,
          sum: count * unitPrice,
        };
      })
      .filter(x => x.group);
  }

  function getChecks(groupKey, wrapEl) {
    if (!wrapEl) return { count: 0, sum: 0 };

    const root = wrapEl.classList?.contains("checkGrid") ? wrapEl : wrapEl.querySelector(".checkGrid") || wrapEl;
    const inputs = $$(`input[type="checkbox"][data-group="${groupKey}"]`, root);

    let count = 0;
    let sum = 0;
    inputs.forEach(chk => {
      if (!chk.checked) return;
      count++;
      sum += toNumber(chk.dataset.price, 0);
    });
    return { count, sum };
  }

  function recalc() {
    const parts = [];

    // 1) base
    const base = getBaseRig();
    let subtotal = 0;
    if (base.price) {
      subtotal += base.price;
      parts.push(`${base.label}(${fmtKRW(base.price)}원)`);
    }

    // 2) unit groups
    const units = getUnits();
    units.forEach(u => {
      if (!u.count) return;
      subtotal += u.sum;
      parts.push(`${u.label} ${u.count}개(${fmtKRW(u.sum)}원)`);
    });

    // 3) multi checks
    const face = getChecks("face_anim", $faceAnimWrap);
    if (face.count) {
      subtotal += face.sum;
      parts.push(`표정 애니메이션 ${face.count}개(${fmtKRW(face.sum)}원)`);
    }

    const other = getChecks("other_add", $otherAddWrap);
    if (other.count) {
      subtotal += other.sum;
      parts.push(`그 외 추가 ${other.count}개(${fmtKRW(other.sum)}원)`);
    }

    // 4) collab
    const collab = getCollab();
    if (collab.price) {
      subtotal += collab.price;
      parts.push(`협업 할인(${collab.price > 0 ? "+" : ""}${fmtKRW(collab.price)}원)`);
    }

    // 5) privacy multiplier
    const privacy = getPrivacyMult();
    let total = subtotal;
    if (privacy.mult && privacy.mult !== 1) {
      total = Math.round(subtotal * privacy.mult);
      const added = total - subtotal;
      parts.push(`${privacy.label}(+${fmtKRW(added)}원)`);
    }

    if (!parts.length) {
      setEstimate(0, "선택된 옵션이 없습니다.");
      return;
    }

    setEstimate(total, parts.join(" + "));
  }

  // --- load + init ---
  async function loadAndRender() {
    const csv = await fetchCSV(RIG_FORM_CHOICES_CSV_URL);
    const parsed = parseCSV(csv);
    const headerKeys = parsed[0]?.map(normalizeKey) ?? [];

    const required = ["그룹", "값", "라벨", "가격", "방식", "최소", "최대", "순서", "표시 여부"];
    const missing = required.filter(k => !headerKeys.includes(k));
    if (missing.length) {
      console.warn("[rig_form_choices] missing headers:", missing, headerKeys);
      throw new Error("시트 헤더(컬럼명)가 예상과 달라서 렌더를 중단했습니다.");
    }

    rows = rowsToObjects(parsed).filter(o => isVisibleFlag(o["표시 여부"]));
    byGroup = groupBy(rows);

    if (byGroup.base_rig) renderBaseRig(byGroup.base_rig);

    ["add_costume", "add_hair", "add_pose"].forEach(g => {
      if (byGroup[g]) renderUnitGroup(g, byGroup[g]);
    });

    if (byGroup.face_anim) renderCheckGroup("face_anim", byGroup.face_anim, $faceAnimWrap);
    if (byGroup.other_add) renderCheckGroup("other_add", byGroup.other_add, $otherAddWrap);

    if (byGroup.collab_discount) renderCollab(byGroup.collab_discount);
    if (byGroup.privacy) renderPrivacy(byGroup.privacy);

    recalc();
  }

  (async () => {
    try {
      const hasAny =
        $estimateTotal ||
        $estimateLine ||
        $baseRigSelect ||
        $privacySelect ||
        $collabWrap ||
        $unitWrap ||
        $faceAnimWrap ||
        $otherAddWrap;

      if (!hasAny) return;

      await loadAndRender();
    } catch (err) {
      console.error(err);
      const msg =
        String(err?.message || "").includes("HTTP") || String(err).includes("Failed to fetch")
          ? "견적 계산 로드 실패: 시트 공개 설정/CSV 링크를 확인해주세요."
          : "견적 계산 로드 실패: 시트 형식(컬럼명) 또는 폼 구조를 확인해주세요.";

      setEstimate(null, msg);
    }
  })();
})();


/* =========================
   APPLY FORM ACTIONS
========================= */
(function initApplyActions() {
  const $form = document.getElementById("applyForm");
  const $btnCopy = document.getElementById("btnCopyForm");
  const $btnReset = document.getElementById("btnResetForm");
  const $total = document.getElementById("calc_total");
  const $line = document.getElementById("calc_line");

  if (!$form) return;

  function copyForm() {
    const bullet = (k, v) => `＊ ${k}: ${v}`;
    const stripNum = (label) =>
      String(label || "").replace(/^\s*\d+\s*\.\s*/, "").trim();

    const getRowLabel = (el) =>
      el.closest(".fRow")?.querySelector(".fLabel")?.textContent?.trim() || "";

    const findTextInputByLabel = (includesText) => {
      const inputs = Array.from(document.querySelectorAll("#applyForm input[type='text']"));
      return inputs.find((el) => stripNum(getRowLabel(el)).includes(includesText)) || null;
    };

    const getSelectTextById = (id) => {
      const el = document.getElementById(id);
      if (!el) return "";
      const opt = el.selectedOptions?.[0];
      return (opt?.textContent || el.value || "").trim();
    };

    const getSelectNumberById = (id) => {
      const el = document.getElementById(id);
      if (!el) return 0;
      const n = Number(String(el.value || "").trim());
      return Number.isFinite(n) ? n : 0;
    };

    const getTextareaById = (id) =>
      document.getElementById(id)?.value?.trim() || "";

    const pickOptionName = (inputEl) => {
      const label = inputEl.closest("label");
      if (!label) return "";
      const span = label.querySelector("span"); // 옵션명
      if (span?.textContent?.trim()) return span.textContent.trim();
      return String(label.innerText || "").split("\n")[0].trim();
    };

    const lines = [];

    const platformEl = findTextInputByLabel("방송 플랫폼");
    const platform = platformEl?.value?.trim() || "";
    if (platform) lines.push(bullet("방송 플랫폼", platform));

    const nickEl = findTextInputByLabel("방송 활동 닉네임");
    const nick = nickEl?.value?.trim() || "";
    if (nick) lines.push(bullet("방송 활동 닉네임", nick));

    const baseRig = getSelectTextById("f_base_rig");
    if (baseRig) lines.push(bullet("리깅 옵션", baseRig));

    const costume = getSelectNumberById("f_add_costume_qty");
    if (costume > 0) lines.push(bullet("의상 추가 (개당)", `${costume}개`));

    const hair = getSelectNumberById("f_add_hair_qty");
    if (hair > 0) lines.push(bullet("헤어 추가 (개당)", `${hair}개`));

    const pose = getSelectNumberById("f_add_pose_qty");
    if (pose > 0) lines.push(bullet("포즈 추가 (개당)", `${pose}개`));

    const faceList = getTextareaById("f_face_list");
    if (faceList) lines.push(bullet("표정 종류", faceList.replace(/\s*\n\s*/g, " / ")));

    const checkedChecks = document.querySelectorAll("#applyForm input[type='checkbox']:checked");
    if (checkedChecks.length) {
      const names = Array.from(checkedChecks).map(pickOptionName).filter(Boolean);
      if (names.length) lines.push(bullet("추가 옵션", names.join(", ")));
    }

    const collabChecked = document.querySelector('#f_collab_discount input[type="radio"]:checked');
    if (collabChecked) {
      const v = String(collabChecked.value || "").toUpperCase();
      lines.push(bullet("협업 작가", v === "YES" ? "YES" : "NO"));
    }

    const illustrator = getTextareaById("f_illustrator");
    if (illustrator) lines.push(bullet("일러스트레이터", illustrator.replace(/\s*\n\s*/g, " / ")));

    const memo = getTextareaById("f_memo");
    if (memo) lines.push(bullet("추가 설명", memo.replace(/\s*\n\s*/g, " / ")));

    const totalText = document.getElementById("calc_total")?.textContent?.trim() || "";
    if (totalText && totalText !== "-") lines.push(bullet("예상 견적가", totalText));

    const result = lines.join("\n");

    if (!navigator.clipboard?.writeText) {
      window.prompt("아래 내용을 복사하세요:", result);
      return;
    }

    navigator.clipboard.writeText(result).then(
      () => alert("신청 양식이 복사되었습니다!"),
      () => window.prompt("클립보드 복사가 차단되어 직접 복사해 주세요:", result)
    );
  }

  function resetForm() {
    if (!confirm("입력한 내용을 모두 초기화할까요?")) return;
    $form.querySelectorAll("input[type='text']").forEach((el) => {
      el.value = "";
    });
    $form.querySelectorAll("textarea").forEach((el) => {
      el.value = "";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    $form.querySelectorAll("select").forEach((el) => {
      el.selectedIndex = 0;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    $form.querySelectorAll("input[type='checkbox'], input[type='radio']").forEach((el) => {
      el.checked = false;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });

    if ($total) $total.textContent = "-";
    if ($line) $line.textContent = "선택된 옵션이 없습니다.";

    if (typeof window.recalc === "function") {
      window.recalc();
    }
  }

  if ($btnCopy) $btnCopy.addEventListener("click", copyForm);
  if ($btnReset) $btnReset.addEventListener("click", resetForm);
})();