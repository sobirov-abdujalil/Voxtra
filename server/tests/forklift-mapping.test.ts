import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { ServerConfig } from '../src/config.js';
import { applyAction, buildReport, createInitialState } from '../src/scenario/engine.js';
import { loadScenarios } from '../src/scenario/loader.js';
import { buildSessionUpdate, submitActionTool } from '../src/voice/tools.js';

/**
 * Regression cover for the 2026-09-22 Forklift live-voice golden failure:
 * 10 turns / 59-57 instead of 5 turns / 57-57. Turn 2's fragment
 * ("Right, do not move him.", split off the "Calling 911…" utterance) was
 * mapped to preserve_scene, optional/early intents fired before their step,
 * and the report rendered a numerator above its denominator.
 *
 * Each test below fails on the pre-fix code and passes after the fix.
 */

const baseConfig: ServerConfig = {
  port: 3001,
  corsOrigin: 'http://localhost:5173',
  assemblyApiKey: undefined,
  assemblyTokenUrl: 'https://agents.assemblyai.com/v1/token',
};

// Byte-stable Warehouse prompt (historic literal — must not change).
const WAREHOUSE_PROMPT =
  'You are a warehouse safety coach running the Warehouse Chemical Spill drill. ' +
  'Keep replies to one or two short sentences. ' +
  'Interpret the trainee speech and, once they commit to an action, call submit_action with exactly one intent enum value. ' +
  'Call submit_action exactly once per trainee utterance, and only immediately after a new trainee utterance. ' +
  'Never call submit_action while the trainee is silent. ' +
  'Never call submit_action twice for the same utterance. ' +
  'Never call submit_action for an action you describe yourself — only for an action the trainee says they will take. ' +
  'Example: trainee says "I will isolate the area first." -> call submit_action with intent isolate_area, then speak the consequence. ' +
  'Valid intents: isolate_area, notify_supervisor, inspect_label, document_incident, ask_for_help, approach_spill, clean_spill, leave_area. ' +
  'Never assert scores, state transitions, or completion — the deterministic engine decides those. ' +
  'Speak the consequence returned via tool.result, then ask what they do next.';

const WAREHOUSE_TOOL_DESCRIPTION =
  'Submit the trainee warehouse action once they have committed to it. Map natural phrasing to exactly one intent enum value.';

function forkliftDef() {
  const scenarios = loadScenarios();
  const def = scenarios.get('forklift-incident');
  if (!def) throw new Error('forklift scenario missing');
  return def;
}

describe('forklift agent prompt: turn discipline (H1/H3)', () => {
  it('instructs the agent not to tool-fire on fragments or acknowledgements', () => {
    const prompt = buildSessionUpdate(['secure_scene'], {
      id: 'forklift-incident',
      title: 'Forklift Incident',
    }).session.system_prompt as string;
    expect(prompt).toMatch(/fragment/i);
    expect(prompt).toMatch(/make no tool call at all for a fragment/i);
    expect(prompt).toMatch(/never hold a completed action/i);
    // The exact observed failure mode must be named so the rule is concrete.
    expect(prompt).toMatch(/do not move him/i);
  });

  it('fires optional intents only on clear performance, never on mention', () => {
    const prompt = buildSessionUpdate(['secure_scene'], {
      id: 'forklift-incident',
      title: 'Forklift Incident',
    }).session.system_prompt as string;
    expect(prompt).toContain('brief_operator');
    expect(prompt).toMatch(/only when the trainee .* performing that step/i);
    expect(prompt).toMatch(/do not fire on mention/i);
  });

  it('disambiguates preserve_scene from keep-still phrasing', () => {
    const prompt = buildSessionUpdate(['secure_scene'], {
      id: 'forklift-incident',
      title: 'Forklift Incident',
    }).session.system_prompt as string;
    expect(prompt).toMatch(/preserve_scene.*photograph/i);
    expect(prompt).toMatch(/never preserve_scene/i);
  });

  it('requires each step once and moves on when the engine reports it done', () => {
    const prompt = buildSessionUpdate(['secure_scene'], {
      id: 'forklift-incident',
      title: 'Forklift Incident',
    }).session.system_prompt as string;
    expect(prompt).toMatch(/each .* step once/i);
    expect(prompt).toMatch(/already done/i);
  });
});

describe('warehouse agent prompt stability', () => {
  it('keeps the warehouse system prompt byte-identical', () => {
    const prompt = buildSessionUpdate().session.system_prompt;
    expect(prompt).toBe(WAREHOUSE_PROMPT);
  });
});

