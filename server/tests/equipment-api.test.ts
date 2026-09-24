import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { ServerConfig } from '../src/config.js';
import { buildSessionUpdate, submitActionTool } from '../src/voice/tools.js';

const baseConfig: ServerConfig = {
  port: 3001,
  corsOrigin: 'http://localhost:5173',
  assemblyApiKey: undefined,
  assemblyTokenUrl: 'https://agents.assemblyai.com/v1/token',
};

const EQUIPMENT_IDS = ['warehouse-chemical-spill', 'forklift-incident', 'equipment-malfunction'];

describe('API: equipment session golden path', () => {
  it('creates an equipment session and runs five turns to 65/65', async () => {
    const app = createApp(baseConfig);
    const created = await request(app).post('/api/sessions').send({ scenarioId: 'equipment-malfunction' });
    expect(created.status).toBe(201);
    const sessionId = created.body.data.sessionId as string;
    const intents = ['hit_estop', 'isolate_power', 'evacuate_area', 'verify_technician', 'document_incident'];
    const deltas = [15, 15, 10, 10, 15];
    const states = ['estopped', 'isolated', 'evacuated', 'verified', 'resolved'];
    for (let i = 0; i < intents.length; i++) {
      const turn = await request(app).post(`/api/sessions/${sessionId}/turn`).send({ intent: intents[i] });
      expect(turn.status).toBe(200);
      expect(turn.body.data.state.current).toBe(states[i]);
      expect(turn.body.data.scoreDelta).toBe(deltas[i]);
    }
    const report = await request(app).get(`/api/sessions/${sessionId}/report`);
    expect(report.status).toBe(200);
    expect(report.body.data.scenarioId).toBe('equipment-malfunction');
    expect(report.body.data.completed).toBe(true);
    expect(report.body.data.score).toBe(65);
    expect(report.body.data.denominator).toBe(65);
    expect(report.body.data.headlineScore).toBe(65);
    expect(report.body.data.bonusPoints).toBe(0);
    expect(report.body.data.summary).toContain('65/65');
    expect(report.body.data.breakdown.completed).toHaveLength(5);
    expect(report.body.data.breakdown.missed).toHaveLength(0);
    expect(report.body.data.breakdown.invalid).toHaveLength(0);
    expect(report.body.data.evidence).toHaveLength(5);
  });

  it('equipment invalid enter_cell penalizes with no transition, then recovery is recorded', async () => {
    const app = createApp(baseConfig);
    const created = await request(app).post('/api/sessions').send({ scenarioId: 'equipment-malfunction' });
    const sessionId = created.body.data.sessionId as string;
    const bad = await request(app)
      .post(`/api/sessions/${sessionId}/turn`)
      .send({ intent: 'enter_cell', userTranscript: 'I will go in and check the arm' });
    expect(bad.status).toBe(200);
    expect(bad.body.data.state.current).toBe('initial');
    expect(bad.body.data.scoreDelta).toBe(-15);
    const rec = await request(app).post(`/api/sessions/${sessionId}/turn`).send({ intent: 'reassess' });
    expect(rec.status).toBe(200);
    expect(rec.body.data.scoreDelta).toBeGreaterThan(0);
    const report = await request(app).get(`/api/sessions/${sessionId}/report`);
    expect(report.body.data.breakdown.penalties[0]).toMatchObject({ turn: 1, intent: 'enter_cell' });
    expect(report.body.data.breakdown.recovery.map((r: { turn: number }) => r.turn)).toContain(2);
  });

  it('warehouse and forklift golden paths still pass unchanged in the same suite', async () => {
    const app = createApp(baseConfig);
    const warehouse = await request(app).post('/api/sessions').send({ scenarioId: 'warehouse-chemical-spill' });
    const wId = warehouse.body.data.sessionId as string;
    for (const intent of ['isolate_area', 'notify_supervisor', 'inspect_label', 'document_incident', 'clean_spill']) {
      const turn = await request(app).post(`/api/sessions/${wId}/turn`).send({ intent });
      expect(turn.status).toBe(200);
    }
    const wReport = await request(app).get(`/api/sessions/${wId}/report`);
    expect(wReport.body.data.score).toBe(58);
    expect(wReport.body.data.denominator).toBe(58);

    const forklift = await request(app).post('/api/sessions').send({ scenarioId: 'forklift-incident' });
    const fId = forklift.body.data.sessionId as string;
    for (const intent of ['secure_scene', 'call_emergency', 'notify_supervisor', 'preserve_scene', 'document_incident']) {
      const turn = await request(app).post(`/api/sessions/${fId}/turn`).send({ intent });
      expect(turn.status).toBe(200);
    }
    const fReport = await request(app).get(`/api/sessions/${fId}/report`);
    expect(fReport.body.data.score).toBe(57);
    expect(fReport.body.data.denominator).toBe(57);
  });
});

