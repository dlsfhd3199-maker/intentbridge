// Closed vocabularies only: never serialize an Error's message, stack, or arbitrary name.
const categories = new Set(["CredentialsSignin", "JWTSessionError", "SignOutError", "AccessDenied", "AdapterError", "Configuration", "MissingSecret", "MissingCSRF", "InvalidCheck", "Verification", "EmailSignInError", "CallbackRouteError", "SessionTokenError", "UnknownAction", "UnsupportedStrategy", "UntrustedHost", "InvalidCallbackUrl"]);
const causes = new Set(["Error", "TypeError", "TimeoutError", "AbortError", "EmailDeliveryError", "InvalidEmailError", "PrismaClientKnownRequestError", "PrismaClientUnknownRequestError", "PrismaClientInitializationError", "PrismaClientValidationError", "PrismaClientRustPanicError"]);
const dbCodes = new Set(["P1000", "P1001", "P1002", "P1003", "P1008", "P1010", "P1011", "P1012", "P1017", "P2002", "P2021", "P2022", "P2024", "P2025"]);
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
export function safeAuthError(error: unknown) {
 const root = object(error);
 let cause = root;
 // Auth.js wraps adapter errors in cause.err; providers may use Error.cause.
 for (let i = 0; i < 4; i++) {
  const nested = object(cause.cause);
  const value = nested.err ?? cause.cause;
  const next = object(value);
  if (!Object.keys(next).length && !(value instanceof Error)) break;
  cause = next;
 }
 const type = typeof root.type === "string" && categories.has(root.type) ? root.type : undefined;
 const name = typeof cause.name === "string" && (causes.has(cause.name) || categories.has(cause.name)) ? cause.name : "UnknownError";
 const candidate = cause.code ?? cause.errorCode;
 const code = typeof candidate === "string" && dbCodes.has(candidate) ? candidate : undefined;
 return {category:type ?? (code || name.startsWith("PrismaClient") ? "DatabaseError" : name === "EmailDeliveryError" ? "EmailDeliveryError" : name === "InvalidEmailError" ? "InvalidEmail" : "AuthenticationError"), causeName:name, databaseCode:code};
}

export function emailLoginDecision(user: {status: string; invitations: {acceptedAt: Date | null; expiresAt: Date}[]} | null, now = new Date()) {
 if (!user) return "user_not_registered";
 if (user.status === "ACTIVE") return "active_user";
 if (user.status === "INVITED") return user.invitations.some(i => !i.acceptedAt && i.expiresAt > now) ? "valid_invitation" : "invitation_not_valid";
 return "user_not_active";
}
export const emailLoginAllowed = (decision: ReturnType<typeof emailLoginDecision>) => decision === "active_user" || decision === "valid_invitation";
