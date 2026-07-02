import { useEffect, useState, useSyncExternalStore } from "react";

// Lightweight global store with localStorage persistence.

export type CellKey =
  | "monthlyCalls"
  | "missedCalls"
  | "callbackTime"
  | "missedBookings"
  | "avgPrice"
  | "paidAnswering"
  | "estAIBookings"
  | "refocusedStaff";

export interface RoleRow {
  id: string;
  role: string;
  hourlyRate: number | null;
  pctAnswered: number | null;
}

export interface AddedIntegration {
  id: string;
  name: string;
  tier: "prebuilt" | "netnew" | "custom";
}

export interface AdvancedConfig {
  phoneLines: number;
  uniqueAgents: number;
  duplicatedAgents: number;
  additionalLanguages: number;
  integrationsPreBuilt: number;
  integrationsNetNew: number;
  integrationsCustom: number;
  capacityBlocks: number;
  addedIntegrations: AddedIntegration[];
}

export interface CalcState {
  values: Record<CellKey, number | null>;
  roles: RoleRow[];
  resolvePct: number | null;
  revealedSavings: boolean;
  revealedPrice: boolean;
  revealedItalics: boolean;
  bulletsShown: number;
  showImSold: boolean;
  showAdvanced: boolean;
  seenQuotes: Partial<Record<CellKey, boolean>>;
  advancedOpen: boolean;
  advancedStage: number;
  advanced: AdvancedConfig;
  businessName: string;
}

export const DEFAULT_ADVANCED: AdvancedConfig = {
  phoneLines: 0,
  uniqueAgents: 0,
  duplicatedAgents: 0,
  additionalLanguages: 0,
  integrationsPreBuilt: 0,
  integrationsNetNew: 0,
  integrationsCustom: 0,
  capacityBlocks: 0,
  addedIntegrations: [],
};



const STORAGE_KEY = "phaos.calc.v1";

function freshId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `r_${Math.random().toString(36).slice(2)}`;
}

const initialState: CalcState = {
  values: {
    monthlyCalls: null,
    missedCalls: null,
    callbackTime: null,
    missedBookings: null,
    avgPrice: null,
    paidAnswering: null,
    estAIBookings: null,
    refocusedStaff: null,
  },
  roles: [{ id: "seed", role: "", hourlyRate: null, pctAnswered: null }],
  resolvePct: null,
  revealedSavings: false,
  revealedPrice: false,
  revealedItalics: false,
  bulletsShown: 0,
  showImSold: false,
  showAdvanced: false,
  seenQuotes: {},
  advancedOpen: false,
  advancedStage: 0,
  advanced: { ...DEFAULT_ADVANCED },
  businessName: "",
};



function loadFromStorage(): CalcState {
  if (typeof window === "undefined") return structuredClone(initialState);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(initialState);
    const parsed = JSON.parse(raw) as Partial<CalcState>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return structuredClone(initialState);
    }
    const parsedValues =
      parsed.values && typeof parsed.values === "object" && !Array.isArray(parsed.values)
        ? parsed.values
        : {};
    return {
      ...structuredClone(initialState),
      ...parsed,
      values: { ...initialState.values, ...parsedValues },
      advanced: { ...DEFAULT_ADVANCED, ...(parsed.advanced ?? {}) },
      roles:
        Array.isArray(parsed.roles) && parsed.roles.length > 0
          ? parsed.roles
          : [{ id: freshId(), role: "", hourlyRate: null, pctAnswered: null }],
    };
  } catch {
    return structuredClone(initialState);
  }
}

let state: CalcState = structuredClone(initialState);
let hydrated = false;
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  state = loadFromStorage();
  if (state.roles.length === 0) {
    state.roles = [{ id: freshId(), role: "", hourlyRate: null, pctAnswered: null }];
  }
  hydrated = true;
}

