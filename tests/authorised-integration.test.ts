/**
 * Sovereign Security — Authorised Integration & Audit Persistence Verification Test
 *
 * Grounded demonstration of:
 * 1. Valid authorised request accepted (HTTP 201 / HTTP 200).
 * 2. Request with invalid signature rejected (HTTP 401 INVALID_SIGNATURE).
 * 3. Replayed request rejected (HTTP 401 REPLAY_DETECTED).
 * 4. Request with insufficient permission rejected (HTTP 403 AUTHORIZATION_DENIED).
 * 5. Anonymous request rejected (HTTP 401 AUTHENTICATION_REQUIRED).
 * 6. Accepted request produces verifiable audit record in persistent storage.
 * 7. Audit records survive server restart and pass 100% hash-chain verification.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { Server } from 'node:http';
import test, { after, before, describe } from 'node:test';
import { join } from 'node:path';
import { startSovereignSecurityServer } from '../src/server/server.js';
import { PersistentAuditLedger } from '../src/audit/persistent-storage.js';
import { EcosystemAuthenticator } from '../src/integrations/auth/credentials.js';

describe('Authorised Inter-Service Integration & Storage Durability Suite', () => {
  let serverInstance: Server | undefined;
  let serverPort: number;
  let stopServer: (() => Promise<void>) | undefined;
  let baseUrl: string;

  const TEST_DIR = join(process.cwd(), '.scratch', `int-test-${Date.now()}`);
  const AUDIT_FILE = join(TEST_DIR, 'audit.log');
  const BACKUP_DIR = join(TEST_DIR, 'backups');

  const STAGING_OS_SECRET = 'sec_key_sovereign_os_staging_secret_xyz123';
  const STAGING_MTF_SECRET = 'sec_key_mtf_staging_secret_abc789';
  const STAGING_ADMIN_KEY = 'sovereign_admin_staging_key_token456';
  const STAGING_OPERATOR_KEY = 'sovereign_operator_staging_key_token789';
  const STAGING_READONLY_KEY = 'sovereign_readonly_staging_key_token012';

  before(async () => {
    // Configure staging secrets for ecosystem entities
    EcosystemAuthenticator.configureEntitySecret('sovereign-os', STAGING_OS_SECRET);
    EcosystemAuthenticator.configureEntitySecret('metro-task-force', STAGING_MTF_SECRET);

    const started = await startSovereignSecurityServer({
      port: 0,
      auditStoragePath: AUDIT_FILE,
      auth: {
        enforceAuth: true,
        adminApiKeys: [STAGING_ADMIN_KEY],
        operatorApiKeys: [STAGING_OPERATOR_KEY],
        serviceApiKeys: [STAGING_READONLY_KEY],
        dashboardCredentials: {
          username: 'sovereign-operator',
          password: 'test-staging-password',
        },
      },
    });

    serverInstance = started.server;
    const addr = serverInstance.address();
    serverPort = typeof addr === 'object' && addr ? addr.port : 4199;
    stopServer = started.stop;
    baseUrl = `http://127.0.0.1:${serverPort}`;
  });

  after(async () => {
    if (stopServer) {
      try {
        await stopServer();
      } catch {
        // Server might already be stopped in test 7
      }
    }
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  test('1. Valid authorised request is accepted and produces expected outcome', async () => {
    const now = new Date().toISOString();
    const nonce = `nonce-auth-valid-${Date.now()}`;
    const payload = JSON.stringify({
      eventId: `evt-${Date.now()}-1`,
      timestamp: now,
      source: 'sovereign-os',
      businessId: 'sovereign-core-hq',
      environment: 'production',
      severity: 'INFO',
      category: 'APPLICATION',
      eventType: 'DEPLOYMENT_EVENT',
      actorId: 'vega-ops-01',
      resourceId: 'kernel/v1',
      action: 'sync_posture',
      result: 'SUCCESS',
      riskScore: 5,
      correlationId: `corr-${Date.now()}-1`,
    });

    const signature = EcosystemAuthenticator.createSignature(STAGING_OS_SECRET, now, nonce, payload);

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
    assert.ok(data.event && data.event.eventId);
  });

  test('2. Request with an invalid HMAC signature is rejected', async () => {
    const now = new Date().toISOString();
    const nonce = `nonce-invalid-sig-${Date.now()}`;
    const payload = JSON.stringify({
      source: 'sovereign-os',
      businessId: 'sovereign-core-hq',
      action: 'unauthorized_tamper',
    });

    // Sign with bad key
    const badSignature = EcosystemAuthenticator.createSignature('wrong_secret_key', now, nonce, payload);

    const res = await fetch(`${baseUrl}/api/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Id': 'sovereign-os',
        'X-Business-Id': 'sovereign-core-hq',
        'X-Timestamp': now,
        'X-Nonce': nonce,
        'X-Signature': badSignature,
      },
      body: payload,
    });

    assert.equal(res.status, 401);
    const data = (await res.json()) as any;
    assert.equal(data.error, 'INVALID_SIGNATURE');
  });

  test('3. Replayed request with identical nonce is rejected', async () => {
    const now = new Date().toISOString();
    const nonce = `nonce-replay-target-${Date.now()}`;
    const payload = JSON.stringify({
      eventId: `evt-${Date.now()}-mtf`,
      timestamp: now,
      source: 'metro-task-force',
      businessId: 'mtf-hq',
      environment: 'production',
      severity: 'MEDIUM',
      category: 'AUTHENTICATION',
      eventType: 'ADMIN_LOGIN_FAILED',
      actorId: 'operator-7',
      resourceId: 'station/dispatch',
      action: 'login',
      result: 'FAILURE',
      riskScore: 25,
      correlationId: `corr-${Date.now()}-mtf`,
    });

    const signature = EcosystemAuthenticator.createSignature(STAGING_MTF_SECRET, now, nonce, payload);

    const headers = {
      'Content-Type': 'application/json',
      'X-Service-Id': 'metro-task-force',
      'X-Business-Id': 'mtf-hq',
      'X-Timestamp': now,
      'X-Nonce': nonce,
      'X-Signature': signature,
    };

    // First attempt succeeds
    const res1 = await fetch(`${baseUrl}/api/v1/events`, {
      method: 'POST',
      headers,
      body: payload,
    });
    assert.equal(res1.status, 201);

    // Replay attempt with same nonce is rejected
    const res2 = await fetch(`${baseUrl}/api/v1/events`, {
      method: 'POST',
      headers,
      body: payload,
    });
    assert.equal(res2.status, 401);
    const data2 = (await res2.json()) as any;
    assert.equal(data2.error, 'REPLAY_DETECTED');
  });

  test('4. Request with insufficient permission is rejected', async () => {
    // Readonly token attempting administrative action (containment release)
    const res = await fetch(`${baseUrl}/api/v1/soc/containment/release`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${STAGING_READONLY_KEY}`,
      },
      body: JSON.stringify({
        quarantineId: 'quarantine-test-01',
        reason: 'Attempted release by readonly scraper',
        confirmed: true,
      }),
    });

    assert.equal(res.status, 403);
    const data = (await res.json()) as any;
    assert.ok(data.error === 'INSUFFICIENT_PERMISSIONS' || data.error === 'AUTHORIZATION_DENIED');
  });

  test('5. Anonymous request remains rejected', async () => {
    const res = await fetch(`${baseUrl}/api/v1/audit/ledger`);
    assert.equal(res.status, 401);
    const data = (await res.json()) as any;
    assert.equal(data.error, 'AUTHENTICATION_REQUIRED');
  });

  test('6. Accepted request produces expected audit record in persistent storage', async () => {
    // Check that audit file exists on disk
    assert.ok(existsSync(AUDIT_FILE), 'Audit file must exist on disk');

    const fileContent = readFileSync(AUDIT_FILE, 'utf-8');
    const lines = fileContent.trim().split('\n').filter(Boolean);
    assert.ok(lines.length >= 2, `Expected at least 2 audit lines, found ${lines.length}`);

    // Parse each line and verify cryptographic continuity
    let prevHash = '0'.repeat(64);
    for (let i = 0; i < lines.length; i++) {
      const record = JSON.parse(lines[i]);
      assert.equal(record.sequence, i + 1);
      assert.equal(record.previousHash, prevHash);
      assert.ok(record.currentHash.length === 64);
      prevHash = record.currentHash;
    }
  });

  test('7. Audit records survive server restart and pass 100% verification', async () => {
    // Stop server
    if (stopServer) {
      await stopServer();
      stopServer = undefined;
    }

    // Create a new instance of PersistentAuditLedger pointing to same file
    const recoveredLedger = new PersistentAuditLedger(AUDIT_FILE, { maxMemoryRecords: 100 });
    const verification = recoveredLedger.initialize();

    assert.equal(verification.isValid, true, 'Recovered ledger must be cryptographically valid');
    assert.ok(verification.totalRecords >= 2, 'All historical records must be restored');

    // Create verifiable backup snapshot
    const snapshot = recoveredLedger.createBackupSnapshot(BACKUP_DIR);
    assert.equal(snapshot.success, true);
    assert.ok(existsSync(snapshot.snapshotPath));
    assert.ok(existsSync(snapshot.metadataPath));

    const meta = JSON.parse(readFileSync(snapshot.metadataPath, 'utf-8'));
    assert.equal(meta.totalRecords, verification.totalRecords);
    assert.equal(meta.headHash, recoveredLedger['lastHash']);
  });
});
