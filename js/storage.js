// /js/storage.js
// --------------------
// 共通：データ管理（localStorage）
// --------------------

export const STORAGE_KEYS = {
  COMPANIES: "jobapp_companies",
  EVENTS: "jobapp_events",
};

// イベント色の候補
export const EVENT_COLORS = ["blue", "green", "orange", "purple", "gray"];

export function loadData() {
  let companies = [];
  let events = [];
  try {
    const c = localStorage.getItem(STORAGE_KEYS.COMPANIES);
    const e = localStorage.getItem(STORAGE_KEYS.EVENTS);
    companies = c ? JSON.parse(c) : [];
    events = e ? JSON.parse(e) : [];
  } catch (err) {
    console.error("Failed to load data", err);
    companies = [];
    events = [];
  }

  // 旧データ互換（colorが無いイベントにデフォルト付与）
  events.forEach((ev) => {
    if (!ev.color || !EVENT_COLORS.includes(ev.color)) ev.color = "blue";
  });

  // 旧データ互換（company.nextScheduleが古い/無い場合に再計算できるように）
  companies.forEach((c) => {
    if (!c || typeof c !== "object") return;
    if (!Array.isArray(c.esItems)) c.esItems = [];
    if (!Array.isArray(c.comments)) c.comments = [];
    if (!Array.isArray(c.interviews)) c.interviews = [];
    if (!Array.isArray(c.questions)) c.questions = [];
    if (typeof c.loginId !== "string") c.loginId = c.loginId ? String(c.loginId) : "";
    if (typeof c.password !== "string") c.password = c.password ? String(c.password) : "";
    if (typeof c.deadline !== "string") c.deadline = c.deadline ? String(c.deadline) : "";

  });

  return { companies, events };
}

export function saveData(companies, events) {
  localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(companies));
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
}

// --------------------
// 互換：他ファイルが loadAll/saveAll を import しているのでエイリアスを用意
// --------------------
export function loadAll() {
  return loadData();
}

export function saveAll(companies, events) {
  return saveData(companies, events);
}

// --------------------
// 共通：イベント操作
// --------------------
export function parseEventDate(ev) {
  if (!ev || !ev.date) return null;
  const t = ev.time || "00:00";
  const d = new Date(`${ev.date}T${t}`);
  return isNaN(d.getTime()) ? null : d;
}

export function compareEventByDate(a, b) {
  const da = parseEventDate(a);
  const db = parseEventDate(b);
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return da - db;
}

// companyId と events の引数順がファイルによって揺れていたため、両対応にする。
// 期待: getCompanyEvents(eventsArray, companyId)
// 互換: getCompanyEvents(companyId, eventsArray)
export function getCompanyEvents(a, b) {
  let events;
  let companyId;

  if (Array.isArray(a)) {
    events = a;
    companyId = b;
  } else if (Array.isArray(b)) {
    events = b;
    companyId = a;
  } else {
    events = [];
    companyId = a;
  }

  return events.filter((ev) => ev.companyId === companyId);
}

// 次の予定を company.nextSchedule に入れる
// 互換：各ページからは recomputeNextSchedule(company, events) で呼ばれる想定
export function recomputeNextSchedule(company, events) {
  const companyEvents = getCompanyEvents(events, company.id);
  if (!companyEvents.length) {
    company.nextSchedule = null;
    return;
  }

  const sorted = companyEvents.slice().sort(compareEventByDate);
  const now = new Date();
  let candidate = null;

  for (const ev of sorted) {
    const d = parseEventDate(ev);
    if (d && d >= now) {
      candidate = ev;
      break;
    }
  }

  if (!candidate) candidate = sorted[0];

  company.nextSchedule = {
    eventId: candidate.id,
    date: candidate.date,
    time: candidate.time,
    label: candidate.label || "",
    color: candidate.color || "blue",
  };
}

// 全社分まとめてnextScheduleを正規化
export function recomputeAllNextSchedules(companies, events) {
  companies.forEach((c) => recomputeNextSchedule(c, events));
}

// 安全なID生成
export function makeId() {
  return Date.now().toString() + Math.random().toString(16).slice(2);
}
