# SOVEREIGN SECURITY — COST, ARCHITECTURE & ALWAYS-ON AUDIT

## 1. SCOPE AND EXECUTIVE SUMMARY
This audit evaluates the Sovereign Security infrastructure deployed on Render (srv-dar7hte0tbcc739aofrg) to determine whether it can be transitioned to an event-driven model to minimize costs, without compromising the security boundary of the wider system.

**Conclusion:** Sovereign Security **MUST** remain an Always-On Web Service. Attempting to transition it to a Free/Sleep tier or Serverless model would introduce severe authorization latency (cold starts) into the main Sovereign OS application, terminate live dashboard telemetry connections, and clear critical in-memory rate-limiting state. The current Render Starter plan ($7/mo) is minimally sized and highly efficient.

---

## 2. AUDIT OF CURRENT SECURITY ARCHITECTURE
An inspection of `src/server/server.ts` and `src/server/routes.ts` reveals the following:

- **Stateful Memory:** The application maintains several critical stateful structures in memory:
  - `alertsStore` (Map of active alerts)
  - `recentEvents` (Array of the last 500 events)
  - `ApplicationRateLimiter` (Sliding window rate limit state)
- **Active Connections:** It powers the SOC V2 Dashboard via a Server-Sent Events (SSE) stream (`/api/v1/events/stream`).
- **Synchronous Policy Enforcement:** It serves as the primary authorization gateway (`/api/v1/policy/evaluate`) for Sovereign OS.

---

## 3. ALWAYS-ON WORKLOAD CLASSIFICATION
To answer the core question: *Does it require immediate availability?*

- **A. MUST ALWAYS BE ON**
  - **Policy Enforcement (`POST /api/v1/policy/evaluate`)**: Protects live API traffic. A cold start delay of 10-15 seconds would block user operations in Sovereign OS.
  - **Telemetry Streaming (`GET /api/v1/events/stream`)**: Maintains active HTTP connections to frontend dashboards.
  - **Rate Limiting**: The in-memory rate limiter requires constant uptime to track request windows across the platform accurately.

- **D. EVENT-DRIVEN / ON-DEMAND**
  - **Forensics / RCA Generation (`/api/v1/agents/forensics/rca`)**: Compute-intensive but only executed by operators on demand.
  - **Compliance Scans**: Can be scheduled via external cron, but the endpoints themselves are fast.

Because the Policy Engine and Telemetry Stream share the same Node.js process and memory space as the rest of the application, the entire service must remain always-on.

---

## 4. RENDER ANALYSIS & COST OPTIMIZATION
- **Current Plan:** Starter ($7/month) in Frankfurt.
- **Resource Usage:** The Node.js server is exceptionally lean. Memory consumption is ~15MB Heap / ~72MB RSS.
- **Oversized Assessment:** The instance is NOT oversized. However, it only consumes 15% of the 512MB RAM provided by the Starter tier.
- **Why not the Free Tier?** 
  1. The Render Free tier spins down after 15 minutes of inactivity, which would cause an authentication/authorization gap and unacceptable latency for Sovereign OS.
  2. The Free tier does not support persistent disks. Sovereign Security relies on a mounted volume (`/data/audit.log`) for the `PersistentAuditLedger`.

**Recommendation:** Retain the Render Starter plan. It is the absolute minimum cost to guarantee a persistent disk and zero-cold-start policy evaluation.

---

## 5. PERSISTENCE & STATE SURVIVABILITY
If the service were to restart or go offline:
- **SURVIVES:** Cryptographic audit records (stored safely on the `/data` volume via `PersistentAuditLedger`).
- **LOST:** In-memory rate limiting windows, the cache of `recentEvents`, and active `alertsStore` alerts. 

*Note: In the future, syncing `alertsStore` to a managed database (like Firestore or PostgreSQL) would allow horizontal scaling, but is not currently required for a single-instance deployment.*

---

## 6. SECURITY TEST RESULTS
Live testing against `https://sovereign-security.onrender.com` yielded the following baseline:

1. **Unauthorized request (Containment Release):** PASS (Returned 401 Authentication Required)
2. **Invalid/Valid credentials (GUEST role):** PASS (Returned 403 Authorization Denied)
3. **Privilege escalation (Triage endpoint):** PASS (Rejected unauthorized state mutations)
4. **Audit logging (Integrity Verification):** PASS (Ledger reported as VERIFIED)
5. **Restart / Readiness Probe:** PASS (Service is UP and Ready)
6. **Webhook (MTF Ingest):** FAIL (Returned 500 Internal Server Error instead of 201)
7. **Failure handling (Malformed JSON):** FAIL (Returned 500 Internal Server Error instead of 400 Bad Request)

*Security Risk Identified:* The 500 errors on Malformed JSON and Webhook ingestion indicate that `readJsonBody` or the schema validation pipeline lacks a proper error boundary (try/catch), causing the request to crash out ungracefully. While not a direct vulnerability, this could be leveraged for a Denial of Service (DoS) if it crashes the Node process.

---

## 7. CONCLUSION
**Do NOT sleep this service.** 
Taking Sovereign Security offline temporarily creates an immediate authorization gap. The $7/mo cost is the absolute floor for a secure, persistent, and synchronous Zero-Trust security gateway.
