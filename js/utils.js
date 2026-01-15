// /js/utils.js

import { getParam as _getParam, getParamInt as _getParamInt } from "./url.js";

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function getParam(name, fallback = "") {
  return _getParam(name, fallback);
}

export function getParamInt(name, fallback = 0) {
  return _getParamInt(name, fallback);
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
