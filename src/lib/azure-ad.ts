const graphBaseUrl = "https://graph.microsoft.com/v1.0";

type AzureTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type AzureProfile = {
  id?: string;
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
  department?: string;
};

type AzureGroup = {
  id?: string;
  displayName?: string;
};

export type DbRole = "EMPLOYEE" | "MANAGER" | "ADMIN";

export function isAzureSsoConfigured() {
  return Boolean(
    process.env.AZURE_AD_CLIENT_ID &&
      process.env.AZURE_AD_CLIENT_SECRET &&
      process.env.AZURE_AD_TENANT_ID,
  );
}

function tenantId() {
  return process.env.AZURE_AD_TENANT_ID ?? "common";
}

export function appBaseUrl() {
  return process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

export function azureRedirectUri() {
  return process.env.AZURE_AD_REDIRECT_URI ?? `${appBaseUrl()}/api/auth/sso/callback`;
}

function azureScopes() {
  const scopes = ["openid", "profile", "email", "User.Read"];

  if (isAzureManagerSyncEnabled()) {
    scopes.push("User.ReadBasic.All");
  }

  if (isAzureGroupRoleSyncEnabled()) {
    scopes.push("GroupMember.Read.All");
  }

  return scopes;
}

function isFeatureEnabled(value: string | undefined) {
  return value !== "false";
}

export function isAzureManagerSyncEnabled() {
  return isFeatureEnabled(process.env.AZURE_AD_ENABLE_MANAGER_SYNC);
}

export function isAzureGroupRoleSyncEnabled() {
  return isFeatureEnabled(process.env.AZURE_AD_ENABLE_GROUP_ROLE_SYNC);
}

function azureAuthorityUrl(path: "authorize" | "token") {
  return `https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0/${path}`;
}

export function buildAzureAuthorizeUrl(state: string) {
  const url = new URL(azureAuthorityUrl("authorize"));
  url.searchParams.set("client_id", process.env.AZURE_AD_CLIENT_ID ?? "");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", azureRedirectUri());
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", azureScopes().join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url;
}

export async function exchangeAzureCode(code: string) {
  const response = await fetch(azureAuthorityUrl("token"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AZURE_AD_CLIENT_ID ?? "",
      client_secret: process.env.AZURE_AD_CLIENT_SECRET ?? "",
      grant_type: "authorization_code",
      code,
      redirect_uri: azureRedirectUri(),
      scope: azureScopes().join(" "),
    }),
  });

  if (!response.ok) {
    throw new Error(`Microsoft token exchange failed with status ${response.status}.`);
  }

  return (await response.json()) as AzureTokenResponse;
}

async function graphGet<T>(accessToken: string, path: string) {
  const response = await fetch(`${graphBaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Microsoft Graph request failed with status ${response.status}.`);
  return (await response.json()) as T;
}

export async function getAzureProfile(accessToken: string) {
  return graphGet<AzureProfile>(
    accessToken,
    "/me?$select=id,displayName,mail,userPrincipalName,department",
  );
}

export async function getAzureManager(accessToken: string) {
  if (!isAzureManagerSyncEnabled()) return null;

  try {
    return await graphGet<AzureProfile>(
      accessToken,
      "/me/manager?$select=id,displayName,mail,userPrincipalName,department",
    );
  } catch {
    return null;
  }
}

export async function getAzureGroups(accessToken: string) {
  if (!isAzureGroupRoleSyncEnabled()) return [];

  try {
    const result = await graphGet<{ value?: AzureGroup[] }>(
      accessToken,
      "/me/memberOf?$select=id,displayName",
    );
    return result?.value ?? [];
  } catch {
    return [];
  }
}

export function emailFromAzureProfile(profile: AzureProfile) {
  return (profile.mail || profile.userPrincipalName || "").trim().toLowerCase();
}

export function roleFromAzureGroups(groups: AzureGroup[], existingRole?: DbRole): DbRole {
  const adminGroups = configuredGroupKeys(
    process.env.AZURE_AD_ADMIN_GROUP,
    process.env.AZURE_AD_ADMIN_GROUP_ID,
    "WorkSphere-Admins",
  );
  const managerGroups = configuredGroupKeys(
    process.env.AZURE_AD_MANAGER_GROUP,
    process.env.AZURE_AD_MANAGER_GROUP_ID,
    "WorkSphere-Managers",
  );
  const userGroups = groups.flatMap((group) => [
    normalizedKey(group.id),
    normalizedKey(group.displayName),
  ]);

  if (userGroups.some((group) => adminGroups.includes(group))) return "ADMIN";
  if (userGroups.some((group) => managerGroups.includes(group))) return "MANAGER";

  return existingRole === "ADMIN" || existingRole === "MANAGER" ? existingRole : "EMPLOYEE";
}

function configuredGroupKeys(nameValue: string | undefined, idValue: string | undefined, fallbackName: string) {
  return [nameValue ?? fallbackName, idValue]
    .flatMap((value) => (value ?? "").split(","))
    .map(normalizedKey)
    .filter(Boolean);
}

function normalizedKey(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function azureGroupNames(groups: AzureGroup[]) {
  return groups
    .map((group) => group.displayName)
    .filter((name): name is string => Boolean(name));
}
