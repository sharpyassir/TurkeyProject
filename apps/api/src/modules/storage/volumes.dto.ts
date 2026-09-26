import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export const VOLUME_MIN_GB = 10;
export const VOLUME_MAX_GB = 16384;

export class CreateVolumeDto {
  @IsString() @Length(1, 64) @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, { message: 'name must be lowercase letters, digits and hyphens' }) name: string;
  @IsInt() @Min(VOLUME_MIN_GB) @Max(VOLUME_MAX_GB) sizeGb: number;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() project?: string;
  /** Attach to this server right after the image is ready. */
  @IsOptional() @IsString() serverId?: string;
}

export class AttachVolumeDto {
  @IsString() serverId: string;
}

export class ResizeVolumeDto {
  @IsInt() @Min(VOLUME_MIN_GB) @Max(VOLUME_MAX_GB) sizeGb: number;
}
