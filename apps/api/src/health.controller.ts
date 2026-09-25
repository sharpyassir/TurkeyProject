import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './common/auth/decorators';
import { PrismaService } from './common/prisma/prisma.service';
import { NatsService } from './common/nats/nats.service';

@ApiTags('meta')
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly nats: NatsService) {}

  @Public() @Get('healthz')
  async health() {
    const db = await this.prisma.$queryRaw`SELECT 1`.then(() => 'ok').catch(() => 'down');
    return { status: db === 'ok' ? 'ok' : 'degraded', db, nats: this.nats.connected ? 'ok' : 'down', version: process.env.npm_package_version ?? 'dev' };
  }
}
