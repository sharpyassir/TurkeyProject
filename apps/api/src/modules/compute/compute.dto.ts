import { IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { PaginationQuery } from '../../common/pagination';

export class CreateServerDto {
  @IsString() @Matches(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/, { message: 'name must be a valid hostname label' })
  name: string;

  @IsString() size: string; // "s-2vcpu-4gb"
  @IsString() image: string; // "ubuntu-24-04" or marketplace "app-wordpress"
  @IsOptional() @IsString() region?: string; // default ist1
  @IsOptional() @IsString() project?: string; // id or slug, default "default"
  @IsOptional() @IsArray() @IsString({ each: true }) sshKeys?: string[]; // SshKey ids
  @IsOptional() @IsString() @MaxLength(65536) userData?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsBoolean() backups?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) firewalls?: string[];
  /** Marketplace app variables, e.g. { admin_email: "…" } */
  @IsOptional() @IsObject() appVariables?: Record<string, string>;
  /** Anti-affinity: do not place on the same host as these servers. */
  @IsOptional() @IsArray() @IsString({ each: true }) avoid?: string[];
}

export class ServerActionDto {
  @IsIn(['start', 'stop', 'reboot', 'resize', 'rebuild', 'snapshot']) type: 'start' | 'stop' | 'reboot' | 'resize' | 'rebuild' | 'snapshot';
  @IsOptional() @IsString() size?: string; // resize
  @IsOptional() @IsString() image?: string; // rebuild
  @IsOptional() @IsString() @Length(1, 60) name?: string; // snapshot
  @IsOptional() @IsBoolean() force?: boolean; // stop
}

export class ListServersQuery extends PaginationQuery {
  @IsOptional() @IsString() project?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() tag?: string;
}
