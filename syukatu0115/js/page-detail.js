// /js/page-detail.js
import { requireLoginOrRedirect } from "./auth.js";
import { loadAll, saveAll } from "./storage.js";
import { showToast } from "./ui-toast.js";
import { qs, qsa, getParam, escapeHtml } from "./utils.js";
import {
  parseEventDate,
  compareEventByDate,
  getCompanyEvents,
  recomputeNextSchedule,
} from "./events.js";

// ログイン必須
requireLoginOrRedirect();

// URL params
const companyId = getParam("companyId");
const highlightEventId = getParam("eventId"); // カレンダーから飛ぶ時に使う
const initialTab = getParam("tab"); // 任意: ?tab=es など

// DOM
const backToListBtn = qs("#back-to-list");
const detailCompanyNameEl = qs("#detail-company-name");
const openMypageLink = qs("#detail-open-mypage");

const tabButtons = qsa(".tab-button");
const tabContents = qsa(".tab-content");

// forms
const infoForm = qs("#detail-info-form");
const esForm = qs("#detail-es-form");
const interviewForm = qs("#detail-interview-form");
const commentForm = qs("#detail-comment-form");

// inputs (info)
const detailJobTypeInput = qs("#detail-job-type");
const detailStatusSelect = qs("#detail-status");
const detailHolidaysInput = qs("#detail-holidays");
const detailMemoInput = qs("#detail-memo");

// ✅ Phase A: 追加項目（企業名/URL/ログインID/PW）
const detailCompanyNameInput = qs("#detail-company-name-input");
const detailMypageUrlInput = qs("#detail-mypage-url");
const detailLoginIdInput = qs("#detail-login-id");
const detailPasswordInput = qs("#detail-password");

// ✅ Phase A: 逆質問リスト
const questionInput = qs("#question-input");
const addQuestionBtn = qs("#add-question");
const questionListEl = qs("#question-list");

const detailDeadlineInput = qs("#detail-deadline");
const deadlineCountdownEl = qs("#deadline-countdown");


// company events
const companyEventsContainer = qs("#company-events-container");
const addCompanyEventBtn = qs("#add-company-event");

// ES
const esItemsContainer = qs("#es-items-container");
const addEsItemBtn = qs("#add-es-item");

// interview
const interviewItemsContainer = qs("#interview-items-container");
const addInterviewItemBtn = qs("#add-interview-item");

// comment
const commentInput = qs("#comment-input");
const commentListEl = qs("#comment-list");

// data
let { companies, events } = loadAll();
let company = companies.find((c) => c.id === companyId);

// guard
if (!companyId || !company) {
  // 不正アクセスは list へ
  location.href = "list.html";
}

// -----------------------------
// helpers: safe defaults（旧データ互換）
// -----------------------------
function ensureCompanyDefaults() {
  if (typeof company.name !== "string") company.name = company.name ? String(company.name) : "";
  if (typeof company.url !== "string") company.url = company.url ? String(company.url) : "";

  if (typeof company.loginId !== "string") company.loginId = company.loginId ? String(company.loginId) : "";
  if (typeof company.password !== "string") company.password = company.password ? String(company.password) : "";

  if (!Array.isArray(company.questions)) company.questions = [];
  if (!Array.isArray(company.comments)) company.comments = [];
  if (!company.ratings || typeof company.ratings !== "object") company.ratings = {};
  ["motivation", "salary", "holidays", "culture"].forEach((k) => {
    const v = Number(company.ratings[k] ?? 0);
    company.ratings[k] = Number.isFinite(v) ? Math.max(0, Math.min(5, v)) : 0;
  });

}
ensureCompanyDefaults();

// -----------------------------
// Tabs
// -----------------------------
function setActiveTab(name) {
  tabButtons.forEach((btn) => {
    const isActive = btn.dataset.tab === name;
    btn.classList.toggle("active", isActive);
  });
  tabContents.forEach((content) => {
    const isActive = content.id === `tab-${name}`;
    content.classList.toggle("active", isActive);
  });
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    setActiveTab(btn.dataset.tab);
  });
});

