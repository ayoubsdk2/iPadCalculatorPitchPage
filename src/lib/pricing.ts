// Phaos AI Voice Agent — bucketed tier pricing.
// minutes = monthlyCalls * 2 (average 2 min per call)

export const MINUTES_PER_CALL = 2;
export const CUSTOM_PRICING_CALL_THRESHOLD = 2500;

export interface Tier {
  min: number;
  max: number; // inclusive (use Infinity for top tier)
  rate: number;
  label: string;
}

export const TIERS: Tier[] = [
  { min: 1, max: 1000, rate: 0.29, label: "Tier 1 · 1–1,000 min" },
  { min: 1001, max: 2000, rate: 0.27, label: "Tier 2 · 1,001–2,000 min" },
  { min: 2001, max: 3000, rate: 0.25, label: "Tier 3 · 2,001–3,000 min" },
  { min: 3001, max: 4000, rate: 0.23, label: "Tier 4 · 3,001–4,000 min" },
  { min: 4001, max: 5000, rate: 0.21, label: "Tier 5 · 4,001–5,000 min" },
];

// Tier 6 is custom-priced and lives outside the bucketed math
export const TIER_6 = {
  min: 5001,
  rateLabel: "Custom",
  label: "Tier 6 · >5,000 min",
};

export function minutesFromCalls(monthlyCalls: number): number {
  return Math.max(0, Math.round(monthlyCalls * MINUTES_PER_CALL));
}

export function tierForMinutes(minutes: number): Tier {
  return TIERS.find((t) => minutes >= t.min && minutes <= t.max) ?? TIERS[0];
}

export function isTier6(minutes: number): boolean {
  return minutes > 5000;
}

export function phaosPriceForCalls(monthlyCalls: number): number {
  const minutes = minutesFromCalls(monthlyCalls);
  if (minutes < 1) return 0;
  const tier = tierForMinutes(minutes);
  return minutes * tier.rate;
}

