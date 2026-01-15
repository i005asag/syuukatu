// /js/page-list.js
import { requireLoginOrRedirect, logout, changePassword } from "./auth.js";
import { loadAll } from "./storage.js";
import { parseEventDate, recomputeNextSchedule } from "./events.js";
import { showToast } from "./ui-toast.js";
import { qs } from "./utils.js";

// ログイン必須
requireLoginOrRedirect();

// DOM
const companyListEl = qs("#company-list");
const emptyCompanyMessageEl = qs("#empty-company-message");
const filterStatusSelect = qs("#filter-status");
const sortOrderSelect = qs("#sort-order");
const sortDirectionToggle = qs("#sort-direction-toggle");
const logoutBtn = qs("#logout-btn");

const addCompanyBtn = qs("#add-company-btn");
const filterRatingKeySelect = qs("#filter-rating-key");
const filterRatingMinSelect = qs("#filter-rating-min");

if (addCompanyBtn) {
  addCompanyBtn.addEventListener("click", () => {
    location.href = "register.html";
  });
}

// パスワード変更UI
const pwSettingsBtn = qs("#pw-settings-btn");
const pwDialog = document.getElementById("pw-dialog");
const pwForm = document.getElementById("pw-form");
const pwCurrent = document.getElementById("pw-current");
const pwNew = document.getElementById("pw-new");
const pwNewConfirm = document.getElementById("pw-new-confirm");
const pwCancel = document.getElementById("pw-cancel");
const pwError = document.getElementById("pw-error");

function setPwError(msg) {
  if (!pwError) return;
  if (!msg) {
    pwError.style.display = "none";
    pwError.textContent = "";
  } else {
    pwError.style.display = "block";
    pwError.textContent = msg;
  }
}

function openPwDialog() {
  setPwError("");
  if (pwCurrent) pwCurrent.value = "";
  if (pwNew) pwNew.value = "";
  if (pwNewConfirm) pwNewConfirm.value = "";
  if (pwDialog?.showModal) pwDialog.showModal();
  else pwDialog?.setAttribute("open", "open"); // 一応フォールバック
  setTimeout(() => pwCurrent?.focus(), 0);
}

function closePwDialog() {
  if (pwDialog?.close) pwDialog.close();
  else pwDialog?.removeAttribute("open");
}


// データ
let { companies, events } = loadAll();

// 古いデータでも nextSchedule が合うように再計算
companies.forEach((c) => recomputeNextSchedule(c, events));

function calcDaysLeft(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;

  const deadline = new Date(y, m - 1, d, 23, 59, 59, 999);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  return Math.ceil(diffMs / 86400000);
}

function deadlineText(deadline) {
  if (!deadline) return "締切：未設定";
  const days = calcDaysLeft(deadline);
  if (days === null) return "締切：形式不正";
  if (days > 0) return `締切：あと ${days} 日`;
  if (days === 0) return "締切：今日";
  return `締切：締切済`;
}

