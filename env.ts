// env.ts
// This file loads API keys from environment variables for security.
// Create a .env.local file with your actual API keys.
// Never commit .env.local to version control!

// Vite automatically loads VITE_ prefixed variables from .env files
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
export const MINIMAX_JWT_TOKEN = import.meta.env.VITE_MINIMAX_JWT_TOKEN || '';
export const SHOTSTACK_API_KEY = import.meta.env.VITE_SHOTSTACK_API_KEY || '';

// Validation to ensure API keys are loaded
if (!GEMINI_API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY is not set. Please check your .env.local file.');
}

if (!MINIMAX_JWT_TOKEN) {
  console.warn('⚠️ MINIMAX_JWT_TOKEN is not set. Please check your .env.local file.');
}

if (!SHOTSTACK_API_KEY) {
  console.warn('⚠️ SHOTSTACK_API_KEY is not set. Please check your .env.local file.');
}
