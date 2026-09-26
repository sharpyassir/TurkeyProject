import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Length, Matches, Max, Min, ValidateNested } from 'class-validator';

/** Kubernetes minor versions on offer; the newest is the default. */
export const KUBE_VERSIONS = ['1.31', '1.30'] as const;
export const DEFAULT_CONTROL_SIZE = 's-2vcpu-4gb';
export const MAX_POOLS = 10;
export const MAX_NODES_PER_POOL = 50;

export class TaintDto {
  @IsString() @Length(1, 63) key: string;
  @IsOptional() @IsString() @Length(0, 63) value?: string;
  @IsOptional() @IsIn(['NoSchedule', 'PreferNoSchedule', 'NoExecute']) effect?: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
}

export class NodePoolDto {
  @IsString() @Length(1, 30) @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, { message: 'pool name must be lowercase letters, digits and hyphens' }) name: string;
  @IsString() size: string;
  @IsInt() @Min(1) @Max(MAX_NODES_PER_POOL) count: number;
  @IsOptional() @IsObject() labels?: Record<string, string>;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => TaintDto) taints?: TaintDto[];
}

export class CreateClusterDto {
  @IsString() @Length(1, 40) @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, { message: 'name must be lowercase letters, digits and hyphens' }) name: string;
  @IsOptional() @IsIn(KUBE_VERSIONS) version?: (typeof KUBE_VERSIONS)[number];
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() project?: string;
  /** Three control plane nodes with a shared address instead of one. */
  @IsOptional() @IsBoolean() ha?: boolean;
  @IsOptional() @IsString() controlSize?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(MAX_POOLS) @ValidateNested({ each: true }) @Type(() => NodePoolDto) pools: NodePoolDto[];
}

export class UpdateClusterDto {
  @IsOptional() @IsString() @Length(1, 40) @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/) name?: string;
}

export class ScalePoolDto {
  @IsInt() @Min(0) @Max(MAX_NODES_PER_POOL) count: number;
}
