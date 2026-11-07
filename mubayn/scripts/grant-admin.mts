// Promotes an existing, e-mail-verified account to admin. There is no default
// admin and no admin password anywhere in the code.
//   DATABASE_URL=... node scripts/grant-admin.mts owner@example.com
// On a deployment without e-mail (EMAIL_DRIVER=none) addresses are never
// verified; pass --no-email to accept an unverified account.
import pg from "pg";

const noEmail = process.argv.includes("--no-email");
const email = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!process.env.DATABASE_URL || !email) {
  console.error("usage: DATABASE_URL=... node scripts/grant-admin.mts <email>");
  process.exit(1);
}
const ssl = process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined;
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl });
await client.connect();
const res = await client.query(
  `UPDATE users SET role = 'admin', updated_at = now()
    WHERE email = $1 AND status = 'active' AND ($2 OR email_verified_at IS NOT NULL)
    RETURNING id`,
  [email, noEmail],
);
if (res.rowCount === 0) {
  console.error(noEmail ? "No active account with that e-mail." : "No active, verified account with that e-mail. Register and verify it first (or pass --no-email).");
  process.exitCode = 1;
} else {
  await client.query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, metadata) VALUES (NULL, 'admin.granted_cli', 'user', $1, '{}')`,
    [res.rows[0].id],
  );
  console.log(`granted admin to ${email}. They must enrol MFA at first admin sign-in.`);
}
await client.end();
