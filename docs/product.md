# Voxtra — Product (VoxDrill)

## Concept

A real-time voice simulation trainer where the user's spoken decisions change a simulated situation.

## Core loop

USER SPEAKS → AssemblyAI voice agent → interpret intent → deterministic scenario engine →
state change → consequence → next turn → evidence log → deterministic score → after-action report.

## First scenario: Warehouse Chemical Spill

The trainee faces an unidentified spill. Safe sequencing (isolate → notify → identify →
document → clean) resolves the drill. Unsafe shortcuts (approach/clean early, leave without
reporting) produce explicit consequences, penalties, and recovery steps. The after-action
report renders the score as 58/58 for the clean five-turn path, with every point traceable
to a logged turn.

## Second scenario: Forklift Incident (M4, 2026-09-22)

A pedestrian has been struck by a forklift; the operator is shaken and the victim
is on the ground. As shift supervisor the trainee must secure the scene
(lockout/tagout), summon medics without moving the victim, escalate internally,
preserve the scene (photograph, do not disturb), then file the formal report.
Safe sequencing (secure → call → notify → preserve → document) resolves the
drill at 57/57. Unsafe shortcuts (move_victim −12 spinal risk, restart_forklift
−10, clear_aisle −8, handle_alone −6) are self-loop penalties with no state
change plus a recovery hint; reassess/correct_course (+2/+3) record
self-correction. Optional safe extras (brief_operator up to +4,
check_witnesses up to +3, confirm_certification up to +2) lift the theoretical
ceiling to 113. The same engine, evidence shape, and report pipeline render both
scenarios with no information-architecture change.

## Third scenario: Equipment Malfunction (M4 complete, 2026-09-23)

A pick-and-place robotic arm in a warehouse work cell has unexpectedly
re-energized while a technician was inside the cell. The technician is
unharmed and standing just outside the arm's reach envelope; the e-stop has
not been pressed. As supervisor the trainee must halt the arm immediately
(hit_estop), de-energize at the disconnect with lockout/tagout
(isolate_power), clear the cell and adjacent zones with all entrants
accounted for (evacuate_area), confirm the technician is uninjured
(verify_technician), then file the formal report (document_incident).
Safe sequencing resolves the drill at 65/65 (15+15+10+10+15, denominator 65).
Unsafe shortcuts (enter_cell −15 cell-entry hazard, reset_fault −10,
continue_work −8, ignore_alarm −6) are self-loop penalties with no state
change plus a recovery hint; reassess/correct_course (+2/+3) record
self-correction. Optional safe extras (brief_team up to +4,
notify_maintenance up to +3, check_certifications up to +2) lift the
theoretical ceiling to 121. Zero engine changes were required — the third
proof that the engine contract is fully data-driven. Like Forklift, filing
the report closes the drill (`documented` flag on the `resolved` transition,
no separate documented state).

## Key principle

The LLM interprets natural language into a structured intent enum. Deterministic application
code — and only that code — controls scenario state, transitions, scoring, and completion.
Scores are computed, not hallucinated.

## Target

AssemblyAI Voice Agent Hackathon, deadline September 30 2026. The demo differentiator is
branching reality: the trainee's spoken decisions change a simulated situation, and every
outcome is auditable from the evidence log — trust, not chatbot hand-waving.

## Non-goals (foundation stage)

Scoring UI polish, dashboards, landing pages, pitch assets. See `docs/roadmap.md`.
(The brief's three initial scenarios are now all built; further scenarios are deferred.)
