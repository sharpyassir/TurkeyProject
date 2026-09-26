import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentActor, RequireScopes } from '../../common/auth/decorators';
import type { Actor } from '../../common/auth/actor';
import { MetricsService, Period } from './metrics.service';
import { AlertsService } from './alerts.service';
import { CreateAlertDto, UpdateAlertDto } from './monitoring.dto';

@ApiTags('monitoring')
@ApiBearerAuth()
@Controller('v1')
export class MonitoringController {
  constructor(private readonly metrics: MetricsService, private readonly alerts: AlertsService) {}

  /** Time series for one server. Minute resolution up to 24h, hourly for 7d and 30d. */
  @Get('servers/:id/metrics') @RequireScopes('servers:read')
  series(@CurrentActor() actor: Actor, @Param('id') id: string, @Query('period') period: Period = '1h') {
    return this.metrics.series(actor, id, period);
  }

  @Get('alerts') @RequireScopes('servers:read')
  async list(@CurrentActor() actor: Actor) {
    return { data: await this.alerts.list(actor) };
  }

  @Post('alerts') @RequireScopes('servers:write')
  create(@CurrentActor() actor: Actor, @Body() dto: CreateAlertDto) {
    return this.alerts.create(actor, dto);
  }

  @Get('alerts/incidents') @RequireScopes('servers:read')
  async incidents(@CurrentActor() actor: Actor, @Query('open') open?: string) {
    return { data: await this.alerts.incidents(actor, open === 'true') };
  }

  @Get('alerts/:id') @RequireScopes('servers:read')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.alerts.get(actor, id);
  }

  @Patch('alerts/:id') @RequireScopes('servers:write')
  update(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() dto: UpdateAlertDto) {
    return this.alerts.update(actor, id, dto);
  }

  @Delete('alerts/:id') @RequireScopes('servers:write') @HttpCode(204)
  remove(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.alerts.remove(actor, id);
  }
}