// -----------------------------
// Header (view)
// -----------------------------
function renderHeader() {
  detailCompanyNameEl.textContent = company.name || "企業";

  if (company.url && company.url.trim()) {
    openMypageLink.href = company.url.trim();
    openMypageLink.style.display = "inline-block";
  } else {
    openMypageLink.style.display = "none";
  }
}
renderHeader();

function calcDaysLeft(dateStr) {
  if (!dateStr) return null;

  // dateStr: "YYYY-MM-DD"
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;

  // その日の終わり(23:59:59)を締切とみなす
  const deadline = new Date(y, m - 1, d, 23, 59, 59, 999);
  const now = new Date();

  const diffMs = deadline.getTime() - now.getTime();
  const days = Math.ceil(diffMs / 86400000); // 1日ms
  return days;
}

function renderDeadlineCountdown() {
  if (!deadlineCountdownEl) return;

  const dl = company.deadline || "";
  if (!dl) {
    deadlineCountdownEl.textContent = "締切：未設定";
    return;
  }

  const daysLeft = calcDaysLeft(dl);
  if (daysLeft === null) {
    deadlineCountdownEl.textContent = "締切：形式が不正";
    return;
  }

  if (daysLeft > 0) deadlineCountdownEl.textContent = `締切：あと ${daysLeft} 日（${dl}）`;
  else if (daysLeft === 0) deadlineCountdownEl.textContent = `締切：今日（${dl}）`;
  else deadlineCountdownEl.textContent = `締切：締切済（${dl} / ${Math.abs(daysLeft)}日経過）`;
}


// -----------------------------
// Phase A: 企業情報フォームへ初期値反映
// -----------------------------
function fillCompanyExtraInputs() {
  if (detailCompanyNameInput) detailCompanyNameInput.value = company.name || "";
  if (detailMypageUrlInput) detailMypageUrlInput.value = company.url || "";
  if (detailLoginIdInput) detailLoginIdInput.value = company.loginId || "";
  if (detailPasswordInput) detailPasswordInput.value = company.password || "";
}
fillCompanyExtraInputs();

// -----------------------------
// Phase A: 逆質問（chips）
// -----------------------------
function renderQuestions() {
  if (!questionListEl) return;
  if (!Array.isArray(company.questions)) company.questions = [];

  questionListEl.innerHTML = "";

  if (!company.questions.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "まだ逆質問がありません。";
    questionListEl.appendChild(p);
    return;
  }

  company.questions.forEach((q, idx) => {
    const chip = document.createElement("div");
    chip.className = "chip";

    const text = document.createElement("span");
    text.textContent = q;

    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "×";
    del.addEventListener("click", () => {
      company.questions.splice(idx, 1);
      renderQuestions();
    });

    chip.appendChild(text);
    chip.appendChild(del);
    questionListEl.appendChild(chip);
  });
}

if (addQuestionBtn) {
  addQuestionBtn.addEventListener("click", () => {
    const v = (questionInput?.value || "").trim();
    if (!v) return;
    if (!Array.isArray(company.questions)) company.questions = [];
    company.questions.push(v);
    if (questionInput) questionInput.value = "";
    renderQuestions();
  });
}

if (questionInput) {
  questionInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addQuestionBtn?.click();
    }
  });
}

renderQuestions();

function renderRatingStars(container, value, onChange) {
  container.innerHTML = "";
  const v = Number(value || 0);

  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "★";
    if (i <= v) btn.classList.add("on");

    btn.addEventListener("click", () => {
      onChange(i);
    });

    container.appendChild(btn);
  }
}

function renderAllRatings() {
  const nodes = qsa(".rating-stars");
  nodes.forEach((el) => {
    const key = el.dataset.ratingKey;
    if (!key) return;

    const current = Number(company.ratings?.[key] || 0);

    renderRatingStars(el, current, (newVal) => {
      if (!company.ratings || typeof company.ratings !== "object") company.ratings = {};
      company.ratings[key] = newVal;
      // UIを即更新
      renderAllRatings();
    });
  });
}