export function formatUSD(n: number, opts: { cents?: boolean } = {}): string {
  const fractionDigits = opts.cents ? 2 : n % 1 === 0 ? 0 : 2;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

// ============================================================
// Financial savings model
// ============================================================
// Inputs that drive savings:
//   missedCalls         (#2)  — calls per month that go unanswered today
//   missedBookings      (#4)  — bookings lost due to missed/late callbacks
//   avgPrice            (#5)  — average revenue per booking
//   paidAnswering       (#6)  — current monthly cost of paid answering service
//   estAIBookings       (#7)  — bookings the AI is expected to convert
//   refocusedStaff      (#8)  — $/mo of staff time freed up
//   additionalSales     (#9)  — auto: estAIBookings * avgPrice + refocusedStaff
//   resolvePct          slider — % of calls AI is expected to resolve (0–100)
//   roles               total $/hr * minutes/60 across role rows
//   phaosPrice          computed from tiers
//
// Savings formula:
//   recoveredBookingRevenue = missedBookings * avgPrice  (today these are lost)
//   aiBookingRevenue        = additionalSales * (resolvePct / 100)
//   laborSaved              = sum(role.hourlyRate * role.minutes / 60)
//   replacedAnswering       = paidAnswering
//   savings = recoveredBookingRevenue + aiBookingRevenue + laborSaved
//             + replacedAnswering - phaosPrice
// Negative results are allowed (shown as -$X) so users see real economics.
export interface SavingsInputs {
  missedBookings: number;
  avgPrice: number;
  paidAnswering: number;
  additionalSales: number;
  resolvePct: number;
  laborSaved: number;
  phaosPrice: number;
}

export function calcFinancialSavings(i: SavingsInputs): number {
  const slider = Math.max(0, Math.min(100, i.resolvePct)) / 100;
  return (
    Math.max(0, i.additionalSales) +
    Math.max(0, i.laborSaved) * slider +
    Math.max(0, i.paidAnswering)
  );
}

export function savingsBreakdown(i: SavingsInputs) {
  const slider = Math.max(0, Math.min(100, i.resolvePct)) / 100;
  return {
    additionalSales: Math.max(0, i.additionalSales),
    laborReduction: Math.max(0, i.laborSaved) * slider,
    paidAnswering: Math.max(0, i.paidAnswering),
  };
}

export function calcAdditionalSales(
  estAIBookings: number,
  avgPrice: number,
  refocusedStaff: number,
): number {
  return (
    Math.max(0, estAIBookings) * Math.max(0, avgPrice) +
    Math.max(0, refocusedStaff)
  );
}

export function calcRoleMinutes(monthlyCalls: number, pctAnswered: number): number {
  return Math.round(monthlyCalls * MINUTES_PER_CALL * (pctAnswered / 100));
}

// ============================================================
// Advanced pricing
// ============================================================
export interface AdvancedConfigLike {
  phoneLines: number;
  uniqueAgents: number;
  duplicatedAgents: number;
  additionalLanguages: number;
  integrationsPreBuilt: number;
  integrationsNetNew: number;
  integrationsCustom: number;
  capacityBlocks: number;
}

export const ADDON_RATES = {
  phoneLine: { monthly: 10, oneTime: 0 },
  uniqueAgent: { monthly: 50, oneTime: 299 },
  duplicatedAgent: { monthly: 50, oneTime: 99 },
  additionalLanguage: { monthly: 50, oneTime: 0 },
  integrationPreBuilt: { monthly: 100, oneTime: 99 },
  integrationNetNew: { monthly: 100, oneTime: 299 },
  integrationCustom: { monthly: 100, oneTime: 499 },
};

export const CAPACITY_BLOCK = {
  price: 1000,
  minutes: 5000,
  rate: 0.20,
};

export interface CapacityAnnualSavingsDetails {
  monthlyMinutes: number;
  annualMinutes: number;
  tierRate: number;
  committedMinutes: number;
  committedCost: number;
  overageMinutes: number;
  overageCost: number;
  annualCostWithoutBlocks: number;
  annualCostWithBlocks: number;
  savings: number;
  remainingCreditMinutes: number;
}

export function addonsMonthly(a: AdvancedConfigLike): number {
  return (
    a.phoneLines * ADDON_RATES.phoneLine.monthly +
    a.uniqueAgents * ADDON_RATES.uniqueAgent.monthly +
    a.duplicatedAgents * ADDON_RATES.duplicatedAgent.monthly +
    a.additionalLanguages * ADDON_RATES.additionalLanguage.monthly +
    a.integrationsPreBuilt * ADDON_RATES.integrationPreBuilt.monthly +
    a.integrationsNetNew * ADDON_RATES.integrationNetNew.monthly +
    a.integrationsCustom * ADDON_RATES.integrationCustom.monthly
  );
}

export function addonsOneTime(a: AdvancedConfigLike): number {
  return (
    a.phoneLines * ADDON_RATES.phoneLine.oneTime +
    a.uniqueAgents * ADDON_RATES.uniqueAgent.oneTime +
    a.duplicatedAgents * ADDON_RATES.duplicatedAgent.oneTime +
    a.additionalLanguages * ADDON_RATES.additionalLanguage.oneTime +
    a.integrationsPreBuilt * ADDON_RATES.integrationPreBuilt.oneTime +
    a.integrationsNetNew * ADDON_RATES.integrationNetNew.oneTime +
    a.integrationsCustom * ADDON_RATES.integrationCustom.oneTime
  );
}

export function advancedMonthlyPrice(monthlyCalls: number, a: AdvancedConfigLike): number {
  // When at least one capacity block is purchased, the per-minute usage cost
  // is covered by the block reservoir, so we exclude it from the monthly figure.
  const baseUsage = a.capacityBlocks > 0 ? 0 : phaosPriceForCalls(monthlyCalls);
  return baseUsage + addonsMonthly(a);
}

export function capacityAnnualSavingsDetails(
  monthlyCalls: number,
  blocks: number,
): CapacityAnnualSavingsDetails {
  const monthlyMinutes = minutesFromCalls(monthlyCalls);
  const annualMinutes = monthlyMinutes * 12;
  const tierRate = tierForMinutes(monthlyMinutes).rate;
  const committedMinutes = Math.max(0, blocks) * CAPACITY_BLOCK.minutes;
  const committedCost = committedMinutes * CAPACITY_BLOCK.rate;
  const overageMinutes = Math.max(0, annualMinutes - committedMinutes);
  const overageCost = overageMinutes * tierRate;
  const annualCostWithoutBlocks = annualMinutes * tierRate;
  const annualCostWithBlocks = committedCost + overageCost;
  const remainingCreditMinutes = Math.max(0, committedMinutes - annualMinutes);

  return {
    monthlyMinutes,
    annualMinutes,
    tierRate,
    committedMinutes,
    committedCost,
    overageMinutes,
    overageCost,
    annualCostWithoutBlocks,
    annualCostWithBlocks,
    savings: annualCostWithoutBlocks - annualCostWithBlocks,
    remainingCreditMinutes,
  };
}

// Signed annual savings from buying committed capacity blocks.
// Positive = blocks save money vs. tiered usage. Negative = capacity was over-bought.
export function capacityAnnualSavings(monthlyCalls: number, blocks: number): number {
  if (blocks <= 0) return 0;
  return capacityAnnualSavingsDetails(monthlyCalls, blocks).savings;
}


