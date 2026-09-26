import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NativeConnection, Worker } from '@temporalio/worker';
import { WorkerModule } from './worker.module';
import { createActivities } from './workflows/activities';
import { loadConfig } from './config/config';
import { SchedulerService } from './modules/scheduler/scheduler.service';
import { MetricsService } from './modules/monitoring/metrics.service';
import { MeteringService } from './modules/billing/metering.service';

/**
 * Temporal worker process. Runs the provisioning workflows and, because it is the
 * process closest to the data plane, also hosts the NATS consumers (heartbeats, usage).
 */
async function main() {
  const cfg = loadConfig();
  const log = new Logger('worker');
  const app = await NestFactory.createApplicationContext(WorkerModule, { logger: ['log', 'warn', 'error'] });

  app.get(SchedulerService).listenHeartbeats();
  app.get(MeteringService).listen();
  app.get(MetricsService).listen();

  const connection = await NativeConnection.connect({ address: cfg.TEMPORAL_ADDRESS });
  const worker = await Worker.create({
    connection,
    namespace: cfg.TEMPORAL_NAMESPACE,
    taskQueue: cfg.TEMPORAL_TASK_QUEUE,
    workflowsPath: require.resolve('./workflows/workflows'),
    activities: createActivities(app),
    maxConcurrentActivityTaskExecutions: 50,
  });

  log.log(`worker up — driver=${cfg.HYPERVISOR_DRIVER} queue=${cfg.TEMPORAL_TASK_QUEUE}`);
  const shutdown = async () => {
    worker.shutdown();
    await app.close();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  await worker.run();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
