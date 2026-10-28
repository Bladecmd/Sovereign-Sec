/**
 * Sovereign Security — Milestone Phase 2A & Hardened Streaming Ledger
 * Persistent Append-Only Cryptographic Audit Ledger
 *
 * Implements:
 * - O(1) Bounded Memory Startup (Chunked line-by-line streaming without full-file heap loading)
 * - Continuous SHA-256 Cryptographic Hash-Chain Verification
 * - Fail-Closed Tamper & Corruption Detection
 * - Automated Disaster Recovery Backup & Snapshot Export
 */

import {
  appendFileSync,
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { AuditRecord, AuditVerificationResult, CreateAuditRecordInput } from '../types/audit.js';
import { AuditService } from './audit-service.js';
import { globalMetrics } from '../observability/metrics.js';

export interface PersistentLedgerOptions {
  maxMemoryRecords?: number;
}

export class PersistentAuditLedger {
  private filePath: string;
  private memoryService: AuditService;
  private isInitialized: boolean = false;
  private totalRecords: number = 0;
  private lastHash: string = '0'.repeat(64);
  private recordsWindow: AuditRecord[] = [];
  private readonly maxMemoryRecords: number;
  private readonly genesisHash: string = '0'.repeat(64);

  constructor(filePath: string, options: PersistentLedgerOptions = {}) {
    this.filePath = filePath;
    this.maxMemoryRecords = options.maxMemoryRecords || 500;
    this.memoryService = new AuditService();
  }

  /**
   * Initializes the ledger using bounded streaming chunk reads to prevent heap exhaustion.
   * Verifies the cryptographic hash chain sequentially across all historical lines.
   */
  public initialize(): AuditVerificationResult {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (!existsSync(this.filePath)) {
      this.isInitialized = true;
      this.totalRecords = 0;
      this.lastHash = this.genesisHash;
      globalMetrics.setGauge('sovereign_audit_ledger_integrity_status', 1);
      globalMetrics.setGauge('sovereign_audit_ledger_records', 0);
      return { isValid: true, totalRecords: 0 };
    }

    const verification = this.scanAndVerifyLedgerFile();

    globalMetrics.setGauge('sovereign_audit_ledger_integrity_status', verification.isValid ? 1 : 0);
    globalMetrics.setGauge('sovereign_audit_ledger_records', verification.totalRecords);

    if (!verification.isValid) {
      this.isInitialized = false;
      return verification;
    }

    this.isInitialized = true;
    return verification;
  }

  /**
   * Chunked, bounded streaming verification of the ledger file.
   * Reads 64KB blocks sequentially, parses each line in isolation, and discards
   * historical records beyond maxMemoryRecords to maintain strict O(1) memory bounds.
   */
  private scanAndVerifyLedgerFile(): AuditVerificationResult {
    const CHUNK_SIZE = 64 * 1024;
    const buffer = Buffer.alloc(CHUNK_SIZE);
    let fd: number;

    try {
      fd = openSync(this.filePath, 'r');
    } catch (err) {
      return {
        isValid: false,
        totalRecords: 0,
        error: `Failed to open audit ledger: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    let leftover = '';
    let expectedSequence = 1;
    let expectedPreviousHash = this.genesisHash;
    const boundedRecords: AuditRecord[] = [];
    let recordIndex = 0;

    try {
      let bytesRead = 0;
      while ((bytesRead = readSync(fd, buffer, 0, CHUNK_SIZE, null)) > 0) {
        const chunkStr = leftover + buffer.toString('utf-8', 0, bytesRead);
        const lines = chunkStr.split('\n');
        // The last element is incomplete unless chunk ended with \n
        leftover = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          const parseResult = this.verifySingleLine(trimmed, expectedSequence, expectedPreviousHash, recordIndex);
          if (!parseResult.valid) {
            return {
              isValid: false,
              totalRecords: recordIndex,
              tamperedIndex: recordIndex,
              tamperedRecordId: parseResult.recordId,
              error: parseResult.error,
            };
          }

          expectedPreviousHash = parseResult.record!.currentHash;
          expectedSequence++;
          recordIndex++;

          // Maintain strictly bounded recent memory window
          boundedRecords.push(parseResult.record!);
          if (boundedRecords.length > this.maxMemoryRecords) {
            boundedRecords.shift();
          }
        }
      }

      // Process any trailing leftover line
      if (leftover.trim()) {
        const parseResult = this.verifySingleLine(leftover.trim(), expectedSequence, expectedPreviousHash, recordIndex);
        if (!parseResult.valid) {
          return {
            isValid: false,
            totalRecords: recordIndex,
            tamperedIndex: recordIndex,
            tamperedRecordId: parseResult.recordId,
            error: parseResult.error,
          };
        }
        expectedPreviousHash = parseResult.record!.currentHash;
        recordIndex++;
        boundedRecords.push(parseResult.record!);
        if (boundedRecords.length > this.maxMemoryRecords) {
          boundedRecords.shift();
        }
      }
    } finally {
      closeSync(fd);
    }

    this.totalRecords = recordIndex;
    this.lastHash = expectedPreviousHash;
    this.recordsWindow = boundedRecords;
    this.memoryService = new AuditService(boundedRecords);

    return {
      isValid: true,
      totalRecords: this.totalRecords,
    };
  }

  /**
   * Verifies an individual JSON line against cryptographic expectations
   */
  private verifySingleLine(
    line: string,
    expectedSeq: number,
    expectedPrevHash: string,
    idx: number
  ): { valid: boolean; record?: AuditRecord; recordId?: string; error?: string } {
    let record: AuditRecord;
    try {
      record = JSON.parse(line) as AuditRecord;
    } catch (err) {
      return {
        valid: false,
        error: `Corrupt JSON line at index ${idx}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    if (record.sequence !== expectedSeq) {
      return {
        valid: false,
        recordId: record.auditId,
        error: `Sequence mismatch at index ${idx}. Expected ${expectedSeq}, found ${record.sequence}.`,
      };
    }

    if (record.previousHash !== expectedPrevHash) {
      return {
        valid: false,
        recordId: record.auditId,
        error: `Data tamper detected: hash-chain broken at record ${record.auditId} (index ${idx}). Expected previousHash ${expectedPrevHash}, found ${record.previousHash}.`,
      };
    }

    // Recompute cryptographic SHA-256 hash
    const payloadToHash = `${record.sequence}:${record.auditId}:${record.who}:${record.what}:${record.when}:${record.where}:${record.why}:${record.result}:${JSON.stringify(record.details || {})}:${record.previousHash}`;
    const computedHash = createHash('sha256').update(payloadToHash).digest('hex');

    if (record.currentHash !== computedHash) {
      return {
        valid: false,
        recordId: record.auditId,
        error: `Data tamper detected: checksum mismatch / tampered hash at record ${record.auditId} (index ${idx}). Computed ${computedHash}, stored ${record.currentHash}.`,
      };
    }

    return { valid: true, record };
  }

  /**
   * Appends an audit record to the persistent log and bounded memory window
   */
  public append(input: CreateAuditRecordInput): AuditRecord {
    if (!this.isInitialized) {
      const initResult = this.initialize();
      if (!initResult.isValid) {
        throw new Error(`Cannot append to compromised audit ledger: ${initResult.error}`);
      }
    }

    const sequence = this.totalRecords + 1;
    const auditId = input.auditId || `audit-${Date.now()}-${sequence}`;
    const when = input.when || new Date().toISOString();
    const previousHash = this.lastHash;

    const payloadToHash = `${sequence}:${auditId}:${input.who}:${input.what}:${when}:${input.where}:${input.why}:${input.result}:${JSON.stringify(input.details || {})}:${previousHash}`;
    const currentHash = createHash('sha256').update(payloadToHash).digest('hex');

    const record: AuditRecord = {
      sequence,
      auditId,
      who: input.who,
      what: input.what,
      when,
      where: input.where,
      why: input.why,
      result: input.result,
      details: input.details,
      previousHash,
      currentHash,
    };

    const serializedLine = JSON.stringify(record) + '\n';
    appendFileSync(this.filePath, serializedLine, { encoding: 'utf-8' });

    this.totalRecords = sequence;
    this.lastHash = currentHash;

    // Update bounded in-memory sliding window
    this.recordsWindow.push(record);
    if (this.recordsWindow.length > this.maxMemoryRecords) {
      this.recordsWindow.shift();
    }
    this.memoryService = new AuditService(this.recordsWindow);

    globalMetrics.incrementCounter('sovereign_audit_records_persisted_total');
    globalMetrics.setGauge('sovereign_audit_ledger_records', this.totalRecords);

    return record;
  }

  /**
   * Retrieves audit records from the bounded memory window
   */
  public getRecords(): readonly AuditRecord[] {
    return this.recordsWindow;
  }

  /**
   * Returns total count of persisted records across historical lifetime
   */
  public getTotalRecordsCount(): number {
    return this.totalRecords;
  }

  /**
   * Re-verifies cryptographic integrity
   */
  public verifyIntegrity(): AuditVerificationResult {
    return this.scanAndVerifyLedgerFile();
  }

  public getAuditService(): AuditService {
    return this.memoryService;
  }

  /**
   * Creates a verified, timestamped backup snapshot of the audit ledger
   */
  public createBackupSnapshot(targetDir: string): {
    success: boolean;
    snapshotPath: string;
    metadataPath: string;
    totalRecords: number;
    headHash: string;
    fileSizeBytes: number;
  } {
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `audit-backup-${timestamp}.log`;
    const snapshotPath = `${targetDir}/${filename}`;

    copyFileSync(this.filePath, snapshotPath);
    const stats = statSync(snapshotPath);
    const metadataPath = `${snapshotPath}.meta.json`;

    const meta = {
      snapshotTimestamp: new Date().toISOString(),
      sourceLedger: this.filePath,
      totalRecords: this.totalRecords,
      headHash: this.lastHash,
      fileSizeBytes: stats.size,
    };
    writeFileSync(metadataPath, JSON.stringify(meta, null, 2), 'utf-8');

    return {
      success: true,
      snapshotPath,
      metadataPath,
      totalRecords: this.totalRecords,
      headHash: this.lastHash,
      fileSizeBytes: stats.size,
    };
  }
}
