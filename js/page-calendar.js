// /js/page-calendar.js
import { requireLoginOrRedirect } from "./auth.js";
import { loadAll, saveAll } from "./storage.js";
import { showToast } from "./ui-toast.js";
import { qs, getParam } from "./utils.js";
import { recomputeNextSchedule } from "./events.js";

// ログイン必須
requireLoginOrRedirect();

// DOM
const calendarLabelEl = qs("#calendar-label");
const calendarBodyEl = qs("#calendar-body");
const calendarPrevBtn = qs("#calendar-prev");
const calendarNextBtn = qs("#calendar-next");

const eventForm = qs("#event-form");
const eventDateInput = qs("#event-date");
const eventTimeInput = qs("#event-time");
const eventCompanySelect = qs("#event-company");
const eventTitleInput = qs("#event-title");
const eventColorSelect = qs("#event-color");

// data
let { companies, events } = loadAll();

// ---- month state ----
// URLで month を固定できるように（崩れない）
const yParam = getParam("y");
const mParam = getParam("m"); // 1-12 想定
let currentMonth;

if (yParam && mParam) {
  const y = Number(yParam);
  const m = Number(mParam);
  currentMonth = new Date(y, Math.max(0, m - 1), 1);
} else {
  currentMonth = new Date();
  currentMonth.setDate(1);
}

// -----------------------------
// utils
// -----------------------------
function formatDate(year, month, day) {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function updateMonthInUrl() {
  const y = currentMonth.getFullYear();
  const m = currentMonth.getMonth() + 1;
  const url = new URL(location.href);
  url.searchParams.set("y", String(y));
  url.searchParams.set("m", String(m));
  history.replaceState(null, "", url.toString());
}

function renderCompanyOptions() {
  eventCompanySelect.innerHTML = "";

  if (!companies.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "企業が登録されていません";
    eventCompanySelect.appendChild(opt);
    eventCompanySelect.disabled = true;
    return;
  }

  eventCompanySelect.disabled = false;

  companies.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    eventCompanySelect.appendChild(opt);
  });
}

function getCompanyById(id) {
  return companies.find((c) => c.id === id) || null;
}

/**
 * 既存データ救済用：
 * ev.title に「企業名 + 内容」が入っている古い形式でも、
 * 表示で企業名が2回にならないように content だけ抽出する。
 */
function normalizeEventContent(ev, companyName) {
  const name = (companyName || "").trim();
  let content = (ev.label || "").trim();

  if (!content) {
    content = (ev.title || "").trim();
  }

  // 先頭に企業名が入っていたら除去（例: "ABC商事 一次面接"）
  if (name && content.startsWith(name)) {
    content = content.slice(name.length).trim();
  }
  // 企業名の後ろに区切りが入っているケースも一応吸収
  if (name && (content.startsWith("：") || content.startsWith(":") || content.startsWith("-"))) {
    content = content.slice(1).trim();
  }

  return content;
}

function deleteEvent(eventId) {
  const idx = events.findIndex((ev) => ev.id === eventId);
  if (idx === -1) return;

  const ev = events[idx];
  events.splice(idx, 1);

  const company = getCompanyById(ev.companyId);
  if (company) recomputeNextSchedule(company, events);

  saveAll(companies, events);
  renderCalendar();
  showToast("予定を削除しました");
}

