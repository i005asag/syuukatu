// /js/ui-toast.js
// --------------------
// 共通：トースト通知
// --------------------

export function showToast(message, icon = "✨") {
  const root = document.getElementById("toast-root");
  if (!root) return;

  const toast = document.createElement("div");
  toast.className = "toast";

  const iconSpan = document.createElement("span");
  iconSpan.className = "toast-icon";
  iconSpan.textContent = icon;

  const msgSpan = document.createElement("span");
  msgSpan.className = "toast-message";
  msgSpan.textContent = message;

  toast.appendChild(iconSpan);
  toast.appendChild(msgSpan);
  root.appendChild(toast);

  setTimeout(() => toast.remove(), 3600);
}
