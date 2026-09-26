import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min, ValidateNested } from 'class-validator';

export class ForwardingRuleDto {
  @IsIn(['http', 'https', 'tcp']) entryProtocol: 'http' | 'https' | 'tcp';
  @IsInt() @Min(1) @Max(65535) entryPort: number;
  @IsIn(['http', 'tcp']) targetProtocol: 'http' | 'tcp';
  @IsInt() @Min(1) @Max(65535) targetPort: number;
  @IsOptional() @IsString() certificateId?: string;
}

export class HealthCheckDto {
  @IsOptional() @IsIn(['http', 'tcp']) protocol?: 'http' | 'tcp';
  @IsOptional() @IsInt() @Min(1) @Max(65535) port?: number;
  @IsOptional() @IsString() @Length(1, 200) path?: string;
  @IsOptional() @IsInt() @Min(3) @Max(300) intervalSeconds?: number;
  @IsOptional() @IsInt() @Min(1) @Max(120) timeoutSeconds?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10) healthyThreshold?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10) unhealthyThreshold?: number;
}

export class StickySessionsDto {
  @IsIn(['none', 'cookie']) type: 'none' | 'cookie';
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_-]{1,40}$/) cookieName?: string;
  @IsOptional() @IsInt() @Min(1) @Max(86400) ttlSeconds?: number;
}

export class CreateLoadBalancerDto {
  @IsString() @Length(1, 64) @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, { message: 'name must be lowercase letters, digits and hyphens' }) name: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() project?: string;
  @IsOptional() @IsInt() @Min(1) @Max(3) nodes?: number;
  @IsOptional() @IsIn(['round_robin', 'least_conn']) algorithm?: 'round_robin' | 'least_conn';
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => ForwardingRuleDto) forwardingRules: ForwardingRuleDto[];
  @IsOptional() @ValidateNested() @Type(() => HealthCheckDto) healthCheck?: HealthCheckDto;
  @IsOptional() @ValidateNested() @Type(() => StickySessionsDto) stickySessions?: StickySessionsDto;
  @IsOptional() @IsBoolean() redirectHttpToHttps?: boolean;
  @IsOptional() @IsBoolean() proxyProtocol?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(100) serverIds?: string[];
  @IsOptional() @IsString() @Length(1, 40) tag?: string;
}

export class UpdateLoadBalancerDto {
  @IsOptional() @IsString() @Length(1, 64) @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/) name?: string;
  @IsOptional() @IsIn(['round_robin', 'least_conn']) algorithm?: 'round_robin' | 'least_conn';
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => ForwardingRuleDto) forwardingRules?: ForwardingRuleDto[];
  @IsOptional() @ValidateNested() @Type(() => HealthCheckDto) healthCheck?: HealthCheckDto;
  @IsOptional() @ValidateNested() @Type(() => StickySessionsDto) stickySessions?: StickySessionsDto;
  @IsOptional() @IsBoolean() redirectHttpToHttps?: boolean;
  @IsOptional() @IsBoolean() proxyProtocol?: boolean;
  @IsOptional() @IsString() @Length(0, 40) tag?: string;
}

export class TargetsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsString({ each: true }) serverIds: string[];
}

export class CreateCertificateDto {
  @IsString() @Length(1, 64) name: string;
  @IsIn(['custom', 'letsencrypt']) type: 'custom' | 'letsencrypt';
  @IsOptional() @IsString() @Length(1, 65536) certPem?: string;
  @IsOptional() @IsString() @Length(1, 65536) keyPem?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) domains?: string[];
  @IsOptional() @IsString() project?: string;
}
