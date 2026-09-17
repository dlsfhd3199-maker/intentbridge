// Future real adapters must implement these policies; no transport, retry or OAuth executes here.
export type ConnectorErrorCode="DISCONNECTED"|"PERMISSION_REQUIRED"|"INVALID_CREDENTIALS"|"RATE_LIMITED"|"TIMEOUT"|"UNAVAILABLE";
export interface ConnectorFailure { code:ConnectorErrorCode; message:string; retryAfterMs?:number; retryable:boolean }
export interface ConnectorRequestPolicy { timeoutMs:number; retry:{maxAttempts:number;baseDelayMs:number;maxDelayMs:number}; onRateLimit:"fail"|"respect-retry-after" }
export interface RealConnectorContract<TQuery,TResult> { readonly mode:"real"; validateConfiguration():Promise<{valid:boolean;missingNames:string[]}>; execute(query:TQuery,policy:ConnectorRequestPolicy):Promise<{ok:true;data:TResult}|{ok:false;error:ConnectorFailure}> }
export const futureRequestPolicy:ConnectorRequestPolicy={timeoutMs:10000,retry:{maxAttempts:3,baseDelayMs:500,maxDelayMs:5000},onRateLimit:"respect-retry-after"};
