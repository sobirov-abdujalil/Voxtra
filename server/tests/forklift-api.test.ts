import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { ServerConfig } from '../src/config.js';
import { buildSessionUpdate, parseToolCall, submitActionTool } from '../src/voice/tools.js';

const baseConfig: ServerConfig = {
  port: 3001,
  corsOrigin: 'http://localhost:5173',
  assemblyApiKey: undefined,
  assemblyTokenUrl: 'https://agents.assemblyai.com/v1/token',
};

describe('API: forklift session golden path', () => {
  it('creates a forklift session and runs five turns to 57/57', async () => {
    const app = createApp(baseConfig);
    const created = await request(app).post('/api/sessions').send({ scenarioId: 'forklift-incident' });
    expect(created.status).toBe(201);
    const sessionId = created.body.data.sessionId as string;
    const intents = ['secure_scene', 'call_emergency', 'notify_supervisor', 'preserve_scene', 'document_incident'];
    const deltas = [12, 11, 9, 10, 15];
    const states = ['scene_secured', 'help_summoned', 'supervisor_notified', 'scene_preserved', 'resolved'];
    for (let i = 0; i < intents.length; i++) {
      const turn = await request(app).post(`/api/sessions/${sessionId}/turn`).send({ intent: intents[i] });
      expect(turn.status).toBe(200);
      expect(turn.body.data.state.current).toBe(states[i]);
      expect(turn.body.data.scoreDelta).toBe(deltas[i]);
    }
    const report = await request(app).get(`/api/sessions/${sessionId}/report`);
    expect(report.status).toBe(200);
    expect(report.body.data.scenarioId).toBe('forklift-incident');
    expect(report.body.data.completed).toBe(true);
    expect(report.body.data.score).toBe(57);
    expect(report.body.data.denominator).toBe(57);
    expect(report.body.data.summary).toContain('57/57');
    expect(report.body.data.breakdown.completed).toHaveLength(5);
    expect(report.body.data.breakdown.missed).toHaveLength(0);
    expect(report.body.data.breakdown.invalid).toHaveLength(0);
    expect(report.body.data.evidence).toHaveLength(5);
  });

  it('defaults to warehouse when scenarioId is omitted', async () => {
    const app = createApp(baseConfig);
    const created = await request(app).post('/api/sessions').send({});
    expect(created.status).toBe(201);
    const report = await request(app).get(`/api/sessions/${created.body.data.sessionId as string}/report`);
    expect(report.body.data.scenarioId).toBe('warehouse-chemical-spill');
  });

  it('forklift invalid move_victim penalizes with no transition, then recovery is recorded', async () => {
    const app = createApp(baseConfig);
    const created = await request(app).post('/api/sessions').send({ scenarioId: 'forklift-incident' });
    const sessionId = created.body.data.sessionId as string;
    const bad = await request(app)
      .post(`/api/sessions/${sessionId}/turn`)
      .send({ intent: 'move_victim', userTranscript: 'I will move him out of the way' });
    expect(bad.status).toBe(200);
    expect(bad.body.data.state.current).toBe('initial');
    expect(bad.body.data.scoreDelta).toBe(-12);
    const rec = await request(app).post(`/api/sessions/${sessionId}/turn`).send({ intent: 'reassess' });
    expect(rec.status).toBe(200);
    expect(rec.body.data.scoreDelta).toBeGreaterThan(0);
    const report = await request(app).get(`/api/sessions/${sessionId}/report`);
    expect(report.body.data.breakdown.penalties[0]).toMatchObject({ turn: 1, intent: 'move_victim' });
    expect(report.body.data.breakdown.recovery.map((r: { turn: number }) => r.turn)).toContain(2);
  });

  it('warehouse golden path still passes unchanged', async () => {
    const app = createApp(baseConfig);
    const created = await request(app).post('/api/sessions').send({ scenarioId: 'warehouse-chemical-spill' });
    const sessionId = created.body.data.sessionId as string;
    for (const intent of ['isolate_area', 'notify_supervisor', 'inspect_label', 'document_incident', 'clean_spill']) {
      const turn = await request(app).post(`/api/sessions/${sessionId}/turn`).send({ intent });
      expect(turn.status).toBe(200);
    }
    const report = await request(app).get(`/api/sessions/${sessionId}/report`);
    expect(report.body.data.score).toBe(58);
    expect(report.body.data.denominator).toBe(58);
  });
});

