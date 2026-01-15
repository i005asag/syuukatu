// /js/events.js
// 予定（events）関連の共通関数。
// もともと各ページが ./events.js を import しているため、storage.js から委譲する。

export {
  parseEventDate,
  compareEventByDate,
  getCompanyEvents,
  recomputeNextSchedule,
  recomputeAllNextSchedules,
  makeId,
} from "./storage.js";
