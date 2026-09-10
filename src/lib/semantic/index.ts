import "server-only";
import { METRICS } from "@/lib/semantic/metrics";
import * as q from "@/lib/semantic/queries";

export { METRICS } from "@/lib/semantic/metrics";
export type { MetricDefinition, MetricId } from "@/lib/semantic/metrics";
export * as semanticQueries from "@/lib/semantic/queries";

/**
 * Compute the headline metric snapshot used to validate the semantic layer.
 * This is a foundation-milestone read-only smoke test, not a dashboard.
 */
export interface MetricSnapshot {
  dataAsOf: string | undefined;
  postedRevenue: number;
  invoiceCount: number;
  averageInvoiceValue: number;
  activeCustomers: number;
  partsRevenue: number;
  estimatedPartsMargin: number;
  inventory: q.InventoryValue;
  openWorkOrders: number;
  technicianLaborHours: number;
  revenueByYear: Array<{ year: string; invoices: number; revenue: number }>;
}

export function computeMetricSnapshot(): MetricSnapshot {
  const dataAsOf = q.getDataAsOfDate();
  return {
    dataAsOf,
    postedRevenue: q.getPostedRevenue(),
    invoiceCount: q.getInvoiceCount(),
    averageInvoiceValue: q.getAverageInvoiceValue(),
    activeCustomers: q.getActiveCustomers(dataAsOf),
    partsRevenue: q.getPartsRevenue(),
    estimatedPartsMargin: q.getEstimatedPartsMargin(),
    inventory: q.getInventoryValue(),
    openWorkOrders: q.getOpenWorkOrders(),
    technicianLaborHours: q.getTechnicianLaborHours(),
    revenueByYear: q.getRevenueByYear(),
  };
}

export const metricCount = Object.keys(METRICS).length;
