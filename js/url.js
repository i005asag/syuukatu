// /js/url.js
// --------------------
// 共通：URLパラメータ
// --------------------

export function getParam(name, fallback = "") {
  const url = new URL(location.href);
  const v = url.searchParams.get(name);
  return v === null ? fallback : v;
}

export function getParamInt(name, fallback = 0) {
  const v = getParam(name, "");
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function setParams(baseUrl, paramsObj = {}) {
  const url = new URL(baseUrl, location.origin);
  Object.entries(paramsObj).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    url.searchParams.set(k, String(v));
  });
  return url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "");
}

// 現在URLのクエリをオブジェクトで取り出す（必要なものだけ）
export function pickParams(keys = []) {
  const url = new URL(location.href);
  const out = {};
  keys.forEach((k) => {
    const v = url.searchParams.get(k);
    if (v !== null) out[k] = v;
  });
  return out;
}

// 月パラメータ ym=YYYY-MM が無ければ current
export function getYmOrNow() {
  const ym = getParam("ym", "");
  if (/^\d{4}-\d{2}$/.test(ym)) return ym;
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
