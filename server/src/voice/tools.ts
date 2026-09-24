import { INTENTS } from '../scenario/types.js';

/** Canonical AssemblyAI Voice Agent WebSocket URL (no secret in it). */
export const VOICE_WS_URL = 'wss://agents.assemblyai.com/v1/ws';

/** Canonical submit_action tool: the ONLY structured path from speech to intent. */
export function submitActionTool(intents: readonly string[] = INTENTS, scenarioId?: string) {
  const base = {
    type: 'function' as const,
    name: 'submit_action',
    description:
      'Submit the trainee warehouse action once they have committed to it. Map natural phrasing to exactly one intent enum value.',
    parameters: {
      type: 'object' as const,
      properties: {
        intent: { type: 'string' as const, enum: [...intents] },
        rationale: { type: 'string' as const, description: 'Freeform reason in the trainee words (optional).' },
      },
      required: ['intent'],
      additionalProperties: false,
    },
  };
  // Forklift-only enrichment (2026-09-22 mapping fix): per-intent positive
  // triggers plus explicit do-NOT-use guards. The Warehouse default keeps its
  // exact historic shape (no intent description) so its mapping is untouched.
  if (scenarioId === 'forklift-incident') {
    return {
      ...base,
      parameters: {
        ...base.parameters,
        properties: {
          ...base.parameters.properties,
          intent: { ...base.parameters.properties.intent, description: FORKLIFT_INTENT_GUIDE },
        },
      },
    };
  }
  // Equipment-only enrichment (same pattern as Forklift): per-intent positive
  // triggers plus explicit do-NOT-use guards. Warehouse keeps its exact
  // historic shape; the Forklift branch above is untouched.
  if (scenarioId === 'equipment-malfunction') {
    return {
      ...base,
      parameters: {
        ...base.parameters,
        properties: {
          ...base.parameters.properties,
          intent: { ...base.parameters.properties.intent, description: EQUIPMENT_INTENT_GUIDE },
        },
      },
    };
  }
  return base;
}

export const SUBMIT_ACTION_TOOL = submitActionTool();

/**
 * Forklift per-intent mapping guide (2026-09-22 live-mapping fix). Each entry
 * carries a positive trigger plus an explicit do-NOT-use guard, focused on
 * the observed confusions: keep-still phrasing ("do not move him") is part of
 * the emergency call, never preserve_scene; optional steps fire only on clear
 * performance, never on mention. Attached to the tool schema for the Forklift
 * scenario only; the Warehouse default schema is byte-identical to before.
 */
const FORKLIFT_INTENT_GUIDE = [
  'Map each complete trainee utterance to exactly one intent:',
  'secure_scene: stopping the forklift, lockout/tagout, holding bystanders back. Do NOT use for keeping the victim still, calling for help, or photographing.',
  'call_emergency: calling 911 or summoning medics; "do not move him" said with the call belongs here. Do NOT use for notifying the shift manager.',
  'notify_supervisor: notifying the shift manager or safety officer; fire only after help is summoned unless the trainee explicitly escalates first. Do NOT use for calling 911.',
  'preserve_scene: photographing, marking positions, keeping everyone clear for investigation, only after the supervisor is notified. Do NOT use for "do not move him" or keeping the victim still.',
  'document_incident: filing the formal report to close out, only after the scene is preserved. Do NOT use for mentioning paperwork early.',
  'Unsafe intents (move_victim, restart_forklift, clear_aisle, handle_alone): fire only when the trainee explicitly says they will do that unsafe thing. Do NOT infer from safe phrasing — keep-still phrasing is call_emergency, holding people back is secure_scene.',
  'Optional intents (brief_operator, check_witnesses, confirm_certification): fire only when the trainee clearly states they are performing that step now. Do NOT use for mention in passing.',
  'Recovery (reassess, correct_course): pausing to reassess or correcting course. Do NOT use for bare acknowledgements.',
].join(' ');

/**
 * Equipment per-intent mapping guide (same pattern as Forklift). Each entry
 * carries a positive trigger plus an explicit do-NOT-use guard, focused on
 * the expected confusions: "stop it" is the e-stop, "cut the power / lock it
 * out" is the disconnect; going in yourself is enter_cell (unsafe), never
 * evacuate_area; checking the person is verify_technician, never
 * evacuate_area; filing the report is document_incident, never brief_team.
 * Attached to the tool schema for the Equipment scenario only; the Warehouse
 * default schema stays byte-identical and the Forklift guide is untouched.
 */
