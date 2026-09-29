import { CODEX_OAUTH_ISSUER, asObject, codexOAuthJwtAccountId, type JsonObject } from "./codex-auth-file.ts";
import { codexOAuthRefreshToken, readCodexOAuthAuthFile, sanitizedCodexOAuthAuth } from "./codex-auth-file.ts";
import type { CredentialFile, Keychain } from "../credentials/keychain.ts";
import { swallow } from "../util/errors.ts";
import { acquireCodexOAuthAuthLock, writeCodexOAuthAuthFile } from "./codex-auth.ts";

export interface CodexAuthStore {
  readonly description: string;
  load(): Promise<JsonObject | null>;
}

const CODEX_OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";

const REFRESH_SKEW_MS = 5 * 60_000;

const CODEX_AUTH_FILE_PATHS = [".codex/auth.json", "codex/auth.json"];

function jwtExpiryMs(token: unknown): number | undefined {
  if (typeof token !== "string" || token.split(".").length !== 3) return undefined;
  try {
    const payload = asObject(JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")));
    return typeof payload?.exp === "number" ? payload.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

export function codexOAuthAccessTokenExpiresAt(auth: JsonObject | null): number | undefined {
  return jwtExpiryMs(asObject(auth?.tokens)?.access_token);
}

export function codexOAuthAuthFromValue(value: unknown): JsonObject | null {
  const auth = asObject(value);
  if (!auth) return null;
  const tokens = asObject(auth.tokens);
  const mode = typeof auth.auth_mode === "string" ? auth.auth_mode : "";
  if (!["chatgpt", "chatgptAuthTokens"].includes(mode)) return null;
  if (
    !tokens ||
    typeof tokens.access_token !== "string" ||
    !tokens.access_token ||
    typeof tokens.refresh_token !== "string" ||
    !tokens.refresh_token ||
    !codexOAuthJwtAccountId(auth)
  )
    return null;
  return auth;
}

export function childCodexAuthFromDerived(derived: {
  accessToken: string;
  idToken: string;
  accountId?: string;
}): JsonObject | null {
  const auth: JsonObject = {
    auth_mode: "chatgpt",
    tokens: {
      access_token: derived.accessToken,
      refresh_token: "",
      id_token: derived.idToken,
      ...(derived.accountId ? { account_id: derived.accountId } : {}),
    },
  };
  if (!derived.accessToken || !codexOAuthJwtAccountId(auth)) return null;
  return auth;
}

export function childCodexOAuthAuth(auth: JsonObject): JsonObject {
  const sanitized = sanitizedCodexOAuthAuth(auth);
  const tokens = asObject(sanitized.tokens);
  if (tokens) {
    const { refresh_token: _refresh, ...rest } = tokens;
    sanitized.tokens = { ...rest, refresh_token: "" };
  }
  return sanitized;
}

async function refreshCodexOAuth(auth: JsonObject, fetchImpl: typeof fetch): Promise<JsonObject | null> {
  const refreshToken = codexOAuthRefreshToken(auth);
  if (!refreshToken) return null;
  const response = await fetchImpl(`${CODEX_OAUTH_ISSUER}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: CODEX_OAUTH_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: "openid profile email",
    }),
  });
  if (!response.ok) throw new Error(`Codex OAuth refresh failed: HTTP ${response.status}`);
  const body = asObject(await response.json().catch(() => null));
  if (!body || typeof body.access_token !== "string" || !body.access_token) {
    throw new Error("Codex OAuth refresh returned no access token");
  }
  const tokens = asObject(auth.tokens) ?? {};
  const next: JsonObject = {
    ...auth,
    last_refresh: new Date().toISOString(),
    tokens: {
      ...tokens,
      access_token: body.access_token,
      ...(typeof body.id_token === "string" && body.id_token ? { id_token: body.id_token } : {}),
      ...(typeof body.refresh_token === "string" && body.refresh_token ? { refresh_token: body.refresh_token } : {}),
    },
  };
  return codexOAuthAuthFromValue(next) && codexOAuthJwtAccountId(next) === codexOAuthJwtAccountId(auth) ? next : null;
}

function authNeedsRefresh(auth: JsonObject, now: number): boolean {
  const expiresAt = codexOAuthAccessTokenExpiresAt(auth);
  return typeof expiresAt === "number" && expiresAt - now < REFRESH_SKEW_MS;
}

interface KeychainCodexAuthStoreDeps {
  keychain: Keychain;
  credentialId: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

function codexAuthFromFiles(files: CredentialFile[]): { path: string; auth: JsonObject } | null {
  for (const file of files) {
    const normalized = file.path.replace(/^\.\//, "");
    if (!CODEX_AUTH_FILE_PATHS.includes(normalized) && !normalized.endsWith("/auth.json")) continue;
    try {
      const auth = codexOAuthAuthFromValue(JSON.parse(Buffer.from(file.contentBase64, "base64").toString("utf8")));
      if (auth) return { path: file.path, auth };
    } catch {}
  }
  return null;
}

export function keychainCodexAuthStore(deps: KeychainCodexAuthStoreDeps): CodexAuthStore {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? Date.now;
  let refreshing: Promise<JsonObject | null> | null = null;

  const readCurrent = async (): Promise<{
    ownerId: string;
    service: string;
    path: string;
    auth: JsonObject;
  } | null> => {
    const meta = await deps.keychain.getCredential(deps.credentialId);
    if (!meta || meta.kind !== "file") return null;
    const bundles = await deps.keychain.materializeOwnFiles(meta.ownerId);
    const bundle = bundles.find((b) => b.credentialId === deps.credentialId);
    if (!bundle) return null;
    const found = codexAuthFromFiles(bundle.files);
    return found ? { ownerId: meta.ownerId, service: meta.service, ...found } : null;
  };

  const persist = async (
    current: { ownerId: string; service: string; path: string },
    replacedRefreshToken: string | undefined,
    next: JsonObject,
  ): Promise<boolean> => {
    const latest = await readCurrent();
    if (!latest || codexOAuthRefreshToken(latest.auth) !== replacedRefreshToken) return false;
    await deps.keychain.save({
      ownerId: current.ownerId,
      service: current.service,
      files: [{ path: current.path, contentBase64: Buffer.from(JSON.stringify(next), "utf8").toString("base64") }],
      ...(codexOAuthAccessTokenExpiresAt(next) !== undefined
        ? { expiresAt: codexOAuthAccessTokenExpiresAt(next) }
        : {}),
    });
    return true;
  };

  return {
    description: `keychain credential ${deps.credentialId}`,
    async load(): Promise<JsonObject | null> {
      const current = await readCurrent();
      if (!current) return null;
      if (!authNeedsRefresh(current.auth, now())) return current.auth;
      refreshing ??= (async () => {
        try {
          const next = await refreshCodexOAuth(current.auth, fetchImpl);
          if (!next) return null;
          await persist(current, codexOAuthRefreshToken(current.auth), next);
          return next;
        } finally {
          refreshing = null;
        }
      })();
      try {
        const refreshed = await refreshing;
        if (refreshed) return refreshed;
      } catch (error) {
        swallow("codex: central oauth refresh", error);
      }
      return (await readCurrent())?.auth ?? current.auth;
    },
  };
}

export function fileCodexAuthStore(
  path: string,
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): CodexAuthStore {
  let refreshing: Promise<JsonObject | null> | null = null;
  return {
    description: `auth file ${path}`,
    async load(): Promise<JsonObject | null> {
      const current = readCodexOAuthAuthFile(path);
      if (!current) return null;
      if (!authNeedsRefresh(current, now())) return current;
      refreshing ??= (async () => {
        try {
          const next = await refreshCodexOAuth(current, fetchImpl);
          if (!next) return null;
          const lock = await acquireCodexOAuthAuthLock(path, undefined, 10_000, 25);
          try {
            const latest = readCodexOAuthAuthFile(path);
            if (!latest || codexOAuthRefreshToken(latest) !== codexOAuthRefreshToken(current)) return latest;
            writeCodexOAuthAuthFile(path, next);
          } finally {
            await lock.release();
          }
          return next;
        } finally {
          refreshing = null;
        }
      })();
      try {
        const refreshed = await refreshing;
        if (refreshed) return refreshed;
      } catch (error) {
        swallow("codex: file oauth refresh", error);
      }
      return readCodexOAuthAuthFile(path) ?? current;
    },
  };
}
