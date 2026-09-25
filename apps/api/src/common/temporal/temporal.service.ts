import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client, Connection, WorkflowStartOptions } from '@temporalio/client';
import { loadConfig } from '../../config/config';

/** Temporal client used by the API to start lifecycle workflows. */
@Injectable()
export class TemporalService implements OnModuleInit {
  private readonly log = new Logger(TemporalService.name);
  private client?: Client;
  readonly taskQueue = loadConfig().TEMPORAL_TASK_QUEUE;

  async onModuleInit() {
    const { TEMPORAL_ADDRESS, TEMPORAL_NAMESPACE } = loadConfig();
    try {
      const connection = await Connection.connect({ address: TEMPORAL_ADDRESS, connectTimeout: 3000 });
      this.client = new Client({ connection, namespace: TEMPORAL_NAMESPACE });
      this.log.log(`connected to Temporal at ${TEMPORAL_ADDRESS}`);
    } catch (err) {
      this.log.warn(`Temporal unavailable (${(err as Error).message}); workflows cannot start`);
    }
  }

  /**
   * Starts a workflow. `workflowId` must be `<operation>-<resourceId>` so a duplicate
   * request cannot start the same operation twice.
   */
  async start<T extends (...args: any[]) => any>(
    workflow: string,
    args: Parameters<T>,
    workflowId: string,
    opts: Partial<WorkflowStartOptions> = {},
  ) {
    if (!this.client) throw new Error('Temporal not connected');
    const handle = await this.client.workflow.start(workflow, {
      taskQueue: this.taskQueue,
      workflowId,
      args,
      ...opts,
    });
    return handle.workflowId;
  }

  async signal(workflowId: string, signal: string, ...args: unknown[]) {
    if (!this.client) throw new Error('Temporal not connected');
    await this.client.workflow.getHandle(workflowId).signal(signal, ...args);
  }
}
