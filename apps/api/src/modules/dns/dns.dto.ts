import { IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA'] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export class CreateDomainDto {
  @IsString() @Length(3, 253) @Matches(/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, { message: 'name must be a lowercase domain such as example.com' }) name: string;
  /** Creates an A record at the apex pointing here. */
  @IsOptional() @IsString() ip?: string;
  @IsOptional() @IsString() project?: string;
}

export class CreateRecordDto {
  @IsString() @Length(1, 253) name: string;
  @IsIn(RECORD_TYPES) type: RecordType;
  @IsString() @Length(1, 4096) content: string;
  @IsOptional() @IsInt() @Min(30) @Max(604800) ttl?: number;
  @IsOptional() @IsInt() @Min(0) @Max(65535) priority?: number;
}

export class UpdateRecordDto {
  @IsOptional() @IsString() @Length(1, 253) name?: string;
  @IsOptional() @IsString() @Length(1, 4096) content?: string;
  @IsOptional() @IsInt() @Min(30) @Max(604800) ttl?: number;
  @IsOptional() @IsInt() @Min(0) @Max(65535) priority?: number;
}

export class ReverseDnsDto {
  /** null clears it. */
  @IsOptional() @IsString() @Length(1, 253) name?: string | null;
}
