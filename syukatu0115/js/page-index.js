// /js/page-index.js
import {
  login,
  isLoggedIn,
  isPasswordSet,
  setPassword,
  resetPassword,
} from "./auth.js";
import { showToast } from "./ui-toast.js";

if (isLoggedIn()) {
  location.href = "list.html";
}

const loginForm = document.getElementById("login-form");
const pwInput = document.getElementById("login-password");
const pwConfirmWrap = document.getElementById("confirm-wrap");
const pwConfirmInput = document.getElementById("login-password-confirm");

const modeTitle = document.getElementById("mode-title");
const modeDesc = document.getElementById("mode-desc");
const setupNote = document.getElementById("setup-note");

const submitBtn = document.getElementById("submit-btn");
const forgotBtn = document.getElementById("forgot-btn");
const errorEl = document.getElementById("login-error");
const pwLabel = document.getElementById("pw-label");

function setError(msg) {
  if (!errorEl) return;
  if (!msg) {
    errorEl.style.display = "none";
    errorEl.textContent = "";
    return;
  }
  errorEl.style.display = "block";
  errorEl.textContent = msg;
}

function applyMode() {
  const firstTime = !isPasswordSet();

  if (firstTime) {
    modeTitle.textContent = "初回パスワード設定";
    modeDesc.innerHTML =
      "初回はパスワードを設定してください。<br>（簡易ロックです）";
    setupNote.style.display = "block";
    pwConfirmWrap.style.display = "block";
    submitBtn.textContent = "設定して開始";
    forgotBtn.style.display = "none";
    pwLabel.textContent = "パスワード";
    pwInput.autocomplete = "new-password";
  } else {
    modeTitle.textContent = "ログイン";
    modeDesc.innerHTML =
      "パスワードを入力してログインしてください。<br>（※簡易ロック ）";
    setupNote.style.display = "none";
    pwConfirmWrap.style.display = "none";
    submitBtn.textContent = "ログイン";
    forgotBtn.style.display = "inline-block";
    pwLabel.textContent = "パスワード";
    pwInput.autocomplete = "current-password";
  }

  setError("");
  pwInput.value = "";
  if (pwConfirmInput) pwConfirmInput.value = "";
  pwInput.focus();
}

if (forgotBtn) {
  forgotBtn.addEventListener("click", () => {
    // B案：詰まない代わりに誰でもリセットできる（学生版として割り切り）
    const ok = confirm(
      "パスワードをリセットします。\n\n" +
      "・次回は新しいパスワードを設定できます\n" +
      "・（注意）この操作は誰でも実行できるため、強固な保護ではありません\n\n" +
      "続行しますか？"
    );
    if (!ok) return;

    resetPassword();
    showToast("リセットしたよ（再設定してね）", "⚠️");
    applyMode();
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    setError("");

    const pw = (pwInput?.value || "").trim();

    // 初回設定
    if (!isPasswordSet()) {
      const pw2 = (pwConfirmInput?.value || "").trim();
      if (!pw) {
        setError("パスワードを入力してください。");
        return;
      }
      if (pw.length < 4) {
        setError("パスワードは4文字以上にしてください。");
        return;
      }
      if (pw !== pw2) {
        setError("確認用パスワードが一致しません。");
        return;
      }

      const r = setPassword(pw);
      if (!r.ok) {
        setError(r.message || "設定に失敗しました。");
        return;
      }

      // 設定したらそのままログイン
      const lr = login(pw);
      if (lr.ok) {
        showToast("パスワードを設定して開始した");
        location.href = "list.html";
        return;
      }

      setError("設定はできたけどログインに失敗しました。再度お試しください。");
      return;
    }

    // 通常ログイン
    const r = login(pw);
    if (r.ok) {
      showToast("ログインできました");
      location.href = "list.html";
    } else {
      setError("パスワードが違います。");
      showToast("パスワード違うかも…！", "⚠️");
    }
  });
}

applyMode();
