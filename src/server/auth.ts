/**
 * Sovereign Security — Production Ingress Authentication & Authorization Middleware
 *
 * Enforces zero-trust authentication across all HTTP entry points:
 * 1. Bearer Token / API Key Header (Admin, Operator, Read-only Service)
 * 2. HTTP Basic Authentication (SOC V2 Dashboard & Browser Management)
 * 3. Cryptographic Ecosystem HMAC Signatures with Replay Protection
 *
 * Never trusts unauthenticated or client-asserted privilege claims.
 */

import { IncomingMessage } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { Permission, Role } from '../types/identity.js';
import { EcosystemAuthenticator, EcosystemCredentials } from '../integrations/auth/credentials.js';

export interface AuthenticatedSubject {
  id: string;
  name: string;
  role: Role;
  roles: Role[];
  permissions: Permission[];
  authMethod: 'BEARER_TOKEN' | 'API_KEY' | 'BASIC_AUTH' | 'ECOSYSTEM_HMAC';
  metadata?: Record<string, unknown>;
}

export interface AuthResult {
  authenticated: boolean;
  subject?: AuthenticatedSubject;
  statusCode?: number;
  error?: string;
  message?: string;
}

export interface ServerAuthOptions {
  enforceAuth?: boolean;
  protectDashboard?: boolean;
  disableDashboard?: boolean;
  adminApiKeys?: string[];
  operatorApiKeys?: string[];
  serviceApiKeys?: string[];
  dashboardCredentials?: { username: string; password: string };
}

export class IngressAuthenticator {
  private adminApiKeys: Set<string>;
  private operatorApiKeys: Set<string>;
  private serviceApiKeys: Set<string>;
  private dashboardUser: string;
  private dashboardPass: string;
  private enforceAuth: boolean;
  private protectDashboard: boolean;
  private disableDashboard: boolean;

  constructor(options: ServerAuthOptions = {}) {
    this.adminApiKeys = new Set(options.adminApiKeys || []);
    this.operatorApiKeys = new Set(options.operatorApiKeys || []);
    this.serviceApiKeys = new Set(options.serviceApiKeys || []);

    // Load environment-configured keys if present
    const envAdminKey = process.env.SOVEREIGN_ADMIN_API_KEY || process.env.SOVEREIGN_SECURITY_API_KEY;
    if (envAdminKey && envAdminKey.trim()) {
      this.adminApiKeys.add(envAdminKey.trim());
    }

    const envOpKey = process.env.SOVEREIGN_OPERATOR_API_KEY;
    if (envOpKey && envOpKey.trim()) {
      this.operatorApiKeys.add(envOpKey.trim());
    }

    const envAuditKey = process.env.SOVEREIGN_AUDIT_API_KEY;
    if (envAuditKey && envAuditKey.trim()) {
      this.serviceApiKeys.add(envAuditKey.trim());
    }

    this.dashboardUser = options.dashboardCredentials?.username || process.env.SOC_DASHBOARD_USER || 'admin';
    this.dashboardPass = options.dashboardCredentials?.password || process.env.SOC_DASHBOARD_PASSWORD || '';

    // Enforce authentication by default in production or unless explicitly configured
    const isProd = process.env.NODE_ENV === 'production';
    this.enforceAuth = options.enforceAuth !== undefined
      ? options.enforceAuth
      : (isProd || process.env.ENFORCE_INGRESS_AUTH === 'true');

    this.protectDashboard = options.protectDashboard !== undefined
      ? options.protectDashboard
      : (isProd || process.env.PROTECT_DASHBOARD === 'true' || this.enforceAuth);

    this.disableDashboard = options.disableDashboard !== undefined
      ? options.disableDashboard
      : (process.env.DISABLE_DASHBOARD === 'true');
  }

  public isEnforced(): boolean {
    return this.enforceAuth;
  }

  public isDashboardProtected(): boolean {
    return this.protectDashboard;
  }

  public isDashboardDisabled(): boolean {
    return this.disableDashboard;
  }

  public addAdminApiKey(key: string): void {
    if (key && key.trim()) {
      this.adminApiKeys.add(key.trim());
    }
  }

  public addOperatorApiKey(key: string): void {
    if (key && key.trim()) {
      this.operatorApiKeys.add(key.trim());
    }
  }

  public addServiceApiKey(key: string): void {
    if (key && key.trim()) {
      this.serviceApiKeys.add(key.trim());
    }
  }

  /**
   * Authenticate an incoming HTTP request across all supported credential channels
   */
  public async authenticate(req: IncomingMessage, rawBody?: string): Promise<AuthResult> {
    const authHeader = req.headers['authorization'];
    const apiKeyHeader = req.headers['x-api-key'] as string | undefined;

    // 1. Check Bearer Token or X-API-Key header
    let token: string | undefined;
    if (apiKeyHeader) {
      token = apiKeyHeader.trim();
    } else if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.substring(7).trim();
    }

