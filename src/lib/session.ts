"use client";

// Session id anonimo de primeira parte: localStorage + cookie.
// O cookie permite que rotas de servidor (/ir, /api/pv) leiam o sid
// sem schema novo — e persistido por 1 ano.
const COOKIE = "ocr_sid";
const LS_KEY = "ocr_sid";

export function getSessionId(): string {
  try {
    let sid = window.localStorage.getItem(LS_KEY);
    if (!sid) {
      sid =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.localStorage.setItem(LS_KEY, sid);
      document.cookie = `${COOKIE}=${sid}; path=/; max-age=31536000; samesite=lax`;
    }
    return sid;
  } catch {
    return "";
  }
}
