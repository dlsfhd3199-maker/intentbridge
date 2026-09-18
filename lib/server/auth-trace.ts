import {safeAuthError} from "../auth-diagnostics";
import {log} from "./logger";
import {requestContext} from "./request-context";
export function authTrace(event: string, authStage: string, reason?: string) {
 log("info", event, {requestId:requestContext()?.requestId, authStage, reason});
}
export function authFailure(event: string, authStage: string, error: unknown, status?: number) {
 const context = requestContext();
 // Email delivery and verification-token writes run concurrently. Preserve the failing stage.
 if (context) context.authFailureStage ??= authStage;
 log("error", event, {requestId:context?.requestId, authStage, ...safeAuthError(error), status});
}
export async function authOperation<T>(stage: string, fn: () => Promise<T>): Promise<T> {
 authTrace(`auth.${stage}.started`, stage);
 try { const result = await fn(); authTrace(`auth.${stage}.completed`, stage); return result; }
 catch (error) {authFailure("auth.operation.failed", stage, error); throw error;}
}
