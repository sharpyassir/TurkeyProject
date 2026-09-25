import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/decorators';
import { MarketplaceService } from './marketplace.service';

/** Public catalog — browsable without an account so it can double as the marketing page's data source. */
@ApiTags('marketplace')
@Controller('v1/apps')
export class MarketplaceController {
  constructor(private readonly apps: MarketplaceService) {}

  @Public() @Get()
  async list(@Query('category') category?: string) {
    return { data: await this.apps.list(category) };
  }

  @Public() @Get('categories')
  async categories() {
    return { data: await this.apps.categories() };
  }

  @Public() @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.apps.get(slug);
  }
}
