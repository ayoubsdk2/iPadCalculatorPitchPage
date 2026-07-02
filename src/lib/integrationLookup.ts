// Heuristic classifier for software integration complexity.
// Phaos AI currently has NO completed integrations, so the search UI never
// returns Pre-Built. Recognized SaaS with documented APIs/webhooks → Net-New.
// Anything with no public API or webhooks (or unknown) → Custom.
// The "prebuilt" tier still exists as a counter option in the admin/UI so that
// future completed integrations can be tracked.

export type IntegrationTier = "prebuilt" | "netnew" | "custom";

interface Entry {
  names: string[]; // lowercase aliases
  tier: IntegrationTier;
}

// Net-New: known software with public APIs or webhooks. We can integrate, but
// no native template exists yet — bespoke per customer.
const NET_NEW: Entry[] = [
  { names: ["salesforce", "sfdc"], tier: "netnew" },
  { names: ["hubspot"], tier: "netnew" },
  { names: ["pipedrive"], tier: "netnew" },
  { names: ["zoho"], tier: "netnew" },
  { names: ["zapier"], tier: "netnew" },
  { names: ["make", "integromat"], tier: "netnew" },
  { names: ["google calendar", "gcal"], tier: "netnew" },
  { names: ["google sheets"], tier: "netnew" },
  { names: ["gmail"], tier: "netnew" },
  { names: ["outlook", "microsoft 365", "office 365"], tier: "netnew" },
  { names: ["slack"], tier: "netnew" },
  { names: ["twilio"], tier: "netnew" },
  { names: ["stripe"], tier: "netnew" },
  { names: ["shopify"], tier: "netnew" },
  { names: ["square"], tier: "netnew" },
  { names: ["calendly"], tier: "netnew" },
  { names: ["acuity"], tier: "netnew" },
  { names: ["airtable"], tier: "netnew" },
  { names: ["notion"], tier: "netnew" },
  { names: ["monday"], tier: "netnew" },
  { names: ["clickup"], tier: "netnew" },
  { names: ["asana"], tier: "netnew" },
  { names: ["trello"], tier: "netnew" },
  { names: ["quickbooks", "qbo"], tier: "netnew" },
  { names: ["xero"], tier: "netnew" },
  { names: ["intercom"], tier: "netnew" },
  { names: ["zendesk"], tier: "netnew" },
  { names: ["freshdesk"], tier: "netnew" },
  { names: ["mailchimp"], tier: "netnew" },
  { names: ["sendgrid"], tier: "netnew" },
  { names: ["jobber"], tier: "netnew" },
  { names: ["housecall pro", "housecallpro"], tier: "netnew" },
  { names: ["servicetitan"], tier: "netnew" },
  { names: ["mindbody"], tier: "netnew" },
  { names: ["dentrix"], tier: "netnew" },
  { names: ["athenahealth"], tier: "netnew" },
  { names: ["clio"], tier: "netnew" },
  { names: ["lawpay"], tier: "netnew" },
  { names: ["clover"], tier: "netnew" },
  { names: ["toast"], tier: "netnew" },
  { names: ["square appointments"], tier: "netnew" },
  { names: ["fresha"], tier: "netnew" },
  { names: ["vagaro"], tier: "netnew" },
  { names: ["booker"], tier: "netnew" },
  { names: ["service fusion"], tier: "netnew" },
  { names: ["fieldedge"], tier: "netnew" },
  { names: ["repairshopr"], tier: "netnew" },
  { names: ["dispatch"], tier: "netnew" },
  { names: ["workiz"], tier: "netnew" },
];

const CUSTOM: Entry[] = [
  { names: ["legacy crm", "internal system", "in-house", "in house", "on-prem", "on premise", "custom system", "proprietary"], tier: "custom" },
];

const CATALOG: Entry[] = [...NET_NEW, ...CUSTOM];

export const TIER_META: Record<IntegrationTier, { label: string; setup: number; monthly: number; blurb: string }> = {
  prebuilt: {
    label: "Pre-Built",
    setup: 99,
    monthly: 100,
    blurb: "Native template — drop-in.",
  },
  netnew: {
    label: "Net-New",
    setup: 299,
    monthly: 100,
    blurb: "API or webhooks available — built fresh.",
  },
  custom: {
    label: "Custom",
    setup: 499,
    monthly: 100,
    blurb: "No public API or webhooks — bespoke build.",
  },
};

// Classifier: returns Net-New or Custom only (never Pre-Built).
// Unknown software defaults to Custom — safer pricing assumption.
export function classifyIntegration(query: string): IntegrationTier {
  const q = query.trim().toLowerCase();
  if (!q) return "custom";
  for (const entry of CATALOG) {
    if (entry.names.some((n) => q === n || q.includes(n) || n.includes(q))) {
      return entry.tier;
    }
  }
  // Capability keyword fallback.
  if (/(open api|public api|rest api|graphql|webhook|webhooks)/.test(q)) return "netnew";
  if (/(no api|legacy|no webhook|on-prem|on premise|proprietary)/.test(q)) return "custom";
  // Unknown SaaS → assume bespoke effort.
  return "custom";
}

// Title-case the user-typed query for display
export function prettifySystemName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}
