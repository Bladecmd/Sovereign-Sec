# Sovereign Security — Phase 2D Closure & V1.1 Production Resilience Implementation Plan

## 1. Overview & Objectives

This plan formalizes the closure of **Phase 2D** and advances the Sovereign Security platform to **V1.1 — Production Resilience Candidate**. 

### Core Architectural Principle
> *Do not optimize the appearance of security. Optimize evidence, resilience, traceability, and honest security boundaries.*

---

## 2. Work Breakdown & Implementation Components

### Phase 1: Pre-Flight Audit & Baseline Formalization
1. **Audit Document (`docs/PHASE_2D_CLOSURE_AUDIT.md`)**:
   - Perform comprehensive pre-change audit of:
     - `src/adversarial/` (1,130-fixture generator, harness, reports)
     - `src/ai/` (gateway, prompt injection, tool permissions, sandbox)
     - `src/policy/` (engine, decision pipeline, provenance)
     - `src/integrations/auth/` (credentials, in-memory nonces)
     - `src/audit/` (persistent ledger, memory service, hash verification)
     - `src/agents/` (containment, sentinel, forensics)
     - `src/server/` (routes, server, payload limit)
     - Docker & deployment configuration
   - Detail what is genuinely production-ready, what is local-only, what is single-instance only, what remains unresolved, and exact delta for V1.1.
2. **Formal Closure of Phase 2D**:
   - Update terminology in baseline reports (`reports/adversarial-validation-report.md`):
     - Replace generic "Detection Rate: 100%" with **"Controlled Fixture Detection Coverage: 100%"**.
     - Replace "Prevention Rate: 100%" with **"Controlled Fixture Prevention Coverage: 100%"**.
     - Replace "Containment Rate: 100%" with **"Controlled Fixture Containment Coverage: 100%"**.
   - Prominently add the mandatory disclaimer:
     > *These results represent performance against the evaluated controlled fixture corpus and do not constitute proof of universal real-world attack detection or prevention.*

### Phase 2: Independent Held-Out Adversarial Validation (>= 300 Fixtures)
1. **Independent Validation Corpus (`src/adversarial/independent/`)**:
   - Create `src/adversarial/independent/types.ts` defining `IndependentAdversarialFixture`:
     ```typescript
     export interface IndependentAdversarialFixture {
       testId: string;
       category: string;
       input: unknown;
       expectedDecision: 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL' | 'ESCALATE';
       expectedDetection?: boolean;
       expectedContainment?: boolean;
       rationale: string;
     }
     ```
   - Author **300+ independent adversarial fixtures** across materially distinct attack strategies completely separate from `AdversarialFixtureGenerator`:
     - Semantic prompt manipulation without trigger keywords
     - Indirect instruction injection via quoted materials & external data
     - Multi-turn contextual manipulation & gradual trust grooming
     - Authority impersonation using executive & architectural phrasing
     - Tool escalation through natural language reasoning
     - Malicious argument obfuscation (URL encodings, unicode tricks)
     - Policy boundary ambiguity (near-threshold risk scores)
     - Malformed authentication edge cases & clock skew variations
     - Asynchronous replay races
     - Telemetry event structure tampering
     - State-conflict containment attempts
     - Benign near-boundary requests
2. **Independent Test Runner & Generalization Metrics**:
   - Create `src/adversarial/independent/runner.ts` executing the held-out corpus against the unmodified runtime.
   - Failures are recorded as **genuine validation findings**, NOT automatically suppressed.
   - Produce separate reporting for the 1,130-fixture regression corpus and the 300+ independent corpus (no combined misleading headline metrics).

### Phase 3: Multi-Hop Semantic Attack Validation
1. **Semantic Defense Pipeline**:
   - Establish and validate the defensive layered decision architecture:
     $$\text{Conversation/Input} \longrightarrow \text{Pattern Rules} \longrightarrow \text{Context Analysis} \longrightarrow \text{Policy Evaluation} \longrightarrow \text{Risk Assessment} \longrightarrow \text{Tool Permission Check} \longrightarrow \text{Security Decision}$$
   - Guarantee that AI/model layers are never the sole authority; deterministic policy remains authoritative.
2. **Test Suite (`tests/semantic-context-validation.test.ts`)**:
   - Test gradual authority manipulation, context poisoning, benign setup followed by unsafe action, multi-turn tool escalation, and delayed system prompt extraction.

### Phase 4: Distributed Replay Protection & Fail-Closed Behavior
1. **Replay Store Abstraction (`src/auth/replay-store.ts` or `src/integrations/auth/replay-store.ts`)**:
   ```typescript
   export interface ReplayProtectionStore {
     has(nonce: string): Promise<boolean>;
     record(nonce: string, expiresAt: number): Promise<void>;
     consume(nonce: string, expiresAt: number): Promise<boolean>;
     health(): Promise<boolean>;
   }
   ```