// -----------------------------
// calendar render
// -----------------------------
function renderCalendar() {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth(); // 0-11

  updateMonthInUrl();
  calendarLabelEl.textContent = `${year}年 ${month + 1}月`;
  calendarBodyEl.innerHTML = "";

  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay(); // 0:日〜6:土
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let date = 1 - firstWeekday;

  for (let week = 0; week < 6; week++) {
    const tr = document.createElement("tr");

    for (let weekday = 0; weekday < 7; weekday++) {
      const td = document.createElement("td");

      if (date < 1 || date > daysInMonth) {
        td.innerHTML = "&nbsp;";
      } else {
        const dayNumberDiv = document.createElement("div");
        dayNumberDiv.className = "calendar-day-number";
        dayNumberDiv.textContent = date;

        const eventsDiv = document.createElement("div");
        eventsDiv.className = "calendar-events";

        const dateStr = formatDate(year, month + 1, date);

        // 当日のイベント
        const todaysEvents = events
          .filter((ev) => ev.date === dateStr)
          .slice()
          .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));

        todaysEvents.forEach((ev) => {
          const evDiv = document.createElement("div");
          evDiv.className = "calendar-event";
          evDiv.dataset.color = ev.color || "blue";

          // クリックで企業詳細へ（eventIdでハイライト）
          evDiv.addEventListener("click", (e) => {
            e.stopPropagation();
            const url = new URL("detail.html", location.href);
            url.searchParams.set("companyId", ev.companyId);
            url.searchParams.set("eventId", ev.id);
            url.searchParams.set("tab", "info");
            location.href = url.toString();
          });

          const timeText = ev.time ? `${ev.time} ` : "";

          const company = getCompanyById(ev.companyId);
          const companyName = (company?.name || "").trim();

          // ✅ 内容はあれば表示。古い title 形式でも二重にならないように整形。
          const content = normalizeEventContent(ev, companyName);

          const textSpan = document.createElement("span");
          // ✅ 企業名は常に表示、内容はあれば表示
          textSpan.textContent = `${timeText}${companyName}${content ? " " + content : ""}`;

          // 削除ボタン（クリック伝播停止）
          const delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.className = "calendar-event-del";
          delBtn.textContent = "×";
          delBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (confirm("この予定を削除しますか？")) {
              deleteEvent(ev.id);
            }
          });

          evDiv.appendChild(textSpan);
          evDiv.appendChild(delBtn);
          eventsDiv.appendChild(evDiv);
        });

        td.appendChild(dayNumberDiv);
        td.appendChild(eventsDiv);
      }

      tr.appendChild(td);
      date++;
    }

    calendarBodyEl.appendChild(tr);
  }
}

// -----------------------------
// month nav
// -----------------------------
calendarPrevBtn.addEventListener("click", () => {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  currentMonth.setDate(1);
  renderCalendar();
});

calendarNextBtn.addEventListener("click", () => {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  currentMonth.setDate(1);
  renderCalendar();
});

// -----------------------------
// add event
// -----------------------------
eventForm.addEventListener("submit", (e) => {
  e.preventDefault();

  if (!companies.length) {
    alert("先に企業を登録してください。");
    return;
  }

  const date = eventDateInput.value;
  const time = eventTimeInput.value;
  const companyId = eventCompanySelect.value;
  const label = eventTitleInput.value.trim();
  const color = eventColorSelect.value || "blue";

  // ✅ 内容は任意。日付・企業だけ必須
  if (!date || !companyId) {
    alert("日付・企業は必須です。");
    return;
  }

  const company = getCompanyById(companyId);
  const eventId = Date.now().toString() + Math.random().toString(16).slice(2);

  const eventObj = {
    id: eventId,
    companyId,
    date,
    time,
    // ✅ 今後二重にならないよう「会社名を入れない」
    label: label || "",
    title: label || "",
    color,
  };

  events.push(eventObj);

  if (company) recomputeNextSchedule(company, events);

  saveAll(companies, events);

  eventForm.reset();
  if (eventColorSelect) eventColorSelect.value = "blue";

  renderCalendar();
  showToast("予定追加しました");
});

// -----------------------------
// init / refresh
// -----------------------------
function init() {
  // nextSchedule 再計算（古いデータも崩れない）
  companies.forEach((c) => recomputeNextSchedule(c, events));
  saveAll(companies, events);

  renderCompanyOptions();
  renderCalendar();
}

function refreshFromStorageAndRender() {
  ({ companies, events } = loadAll());
  companies.forEach((c) => recomputeNextSchedule(c, events));
  saveAll(companies, events);

  renderCompanyOptions();
  renderCalendar();
}

// BFCache対策：ページが表示された時に毎回同期
window.addEventListener("pageshow", () => {
  refreshFromStorageAndRender();
});

// タブ切り替え（別タブから戻った時）も念のため
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshFromStorageAndRender();
  }
});

init();
