import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentActor, Public, RequireScopes } from '../../../common/auth/decorators';
import type { Actor } from '../../../common/auth/actor';
import { ObjectsService } from './objects.service';
import { FakeObjectStorage, OBJECT_STORAGE_PROVIDER, ObjectStorageProvider } from './objects.provider';
import { CreateBucketDto, CreateStorageKeyDto, PresignDto, UpdateBucketDto } from './objects.dto';

@ApiTags('object-storage')
@ApiBearerAuth()
@Controller('v1/buckets')
export class BucketsController {
  constructor(private readonly objects: ObjectsService) {}

  @Get() @RequireScopes('storage:read')
  list(@CurrentActor() actor: Actor, @Query('project') project?: string) {
    return this.objects.list(actor, project);
  }

  @Post() @RequireScopes('storage:write') @HttpCode(201)
  create(@CurrentActor() actor: Actor, @Body() dto: CreateBucketDto) {
    return this.objects.create(actor, dto);
  }

  @Get(':name') @RequireScopes('storage:read')
  get(@CurrentActor() actor: Actor, @Param('name') name: string, @Query('project') project?: string) {
    return this.objects.get(actor, name, project);
  }

  @Patch(':name') @RequireScopes('storage:write')
  update(@CurrentActor() actor: Actor, @Param('name') name: string, @Body() dto: UpdateBucketDto, @Query('project') project?: string) {
    return this.objects.update(actor, name, dto, project);
  }

  @Delete(':name') @RequireScopes('storage:write')
  remove(@CurrentActor() actor: Actor, @Param('name') name: string, @Query('project') project?: string) {
    return this.objects.remove(actor, name, project);
  }

  @Get(':name/objects') @RequireScopes('storage:read')
  listObjects(@CurrentActor() actor: Actor, @Param('name') name: string, @Query('prefix') prefix?: string, @Query('token') token?: string, @Query('project') project?: string) {
    return this.objects.listObjects(actor, name, prefix ?? '', token, project);
  }

  @Delete(':name/objects') @RequireScopes('storage:write')
  deleteObject(@CurrentActor() actor: Actor, @Param('name') name: string, @Query('key') key: string, @Query('project') project?: string) {
    return this.objects.deleteObject(actor, name, key, project);
  }

  @Post(':name/presign') @RequireScopes('storage:write')
  presign(@CurrentActor() actor: Actor, @Param('name') name: string, @Body() dto: PresignDto, @Query('project') project?: string) {
    return this.objects.presign(actor, name, dto, project);
  }
}

@ApiTags('object-storage')
@ApiBearerAuth()
@Controller('v1/storage-keys')
export class StorageKeysController {
  constructor(private readonly objects: ObjectsService) {}

  @Get() @RequireScopes('storage:read')
  list(@CurrentActor() actor: Actor, @Query('project') project?: string) {
    return this.objects.listKeys(actor, project);
  }

  @Post() @RequireScopes('storage:write') @HttpCode(201)
  create(@CurrentActor() actor: Actor, @Body() dto: CreateStorageKeyDto) {
    return this.objects.createKey(actor, dto);
  }

  @Delete(':id') @RequireScopes('storage:write')
  revoke(@CurrentActor() actor: Actor, @Param('id') id: string, @Query('project') project?: string) {
    return this.objects.revokeKey(actor, id, project);
  }
}

/**
 * Development only: serves the fake provider's presigned URLs so uploads and downloads work
 * end to end without a Ceph cluster. Not mounted when the provider is RGW.
 */
@Controller('_fake-s3')
export class FakeS3Controller {
  constructor(@Inject(OBJECT_STORAGE_PROVIDER) private readonly provider: ObjectStorageProvider) {}

  private fake() {
    return this.provider instanceof FakeObjectStorage ? this.provider : null;
  }

  @Public() @Get(':bucket/*')
  async get(@Param('bucket') bucket: string, @Req() req: Request, @Res() res: Response) {
    const fake = this.fake();
    const key = keyOf(req);
    if (!fake) return res.status(404).end();
    const b = fake.buckets.get(bucket);
    const o = b?.objects.get(key);
    if (!b || !o) return res.status(404).json({ error: 'NoSuchKey' });
    if (!b.public && !fake.verify('GET', bucket, key, Number(req.query.exp), String(req.query.sig ?? ''))) return res.status(403).json({ error: 'AccessDenied' });
    res.setHeader('content-type', o.contentType).setHeader('content-length', String(o.body.length)).setHeader('last-modified', o.lastModified.toUTCString());
    return res.end(o.body);
  }

  @Public() @Delete(':bucket/*')
  async delete(@Param('bucket') bucket: string, @Req() req: Request, @Res() res: Response) {
    const fake = this.fake();
    const key = keyOf(req);
    if (!fake || !fake.verify('DELETE', bucket, key, Number(req.query.exp), String(req.query.sig ?? ''))) return res.status(403).json({ error: 'AccessDenied' });
    fake.buckets.get(bucket)?.objects.delete(key);
    return res.status(204).end();
  }

  /** Uploads read the raw stream: nothing parses application/octet-stream bodies. */
  @Public() @Put(':bucket/*')
  async put(@Param('bucket') bucket: string, @Req() req: Request, @Res() res: Response) {
    const fake = this.fake();
    const key = keyOf(req);
    if (!fake || !fake.verify('PUT', bucket, key, Number(req.query.exp), String(req.query.sig ?? ''))) return res.status(403).json({ error: 'AccessDenied' });
    const b = fake.buckets.get(bucket);
    if (!b) return res.status(404).json({ error: 'NoSuchBucket' });
    const chunks: Buffer[] = [];
    if (req.readableEnded || (req as Request & { rawBody?: Buffer }).rawBody) chunks.push((req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? '')));
    else for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    const body = Buffer.concat(chunks);
    if (body.length > 64 * 1024 * 1024) return res.status(413).json({ error: 'EntityTooLarge' });
    b.objects.set(key, { body, contentType: req.headers['content-type'] ?? 'application/octet-stream', lastModified: new Date() });
    res.setHeader('etag', `"${body.length}"`);
    return res.status(200).end();
  }
}

function keyOf(req: Request) {
  const path = req.path.replace(/^\/_fake-s3\/[^/]+\//, '');
  return decodeURIComponent(path);
}
