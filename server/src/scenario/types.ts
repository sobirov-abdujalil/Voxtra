export const INTENTS = [
  'isolate_area',
  'notify_supervisor',
  'inspect_label',
  'document_incident',
  'ask_for_help',
  'approach_spill',
  'clean_spill',
  'leave_area',
] as const;

export type Intent = (typeof INTENTS)[number] | 'unknown';

export interface EvidenceEntry {
  turn: number;
  intent: string;
  from: string;
  to: string;
  scoreDelta: number;
  /** Deterministic rule id, e.g. "unidentified_spill::isolate_area". Set by the engine. */
  rule?: string;
  /** Deterministic outcome: 'applied' when ok, 'rejected' otherwise. Set by the engine. */
  result?: 'applied' | 'rejected';
  /** Sanitized user transcript for this turn. Set by the API layer (never inside the engine). */
  userTranscript?: string;
  /** Wall-clock ISO timestamp. Set by the API layer (never inside the engine). */
  timestamp?: string;
}

export interface ScenarioState {
  scenarioId: string;
  current: string;
  turn: number;
  score: number;
  completed: boolean;
  flags: Record<string, boolean>;
  evidence: EvidenceEntry[];
}

export interface TransitionDef {
  from: string;
  intent: string;
  to: string;
  scoreDelta: number;
  consequence: string;
  setFlags?: string[];
  clearFlags?: string[];
}

export interface CompletionCriteria {
  state: string;
  requiredFlags: string[];
}

export interface ScenarioDefinition {
  metadata: {
    id: string;
    title: string;
    version: string;
    description: string;
    initialState: string;
  };
  states: { id: string; label: string; terminal: boolean }[];
  intents: string[];
  criticalActions: string[];
  transitions: TransitionDef[];
  completionCriteria: CompletionCriteria;
  scoringRules: { startScore: number; notes: string };
  evidenceRequirements: string[];
  recoveryPaths: Record<string, string[]>;
  /** Optional explicit failure states. Defaults to ['exposed','abandoned'] (Warehouse) when absent. */
  failureStates?: string[];
  /** Optional recovery intents counted in breakdown.recovery even without a failure-state transition. */
  recoveryIntents?: string[];
}

export interface EngineResult {
  ok: boolean;
  state: ScenarioState;
  consequence: string;
  scoreDelta: number;
  completed: boolean;
  error?: { code: string; message: string };
}

export function isKnownIntent(intent: string): intent is Exclude<Intent, 'unknown'> {
  return (INTENTS as readonly string[]).includes(intent);
}
