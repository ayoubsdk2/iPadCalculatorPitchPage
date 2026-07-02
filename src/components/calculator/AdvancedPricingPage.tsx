import { useState, type ReactNode } from "react";
import { Minus, Plus, Search, X } from "lucide-react";
import {
  calcStore,
  useCalc,
  DEFAULT_ADVANCED,
  type AdvancedConfig,
  type AddedIntegration,
} from "./store";
import {
  ADDON_RATES,
  TIERS,
  TIER_6,
  addonsMonthly,
  addonsOneTime,
  advancedMonthlyPrice,
  capacityAnnualSavingsDetails,
  formatUSD,
  minutesFromCalls,
  phaosPriceForCalls,
  tierForMinutes,
} from "@/lib/pricing";
import {
  classifyIntegration,
  prettifySystemName,
  TIER_META,
  type IntegrationTier,
} from "@/lib/integrationLookup";
import crownUrl from "@/assets/phaos-crown.png";

// ============================================================
// Hooks
// ============================================================
function useAdvanced(): AdvancedConfig {
  return useCalc((s) => s.advanced) ?? DEFAULT_ADVANCED;
}
function useMonthlyCalls(): number {
  return useCalc((s) => s.values.monthlyCalls) ?? 0;
}
function useEffectiveMonthlyCalls(): number {
  const calls = useCalc((s) => s.values.monthlyCalls) ?? 0;
  const pct = useCalc((s) => s.resolvePct) ?? 100;
  return calls * (pct / 100);
}

