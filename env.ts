// env.ts
// This file centralizes API keys for easier management.
// In a real-world application, these would be loaded from environment variables
// and not hardcoded in the source code for security reasons.

export const GEMINI_API_KEY = "AIzaSyBRR2wZCcru2cz-QlRQoBF942sh_kNr2z8";

// Gemini model configuration
// Available models: gemini-1.5-flash-latest, gemini-1.5-pro-latest, gemini-2.0-flash-exp, gemini-2.0-flash-thinking-exp
export const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.0-flash-exp";

export const MINIMAX_JWT_TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJHcm91cE5hbWUiOiLqvLzrg6XqvLzrg6UiLCJVc2VyTmFtZSI6Iuq8vOuDpeq8vOuDpSIsIkFjY291bnQiOiIiLCJTdWJqZWN0SUQiOiIxOTY2NDYwNTk1NTE1NDI5NjE2IiwiUGhvbmUiOiIiLCJHcm91cElEIjoiMTk2NjQ2MDU5NTUxMTIzOTQwOCIsIlBhZ2VOYW1lIjoiIiwiTWFpbCI6InJlc2V0OThAZ21haWwuY29tIiwiQ3JlYXRlVGltZSI6IjIwMjUtMDktMTMgMDE6MDE6NDgiLCJUb2tlblR5cGUiOjEsImlzcyI6Im1pbmltYXgifQ.vfPcV3bil3k6mr2U4O18Hcj5GzA7aPD2DsoUy76y8zc1iWgvw6eF1f_YzOMmWAGo_T2Y_3tK_iQ-74S_cM_aSajJwjgKTIYW7kpsMJ4F6v0WGa8dLLcYIpHSxQG7icIUSYdzkzCwsLyrj0UHX2efQoYRYprnQSDe4BHZQZ2meg6YXRXMRshsyxnNhJGHtGRdtm-uOrgWqyRJk_UxVWSEGsbd_CyxwNFbkuUY3bipz4QGjKOzX_EZtPTkPlGfy413O1mhhuFD8lw0eSmt5lkwMPvvpCO-KaV8K34B146_v91iGBWsHinsEaDO50s5BFgO6iObdMkshRavP558VZRsiw";

export const SHOTSTACK_API_KEY = "DwAg90Ct3Kij25bACtNYWZGPF2pD1FDdLhQcnWby";

// Domain configuration
export const DOMAIN = import.meta.env.PROD ? "studio.keesdconsulting.uk" : "localhost:5173";

// Dynamic API base URL based on current host
export const API_BASE_URL = (() => {
  if (typeof window !== 'undefined') {
    // Use relative URL for API calls (will use current host)
    return '';  // Empty string means use current origin
  }
  return 'http://localhost:5901';
})();