// -----------------------------
// Company events UI
// -----------------------------
function colorOptionsHtml(selected) {
  const items = [
    ["blue", "青"],
    ["green", "緑"],
    ["orange", "オレンジ"],
    ["purple", "紫"],
    ["gray", "グレー"],
  ];
  return items
    .map(([v, label]) => {
      const sel = v === (selected || "blue") ? "selected" : "";
      return `<option value="${v}" ${sel}>${label}</option>`;
    })
    .join("");
}

function createCompanyEventRow(ev = null) {
  const wrapper = document.createElement("div");
  wrapper.className = "company-event-row";
  if (ev?.id) wrapper.dataset.eventId = ev.id;

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.className = "company-event-date";
  dateInput.value = ev?.date || "";

  const timeInput = document.createElement("input");
  timeInput.type = "time";
  timeInput.className = "company-event-time";
  timeInput.value = ev?.time || "";

  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.className = "company-event-label";
  labelInput.placeholder = "説明会 / 一次面接 など";
  labelInput.value = ev?.label || "";

  // 色
  const colorSelect = document.createElement("select");
  colorSelect.className = "company-event-color";
  colorSelect.innerHTML = colorOptionsHtml(ev?.color || "blue");

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.textContent = "削除";
  deleteBtn.className = "company-event-delete";
  deleteBtn.addEventListener("click", () => {
    wrapper.remove(); // 実削除は保存時に events 反映
  });

  wrapper.appendChild(dateInput);
  wrapper.appendChild(timeInput);
  wrapper.appendChild(labelInput);
  wrapper.appendChild(colorSelect);
  wrapper.appendChild(deleteBtn);

  return wrapper;
}

function renderCompanyEvents() {
  if (!companyEventsContainer) return;

  companyEventsContainer.innerHTML = "";

  const list = getCompanyEvents(events, company.id).slice().sort(compareEventByDate);

  if (!list.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "まだ予定が登録されていません。";
    companyEventsContainer.appendChild(p);
    return;
  }

  list.forEach((ev) => {
    const row = createCompanyEventRow(ev);
    companyEventsContainer.appendChild(row);
  });
}

if (addCompanyEventBtn) {
  addCompanyEventBtn.addEventListener("click", () => {
    const emptyMsg = companyEventsContainer?.querySelector(".muted");
    if (emptyMsg) emptyMsg.remove();
    companyEventsContainer.appendChild(createCompanyEventRow(null));
  });
}

// -----------------------------
// Save info + events sync
// -----------------------------
if (infoForm) {
  infoForm.addEventListener("submit", (e) => {
    e.preventDefault();
    try {
      // ✅ Phase A: 企業名/URL/ID/PW 更新
      const newName = (detailCompanyNameInput?.value || "").trim();
      const newUrl = (detailMypageUrlInput?.value || "").trim();

      if (newName) company.name = newName;
      company.url = newUrl;
      company.loginId = (detailLoginIdInput?.value || "").trim();
      company.password = detailPasswordInput?.value || "";

      // update company core
      company.jobType = (detailJobTypeInput?.value || "").trim();
      company.status = detailStatusSelect?.value || "";
      company.holidays = (detailHolidaysInput?.value || "").trim();
      company.memo = (detailMemoInput?.value || "").trim();
      company.deadline = detailDeadlineInput?.value || "";
      renderDeadlineCountdown();

      // sync events for this company (row UI -> events[])
      const before = getCompanyEvents(events, company.id);
      const beforeIds = new Set(before.map((x) => x.id));
      const usedIds = new Set();

      const rows = companyEventsContainer
        ? companyEventsContainer.querySelectorAll(".company-event-row")
        : [];

      rows.forEach((row) => {
        const eventId = row.dataset.eventId || null;
        const date = row.querySelector(".company-event-date")?.value || "";
        const time = row.querySelector(".company-event-time")?.value || "";
        const label = (row.querySelector(".company-event-label")?.value || "").trim();
        const color = row.querySelector(".company-event-color")?.value || "blue";

        const hasInput = date || time || label;
        if (!hasInput) return; // 空行は無視

        if (eventId) {
          const ev = events.find((x) => x.id === eventId);
          if (ev) {
            ev.date = date || ev.date;
            ev.time = time || ev.time;
            ev.label = label || ev.label;
            ev.color = color || ev.color || "blue";
            // ✅ 会社名が変わってもタイトルが追従するように
            ev.title = `${company.name} ${ev.label || "予定"}`;
            usedIds.add(ev.id);
          }
        } else {
          const newId = Date.now().toString() + Math.random().toString(16).slice(2);
          const ev = {
            id: newId,
            companyId: company.id,
            date,
            time,
            label,
            title: `${company.name} ${label || "予定"}`,
            color,
          };
          events.push(ev);
          row.dataset.eventId = newId;
          usedIds.add(newId);
        }
      });

      // remove deleted events (rowから消えたやつ)
      beforeIds.forEach((id) => {
        if (!usedIds.has(id)) {
          const idx = events.findIndex((x) => x.id === id);
          if (idx !== -1) events.splice(idx, 1);
        }
      });

      // recompute next schedule
      recomputeNextSchedule(company, events);

      // persist
      saveAll(companies, events);

      // ✅ header & inputs re-render
      renderHeader();
      fillCompanyExtraInputs();
      renderQuestions();

      showToast("保存しました ");
    } catch (err) {
      console.error(err);
      showToast("保存に失敗しました（Consoleを確認）");
    }
  });
}