describe('API: per-scenario agent config covers all three scenarios', () => {
  it('submit_action tool enum matches the scenario def intents exactly for all three', async () => {
    const app = createApp(baseConfig);
    for (const id of EQUIPMENT_IDS) {
      const scen = await request(app).get(`/api/scenarios/${id}`);
      const agent = await request(app).get(`/api/voice/agent-config?scenarioId=${id}`);
      expect(agent.status).toBe(200);
      expect([...agent.body.data.submitActionTool.parameters.properties.intent.enum].sort()).toEqual(
        [...scen.body.data.intents].sort(),
      );
    }
  });

  it('equipment config contains only equipment intents with no cross-contamination', async () => {
    const app = createApp(baseConfig);
    const res = await request(app).get('/api/voice/agent-config?scenarioId=equipment-malfunction');
    expect(res.status).toBe(200);
    const intents = res.body.data.submitActionTool.parameters.properties.intent.enum as string[];
    expect(intents).toContain('hit_estop');
    expect(intents).toContain('enter_cell');
    expect(intents).not.toContain('isolate_area');
    expect(intents).not.toContain('secure_scene');
    expect(res.body.data.scenarioId).toBe('equipment-malfunction');
    expect(res.body.data.sessionUpdate.session.greeting).toContain('Equipment');
    expect(JSON.stringify(res.body)).not.toMatch(/ASSEMBLYAI_API_KEY/i);
  });

  it('equipment intent guide carries positive triggers plus do-NOT-use guards', async () => {
    const app = createApp(baseConfig);
    const res = await request(app).get('/api/voice/agent-config?scenarioId=equipment-malfunction');
    const desc = res.body.data.submitActionTool.parameters.properties.intent.description as string;
    expect(typeof desc).toBe('string');
    expect(desc).toContain('hit_estop');
    expect(desc).toMatch(/do NOT use/i);
    // Priority confusions from the brief: stop-vs-isolate, in-vs-out, check-vs-clear, file-vs-brief.
    expect(desc).toMatch(/hit_estop.*do NOT use for.*isolate_power/is);
    expect(desc).toMatch(/evacuate_area.*do NOT use for.*enter_cell/is);
    expect(desc).toMatch(/verify_technician.*do NOT use for.*evacuate_area/is);
    expect(desc).toMatch(/document_incident.*do NOT use for.*brief_team/is);
    expect(desc).toMatch(/brief_team.*only when/is);
  });

  it('warehouse default keeps no intent description while forklift keeps its own guide', async () => {
    const app = createApp(baseConfig);
    const warehouse = await request(app).get('/api/voice/agent-config?scenarioId=warehouse-chemical-spill');
    expect(warehouse.body.data.submitActionTool.parameters.properties.intent).not.toHaveProperty('description');
    const forklift = await request(app).get('/api/voice/agent-config?scenarioId=forklift-incident');
    const forkDesc = forklift.body.data.submitActionTool.parameters.properties.intent.description as string;
    expect(forkDesc).toContain('secure_scene');
    expect(forkDesc).not.toContain('hit_estop');
    const equipment = await request(app).get('/api/voice/agent-config?scenarioId=equipment-malfunction');
    const equipDesc = equipment.body.data.submitActionTool.parameters.properties.intent.description as string;
    expect(equipDesc).not.toContain('secure_scene');
  });
});

describe('equipment agent prompt: Task 9 skeleton with equipment content', () => {
  it('instructs fragment no-fire plus immediate fire', () => {
    const prompt = buildSessionUpdate(['hit_estop'], {
      id: 'equipment-malfunction',
      title: 'Equipment Malfunction',
    }).session.system_prompt as string;
    expect(prompt).toMatch(/fragment/i);
    expect(prompt).toMatch(/make no tool call at all for a fragment/i);
    expect(prompt).toMatch(/never hold a completed action/i);
  });

  it('fires optional intents only on clear performance and each step once', () => {
    const prompt = buildSessionUpdate(['hit_estop'], {
      id: 'equipment-malfunction',
      title: 'Equipment Malfunction',
    }).session.system_prompt as string;
    expect(prompt).toContain('brief_team');
    expect(prompt).toContain('notify_maintenance');
    expect(prompt).toContain('check_certifications');
    expect(prompt).toMatch(/only when the trainee .* performing that step/i);
    expect(prompt).toMatch(/do not fire on mention/i);
    expect(prompt).toMatch(/each .* step once/i);
    expect(prompt).toMatch(/already done/i);
  });

  it('disambiguates estop-vs-isolate and check-vs-clear and file-vs-brief', () => {
    const prompt = buildSessionUpdate(['hit_estop'], {
      id: 'equipment-malfunction',
      title: 'Equipment Malfunction',
    }).session.system_prompt as string;
    expect(prompt).toMatch(/hit_estop.*emergency stop/i);
    expect(prompt).toMatch(/lock it out.*means isolate_power/i);
    expect(prompt).toMatch(/verify_technician.*not clearing/i);
    expect(prompt).toMatch(/document_incident.*not a verbal briefing/i);
    expect(prompt).toMatch(/enter_cell.*unsafe/i);
  });

  it('keeps the forklift prompt free of equipment intents', () => {
    const forklift = buildSessionUpdate(['secure_scene'], {
      id: 'forklift-incident',
      title: 'Forklift Incident',
    }).session.system_prompt as string;
    expect(forklift).not.toContain('hit_estop');
    expect(forklift).not.toContain('brief_team');
    const tool = submitActionTool(['hit_estop'], 'equipment-malfunction');
    expect(tool.parameters.properties.intent.enum).toEqual(['hit_estop']);
  });
});
