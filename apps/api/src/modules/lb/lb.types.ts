/** Shapes stored in LoadBalancer.forwardingRules, healthCheck and stickySessions. */
export interface ForwardingRule {
  entryProtocol: 'http' | 'https' | 'tcp';
  entryPort: number;
  targetProtocol: 'http' | 'tcp';
  targetPort: number;
  /** Required when entryProtocol is https: a Certificate id in the same project. */
  certificateId?: string;
}

export interface HealthCheck {
  protocol: 'http' | 'tcp';
  port: number;
  path?: string;
  intervalSeconds: number;
  timeoutSeconds: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
}

export interface StickySessions {
  type: 'cookie';
  cookieName?: string;
  ttlSeconds?: number;
}

export const DEFAULT_HEALTH_CHECK = (rules: ForwardingRule[]): HealthCheck => ({
  protocol: rules[0]?.targetProtocol === 'tcp' ? 'tcp' : 'http',
  port: rules[0]?.targetPort ?? 80,
  path: '/',
  intervalSeconds: 10,
  timeoutSeconds: 5,
  healthyThreshold: 3,
  unhealthyThreshold: 3,
});