// -----------------------------
// ES
// -----------------------------
function ensureEsItems() {
  if (Array.isArray(company.esItems) && company.esItems.length > 0) return;

  company.esItems = [
    { id: "motivation", question: "志望動機", answer: company.motivation || "" },
    { id: "pr", question: "自己PR", answer: company.pr || "" },
  ];
}

function createEsItemElement(question = "", answer = "") {
  const wrapper = document.createElement("div");
  wrapper.className = "es-item";

  const header = document.createElement("div");
  header.className = "es-item-header";

  const qInput = document.createElement("input");
  qInput.type = "text";
  qInput.className = "es-question";
  qInput.placeholder = "質問（例：志望動機 / 学チカ）";
  qInput.value = question;

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "es-delete";
  deleteBtn.textContent = "削除";
  deleteBtn.addEventListener("click", () => wrapper.remove());

  header.appendChild(qInput);
  header.appendChild(deleteBtn);

  const aTextarea = document.createElement("textarea");
  aTextarea.className = "es-answer";
  aTextarea.rows = 4;
  aTextarea.placeholder = "回答を入力";
  aTextarea.value = answer;

  // ✅ 文字数カウンタ
  const counter = document.createElement("div");
  counter.className = "char-counter";

  const updateCounter = () => {
    // 空白・改行を除外してカウント
    const n = (aTextarea.value || "")
      .replace(/\s/g, "")  // 空白・改行・タブ除外
      .length;

    counter.textContent = `${n} 文字`;
    // 任意：目安超えたら警告（とりあえず800）
    counter.classList.toggle("over", n > 800);
  };

  aTextarea.addEventListener("input", updateCounter);
  updateCounter();

  wrapper.appendChild(header);
  wrapper.appendChild(aTextarea);
  wrapper.appendChild(counter);

  return wrapper;
}


function renderEsItems() {
  ensureEsItems();
  esItemsContainer.innerHTML = "";
  company.esItems.forEach((it) => {
    esItemsContainer.appendChild(createEsItemElement(it.question, it.answer));
  });
}

if (addEsItemBtn) {
  addEsItemBtn.addEventListener("click", () => {
    esItemsContainer.appendChild(createEsItemElement("", ""));
  });
}

