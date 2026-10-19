# KAIJU — Proprietary IP, Disclosure Control & Technical Access Layer Plan

## Executive Overview
Kaiju is Blade's primary professional opportunity engine. To protect Blade's intellectual property, operating workflows, and competitive moats while creating high-converting opportunities for recruiters, engineering leads, founders, and investors, we are implementing a **Progressive Disclosure Architecture**:

$$\text{PROVE CAPABILITY WITHOUT REVEALING THE BLUEPRINT}$$

The site will establish three distinct information disclosure tiers:
1. **Level 1 (Public)**: Frictionless credibility. High-level architecture, business problems, technologies, verified outcomes, safe screenshots, public GitHub repos, lessons learned, and CV. *No email wall or gated friction for basic understanding.*
2. **Level 2 (Restricted Technical Brief)**: Detailed sequence flows, in-depth architectural trade-offs, state-machine specs, deep component topologies, and extended engineering notes. Accessed via an elegant, professional **"Request Technical Brief"** experience (with instant token/session unlocking for approved technical briefs and lead generation telemetry).
3. **Level 3 (Confidential / Private)**: Core proprietary prompts, private customer data, unit margin secrets, trade-secret operational formulas, and production credentials. Clearly labeled as **"CONFIDENTIAL / NDA ONLY"** — demonstrating professional maturity and IP discipline.

---

## User Review Required

> [!IMPORTANT]
> **No Blanket Email Wall for Public Visitors**:
> Public visitors (recruiters, founders arriving from ads, engineering managers) will **never** be blocked from understanding what Blade built, the tech stack, the business outcome, or Blade's CV.
> The access gate applies **strictly to Level 2 deep technical briefs** (e.g. sequence diagrams, advanced state machine configs, and deep architectural trade-off specs).

> [!NOTE]
> **Session & Instant Unlock Mechanism**:
> When a visitor submits a technical brief request (providing their name, work email, organization, and intended purpose):
> - An audit event is logged to `kaiju_technical_brief_requests` and privacy-first analytics with source campaign attribution.
> - A temporary authenticated session token (`kaiju_brief_access_token`) is granted with configurable expiration (e.g., 24 hours).
> - The visitor immediately unlocks the interactive **Restricted Technical Brief Viewer** for that case study, while Level 3 proprietary notes remain strictly marked under **NDA / Direct Discussion**.

---

## Proposed Changes

### 1. Data Models & Type Extensions (`src/types.ts`)
- Add disclosure classification types:
  ```typescript
  export type DisclosureLevel = 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';

  export interface TechnicalBriefData {
    id: string;
    projectSlug: string;
    title: string;
    classification: 'RESTRICTED_TECHNICAL_BRIEF';
    executiveSummary: string;
    deepArchitectureTopology: string;
    componentSpecs: { name: string; responsibility: string; tech: string; considerations: string }[];
    sequenceDiagram: string;
    engineeringTradeOffs: { choice: string; why: string; rejectedAlternatives: string[]; riskMitigation: string }[];
    securityModelDetails: { area: string; implementation: string; complianceImpact: string }[];
    lessonsAndGotchas: string[];
    confidentialityNotice: string;
  }

  export interface BriefAccessRequest {
    id: string;
    projectSlug: string;
    fullName: string;
    workEmail: string;
    organization: string;
    roleOrPurpose: string;
    ndaAcknowledged: boolean;
    timestamp: string;
    status: 'AUTO_APPROVED' | 'PENDING_REVIEW' | 'DIRECT_DISCUSSION_ONLY';
    accessToken?: string;
  }
  ```
- Add analytics events for `TECHNICAL_BRIEF_REQUEST` and `TECHNICAL_BRIEF_VIEW`.

---

