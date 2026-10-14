// whatsapp-connect: owners and admins connect, test, rotate and disconnect the
// clinic's WhatsApp Business Platform number (see docs/API.md).
//
// Credentials are checked with Meta before anything is stored, and the secret
// values only ever travel inbound: the response returns the verify token once,
// never the access token or app secret.

import { credentialsKey, randomToken, sha256Hex } from "../_shared/crypto.ts";
import { type Db, dbFailure, requireMembership, requireUser, serviceClient, writeAudit } from "../_shared/db.ts";
import { z } from "../_shared/deps.ts";
import { cleanSecret } from "../_shared/env.ts";
import { type Handler, HttpError, json, parse, readJson, type RequestContext } from "../_shared/http.ts";
import { log } from "../_shared/log.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { getPhoneNumberInfo, GraphError, subscribeApp } from "../_shared/whatsapp/graph.ts";
import {
  graphConfig,
  INTEGRATION_COLUMNS,
  type IntegrationRow,
  loadCredentials,
  loadIntegration,
  saveCredentials,
  webhookUrl,
} from "../_shared/whatsapp/integration.ts";
import { recordIntegrationError } from "../_shared/whatsapp/outbound.ts";

export interface Deps {
  db: Db;
  fetch: typeof fetch;
  now: () => Date;
}

export function liveDeps(): Deps {
  return { db: serviceClient(), fetch: globalThis.fetch, now: () => new Date() };
}

const metaId = z.string().transform(cleanSecret).pipe(z.string().regex(/^\d{5,32}$/, "Must be 5 to 32 digits"));
// Invisible characters picked up when pasting on a phone are removed first;
// after that only printable ASCII can be a Meta token or app secret.
const secret = (min: number, max: number) =>
  z.string().max(max * 2).transform(cleanSecret).pipe(
    z.string().min(min).max(max).regex(/^[\x21-\x7E]+$/, "Contains characters that are not allowed"),
  );

const SaveBody = z.object({
  action: z.literal("save"),
  organization_id: z.uuid(),
  phone_number_id: metaId,
  waba_id: metaId,
  access_token: secret(20, 1024),
  app_secret: secret(16, 256),
});
const OrgOnly = (action: "rotate_verify_token" | "test" | "disconnect") =>
  z.object({ action: z.literal(action), organization_id: z.uuid() });

const Body = z.discriminatedUnion("action", [
  SaveBody,
  OrgOnly("rotate_verify_token"),
  OrgOnly("test"),
  OrgOnly("disconnect"),
]);

type SaveInput = z.infer<typeof SaveBody>;

interface Caller {
  userId: string;
  organizationId: string;
}

function upstreamError(error: GraphError): HttpError {
  return new HttpError(502, "upstream_error", "WhatsApp (Meta) rejected the request", {
    provider: "meta",
    meta_code: error.code,
    meta_message: error.metaMessage,
  });
}

function notConnected(): HttpError {
  return new HttpError(409, "whatsapp_not_connected", "WhatsApp is not connected for this clinic");
}

