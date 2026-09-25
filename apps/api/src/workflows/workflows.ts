/**
 * Temporal workflow definitions. This file is bundled into the workflow sandbox: it may
 * only import from `@temporalio/workflow` and pure modules. All I/O lives in activities.
 * See docs/adr/0003-temporal-workflows.md.
 */
import { ApplicationFailure, proxyActivities } from '@temporalio/workflow';
import type { Activities } from './activities';

const act = proxyActivities<Activities>({
  startToCloseTimeout: '5 minutes',
  retry: { initialInterval: '2s', backoffCoefficient: 2, maximumInterval: '1 minute', maximumAttempts: 5, nonRetryableErrorTypes: ['NonRetryable'] },
});

const slow = proxyActivities<Activities>({
  startToCloseTimeout: '15 minutes',
  heartbeatTimeout: '2 minutes',
  retry: { initialInterval: '5s', backoffCoefficient: 2, maximumInterval: '2 minutes', maximumAttempts: 3, nonRetryableErrorTypes: ['NonRetryable'] },
});

export interface CreateServerInput {
  serverId: string;
  actionId: string;
  avoid: string[];
}

/**
 * POST /v1/servers → this. ~30–60 s on real hardware. Any failure after placement
 * compensates (VM deleted, IP + capacity released) and marks the server `failed`;
 * metering starts only once the VM is running, so a broken server is never billed.
 */
export async function createServer(input: CreateServerInput): Promise<void> {
  const { serverId, actionId } = input;
  let placed = false;
  try {
    await act.setStatus(serverId, 'provisioning');
    await act.placeServer(serverId, input.avoid);
    placed = true;
    await act.reserveIp(serverId);
    await act.createVm(serverId);
    await slow.waitForBoot(serverId);
    await act.applyFirewall(serverId);
    await act.startMeter(serverId);
    await act.setStatus(serverId, 'active');
    await act.completeAction(actionId);
    await act.emit('server.active', serverId, {});
  } catch (err) {
    const message = describe(err);
    if (placed) await act.compensateCreate(serverId);
    await act.setStatus(serverId, 'failed', message);
    await act.failAction(actionId, message);
    await act.emit('server.failed', serverId, { error: message });
    throw ApplicationFailure.nonRetryable(`create-server ${serverId} failed: ${message}`);
  }
}

export interface PowerInput {
  serverId: string;
  actionId: string;
  op: 'start' | 'stop' | 'reboot';
  force?: boolean;
}

export async function powerServer(input: PowerInput): Promise<void> {
  const { serverId, actionId, op } = input;
  try {
    await act.powerOp(serverId, op, !!input.force);
    await act.setStatus(serverId, op === 'stop' ? 'off' : 'active');
    await act.completeAction(actionId);
  } catch (err) {
    const message = describe(err);
    // Power ops are non-destructive: fall back to what the hypervisor says.
    await act.syncStatusFromHypervisor(serverId, message);
    await act.failAction(actionId, message);
    throw ApplicationFailure.nonRetryable(message);
  }
}

export interface ResizeInput {
  serverId: string;
  actionId: string;
  sizeId: string;
}

export async function resizeServer(input: ResizeInput): Promise<void> {
  const { serverId, actionId, sizeId } = input;
  try {
    const wasRunning = await act.isRunning(serverId);
    if (wasRunning) await act.powerOp(serverId, 'stop', false);
    await slow.resizeVm(serverId, sizeId);
    if (wasRunning) await act.powerOp(serverId, 'start', false);
    await act.setStatus(serverId, wasRunning ? 'active' : 'off');
    await act.completeAction(actionId);
    await act.emit('server.resized', serverId, { size: sizeId });
  } catch (err) {
    const message = describe(err);
    await act.syncStatusFromHypervisor(serverId, message);
    await act.failAction(actionId, message);
    throw ApplicationFailure.nonRetryable(message);
  }
}

export interface RebuildInput {
  serverId: string;
  actionId: string;
  imageId: string;
}

/** Rebuild = delete VM, create from the new image on the same host, keep IPs and firewalls. */
export async function rebuildServer(input: RebuildInput): Promise<void> {
  const { serverId, actionId, imageId } = input;
  try {
    await act.deleteVm(serverId);
    await act.setImage(serverId, imageId);
    await act.createVm(serverId);
    await slow.waitForBoot(serverId);
    await act.applyFirewall(serverId);
    await act.setStatus(serverId, 'active');
    await act.completeAction(actionId);
    await act.emit('server.rebuilt', serverId, { image: imageId });
  } catch (err) {
    const message = describe(err);
    await act.setStatus(serverId, 'failed', message);
    await act.failAction(actionId, message);
    throw ApplicationFailure.nonRetryable(message);
  }
}

export interface SnapshotInput {
  serverId: string;
  actionId: string;
  name: string;
}

export async function snapshotServer(input: SnapshotInput): Promise<void> {
  const { serverId, actionId, name } = input;
  const snapshotId = await act.createSnapshotRecord(serverId, name);
  try {
    await slow.snapshotVm(serverId, snapshotId);
    await act.completeAction(actionId);
    await act.emit('snapshot.completed', serverId, { snapshotId, name });
  } catch (err) {
    const message = describe(err);
    await act.failSnapshot(snapshotId, message);
    await act.failAction(actionId, message);
    throw ApplicationFailure.nonRetryable(message);
  }
}

export interface DeleteInput {
  serverId: string;
  actionId: string;
}

/** Deleting is best-effort idempotent: a VM that is already gone counts as deleted. */
export async function deleteServer(input: DeleteInput): Promise<void> {
  const { serverId, actionId } = input;
  try {
    await act.deleteVm(serverId);
    await act.finalizeDelete(serverId);
    await act.completeAction(actionId);
    await act.emit('server.deleted', serverId, {});
  } catch (err) {
    const message = describe(err);
    await act.setStatus(serverId, 'failed', `delete failed: ${message}`);
    await act.failAction(actionId, message);
    throw ApplicationFailure.nonRetryable(message);
  }
}

export async function deleteSnapshot(input: { snapshotId: string }): Promise<void> {
  await slow.deleteSnapshotVm(input.snapshotId);
}

function describe(err: unknown): string {
  if (err && typeof err === 'object' && 'cause' in err && (err as { cause?: { message?: string } }).cause?.message) {
    return (err as { cause: { message: string } }).cause.message;
  }
  return err instanceof Error ? err.message : String(err);
}