2. **Implementations**:
   - `InMemoryReplayProtectionStore` (development & test, with TTL cleanup).
   - `DistributedReplayProtectionStore` (production adapter, marked `NOT YET PRODUCTION VERIFIED` when standalone).
3. **Fail-Closed Strategy**:
   - If replay store becomes unhealthy or unavailable:
     - High-risk operations default to `DENY` or `REQUIRE_APPROVAL`.
     - Logged to immutable audit trail: `REPLAY_STORE_UNAVAILABLE`.
4. **Cross-Instance Replay Test Suite (`tests/distributed-replay.test.ts`)**:
   - Simulate Instances A, B, and C sharing replay state.
   - Verify instance A accepts nonce X, instance B rejects nonce X.
   - Verify concurrent same-nonce consumption race conditions are resolved atomically.

### Phase 5: Application-Layer Rate Limiting & Edge Documentation
1. **Application-Layer Rate Limiting (`src/server/rate-limiter.ts`)**:
   - Token-bucket / sliding-window in-memory limiter with bounded memory and LRU eviction.
   - Per-IP limits, authenticated service identity limits, and endpoint-specific burst handling.
   - Emits `HTTP 429 Too Many Requests` with `Retry-After` header.
2. **Edge Security Documentation (`docs/EDGE_SECURITY_REQUIREMENTS.md`)**:
   - Formally document the boundary between application-layer request protection and upstream edge/WAF infrastructure (Cloudflare, AWS WAF, reverse proxies).
   - Define expected production edge controls: edge rate limiting, DDoS volumetric mitigation, WAF rule sets, connection limits, and origin shielding.

### Phase 6: Security Decision Provenance Strengthening & Non-Destructive Containment
1. **Decision Provenance Schema (`src/types/provenance.ts`)**:
   - Upgrade `SecurityDecisionProvenance` to support all required fields:
     `decisionId`, `timestamp`, `actorId`, `actorType`, `businessId`, `environment`, `resourceId`, `action`, `tool`, `applicablePolicy`, `riskScore`, `threatSignals`, `evidenceRefs`, `decision`, `approvalStatus`, `approverId`, `reasonCode`, `correlationId`, `executionResult`, `verificationStatus`.
2. **Audit Logging Enhancements**:
   - Ensure all consequential decisions (`DENY`, privileged `ALLOW`, `REQUIRE_APPROVAL`, `ESCALATE`, `CONTAINMENT`, `RELEASE`, `REPLAY_REJECTION`) generate structured audit entries without exposing credentials.
3. **Containment Safety & Lifecycles**:
   - Verify non-destructive quarantine records with explicit statuses: `ACTIVE`, `EXPIRED`, `RELEASED`, `FAILED`.

### Phase 7: Consolidated Reporting, Verification & Benchmarking
1. **Regenerate Validation Reports**:
   - Update `reports/adversarial-validation-report.md` and `reports/adversarial-validation-summary.json` with separate regression, independent, and distributed resilience sections.
2. **Performance Comparison**:
   - Measure $p_{50}$, $p_{95}$, $p_{99}$, and throughput before and after V1.1 hardening to verify zero performance regressions.
3. **Full Regression Execution**:
   - Run `npm test`, `npm run typecheck`, and `npm run build`.

---

## 3. Verification Plan

### Automated Test Suites
1. **Independent Corpus Execution**:
   `npx tsx --test tests/independent-adversarial.test.ts`
2. **Semantic Context Validation**:
   `npx tsx --test tests/semantic-context-validation.test.ts`
3. **Distributed Replay & Outage Fail-Closed Validation**:
   `npx tsx --test tests/distributed-replay.test.ts`
4. **Rate Limiting & Server Protection**:
   `npx tsx --test tests/rate-limiting.test.ts`
5. **Full Regression Suite**:
   `npm test` (all 183+ test suites passing with zero failures)
6. **Typecheck & Production Build**:
   `npm run typecheck`  
   `npm run build`

---

## 4. Deliverables Checklist
- [ ] `docs/PHASE_2D_CLOSURE_AUDIT.md`
- [ ] `docs/EDGE_SECURITY_REQUIREMENTS.md`
- [ ] `src/adversarial/independent/` (>= 300 independent fixtures + runner)
- [ ] `src/integrations/auth/replay-store.ts` (store interface + InMemory + Distributed adapter)
- [ ] `src/server/rate-limiter.ts` (application-layer limiter)
- [ ] `tests/independent-adversarial.test.ts`
- [ ] `tests/semantic-context-validation.test.ts`
- [ ] `tests/distributed-replay.test.ts`
- [ ] Updated `reports/adversarial-validation-report.md` & `reports/adversarial-validation-summary.json`
- [ ] Updated `walkthrough.md`
