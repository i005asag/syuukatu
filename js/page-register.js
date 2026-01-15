// /js/page-register.js
import { requireLoginOrRedirect } from "./auth.js";
import { loadAll, saveAll } from "./storage.js";
import { recomputeNextSchedule } from "./events.js";
import { showToast } from "./ui-toast.js";
import { qs } from "./utils.js";

// ログイン必須
requireLoginOrRedirect();

// DOM
const companyForm = qs("#company-form");
const cancelBtn = qs("#cancel-btn");

// Inputs
const nameInput = qs("#company-name");
const urlInput = qs("#company-url");
const loginIdInput = qs("#company-login-id");
const passwordInput = qs("#company-password");

const jobTypeInput = qs("#company-job-type");
const statusSelect = qs("#company-status");
const holidaysInput = qs("#company-holidays");
const memoInput = qs("#company-memo");

const nextDateInput = qs("#company-next-date");
const nextTimeInput = qs("#company-next-time");
const nextLabelInput = qs("#company-next-label");
const nextColorSelect = qs("#company-next-color");

// データ
let { companies, events } = loadAll();

// submit
if (companyForm) {
  companyForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const now = Date.now();
    const companyId = now.toString();

    const name = (nameInput?.value || "").trim();
    if (!name) return;

    const company = {
      id: companyId,
      createdAt: now,

      name,
      url: (urlInput?.value || "").trim(),
      loginId: (loginIdInput?.value || "").trim(),
      password: (passwordInput?.value || "").trim(),

      status: statusSelect?.value || "未応募",
      jobType: (jobTypeInput?.value || "").trim(),
      holidays: (holidaysInput?.value || "").trim(),
      memo: (memoInput?.value || "").trim(),

      // ES
      esItems: [
        { id: "motivation", question: "志望動機", answer: "" },
        { id: "pr", question: "自己PR", answer: "" },
      ],

      // 面接
      interviews: [
        {
          id: "first",
          stage: "一次面接",
          items: [{ id: "q1", question: "", answer: "" }],
        },
      ],

      comments: [],
      nextSchedule: null, // events から再計算で入る
    };

    companies.push(company);

    // 予定（任意）→ events に入れる
    const date = nextDateInput?.value || "";
    const time = nextTimeInput?.value || "";
    const label = (nextLabelInput?.value || "").trim();
    const color = nextColorSelect?.value || "blue";

    if (date || time || label) {
      const eventId = (Date.now().toString() + Math.random().toString(16).slice(2));
      const eventObj = {
        id: eventId,
        companyId,
        date,
        time,
        label,
        title: `${name} ${label || "予定"}`,
        color, // カレンダー色
      };
      events.push(eventObj);
    }

    // 次の予定を再計算
    recomputeNextSchedule(company, events);

    // 保存
    saveAll(companies, events);

    showToast("企業を登録した");

    // 一覧へ
    location.href = "list.html";
  });
}

// cancel
if (cancelBtn) {
  cancelBtn.addEventListener("click", () => {
    location.href = "list.html";
  });
}
