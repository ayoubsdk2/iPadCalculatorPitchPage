import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Plus, X as XIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import logoUrl from "@/assets/phaos-logo-full.png";
import { QwertyKeyboard } from "./QwertyKeyboard";
import { NumericKeypad } from "./NumericKeypad";
import { calcStore, useCalc, type AdvancedConfig } from "./store";
import { INDUSTRIES } from "@/lib/industry-list";
import { ADDON_RATES, addonsMonthly, addonsOneTime, formatUSD } from "@/lib/pricing";
import { EmbeddedCheckoutModal } from "./EmbeddedCheckoutModal";
import { createPendingOnboarding, createCheckoutSession } from "@/lib/checkout.functions";
import { getStripeEnvironment } from "@/lib/stripe";

interface Props {
  open: boolean;
  onClose: () => void;
}


type Stage = "section" | "signature" | "form" | "done";

const HL = ({ children }: { children: ReactNode }) => (
  <span className="text-primary font-bold">{children}</span>
);
const B = ({ children }: { children: ReactNode }) => (
  <span className="font-bold text-foreground">{children}</span>
);
const G = ({ children }: { children: ReactNode }) => (
  <span className="font-bold" style={{ color: "oklch(0.62 0.20 150)" }}>{children}</span>
);

// Unified, fixed typography anchored to Section 6 density so every section
// has the same perceived font size on iPad.
const TEXT = "text-[1.05rem] leading-[1.45]";
const H = "text-[1.6rem] font-extrabold mb-3";
const H4 = "text-[1.25rem] font-extrabold mt-3";
const TABLE_CELL = "px-3 py-2 border border-foreground/25 align-middle text-[1rem]";
const TABLE_HEAD = `${TABLE_CELL} font-extrabold text-center bg-muted/30`;

interface Section {
  title: ReactNode;
  body: ReactNode;
}