### 2. Technical Brief Data Repository (`src/data/technicalBriefsData.ts`)
Create comprehensive Level 2 technical briefs for flagship systems:
- **Metro Task Force**: Sub-second Redis Lua atomic lock topology, geospatial Geohash routing cache specs, PostGIS dispatch ledger state machine, and dynamic surge pricing math.
- **NOVA Executive Intelligence**: Attention scoring vector weights, multi-gateway model fallbacks, cognitive memory partition isolation specs, and Degraded-Mode heuristics.
- **Compliance Labs**: Multi-repo AST traversal engines, deterministic rule verification trees, and git hook validation gates.
- **Audio Blue**: WebRTC jitter buffer tuning, ring buffer C++ WASM bindings, and real-time DSP stream scheduling.
- **Sovereign OS / Sovereign Security**: Zero-trust isolate execution environments, Merkle tree audit logging, and prompt-injection guardrail topologies.

*All Level 3 elements (raw production secrets, proprietary system prompts, private financial data) will be explicitly excluded and marked with a standard NDA Disclosure Notice.*

---

### 3. Progressive Disclosure UI Components
- **[NEW] `src/components/TechnicalBriefModal.tsx`**:
  - Modal that pops up when a user clicks **"Request Technical Brief"** or **"Want the deeper technical breakdown?"**.
  - Collects Name, Work Email, Organization, and Intended Purpose (Recruiter Evaluation, Architecture Review, Commercial Due Diligence, Collaboration).
  - Clear data privacy statement (we never sell data or send unsolicited spam).
  - Handles immediate session unlock for Level 2 briefs with audit trail logging.
- **[NEW] `src/components/TechnicalBriefViewer.tsx`**:
  - High-density, professional technical brief viewer displaying the deeper architecture, sequence diagrams, component specs, and trade-off matrices.
  - Prominent banner: `RESTRICTED ENGINEERING RECORD // LICENSED FOR PROFESSIONAL EVALUATION ONLY`.
  - Includes a designated **Confidentiality / NDA Perimeter Section**: explains why certain deep IP/prompts are withheld and invites direct NDA discussion.
- **Updated `src/components/screens/CaseStudiesScreen.tsx` & `src/components/screens/ArchitectureScreen.tsx`**:
  - Add disclosure level badges to sections (`PUBLIC`, `RESTRICTED_BRIEF`, `NDA_CONFIDENTIAL`).
  - Embed clear CTAs: *"Want the deeper technical breakdown? Request the Technical Brief."*
  - Integrate seamless unlock trigger that preserves the reading context.

---

### 4. Paid Ad Landing Page Integration (`src/components/screens/CampaignLandingScreen.tsx`)
- Ensure the primary flow remains frictionless: `Proposition → Capabilities → Proof → Direct Contact / CV`.
- Position the **Technical Brief Request** as a high-value secondary conversion hook:
  *"Evaluating for an architectural or senior technical role? Request the confidential technical brief."*

---

### 5. Access Management & Lead Telemetry Service (`src/services/accessControl.ts`)
- Implement `AccessControlService`:
  - Validates active brief session tokens in `localStorage`.
  - Manages brief request submission, rate-limiting, and session token generation.
  - Logs lead attribution data (including campaign `utm_source`, `utm_medium`, and landing page).
  - Exports lead telemetry for review in the Admin / Analytics screen.

---

## Verification Plan

### Automated Verification
- `npx tsc --noEmit`: Ensure zero TypeScript errors across new components, interfaces, and state props.
- `npm run build`: Verify Vite production bundle compiles cleanly.

### Manual / Architectural Verification
1. **Recruiter Persona Test**: Verify a recruiter can read the full public case study, review technologies, see the verified outcomes, check GitHub, and view the CV without any email prompt.
2. **Technical Lead Persona Test**: Verify clicking *"Request Technical Brief"* brings up the professional request modal, records the request with UTM parameters, grants access to the deeper brief viewer, and renders sequence diagrams and architectural trade-offs.
3. **Disclosure / IP Boundary Test**: Verify that Level 3 proprietary materials (private tokens, proprietary model prompts, private unit financial margins) are absent from client bundle source, and explicitly cited under the NDA banner.
4. **Campaign Landing Test**: Test `/for/recruiter` and `/for/solutions` with technical brief conversion actions.
