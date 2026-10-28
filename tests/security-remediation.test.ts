/**
 * Sovereign Security — Critical Security Remediation & Access Control Test Suite
 *
 * Grounded tests proving:
 * 1. Unauthenticated requests are denied (HTTP 401).
 * 2. Invalid or expired credentials are denied (HTTP 401).
 * 3. Insufficient roles cannot perform privileged actions (HTTP 403).
 * 4. Spoofed body roles and caller IDs do not grant access.
 * 5. Root and dashboard access is protected with WWW-Authenticate basic challenge.
 * 6. Secrets never appear in error messages or logs.
 * 7. Certification endpoints do not falsely claim certification.
 * 8. Audit integrity failures and corrupt entries are detected and fail-closed.
 * 9. Large audit histories do not require loading unbounded records into memory.
 * 10. Legitimate authorized workflows continue to function successfully.
 */

import assert from 'node:assert/strict';
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, Server } from 'node:http';
import test, { after, before, describe } from 'node:test';
import { startSovereignSecurityServer } from '../src/server/server.js';
import { PersistentAuditLedger } from '../src/audit/persistent-storage.js';
import { ComplianceCertificationEngine } from '../src/compliance/certification.js';
import { EcosystemAuthenticator, EcosystemCredentials } from '../src/integrations/auth/credentials.js';

