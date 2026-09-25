import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Cursor pagination: `?limit=50&cursor=<id>` → `{ data, meta: { next_cursor } }`. */
export class PaginationQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  limit = 50;

  @IsOptional() @IsString()
  cursor?: string;
}

export interface Page<T> {
  data: T[];
  meta: { next_cursor: string | null; count: number };
}

/** Wraps a Prisma `findMany` result fetched with `take: limit + 1`. */
export function toPage<T extends { id: string }>(rows: T[], limit: number): Page<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return { data, meta: { next_cursor: hasMore ? data[data.length - 1].id : null, count: data.length } };
}

export function cursorArgs(q: PaginationQuery) {
  return {
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
  };
}