describe('submit_action tool descriptions (H2)', () => {
  it('forklift intent carries positive triggers plus do-NOT-use guards', () => {
    const tool = submitActionTool(
      ['secure_scene', 'call_emergency', 'preserve_scene', 'brief_operator'],
      'forklift-incident',
    );
    const desc = (tool.parameters.properties.intent as { description?: unknown }).description as
      | string
      | undefined;
    expect(typeof desc).toBe('string');
    expect(desc).toContain('secure_scene');
    expect(desc).toMatch(/do NOT use/i);
    // The exact observed confusion: keep-still phrasing is not preserve_scene.
    expect(desc).toMatch(/preserve_scene.*do NOT use for.*do not move him/is);
    // Optional eagerness guard on the observed early-bonus intents.
    expect(desc).toMatch(/brief_operator.*only when/is);
  });

  it('keeps the warehouse default tool description byte-identical', () => {
    const tool = submitActionTool();
    expect(tool.description).toBe(WAREHOUSE_TOOL_DESCRIPTION);
    expect(tool.parameters.properties.intent).not.toHaveProperty('description');
  });

  it('serves forklift descriptions via agent-config without changing warehouse', async () => {
    const app = createApp(baseConfig);
    const forklift = await request(app).get('/api/voice/agent-config?scenarioId=forklift-incident');
    expect(forklift.status).toBe(200);
    const forkDesc = forklift.body.data.submitActionTool.parameters.properties.intent.description as
      | string
      | undefined;
    expect(typeof forkDesc).toBe('string');
    expect(forkDesc).toMatch(/do NOT use/i);
    expect(forklift.body.data.sessionUpdate.session.system_prompt).toMatch(/fragment/i);

    const warehouse = await request(app).get('/api/voice/agent-config?scenarioId=warehouse-chemical-spill');
    expect(warehouse.status).toBe(200);
    expect(warehouse.body.data.sessionUpdate.session.system_prompt).toBe(WAREHOUSE_PROMPT);
    expect(warehouse.body.data.submitActionTool.description).toBe(WAREHOUSE_TOOL_DESCRIPTION);
    expect(warehouse.body.data.submitActionTool.parameters.properties.intent).not.toHaveProperty('description');
  });
});

describe('report headline invariant: numerator never exceeds denominator (H4)', () => {
  it('caps the forklift bonus run at 57/57 with +2 bonus explained', () => {
    const def = forkliftDef();
    let s = createInitialState(def);
    // Replays the observed live failure shape: golden steps plus the early
    // notify self-loop bonus (+2) that produced the 59/57 display.
    for (const intent of [
      'secure_scene',
      'notify_supervisor',
      'call_emergency',
      'notify_supervisor',
      'preserve_scene',
      'document_incident',
    ]) {
      s = applyAction(def, s, intent).state;
    }
    expect(s.score).toBe(59);
    const report = buildReport(s, def);
    expect(report.denominator).toBe(57);
    expect(report.bonusPoints).toBe(2);
    expect(report.headlineScore).toBe(57);
    expect(report.headlineScore).toBeLessThanOrEqual(report.denominator);
    expect(report.summary).toContain('57/57');
    expect(report.summary).not.toContain('59/57');
  });

  it('leaves clean golden paths with zero bonus on both scenarios', () => {
    const scenarios = loadScenarios();
    const forklift = scenarios.get('forklift-incident');
    const warehouse = scenarios.get('warehouse-chemical-spill');
    if (!forklift || !warehouse) throw new Error('scenarios missing');
    let f = createInitialState(forklift);
    for (const intent of ['secure_scene', 'call_emergency', 'notify_supervisor', 'preserve_scene', 'document_incident']) {
      f = applyAction(forklift, f, intent).state;
    }
    const forkReport = buildReport(f, forklift);
    expect(forkReport.score).toBe(57);
    expect(forkReport.bonusPoints).toBe(0);
    expect(forkReport.headlineScore).toBe(57);
    expect(forkReport.summary).toContain('57/57');

    let w = createInitialState(warehouse);
    for (const intent of ['isolate_area', 'notify_supervisor', 'inspect_label', 'document_incident', 'clean_spill']) {
      w = applyAction(warehouse, w, intent).state;
    }
    const wareReport = buildReport(w, warehouse);
    expect(wareReport.score).toBe(58);
    expect(wareReport.bonusPoints).toBe(0);
    expect(wareReport.headlineScore).toBe(58);
    expect(wareReport.summary).toContain('58/58');
  });

  it('never inflates a penalized run: headline equals the true score below the denominator', () => {
    const def = forkliftDef();
    let s = createInitialState(def);
    for (const intent of [
      'secure_scene',
      'move_victim',
      'call_emergency',
      'notify_supervisor',
      'preserve_scene',
      'document_incident',
    ]) {
      s = applyAction(def, s, intent).state;
    }
    expect(s.score).toBe(45);
    const report = buildReport(s, def);
    expect(report.bonusPoints).toBe(0);
    expect(report.headlineScore).toBe(45);
    expect(report.summary).toContain('45/57');
  });
});
