// Development seed. Refuses to run in production.
//
//   npm run db:seed
//
// Creates a demo user (random password printed once), a personal model, one
// knowledge document (left 'pending' for the background worker) and a small
// training dataset. The model name comes from OMNIX_SEED_MODEL_NAME so the
// owner's real name never has to be hard-coded.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createProfile } from "@/lib/ai/models/service";
import { profileCreateSchema } from "@/lib/ai/identity/model-config";
import { createDocument } from "@/lib/ai/rag/knowledge";
import { addItems } from "@/lib/ai/training/datasets";
import { registerUser, type AuthContext } from "@/lib/auth/session";
import { closePool, withUser } from "@/lib/db/pool";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed a production database.");
  process.exit(1);
}

const email = process.env.OMNIX_SEED_EMAIL ?? "demo@omnix.local";
const modelName = process.env.OMNIX_SEED_MODEL_NAME ?? "My AI";
const password = `${randomBytes(9).toString("base64url")}9a`;

let userId: string;
let workspaceId: string;
try {
  ({ userId, workspaceId } = await registerUser({ email, password, displayName: "Demo", locale: "ar" }));
} catch (err) {
  if ((err as { code?: string }).code === "CONFLICT" || /already exists/.test(String(err))) {
    console.log(`${email} already exists; nothing to do.`);
    await closePool();
    process.exit(0);
  }
  throw err;
}
const ctx: AuthContext = { userId, workspaceId, via: "session", scopes: "all" };

const { profile, version } = await withUser(userId, (db) =>
  createProfile(db, ctx, profileCreateSchema.parse({ displayName: modelName, description: "Private OMNIX model (development seed)." })),
);

const doc = await createDocument(ctx, {
  filename: "oasis-project.md",
  data: readFileSync(path.resolve(import.meta.dirname, "../tests/fixtures/oasis-project.md")),
  tags: ["projects"],
});

await withUser(userId, async (db) => {
  const ds = await db.query(
    "INSERT INTO ai_datasets (owner_id, workspace_id, name, description, dataset_type) VALUES ($1, $2, $3, $4, 'sft_chat') RETURNING id",
    [userId, workspaceId, "Seed examples", "A few example conversations to try the Training Lab."],
  );
  await addItems(
    db,
    ds.rows[0].id,
    [
      { messages: [{ role: "user", content: "عرّف بنفسك." }, { role: "assistant", content: `أنا ${modelName}، نموذج ذكاء اصطناعي خاص داخل منصة OMNIX.` }] },
      { messages: [{ role: "user", content: "Introduce yourself." }, { role: "assistant", content: `I am ${modelName}, a private AI model inside OMNIX.` }] },
    ],
    "manual",
  );
});

console.log(JSON.stringify({ email, password, modelId: profile.id, version: version.version, baseModel: version.baseModel, pendingDocument: doc.id }, null, 2));
console.log("Password shown once. Run `npm run ai-worker -- --once` to process the pending document.");
await closePool();
