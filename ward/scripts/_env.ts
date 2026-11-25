/** Load .env / .env.local for CLI scripts (Next.js loads them itself for the app). */
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(file);
  } catch {
    /* optional */
  }
}
