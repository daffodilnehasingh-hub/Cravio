/* Placeholder-aware "is this credential real?" check (B2/B3).
   Example/placeholder values from .env.example must count as NOT configured so the
   API returns a clean 503 instead of calling the real gateway with a fake key. */
const PLACEHOLDER_PATTERN = /your|placeholder|replace|example|changeme|fixme|todo|xxx+|sample/i;

function isRealCredential(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 8) return false;            // too short to be a real key
  return !PLACEHOLDER_PATTERN.test(trimmed);
}

function areRealCredentials(...values) {
  return values.every(isRealCredential);
}

module.exports = { isRealCredential, areRealCredentials };