async function save(req: Request, deps: Deps, caller: Caller, input: SaveInput): Promise<Response> {
  const { db } = deps;
  // Fail before calling Meta or writing anything if credentials could not be encrypted.
  await credentialsKey();

  // Deliberately not scoped to the caller's clinic: a number may belong to one clinic only.
  // Only the owning clinic id is compared; nothing about the other clinic is returned.
  const { data: owner, error: ownerError } = await db
    .from("integration_settings")
    .select("organization_id")
    .eq("phone_number_id", input.phone_number_id)
    .maybeSingle();
  if (ownerError) dbFailure("phone_number_owner", ownerError);
  if (owner && (owner as { organization_id: string }).organization_id !== caller.organizationId) {
    throw new HttpError(409, "phone_number_in_use", "This WhatsApp number is connected to another clinic");
  }

  let info: Awaited<ReturnType<typeof getPhoneNumberInfo>>;
  try {
    info = await getPhoneNumberInfo({
      accessToken: input.access_token,
      phoneNumberId: input.phone_number_id,
      fetchImpl: deps.fetch,
    });
  } catch (error) {
    if (!(error instanceof GraphError)) throw error;
    log.warn("whatsapp_connect.meta_rejected", { http_status: error.status, meta_code: error.code });
    // Nothing is stored: the rejected values are not the clinic's stored credentials, so a typo while
    // replacing them must not flag (and stop) a connection that still works.
    throw upstreamError(error);
  }

  const now = deps.now().toISOString();
  const { data: saved, error: saveError } = await db
    .from("integration_settings")
    .upsert(
      {
        organization_id: caller.organizationId,
        provider: "whatsapp",
        status: "credentials_verified",
        phone_number_id: input.phone_number_id,
        waba_id: input.waba_id,
        display_phone_number: info.displayPhoneNumber,
        verified_name: info.verifiedName,
        credentials_verified_at: now,
        webhook_verified_at: null,
        last_error: null,
        last_error_at: null,
      },
      { onConflict: "organization_id,provider" },
    )
    .select(INTEGRATION_COLUMNS)
    .single();
  if (saveError?.code === "23505") {
    throw new HttpError(409, "phone_number_in_use", "This WhatsApp number is connected to another clinic");
  }
  if (saveError || !saved) dbFailure("integration_upsert", saveError ?? {});
  const integration = saved as unknown as IntegrationRow;

  const verifyToken = randomToken(24);
  try {
    await saveCredentials(db, integration, {
      accessToken: input.access_token,
      appSecret: input.app_secret,
      verifyTokenHash: await sha256Hex(verifyToken),
    });
  } catch (error) {
    // The settings row must not claim verified credentials that were never stored.
    await db
      .from("integration_settings")
      .update({ status: "error", last_error: "Credentials could not be stored", last_error_at: now })
      .eq("id", integration.id)
      .eq("organization_id", caller.organizationId);
    throw error;
  }

  let appSubscribed = false;
  try {
    appSubscribed = await subscribeApp({
      accessToken: input.access_token,
      wabaId: input.waba_id,
      fetchImpl: deps.fetch,
    });
  } catch (error) {
    if (!(error instanceof GraphError)) throw error;
    // Best effort: the owner can subscribe the app in Meta; the response says it did not happen here.
    log.warn("whatsapp_connect.subscribe_failed", { http_status: error.status, meta_code: error.code });
  }

  await writeAudit(db, {
    organizationId: caller.organizationId,
    actorUserId: caller.userId,
    actorType: "user",
    action: "whatsapp.credentials_saved",
    entityType: "integration_settings",
    entityId: integration.id,
    details: { app_subscribed: appSubscribed },
  });

  return json(req, {
    status: "credentials_verified",
    display_phone_number: integration.display_phone_number,
    verified_name: integration.verified_name,
    webhook_url: webhookUrl(integration.webhook_key),
    verify_token: verifyToken,
    app_subscribed: appSubscribed,
  });
}

async function rotateVerifyToken(req: Request, deps: Deps, caller: Caller): Promise<Response> {
  const { db } = deps;
  const integration = await loadIntegration(db, caller.organizationId);
  if (!integration) throw notConnected();

  const verifyToken = randomToken(24);
  const { data: updated, error } = await db
    .from("integration_credentials")
    .update({ verify_token_hash: await sha256Hex(verifyToken) })
    .eq("integration_id", integration.id)
    .eq("organization_id", caller.organizationId)
    .select("integration_id");
  if (error) dbFailure("verify_token_rotate", error);
  if (!Array.isArray(updated) || updated.length === 0) throw notConnected();

  // Meta must complete the handshake again with the new token before the number counts as connected.
  const { error: settingsError } = await db
    .from("integration_settings")
    .update({
      webhook_verified_at: null,
      ...(integration.status === "connected" ? { status: "credentials_verified" } : {}),
    })
    .eq("id", integration.id)
    .eq("organization_id", caller.organizationId);
  if (settingsError) dbFailure("verify_token_reset", settingsError);

  await writeAudit(db, {
    organizationId: caller.organizationId,
    actorUserId: caller.userId,
    actorType: "user",
    action: "whatsapp.verify_token_rotated",
    entityType: "integration_settings",
    entityId: integration.id,
  });

  return json(req, { verify_token: verifyToken, webhook_url: webhookUrl(integration.webhook_key) });
}

