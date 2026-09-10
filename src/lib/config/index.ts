import path from "node:path";

/**
 * Centralized Perseus configuration.
 *
 * Single source of truth for database locations, revenue status rules, and the
 * "data-as-of" anchor. Dashboards, AI, and reporting must read from here rather
 * than hard-coding values so that semantics stay identical across the platform.
 */

const projectRoot = process.cwd();

export const config = {
  /**
   * The dealership operational database. Opened READ ONLY, never modified.
   * Located at the repository root alongside this application.
   */
  dealershipDbPath:
    process.env.PERSEUS_DEALERSHIP_DB ??
    path.join(projectRoot, "perseus_equipment_database.db"),

  /**
   * The Perseus application/config/auth store. This is a SEPARATE database from
   * the dealership data. Created/managed by the app (future milestones).
   */
  appDbPath:
    process.env.PERSEUS_APP_DB ?? path.join(projectRoot, "data", "perseus_app.db"),

  /**
   * Invoice statuses that count as posted (real) revenue.
   * draft / quote / voided / committed are explicitly excluded.
   */
  postedRevenueStatuses: ["finalized", "archived"] as const,
  excludedRevenueStatuses: ["draft", "quote", "voided", "committed"] as const,

  /**
   * Invoice type codes discovered in the data.
   * in = counter/parts sale, wo = work order, rl = rental.
   */
  invoiceTypes: {
    counterSale: "in",
    workOrder: "wo",
    rental: "rl",
  } as const,

  /**
   * The dataset ends 2026-04-29. "Today" (server clock) is later, which would
   * make relative windows like "last 30 days" empty. We anchor relative
   * reporting periods to the latest posted activity in the data instead.
   * This value is validated at runtime by the semantic layer.
   */
  dataAsOfFallback: "2026-04-29",

  /**
   * Deployment target. Hosting = Firebase (project "PERSEUS EQUIPMENT").
   * NOTE: Firebase App Hosting runs Next.js on Cloud Run with an ephemeral
   * filesystem, so the local-file SQLite stores here are for local/dev. All app
   * data goes through getAppDb()/getDealershipDb() so the persistence layer can
   * be swapped (e.g. Cloud SQL / Firestore) for production without touching
   * feature code. Not deployed yet.
   */
  deployment: {
    host: "firebase",
    firebaseProjectName: "PERSEUS EQUIPMENT",
    firebaseProjectId: "perseus-equipment",
    pushed: false,
  },

  brand: {
    name: "Perseus Equipment Intelligence",
    shortName: "Perseus",
    tagline: "Higher insights. Stronger dealerships.",
    promise: "Data with Purpose. Dealerships with Direction.",
    journey: ["SECURE", "OBSERVE", "INVESTIGATE", "UNDERSTAND", "ACT"] as const,
  },
} as const;

export type PerseusConfig = typeof config;