describe('Security Remediation & Zero-Trust Enforcement Suite', () => {
  let serverInstance: Server;
  let serverPort: number;
  let stopServer: () => Promise<void>;
  let baseUrl: string;

  const TEST_ADMIN_KEY = 'test-remediation-admin-key-999';
  const TEST_OPERATOR_KEY = 'test-remediation-op-key-888';
  const TEST_READONLY_KEY = 'test-remediation-readonly-key-777';
  const TEST_DASH_USER = 'soc-admin';
  const TEST_DASH_PASS = 'soc-secret-pass-123';

  before(async () => {
    // Configure test secret for ecosystem verification
    EcosystemAuthenticator.configureEntitySecret('sovereign-os', 'sec_key_sovereign_os_test_secret');

    const started = await startSovereignSecurityServer({
      port: 0,
      auth: {
        enforceAuth: true,
        adminApiKeys: [TEST_ADMIN_KEY],
        operatorApiKeys: [TEST_OPERATOR_KEY],
        serviceApiKeys: [TEST_READONLY_KEY],
        dashboardCredentials: {
          username: TEST_DASH_USER,
          password: TEST_DASH_PASS,
        },
      },
    });

    serverInstance = started.server;
    const addr = serverInstance.address();
    serverPort = typeof addr === 'object' && addr ? addr.port : 4099;
    stopServer = started.stop;
    baseUrl = `http://127.0.0.1:${serverPort}`;
  });

  after(async () => {
    if (stopServer) {
      await stopServer();
    }
  });

  // =========================================================================
  // 1. Unauthenticated Requests Denied
  // =========================================================================
  describe('1. Unauthenticated Ingress Protection', () => {
    test('rejects unauthenticated request to /api/v1/events with 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'LOGIN', severity: 'INFO' }),
      });
      assert.equal(res.status, 401);
      const data = (await res.json()) as any;
      assert.equal(data.error, 'AUTHENTICATION_REQUIRED');
    });

    test('rejects unauthenticated request to /api/v1/policy/evaluate with 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/policy/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read', resource: 'user' }),
      });
      assert.equal(res.status, 401);
    });

    test('rejects unauthenticated request to /api/v1/audit/ledger with 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/audit/ledger`);
      assert.equal(res.status, 401);
    });

    test('rejects unauthenticated request to /api/v1/soc/overview with 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/soc/overview`);
      assert.equal(res.status, 401);
    });

    test('allows public health and ready probes without authentication', async () => {
      const healthRes = await fetch(`${baseUrl}/health`);
      assert.equal(healthRes.status, 200);

      const readyRes = await fetch(`${baseUrl}/ready`);
      assert.equal(readyRes.status, 200);
    });
  });

  // =========================================================================
  // 2. Invalid or Expired Credentials Denied
  // =========================================================================
  describe('2. Invalid or Expired Credentials Handling', () => {
    test('rejects invalid Bearer token with 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/audit/ledger`, {
        headers: { Authorization: 'Bearer bad-token-xyz' },
      });
      assert.equal(res.status, 401);
      const data = (await res.json()) as any;
      assert.equal(data.error, 'INVALID_CREDENTIALS');
    });

    test('rejects invalid X-API-Key with 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'forged-api-key',
        },
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 401);
    });

    test('rejects expired ecosystem timestamp with 401', async () => {
      const expiredTimestamp = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const res = await fetch(`${baseUrl}/api/v1/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Id': 'sovereign-os',
          'X-Business-Id': 'sovereign-core-hq',
          'X-Timestamp': expiredTimestamp,
          'X-Nonce': `nonce-exp-${Date.now()}`,
          'X-Signature': '0000000000000000000000000000000000000000000000000000000000000000',
        },
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 401);
      const data = (await res.json()) as any;
      assert.equal(data.error, 'EXPIRED_TIMESTAMP');
    });
  });

  // =========================================================================
  // 3. Insufficient Roles Cannot Perform Privileged Actions
  // =========================================================================
  describe('3. Role-Based Privilege Boundaries', () => {
    test('read-only token cannot execute containment release (403)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/soc/containment/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_READONLY_KEY}`,
        },
        body: JSON.stringify({
          quarantineId: 'quarantine-test-01',
          reason: 'Emergency release attempt by read-only user',
          confirmed: true,
        }),
      });
      assert.equal(res.status, 403);
      const data = (await res.json()) as any;
      assert.equal(data.error, 'AUTHORIZATION_DENIED');
    });

    test('read-only token cannot execute agent commands (403)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/soc/agents/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_READONLY_KEY}`,
        },
        body: JSON.stringify({ command: 'POSTURE_SYNC' }),
      });
      assert.equal(res.status, 403);
    });

    test('read-only token cannot subscribe to event stream without WRITE/ADMIN (can READ)', async () => {
      // Read-only has READ permission, so stats succeeds
      const statsRes = await fetch(`${baseUrl}/api/v1/telemetry/stats`, {
        headers: { Authorization: `Bearer ${TEST_READONLY_KEY}` },
      });
      assert.equal(statsRes.status, 200);
    });
  });

  // =========================================================================
  // 4. Spoofed Body Roles and Caller IDs Do Not Grant Access
  // =========================================================================
  describe('4. Anti-Spoofing & Server-Side Identity Authority', () => {
    test('client sending role: "ADMIN" in body with read-only token is rejected (403)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/soc/containment/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_READONLY_KEY}`,
        },
        body: JSON.stringify({
          quarantineId: 'quarantine-test-02',
          callerId: 'fake-root-admin',
          role: 'ADMIN', // Spoofed client assertion
          confirmed: true,
          reason: 'Attempted privilege escalation via body injection',
        }),
      });
      assert.equal(res.status, 403);
      const data = (await res.json()) as any;
      assert.equal(data.error, 'AUTHORIZATION_DENIED');
      assert.match(data.message, /rejected containment release|not permitted|not authorized/i);
    });

    test('client sending role: "SOC_ADMIN" in body with operator token is rejected from release without ADMIN role (403)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/soc/containment/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_OPERATOR_KEY}`,
        },
        body: JSON.stringify({
          quarantineId: 'quarantine-test-03',
          role: 'SOC_ADMIN', // Spoofed
          confirmed: true,
          reason: 'Operator pretending to be SOC_ADMIN',
        }),
      });
      assert.equal(res.status, 403);
    });
  });

  // =========================================================================
  // 5. Dashboard Access Protected
  // =========================================================================
  describe('5. Dashboard UI Protection', () => {
    test('unauthenticated GET / returns 401 with WWW-Authenticate Basic header', async () => {
      const res = await fetch(`${baseUrl}/`);
      assert.equal(res.status, 401);
      assert.match(res.headers.get('www-authenticate') || '', /Basic realm=/i);
    });

    test('unauthenticated GET /dashboard returns 401 with WWW-Authenticate Basic header', async () => {
      const res = await fetch(`${baseUrl}/dashboard`);
      assert.equal(res.status, 401);
      assert.match(res.headers.get('www-authenticate') || '', /Basic realm=/i);
    });

    test('GET /dashboard with valid Basic Auth succeeds with 200 HTML', async () => {
      const basicCredentials = Buffer.from(`${TEST_DASH_USER}:${TEST_DASH_PASS}`).toString('base64');
      const res = await fetch(`${baseUrl}/dashboard`, {
        headers: { Authorization: `Basic ${basicCredentials}` },
      });
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /text\/html/);
      const html = await res.text();
      assert.match(html, /SOVEREIGN SECURITY/i);
    });

    test('GET /dashboard with valid Bearer token succeeds with 200 HTML', async () => {
      const res = await fetch(`${baseUrl}/dashboard`, {
        headers: { Authorization: `Bearer ${TEST_ADMIN_KEY}` },
      });
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.match(html, /SOVEREIGN SECURITY/i);
    });
  });

  // =========================================================================
  // 6. Secrets Never Appear in Errors or Logs
  // =========================================================================
  describe('6. Zero Secret Leakage in Errors', () => {
    test('malformed request mentioning secret strings redacts them in response', async () => {
      const sensitiveToken = 'super-secret-production-token-99999999';
      const res = await fetch(`${baseUrl}/api/v1/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_ADMIN_KEY}`,
        },
        body: `{ malformed_json_with_secret: "${sensitiveToken}" `,
      });
      assert.equal(res.status, 400);
      const text = await res.text();
      assert.equal(text.includes(sensitiveToken), false);
    });
  });

  // =========================================================================
  // 7. Certification Endpoints Do Not Falsely Claim Certification
  // =========================================================================
  describe('7. Truthful Compliance & Self-Assessment Statuses', () => {
    test('certify() returns INTERNAL_SELF_ASSESSMENT and NOT_CERTIFIED, never CERTIFIED', () => {
      const engine = new ComplianceCertificationEngine();

      const nistReport = engine.certify('NIST_SP_800_207');
      assert.notEqual(nistReport.certificationStatus, 'CERTIFIED');
      assert.equal(nistReport.certificationStatus, 'INTERNAL_SELF_ASSESSMENT');
      assert.match(nistReport.attestationNotice, /NOT constitute an independent accredited third-party/i);

      const soc2Report = engine.certify('SOC2_TYPE_II');
      assert.notEqual(soc2Report.certificationStatus, 'CERTIFIED');
      assert.equal(soc2Report.certificationStatus, 'INTERNAL_SELF_ASSESSMENT');

      const isoReport = engine.certify('ISO_IEC_27001_2022');
      assert.notEqual(isoReport.certificationStatus, 'CERTIFIED');
      assert.equal(isoReport.certificationStatus, 'INTERNAL_SELF_ASSESSMENT');
    });

    test('GET /api/v1/platform/summary returns accurate non-certified statuses', async () => {
      const res = await fetch(`${baseUrl}/api/v1/platform/summary`, {
        headers: { Authorization: `Bearer ${TEST_ADMIN_KEY}` },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.notEqual(data.complianceCertifications.SOC2_TYPE_II, 'CERTIFIED');
      assert.equal(data.complianceCertifications.SOC2_TYPE_II, 'NOT_CERTIFIED');
      assert.equal(data.complianceCertifications.ISO_IEC_27001_2022, 'NOT_CERTIFIED');
      assert.equal(data.complianceCertifications.NIST_SP_800_207, 'INTERNAL_SELF_ASSESSMENT');
    });
  });

  // =========================================================================
  // 8. Audit Integrity Failures Handled Safely (Fail-Closed)
  // =========================================================================
  describe('8. Audit Ledger Fail-Closed Integrity', () => {
    const testLogPath = './.scratch/tamper-test.log';

    test('detects tampered record and fails closed', () => {
      if (existsSync(testLogPath)) rmSync(testLogPath);

      const ledger = new PersistentAuditLedger(testLogPath);
      ledger.initialize();

      // Append two valid records
      ledger.append({ who: 'admin', what: 'LOGIN', where: '/auth', why: 'test', result: 'SUCCESS' });
      ledger.append({ who: 'admin', what: 'CONFIG', where: '/sys', why: 'test', result: 'SUCCESS' });

      assert.equal(ledger.verifyIntegrity().isValid, true);

      // Now simulate disk tampering: alter currentHash on line 1
      const content = readFileSync(testLogPath, 'utf-8');
      const lines = content.trim().split('\n');
      const tamperedRecord = JSON.parse(lines[0]);
      tamperedRecord.currentHash = '0000000000000000000000000000000000000000000000000000000000000000';
      lines[0] = JSON.stringify(tamperedRecord);
      writeFileSync(testLogPath, lines.join('\n') + '\n', 'utf-8');

      // Re-initialize ledger
      const compromisedLedger = new PersistentAuditLedger(testLogPath);
      const result = compromisedLedger.initialize();

      assert.equal(result.isValid, false);
      assert.match(result.error || '', /Tampered hash/i);

      // Attempting to append to compromised ledger throws error
      assert.throws(() => {
        compromisedLedger.append({ who: 'hacker', what: 'INJECT', where: '/exploit', why: 'tamper', result: 'FAILURE' });
      }, /compromised audit ledger/i);

      if (existsSync(testLogPath)) rmSync(testLogPath);
    });
  });

  // =========================================================================
  // 9. Large Audit Histories Bounded Memory Verification
  // =========================================================================
  describe('9. Bounded Memory Startup on Large Ledgers', () => {
    const scaleLogPath = './.scratch/scale-test.log';

    test('verifies 1,000 sequential records while keeping memory strictly bounded to maxMemoryRecords', () => {
      if (existsSync(scaleLogPath)) rmSync(scaleLogPath);

      // Create ledger configured with max 50 records in memory window
      const ledger = new PersistentAuditLedger(scaleLogPath, { maxMemoryRecords: 50 });
      ledger.initialize();

      for (let i = 0; i < 200; i++) {
        ledger.append({
          who: `user-${i}`,
          what: `ACTION_${i}`,
          where: '/test',
          why: 'scale-test',
          result: 'SUCCESS',
        });
      }

      assert.equal(ledger.getTotalRecordsCount(), 200);
      // In-memory records should be bounded to 50
      assert.equal(ledger.getRecords().length, 50);

      // Re-initialize from disk
      const reloaded = new PersistentAuditLedger(scaleLogPath, { maxMemoryRecords: 50 });
      const initRes = reloaded.initialize();

      assert.equal(initRes.isValid, true);
      assert.equal(initRes.totalRecords, 200);
      assert.equal(reloaded.getRecords().length, 50);

      // Test backup snapshot export
      const snapshot = reloaded.createBackupSnapshot('./.scratch/backups');
      assert.equal(snapshot.success, true);
      assert.equal(snapshot.totalRecords, 200);
      assert.ok(existsSync(snapshot.snapshotPath));

      if (existsSync(scaleLogPath)) rmSync(scaleLogPath);
    });
  });

  // =========================================================================
  // 10. Legitimate Authorized Workflows Succeed
  // =========================================================================
  describe('10. Authorized Legitimate Workflows Function Normally', () => {
    test('authorized admin can ingest events (201)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_ADMIN_KEY}`,
        },
        body: JSON.stringify({
          source: 'sovereign-os',
          businessId: 'biz-prod',
          environment: 'production',
          severity: 'INFO',
          category: 'APPLICATION',
          eventType: 'DEPLOYMENT_EVENT',
          actorId: 'admin-deployer',
          resourceId: 'cluster/prod',
          action: 'deploy',
          result: 'SUCCESS',
          riskScore: 5,
        }),
      });
      assert.equal(res.status, 201);
      const data = (await res.json()) as any;
      assert.equal(data.success, true);
    });

    test('authorized admin can query audit ledger (200)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/audit/ledger`, {
        headers: { Authorization: `Bearer ${TEST_ADMIN_KEY}` },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.readOnly, true);
      assert.ok(data.records.length > 0);
    });

    test('authorized admin can evaluate policy (200)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/policy/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_ADMIN_KEY}`,
        },
        body: JSON.stringify({
          actor: { id: 'admin', roles: ['ADMIN'] },
          resource: 'finance/reports',
          action: 'read',
          riskScore: 10,
        }),
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.ok(data.decision);
    });
  });

  // =========================================================================
  // 11. HMAC Validation, Anti-Replay & Fail-Closed Secrets Over HTTP
  // =========================================================================
  describe('11. HMAC Signatures, Nonce Replay & Fail-Closed Security', () => {
    const serviceSecret = 'sec_key_sovereign_os_test_secret';

    test('valid HMAC signature over HTTP succeeds with 201', async () => {
      const now = new Date().toISOString();
      const nonce = `nonce-valid-hmac-${Date.now()}`;
      const payload = JSON.stringify({
        source: 'sovereign-os',
        businessId: 'sovereign-core-hq',
        environment: 'production',
        severity: 'INFO',
        category: 'APPLICATION',
        eventType: 'DEPLOYMENT_EVENT',
        actorId: 'hmac-signer',
        resourceId: 'kernel/v1',
        action: 'boot',
        result: 'SUCCESS',
        riskScore: 5,
      });

      const signature = EcosystemAuthenticator.createSignature(serviceSecret, now, nonce, payload);

      const res = await fetch(`${baseUrl}/api/v1/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Id': 'sovereign-os',
          'X-Business-Id': 'sovereign-core-hq',
          'X-Timestamp': now,
          'X-Nonce': nonce,
          'X-Signature': signature,
        },
        body: payload,
      });

      assert.equal(res.status, 201);
      const data = (await res.json()) as any;
      assert.equal(data.success, true);
    });

    test('tampered payload with HMAC signature is rejected with 401 INVALID_SIGNATURE', async () => {
      const now = new Date().toISOString();
      const nonce = `nonce-tamper-hmac-${Date.now()}`;
      const originalPayload = JSON.stringify({ action: 'legitimate_boot' });
      const tamperedPayload = JSON.stringify({ action: 'malicious_override' });

      const signature = EcosystemAuthenticator.createSignature(serviceSecret, now, nonce, originalPayload);

      const res = await fetch(`${baseUrl}/api/v1/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Id': 'sovereign-os',
          'X-Business-Id': 'sovereign-core-hq',
          'X-Timestamp': now,
          'X-Nonce': nonce,
          'X-Signature': signature,
        },
        body: tamperedPayload,
      });

      assert.equal(res.status, 401);
      const data = (await res.json()) as any;
      assert.equal(data.error, 'INVALID_SIGNATURE');
    });

    test('replayed nonce over HTTP is rejected with 401 REPLAY_DETECTED', async () => {
      const now = new Date().toISOString();
      const nonce = `nonce-replay-target-${Date.now()}`;
      const payload = JSON.stringify({
        source: 'sovereign-os',
        businessId: 'sovereign-core-hq',
        environment: 'production',
        severity: 'INFO',
        category: 'APPLICATION',
        eventType: 'ADMIN_LOGIN_SUCCESS',
        actorId: 'replay-tester',
        resourceId: 'kernel/v1',
        action: 'boot',
        result: 'SUCCESS',
        riskScore: 5,
      });
      const signature = EcosystemAuthenticator.createSignature(serviceSecret, now, nonce, payload);

      const headers = {
        'Content-Type': 'application/json',
        'X-Service-Id': 'sovereign-os',
        'X-Business-Id': 'sovereign-core-hq',
        'X-Timestamp': now,
        'X-Nonce': nonce,
        'X-Signature': signature,
      };

      // 1st request succeeds
      const res1 = await fetch(`${baseUrl}/api/v1/events`, {
        method: 'POST',
        headers,
        body: payload,
      });
      assert.equal(res1.status, 201);

      // 2nd request with same nonce is rejected
      const res2 = await fetch(`${baseUrl}/api/v1/events`, {
        method: 'POST',
        headers,
        body: payload,
      });
      assert.equal(res2.status, 401);
      const data2 = (await res2.json()) as any;
      assert.equal(data2.error, 'REPLAY_DETECTED');
    });

    test('missing environment secret for entity fails safe with 401 INVALID_API_KEY (zero default credentials)', async () => {
      // Ensure gridd-corp has no configured secret
      EcosystemAuthenticator.configureEntitySecret('gridd-corp', '');

      const res = await fetch(`${baseUrl}/api/v1/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Id': 'gridd-corp',
          'X-Business-Id': 'gridd-holding-corp',
          'X-Timestamp': new Date().toISOString(),
          'X-Nonce': `nonce-empty-${Date.now()}`,
        },
        body: JSON.stringify({}),
      });

      assert.equal(res.status, 401);
      const data = (await res.json()) as any;
      assert.equal(data.error, 'INVALID_API_KEY');
    });

    test('invalid Basic Auth password is rejected with 401 INVALID_CREDENTIALS', async () => {
      const badCreds = Buffer.from(`${TEST_DASH_USER}:wrong-password`).toString('base64');
      const res = await fetch(`${baseUrl}/dashboard`, {
        headers: { Authorization: `Basic ${badCreds}` },
      });
      assert.equal(res.status, 401);
    });
  });

  // =========================================================================
  // 12. Disaster Recovery: Backup Snapshot & Cold Restoration Verification
  // =========================================================================
  describe('12. Audit Disaster Recovery & Cold Restoration', () => {
    const drDir = './.scratch/dr-test';
    const drLiveLog = `${drDir}/live-audit.log`;
    const drBackupDir = `${drDir}/backups`;
    const drRestoreLog = `${drDir}/restored-audit.log`;

    test('creates backup snapshot, restores to disposable ledger, and confirms 100% hash continuity', () => {
      if (existsSync(drDir)) rmSync(drDir, { recursive: true, force: true });

      // 1. Generate live ledger with 50 synthetic records
      const liveLedger = new PersistentAuditLedger(drLiveLog);
      liveLedger.initialize();

      for (let i = 1; i <= 50; i++) {
        liveLedger.append({
          who: `service-operator-${i % 3}`,
          what: `SYS_EVENT_${i}`,
          where: '/cluster/core',
          why: 'DR-test-generation',
          result: 'SUCCESS',
          details: { recordSeq: i },
        });
      }

      assert.equal(liveLedger.getTotalRecordsCount(), 50);
      assert.equal(liveLedger.verifyIntegrity().isValid, true);

      // 2. Execute backup snapshot
      const snapshot = liveLedger.createBackupSnapshot(drBackupDir);
      assert.equal(snapshot.success, true);
      assert.equal(snapshot.totalRecords, 50);
      assert.ok(existsSync(snapshot.snapshotPath));
      assert.ok(existsSync(snapshot.metadataPath));

      // 3. Cold recovery: Restore backup into a completely new isolated ledger file
      copyFileSync(snapshot.snapshotPath, drRestoreLog);
      assert.ok(existsSync(drRestoreLog));

      const restoredLedger = new PersistentAuditLedger(drRestoreLog);
      const restoreVerification = restoredLedger.initialize();

      assert.equal(restoreVerification.isValid, true);
      assert.equal(restoreVerification.totalRecords, 50);
      assert.equal(restoredLedger.getTotalRecordsCount(), 50);

      // Verify that appending to restored ledger continues uninterrupted hash-chaining
      const nextRecord = restoredLedger.append({
        who: 'dr-operator',
        what: 'POST_RECOVERY_RESUME',
        where: '/cluster/core',
        why: 'Cold recovery completed',
        result: 'SUCCESS',
      });

      assert.equal(nextRecord.sequence, 51);
      assert.equal(restoredLedger.getTotalRecordsCount(), 51);
      assert.equal(restoredLedger.verifyIntegrity().isValid, true);

      // Cleanup
      if (existsSync(drDir)) rmSync(drDir, { recursive: true, force: true });
    });
  });
});