function buildSections(adv: AdvancedConfig): Section[] {
  const monthly = addonsMonthly(adv);
  const addonsOneTimeSum = addonsOneTime(adv);
  const capacityOneTime = Math.max(0, adv.capacityBlocks) * 1000;
  const oneTime = addonsOneTimeSum + capacityOneTime;
  const coreImpl = 299; // core onboarding portion
  const totalImpl = coreImpl + oneTime;


  // Per-implementation value justification for Section 1 breakdown.
  const implBreakdown: Array<{ label: string; qty: number; unit: number; total: number; value: string }> = [];
  const pushImpl = (
    qty: number,
    label: string,
    unit: number,
    value: string,
  ) => {
    if (qty > 0 && unit > 0) implBreakdown.push({ label, qty, unit, total: qty * unit, value });
  };
  pushImpl(
    adv.uniqueAgents,
    "Unique AI Voice Agent",
    ADDON_RATES.uniqueAgent.oneTime,
    "Ground-up persona architecture, custom voice selection, dedicated call-flow scripting, KB ingestion, QA test-call cycles, and live-expert launch tuning for a brand-new agent identity.",
  );
  pushImpl(
    adv.duplicatedAgents,
    "Duplicated AI Voice Agent",
    ADDON_RATES.duplicatedAgent.oneTime,
    "Clone of an existing agent re-provisioned for a second location, line, or department — including telecom setup, isolated routing config, and a fresh QA pass.",
  );
  pushImpl(
    adv.integrationsPreBuilt,
    "Pre-Built Integration",
    ADDON_RATES.integrationPreBuilt.oneTime,
    "Connection to a system Phaos AI already supports: credential setup, workflow mapping, sandbox validation, and go-live monitoring.",
  );
  pushImpl(
    adv.integrationsNetNew,
    "Net-New Integration",
    ADDON_RATES.integrationNetNew.oneTime,
    "Brand-new webhook integration engineered for your stack — endpoint design, auth handshake, payload schema, retry logic, and end-to-end validation.",
  );
  pushImpl(
    adv.integrationsCustom,
    "Custom Integration",
    ADDON_RATES.integrationCustom.oneTime,
    "Complex schema/API work beyond standard webhooks: bespoke data transforms, multi-step orchestration, edge-case handling, and dedicated engineering QA.",
  );
  // Prepaid usage credit — added as a one-time line on the first invoice, NOT recurring.
  pushImpl(
    adv.capacityBlocks,
    "Committed Capacity Block (5,000 min prepaid)",
    1000,
    "Prepaid usage credit at $0.20/min ($1,000 per 5,000-min block). Charged ONCE on your first invoice; drawn down against actual usage. Never recurring.",
  );



  // Dynamic add-on rows for Section 2 (merged).
  const addonRows: Array<{ item: string; qty: number; monthly: number; impl: number }> = [];
  if (adv.phoneLines > 0)
    addonRows.push({ item: "Additional Phone Line", qty: adv.phoneLines, monthly: adv.phoneLines * ADDON_RATES.phoneLine.monthly, impl: adv.phoneLines * ADDON_RATES.phoneLine.oneTime });
  if (adv.uniqueAgents > 0)
    addonRows.push({ item: "Unique AI Voice Agent", qty: adv.uniqueAgents, monthly: adv.uniqueAgents * ADDON_RATES.uniqueAgent.monthly, impl: adv.uniqueAgents * ADDON_RATES.uniqueAgent.oneTime });
  if (adv.duplicatedAgents > 0)
    addonRows.push({ item: "Duplicated AI Voice Agent", qty: adv.duplicatedAgents, monthly: adv.duplicatedAgents * ADDON_RATES.duplicatedAgent.monthly, impl: adv.duplicatedAgents * ADDON_RATES.duplicatedAgent.oneTime });
  if (adv.additionalLanguages > 0)
    addonRows.push({ item: "Additional Language", qty: adv.additionalLanguages, monthly: adv.additionalLanguages * ADDON_RATES.additionalLanguage.monthly, impl: adv.additionalLanguages * ADDON_RATES.additionalLanguage.oneTime });
  if (adv.integrationsPreBuilt > 0)
    addonRows.push({ item: "Pre-Built Integration", qty: adv.integrationsPreBuilt, monthly: adv.integrationsPreBuilt * ADDON_RATES.integrationPreBuilt.monthly, impl: adv.integrationsPreBuilt * ADDON_RATES.integrationPreBuilt.oneTime });
  if (adv.integrationsNetNew > 0)
    addonRows.push({ item: "Net-New Integration", qty: adv.integrationsNetNew, monthly: adv.integrationsNetNew * ADDON_RATES.integrationNetNew.monthly, impl: adv.integrationsNetNew * ADDON_RATES.integrationNetNew.oneTime });
  if (adv.integrationsCustom > 0)
    addonRows.push({ item: "Custom Integration", qty: adv.integrationsCustom, monthly: adv.integrationsCustom * ADDON_RATES.integrationCustom.monthly, impl: adv.integrationsCustom * ADDON_RATES.integrationCustom.oneTime });
  if (adv.capacityBlocks > 0)
    addonRows.push({ item: "Committed Capacity Block (5,000 min prepaid)", qty: adv.capacityBlocks, monthly: 0, impl: adv.capacityBlocks * 1000 });

  // Dynamic "What's included" bullet catalog — only shown for line items the client actually selected.
  const INCLUDED_CATALOG: Array<{ key: keyof AdvancedConfig; qty: number; node: ReactNode }> = [
    { key: "phoneLines", qty: adv.phoneLines, node: <><B>Additional Phone Lines</B> ($10/mo, $0 setup) — dedicated local numbers for segmented routing.</> },
    { key: "uniqueAgents", qty: adv.uniqueAgents, node: <><B>Unique AI Voice Agent</B> ($50/mo, $299 setup) — brand-new persona with independent workflow logic.</> },
    { key: "duplicatedAgents", qty: adv.duplicatedAgents, node: <><B>Duplicated AI Voice Agent</B> ($50/mo, $99 setup) — cloned agent for a second location or line.</> },
    { key: "additionalLanguages", qty: adv.additionalLanguages, node: <><B>Additional Languages</B> ($50/mo, $0 setup) — activates multilingual capabilities on your agent.</> },
    { key: "integrationsPreBuilt", qty: adv.integrationsPreBuilt, node: <><B>Pre-Built Integration</B> ($100/mo, $99 setup) — plug into a system Phaos AI already supports.</> },
    { key: "integrationsNetNew", qty: adv.integrationsNetNew, node: <><B>Net-New Integration</B> ($100/mo, $299 setup) — brand-new webhook integration built for you.</> },
    { key: "integrationsCustom", qty: adv.integrationsCustom, node: <><B>Custom Integration</B> ($100/mo, $499 setup) — complex schema/API work beyond standard webhooks.</> },
    { key: "capacityBlocks", qty: adv.capacityBlocks, node: <><B>Committed Capacity Block</B> ($1,000 one-time per 5,000 min) — prepaid usage credit at $0.20/min. Charged once on your first invoice; never recurring.</> },
  ];
  const includedBullets = INCLUDED_CATALOG.filter((b) => b.qty > 0);


  return [
    // Section 1 — Welcome + Onboarding (with DYNAMIC implementation fee)
    {
      title: <>🏗️ 1. Onboarding &amp; Core Implementation Commitment</>,
      body: (
        <div className={`space-y-3 ${TEXT}`}>
          <p>
            <B>Welcome to the family!</B> We are so incredibly <HL>blessed</HL> and{" "}
            <HL>honored</HL> to partner with you. At Phaos AI, we believe business is
            fundamentally about <HL>serving</HL> others, and we approach our work
            with a spirit of <HL>love</HL>, high <HL>integrity</HL>, and radical{" "}
            <HL>transparency</HL>.
          </p>
          <p>
            This is our <HL>promise</HL> to you. We operate entirely on a
            performance-driven, month-to-month commitment because we believe in
            earning your trust every billing cycle through exceptional utility,
            reliable systems, and an elite service experience.
          </p>
          <p>
            You always retain complete operational autonomy to alter, pause, or{" "}
            <B>cancel services at any time</B>, for any reason, with{" "}
            <B>zero termination penalties or exit fees</B>. Our word is our bond —
            there are absolutely no hidden charges, unexpected maintenance fees, or
            unlisted surcharges outside of the fully transparent rates defined
            below. Let's build something <HL>amazing</HL> together! ✨
          </p>
          <p>
            We commit to delivering a comprehensive, human-guided deployment
            process, carefully crafting your AI Voice Agent to seamlessly mirror
            your real-world workflows and expertly manage your standard inbound
            operations from day one.
          </p>
          <ul className="list-disc pl-7 space-y-1.5">
            <li>
              <B>Implementation Fee:</B> A single, flat, one-time payment of{" "}
              <B>{formatUSD(totalImpl)}</B>{" "}
              <span className="text-muted-foreground italic">
                (core onboarding {formatUSD(coreImpl)}
                {oneTime > 0 ? <> + add-on implementation {formatUSD(oneTime)}</> : null})
              </span>
              .
            </li>
            <li>
              <B>Phaos AI Deliverables:</B>
              <ul className="list-[circle] pl-7 mt-1 space-y-1.5">
                <li><B>Custom Architecture:</B> We will meticulously architect, design, and innovate an AI answering agent specific to your precise business use case, operational rules, and brand voice.</li>
                <li><B>Telecom Provisioning:</B> Allocation of your dedicated forwarding telephone number and careful configuration of the infrastructure from initial build to go-live status.</li>
                <li><B>Human Expert Alignment:</B> Direct, 1-on-1 onboarding collaboration with a live Phaos AI expert structured across two (2) dedicated launch-readiness sessions to thoroughly prepare, test, and inject strict operational guardrails, permissions, and routing parameters.</li>
              </ul>
            </li>
          </ul>

          <h4 className={H4}>Implementation Fee — Line-Item Breakdown</h4>
          <p>
            Every dollar of your <B>{formatUSD(totalImpl)}</B> implementation fee is
            itemized below so you can see exactly what you're getting and why it
            costs what it does. All work is performed by live Phaos AI engineers
            and onboarding experts — nothing is auto-generated or outsourced.
          </p>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TABLE_HEAD}>Line Item</th>
                <th className={TABLE_HEAD}>Qty</th>
                <th className={TABLE_HEAD}>Unit</th>
                <th className={TABLE_HEAD}>Subtotal</th>
                <th className={TABLE_HEAD}>What's Included / Why It Costs This</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={`${TABLE_CELL} font-extrabold`}>Core Onboarding &amp; Launch</td>
                <td className={`${TABLE_CELL} text-center`}>1</td>
                <td className={`${TABLE_CELL} text-center`}>{formatUSD(coreImpl)}</td>
                <td className={`${TABLE_CELL} text-center font-extrabold`}>{formatUSD(coreImpl)}</td>
                <td className={TABLE_CELL}>
                  Custom architecture &amp; call-flow design, telecom
                  provisioning of your dedicated forwarding number, two (2)
                  live 1-on-1 launch-readiness sessions with a Phaos AI expert,
                  guardrail &amp; routing configuration, and full go-live QA.
                </td>
              </tr>
              {implBreakdown.map((r) => (
                <tr key={r.label}>
                  <td className={`${TABLE_CELL} font-extrabold`}>{r.label}</td>
                  <td className={`${TABLE_CELL} text-center`}>{r.qty}</td>
                  <td className={`${TABLE_CELL} text-center`}>{formatUSD(r.unit)}</td>
                  <td className={`${TABLE_CELL} text-center font-extrabold`}>{formatUSD(r.total)}</td>
                  <td className={TABLE_CELL}>{r.value}</td>
                </tr>
              ))}
              <tr>
                <td className={`${TABLE_CELL} font-extrabold text-right bg-muted/20`} colSpan={3}>
                  Total One-Time Implementation Fee
                </td>
                <td className={`${TABLE_CELL} text-center font-extrabold bg-muted/20`}>
                  <G>{formatUSD(totalImpl)}</G>
                </td>
                <td className={`${TABLE_CELL} bg-muted/20 italic text-muted-foreground`}>
                  Billed once, at signing. Zero recurring implementation charges.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ),
    },

    // Section 2 — Merged: Selected Add-Ons, Integrations & Monthly Summary
    {
      title: <>📦 2. Your Selected Add-Ons, Integrations &amp; Monthly Summary</>,
      body: (
        <div className={`space-y-3 ${TEXT}`}>
          <p>
            Everything below is dynamically populated from your selections on
            the calculator. All rates are flat, transparent, and month-to-month —
            you can adjust, pause, or cancel any line at any time.
          </p>

          {addonRows.length === 0 ? (
            <p className="italic text-muted-foreground">
              No add-ons or integrations selected — you're on the base AI Voice Agent only.
            </p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={TABLE_HEAD}>Item</th>
                  <th className={TABLE_HEAD}>Qty</th>
                  <th className={TABLE_HEAD}>Monthly $</th>
                  <th className={TABLE_HEAD}>Implementation (One-Time)</th>
                </tr>
              </thead>
              <tbody className="text-center">
                {addonRows.map((r) => (
                  <tr key={r.item}>
                    <td className={`${TABLE_CELL} font-extrabold text-left`}>{r.item}</td>
                    <td className={TABLE_CELL}>{r.qty}</td>
                    <td className={TABLE_CELL}>{formatUSD(r.monthly)}</td>
                    <td className={TABLE_CELL}>{formatUSD(r.impl)}</td>
                  </tr>
                ))}
                <tr>
                  <td className={`${TABLE_CELL} font-extrabold text-right bg-muted/20`}>Totals</td>
                  <td className={`${TABLE_CELL} bg-muted/20`}></td>
                  <td className={`${TABLE_CELL} font-extrabold bg-muted/20`}>{formatUSD(monthly)}</td>
                  <td className={`${TABLE_CELL} font-extrabold bg-muted/20`}>{formatUSD(oneTime)}</td>
                </tr>
              </tbody>
            </table>
          )}

          {includedBullets.length > 0 && (
            <>
              <h4 className={H4}>What's included with your selections:</h4>
              <ul className="list-disc pl-7 space-y-1.5">
                {includedBullets.map((b) => (
                  <li key={String(b.key)}>{b.node}</li>
                ))}
              </ul>
            </>
          )}


          <h4 className={H4}>Monthly cost summary</h4>
          <ul className="list-disc pl-7 space-y-1.5">
            <li><B>Add-Ons & Integrations Monthly:</B> {formatUSD(monthly)}</li>
            <li><B>One-Time Add-On Implementation:</B> {formatUSD(oneTime)}</li>
            <li><B>Core Onboarding Implementation:</B> {formatUSD(coreImpl)}</li>
            <li><B>Total One-Time Implementation:</B> <G>{formatUSD(totalImpl)}</G></li>
          </ul>
          <p className="italic text-muted-foreground">
            Per-minute usage is billed separately on the tiered schedule shown in
            Section 3 (or under your Committed Capacity Block if purchased).
          </p>
        </div>
      ),
    },

    // Section 3 — Reconciled Monthly Usage Framework (was Section 4)
    {
      title: <>📊 3. Reconciled Monthly Usage Framework</>,
      body: (
        <div className={`space-y-3 ${TEXT}`}>
          <p>
            To actively <HL>protect</HL> your operating margins as your business
            scales, Phaos AI utilizes a strict <B>Usage-Based Graduated Pricing</B>{" "}
            model. You are billed exclusively for the total connected call
            duration; never for rounded-up blocks or artificial monthly minimums.
            Usage costs automatically drop through a <B>graduated tier structure</B>{" "}
            at the close of each monthly billing cycle:
          </p>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TABLE_HEAD}>Billing Tier</th>
                <th className={TABLE_HEAD}>Monthly Volume Bracket</th>
                <th className={TABLE_HEAD}>Per-Minute Usage Rate</th>
                <th className={TABLE_HEAD}>Strategic Focus</th>
              </tr>
            </thead>
            <tbody className="text-center">
              <tr><td className={`${TABLE_CELL} font-extrabold`}>Tier 1</td><td className={TABLE_CELL}>1 to 1,000 minutes</td><td className={`${TABLE_CELL} font-bold`}>$0.29 / min</td><td className={TABLE_CELL}>Absorbs initial infrastructure risk and low-volume setups.</td></tr>
              <tr><td className={`${TABLE_CELL} font-extrabold`}>Tier 2</td><td className={TABLE_CELL}>1,001 to 2,000 minutes</td><td className={`${TABLE_CELL} font-bold`}>$0.27 / min</td><td className={TABLE_CELL}>High-impact rate drop to encourage initial volume adoption.</td></tr>
              <tr><td className={`${TABLE_CELL} font-extrabold`}>Tier 3</td><td className={TABLE_CELL}>2,001 to 3,000 minutes</td><td className={`${TABLE_CELL} font-bold`}>$0.25 / min</td><td className={TABLE_CELL}>Optimizes cost efficiency for highly active local environments.</td></tr>
              <tr><td className={`${TABLE_CELL} font-extrabold`}>Tier 4</td><td className={TABLE_CELL}>3,001 to 4,000 minutes</td><td className={`${TABLE_CELL} font-bold`}>$0.23 / min</td><td className={TABLE_CELL}>Accelerates cost deflation as mid-market scaling occurs.</td></tr>
              <tr><td className={`${TABLE_CELL} font-extrabold`}>Tier 5</td><td className={TABLE_CELL}>4,001 to 5,000 minutes</td><td className={`${TABLE_CELL} font-bold`}>$0.21 / min</td><td className={TABLE_CELL}>Unlocks the absolute floor wholesale rate for high-volume enterprises.</td></tr>
              <tr><td className={`${TABLE_CELL} font-extrabold`}>Tier 6</td><td className={TABLE_CELL}>5,001+</td><td className={`${TABLE_CELL} font-extrabold`}>Custom</td><td className={TABLE_CELL}>Contact for custom pricing</td></tr>
            </tbody>
          </table>
        </div>
      ),
    },

    // Section 4 — Committed Capacity Block + Value Advantage
    {
      title: <>🕊️ 4. Optional Alternative: The "Committed Capacity Block" Advantage</>,
      body: (
        <div className={`space-y-2.5 ${TEXT}`}>
          <p>
            For clients seeking maximum cost efficiency, <HL>peace</HL> of mind,
            and <HL>predictable</HL> overhead, Phaos AI offers the ability to{" "}
            <HL>secure</HL> pre-funded blocks of usage time, bypassing the
            standard graduated tier structure entirely.
          </p>
          <ul className="list-disc pl-7 space-y-1.5">
            <li><B>Capacity &amp; Investment:</B> Each block provides <G>5,000</G> live conversation minutes for a flat investment of <G>$1,000</G>, effectively locking in an exclusive floor rate of <G>$0.20</G> per minute.</li>
            <li><B>12-Month Validity:</B> Unlike standard monthly usage parameters, purchased block minutes remain valid and active for a full 12 months from the date of acquisition.</li>
            <li><B>Operational Reconciliation:</B> Your Phaos AI account treats these blocks as a priority usage reservoir. While you maintain a positive block balance, all live minutes are drawn from this reserve at the locked $0.20/min rate. Once your capacity block is fully depleted, your account <HL>seamlessly</HL> and automatically reverts to the standard month-to-month graduated pricing tiers for all subsequent usage.</li>
          </ul>
          <h4 className={H4}>The <HL>Phaos AI</HL> Value Advantage:</h4>
          <ul className="list-disc pl-7 space-y-1.5">
            <li><B>Massive Cost Reduction:</B> Securing the $0.20/minute block rate represents a nearly <B>31%</B> savings compared to our standard Tier 1 base rate of $0.29/min, giving operations of any size immediate access to enterprise-level pricing <HL>power</HL>.</li>
            <li><B>Budget Predictability &amp; Spike Protection:</B> By pre-funding a 12-month reservoir, businesses can <HL>confidently</HL> forecast annual operational expenses and <HL>shield</HL> themselves from unexpected seasonal volume spikes.</li>
            <li><B>Zero Roll-Over Anxiety:</B> The extended 12-month validity window ensures that your investment remains secure and accessible, allowing your business to utilize its paid capacity entirely on its own timeline.</li>
          </ul>
        </div>
      ),
    },

    // Section 5 — Referral + Billing/Autopay/Cancellation
    {
      title: <>🌱 5. Client Referral &amp; 💳 6. Billing, Autopay &amp; Cancellation Terms</>,
      body: (
        <div className={`space-y-2.5 ${TEXT}`}>
          <p>
            <B>5. Client Referral &amp; Partnership Expansion Loops.</B> We believe
            in <HL>growing</HL> together! Phaos AI actively <HL>rewards</HL>{" "}
            clients and partners who participate in expanding our operational
            ecosystem.
          </p>
          <ul className="list-disc pl-7 space-y-1.5">
            <li><B>The Phaos Growth Credit:</B> Receive a flat <B>$100 statement credit</B> applied directly to your account for every new business referral that signs up for and initiates active service with Phaos AI.</li>
            <li><B>Reseller &amp; White-Label Programs:</B> For partners looking to generate substantial recurring revenue streams, ask our team for custom documentation regarding our reseller tiers. We offer the ability to white-label our proprietary AI voice architecture, allowing you to deliver deep workflow automations to your industry network completely under your own brand identity.</li>
          </ul>
          <p className="pt-1">
            <B>6. Billing, Autopay &amp; Cancellation Terms.</B> To be good <HL>stewards</HL> of our resources, keep administration costs minimal, and maximize savings for our clients, Phaos AI adheres to a strict, simple electronic financial protocol:
          </p>
          <ul className="list-disc pl-7 space-y-1.5">
            <li><B>Standard ACH Autopay:</B> All accounts are <HL>securely</HL> established on automatic ACH billing, processed on the <B>1st or 15th of every calendar month</B>.</li>
            <li><B>Credit Card Surcharge Alternative:</B> Automatic credit card payments are available upon request, subject to a <B>3% surcharge</B> to directly offset third-party merchant processing fees.</li>
            <li><B>Delinquency Safeguards:</B> If an account balance remains unpaid for two (2) consecutive weeks from the billing date, Phaos AI retains the right to temporarily pause all active voice agent services until the balance is brought current. A <B>$20 late fee</B> will be automatically assessed for every two-week period a payment remains unreceived.</li>
            <li><B>Cancellation Protocol:</B> If you ever need to pause or cancel, just drop us a line via email or text so we can seamlessly wind down your services. Upon receipt of cancellation notice, Phaos AI will immediately schedule the discontinuation of voice services and generate a final invoice calculated strictly for usage up to that exact termination date.</li>
            <li>All issued invoices will be paid in full within 2 weeks to avoid unnecessary fees.</li>
          </ul>
          <p>
            We are deeply <HL>grateful</HL> for your <HL>trust</HL> and{" "}
            <HL>excited</HL> to be part of your <HL>success</HL> story! This
            commitment is about so much more than technology; it is a dedicated{" "}
            <HL>partnership</HL> focused on driving your <HL>growth</HL>,
            increasing your revenues, and unlocking an elite level of customer
            attentiveness. <i className="font-bold">Thank you for choosing Phaos AI!</i> 🚀✨
          </p>
        </div>
      ),
    },
  ];
}