// ============================================================
// Counter row
// ============================================================
interface CounterRowProps {
  label: string;
  monthly: number;
  oneTime: number;
  value: number;
  max?: number;
  min?: number;
  onChange: (n: number) => void;
  rowId?: string;
  editCell?: (id: string, label: string, node: ReactNode) => ReactNode;
}
function CounterRow({ label, monthly, oneTime, value, max, min = 0, onChange, rowId, editCell }: CounterRowProps) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1);
  const wrap = (suffix: string, sublabel: string, node: ReactNode) =>
    editCell && rowId ? editCell(`${rowId}-${suffix}`, `${label}: ${sublabel}`, node) : node;
  return (
    <div className="phaos-adv-row">
      {wrap("label", "label",
        <div className="font-extrabold text-[1.05rem] leading-tight text-foreground">{label}</div>
      )}
      {wrap("impl", "implementation fee",
        <div className="text-center font-extrabold text-[1.05rem] tabular-nums">
          {oneTime > 0 ? `$${oneTime}` : "$0"}
        </div>
      )}
      {wrap("monthly", "monthly fee",
        <div className="text-center font-extrabold text-[1.05rem] tabular-nums">${monthly}</div>
      )}
      {wrap("qty", "quantity",
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={dec}
            disabled={value <= min}
            className="h-8 w-8 rounded-full border-2 border-primary/60 text-primary flex items-center justify-center disabled:opacity-30"
            aria-label={`Decrease ${label}`}
            data-no-stage-tap
          >
            <Minus className="h-4 w-4" strokeWidth={3} />
          </button>
          <div className="w-7 text-center font-black text-[1.25rem] tabular-nums text-primary">
            {value}
          </div>
          <button
            type="button"
            onClick={inc}
            disabled={max !== undefined && value >= max}
            className="h-8 w-8 rounded-full bg-primary flex items-center justify-center disabled:opacity-30"
            style={{ color: "#ffffff" }}
            aria-label={`Increase ${label}`}
            data-no-stage-tap
          >
            <Plus className="h-4 w-4" strokeWidth={3} style={{ color: "#ffffff" }} />
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Implementation Fee cell (BLACK price)
// ============================================================
export function ImplFeeCell() {
  const advanced = useAdvanced();
  const detailItems = implementationFeeDetails(advanced);
  const oneTime = 299 + detailItems.reduce((sum, item) => sum + item.amount, 0);
  return (
    <div className="phaos-adv-numeric">
      <div className="phaos-result-box flex flex-col items-center justify-center text-center">
        <div className="text-[1.25rem] min-[1100px]:text-[1.55rem] font-extrabold uppercase text-foreground leading-tight">
          Implementation Fee
        </div>
        <div className="tabular-nums leading-none font-black mt-1 text-[3.4rem] min-[1100px]:text-[3.95rem] text-foreground">
          {formatUSD(oneTime)}
        </div>
      </div>
      {detailItems.length > 0 ? (
        <ul className="phaos-adv-sublines phaos-impl-fee-details">
          {detailItems.map((item) => (
            <li key={item.label}>{item.label} {formatUSD(item.amount)}</li>
          ))}
        </ul>
      ) : (
        <div className="phaos-adv-sublines phaos-impl-fee-details" aria-hidden />
      )}
    </div>
  );
}

function implementationFeeDetails(advanced: AdvancedConfig) {
  const items: Array<{ label: string; amount: number }> = [];
  const push = (count: number, singular: string, oneTime: number) => {
    if (count > 0 && oneTime > 0) {
      items.push({
        label: `${count} ${singular}${count > 1 ? "s" : ""}`,
        amount: count * oneTime,
      });
    }
  };
  push(advanced.duplicatedAgents, "duplicate AI voice agent", ADDON_RATES.duplicatedAgent.oneTime);
  push(advanced.uniqueAgents, "unique AI voice agent", ADDON_RATES.uniqueAgent.oneTime);
  push(advanced.integrationsPreBuilt, "pre-built integration", ADDON_RATES.integrationPreBuilt.oneTime);
  push(advanced.integrationsNetNew, "net-new integration", ADDON_RATES.integrationNetNew.oneTime);
  push(advanced.integrationsCustom, "custom integration", ADDON_RATES.integrationCustom.oneTime);
  return items;
}

// ============================================================
// Implementation Includes — bullets only, editable in admin
// ============================================================
interface ImplIncludesCellProps {
  bullets?: string[];
  layout?: "vertical" | "horizontal";
  editing?: boolean;
  onChange?: (bullets: string[]) => void;
  onLayoutChange?: (layout: "vertical" | "horizontal") => void;
  maxBullets?: number;
}

const ADVANCED_IMPL_INCLUDES_BULLETS = [
  "Live expert assistance from kickoff to go-live",
  "Custom voice, persona & call-flow scripting",
  "Phone number provisioning & porting support",
  "Call flow QA + recorded test calls",
  "Knowledge-base ingestion (FAQ, hours, services)",
  "Two rounds of post-launch tuning",
];

export function ImplIncludesCell({
  bullets = [],
  layout = "vertical",
  editing = false,
  onChange,
  onLayoutChange,
  maxBullets,
}: ImplIncludesCellProps) {
  const fullBullets = editing ? bullets : ADVANCED_IMPL_INCLUDES_BULLETS;
  const visibleCount =
    maxBullets !== undefined && !editing ? Math.max(0, maxBullets) : fullBullets.length;
  const updateBullet = (idx: number, text: string) => {
    if (!onChange) return;
    const next = bullets.slice();
    next[idx] = text;
    onChange(next);
  };
  const addBullet = () => onChange?.([...bullets, "New bullet"]);
  const removeBullet = (idx: number) => onChange?.(bullets.filter((_, i) => i !== idx));

  return (
    <div className="phaos-adv-includes">
      {editing && (
        <div className="flex gap-1 mb-1.5 text-[0.65rem] font-extrabold uppercase" data-no-stage-tap>
          <button
            type="button"
            onClick={() => onLayoutChange?.(layout === "vertical" ? "horizontal" : "vertical")}
            className="px-2 py-0.5 rounded bg-primary/20 text-primary"
          >
            {layout === "vertical" ? "→ Horizontal" : "↓ Vertical"}
          </button>
          <button
            type="button"
            onClick={addBullet}
            className="px-2 py-0.5 rounded bg-primary text-primary-foreground"
          >
            + Bullet
          </button>
        </div>
      )}
      <ul
        className={
          layout === "horizontal"
            ? "flex flex-wrap gap-x-3 gap-y-1.5"
            : "flex flex-col gap-1.5"
        }
      >
        {fullBullets.map((b, idx) => (
          <li
            key={idx}
            className="flex items-center gap-2 group"
            style={idx >= visibleCount ? { visibility: "hidden" } : undefined}
            aria-hidden={idx >= visibleCount || undefined}
          >
            <img
              src={crownUrl}
              alt=""
              aria-hidden
              className="h-5 w-5 shrink-0 object-contain"
              draggable={false}
            />
            {editing ? (
              <input
                value={b}
                onChange={(e) => updateBullet(idx, e.target.value)}
                className="flex-1 bg-transparent border-b border-primary/30 text-[1rem] font-extrabold text-foreground outline-none"
                data-no-stage-tap
              />
            ) : (
              <span className="text-[1.02rem] min-[1100px]:text-[1.12rem] font-extrabold text-foreground leading-tight">
                {b}
              </span>
            )}
            {editing && (
              <button
                type="button"
                onClick={() => removeBullet(idx)}
                className="opacity-50 hover:opacity-100 text-destructive"
                aria-label="Remove bullet"
                data-no-stage-tap
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================
// Annual Savings replacement for Financial Impact panel
// ============================================================
export function AdvancedFinancialPanel() {
  const advanced = useAdvanced();
  const monthlyCalls = useEffectiveMonthlyCalls();
  if (advanced.capacityBlocks <= 0) return null;
  const details = capacityAnnualSavingsDetails(monthlyCalls, advanced.capacityBlocks);
  const rounded = Math.round(details.savings);
  const positive = rounded > 0;
  const valueColor = positive ? "oklch(0.62 0.20 150)" : "oklch(0.58 0.22 25)";
  const savingsDisplay = formatUSD(Math.abs(rounded));
  const normalCostText = formatUSD(Math.round(details.annualCostWithoutBlocks));
  const annualK = `${(details.annualMinutes / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}K`;
  const reconciliationText = details.remainingCreditMinutes > 0
    ? `${details.remainingCreditMinutes.toLocaleString()} min credit remaining.`
    : details.overageMinutes > 0
      ? `${details.overageMinutes.toLocaleString()} min over @ $${details.tierRate.toFixed(2)}.`
      : "Blocks exactly cover usage.";
  return (
    <div className="phaos-adv-numeric">
      <div className="phaos-result-box flex flex-col items-center justify-center text-center">
        <div className="text-[1.25rem] min-[1100px]:text-[1.55rem] font-extrabold uppercase text-foreground leading-tight">
          Annual Savings
        </div>
        <div
          className="tabular-nums leading-none font-black mt-1 text-[3.4rem] min-[1100px]:text-[3.95rem]"
          style={{ color: valueColor }}
        >
          {savingsDisplay}
        </div>
      </div>
      <ul className="phaos-adv-sublines">
        <li>
          vs. {annualK} min @ ${details.tierRate.toFixed(2)} = {normalCostText}
        </li>
        <li>{reconciliationText}</li>
      </ul>
    </div>
  );
}

// ============================================================
// Phaos AI Voice Agent price panel in advanced mode
// ============================================================
export function AdvancedPricePanel() {
  const advanced = useAdvanced();
  const monthlyCalls = useEffectiveMonthlyCalls();
  const rawCalls = useCalc((s) => s.values.monthlyCalls) ?? 0;
  const resolvePct = useCalc((s) => s.resolvePct) ?? 100;
  const total = advancedMonthlyPrice(monthlyCalls, advanced);
  const usagePart = advanced.capacityBlocks > 0 ? 0 : phaosPriceForCalls(monthlyCalls);
  const addonsPart = addonsMonthly(advanced);
  return (
    <div className="phaos-adv-numeric">
      <div className="phaos-result-box flex flex-col items-center justify-center text-center">
        <div className="text-[1.25rem] min-[1100px]:text-[1.55rem] font-extrabold uppercase text-foreground leading-tight">
          Phaos AI Voice Agent
        </div>
        <div className="tabular-nums leading-none font-black mt-1 text-[3.4rem] min-[1100px]:text-[3.95rem] text-primary">
          {formatUSD(Math.round(total))}/mo
        </div>
      </div>
      <ul className="phaos-adv-sublines">
        <li>
          Usage {formatUSD(Math.round(usagePart))} + Add-ons {formatUSD(Math.round(addonsPart))}
        </li>
        <li>
          {advanced.capacityBlocks > 0
            ? "usage drawn from capacity blocks"
            : `${rawCalls.toLocaleString("en-US")} Monthly Calls, ${Math.round(resolvePct)}% AI`}
        </li>
      </ul>
    </div>
  );
}

// ============================================================
// Title
// ============================================================
export function AdvancedTitle({ editPart }: { editPart?: (id: string, label: string, node: ReactNode) => ReactNode } = {}) {
  const wrap = (id: string, label: string, node: ReactNode) =>
    editPart ? editPart(id, label, node) : node;
  return (
    <div className="phaos-adv-title">
      {wrap("adv-title-phaos", "Title: PHAOS", <span className="text-primary">PHAOS</span>)}{" "}
      {wrap("adv-title-ai", "Title: AI", <span className="italic text-primary">AI</span>)}{" "}
      {wrap("adv-title-advanced", "Title: Advanced", <span>Advanced</span>)}{" "}
      {wrap("adv-title-pricing", "Title: Pricing", <span>Pricing</span>)}
    </div>
  );
}

// ============================================================
// Capacity Blocks bar (resized typography per spec)
// ============================================================
export function CapacityBar({ editPart }: { editPart?: (id: string, label: string, node: ReactNode) => ReactNode }) {
  const advanced = useAdvanced();
  const set = (n: number) => calcStore.setAdvanced({ capacityBlocks: Math.max(0, n) });
  const wrap = (id: string, label: string, node: ReactNode) =>
    editPart ? editPart(id, label, node) : node;
  return (
    <div className="phaos-cap-bar">
      <div className="phaos-cap-bar-pill">
        {wrap(
          "capacity-heading",
          "Capacity heading",
          <div className="phaos-cap-bar-label">
            <div className="phaos-cap-committed">Committed</div>
            <div className="phaos-cap-title">Capacity Blocks</div>
          </div>,
        )}
        {wrap(
          "capacity-controls",
          "Capacity block controls",
          <div className="phaos-cap-controls">
            <button
              type="button"
              onClick={() => set(advanced.capacityBlocks - 1)}
              disabled={advanced.capacityBlocks <= 0}
              className="h-10 w-10 rounded-full border-2 border-primary/60 text-primary flex items-center justify-center disabled:opacity-30"
              aria-label="Decrease capacity blocks"
              data-no-stage-tap
            >
              <Minus className="h-4 w-4" strokeWidth={3} />
            </button>
            <div className="w-10 text-center font-black text-[1.75rem] tabular-nums text-primary">
              {advanced.capacityBlocks}
            </div>
            <button
              type="button"
              onClick={() => set(advanced.capacityBlocks + 1)}
              className="h-10 w-10 rounded-full bg-primary flex items-center justify-center"
              style={{ color: "#ffffff" }}
              aria-label="Increase capacity blocks"
              data-no-stage-tap
            >
              <Plus className="h-4 w-4" strokeWidth={3} style={{ color: "#ffffff" }} />
            </button>
          </div>,
        )}
        {wrap(
          "capacity-blurb",
          "Capacity block rate text",
          <div className="phaos-cap-bar-blurb">
            <div className="phaos-cap-blurb-line1">5,000 minutes @ $1,000</div>
            <div className="phaos-cap-blurb-line2">$0.20 per minute block rate</div>
          </div>,
        )}
      </div>
    </div>
  );
}

// ============================================================
// Sections
// ============================================================
const sectionCard = "phaos-adv-section";
const sectionTitle =
  "text-[1.1rem] min-[1100px]:text-[1.25rem] font-extrabold text-foreground uppercase mb-2 tracking-wide text-center";

// Voice Agents & Add-Ons — reordered
export function AddonsSection({
  editHeader,
  editRow,
  editCell,
}: {
  editHeader?: (id: string, label: string, node: ReactNode) => ReactNode;
  editRow?: (id: string, label: string, node: ReactNode) => ReactNode;
  editCell?: (id: string, label: string, node: ReactNode) => ReactNode;
}) {
  const advanced = useAdvanced();
  const set = (patch: Partial<AdvancedConfig>) => calcStore.setAdvanced(patch);
  const wrap = (id: string, label: string, node: ReactNode) =>
    editHeader ? editHeader(id, label, node) : node;
  const wrapRow = (id: string, label: string, node: ReactNode) =>
    editRow ? editRow(id, label, node) : node;
  return (
    <div className={sectionCard}>
      <div className={sectionTitle}>Voice Agents &amp; Add-Ons</div>
      <div className="phaos-adv-row phaos-adv-row-head">
        <div />
        {wrap(
          "addons-hdr-impl",
          "Addons header: Implem. Fee",
          <div className="text-center text-[0.85rem] font-extrabold uppercase tracking-wider text-muted-foreground">
            Implem. Fee
          </div>,
        )}
        {wrap(
          "addons-hdr-monthly",
          "Addons header: Monthly",
          <div className="text-center text-[0.85rem] font-extrabold uppercase tracking-wider text-muted-foreground">
            Monthly
          </div>,
        )}
        {wrap(
          "addons-hdr-qty",
          "Addons header: Qty",
          <div className="text-right text-[0.85rem] font-extrabold uppercase tracking-wider text-muted-foreground pr-1">
            Qty
          </div>,
        )}
      </div>
      {wrapRow("addons-row-phoneLine", "Row: Additional Phone Line",
        <CounterRow
          label="Additional Phone Line"
          monthly={ADDON_RATES.phoneLine.monthly}
          oneTime={ADDON_RATES.phoneLine.oneTime}
          value={advanced.phoneLines}
          onChange={(n) => set({ phoneLines: n })}
          rowId="addons-cell-phoneLine"
          editCell={editCell}
        />
      )}
      {wrapRow("addons-row-language", "Row: Additional Language",
        <CounterRow
          label="Additional Language"
          monthly={ADDON_RATES.additionalLanguage.monthly}
          oneTime={ADDON_RATES.additionalLanguage.oneTime}
          value={advanced.additionalLanguages}
          onChange={(n) => set({ additionalLanguages: n })}
          rowId="addons-cell-language"
          editCell={editCell}
        />
      )}
      {wrapRow("addons-row-duplicate", "Row: Duplicate AI Voice Agent",
        <CounterRow
          label="Duplicate AI Voice Agent"
          monthly={ADDON_RATES.duplicatedAgent.monthly}
          oneTime={ADDON_RATES.duplicatedAgent.oneTime}
          value={advanced.duplicatedAgents}
          onChange={(n) => set({ duplicatedAgents: n })}
          rowId="addons-cell-duplicate"
          editCell={editCell}
        />
      )}
      {wrapRow("addons-row-unique", "Row: Unique AI Voice Agent",
        <CounterRow
          label="Unique AI Voice Agent"
          monthly={ADDON_RATES.uniqueAgent.monthly}
          oneTime={ADDON_RATES.uniqueAgent.oneTime}
          value={advanced.uniqueAgents}
          onChange={(n) => set({ uniqueAgents: n })}
          rowId="addons-cell-unique"
          editCell={editCell}
        />
      )}
    </div>
  );
}

export function IntegrationsSection({
  editHeader,
  editRow,
  editCell,
}: {
  editHeader?: (id: string, label: string, node: ReactNode) => ReactNode;
  editRow?: (id: string, label: string, node: ReactNode) => ReactNode;
  editCell?: (id: string, label: string, node: ReactNode) => ReactNode;
}) {
  const advanced = useAdvanced();
  const set = (patch: Partial<AdvancedConfig>) => calcStore.setAdvanced(patch);
  const wrap = (id: string, label: string, node: ReactNode) =>
    editHeader ? editHeader(id, label, node) : node;
  const wrapRow = (id: string, label: string, node: ReactNode) =>
    editRow ? editRow(id, label, node) : node;
  return (
    <div className={sectionCard}>
      <div className={sectionTitle}>Integrations</div>
      <div className="phaos-adv-row phaos-adv-row-head">
        <div />
        {wrap(
          "intg-hdr-impl",
          "Integrations header: Implem. Fee",
          <div className="text-center text-[0.85rem] font-extrabold uppercase tracking-wider text-muted-foreground">
            Implem. Fee
          </div>,
        )}
        {wrap(
          "intg-hdr-monthly",
          "Integrations header: Monthly",
          <div className="text-center text-[0.85rem] font-extrabold uppercase tracking-wider text-muted-foreground">
            Monthly
          </div>,
        )}
        {wrap(
          "intg-hdr-qty",
          "Integrations header: Qty",
          <div className="text-right text-[0.85rem] font-extrabold uppercase tracking-wider text-muted-foreground pr-1">
            Qty
          </div>,
        )}
      </div>
      {wrapRow("intg-row-prebuilt", "Row: Pre-Built (Open API)",
        <CounterRow
          label="Pre-Built (Open API)"
          monthly={ADDON_RATES.integrationPreBuilt.monthly}
          oneTime={ADDON_RATES.integrationPreBuilt.oneTime}
          value={advanced.integrationsPreBuilt}
          onChange={(n) => set({ integrationsPreBuilt: n })}
          rowId="intg-cell-prebuilt"
          editCell={editCell}
        />
      )}
      {wrapRow("intg-row-netnew", "Row: Net-New (Webhooks)",
        <CounterRow
          label="Net-New (Webhooks)"
          monthly={ADDON_RATES.integrationNetNew.monthly}
          oneTime={ADDON_RATES.integrationNetNew.oneTime}
          value={advanced.integrationsNetNew}
          onChange={(n) => set({ integrationsNetNew: n })}
          rowId="intg-cell-netnew"
          editCell={editCell}
        />
      )}
      {wrapRow("intg-row-custom", "Row: Custom (Legacy)",
        <CounterRow
          label="Custom (Legacy)"
          monthly={ADDON_RATES.integrationCustom.monthly}
          oneTime={ADDON_RATES.integrationCustom.oneTime}
          value={advanced.integrationsCustom}
          onChange={(n) => set({ integrationsCustom: n })}
          rowId="intg-cell-custom"
          editCell={editCell}
        />
      )}
    </div>
  );
}

// ============================================================
// Tiered Usage (Tier 5 = 4,001–5,000; Tier 6 = >5,000 Custom)
// ============================================================
export function TiersSection({
  editHeader,
  editCell,
  selectColumn,
}: {
  editHeader?: (id: string, label: string, node: ReactNode) => ReactNode;
  editCell?: (id: string, label: string, node: ReactNode) => ReactNode;
  selectColumn?: (label: string, ids: string[]) => void;
}) {
  const monthlyCalls = useEffectiveMonthlyCalls();
  const minutes = minutesFromCalls(monthlyCalls);
  const tier6Active = minutes > 5000;
  const activeTier = tierForMinutes(minutes);
  const wrap = (id: string, label: string, node: ReactNode) =>
    editHeader ? editHeader(id, label, node) : node;
  const wrapCell = (id: string, label: string, node: ReactNode) =>
    editCell ? editCell(id, label, node) : node;
  void selectColumn;
  const rowKeys = [...TIERS.map((t) => t.label.split("·")[0].trim().replace(/\s+/g, "")), "Tier6"];
  return (
    <div className={sectionCard}>
      <div className={sectionTitle}>Tiered Monthly Usage</div>
      <table className="w-full text-[1.12rem] border-collapse">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-2.5 pr-1 font-extrabold uppercase tracking-wider text-[0.9rem]">
              {wrap("tiers-hdr-tier", "Tiered Usage header: Tier", <span>Tier</span>)}
            </th>
            <th className="py-2.5 pr-1 font-extrabold uppercase tracking-wider text-[0.9rem]">
              {wrap("tiers-hdr-minutes", "Tiered Usage header: Minutes", <span>Minutes</span>)}
            </th>
            <th className="py-2.5 pr-1 font-extrabold uppercase tracking-wider text-[0.9rem] text-right">
              {wrap("tiers-hdr-rate", "Tiered Usage header: Rate", <span>Rate</span>)}
            </th>
          </tr>
        </thead>

        <tbody>
          {TIERS.map((t, i) => {
            const isActive = !tier6Active && activeTier.label === t.label;
            const k = rowKeys[i];
            return (
              <tr
                key={t.label}
                className={isActive ? "bg-primary/10 font-extrabold text-foreground" : "font-extrabold text-foreground"}
              >
                <td className="py-3 pr-1">
                  {wrapCell(`tiers-cell-tier-${k}`, `${t.label} - Tier`, <span>{t.label.split("·")[0].trim()}</span>)}
                </td>
                <td className="py-3 pr-1 tabular-nums">
                  {wrapCell(`tiers-cell-min-${k}`, `${t.label} - Minutes`, <span>{`${t.min.toLocaleString()}-${t.max.toLocaleString()}`}</span>)}
                </td>
                <td className="py-3 pr-1 text-right tabular-nums">
                  {wrapCell(`tiers-cell-rate-${k}`, `${t.label} - Rate`, <span>${t.rate.toFixed(2)}</span>)}
                </td>
              </tr>
            );
          })}
          <tr className={tier6Active ? "bg-primary/10 font-extrabold text-foreground" : "font-extrabold text-foreground"}>
            <td className="py-3 pr-1">
              {wrapCell("tiers-cell-tier-Tier6", "Tier 6 - Tier", <span>Tier 6</span>)}
            </td>
            <td className="py-3 pr-1 tabular-nums">
              {wrapCell("tiers-cell-min-Tier6", "Tier 6 - Minutes", <span>&gt;5,000</span>)}
            </td>
            <td className="py-3 pr-1 text-right">
              {wrapCell("tiers-cell-rate-Tier6", "Tier 6 - Rate", <span>{TIER_6.rateLabel}</span>)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Integration Search + added list
// ============================================================
const INTEGRATION_SHORTCUTS = [
  "Calendly",
  "GHL",
  "Google Calendar",
  "HubSpot",
  "Jobber",
  "Mindbody",
  "Outlook Calendar",
  "Pipedrive",
  "Salesforce",
  "ServiceTitan",
  "Slack",
  "Stripe",
  "Zendesk",
  "Zenoti",
  "Zoho",
];

interface IntegrationSearchProps {
  openQwerty?: (cfg: {
    label: string;
    initial: string;
    placeholder?: string;
    shortcuts?: string[];
    onCommit: (v: string) => void;
  } | null) => void;
}

export function IntegrationSearch({ openQwerty }: IntegrationSearchProps = {}) {
  const advanced = useAdvanced();
  const added = advanced.addedIntegrations ?? [];
  const [query, setQuery] = useState("");
  const [classified, setClassified] = useState<IntegrationTier | null>(null);
  const [touched, setTouched] = useState(false);

  const runSearchWith = (q: string) => {
    if (!q.trim()) return;
    setTouched(true);
    setClassified(classifyIntegration(q));
  };

  const runSearch = () => runSearchWith(query);

  const launchKeyboard = () => {
    if (!openQwerty) return;
    openQwerty({
      label: "Find my system",
      initial: query,
      placeholder: "Type a system name…",
      shortcuts: INTEGRATION_SHORTCUTS,
      onCommit: (v) => {
        openQwerty(null);
        const trimmed = v.trim();
        setQuery(trimmed);
        if (trimmed) {
          runSearchWith(trimmed);
        } else {
          setClassified(null);
          setTouched(false);
        }
      },
    });
  };

  const addClassified = () => {
    if (!classified) return;
    const name = prettifySystemName(query);
    const id = `intg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    calcStore.addIntegration({ id, name, tier: classified } as AddedIntegration);
    setQuery("");
    setClassified(null);
    setTouched(false);
  };

  return (
    <div className="phaos-search-bar">
      <div className="text-[1.02rem] font-black uppercase tracking-wider text-muted-foreground mb-1 text-center">
        Find My System
      </div>
      <div className="flex items-center gap-2">
        <div
          className="flex-1 flex items-center gap-2 rounded-md border-2 border-primary/40 px-2 py-2 bg-white cursor-text"
          onClick={() => openQwerty && launchKeyboard()}
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            readOnly={!!openQwerty}
            onFocus={() => openQwerty && launchKeyboard()}
            onMouseDown={(e) => {
              if (openQwerty) {
                e.preventDefault();
                launchKeyboard();
              }
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setClassified(null);
              setTouched(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearch();
            }}
            placeholder="Hubspot, GoHighLevel, Zendesk, ServiceTitan…"
            className="flex-1 bg-transparent outline-none text-[1rem] cursor-text"
            data-no-stage-tap
          />
        </div>
        <button
          type="button"
          onClick={runSearch}
          className="phaos-search-btn rounded-md bg-primary px-4 py-2 text-[0.9rem] font-black"
          style={{ color: "#ffffff" }}
          data-no-stage-tap
        >
          <span style={{ color: "#ffffff", fontWeight: 900 }}>SEARCH</span>
        </button>
      </div>
      {touched && classified && (
        <div className="mt-1.5 flex items-center justify-between gap-2 rounded-md bg-primary/10 px-2 py-1.5">
          <span className="text-[0.92rem] leading-tight">
            <span className="font-extrabold text-primary">{TIER_META[classified].label}</span> —{" "}
            {TIER_META[classified].blurb}{" "}
            <span className="text-muted-foreground">
              (${TIER_META[classified].setup} + ${TIER_META[classified].monthly}/mo)
            </span>
          </span>
          <button
            type="button"
            onClick={addClassified}
            className="phaos-add-btn rounded-md bg-primary px-3 py-1.5 text-[0.85rem] font-extrabold text-primary-foreground shrink-0"
            style={{ color: "#ffffff" }}
            data-no-stage-tap
          >
            <span style={{ color: "#ffffff", fontWeight: 900 }}>+ ADD</span>
          </button>
        </div>
      )}
      {added.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {added.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1.5 rounded-md border border-foreground/30 bg-background px-2 py-1 text-[0.9rem] font-black text-foreground"
            >
              {item.name}
              <button
                type="button"
                onClick={() => calcStore.removeIntegration(item.id)}
                className="text-foreground/60 hover:text-destructive"
                aria-label={`Remove ${item.name}`}
                data-no-stage-tap
              >
                <X className="h-3.5 w-3.5" strokeWidth={3} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// GO BACK
// ============================================================
export function AdvancedGoBack({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="phaos-goback" data-no-stage-tap>
      ← GO BACK
    </button>
  );
}

// ============================================================
// Unified System Customization & Add-Ons (replaces L + M columns)
// ============================================================
export function UnifiedAddonsSection({
  editHeader,
  editRow,
  editCell,
  selectColumn,
  visibleRows,
}: {
  editHeader?: (id: string, label: string, node: ReactNode) => ReactNode;
  editRow?: (id: string, label: string, node: ReactNode) => ReactNode;
  editCell?: (id: string, label: string, node: ReactNode) => ReactNode;
  selectColumn?: (label: string, ids: string[]) => void;
  visibleRows?: number;
}) {
  const advanced = useAdvanced();
  const set = (patch: Partial<AdvancedConfig>) => calcStore.setAdvanced(patch);
  const wrapRow = (id: string, label: string, node: ReactNode) =>
    editRow ? editRow(id, label, node) : node;
  const wrapHdr = (id: string, label: string, node: ReactNode) =>
    editHeader ? editHeader(id, label, node) : node;
  void selectColumn;

  const rows: ReactNode[] = [
    wrapRow("addons-row-phoneLine", "Row: Additional Phone Line",
      <CounterRow label="Additional Phone Line" monthly={ADDON_RATES.phoneLine.monthly} oneTime={ADDON_RATES.phoneLine.oneTime} value={advanced.phoneLines} onChange={(n) => set({ phoneLines: n })} rowId="addons-cell-phoneLine" editCell={editCell} />
    ),
    wrapRow("addons-row-language", "Row: Additional Language",
      <CounterRow label="Additional Language" monthly={ADDON_RATES.additionalLanguage.monthly} oneTime={ADDON_RATES.additionalLanguage.oneTime} value={advanced.additionalLanguages} onChange={(n) => set({ additionalLanguages: n })} rowId="addons-cell-language" editCell={editCell} />
    ),
    wrapRow("addons-row-duplicate", "Row: Duplicate AI Voice Agent",
      <CounterRow label="Duplicate AI Voice Agent" monthly={ADDON_RATES.duplicatedAgent.monthly} oneTime={ADDON_RATES.duplicatedAgent.oneTime} value={advanced.duplicatedAgents} onChange={(n) => set({ duplicatedAgents: n })} rowId="addons-cell-duplicate" editCell={editCell} />
    ),
    wrapRow("addons-row-unique", "Row: Unique AI Voice Agent",
      <CounterRow label="Unique AI Voice Agent" monthly={ADDON_RATES.uniqueAgent.monthly} oneTime={ADDON_RATES.uniqueAgent.oneTime} value={advanced.uniqueAgents} onChange={(n) => set({ uniqueAgents: n })} rowId="addons-cell-unique" editCell={editCell} />
    ),
    wrapRow("intg-row-prebuilt", "Row: Pre-Built (Open API)",
      <CounterRow label="Pre-Built (Currently LIVE)" monthly={ADDON_RATES.integrationPreBuilt.monthly} oneTime={ADDON_RATES.integrationPreBuilt.oneTime} value={advanced.integrationsPreBuilt} onChange={(n) => set({ integrationsPreBuilt: n })} rowId="intg-cell-prebuilt" editCell={editCell} />
    ),
    wrapRow("intg-row-netnew", "Row: Net-New (Webhooks)",
      <CounterRow label="Net-New (API/Webhooks)" monthly={ADDON_RATES.integrationNetNew.monthly} oneTime={ADDON_RATES.integrationNetNew.oneTime} value={advanced.integrationsNetNew} onChange={(n) => set({ integrationsNetNew: n })} rowId="intg-cell-netnew" editCell={editCell} />
    ),
    wrapRow("intg-row-custom", "Row: Custom (Legacy)",
      <CounterRow label="Custom (No API/Webhooks)" monthly={ADDON_RATES.integrationCustom.monthly} oneTime={ADDON_RATES.integrationCustom.oneTime} value={advanced.integrationsCustom} onChange={(n) => set({ integrationsCustom: n })} rowId="intg-cell-custom" editCell={editCell} />
    ),
  ];

  const cap = visibleRows === undefined ? rows.length : Math.max(0, Math.min(rows.length, visibleRows));

  return (
    <div className={`${sectionCard} phaos-adv-unified`}>
      <div className={sectionTitle}>System Customization &amp; Add-Ons</div>

      <div className="phaos-adv-row phaos-adv-row-head">
        <div />
        {wrapHdr("unified-hdr-impl", "Header: Implementation Fee",
          <div className="text-center text-[0.9rem] font-extrabold uppercase tracking-wider text-foreground">Implem.</div>
        )}
        {wrapHdr("unified-hdr-monthly", "Header: Monthly Rate",
          <div className="text-center text-[0.9rem] font-extrabold uppercase tracking-wider text-foreground">Monthly</div>
        )}
        {wrapHdr("unified-hdr-qty", "Header: Quantity",
          <div className="text-right text-[0.9rem] font-extrabold uppercase tracking-wider text-foreground pr-1">Quantity</div>
        )}
      </div>

      {rows.map((node, idx) => (
        <div
          key={idx}
          style={idx >= cap ? { visibility: "hidden" } : undefined}
          aria-hidden={idx >= cap || undefined}
        >
          {node}
        </div>
      ))}
    </div>
  );
}