const EQUIPMENT_INTENT_GUIDE = [
  'Map each complete trainee utterance to exactly one intent:',
  'hit_estop: pressing the red emergency stop to halt the arm right now. Do NOT use for cutting power at the disconnect or applying lockout — that is isolate_power.',
  'isolate_power: opening the disconnect, de-energizing the cell, applying lockout/tagout. Do NOT use for pressing the e-stop — that is hit_estop.',
  'evacuate_area: getting everyone out of the cell and adjacent zones and accounting for all entrants. Do NOT use for going into the cell yourself — that is enter_cell and it is unsafe.',
  'verify_technician: checking the technician condition and confirming they are uninjured, only after the area is cleared. Do NOT use for clearing the area — that is evacuate_area.',
  'document_incident: filing the formal incident report to close out, only after the technician is verified. Do NOT use for a verbal team briefing — that is brief_team.',
  'Unsafe intents (enter_cell, reset_fault, continue_work, ignore_alarm): fire only when the trainee explicitly says they will do that unsafe thing. Do NOT infer from safe phrasing — clearing people out is evacuate_area, stopping the arm is hit_estop.',
  'Optional intents (brief_team, notify_maintenance, check_certifications): fire only when the trainee clearly states they are performing that step now. Do NOT use for mention in passing.',
  'Recovery (reassess, correct_course): pausing to reassess or correcting course. Do NOT use for bare acknowledgements.',
].join(' ');

const WAREHOUSE_PROMPT = [
  'You are a warehouse safety coach running the Warehouse Chemical Spill drill.',
  'Keep replies to one or two short sentences.',
  'Interpret the trainee speech and, once they commit to an action, call submit_action with exactly one intent enum value.',
  'Call submit_action exactly once per trainee utterance, and only immediately after a new trainee utterance.',
  'Never call submit_action while the trainee is silent.',
  'Never call submit_action twice for the same utterance.',
  'Never call submit_action for an action you describe yourself — only for an action the trainee says they will take.',
  'Example: trainee says "I will isolate the area first." -> call submit_action with intent isolate_area, then speak the consequence.',
  'Valid intents: isolate_area, notify_supervisor, inspect_label, document_incident, ask_for_help, approach_spill, clean_spill, leave_area.',
  'Never assert scores, state transitions, or completion — the deterministic engine decides those.',
  'Speak the consequence returned via tool.result, then ask what they do next.',
].join(' ');

function buildSystemPrompt(
  intents: readonly string[],
  scenario?: { id?: string; title?: string },
): string {
  // Warehouse keeps its exact historic prompt (no behavior change).
  const isWarehouse = !scenario?.id || scenario.id === 'warehouse-chemical-spill';
  if (isWarehouse) return WAREHOUSE_PROMPT;
  // Equipment reuses the Task 9 prompt skeleton (fragment no-fire,
  // immediate-fire, each-step-once, optional-only-on-performance) with
  // Equipment-specific content. The Forklift branch below is byte-identical
  // to before so its mapping is untouched.
  if (scenario?.id === 'equipment-malfunction') {
    const title = scenario?.title ?? scenario?.id ?? 'drill';
    return [
      `You are a warehouse safety coach running the ${title} drill.`,
      'Keep replies to one or two short sentences.',
      'Interpret the trainee speech and, once they commit to an action, call submit_action with exactly one intent enum value.',
      'Call submit_action exactly once per trainee utterance, and only immediately after a new trainee utterance.',
      'A complete actionable turn is a full commitment to one next step (for example, "Hitting the emergency stop now"). A fragment, trailing clause, or short acknowledgement (for example, "Right, it is stopped.") is NOT a new action: make no tool call at all for a fragment turn — just keep speaking normally and let the next complete utterance trigger its own call.',
      'Fire the tool call the moment the trainee finishes a complete utterance. Never hold a completed action for a later turn: a delayed call is recorded against the wrong turn. Fire each required step once: if tool.result says a step is already done, move on and never repeat it.',
      'Optional steps (brief_team, notify_maintenance, check_certifications) fire only when the trainee has clearly stated they are performing that step in this turn; do not fire on mention, acknowledgement, or implication.',
      '"Stop it" or "hit the button" means hit_estop (the emergency stop); "cut the power", "disconnect", or "lock it out" means isolate_power. Checking on the person is verify_technician, not clearing the area (evacuate_area). Filing the report is document_incident, not a verbal briefing (brief_team). Going into the cell yourself is enter_cell and unsafe — never infer it from clearing phrasing.',
      'Never call submit_action while the trainee is silent.',
      'Never call submit_action twice for the same utterance.',
      'Never call submit_action for an action you describe yourself — only for an action the trainee says they will take.',
      `Valid intents: ${[...intents].join(', ')}.`,
      'Never assert scores, state transitions, or completion — the deterministic engine decides those.',
      'Speak the consequence returned via tool.result, then ask what they do next.',
    ].join(' ');
  }
  const title = scenario?.title ?? scenario?.id ?? 'drill';
  return [
    `You are a warehouse safety coach running the ${title} drill.`,
    'Keep replies to one or two short sentences.',
    'Interpret the trainee speech and, once they commit to an action, call submit_action with exactly one intent enum value.',
    'Call submit_action exactly once per trainee utterance, and only immediately after a new trainee utterance.',
    'A complete actionable turn is a full commitment to one next step (for example, "Calling 911 right now"). A fragment, trailing clause, or short acknowledgement (for example, "Right, do not move him.") is NOT a new action: make no tool call at all for a fragment turn — just keep speaking normally and let the next complete utterance trigger its own call.',
    'Fire the tool call the moment the trainee finishes a complete utterance. Never hold a completed action for a later turn: a delayed call is recorded against the wrong turn. Fire each required step once: if tool.result says a step is already done, move on and never repeat it.',
    'Optional steps (brief_operator, check_witnesses, confirm_certification) fire only when the trainee has clearly stated they are performing that step in this turn; do not fire on mention, acknowledgement, or implication.',
    '"Do not move him" and "keep him still" are part of calling emergency help — never preserve_scene. preserve_scene means photographing, marking positions, and keeping everyone clear for investigation, only after the supervisor is notified. document_incident means filing the formal report, only after the scene is preserved.',
    'Never call submit_action while the trainee is silent.',
    'Never call submit_action twice for the same utterance.',
    'Never call submit_action for an action you describe yourself — only for an action the trainee says they will take.',
    `Valid intents: ${[...intents].join(', ')}.`,
    'Never assert scores, state transitions, or completion — the deterministic engine decides those.',
    'Speak the consequence returned via tool.result, then ask what they do next.',
  ].join(' ');
}

