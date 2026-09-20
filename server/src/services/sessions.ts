import type { ScenarioDefinition, ScenarioState } from '../scenario/types.js';
import { createInitialState } from '../scenario/engine.js';

export interface Session {
  id: string;
  scenarioId: string;
  state: ScenarioState;
  createdAt: string;
}

function newId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export class SessionStore {
  private sessions = new Map<string, Session>();

  create(def: ScenarioDefinition): Session {
    const session: Session = {
      id: newId(),
      scenarioId: def.metadata.id,
      state: createInitialState(def),
      createdAt: new Date().toISOString(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  update(session: Session): void {
    this.sessions.set(session.id, session);
  }

  clear(): void {
    this.sessions.clear();
  }
}