describe('API: per-scenario agent config', () => {
  it('warehouse config contains only warehouse intents', async () => {
    const app = createApp(baseConfig);
    const res = await request(app).get('/api/voice/agent-config?scenarioId=warehouse-chemical-spill');
    expect(res.status).toBe(200);
    const intents = res.body.data.submitActionTool.parameters.properties.intent.enum as string[];
    expect(intents).toContain('isolate_area');
    expect(intents).not.toContain('secure_scene');
    expect(res.body.data.sessionUpdate.session.tools[0].name).toBe('submit_action');
  });

  it('forklift config contains only forklift intents', async () => {
    const app = createApp(baseConfig);
    const res = await request(app).get('/api/voice/agent-config?scenarioId=forklift-incident');
    expect(res.status).toBe(200);
    const intents = res.body.data.submitActionTool.parameters.properties.intent.enum as string[];
    expect(intents).toContain('secure_scene');
    expect(intents).toContain('move_victim');
    expect(intents).not.toContain('isolate_area');
    expect(res.body.data.scenarioId).toBe('forklift-incident');
    expect(JSON.stringify(res.body)).not.toMatch(/ASSEMBLYAI_API_KEY/i);
  });

  it('defaults to warehouse when no scenarioId is given', async () => {
    const app = createApp(baseConfig);
    const res = await request(app).get('/api/voice/agent-config');
    expect(res.status).toBe(200);
    const intents = res.body.data.submitActionTool.parameters.properties.intent.enum as string[];
    expect(intents).toContain('isolate_area');
  });

  it('submit_action tool enum matches the scenario def intents exactly', async () => {
    const app = createApp(baseConfig);
    for (const id of ['warehouse-chemical-spill', 'forklift-incident']) {
      const scen = await request(app).get(`/api/scenarios/${id}`);
      const agent = await request(app).get(`/api/voice/agent-config?scenarioId=${id}`);
      expect([...agent.body.data.submitActionTool.parameters.properties.intent.enum].sort()).toEqual(
        [...scen.body.data.intents].sort(),
      );
    }
  });

  it('parseToolCall validates against a per-scenario allowlist', () => {
    const forkliftIntents = ['secure_scene', 'move_victim'];
    const ok = parseToolCall(
      { type: 'tool.call', call_id: 'c1', name: 'submit_action', arguments: JSON.stringify({ intent: 'secure_scene' }) },
      forkliftIntents,
    );
    expect(ok).toMatchObject({ intent: 'secure_scene' });
    const bad = parseToolCall(
      { type: 'tool.call', call_id: 'c2', name: 'submit_action', arguments: JSON.stringify({ intent: 'isolate_area' }) },
      forkliftIntents,
    );
    expect(bad).toMatchObject({ error: 'UNKNOWN_INTENT' });
  });

  it('buildSessionUpdate keeps warehouse prompt stable and forklift prompt distinct', () => {
    const warehouse = buildSessionUpdate(['isolate_area']);
    expect(warehouse.session.system_prompt).toContain('Warehouse Chemical Spill');
    const forklift = buildSessionUpdate(['secure_scene'], { id: 'forklift-incident', title: 'Forklift Incident' });
    expect(forklift.session.system_prompt).toContain('Forklift Incident');
    expect(forklift.session.system_prompt).toContain('secure_scene');
    expect(forklift.session.greeting).toContain('Forklift');
    expect(submitActionTool(['secure_scene']).parameters.properties.intent.enum).toEqual(['secure_scene']);
  });
});