function getRating(c, key) {
  const v = Number(c?.ratings?.[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

function getRatingAvg(c) {
  const keys = ["motivation", "salary", "holidays", "culture"];
  const vals = keys.map((k) => getRating(c, k)).filter((x) => x > 0);
  if (!vals.length) return 0; // 未設定は0
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}


function getNextScheduleDate(company) {
  if (!company?.nextSchedule?.date) return null;
  const dateStr = company.nextSchedule.date;
  const timeStr = company.nextSchedule.time || "00:00";
  const d = new Date(`${dateStr}T${timeStr}`);
  return isNaN(d.getTime()) ? null : d;
}

function formatNextSchedule(company) {
  if (!company?.nextSchedule?.date) return "次の予定：未設定";
  const { date, time, label } = company.nextSchedule;
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const t = time ? `${time}` : "";
  const l = label ? ` ${label}` : "";
  return `次の予定：${month}/${day} ${t}${l}`;
}

function renderCompanyList() {
  companyListEl.innerHTML = "";

  if (!companies.length) {
    emptyCompanyMessageEl.style.display = "block";
    emptyCompanyMessageEl.textContent =
      "まだ企業が登録されていません。「企業を追加」から登録してください。";
    return;
  }

  let list = companies.slice();

  // フィルタ
  const statusFilter = filterStatusSelect?.value || "all";
  if (statusFilter !== "all") {
    list = list.filter((c) => (c.status || "") === statusFilter);
  }

  // --- 評価フィルタ ---
  const ratingKey = filterRatingKeySelect?.value || "none";
  const minRating = Number(filterRatingMinSelect?.value || 0);

  if (ratingKey !== "none" && minRating > 0) {
    list = list.filter((c) => {
      const v = ratingKey === "avg" ? getRatingAvg(c) : getRating(c, ratingKey);
      return v >= minRating;
    });
  }

  // ソート
  const sortOrder = sortOrderSelect?.value || "created";
  const direction = sortDirectionToggle?.dataset?.direction || "asc";
  const isRatingSort = String(sortOrder || "").startsWith("rating_");

  if (sortOrder === "name") {
    list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"));

  } else if (sortOrder === "next_date") {
    list.sort((a, b) => {
      const da = getNextScheduleDate(a);
      const db = getNextScheduleDate(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    });

  } else if (sortOrder === "rating_avg") {
    list.sort((a, b) => getRatingAvg(a) - getRatingAvg(b));
  } else if (sortOrder === "rating_motivation") {
    list.sort((a, b) => getRating(a, "motivation") - getRating(b, "motivation"));
  } else if (sortOrder === "rating_salary") {
    list.sort((a, b) => getRating(a, "salary") - getRating(b, "salary"));
  } else if (sortOrder === "rating_holidays") {
    list.sort((a, b) => getRating(a, "holidays") - getRating(b, "holidays"));
  } else if (sortOrder === "rating_culture") {
    list.sort((a, b) => getRating(a, "culture") - getRating(b, "culture"));

  } else {
    // 登録順
    list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }
  if (direction === "desc") list.reverse();



  // 0件なら表示
  if (!list.length) {
    emptyCompanyMessageEl.style.display = "block";
    emptyCompanyMessageEl.textContent =
      "選択した条件に一致する企業がありません。";
    return;
  } else {
    emptyCompanyMessageEl.style.display = "none";
  }

  // 描画
  list.forEach((c) => {
    const card = document.createElement("article");
    card.className = "company-card";
    card.addEventListener("click", () => {
      // 企業詳細へ（URLパラメータ）
      location.href = `detail.html?companyId=${encodeURIComponent(c.id)}`;
    });

    const header = document.createElement("div");
    header.className = "company-card-header";

    const title = document.createElement("div");
    title.className = "company-card-title";
    title.textContent = c.name || "(企業名なし)";

    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = `ステータス: ${c.status || "未設定"}`;

    header.appendChild(title);
    header.appendChild(tag);

    const next = document.createElement("div");

    const rating = document.createElement("div");
    rating.className = "company-card-rating";
    const avg = getRatingAvg(c);
    rating.textContent = avg ? `評価：★${avg.toFixed(1)}` : "評価：未設定";
    if (!avg) rating.classList.add("muted");


    next.className = "company-card-next";
    next.textContent = formatNextSchedule(c);

    // ✅ 締切カウントダウン
    const deadline = document.createElement("div");
    deadline.className = "company-card-deadline";
    deadline.textContent = deadlineText(c.deadline || "");
    if (!c.deadline) deadline.classList.add("muted");

    const days = calcDaysLeft(c.deadline || "");
    if (days !== null) {
      if (days < 0) deadline.classList.add("deadline-over");     // 締切済
      else if (days === 0) deadline.classList.add("deadline-today"); // 今日
      else if (days <= 3) deadline.classList.add("deadline-soon");   // 3日以内
    }


    const urlDiv = document.createElement("div");
    urlDiv.className = "company-card-url";
    if (c.url) {
      const a = document.createElement("a");
      a.href = c.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "マイページを開く";
      // カードクリックと干渉しないように
      a.addEventListener("click", (e) => e.stopPropagation());
      urlDiv.appendChild(a);
    } else {
      urlDiv.textContent = "マイページURL未登録";
      urlDiv.classList.add("muted");
    }

    card.appendChild(header);
    card.appendChild(next);
    card.appendChild(deadline);
    card.appendChild(rating);
    card.appendChild(urlDiv);

    companyListEl.appendChild(card);
  });
}

// イベント
if (filterStatusSelect) {
  filterStatusSelect.addEventListener("change", renderCompanyList);
}
if (sortOrderSelect) {
  sortOrderSelect.addEventListener("change", renderCompanyList);
}
if (sortDirectionToggle) {
  sortDirectionToggle.addEventListener("click", () => {
    const current = sortDirectionToggle.dataset.direction || "asc";
    const next = current === "asc" ? "desc" : "asc";
    sortDirectionToggle.dataset.direction = next;
    sortDirectionToggle.textContent = next === "asc" ? "昇順" : "降順";
    renderCompanyList();
  });
}
if (filterRatingKeySelect) {
  filterRatingKeySelect.addEventListener("change", renderCompanyList);
}
if (filterRatingMinSelect) {
  filterRatingMinSelect.addEventListener("change", renderCompanyList);
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    logout();
    showToast("ログアウトした");
    location.href = "index.html";
  });
}

if (pwSettingsBtn) {
  pwSettingsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openPwDialog();
  });
}

if (pwCancel) {
  pwCancel.addEventListener("click", () => closePwDialog());
}

// ダイアログの外側クリックで閉じたい場合（任意）
if (pwDialog) {
  pwDialog.addEventListener("click", (e) => {
    const rect = pwDialog.getBoundingClientRect();
    const inDialog =
      rect.top <= e.clientY &&
      e.clientY <= rect.bottom &&
      rect.left <= e.clientX &&
      e.clientX <= rect.right;
    if (!inDialog) closePwDialog();
  });
}

if (pwForm) {
  pwForm.addEventListener("submit", (e) => {
    e.preventDefault();
    setPwError("");

    const cur = (pwCurrent?.value || "").trim();
    const next = (pwNew?.value || "").trim();
    const next2 = (pwNewConfirm?.value || "").trim();

    if (!cur || !next) {
      setPwError("現在/新しいパスワードを入力してください。");
      return;
    }
    if (next.length < 4) {
      setPwError("新しいパスワードは4文字以上にしてください。");
      return;
    }
    if (next !== next2) {
      setPwError("新しいパスワード（確認）が一致しません。");
      return;
    }

    const r = changePassword(cur, next);
    if (r.ok) {
      showToast("パスワードを変更した");
      closePwDialog();
    } else {
      setPwError(r.message || "パスワード変更に失敗しました。");
      showToast("変更できませんでした");
    }
  });
}


// 初期描画
renderCompanyList();
