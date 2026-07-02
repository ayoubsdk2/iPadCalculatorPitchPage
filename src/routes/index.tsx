import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Eye, FolderOpen, Mail, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { NumericKeypad } from "@/components/calculator/NumericKeypad";
import { QwertyKeyboard } from "@/components/calculator/QwertyKeyboard";
import { ValueCell } from "@/components/calculator/ValueCell";
import { RevealCell } from "@/components/calculator/RevealCell";
import { BulletsGrid } from "@/components/calculator/BulletsGrid";
import { TitleBanner } from "@/components/calculator/TitleBanner";
import { EmailDialog } from "@/components/calculator/EmailDialog";
import { CommitmentDialog } from "@/components/calculator/CommitmentDialog";
import { AuthGateDialog, isAuthGateValid } from "@/components/calculator/AuthGateDialog";
import { StatQuoteDialog, CELL_QUOTES } from "@/components/calculator/StatQuoteDialog";
import {
  AddonsSection,
  AdvancedFinancialPanel,
  AdvancedGoBack,
  AdvancedPricePanel,
  AdvancedTitle,
  CapacityBar,
  ImplFeeCell,
  ImplIncludesCell,
  IntegrationSearch,
  IntegrationsSection,
  TiersSection,
  UnifiedAddonsSection,
} from "@/components/calculator/AdvancedPricingPage";
import { EditableTarget, type EditableSelectOptions } from "@/components/admin/EditableTarget";

import {
  calcStore,
  currentStep,
  isAdditionalSalesVisible,
  isCellVisible,
  isRoleVisible,
  isSliderVisible,
  useCalc,
  type CalcState,
  type CellKey,
  type RoleRow,
} from "@/components/calculator/store";
import {
  CUSTOM_PRICING_CALL_THRESHOLD,
  addonsMonthly,
  addonsOneTime,
  calcAdditionalSales,
  calcFinancialSavings,
  capacityAnnualSavingsDetails,
  calcRoleMinutes,
  formatUSD,
  minutesFromCalls,
  phaosPriceForCalls,
  savingsBreakdown,
} from "@/lib/pricing";
import logoUrl from "@/assets/phaos-logo-full.png";
import {
  DEFAULT_LAYOUT_SETTINGS,
  type CustomTextElement,
  type EditableOverride,
  type EditableOverrides,
  type LayoutSettings,
} from "@/lib/layout-settings";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Phaos AI — Real-World Voice Agent Impact Calculator" },
      {
        name: "description",
        content:
          "Interactive iPad-first calculator that shows the real-world financial impact of deploying a Phaos AI Voice Agent.",
      },
    ],
  }),
  component: CalculatorPage,
});

interface CellMeta {
  key: CellKey;
  title: string;
  prefix?: string;
  suffix?: string;
  allowDecimal?: boolean;
}

const CELL_META: Record<CellKey, CellMeta> = {
  monthlyCalls: { key: "monthlyCalls", title: "Monthly Calls" },
  missedCalls: { key: "missedCalls", title: "Missed Calls" },
  callbackTime: { key: "callbackTime", title: "Callback Time", suffix: "hrs" },
  missedBookings: { key: "missedBookings", title: "Missed Bookings" },
  avgPrice: { key: "avgPrice", title: "Average Price", prefix: "$", allowDecimal: true },
  paidAnswering: { key: "paidAnswering", title: "Paid Answering", prefix: "$", allowDecimal: true },
  estAIBookings: { key: "estAIBookings", title: "# Estimated AI Bookings" },
  refocusedStaff: {
    key: "refocusedStaff",
    title: "Refocused Staff ↑ $",
    prefix: "$",
    allowDecimal: true,
  },
};

const ORDER: CellKey[] = [
  "monthlyCalls",
  "missedCalls",
  "callbackTime",
  "missedBookings",
  "estAIBookings",
  "refocusedStaff",
  "paidAnswering",
  "avgPrice",
];

type EditStatus = "off" | "checking" | "active" | "denied";
type AuthIntent = "save" | "sold" | "email" | "file";
type SavedCalculation = {
  id: string;
  company_name: string;
  created_at: string;
  user_id: string;
};

const COMPLEX_EDITABLE_IDS = new Set([
  "advanced-implementation-fee",
  "advanced-financial",
  "advanced-price",
  "advanced-impl-includes",
  "advanced-capacity-bar",
  "advanced-addons",
  "advanced-integrations",
  "advanced-tiered-usage",
  "advanced-integration-search",
  "advanced-logo",
  "advanced-cta",
  "advanced-column-left",
  "advanced-column-mid",
  "advanced-column-right",
]);

// Previously locked Advanced Pricing element IDs were excluded from public
// override application, which prevented the painstakingly arranged saved
// layout from appearing for public visitors. The saved layout in
// `layout_settings` IS the source of truth (per the reference screenshots),
// so the public view must apply every saved override. Leave this set empty
// so all saved positions, sizes, and text edits render publicly.
const ADVANCED_PRICING_LOCKED_IDS = new Set<string>([]);

// In /superadmin mode, only these top-level Advanced Pricing cells are editable.
// Everything else (titles, internal rows, columns) is locked so the admin can
// only move/resize whole cells.
const SUPERADMIN_CELL_IDS = new Set([
  "advanced-financial",
  "advanced-price",
  "advanced-implementation-fee",
  "advanced-impl-includes",
  "advanced-title",
  "advanced-capacity-bar",
  "advanced-unified-addons",
  "advanced-tiered-usage",
  "advanced-integration-search",
  "advanced-logo",
  "advanced-cta",
]);

function sanitizeElementOverrides(overrides: EditableOverrides): EditableOverrides {
  // Keep everything the admin set. Previously stripped `text` on complex IDs,
  // which silently reverted text edits after save and made it look like saves
  // weren't sticking.
  return { ...overrides };
}

function snapshotCalculation(s: CalcState) {
  return JSON.parse(JSON.stringify({
    values: s.values,
    roles: s.roles,
    resolvePct: s.resolvePct,
    advanced: s.advanced,
    financials: {
      monthlyCalls: s.values.monthlyCalls ?? 0,
    },
  })) as Json;
}

