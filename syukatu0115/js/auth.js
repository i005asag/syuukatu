// /js/auth.js
// --------------------
// B案：パスワード“設定型”ロック（データ暗号化はしない）
// - パスワードは localStorage に保存（※強固ではない）
// - ログイン状態は sessionStorage
// --------------------

const SESSION_KEY = "jobapp_loggedIn";
const PASS_KEY = "jobapp_passcode"; // ★B案なので平文保存（学生版として割り切り）

export function isLoggedIn() {
  return sessionStorage.getItem(SESSION_KEY) === "1";
}

export function isPasswordSet() {
  const p = localStorage.getItem(PASS_KEY);
  return typeof p === "string" && p.length > 0;
}

// 初回設定：パスワードを登録（上書きしない）
export function setPassword(newPasscode) {
  const pw = (newPasscode || "").trim();
  if (!pw) return { ok: false, message: "パスワードが空です" };

  if (isPasswordSet()) {
    return { ok: false, message: "すでにパスワードが設定されています" };
  }

  localStorage.setItem(PASS_KEY, pw);
  return { ok: true, message: "パスワードを設定しました" };
}

// ログイン：一致したらセッションON
export function login(passcode) {
  if (!isPasswordSet()) {
    return { ok: false, message: "パスワードが未設定です" };
  }

  const input = (passcode || "").trim();
  const saved = localStorage.getItem(PASS_KEY) || "";

  if (input && input === saved) {
    sessionStorage.setItem(SESSION_KEY, "1");
    return { ok: true, message: "ログインしました" };
  }

  return { ok: false, message: "パスワードが違います" };
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

// ログイン必須ページ用：未ログインなら index へ
export function requireLoginOrRedirect() {
  if (!isLoggedIn()) {
    location.href = "index.html";
    return false;
  }
  return true;
}

// パスワード変更（ログイン後に使う想定）
export function changePassword(currentPasscode, newPasscode) {
  if (!isPasswordSet()) {
    return { ok: false, message: "パスワードが未設定です" };
  }

  const saved = localStorage.getItem(PASS_KEY) || "";
  const cur = (currentPasscode || "").trim();
  const next = (newPasscode || "").trim();

  if (!cur || cur !== saved) {
    return { ok: false, message: "現在のパスワードが違います" };
  }
  if (!next) {
    return { ok: false, message: "新しいパスワードが空です" };
  }

  localStorage.setItem(PASS_KEY, next);
  sessionStorage.setItem(SESSION_KEY, "1");
  return { ok: true, message: "パスワードを変更しました" };
}

// 忘れた時用：パスワードを削除して初回状態へ戻す（※誰でも実行できる＝B案の仕様）
export function resetPassword() {
  localStorage.removeItem(PASS_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  return { ok: true, message: "パスワードをリセットしました（再設定してください）" };
}
