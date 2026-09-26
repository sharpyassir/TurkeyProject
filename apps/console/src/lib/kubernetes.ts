export interface KubeNode { id: string; name: string; role: 'control' | 'worker'; index: number; poolId: string | null; status: string; ready: boolean; kubeVersion: string | null; ip: string | null; privateIp: string | null; lastSeenAt: string | null }
export interface KubePool { id: string; name: string; size: { id: string; vcpu: number; memoryMb: number; diskGb: number }; count: number; labels: Record<string, string>; taints: { key: string; value?: string; effect?: string }[]; nodes: KubeNode[] }
export interface KubeCluster {
  id: string; name: string; version: string; status: string; statusMessage: string | null; ha: boolean;
  region: { id: string; name: string }; controlSize: { id: string; vcpu: number; memoryMb: number; diskGb: number };
  endpoint: string | null; host: string | null; podCidr: string; serviceCidr: string; configVersion: number;
  pools: KubePool[]; controlPlane: KubeNode[];
  cloud: { loadBalancers: { service: string; loadBalancerId: string; ip: string | null }[]; volumes: { claim: string; volumeId: string; node: string; sizeGb: number; mounted: boolean }[] };
  workers: number; readyNodes: number; projectId: string; createdAt: string;
}