type FieldSpec = {
  key: string;
  label: string;
  numeric?: boolean;
  email?: boolean;
  website?: boolean;
  select?: boolean;
  minDigits?: number;
};

const FIELDS: FieldSpec[] = [
  { key: "company", label: "Company Name" },
  { key: "industry", label: "Industry", select: true },
  { key: "contact", label: "Main Contact" },
  { key: "title", label: "Title" },
  { key: "address", label: "Address" },
  { key: "cityState", label: "City, State" },
  { key: "email", label: "Email Address", email: true },
  { key: "website", label: "Website", website: true },
  { key: "bestContact", label: "Best Contact #", numeric: true, minDigits: 10 },
];

const MAX_PHONE_LINES = 3;
const PHONE_MIN_DIGITS = 7;

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}




function CommitmentHeader() {
  return (
    <div
      className="flex items-center justify-center bg-black px-6 py-3 relative shrink-0 border-b border-black"
      style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
    >
      <h2 className="text-white text-2xl md:text-3xl font-extrabold tracking-tight text-center pr-20">
        PHAOS <span className="italic text-primary">AI</span> NEW CLIENT COMMITMENT
      </h2>
      <img src={logoUrl} alt="Phaos AI" className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-auto" />
    </div>
  );
}

export function CommitmentDialog({ open, onClose }: Props) {
  const advanced = useCalc((s) => s.advanced);
  const storedBusiness = useCalc((s) => s.businessName);

  const SECTIONS = useMemo(() => buildSections(advanced), [advanced]);

  const [stage, setStage] = useState<Stage>("section");
  const [idx, setIdx] = useState(0);
  const [hasSignature, setHasSignature] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [phoneLines, setPhoneLines] = useState<string[]>([""]);
  const [showIndustry, setShowIndustry] = useState(false);
  const [qwertyField, setQwertyField] = useState<
    | { kind: "field"; key: string; label: string; email?: boolean }
    | null
  >(null);
  const [numericField, setNumericField] = useState<
    | { kind: "field"; key: string; label: string }
    | { kind: "phone"; index: number }
    | null
  >(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const createOnboardingFn = useServerFn(createPendingOnboarding);
  const createSessionFn = useServerFn(createCheckoutSession);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutClientSecret, setCheckoutClientSecret] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStage("section");
      setIdx(0);
      setHasSignature(false);
      setForm({});
      setPhoneLines([""]);
      setQwertyField(null);
      setNumericField(null);
      setShowIndustry(false);
      setSubmitting(false);
      setCheckoutClientSecret(null);
    } else {
      // Carry forward the business name entered on save
      setForm((f) => ({ ...f, company: f.company || storedBusiness || "" }));
    }
  }, [open, storedBusiness]);


  useEffect(() => {
    if (stage !== "signature") return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    if (c.width !== rect.width * dpr) {
      c.width = rect.width * dpr;
      c.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1a1a1a";
  }, [stage]);

  if (!open) return null;

  const isLast = idx === SECTIONS.length - 1;
  const section = SECTIONS[idx];

  const onAgree = () => {
    if (isLast) setStage("signature");
    else setIdx((i) => Math.min(SECTIONS.length - 1, i + 1));
  };
  const onBack = () => setIdx((i) => Math.max(0, i - 1));

  const startStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return;
    drawing.current = true;
    c.setPointerCapture(e.pointerId);
    const r = c.getBoundingClientRect();
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
  };
  const moveStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const c = canvasRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
    ctx.stroke();
    if (!hasSignature) setHasSignature(true);
  };
  const endStroke = () => { drawing.current = false; };
  const clearSig = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    setHasSignature(false);
  };

  const onAuthorize = () => setStage("form");

  const digitsOf = (s: string) => (s ?? "").replace(/\D/g, "");
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const baseComplete = FIELDS.every((f) => {
    const v = (form[f.key] ?? "").trim();
    if (v.length === 0) return false;
    if (f.email && !EMAIL_RE.test(v)) return false;
    if (f.minDigits && digitsOf(v).length < f.minDigits) return false;
    return true;
  });
  // Phone Line #1 required with >= 10 digits per hardening spec.
  const firstPhoneComplete = digitsOf(phoneLines[0] ?? "").length >= 10;
  const formComplete = baseComplete && firstPhoneComplete;

  const onContinue = async () => {
    if (!formComplete) {
      toast.error(`Please fill in all fields (phone numbers need at least ${PHONE_MIN_DIGITS} digits).`);
      return;
    }
    if (submitting) return;

    // Persist company name back to store so it carries forward.
    if (form.company) calcStore.set({ businessName: form.company });

    // Detect the client's Stripe environment (sandbox vs live) from the client token.
    let environment: "sandbox" | "live";
    try {
      environment = getStripeEnvironment();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payments unavailable";
      toast.error(message);
      return;
    }

    setSubmitting(true);
    const fullState = calcStore.get();

    // Build the payloads the server functions expect.
    const company_data = {
      company_name: form.company ?? "",
      industry: form.industry ?? "",
      main_contact: form.contact ?? "",
      title: form.title ?? "",
      address: form.address ?? "",
      city_state: form.cityState ?? "",
      email_address: form.email ?? "",
      website: form.website ?? "",
      best_contact_number: form.bestContact ?? "",
      phone_lines: phoneLines.filter((p) => digitsOf(p).length >= PHONE_MIN_DIGITS),
    };
    const selected_packages = {
      advanced: fullState.advanced,
      monthlyCalls: fullState.values.monthlyCalls ?? 0,
      resolvePct: fullState.resolvePct ?? 0,
      values: fullState.values,
      roles: fullState.roles,
    };

    try {
      // 1) Persist the pending onboarding row (source of truth for pricing).
      const created = (await createOnboardingFn({
        data: { company_data, selected_packages, environment },
      })) as { onboardingId?: string; error?: string };
      if (!created.onboardingId || created.error) {
        throw new Error(created.error ?? "Failed to save your commitment");
      }

      // 2) Create the Stripe embedded checkout session server-side.
      const returnUrl = `${window.location.origin}/commitment/success`;
      const session = (await createSessionFn({
        data: {
          onboardingId: created.onboardingId,
          environment,
          returnUrl,
        },
      })) as { clientSecret?: string; error?: string };
      if (!session.clientSecret || session.error) {
        throw new Error(session.error ?? "Failed to open secure checkout");
      }

      setCheckoutClientSecret(session.clientSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message, {
        action: { label: "Retry", onClick: () => void onContinue() },
      });
    } finally {
      setSubmitting(false);
    }
  };



  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-stretch justify-stretch"
      data-no-stage-tap
    >
      <div
        className="m-auto bg-white shadow-2xl flex flex-col overflow-hidden border-4 border-primary/40"
        style={{ width: "100dvw", height: "100dvh", paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Black header bar — identical on every stage */}
        <CommitmentHeader />

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-8 md:px-12 py-5 text-foreground">
          {stage === "section" && (
            <article className="w-full h-full flex flex-col">
              <h3 className={H}>{section.title}</h3>
              <div className="flex-1">{section.body}</div>
              <div className="mt-3 text-sm text-muted-foreground">
                Section {idx + 1} of {SECTIONS.length}
              </div>
            </article>
          )}

          {stage === "signature" && (
            <div className="flex flex-col items-center justify-center h-full">
              <p className="text-lg md:text-xl font-semibold mb-3">
                Please sign below to authorize this commitment.
              </p>
              <div className="w-full h-[55vh] max-h-[560px] border-4 border-dashed border-primary/60 rounded-2xl bg-white relative">
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full rounded-2xl touch-none"
                  onPointerDown={startStroke}
                  onPointerMove={moveStroke}
                  onPointerUp={endStroke}
                  onPointerCancel={endStroke}
                />
                {!hasSignature && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-muted-foreground/50 text-2xl italic">
                    Sign here
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={clearSig}
                className="mt-3 text-sm text-primary underline font-semibold"
              >
                Clear signature
              </button>
            </div>
          )}

          {stage === "form" && (
            <div className="h-full flex items-start justify-center pt-4">
              <div className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-4 items-center w-full max-w-4xl">
                {FIELDS.map((f) => {
                  const val = form[f.key] ?? "";
                  const digits = digitsOf(val).length;
                  const needsMore = f.minDigits ? digits > 0 && digits < f.minDigits : false;

                  if (f.select) {
                    return (
                      <div key={f.key} className="contents">
                        <label className="text-right font-bold text-xl md:text-2xl">{f.label}</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowIndustry((v) => !v)}
                            className="w-full text-left rounded-lg border-2 border-primary/40 bg-white px-4 py-3 text-lg md:text-xl min-h-[3.25rem] hover:border-primary transition"
                          >
                            {val || <span className="text-muted-foreground/50 normal-case italic">Select industry…</span>}
                          </button>
                          {showIndustry && (
                            <div className="absolute z-10 mt-1 max-h-[320px] w-full overflow-auto rounded-lg border-2 border-primary/50 bg-white shadow-2xl">
                              {INDUSTRIES.map((name) => (
                                <button
                                  key={name}
                                  type="button"
                                  onClick={() => {
                                    setForm((s) => ({ ...s, [f.key]: name }));
                                    setShowIndustry(false);
                                  }}
                                  className={`block w-full text-left px-4 py-2 text-base hover:bg-primary/10 ${val === name ? "bg-primary/15 font-bold" : ""}`}
                                >
                                  {name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  if (f.website) {
                    return (
                      <div key={f.key} className="contents">
                        <label className="text-right font-bold text-xl md:text-2xl">{f.label}</label>
                        <div className="flex items-center rounded-lg border-2 border-primary/40 bg-white overflow-hidden">
                          <span className="px-3 py-3 text-lg md:text-xl font-bold text-muted-foreground bg-muted/40 border-r border-primary/20">www.</span>
                          <button
                            type="button"
                            onClick={() => setQwertyField({ kind: "field", key: f.key, label: f.label })}
                            className="flex-1 text-left px-4 py-3 text-lg md:text-xl min-h-[3.25rem] lowercase"
                          >
                            {val || <span className="text-muted-foreground/50 normal-case italic">Tap to enter…</span>}
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={f.key} className="contents">
                      <label className="text-right font-bold text-xl md:text-2xl">
                        {f.label}
                        {f.minDigits && <span className="ml-1 text-xs font-normal text-muted-foreground">(min {f.minDigits} digits)</span>}
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          f.numeric
                            ? setNumericField({ kind: "field", key: f.key, label: f.label })
                            : setQwertyField({ kind: "field", key: f.key, label: f.label, email: f.email })
                        }
                        className={`text-left rounded-lg border-2 ${needsMore ? "border-destructive" : "border-primary/40"} bg-white px-4 py-3 text-lg md:text-xl min-h-[3.25rem] hover:border-primary transition ${f.email ? "lowercase" : "uppercase"}`}
                      >
                        {val || <span className="text-muted-foreground/50 normal-case italic">Tap to enter…</span>}
                      </button>
                    </div>
                  );
                })}


                {/* Phone Line (AI Forwarding) section */}
                {phoneLines.map((line, i) => {
                  const digits = digitsOf(line).length;
                  const needsMore = digits > 0 && digits < PHONE_MIN_DIGITS;
                  return (
                    <div key={`pl-${i}`} className="contents">
                      <label className="text-right font-bold text-xl md:text-2xl">
                        {i === 0 ? (
                          <>Phone Line (AI Forwarding) <span className="block text-xs font-normal text-muted-foreground">(min {PHONE_MIN_DIGITS} digits)</span></>
                        ) : ""}
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setNumericField({ kind: "phone", index: i })}
                          className={`flex-1 text-left rounded-lg border-2 ${needsMore ? "border-destructive" : "border-primary/40"} bg-white px-4 py-3 text-lg md:text-xl uppercase min-h-[3.25rem] hover:border-primary transition`}
                        >
                          {line || <span className="text-muted-foreground/50 normal-case italic">Tap to enter…</span>}
                        </button>

                        {i > 0 && (
                          <button
                            type="button"
                            onClick={() => setPhoneLines((ls) => ls.filter((_, j) => j !== i))}
                            aria-label="Remove phone line"
                            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                          >
                            <XIcon className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* + button row, aligned under the input column */}
                {phoneLines.length < MAX_PHONE_LINES && (
                  <div className="contents">
                    <div />
                    <div className="flex justify-start mt-1">
                      <button
                        type="button"
                        onClick={() => setPhoneLines((ls) => (ls.length >= MAX_PHONE_LINES ? ls : [...ls, ""]))}
                        aria-label="Add another phone line"
                        className="flex items-center justify-center h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 active:scale-95 transition"
                      >
                        <Plus className="h-7 w-7" strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}



          {stage === "done" && (
            <div className="flex items-center justify-center h-full text-center px-6">
              <div className="max-w-3xl">
                <div className="text-5xl mb-4">🎉</div>
                <h3 className="text-3xl font-extrabold">Welcome to the family!</h3>
                <p className="mt-2 text-muted-foreground">Your commitment has been recorded.</p>
                <p className="mt-8 text-xl md:text-2xl font-semibold text-foreground leading-relaxed text-center">
                  Thank you for choosing Phaos AI! We are completely confident in the path ahead, and we cannot wait to see your success unfold as we build something truly remarkable together! 🚀✨
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer / actions */}
        <div className="flex items-center justify-between px-10 py-4 border-t bg-muted/30 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Close
          </button>

          <div className="flex items-center gap-4">
            {stage === "section" && idx > 0 && (
              <button
                type="button"
                onClick={onBack}
                className="rounded-xl border-2 border-muted-foreground/40 px-5 py-2.5 text-base font-bold text-muted-foreground hover:bg-muted"
              >
                GO BACK
              </button>
            )}
            {stage === "section" && (
              <button
                type="button"
                onClick={onAgree}
                className="rounded-2xl bg-primary px-10 py-4 text-2xl font-extrabold text-primary-foreground shadow-lg hover:opacity-90"
              >
                {isLast ? "AUTHORIZE" : "I AGREE"}
              </button>
            )}

            {stage === "signature" && (
              <>
                <button
                  type="button"
                  onClick={() => setStage("section")}
                  className="rounded-xl border-2 border-muted-foreground/40 px-5 py-2.5 text-base font-bold text-muted-foreground hover:bg-muted"
                >
                  GO BACK
                </button>
                <button
                  type="button"
                  disabled={!hasSignature}
                  onClick={onAuthorize}
                  className="rounded-2xl bg-primary px-10 py-4 text-2xl font-extrabold text-primary-foreground shadow-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  AUTHORIZE
                </button>
              </>
            )}

            {stage === "form" && (
              <>
                <button
                  type="button"
                  onClick={() => setStage("signature")}
                  className="rounded-xl border-2 border-muted-foreground/40 px-5 py-2.5 text-base font-bold text-muted-foreground hover:bg-muted"
                >
                  GO BACK
                </button>
                <button
                  type="button"
                  disabled={!formComplete || submitting}
                  onClick={() => void onContinue()}
                  className="rounded-2xl bg-primary px-10 py-4 text-2xl font-extrabold text-primary-foreground shadow-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin" />
                      OPENING CHECKOUT…
                    </>
                  ) : (
                    "CONTINUE"
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {checkoutClientSecret && (
        <EmbeddedCheckoutModal
          clientSecret={checkoutClientSecret}
          onClose={() => setCheckoutClientSecret(null)}
        />
      )}




      <QwertyKeyboard
        open={qwertyField !== null}
        label={qwertyField ? qwertyField.label.toUpperCase() : ""}
        emailMode={qwertyField?.email ?? false}
        initialValue={qwertyField ? form[qwertyField.key] ?? "" : ""}
        onCommit={(value) => {
          if (!qwertyField) return;
          const key = qwertyField.key;
          setForm((s) => ({ ...s, [key]: value }));
          setQwertyField(null);
        }}
        onClose={() => setQwertyField(null)}
      />


      <NumericKeypad
        open={numericField !== null}
        label={
          numericField?.kind === "field"
            ? numericField.label
            : numericField?.kind === "phone"
              ? `PHONE LINE ${numericField.index + 1}`
              : ""
        }
        initialValue={(() => {
          if (!numericField) return null;
          const raw =
            numericField.kind === "field"
              ? form[numericField.key] ?? ""
              : phoneLines[numericField.index] ?? "";
          const digits = raw.replace(/\D/g, "");
          return digits ? Number(digits) : null;
        })()}
        allowDecimal={false}
        onCommit={(n) => {
          if (!numericField) return;
          const digits = n === null ? "" : String(Math.trunc(n));
          const formatted = formatPhone(digits);
          if (numericField.kind === "field") {
            const key = numericField.key;
            setForm((s) => ({ ...s, [key]: formatted }));
          } else {
            const i = numericField.index;
            setPhoneLines((ls) => ls.map((v, j) => (j === i ? formatted : v)));
          }
          setNumericField(null);
        }}
        onClose={() => setNumericField(null)}
      />

    </div>
  );
}