export const calcStore = {
  get: () => {
    ensureHydrated();
    return state;
  },
  set: (partial: Partial<CalcState> | ((s: CalcState) => Partial<CalcState>)) => {
    ensureHydrated();
    const next = typeof partial === "function" ? partial(state) : partial;
    state = { ...state, ...next };
    emit();
  },
  setValue: (key: CellKey, value: number | null) => {
    ensureHydrated();
    state = { ...state, values: { ...state.values, [key]: value } };
    emit();
  },
  markQuoteSeen: (key: CellKey) => {
    ensureHydrated();
    if (state.seenQuotes[key]) return;
    state = { ...state, seenQuotes: { ...state.seenQuotes, [key]: true } };
    emit();
  },

  setRole: (id: string, patch: Partial<RoleRow>) => {
    ensureHydrated();
    state = {
      ...state,
      roles: state.roles.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    };
    emit();
  },
  addRole: () => {
    ensureHydrated();
    if (state.roles.length >= 2) return;
    state = {
      ...state,
      roles: [
        ...state.roles,
        { id: freshId(), role: "", hourlyRate: null, pctAnswered: null },
      ],
    };
    emit();
  },
  removeRole: (id: string) => {
    ensureHydrated();
    if (state.roles.length <= 1) return;
    state = { ...state, roles: state.roles.filter((r) => r.id !== id) };
    emit();
  },
  setAdvanced: (patch: Partial<AdvancedConfig>) => {
    ensureHydrated();
    state = { ...state, advanced: { ...state.advanced, ...patch } };
    emit();
  },
  addIntegration: (item: AddedIntegration) => {
    ensureHydrated();
    const adv = state.advanced;
    const list = adv.addedIntegrations ?? [];
    if (list.some((i) => i.name.toLowerCase() === item.name.toLowerCase())) return;
    const next = { ...adv, addedIntegrations: [...list, item] };
    if (item.tier === "prebuilt") next.integrationsPreBuilt = adv.integrationsPreBuilt + 1;
    if (item.tier === "netnew") next.integrationsNetNew = adv.integrationsNetNew + 1;
    if (item.tier === "custom") next.integrationsCustom = adv.integrationsCustom + 1;
    state = { ...state, advanced: next };
    emit();
  },
  removeIntegration: (id: string) => {
    ensureHydrated();
    const adv = state.advanced;
    const list = adv.addedIntegrations ?? [];
    const found = list.find((i) => i.id === id);
    if (!found) return;
    const next = { ...adv, addedIntegrations: list.filter((i) => i.id !== id) };
    if (found.tier === "prebuilt") next.integrationsPreBuilt = Math.max(0, adv.integrationsPreBuilt - 1);
    if (found.tier === "netnew") next.integrationsNetNew = Math.max(0, adv.integrationsNetNew - 1);
    if (found.tier === "custom") next.integrationsCustom = Math.max(0, adv.integrationsCustom - 1);
    state = { ...state, advanced: next };
    emit();
  },

  reset: () => {
    state = {
      ...structuredClone(initialState),
      roles: [{ id: freshId(), role: "", hourlyRate: null, pctAnswered: null }],
    };
    hydrated = true;
    emit();
  },
  subscribe: (cb: () => void) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};

export function useCalc<T>(selector: (s: CalcState) => T): T {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    ensureHydrated();
    setIsClient(true);
  }, []);

  return useSyncExternalStore(
    (cb) => calcStore.subscribe(cb),
    () => selector(isClient ? calcStore.get() : initialState),
    () => selector(initialState),
  );
}

// ============================================================
// Step / visibility helpers
// ============================================================
export type Step =
  | CellKey
  | "roles"
  | "slider"
  | "savings"
  | "price"
  | "bullets"
  | "imSold"
  | "advanced"
  | "done";

const CELL_ORDER: CellKey[] = [
  "monthlyCalls",
  "missedCalls",
  "callbackTime",
  "missedBookings",
  "estAIBookings",
  "refocusedStaff",
  "paidAnswering",
  "avgPrice",
];


export function currentStep(s: CalcState): Step {
  for (const key of CELL_ORDER) {
    if (s.values[key] === null) return key;
  }
  const r = s.roles[0];
  const roleComplete =
    !!r && r.role.trim().length > 0 && r.hourlyRate !== null && r.pctAnswered !== null;
  if (!roleComplete) return "roles";
  if (s.resolvePct === null) return "slider";
  if (!s.revealedSavings) return "savings";
  if (!s.revealedPrice) return "price";
  if (s.bulletsShown < 6) return "bullets";
  if (!s.showImSold) return "imSold";
  if (!s.showAdvanced) return "advanced";
  return "done";
}

export function isCellVisible(s: CalcState, key: CellKey): boolean {
  const idx = CELL_ORDER.indexOf(key);
  if (idx === 0) return true;
  return CELL_ORDER.slice(0, idx).every((k) => s.values[k] !== null);
}

export function isAdditionalSalesVisible(s: CalcState): boolean {
  return CELL_ORDER.every((k) => s.values[k] !== null);
}

export function isRoleVisible(s: CalcState): boolean {
  return isAdditionalSalesVisible(s);
}

export function isSliderVisible(s: CalcState): boolean {
  if (!isRoleVisible(s)) return false;
  const r = s.roles[0];
  return !!r && r.role.trim().length > 0 && r.hourlyRate !== null && r.pctAnswered !== null;
}