    if (token) {
      // Check Admin API Keys
      for (const adminKey of this.adminApiKeys) {
        if (this.safeStringCompare(token, adminKey)) {
          return {
            authenticated: true,
            subject: {
              id: 'sec-admin',
              name: 'Security Administrator',
              role: 'ADMIN',
              roles: ['ADMIN'],
              permissions: ['READ', 'WRITE', 'EXECUTE', 'ADMINISTER'],
              authMethod: apiKeyHeader ? 'API_KEY' : 'BEARER_TOKEN',
            },
          };
        }
      }

      // Check Operator API Keys
      for (const opKey of this.operatorApiKeys) {
        if (this.safeStringCompare(token, opKey)) {
          return {
            authenticated: true,
            subject: {
              id: 'sec-operator',
              name: 'Security Operator',
              role: 'SERVICE',
              roles: ['SERVICE'],
              permissions: ['READ', 'WRITE', 'EXECUTE'],
              authMethod: apiKeyHeader ? 'API_KEY' : 'BEARER_TOKEN',
              metadata: { operatorRole: 'SECURITY_OPERATOR' },
            },
          };
        }
      }

      // Check Read-Only Service API Keys
      for (const svcKey of this.serviceApiKeys) {
        if (this.safeStringCompare(token, svcKey)) {
          return {
            authenticated: true,
            subject: {
              id: 'read-only-service',
              name: 'Audit/Telemetry Scraper',
              role: 'SERVICE',
              roles: ['SERVICE'],
              permissions: ['READ'],
              authMethod: apiKeyHeader ? 'API_KEY' : 'BEARER_TOKEN',
            },
          };
        }
      }

      return {
        authenticated: false,
        statusCode: 401,
        error: 'INVALID_CREDENTIALS',
        message: 'The provided API key or Bearer token is invalid.',
      };
    }

    // 2. Check HTTP Basic Authentication (primarily for SOC V2 browser dashboard)
    if (authHeader && authHeader.toLowerCase().startsWith('basic ')) {
      const encoded = authHeader.substring(6).trim();
      try {
        const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
        const colonIdx = decoded.indexOf(':');
        if (colonIdx > 0) {
          const user = decoded.substring(0, colonIdx);
          const pass = decoded.substring(colonIdx + 1);

          // If dashboard password is set and matches
          const userMatches = this.safeStringCompare(user, this.dashboardUser);
          const passMatches = this.dashboardPass
            ? this.safeStringCompare(pass, this.dashboardPass)
            : false;

          // Or if password matches any admin API key
          let adminPassMatches = false;
          for (const adminKey of this.adminApiKeys) {
            if (this.safeStringCompare(pass, adminKey)) {
              adminPassMatches = true;
              break;
            }
          }

          if (userMatches && (passMatches || adminPassMatches)) {
            return {
              authenticated: true,
              subject: {
                id: user,
                name: `SOC Operator (${user})`,
                role: 'ADMIN',
                roles: ['ADMIN'],
                permissions: ['READ', 'WRITE', 'EXECUTE', 'ADMINISTER'],
                authMethod: 'BASIC_AUTH',
              },
            };
          }
        }
      } catch {
        // Fall through to 401
      }

      return {
        authenticated: false,
        statusCode: 401,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid Basic authentication credentials.',
      };
    }

    // 3. Check Ecosystem Mutual HMAC Authentication Headers
    const serviceId = req.headers['x-service-id'] as string | undefined;
    const businessId = req.headers['x-business-id'] as string | undefined;
    const timestamp = req.headers['x-timestamp'] as string | undefined;
    const nonce = req.headers['x-nonce'] as string | undefined;
    const signature = req.headers['x-signature'] as string | undefined;

    if (serviceId && businessId && timestamp && nonce) {
      const creds: EcosystemCredentials = {
        serviceId,
        businessId,
        environment: (req.headers['x-environment'] as string) || 'production',
        apiKey: (req.headers['x-api-key'] as string) || '',
        timestamp,
        nonce,
        signature,
      };

      const verification = await EcosystemAuthenticator.verifyCredentialsAsync(creds, rawBody);
      if (!verification.authenticated) {
        return {
          authenticated: false,
          statusCode: 401,
          error: verification.errorCode || 'AUTHENTICATION_FAILED',
          message: verification.errorMessage || 'Ecosystem mutual authentication failed.',
        };
      }

      return {
        authenticated: true,
        subject: {
          id: serviceId,
          name: verification.entityName || serviceId,
          role: 'SERVICE',
          roles: ['SERVICE'],
          permissions: ['READ', 'WRITE', 'EXECUTE'],
          authMethod: 'ECOSYSTEM_HMAC',
          metadata: { businessId, serviceId },
        },
      };
    }

    // 4. No credentials provided
    return {
      authenticated: false,
      statusCode: 401,
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication credentials are required to access this protected endpoint.',
    };
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private safeStringCompare(a: string, b: string): boolean {
    if (!a || !b) return false;
    const bufA = Buffer.from(a, 'utf-8');
    const bufB = Buffer.from(b, 'utf-8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
