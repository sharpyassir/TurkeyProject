export interface PlatformApp {
  id: string; name: string; status: string; statusMessage: string | null; url: string; hostname: string; customDomains: string[];
  region: { id: string; name: string }; repoUrl: string; repo: string | null; source: 'github_app' | 'url'; branch: string; port: number;
  size: { id: string; memoryMb: number; cpus: number }; instances: number; healthPath: string | null; env: Record<string, string>;
  hostIp: string | null; lastCommit: string | null; lastDeployAt: string | null;
  deploys: { id: string; status: string; trigger: string; commit: string | null; startedAt: string; finishedAt: string | null }[];
  projectId: string; createdAt: string;
}
export interface AppSize { id: string; memoryMb: number; cpus: number }
export const APP_STATUS_BADGE: Record<string, string> = { live: 'active', building: 'provisioning', creating: 'provisioning', stopped: 'off' };
