/**
 * Sovereign Security — Cross-Platform Test Runner
 *
 * Reliably discovers and executes all test suites across Windows, Linux, and macOS.
 */

// Configure safe test environment secrets for test execution
process.env.NODE_ENV = 'test';
process.env.SOVEREIGN_ADMIN_API_KEY = process.env.SOVEREIGN_ADMIN_API_KEY || 'test-admin-sec-key-12345';
process.env.SOVEREIGN_OPERATOR_API_KEY = process.env.SOVEREIGN_OPERATOR_API_KEY || 'test-op-sec-key-67890';
process.env.SOVEREIGN_AUDIT_API_KEY = process.env.SOVEREIGN_AUDIT_API_KEY || 'test-audit-sec-key-11223';
process.env.SOC_DASHBOARD_USER = process.env.SOC_DASHBOARD_USER || 'admin';
process.env.SOC_DASHBOARD_PASSWORD = process.env.SOC_DASHBOARD_PASSWORD || 'test-dashboard-pass-9988';
process.env.SOVEREIGN_OS_SECRET_KEY = process.env.SOVEREIGN_OS_SECRET_KEY || 'sec_key_sovereign_os_prod_secret';
process.env.MTF_TELEMETRY_SECRET_KEY = process.env.MTF_TELEMETRY_SECRET_KEY || 'sec_key_mtf_telemetry_prod_secret';
process.env.COMPLIANCE_LABS_SECRET_KEY = process.env.COMPLIANCE_LABS_SECRET_KEY || 'sec_key_compliance_labs_audit_secret';
process.env.AUDIOBLUE_BUILD_SECRET_KEY = process.env.AUDIOBLUE_BUILD_SECRET_KEY || 'sec_key_audioblue_build_secret';
process.env.GRIDD_CORP_SECRET_KEY = process.env.GRIDD_CORP_SECRET_KEY || 'sec_key_gridd_corp_governance_secret';

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { run } from 'node:test';
import { spec } from 'node:test/reporters';

const testDir = 'tests';
const files = readdirSync(testDir)
  .filter((f) => f.endsWith('.test.ts'))
  .sort()
  .map((f) => join(testDir, f));

run({ files })
  .compose(spec)
  .pipe(process.stdout);