async function test(req: Request, deps: Deps, caller: Caller): Promise<Response> {
  const { db } = deps;
  const integration = await loadIntegration(db, caller.organizationId);
  if (!integration || integration.phone_number_id === null || integration.status === "disconnected") {
    throw notConnected();
  }
  const credentials = await loadCredentials(db, integration);
  if (!credentials) throw notConnected();

  let info: Awaited<ReturnType<typeof getPhoneNumberInfo>>;
  try {
    info = await getPhoneNumberInfo({ ...graphConfig(integration, credentials), fetchImpl: deps.fetch });
  } catch (error) {
    if (!(error instanceof GraphError)) throw error;
    log.warn("whatsapp_connect.test_failed", { http_status: error.status, meta_code: error.code });
    await recordIntegrationError(db, integration, error, deps.now());
    throw upstreamError(error);
  }

  // A passing test clears a previous error; "connected" still requires the webhook handshake.
  const { error } = await db
    .from("integration_settings")
    .update({
      display_phone_number: info.displayPhoneNumber,
      verified_name: info.verifiedName,
      credentials_verified_at: deps.now().toISOString(),
      last_error: null,
      last_error_at: null,
      ...(integration.status === "error"
        ? { status: integration.webhook_verified_at ? "connected" : "credentials_verified" }
        : {}),
    })
    .eq("id", integration.id)
    .eq("organization_id", caller.organizationId);
  if (error) dbFailure("integration_test_update", error);

  return json(req, {
    ok: true,
    display_phone_number: info.displayPhoneNumber,
    verified_name: info.verifiedName,
    quality_rating: info.qualityRating,
  });
}

async function disconnect(req: Request, deps: Deps, caller: Caller): Promise<Response> {
  const { db } = deps;
  const integration = await loadIntegration(db, caller.organizationId);
  if (!integration) return json(req, { status: "disconnected" });

  // Secrets go first: if the reset below fails, nothing usable is left behind.
  const { error: deleteError } = await db
    .from("integration_credentials")
    .delete()
    .eq("integration_id", integration.id)
    .eq("organization_id", caller.organizationId);
  if (deleteError) dbFailure("credentials_delete", deleteError);

  const { error } = await db
    .from("integration_settings")
    .update({
      status: "disconnected",
      phone_number_id: null,
      waba_id: null,
      display_phone_number: null,
      verified_name: null,
      credentials_verified_at: null,
      webhook_verified_at: null,
      last_error: null,
      last_error_at: null,
    })
    .eq("id", integration.id)
    .eq("organization_id", caller.organizationId);
  if (error) dbFailure("integration_disconnect", error);

  await writeAudit(db, {
    organizationId: caller.organizationId,
    actorUserId: caller.userId,
    actorType: "user",
    action: "whatsapp.disconnected",
    entityType: "integration_settings",
    entityId: integration.id,
  });

  return json(req, { status: "disconnected" });
}

export function createHandler(getDeps: () => Deps): Handler {
  return async (req: Request, ctx: RequestContext): Promise<Response> => {
    const deps = getDeps();
    const user = await requireUser(req, deps.db);
    const input = parse(Body, await readJson(req, 16 * 1024));
    await requireMembership(deps.db, user.id, input.organization_id, ["owner", "admin"]);
    await rateLimit(deps.db, `wa-connect:user:${user.id}`, 10, 3600);

    const caller: Caller = { userId: user.id, organizationId: input.organization_id };
    log.info("whatsapp_connect.action", {
      request_id: ctx.requestId,
      action: input.action,
      organization_id: caller.organizationId,
    });
    switch (input.action) {
      case "save":
        return await save(req, deps, caller, input);
      case "rotate_verify_token":
        return await rotateVerifyToken(req, deps, caller);
      case "test":
        return await test(req, deps, caller);
      case "disconnect":
        return await disconnect(req, deps, caller);
    }
  };
}
