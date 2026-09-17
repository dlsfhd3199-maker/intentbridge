import { number, percent, won } from "@/lib/format";
import type { MetricComparison } from "@/types/simulation";
export const formatMetric = (value: number | null, format: "count" | "money" | "percent", unit = "건") => value === null ? "산출 불가" : format === "money" ? won(value) : format === "percent" ? percent(value) : `${number(value)}${unit}`;
export const signed = (value: number, suffix = "") => `${value > 0 ? "+" : value < 0 ? "−" : ""}${number(Math.abs(value))}${suffix}`;
export const leverValue = (value: number) => `${value > 0 ? "+" : ""}${value}%`;
export function formatChange(row: MetricComparison): string {
  if (row.change === null) return "비교 불가";
  if (row.format === "percent") return `${row.change > 0 ? "+" : ""}${row.change.toFixed(1)}%p`;
  if (row.id === "totalPurchases") return signed(row.change, "건");
  return row.changePercent === null ? signed(row.change, "원") : `${row.changePercent > 0 ? "+" : ""}${row.changePercent.toFixed(1)}%`;
}