function buildGreeting(scenario?: { id?: string; title?: string }): string {
  if (!scenario?.id || scenario.id === 'warehouse-chemical-spill') {
    return 'Spill drill started. You see an unidentified spill. What do you do first?';
  }
  if (scenario.id === 'forklift-incident') {
    return 'Forklift drill started. A pedestrian is down by the forklift and the operator is shaken. What do you do first?';
  }
  if (scenario.id === 'equipment-malfunction') {
    return 'Equipment drill started. A robotic arm has re-energized with a technician inside the cell. What do you do first?';
  }
  return `${scenario.title ?? 'Drill'} started. What do you do first?`;
}

/**
 * Inline session.update payload (first WS message). Inline config is chosen over a
 * stored agent_id for the single-scenario hackathon (see docs/decisions.md).
 *
 * Shape verified live against the official events reference + session-configuration
 * docs (2026-09-20 smoke): barge-in is session.input.turn_detection.interrupt_response
 * (a top-level session.interrupt_response is rejected with invalid_format) and
 * output.voice must be a documented voice id.
 */
export function buildSessionUpdate(
  intents: readonly string[] = INTENTS,
  scenario?: { id?: string; title?: string },
) {
  return {
    type: 'session.update' as const,
    session: {
      system_prompt: buildSystemPrompt(intents, scenario),
      greeting: buildGreeting(scenario),
      input: { turn_detection: { interrupt_response: true } },
      output: { voice: 'alba' },
      tools: [submitActionTool(intents, scenario?.id)],
    },
  };
}

export interface ParsedToolCall {
  callId: string;
  intent: string;
  rationale?: string;
}

export interface ToolCallError {
  error: string;
}

/** Validate an incoming tool.call message for submit_action. Pure, no I/O. */
export function parseToolCall(msg: unknown, allowedIntents: readonly string[] = INTENTS): ParsedToolCall | ToolCallError {
  if (typeof msg !== 'object' || msg === null) return { error: 'MALFORMED_TOOL_CALL' };
  const m = msg as Record<string, unknown>;
  if (m['type'] !== 'tool.call') return { error: 'MALFORMED_TOOL_CALL' };
  const callId = m['call_id'] ?? m['id'];
  const name = m['name'] ?? (m['tool'] as Record<string, unknown> | undefined)?.['name'];
  const argsRaw = m['arguments'] ?? m['args'] ?? (m['tool'] as Record<string, unknown> | undefined)?.['arguments'];
  if (typeof callId !== 'string' || callId.length === 0 || callId.length > 128) {
    return { error: 'MALFORMED_TOOL_CALL' };
  }
  if (name !== 'submit_action') return { error: 'UNKNOWN_TOOL' };
  let args: Record<string, unknown>;
  if (typeof argsRaw === 'string') {
    try {
      args = JSON.parse(argsRaw) as Record<string, unknown>;
    } catch {
      return { error: 'MALFORMED_TOOL_CALL' };
    }
  } else if (typeof argsRaw === 'object' && argsRaw !== null) {
    args = argsRaw as Record<string, unknown>;
  } else {
    return { error: 'MALFORMED_TOOL_CALL' };
  }
  const intent = args['intent'];
  if (typeof intent !== 'string' || intent.length === 0 || intent.length > 64) {
    return { error: 'MALFORMED_TOOL_CALL' };
  }
  if (!(allowedIntents as readonly string[]).includes(intent)) {
    return { error: 'UNKNOWN_INTENT' };
  }
  const rationale = args['rationale'];
  if (rationale !== undefined && typeof rationale !== 'string') {
    return { error: 'MALFORMED_TOOL_CALL' };
  }
  return {
    callId,
    intent,
    rationale: typeof rationale === 'string' ? rationale.slice(0, 500) : undefined,
  };
}

/** Build the tool.result reply after POST /turn. Pure. Shape per the events reference. */
export function buildToolResult(callId: string, consequence: string, ok: boolean) {
  return {
    type: 'tool.result' as const,
    call_id: callId,
    result: consequence.slice(0, 2000),
    ...(ok ? {} : { is_error: true as const }),
  };
}