if (esForm) {
  esForm.addEventListener("submit", (e) => {
    e.preventDefault();
    try {
      const items = [];
      const blocks = esItemsContainer.querySelectorAll(".es-item");
      const baseId = Date.now().toString();

      blocks.forEach((el, idx) => {
        const question = (el.querySelector(".es-question")?.value || "").trim();
        const answer = el.querySelector(".es-answer")?.value || "";
        if (!question && !answer.trim()) return;

        items.push({ id: `${baseId}_${idx}`, question, answer });
      });

      company.esItems = items;
      saveAll(companies, events);
      showToast("ESメモ保存 ");
    } catch (err) {
      console.error(err);
      showToast("ES保存に失敗しました（Consoleを確認）");
    }
  });
}

// -----------------------------
// Comments
// -----------------------------
function ensureComments() {
  if (!Array.isArray(company.comments)) company.comments = [];
}

function formatDateTime(isoStr) {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

function renderComments() {
  ensureComments();
  commentListEl.innerHTML = "";

  if (!company.comments.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "まだコメントがありません。";
    commentListEl.appendChild(p);
    return;
  }

  company.comments.forEach((cm) => {
    const item = document.createElement("div");
    item.className = "comment-item";

    const meta = document.createElement("div");
    meta.className = "comment-meta";
    meta.textContent = cm.createdAt ? `登録日時: ${formatDateTime(cm.createdAt)}` : "登録日時: -";

    const textP = document.createElement("p");
    textP.textContent = cm.text || "";

    item.appendChild(meta);
    item.appendChild(textP);
    commentListEl.appendChild(item);
  });
}

if (commentForm) {
  commentForm.addEventListener("submit", (e) => {
    e.preventDefault();
    try {
      const text = (commentInput?.value || "").trim();
      if (!text) return;

      ensureComments();
      company.comments.unshift({
        id: Date.now().toString(),
        text,
        createdAt: new Date().toISOString(),
      });

      commentInput.value = "";
      saveAll(companies, events);
      renderComments();
      showToast("コメント追加 ");
    } catch (err) {
      console.error(err);
      showToast("コメント保存に失敗しました（Consoleを確認）");
    }
  });
}

// -----------------------------
// Interview
// -----------------------------
function ensureInterviewItems() {
  if (Array.isArray(company.interviews) && company.interviews.length) {
    const first = company.interviews[0];
    if (first && Array.isArray(first.items)) return;
  }
  company.interviews = [
    {
      id: "first",
      stage: "一次面接",
      items: [{ id: "q1", question: "", answer: "" }],
    },
  ];
}

function createQaItemElement(question = "", answer = "") {
  const qaWrapper = document.createElement("div");
  qaWrapper.className = "interview-qa-item";

  const header = document.createElement("div");
  header.className = "interview-qa-header";

  const labelSpan = document.createElement("span");
  labelSpan.className = "interview-qa-label";
  labelSpan.textContent = "聞かれたこと / 回答";

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "interview-qa-delete";
  deleteBtn.textContent = "削除";
  deleteBtn.addEventListener("click", () => qaWrapper.remove());

  header.appendChild(labelSpan);
  header.appendChild(deleteBtn);

  const qTextarea = document.createElement("textarea");
  qTextarea.className = "interview-question";
  qTextarea.rows = 2;
  qTextarea.placeholder = "聞かれたこと（質問）";
  qTextarea.value = question;

  const aTextarea = document.createElement("textarea");
  aTextarea.className = "interview-answer";
  aTextarea.rows = 3;
  aTextarea.placeholder = "回答（実際に答えた内容 / こう答えたかった内容）";
  aTextarea.value = answer;

  qaWrapper.appendChild(header);
  qaWrapper.appendChild(qTextarea);
  qaWrapper.appendChild(aTextarea);
  return qaWrapper;
}

function createInterviewStageElement(stage = "", qaItems = []) {
  const wrapper = document.createElement("div");
  wrapper.className = "interview-item";

  const header = document.createElement("div");
  header.className = "interview-item-header";

  const stageInput = document.createElement("input");
  stageInput.type = "text";
  stageInput.className = "interview-stage";
  stageInput.placeholder = "何次面接（例：一次面接 / 最終面接）";
  stageInput.value = stage;

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "interview-delete";
  deleteBtn.textContent = "この面接を削除";
  deleteBtn.addEventListener("click", () => wrapper.remove());

  header.appendChild(stageInput);
  header.appendChild(deleteBtn);

  const qaList = document.createElement("div");
  qaList.className = "interview-qa-list";

  if (qaItems?.length) {
    qaItems.forEach((qa) => qaList.appendChild(createQaItemElement(qa.question, qa.answer)));
  } else {
    qaList.appendChild(createQaItemElement("", ""));
  }

  const addQaBtn = document.createElement("button");
  addQaBtn.type = "button";
  addQaBtn.className = "primary interview-add-qa";
  addQaBtn.textContent = "質問を追加";
  addQaBtn.addEventListener("click", () => qaList.appendChild(createQaItemElement("", "")));

  wrapper.appendChild(header);
  wrapper.appendChild(qaList);
  wrapper.appendChild(addQaBtn);
  return wrapper;
}

function renderInterviewItems() {
  ensureInterviewItems();
  interviewItemsContainer.innerHTML = "";
  company.interviews.forEach((stageObj) => {
    interviewItemsContainer.appendChild(createInterviewStageElement(stageObj.stage, stageObj.items || []));
  });
}

if (addInterviewItemBtn) {
  addInterviewItemBtn.addEventListener("click", () => {
    interviewItemsContainer.appendChild(createInterviewStageElement("", []));
  });
}

if (interviewForm) {
  interviewForm.addEventListener("submit", (e) => {
    e.preventDefault();
    try {
      const items = [];
      const stages = interviewItemsContainer.querySelectorAll(".interview-item");
      const baseId = Date.now().toString();

      stages.forEach((stageEl, sIdx) => {
        const stage = (stageEl.querySelector(".interview-stage")?.value || "").trim();
        const qaEls = stageEl.querySelectorAll(".interview-qa-item");

        const qaItems = [];
        qaEls.forEach((qaEl, qIdx) => {
          const q = (qaEl.querySelector(".interview-question")?.value || "");
          const a = (qaEl.querySelector(".interview-answer")?.value || "");
          if (!q.trim() && !a.trim()) return;

          qaItems.push({ id: `${baseId}_${sIdx}_${qIdx}`, question: q, answer: a });
        });

        if (!stage && qaItems.length === 0) return;

        items.push({ id: `${baseId}_${sIdx}`, stage: stage || "面接", items: qaItems });
      });

      company.interviews = items;
      saveAll(companies, events);
      showToast("面接ノート保存 ");
    } catch (err) {
      console.error(err);
      showToast("面接保存に失敗しました（Consoleを確認）");
    }
  });
}

// -----------------------------
// Init fill
// -----------------------------
detailJobTypeInput.value = company.jobType || "";
detailStatusSelect.value = company.status || "";
detailHolidaysInput.value = company.holidays || "";
detailMemoInput.value = company.memo || "";

renderCompanyEvents();
renderEsItems();
renderComments();
renderInterviewItems();
renderAllRatings();

// 初期タブ（任意）
if (initialTab) setActiveTab(initialTab);

// 予定ハイライト（カレンダーから飛んだ時）
function highlightEventRowIfNeeded() {
  if (!highlightEventId) return;
  if (!companyEventsContainer) return;

  // infoタブを開く
  setActiveTab("info");

  const rows = companyEventsContainer.querySelectorAll(".company-event-row");
  let target = null;
  rows.forEach((r) => {
    if (r.dataset.eventId === highlightEventId) target = r;
  });

  if (!target) return;

  target.classList.add("event-highlight");
  target.scrollIntoView({ behavior: "smooth", block: "center" });

  setTimeout(() => {
    target.classList.remove("event-highlight");
  }, 3000);
}

renderDeadlineCountdown();

highlightEventRowIfNeeded();

if (detailDeadlineInput) detailDeadlineInput.value = company.deadline || "";

// -----------------------------
// Back
// -----------------------------
if (backToListBtn) {
  backToListBtn.addEventListener("click", () => {
    location.href = "list.html";
  });
}
