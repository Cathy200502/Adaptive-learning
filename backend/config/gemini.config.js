/**
 * Gemini settings, read lazily from environment variables so they are always
 * current (dotenv has loaded by the time a request arrives) and never leave
 * the server. The API key is NEVER sent to the browser or written to logs.
 *
 *   GEMINI_API_KEY   required - get one at https://aistudio.google.com/apikey
 *   GEMINI_MODEL     optional - defaults to gemini-2.5-flash
 */
const num = (value, fallback) => (Number.isFinite(Number(value)) && value !== undefined && value !== '' ? Number(value) : fallback);

module.exports = {
  apiKey: () => (process.env.GEMINI_API_KEY || '').trim(),
  model: () => (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim(),
  baseUrl: () => (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, ''),
  timeoutMs: () => num(process.env.GEMINI_TIMEOUT_MS, 60000),
  maxPerRequest: () => num(process.env.GEMINI_MAX_QUESTIONS, 10),
  temperature: () => num(process.env.GEMINI_TEMPERATURE, 0.7)
};
