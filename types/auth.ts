export type UserRole = "admin" | "advertiser";
export type Permission = "VIEW_ALL_ADVERTISERS" | "VIEW_OWN_ADVERTISER" | "MANAGE_CAMPAIGN" | "VIEW_CAMPAIGN" | "MANAGE_OPERATIONS" | "VIEW_OPERATIONS" | "MANAGE_CONNECTIONS" | "VIEW_REPORT" | "MANAGE_SETTINGS" | "MANAGE_ADVERTISER";
export interface SessionUser { id:string; email?:string; name?:string; advertiserIds?:string[]; role:UserRole; advertiserId:string; source:"mock"|"session" }
