import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class CreateBucketDto {
  @IsString() @Length(3, 63) @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, { message: 'name must be 3 to 63 lowercase letters, digits and hyphens' }) name: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() project?: string;
  @IsOptional() @IsBoolean() public?: boolean;
}

export class UpdateBucketDto {
  @IsOptional() @IsBoolean() public?: boolean;
}

export class CreateStorageKeyDto {
  @IsString() @Length(1, 60) name: string;
  @IsOptional() @IsString() project?: string;
}

export class PresignDto {
  @IsString() @Length(1, 1024) key: string;
  @IsOptional() @IsIn(['GET', 'PUT', 'DELETE']) method?: 'GET' | 'PUT' | 'DELETE';
  @IsOptional() @IsInt() @Min(60) @Max(604800) expiresSeconds?: number;
  @IsOptional() @IsString() contentType?: string;
}