function CalculatorPage() {
  const state = useCalc((s) => s);
  const step = currentStep(state);

  const stageRef = useRef<HTMLDivElement>(null);
  const [keypadFor, setKeypadFor] = useState<CellKey | null>(null);
  const [quoteFor, setQuoteFor] = useState<CellKey | null>(null);
  const [factsOpen, setFactsOpen] = useState(false);
  const [customPricingOpen, setCustomPricingOpen] = useState(false);
  const [commitmentOpen, setCommitmentOpen] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const [fileRows, setFileRows] = useState<SavedCalculation[]>([]);
  const [fileLoading, setFileLoading] = useState(false);
  const [restorePrompt, setRestorePrompt] = useState<SavedCalculation | null>(null);
  const [emailFileTarget, setEmailFileTarget] = useState<SavedCalculation | null>(null);
  const [emailFileTo, setEmailFileTo] = useState("");
  const [emailFileSending, setEmailFileSending] = useState(false);

  const [textEdit, setTextEdit] = useState<null | {
    id: string;
    label: string;
    value: string;
    stylePatch: EditableOverride;
  }>(null);
  const [qwertyFor, setQwertyFor] = useState<null | {
    label: string;
    initial: string;
    placeholder?: string;
    shortcuts?: string[];
    onCommit: (v: string) => void;
  }>(null);
  const [roleNumPad, setRoleNumPad] = useState<null | {
    label: string;
    initial: number | null;
    prefix?: string;
    suffix?: string;
    allowDecimal?: boolean;
    max?: number;
    onCommit: (v: number | null) => void;
  }>(null);

  const [emailOpen, setEmailOpen] = useState(false);
  const [authGateOpen, setAuthGateOpen] = useState<null | AuthIntent>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editStatus, setEditStatus] = useState<EditStatus>("off");
  const [selectedEditId, setSelectedEditId] = useState<string | null>(null);
  const [selectedEditIds, setSelectedEditIds] = useState<string[]>([]);
  const [selectionScope, setSelectionScope] = useState<"solo" | "row" | "column">("solo");
  const [selectedEditLabel, setSelectedEditLabel] = useState("");
  const [elementOverrides, setElementOverrides] = useState<EditableOverrides>({});
  const [savedElementOverrides, setSavedElementOverrides] = useState<EditableOverrides>({});
  const [layoutSettings, setLayoutSettings] = useState<LayoutSettings>(DEFAULT_LAYOUT_SETTINGS);
  const [savedLayoutSettings, setSavedLayoutSettings] = useState<LayoutSettings>(DEFAULT_LAYOUT_SETTINGS);
  const [savingLayout, setSavingLayout] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [superadminMode, setSuperadminMode] = useState(false);
  const [toolbarSide, setToolbarSide] = useState<"left" | "right">(() => {
    if (typeof window === "undefined") return "right";
    return (window.localStorage.getItem("phaos-edit-toolbar-side") as "left" | "right") || "right";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("phaos-edit-toolbar-side", toolbarSide);
    }
  }, [toolbarSide]);


  const additionalSales = useMemo(
    () =>
      calcAdditionalSales(
        state.values.estAIBookings ?? 0,
        state.values.avgPrice ?? 0,
        state.values.refocusedStaff ?? 0,
      ),
    [state.values.estAIBookings, state.values.avgPrice, state.values.refocusedStaff],
  );

  const monthlyCalls = state.values.monthlyCalls ?? 0;
  const effectiveCalls = monthlyCalls * ((state.resolvePct ?? 100) / 100);
  const minutes = minutesFromCalls(monthlyCalls);
  const phaosPrice = phaosPriceForCalls(effectiveCalls);
  const overThreshold = monthlyCalls > CUSTOM_PRICING_CALL_THRESHOLD;

  const laborSaved = useMemo(() => {
    return state.roles.reduce((sum, r) => {
      if (!r.hourlyRate || !r.pctAnswered) return sum;
      const mins = calcRoleMinutes(monthlyCalls, r.pctAnswered);
      return sum + (r.hourlyRate * mins) / 60;
    }, 0);
  }, [state.roles, monthlyCalls]);

  const savingsInputs = {
    missedBookings: state.values.missedBookings ?? 0,
    avgPrice: state.values.avgPrice ?? 0,
    paidAnswering: state.values.paidAnswering ?? 0,
    additionalSales,
    resolvePct: state.resolvePct ?? 0,
    laborSaved,
    phaosPrice,
  };
  const financialSavings = useMemo(
    () => calcFinancialSavings(savingsInputs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      savingsInputs.missedBookings,
      savingsInputs.avgPrice,
      savingsInputs.paidAnswering,
      savingsInputs.additionalSales,
      savingsInputs.resolvePct,
      savingsInputs.laborSaved,
    ],
  );
  const breakdown = useMemo(
    () => savingsBreakdown(savingsInputs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      savingsInputs.missedBookings,
      savingsInputs.avgPrice,
      savingsInputs.paidAnswering,
      savingsInputs.additionalSales,
      savingsInputs.resolvePct,
      savingsInputs.laborSaved,
    ],
  );

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (overThreshold && editStatus !== "active") setCustomPricingOpen(true);
  }, [overThreshold, editStatus]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("layout_settings")
        .select("settings")
        .eq("id", "singleton")
        .maybeSingle();
      if (cancelled) return;
      const remote = (data?.settings ?? {}) as LayoutSettings;
      const merged = { ...DEFAULT_LAYOUT_SETTINGS, ...remote, elements: remote.elements ?? {} };
      const cleanElements = sanitizeElementOverrides(merged.elements ?? {});
      const cleanMerged = { ...merged, elements: cleanElements };
      setLayoutSettings(cleanMerged);
      setSavedLayoutSettings(cleanMerged);
      setElementOverrides(cleanElements);
      setSavedElementOverrides(cleanElements);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const adminRequested = params.get("adminEdit") === "1";
    const superRequested = params.get("superadminEdit") === "1";
    if (!adminRequested && !superRequested) return;
    if (superRequested) {
      setSuperadminMode(true);
      // Land directly in Advanced Pricing for superadmin cell editing.
      calcStore.set({ advancedOpen: true, advancedStage: 0 });
    }
    setEditStatus("checking");
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setEditStatus("denied");
        return;
      }
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      setEditStatus(roleRow ? "active" : "denied");
    })();
  }, []);

  const handleStageTap = () => {
    if (editStatus === "active") return;
    const s = calcStore.get();
    if (s.advancedOpen) {
      if (s.advancedStage < 15) {
        calcStore.set({ advancedStage: s.advancedStage + 1 });
      }
      return;
    }
    if (s.revealedSavings && s.revealedPrice && s.bulletsShown < 6) {
      calcStore.set({
        bulletsShown: s.bulletsShown + 1,
        revealedItalics: s.bulletsShown + 1 >= 6,
      });
      return;
    }
    if (s.bulletsShown >= 6 && (!s.showImSold || !s.showAdvanced)) {
      calcStore.set({ showImSold: true, showAdvanced: true });
    }
  };

  const wrapRef = useRef<HTMLDivElement>(null);

  const isIOS = () => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    return (
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" &&
        (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1)
    );
  };

  const toggleLive = async () => {
    // On iOS, avoid the native Fullscreen API (triggers Safari's
    // "typing in full screen" warning) and preserve the exact iPad webapp layout.
    if (isIOS()) {
      wrapRef.current?.classList.remove("phaos-pseudo-fullscreen");
      setIsFullscreen((prev) => !prev);
      return;
    }
    try {
      const fsElement =
        document.fullscreenElement ||
        (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement;
      if (fsElement) {
        const exit =
          document.exitFullscreen?.bind(document) ||
          (document as Document & { webkitExitFullscreen?: () => Promise<void> })
            .webkitExitFullscreen;
        await exit?.();
      } else {
        const el = wrapRef.current as
          | (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> })
          | null;
        const req = el?.requestFullscreen?.bind(el) || el?.webkitRequestFullscreen?.bind(el);
        if (req) await req();
        else toast("LIVE mode: rotate your iPad to landscape for full fit.");
      }
    } catch {
      toast.error("Fullscreen is not available in this browser.");
    }
  };

  const onReset = () => {
    if (!confirm("Reset all values and start a fresh calculation?")) return;
    calcStore.reset();
    toast("Cleared.");
  };
  const saveCalculation = async (name: string) => {
    const companyName = name.trim();
    if (!companyName) return false;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setAuthGateOpen("save");
      return false;
    }
    const { error } = await supabase.from("saved_calculations").insert({
      user_id: user.id,
      company_name: companyName,
      calculator_state: snapshotCalculation(calcStore.get()),
    });
    if (error) {
      toast.error(error.message);
      return false;
    }
    calcStore.set({ businessName: companyName });
    toast.success(`Saved "${companyName}" to Files.`);
    return true;
  };

  const onSave = (afterSave?: () => void) => {
    setQwertyFor({
      label: "Business name for this saved calculation",
      initial: "",
      placeholder: "Business name",
      onCommit: async (v) => {
        setQwertyFor(null);
        if (!v) return;
        const saved = await saveCalculation(v);
        if (saved) afterSave?.();
      },
    });
  };
  const onFile = async () => {
    setFileOpen(true);
    setFileLoading(true);
    const { data, error } = await supabase
      .from("saved_calculations")
      .select("id, company_name, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(100);
    setFileLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setFileRows((data ?? []) as SavedCalculation[]);
  };

  const applyRestoredState = (payload: any) => {
    if (!payload || typeof payload !== "object") return;
    const patch: Partial<CalcState> = {};
    if (payload.values) patch.values = payload.values;
    if (payload.roles) patch.roles = payload.roles;
    if (typeof payload.resolvePct === "number") patch.resolvePct = payload.resolvePct;
    if (payload.advanced) patch.advanced = payload.advanced;
    calcStore.set(patch);
  };

  const doRestore = async (row: SavedCalculation) => {
    const { data, error } = await supabase
      .from("saved_calculations")
      .select("calculator_state, company_name")
      .eq("id", row.id)
      .maybeSingle();
    if (error || !data) {
      toast.error(error?.message ?? "Could not restore file.");
      return;
    }
    applyRestoredState(data.calculator_state);
    calcStore.set({ businessName: data.company_name ?? row.company_name });
    toast.success(`Restored "${row.company_name}".`);
    setFileOpen(false);
  };

  const onRestoreClick = (row: SavedCalculation) => {
    setRestorePrompt(row);
  };

  const onDeleteFile = async (row: SavedCalculation) => {
    if (!window.confirm(`Delete saved file "${row.company_name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("saved_calculations").delete().eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setFileRows((rows) => rows.filter((r) => r.id !== row.id));
    toast.success(`Deleted "${row.company_name}".`);
  };

  const onEmailFile = (row: SavedCalculation) => {
    setEmailFileTarget(row);
  };




  const requireAuth = async (intent: AuthIntent) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session && isAuthGateValid()) {
      runIntent(intent);
    } else {
      setAuthGateOpen(intent);
    }
  };
  const runIntent = (intent: AuthIntent) => {
    if (intent === "save") onSave();
    else if (intent === "sold") onSave(() => setCommitmentOpen(true));
    else if (intent === "email") setEmailOpen(true);
    else onFile();
  };

  const commitKeypad = (val: number | null) => {
    if (!keypadFor) return;
    calcStore.setValue(keypadFor, val);
    setKeypadFor(null);
  };

  const editingEnabled = editStatus === "active";
  const showResultsRow = editingEnabled || (isSliderVisible(state) && state.resolvePct !== null);
  const layoutDirty =
    JSON.stringify(elementOverrides) !== JSON.stringify(savedElementOverrides) ||
    JSON.stringify({ ...layoutSettings, elements: undefined }) !==
      JSON.stringify({ ...savedLayoutSettings, elements: undefined });
  const selectedOverride = selectedEditId ? (elementOverrides[selectedEditId] ?? {}) : null;
  const selectedCanReplaceText = selectedEditId ? !COMPLEX_EDITABLE_IDS.has(selectedEditId) : false;

  const expandSelection = (id: string, scope: "solo" | "row" | "column"): string[] => {
    if (scope === "solo") return [id];
    const ADDON_ROWS = ["phoneLine", "language", "duplicate", "unique"];
    const INTG_ROWS = ["prebuilt", "netnew", "custom"];
    const UNIFIED_COLS = ["label", "impl", "monthly", "qty"];
    const TIER_ROWS = ["Tier1", "Tier2", "Tier3", "Tier4", "Tier5", "Tier6"];
    const TIER_COLS = ["tier", "min", "rate"];
    let m = id.match(/^(addons|intg)-cell-([a-zA-Z]+)-(label|impl|monthly|qty)$/);
    if (m) {
      const [, , row, col] = m;
      if (scope === "row") {
        const prefix = ADDON_ROWS.includes(row) ? "addons" : "intg";
        return UNIFIED_COLS.map((c) => `${prefix}-cell-${row}-${c}`);
      }
      return [
        `unified-hdr-${col === "label" ? "item" : col}`,
        ...ADDON_ROWS.map((r) => `addons-cell-${r}-${col}`),
        ...INTG_ROWS.map((r) => `intg-cell-${r}-${col}`),
      ];
    }
    m = id.match(/^unified-hdr-(item|impl|monthly|qty)$/);
    if (m) {
      if (scope === "row") return [id];
      const col = m[1] === "item" ? "label" : m[1];
      return [
        id,
        ...ADDON_ROWS.map((r) => `addons-cell-${r}-${col}`),
        ...INTG_ROWS.map((r) => `intg-cell-${r}-${col}`),
      ];
    }
    m = id.match(/^tiers-cell-(tier|min|rate)-(Tier\d)$/);
    if (m) {
      const [, col, row] = m;
      if (scope === "row") return TIER_COLS.map((c) => `tiers-cell-${c}-${row}`);
      return [`tiers-hdr-${col}`, ...TIER_ROWS.map((r) => `tiers-cell-${col}-${r}`)];
    }
    m = id.match(/^tiers-hdr-(tier|min|rate)$/);
    if (m) {
      if (scope === "row") return [id];
      const col = m[1];
      return [id, ...TIER_ROWS.map((r) => `tiers-cell-${col}-${r}`)];
    }
    return [id];
  };

  const selectEditable = (id: string, label: string, options?: EditableSelectOptions) => {
    setSelectedEditId(id);
    const scoped = expandSelection(id, selectionScope);
    setSelectedEditIds((prev) =>
      options?.additive
        ? Array.from(new Set([...prev, ...scoped]))
        : scoped,
    );
    setSelectedEditLabel(
      selectionScope !== "solo" && scoped.length > 1
        ? `${label} (${selectionScope})`
        : label,
    );
    setTextEdit({
      id,
      label,
      value: options?.currentText ?? elementOverrides[id]?.text?.toString() ?? label,
      stylePatch: options?.stylePatch ?? {},
    });
  };

  const selectColumn = (label: string, ids: string[]) => {
    if (!ids.length) return;
    setSelectedEditId(ids[0]);
    setSelectedEditIds(ids);
    setSelectedEditLabel(`${label} column`);
    setTextEdit({
      id: ids[0],
      label: `${label} column`,
      value: elementOverrides[ids[0]]?.text?.toString() ?? label,
      stylePatch: {
        textFontSize: (elementOverrides[ids[0]]?.textFontSize as string) || undefined,
        textLineHeight: (elementOverrides[ids[0]]?.textLineHeight as string) || undefined,
        textFontWeight: (elementOverrides[ids[0]]?.textFontWeight as string) || undefined,
        textColor: (elementOverrides[ids[0]]?.textColor as string) || undefined,
      },
    });
  };

  const updateEditable = (id: string, patch: EditableOverride) => {
    setElementOverrides((prev) => {
      const selected = selectedEditIds.includes(id) ? selectedEditIds : [id];
      if (selected.length <= 1) return { ...prev, [id]: patch };
      const before = prev[id] ?? {};
      const dx = typeof patch.x === "number" ? patch.x - (Number(before.x) || 0) : 0;
      const dy = typeof patch.y === "number" ? patch.y - (Number(before.y) || 0) : 0;
      const next = { ...prev, [id]: patch };
      selected.forEach((item) => {
        if (item === id) return;
        const itemBefore = prev[item] ?? {};
        const sharedPatch: EditableOverride = {};
        ["zoom", "paddingY", "fontFamily", "textFontSize", "textFontWeight", "textLineHeight", "textColor", "hidden"].forEach((key) => {
          if (key in patch) sharedPatch[key] = patch[key];
        });
        next[item] = {
          ...itemBefore,
          ...sharedPatch,
          x: Math.round((Number(itemBefore.x) || 0) + dx),
          y: Math.round((Number(itemBefore.y) || 0) + dy),
        };
      });
      return next;
    });
  };

  const edit = (id: string, label: string, children: ReactNode, className?: string, onActivate?: () => void) => {
    const cellEditable = !superadminMode || SUPERADMIN_CELL_IDS.has(id);
    return (
      <EditableTarget
        key={id}
        id={id}
        label={label}
        enabled={editingEnabled && cellEditable}
        previewMode={previewMode}
        selected={selectedEditIds.includes(id)}
        override={!editingEnabled && ADVANCED_PRICING_LOCKED_IDS.has(id) ? undefined : elementOverrides[id]}
        className={className}
        onSelect={selectEditable}
        onChange={updateEditable}
        onActivate={onActivate}
      >
        {children}
      </EditableTarget>
    );
  };

  const updateSelectedOverride = (patch: EditableOverride) => {
    if (!selectedEditId) return;
    updateEditable(selectedEditId, { ...(elementOverrides[selectedEditId] ?? {}), ...patch });
  };

  const resetSelectedOverride = () => {
    if (!selectedEditId) return;
    setElementOverrides((prev) => {
      const next = { ...prev };
      (selectedEditIds.length ? selectedEditIds : [selectedEditId]).forEach((id) => delete next[id]);
      return next;
    });
  };

  const updateInspectorTextValue = (value: string) => {
    if (!textEdit || !selectedEditId) return;
    setTextEdit({ ...textEdit, value });
    if (!selectedCanReplaceText) return;
    updateEditable(selectedEditId, {
      ...(elementOverrides[selectedEditId] ?? {}),
      ...textEdit.stylePatch,
      text: value,
    });
  };

  const updateInspectorTextStyle = (patch: EditableOverride) => {
    if (!textEdit || !selectedEditId) return;
    const stylePatch = { ...textEdit.stylePatch, ...patch };
    setTextEdit({ ...textEdit, stylePatch });
    updateEditable(selectedEditId, {
      ...(elementOverrides[selectedEditId] ?? {}),
      ...stylePatch,
      ...(selectedCanReplaceText ? { text: textEdit.value } : {}),
    });
  };

  const saveLayout = async () => {
    if (!editingEnabled) {
      toast.error("Editing not active. Sign in at /admin first.");
      return;
    }
    setSavingLayout(true);
    const snapshotElements = sanitizeElementOverrides(elementOverrides);
    const snapshotSettings: LayoutSettings = {
      ...layoutSettings,
      elements: snapshotElements,
    };
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Your admin session expired. Sign in again at /admin.");
        setEditStatus("denied");
        return;
      }
      const { data, error, status } = await supabase
        .from("layout_settings")
        .upsert({
          id: "singleton",
          settings: snapshotSettings as Json,
          updated_at: new Date().toISOString(),
          updated_by: session.user.id,
        })
        .select()
        .maybeSingle();
      if (error) {
        console.error("[saveLayout] supabase error", { status, error });
        toast.error(`Save failed (${status ?? "?"}): ${error.message}`);
        return;
      }
      if (!data) {
        console.error("[saveLayout] upsert returned no row (likely RLS denied)", { status });
        toast.error("Save blocked by permissions. Your account is not admin.");
        return;
      }
      setSavedLayoutSettings(snapshotSettings);
      setSavedElementOverrides(snapshotElements);
      toast.success("Saved. Public page updated.");
    } catch (err: any) {
      console.error("[saveLayout] exception", err);
      toast.error(`Save failed: ${err?.message ?? "unknown error"}`);
    } finally {
      setSavingLayout(false);
    }
  };

  const resetAllLayout = async () => {
    if (!editingEnabled) return;
    if (!confirm("Wipe ALL saved layout overrides and reboot the editor to defaults?\n\nThis cannot be undone.")) return;
    setSavingLayout(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Your admin session expired. Sign in again at /admin.");
        setEditStatus("denied");
        return;
      }
      const fresh: LayoutSettings = { ...DEFAULT_LAYOUT_SETTINGS, elements: {} };
      const { error, status } = await supabase
        .from("layout_settings")
        .upsert({
          id: "singleton",
          settings: fresh as Json,
          updated_at: new Date().toISOString(),
          updated_by: session.user.id,
        })
        .select()
        .maybeSingle();
      if (error) {
        console.error("[resetAllLayout] supabase error", { status, error });
        toast.error(`Reset failed (${status ?? "?"}): ${error.message}`);
        return;
      }
      setLayoutSettings(fresh);
      setSavedLayoutSettings(fresh);
      setElementOverrides({});
      setSavedElementOverrides({});
      setSelectedEditId(null);
      setSelectedEditIds([]);
      setTextEdit(null);
      toast.success("Layout reset. Editor rebooted to defaults.");
    } catch (err: any) {
      console.error("[resetAllLayout] exception", err);
      toast.error(`Reset failed: ${err?.message ?? "unknown error"}`);
    } finally {
      setSavingLayout(false);
    }
  };

  useEffect(() => {
    const STAGE_W = 1580;
    const STAGE_H = 1185;
    const compute = () => {
      const vv = window.visualViewport;
      const w = vv?.width ?? window.innerWidth;
      const h = vv?.height ?? window.innerHeight;
      const scale = Math.min(w / STAGE_W, h / STAGE_H);
      document.documentElement.style.setProperty("--phaos-stage-scale", String(scale));
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    document.addEventListener("fullscreenchange", compute);
    document.addEventListener("webkitfullscreenchange", compute);
    window.visualViewport?.addEventListener("resize", compute);
    window.visualViewport?.addEventListener("scroll", compute);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
      document.removeEventListener("fullscreenchange", compute);
      document.removeEventListener("webkitfullscreenchange", compute);
      window.visualViewport?.removeEventListener("resize", compute);
      window.visualViewport?.removeEventListener("scroll", compute);
    };
  }, [editStatus]);

  return (
    <div
      ref={wrapRef}
      className={`phaos-stage-wrap${editingEnabled ? " phaos-admin-editing" : ""}`}
      onClick={(e) => {
        if (keypadFor || emailOpen || customPricingOpen || quoteFor || qwertyFor || roleNumPad || factsOpen)
          return;
        const t = e.target as HTMLElement;
        if (t.closest("button, input, textarea, a, [role=slider], [data-no-stage-tap]")) return;
        handleStageTap();
      }}
    >
      <Toaster richColors closeButton position="top-center" />

      <div className="phaos-stage-sizer">
        <div
          ref={stageRef}
          className={`phaos-ipad-stage bg-background${state.advancedOpen ? " phaos-advanced-mode" : ""}${state.advancedOpen && state.advanced.capacityBlocks > 0 ? " phaos-has-capacity" : ""}`}
        >
          <aside className="phaos-rail">
            {edit(
              "rail-live",
              "FACTS button",
              <RailButton
                icon={<Check className="h-[1.5rem] w-[1.5rem]" />}
                label="FACTS"
                onClick={editingEnabled ? () => undefined : () => setFactsOpen(true)}
              />,
            )}
            {edit(
              "rail-reset",
              "Reset button",
              <RailButton
                icon={<RotateCcw className="h-[1.5rem] w-[1.5rem]" />}
                label="Reset"
                onClick={editingEnabled ? () => undefined : onReset}
              />,
            )}
            {edit(
              "rail-save",
              "Save button",
              <RailButton
                icon={<Save className="h-[1.5rem] w-[1.5rem]" />}
                label="Save"
                onClick={editingEnabled ? () => undefined : () => requireAuth("save")}
              />,
            )}
            {edit(
              "rail-email",
              "Email button",
              <RailButton
                icon={<Mail className="h-[1.5rem] w-[1.5rem]" />}
                label="Email"
                onClick={editingEnabled ? () => undefined : () => requireAuth("email")}
              />,
            )}
            {edit(
              "rail-file",
              "File button",
              <RailButton
                icon={<FolderOpen className="h-[1.5rem] w-[1.5rem]" />}
                label="File"
                onClick={editingEnabled ? () => undefined : () => requireAuth("file")}
              />,
            )}
          </aside>

          <main className="phaos-board">
            {state.advancedOpen && (
              <AdvancedGoBack onBack={() => calcStore.set({ advancedOpen: false, advancedStage: 0 })} />
            )}

            {!state.advancedOpen && (
              <section className="phaos-title-row">
                {edit("title", "Main title", <TitleBanner />)}
              </section>
            )}

            {!state.advancedOpen && (
              <section className="phaos-cells-grid">
                {ORDER.map((key) => {
                  const meta = CELL_META[key];
                  const visible = editingEnabled || isCellVisible(state, key);
                  if (!visible) return <div key={key} aria-hidden />;
                  return edit(
                    `cell-${key}`,
                    meta.title,
                    <ValueCell
                      key={key}
                      title={meta.title}
                      value={state.values[key]}
                      prefix={meta.prefix}
                      suffix={meta.suffix}
                      highlight={step === key}
                      onClick={
                        editingEnabled
                          ? undefined
                          : () => {
                              if (CELL_QUOTES[key] && !state.seenQuotes[key]) {
                                setQuoteFor(key);
                              } else {
                                setKeypadFor(key);
                              }
                            }
                      }
                    />,
                  );
                })}
                {editingEnabled || isAdditionalSalesVisible(state) ? (
                  edit(
                    "cell-additional-sales",
                    "Additional Sales",
                    <ValueCell
                      title="Additional Sales"
                      value={additionalSales}
                      prefix="$"
                      readOnly
                    />,
                  )
                ) : (
                  <div aria-hidden />
                )}
              </section>
            )}

            {!state.advancedOpen && (
              <section className="phaos-role-wrap">
                {editingEnabled || isRoleVisible(state)
                  ? edit(
                      "roles",
                      "Role section",
                      <RoleEditor
                        roles={state.roles}
                        monthlyCalls={monthlyCalls}
                        openQwerty={setQwertyFor}
                        openNumPad={setRoleNumPad}
                      />,
                    )
                  : null}
              </section>
            )}

            {!state.advancedOpen && (
              <section className="phaos-slider-panel">
                {editingEnabled || isSliderVisible(state)
                  ? edit(
                      "slider",
                      "AI resolve slider",
                      <>
                        <div className="phaos-slider-heading text-[1.1rem] min-[1100px]:text-[1.45rem] font-extrabold text-foreground">
                          What % Of Calls Can AI Resolve?
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-[1.18rem] italic font-normal text-muted-foreground">
                            1%
                          </span>
                          <input
                            type="range"
                            min={1}
                            max={100}
                            value={state.resolvePct ?? 1}
                            onChange={(e) => calcStore.set({ resolvePct: Number(e.target.value) })}
                            className="phaos-range flex-1"
                            style={
                              {
                                ["--val" as never]: `${state.resolvePct ?? 1}%`,
                              } as React.CSSProperties
                            }
                            aria-label="AI resolution percentage"
                          />
                          <span className="text-[1.18rem] italic font-normal text-muted-foreground">
                            100%
                          </span>
                        </div>
                        {state.resolvePct !== null && (
                          <div className="text-center font-black text-[2.15rem] leading-none text-primary tabular-nums">
                            {state.resolvePct}%
                          </div>
                        )}
                      </>,
                    )
                  : null}
              </section>
            )}

            <section className="phaos-financial-panel">
              {state.advancedOpen
                ? edit(
                    "advanced-financial",
                    "Financial Impact",
                    <>
                      <div className="phaos-result-box">
                        <RevealCell
                          title="FINANCIAL IMPACT"
                          value={`${financialSavings >= 0 ? "+" : ""}${formatUSD(Math.round(financialSavings))}`}
                          revealed
                          onReveal={() => undefined}
                          compact
                          borderless
                          valueClassName="text-[oklch(0.62_0.20_150)]"
                        />
                      </div>
                      <ul className="phaos-savings-breakdown">
                        <li>
                          Additional Sales = {formatUSD(Math.round(breakdown.additionalSales))}
                        </li>
                        <li>
                          Labor Reduction = {formatUSD(Math.round(breakdown.laborReduction))}
                        </li>
                        {breakdown.paidAnswering > 0 && (
                          <li>
                            Paid Answering = {formatUSD(Math.round(breakdown.paidAnswering))}
                          </li>
                        )}
                      </ul>
                    </>,
                    "phaos-advanced-financial-edit",
                  )
                : showResultsRow &&
                  edit(
                    "calc-financial",
                    "Financial Impact",
                    <>
                      <div className="phaos-result-box">
                        <RevealCell
                          title="FINANCIAL IMPACT"
                          value={`${financialSavings >= 0 ? "+" : ""}${formatUSD(Math.round(financialSavings))}`}
                          revealed={editingEnabled || state.revealedSavings}
                          onReveal={() => calcStore.set({ revealedSavings: true })}
                          compact
                          borderless
                          valueClassName="text-[oklch(0.62_0.20_150)]"
                        />
                      </div>
                      {(editingEnabled || state.revealedSavings) ? (
                        <ul className="phaos-savings-breakdown">
                          <li>
                            Additional Sales = {formatUSD(Math.round(breakdown.additionalSales))}
                          </li>
                          <li>
                            Labor Reduction = {formatUSD(Math.round(breakdown.laborReduction))}
                          </li>
                          {breakdown.paidAnswering > 0 && (
                            <li>
                              Paid Answering = {formatUSD(Math.round(breakdown.paidAnswering))}
                            </li>
                          )}
                        </ul>
                      ) : (
                        <ul className="phaos-savings-breakdown" aria-hidden style={{ visibility: "hidden" }}>
                          <li>Additional Sales = $0</li>
                          <li>Labor Reduction = $0</li>
                        </ul>
                      )}
                    </>,
                  )}
            </section>

            {state.advancedOpen && state.advanced.capacityBlocks > 0 && (
              <section className="phaos-asav-zone">
                {edit("advanced-annual-savings", "Annual Savings", <AdvancedFinancialPanel />)}
              </section>
            )}

            {state.advancedOpen && state.advanced.capacityBlocks > 0 && (() => {
              const capDetails = capacityAnnualSavingsDetails(
                effectiveCalls,
                state.advanced.capacityBlocks,
              );
              // 12-month total value generated by the solution
              const value12M = Math.round(financialSavings) * 12;
              // 12-month total cost of the solution (every penny):
              //   - usage cost: annualCostWithBlocks when committed blocks exist,
              //     otherwise 12 * tier price for the call volume
              //   - add-ons (phone lines, agents, languages, integrations) * 12
              //   - one-time implementation fee ($299 base + per-item one-times)
              const usage12M = state.advanced.capacityBlocks > 0
                ? capDetails.annualCostWithBlocks
                : phaosPriceForCalls(effectiveCalls) * 12;
              const addons12M = addonsMonthly(state.advanced) * 12;
              const implementationFee = 299 + addonsOneTime(state.advanced);
              const cost12M = usage12M + addons12M + implementationFee;
              const completeRoi = Math.round(value12M - cost12M);
              if (completeRoi <= 0) return null;
              const valueColor = "oklch(0.62 0.20 150)";
              const display = formatUSD(completeRoi);

              return (
                <section className="phaos-croi-zone">
                  {edit(
                    "advanced-complete-roi",
                    "Complete Annual ROI",
                    <div className="phaos-adv-numeric">
                      <div className="phaos-result-box flex flex-col items-center justify-center text-center">
                        <div className="text-[1.25rem] min-[1100px]:text-[1.55rem] font-extrabold uppercase text-foreground leading-tight">
                          Complete Annual ROI
                        </div>
                        <div
                          className="tabular-nums leading-none font-black mt-1 text-[3.4rem] min-[1100px]:text-[3.95rem]"
                          style={{ color: valueColor }}
                        >
                          {display}
                        </div>
                      </div>
                      <ul className="phaos-adv-sublines">
                        <li>Includes Implementation Fee</li>
                        <li>Includes Usage + Add-Ons</li>
                        <li>No vacations, sleep or PTO</li>
                        <li>$100 Credit for Referrals!</li>
                      </ul>
                    </div>,
                  )}
                </section>
              );
            })()}

            <section className="phaos-price-panel">
              {state.advancedOpen ? (
                edit("advanced-price", "Advanced Phaos price", <AdvancedPricePanel />)
              ) : (
                <>
                  {(editingEnabled || state.revealedSavings) &&
                    !overThreshold &&
                    edit(
                      "calc-price",
                      "Phaos price",
                      <>
                        <div className="phaos-result-box">
                          <RevealCell
                            title="Phaos AI Voice Agent"
                            value={`${formatUSD(Math.round(phaosPrice))}/mo`}
                            revealed={editingEnabled || state.revealedPrice}
                            onReveal={() => calcStore.set({ revealedPrice: true })}
                            compact
                            borderless
                          />
                        </div>
                        {(editingEnabled || state.revealedPrice) && (
                          <ul className="phaos-usage-lines">
                            <li>rate reduces as volumes increase</li>
                            <li>usage-based month-to-month!</li>
                          </ul>
                        )}
                      </>,
                    )}

                  {(editingEnabled || state.revealedSavings) && overThreshold
                    ? edit(
                        "calc-price-custom",
                        "Custom pricing",
                        <button
                          onClick={editingEnabled ? undefined : () => setCustomPricingOpen(true)}
                          className="w-full h-full flex flex-col justify-center text-center"
                          data-no-stage-tap
                        >
                          <div className="text-[1.05rem] font-extrabold uppercase">
                            Phaos AI Voice Agent
                          </div>
                          <div className="font-black text-[2.4rem] text-primary mt-1">Custom</div>
                        </button>,
                      )
                    : null}
                </>
              )}
            </section>

            <div className="phaos-logo-zone">
              {edit(
                state.advancedOpen ? "advanced-logo" : "calc-logo",
                "Phaos logo",
                <img src={logoUrl} alt="Phaos AI" className="phaos-logo-img" draggable={false} />,
              )}
            </div>

            <div className="phaos-cta-zone">
              {(editingEnabled || state.showImSold) &&
              (!state.advancedOpen || editingEnabled || state.advancedStage >= 15)
                ? edit(
                    state.advancedOpen ? "advanced-cta" : "calc-cta",
                    "I'M SOLD button",
                    <button
                      onClick={
                        editingEnabled
                          ? undefined
                          : () => requireAuth("sold")
                      }
                      className="cta-embossed phaos-sold-button"
                      data-no-stage-tap
                    >
                      <span className="phaos-sold-main">I'M SOLD</span>
                      <span className="phaos-sold-sub">Sign Up Now</span>
                    </button>,
                  )
                : null}
              {!state.advancedOpen && (
                <div className="phaos-advanced-slot">
                  {editingEnabled || state.showAdvanced
                    ? edit(
                        "advanced-link",
                        "Advanced Pricing link",
                        <button
                          onClick={
                            editingEnabled ? undefined : () => calcStore.set({ advancedOpen: true, advancedStage: 0 })
                          }
                          className="phaos-advanced-link"
                          data-no-stage-tap
                        >
                          Tell Me More!
                        </button>,
                        undefined,
                        () => calcStore.set({ advancedOpen: true, advancedStage: 0 }),
                      )
                    : null}
                </div>
              )}
            </div>

            {!state.advancedOpen && (
              <div className="phaos-bullets-zone">
                {edit(
                  "bullets",
                  "Bullet list",
                  <BulletsGrid
                    visible={editingEnabled || state.bulletsShown > 0}
                    count={editingEnabled ? 6 : state.bulletsShown}
                  />,
                )}
              </div>
            )}

            {state.advancedOpen && (
              <>
                <div className="phaos-impl-zone">
                  {edit("advanced-implementation-fee", "Implementation Fee", <ImplFeeCell />)}
                </div>
                {(editingEnabled || state.advancedStage >= 9) && (
                  <div className="phaos-bull-zone">
                    {edit(
                      "advanced-impl-includes",
                      "Implementation Includes",
                      <ImplIncludesCell
                        bullets={(layoutSettings.implBullets as string[]) ?? []}
                        layout={(layoutSettings.implBulletsLayout as "vertical" | "horizontal") ?? "vertical"}
                        editing={editingEnabled}
                        onChange={(b) => setLayoutSettings((p) => ({ ...p, implBullets: b }))}
                        onLayoutChange={(l) => setLayoutSettings((p) => ({ ...p, implBulletsLayout: l }))}
                        maxBullets={editingEnabled ? undefined : state.advancedStage - 8}
                      />,
                      "phaos-edit-parent",
                    )}
                  </div>
                )}
                <div className="phaos-advhdr-zone">
                  {edit(
                    "advanced-title",
                    "Advanced Pricing Title",
                    <AdvancedTitle editPart={(id, label, node) => edit(id, label, node)} />,
                    "phaos-edit-parent",
                  )}
                </div>
                <div className="phaos-advcap-zone">
                  {edit(
                    "advanced-capacity-bar",
                    "Capacity Blocks",
                    <CapacityBar editPart={(id, label, node) => edit(id, label, node)} />,
                    "phaos-edit-parent",
                  )}
                </div>
                {(editingEnabled || state.advancedStage >= 2) && (
                  <div className="phaos-advLM-zone">
                    {editingEnabled
                      ? edit(
                          "advanced-column-leftmid",
                          "Entire Add-Ons Card",
                          edit(
                            "advanced-unified-addons",
                            "System Customization & Add-Ons",
                            <UnifiedAddonsSection
                              editHeader={(id, label, node) => edit(id, label, node)}
                              editRow={(id, label, node) => edit(id, label, node, "phaos-edit-parent")}
                              editCell={(id, label, node) => edit(id, label, node)}
                              selectColumn={selectColumn}
                            />,
                            "phaos-edit-parent",
                          ),
                          "phaos-edit-parent",
                        )
                      : edit(
                          "advanced-unified-addons",
                          "System Customization & Add-Ons",
                          <UnifiedAddonsSection visibleRows={state.advancedStage - 1} />,
                          "phaos-edit-parent",
                        )}
                  </div>
                )}
                {(editingEnabled || state.advancedStage >= 1) && (
                  <div className="phaos-advR-zone">
                    {editingEnabled
                      ? edit(
                          "advanced-column-right",
                          "Entire Right Column",
                          edit(
                            "advanced-tiered-usage",
                            "Tiered Monthly Usage",
                            <TiersSection
                              editHeader={(id, label, node) => edit(id, label, node)}
                              editCell={(id, label, node) => edit(id, label, node)}
                              selectColumn={selectColumn}
                            />,
                            "phaos-edit-parent",
                          ),
                          "phaos-edit-parent",
                        )
                      : edit(
                          "advanced-tiered-usage",
                          "Tiered Monthly Usage",
                          <TiersSection />,
                          "phaos-edit-parent",
                        )}
                  </div>
                )}
                {(editingEnabled || state.advancedStage >= 15) && (
                  <div className="phaos-srch-zone">
                    {edit("advanced-integration-search", "Integration Search", <IntegrationSearch openQwerty={setQwertyFor} />)}
                  </div>
                )}
                {((layoutSettings.customElements as CustomTextElement[] | undefined) ?? []).map((ce) => (
                  <div key={ce.id} className="phaos-custom-text-zone">
                    {edit(ce.id, `Custom text: ${ce.defaultText.slice(0, 24)}`,
                      <div className="phaos-custom-text-default">{ce.defaultText}</div>
                    )}
                  </div>
                ))}
              </>
            )}
          </main>
        </div>
      </div>

      {editStatus === "checking" && (
        <div className="fixed top-3 left-1/2 z-50 -translate-x-1/2 rounded-md border border-border bg-background px-4 py-2 text-sm font-bold shadow-lg">
          Loading editor…
        </div>
      )}

      {editStatus === "denied" && (
        <div className="fixed top-3 left-1/2 z-50 -translate-x-1/2 rounded-md border border-destructive bg-background px-4 py-2 text-sm font-bold text-destructive shadow-lg">
          Sign in as admin at /admin first.
        </div>
      )}

      {editingEnabled && (
        <div className={`phaos-edit-toolbar phaos-edit-toolbar-${toolbarSide}`} data-no-stage-tap>
          <div className="phaos-edit-toolbar-header">
            <div className="phaos-edit-toolbar-title">Edit Mode</div>
            <button
              type="button"
              className="phaos-edit-toolbar-side-toggle"
              onClick={() => setToolbarSide((s) => (s === "right" ? "left" : "right"))}
              title="Move editor panel"
            >
              {toolbarSide === "right" ? "← Move left" : "Move right →"}
            </button>
          </div>
          <div className="phaos-edit-toolbar-subtitle">
            Click words, cells, rows, or columns. Shift/Command-click selects multiple items to move together.
          </div>
          {selectedEditId ? (
            <div className="phaos-edit-inspector">
              <div className="phaos-edit-selected">
                {selectedEditLabel}
                {selectedEditIds.length > 1 ? ` · ${selectedEditIds.length} selected` : ""}
              </div>
              <div className="phaos-edit-scope" data-no-stage-tap>
                {(["column", "row", "solo"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSelectionScope(s);
                      if (selectedEditId) {
                        const ids = expandSelection(selectedEditId, s);
                        setSelectedEditIds(ids);
                        setSelectedEditLabel(
                          s !== "solo" && ids.length > 1
                            ? `${selectedEditLabel.replace(/\s*\((row|column)\)\s*$/i, "")} (${s})`
                            : selectedEditLabel.replace(/\s*\((row|column)\)\s*$/i, ""),
                        );
                      }
                    }}
                    className={
                      "phaos-edit-scope-btn" +
                      (selectionScope === s ? " phaos-edit-scope-btn-active" : "")
                    }
                  >
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
              <label>
                Text
                <textarea
                  value={textEdit?.value ?? ""}
                  disabled={!selectedCanReplaceText}
                  onChange={(e) => updateInspectorTextValue(e.target.value)}
                  placeholder={selectedCanReplaceText ? "Edit selected text" : "Dynamic content keeps live pricing text"}
                  className="phaos-edit-textarea"
                />
              </label>
              <label>
                Font / contents size
                <input
                  type="range"
                  min={40}
                  max={220}
                  step={1}
                  value={selectedOverride?.zoom ?? 100}
                  onChange={(e) =>
                    updateSelectedOverride({
                      ...(selectedOverride ?? {}),
                      zoom: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Vertical spacing (px)
                <input
                  type="range"
                  min={0}
                  max={48}
                  step={1}
                  value={selectedOverride?.paddingY ?? 0}
                  onChange={(e) =>
                    updateSelectedOverride({
                      ...(selectedOverride ?? {}),
                      paddingY: Number(e.target.value),
                    })
                  }
                />
              </label>
              <div className="phaos-edit-mini-grid">
                <label>
                  Font size
                  <input
                    value={(selectedOverride?.textFontSize as string) ?? ""}
                    onChange={(e) => updateInspectorTextStyle({ textFontSize: e.target.value || undefined })}
                    placeholder="32px"
                  />
                </label>
                <label>
                  Line height
                  <input
                    value={(selectedOverride?.textLineHeight as string) ?? ""}
                    onChange={(e) => updateInspectorTextStyle({ textLineHeight: e.target.value || undefined })}
                    placeholder="1.1"
                  />
                </label>
                <label>
                  Weight
                  <select
                    value={(selectedOverride?.textFontWeight as string) ?? ""}
                    onChange={(e) => updateInspectorTextStyle({ textFontWeight: e.target.value || undefined })}
                  >
                    <option value="">Default</option>
                    <option value="400">400</option>
                    <option value="600">600</option>
                    <option value="800">800</option>
                    <option value="950">950</option>
                  </select>
                </label>
                <label>
                  Color
                  <input
                    value={(selectedOverride?.textColor as string) ?? ""}
                    onChange={(e) => updateInspectorTextStyle({ textColor: e.target.value || undefined })}
                    placeholder="var(--primary)"
                  />
                </label>
              </div>
              <div className="phaos-edit-mini-grid">
                <NumberEdit
                  label="X"
                  value={selectedOverride?.x ?? 0}
                  onChange={(x) => updateSelectedOverride({ ...(selectedOverride ?? {}), x })}
                />
                <NumberEdit
                  label="Y"
                  value={selectedOverride?.y ?? 0}
                  onChange={(y) => updateSelectedOverride({ ...(selectedOverride ?? {}), y })}
                />
                <NumberEdit
                  label="W"
                  value={selectedOverride?.width ?? 0}
                  onChange={(width) =>
                    updateSelectedOverride({ ...(selectedOverride ?? {}), width })
                  }
                />
                <NumberEdit
                  label="H"
                  value={selectedOverride?.height ?? 0}
                  onChange={(height) =>
                    updateSelectedOverride({ ...(selectedOverride ?? {}), height })
                  }
                />
              </div>
              <label>
                Font family
                <select
                  value={(selectedOverride?.fontFamily as string) ?? ""}
                  onChange={(e) => updateInspectorTextStyle({ fontFamily: e.target.value || undefined })}
                >
                  <option value="">Default</option>
                  <option value='"Audiowide", system-ui, sans-serif'>Audiowide</option>
                  <option value='"Orbitron", system-ui, sans-serif'>Orbitron</option>
                  <option value='Inter, system-ui, sans-serif'>Inter</option>
                  <option value='"Space Grotesk", sans-serif'>Space Grotesk</option>
                  <option value='Georgia, "Times New Roman", serif'>Georgia (serif)</option>
                  <option value='"Courier New", monospace'>Courier (mono)</option>
                  <option value='system-ui, sans-serif'>System</option>
                </select>
              </label>
              <div className="phaos-edit-actions">
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedEditId) return;
                    const next = { ...(elementOverrides[selectedEditId] ?? {}) };
                    delete next.text;
                    delete next.fontFamily;
                    delete next.textFontSize;
                    delete next.textFontWeight;
                    delete next.textLineHeight;
                    delete next.textColor;
                    updateEditable(selectedEditId, next);
                  }}
                  className="phaos-edit-secondary"
                >
                  Reset text
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateSelectedOverride({
                      ...(selectedOverride ?? {}),
                      hidden: !selectedOverride?.hidden,
                    })
                  }
                  className="phaos-edit-secondary"
                >
                  {selectedOverride?.hidden ? "Restore" : "Delete element"}
                </button>
                <button
                  type="button"
                  onClick={resetSelectedOverride}
                  className="phaos-edit-secondary"
                >
                  Reset selected
                </button>
                {selectedEditId && selectedEditId.startsWith("custom-text-") && (
                  <button
                    type="button"
                    onClick={() => {
                      setLayoutSettings((p) => ({
                        ...p,
                        customElements: ((p.customElements as CustomTextElement[] | undefined) ?? []).filter((c) => c.id !== selectedEditId),
                      }));
                      setElementOverrides((prev) => {
                        const next = { ...prev };
                        delete next[selectedEditId];
                        return next;
                      });
                      setSelectedEditId(null);
                      setSelectedEditIds([]);
                      setTextEdit(null);
                    }}
                    className="phaos-edit-secondary"
                  >
                    Remove custom text
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="phaos-edit-empty">No section selected</div>
          )}
          {state.advancedOpen && (
            <div className="phaos-edit-actions" style={{ flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setPreviewMode((p) => !p)}
                className="phaos-edit-secondary"
                style={previewMode ? { background: "var(--primary)", color: "var(--primary-foreground)" } : undefined}
              >
                {previewMode ? "Exit preview" : "Preview live"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = `custom-text-${Date.now()}`;
                  setLayoutSettings((p) => ({
                    ...p,
                    customElements: [
                      ...(((p.customElements as CustomTextElement[] | undefined) ?? [])),
                      { id, defaultText: "New text — select it, then edit in the right panel" },
                    ],
                  }));
                  setSelectedEditId(id);
                  setSelectedEditIds([id]);
                  setSelectedEditLabel("Custom text");
                  setTextEdit({ id, label: "Custom text", value: "New text — select it, then edit in the right panel", stylePatch: {} });
                }}
                className="phaos-edit-secondary"
              >
                + Add text
              </button>
              <button type="button" onClick={() => selectEditable("advanced-column-left", "Entire Left Column")} className="phaos-edit-secondary">Select Left col</button>
              <button type="button" onClick={() => selectEditable("advanced-column-mid", "Entire Middle Column")} className="phaos-edit-secondary">Select Mid col</button>
              <button type="button" onClick={() => selectEditable("advanced-column-right", "Entire Right Column")} className="phaos-edit-secondary">Select Right col</button>
            </div>
          )}
          <div className="phaos-edit-actions">
            <button
              type="button"
              onClick={saveLayout}
              disabled={savingLayout}
              className="phaos-edit-primary"
            >
              {savingLayout ? "Saving…" : layoutDirty ? "Save changes" : "Save (force)"}
            </button>
            <button
              type="button"
              onClick={() => {
                setElementOverrides(savedElementOverrides);
                setLayoutSettings(savedLayoutSettings);
              }}
              className="phaos-edit-secondary"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={resetAllLayout}
              disabled={savingLayout}
              className="phaos-edit-secondary"
              style={{ background: "var(--destructive)", color: "var(--destructive-foreground)" }}
              title="Wipe all saved layout overrides and reboot the editor"
            >
              Reset ALL
            </button>
            <button
              type="button"
              onClick={() => {
                window.history.replaceState(null, "", "/");
                setEditStatus("off");
                setSelectedEditId(null);
                setSelectedEditIds([]);
                setTextEdit(null);
              }}
              className="phaos-edit-secondary"
            >
              Exit
            </button>
          </div>
        </div>
      )}

      {keypadFor && (
        <NumericKeypad
          open
          label={CELL_META[keypadFor].title}
          initialValue={state.values[keypadFor]}
          prefix={CELL_META[keypadFor].prefix}
          suffix={CELL_META[keypadFor].suffix}
          allowDecimal={CELL_META[keypadFor].allowDecimal ?? false}
          emptyAsZero={keypadFor === "paidAnswering"}
          onCommit={commitKeypad}
          onClose={() => setKeypadFor(null)}
        />
      )}

      {roleNumPad && (
        <NumericKeypad
          open
          label={roleNumPad.label}
          initialValue={roleNumPad.initial}
          prefix={roleNumPad.prefix}
          suffix={roleNumPad.suffix}
          allowDecimal={roleNumPad.allowDecimal ?? true}
          onCommit={(v) => {
            const clamped =
              v !== null && roleNumPad.max !== undefined
                ? Math.min(roleNumPad.max, Math.max(0, v))
                : v;
            roleNumPad.onCommit(clamped);
            setRoleNumPad(null);
          }}
          onClose={() => setRoleNumPad(null)}
        />
      )}

      {qwertyFor && (
        <QwertyKeyboard
          open
          label={qwertyFor.label}
          initialValue={qwertyFor.initial}
          placeholder={qwertyFor.placeholder}
          shortcuts={qwertyFor.shortcuts}
          onCommit={(v) => qwertyFor.onCommit(v)}
          onClose={() => setQwertyFor(null)}
        />
      )}

      <StatQuoteDialog
        cellKey={quoteFor}
        onDismiss={() => {
          const k = quoteFor;
          setQuoteFor(null);
          if (k) {
            calcStore.markQuoteSeen(k);
            setKeypadFor(k);
          }
        }}
      />

      {factsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          data-no-stage-tap
          onClick={() => setFactsOpen(false)}
          className="fixed inset-0 z-[120] bg-background cursor-pointer p-[1.5vh] grid grid-cols-3 grid-rows-2 gap-[1.5vh]"
        >
          {(["monthlyCalls","missedCalls","missedBookings","callbackTime","estAIBookings","refocusedStaff"] as CellKey[]).map((k) => {
            const q = CELL_QUOTES[k];
            if (!q) return null;
            return (
              <div
                key={k}
                className="rounded-[1.35rem] border-2 border-primary/70 bg-background flex flex-col items-center justify-center text-center px-[2vw] py-[2vh]"
              >
                <div className="text-[1.08rem] min-[1100px]:text-[1.48rem] font-extrabold text-foreground leading-tight">
                  &ldquo;{q.quote}&rdquo;
                </div>
                <div className="mt-[1.5vh] text-[1.08rem] min-[1100px]:text-[1.48rem] font-extrabold italic text-primary leading-tight">
                  —{q.source}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EmailDialog open={emailOpen} onClose={() => setEmailOpen(false)} />

      <CommitmentDialog open={commitmentOpen} onClose={() => setCommitmentOpen(false)} />

      <AuthGateDialog
        open={authGateOpen !== null}
        title={
          authGateOpen === "save"
            ? "Sign in to Save"
            : authGateOpen === "sold"
              ? "Sign in to Save & Sign Up"
            : authGateOpen === "email"
              ? "Sign in to Email"
              : "Sign in to access Files"
        }
        onClose={() => setAuthGateOpen(null)}
        onAuthorized={() => {
          const intent = authGateOpen;
          setAuthGateOpen(null);
          if (intent) runIntent(intent);
        }}
      />

      {fileOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" data-no-stage-tap onClick={() => setFileOpen(false)}>
          <div className="w-full max-w-[760px] rounded-2xl border-4 border-primary/60 bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b-2 border-primary/25 px-6 py-4">
              <div className="text-lg font-extrabold uppercase tracking-wide text-foreground">Saved Calculator Files</div>
              <button type="button" onClick={() => setFileOpen(false)} className="rounded-full px-3 py-1 text-sm font-black text-primary hover:bg-accent">CLOSE</button>
            </div>
            <div className="max-h-[520px] overflow-auto p-5">
              {fileLoading ? (
                <div className="py-10 text-center text-sm font-bold text-muted-foreground">Loading files…</div>
              ) : fileRows.length === 0 ? (
                <div className="py-10 text-center text-sm font-bold text-muted-foreground">No saved calculators yet.</div>
              ) : (
                <div className="grid gap-2">
                  {fileRows.map((row) => (
                    <div key={row.id} className="flex flex-col gap-2 rounded-lg border border-primary/20 px-4 py-3 sm:grid sm:grid-cols-[1fr_auto] sm:items-center sm:gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-black text-foreground">{row.company_name}</div>
                        <div className="text-xs font-bold text-muted-foreground">{new Date(row.created_at).toLocaleString()}</div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onRestoreClick(row)}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-extrabold uppercase text-primary-foreground shadow hover:opacity-90 active:scale-95 transition"
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          onClick={() => onEmailFile(row)}
                          className="rounded-lg border-2 border-primary/50 px-3 py-1.5 text-xs font-extrabold uppercase text-primary hover:bg-primary/10 active:scale-95 transition"
                        >
                          Email
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteFile(row)}
                          className="rounded-lg border-2 border-destructive/60 px-3 py-1.5 text-xs font-extrabold uppercase text-destructive hover:bg-destructive/10 active:scale-95 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}

                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {restorePrompt && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setRestorePrompt(null)}>
          <div className="w-full max-w-[520px] rounded-2xl border-4 border-primary/70 bg-background p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-extrabold uppercase tracking-wide text-foreground mb-2">Restore "{restorePrompt.company_name}"?</div>
            <p className="text-sm font-semibold text-muted-foreground mb-5">
              Restoring will replace your current calculator. Choose how to proceed with your current work.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={() => setRestorePrompt(null)}
                className="rounded-lg border-2 border-primary/40 px-4 py-2 text-sm font-extrabold uppercase text-foreground hover:bg-accent transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const row = restorePrompt;
                  setRestorePrompt(null);
                  if (row) doRestore(row);
                }}
                className="rounded-lg border-2 border-destructive/60 px-4 py-2 text-sm font-extrabold uppercase text-destructive hover:bg-destructive/10 transition"
              >
                Ignore & Restore
              </button>
              <button
                type="button"
                onClick={() => {
                  const row = restorePrompt;
                  setRestorePrompt(null);
                  if (row) onSave(() => doRestore(row));
                }}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-extrabold uppercase text-primary-foreground shadow hover:opacity-90 transition"
              >
                Save First, Then Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {emailFileTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => { if (!emailFileSending) { setEmailFileTarget(null); setEmailFileTo(""); } }}>
          <div className="w-full max-w-[520px] rounded-2xl border-4 border-primary/70 bg-background p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-extrabold uppercase tracking-wide text-foreground mb-2">Email "{emailFileTarget.company_name}"</div>
            <p className="text-sm font-semibold text-muted-foreground mb-4">
              We'll send a branded email to the address below with a link to reopen the Phaos AI calculator.
            </p>
            <input
              type="email"
              value={emailFileTo}
              onChange={(e) => setEmailFileTo(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full rounded-lg border-2 border-primary/40 bg-background px-3 py-2 text-base font-semibold focus:outline-none focus:border-primary mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={emailFileSending}
                onClick={() => { setEmailFileTarget(null); setEmailFileTo(""); }}
                className="rounded-lg border-2 border-primary/40 px-4 py-2 text-sm font-extrabold uppercase text-foreground hover:bg-accent transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={emailFileSending}
                onClick={async () => {
                  const to = emailFileTo.trim();
                  if (!/^\S+@\S+\.\S+$/.test(to)) {
                    toast.error("Please enter a valid email address.");
                    return;
                  }
                  const row = emailFileTarget;
                  setEmailFileSending(true);
                  try {
                    const { sendTransactionalEmail } = await import("@/lib/email/send-transactional");
                    await sendTransactionalEmail({
                      templateName: "saved-calculator-share",
                      recipientEmail: to,
                      idempotencyKey: `saved-calc-${row.id}-${to.toLowerCase()}`,
                      templateData: {
                        companyName: row.company_name,
                        savedAt: new Date(row.created_at).toLocaleString(),
                        appUrl: window.location.origin,
                      },
                    });
                    toast.success(`Email sent to ${to}.`);
                    setEmailFileTarget(null);
                    setEmailFileTo("");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed to send email.");
                  } finally {
                    setEmailFileSending(false);
                  }
                }}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-extrabold uppercase text-primary-foreground shadow hover:opacity-90 transition disabled:opacity-50"
              >
                {emailFileSending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}


      {customPricingOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setCustomPricingOpen(false)}
        >
          <div
            className="max-w-md w-full rounded-3xl border-4 border-primary bg-background p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-display text-2xl text-primary mb-2">Custom Pricing</div>
            <p className="text-sm text-foreground">
              You've entered <strong>{monthlyCalls.toLocaleString()}</strong> monthly calls. Volume
              above {CUSTOM_PRICING_CALL_THRESHOLD.toLocaleString()} is priced custom — let's talk.
            </p>
            <button
              onClick={() => setCustomPricingOpen(false)}
              className="mt-5 rounded-xl bg-primary px-5 py-2 font-bold text-primary-foreground hover:opacity-90"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type QwertySetter = React.Dispatch<
  React.SetStateAction<null | {
    label: string;
    initial: string;
    placeholder?: string;
    shortcuts?: string[];
    onCommit: (v: string) => void;
  }>
>;
type NumPadSetter = React.Dispatch<
  React.SetStateAction<null | {
    label: string;
    initial: number | null;
    prefix?: string;
    suffix?: string;
    allowDecimal?: boolean;
    max?: number;
    onCommit: (v: number | null) => void;
  }>
>;

function RoleEditor({
  roles,
  monthlyCalls,
  openQwerty,
  openNumPad,
}: {
  roles: RoleRow[];
  monthlyCalls: number;
  openQwerty: QwertySetter;
  openNumPad: NumPadSetter;
}) {
  const addTargetId = roles[roles.length - 1]?.id;
  const canAdd = roles.length < 2;

  return (
    <div className="h-full rounded-[1.2rem] border-2 border-primary/60 bg-background px-4 py-2 flex flex-col justify-center">
      <div className="flex flex-col gap-1.5">
        {roles.map((r, rowIdx) => {
          const mins = r.pctAnswered ? calcRoleMinutes(monthlyCalls, r.pctAnswered) : 0;
          const hours = mins ? (mins / 60).toFixed(1) : "";
          const monthlyDollars =
            r.hourlyRate && mins ? Math.round((r.hourlyRate * mins) / 60) : 0;
          const showLabels = rowIdx === 0;
          return (
            <div
              key={r.id}
              className="grid grid-cols-[4.2rem_1.4fr_1fr_1fr_1fr_1fr_1.45rem] gap-3 items-end"
            >
              <div className="flex justify-start pb-1.5">
                {r.id === addTargetId && canAdd && (
                  <button
                    onClick={() => calcStore.addRole()}
                    className="inline-flex items-center gap-0.5 rounded-full bg-primary px-2 py-0.5 text-[0.72rem] font-extrabold text-primary-foreground hover:opacity-90"
                    data-no-stage-tap
                  >
                    <Plus className="h-3 w-3" /> ADD
                  </button>
                )}
              </div>

              {/* Role (opens QWERTY) */}
              <RoleField label="Role" showLabel={showLabels}>
                <button
                  onClick={() =>
                    openQwerty({
                      label: "Role",
                      initial: r.role,
                      placeholder: "Staff",
                      onCommit: (v) => {
                        calcStore.setRole(r.id, { role: v });
                        openQwerty(null);
                      },
                    })
                  }
                  className="h-[2.45rem] w-full rounded-md border-2 border-primary/40 bg-background px-3 text-[1.05rem] font-bold text-left text-foreground focus:outline-none focus:border-primary"
                  data-no-stage-tap
                >
                  {r.role || <span className="text-muted-foreground/60">Staff</span>}
                </button>
              </RoleField>

              {/* Hourly Rate (opens numeric keypad) */}
              <RoleField label="Hourly Rate" showLabel={showLabels}>
                <button
                  onClick={() =>
                    openNumPad({
                      label: "Hourly Rate",
                      initial: r.hourlyRate,
                      prefix: "$",
                      allowDecimal: true,
                      onCommit: (v) => calcStore.setRole(r.id, { hourlyRate: v }),
                    })
                  }
                  className="h-[2.45rem] w-full rounded-md border-2 border-primary/40 bg-background px-2 text-[1.1rem] font-bold tabular-nums text-center"
                  data-no-stage-tap
                >
                  {r.hourlyRate === null ? (
                    <span className="text-muted-foreground/60">$—</span>
                  ) : (
                    `$${r.hourlyRate}`
                  )}
                </button>
              </RoleField>

              {/* % Calls (opens numeric keypad) */}
              <RoleField label="% Calls" showLabel={showLabels}>
                <button
                  onClick={() =>
                    openNumPad({
                      label: "% Calls",
                      initial: r.pctAnswered,
                      suffix: "%",
                      max: 100,
                      allowDecimal: false,
                      onCommit: (v) => calcStore.setRole(r.id, { pctAnswered: v }),
                    })
                  }
                  className="h-[2.45rem] w-full rounded-md border-2 border-primary/40 bg-background px-2 text-[1.1rem] font-bold tabular-nums text-center"
                  data-no-stage-tap
                >
                  {r.pctAnswered === null ? (
                    <span className="text-muted-foreground/60">—%</span>
                  ) : (
                    `${r.pctAnswered}%`
                  )}
                </button>
              </RoleField>

              {/* # Hours (auto) */}
              <RoleField label="# Hours" showLabel={showLabels}>
                <div className="h-[2.45rem] w-full rounded-md border-2 border-dashed border-primary/30 bg-surface px-2 flex items-center justify-center text-[1.05rem] font-bold text-muted-foreground tabular-nums">
                  {hours || "—"}
                </div>
              </RoleField>

              {/* Monthly $ (auto) */}
              <RoleField label="Monthly $" showLabel={showLabels}>
                <div className="h-[2.45rem] w-full rounded-md border-2 border-dashed border-primary/30 bg-surface px-2 flex items-center justify-center text-[1.05rem] font-bold text-muted-foreground tabular-nums">
                  {monthlyDollars ? `$${monthlyDollars.toLocaleString()}` : "—"}
                </div>
              </RoleField>

              <button
                onClick={() => calcStore.removeRole(r.id)}
                disabled={roles.length <= 1}
                className="justify-self-end pb-2 rounded-full p-1 text-muted-foreground hover:text-destructive disabled:opacity-30"
                aria-label="Remove role"
                data-no-stage-tap
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RoleField({
  label,
  showLabel = true,
  children,
}: {
  label: string;
  showLabel?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-stretch min-w-0">
      {showLabel && (
        <div className="text-[0.95rem] font-extrabold text-foreground text-center leading-tight mb-0.5">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

function RailButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} data-no-stage-tap className="phaos-rail-button group">
      <span className="text-primary group-hover:scale-110 transition">{icon}</span>
      <span className="text-[0.88rem] font-extrabold text-foreground leading-none">{label}</span>
    </button>
  );
}

function NumberEdit({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </label>
  );
}
