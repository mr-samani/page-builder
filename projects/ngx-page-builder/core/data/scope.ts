import { getSegments } from './path';
import type { DataContext, DataRow } from './types';

/**
 * Where `{{…}}` and `@…` references are resolved:
 *   route.x · query.x · page.x · global.x     → the DataContext
 *   row.x  (or just x)                         → the current record
 *   parent.x · parent.parent.x                 → the record of the enclosing collection (nested lists)
 *   $index $number $count $first $last $odd $even
 */
export interface DataScope {
  readonly ctx: DataContext;
  readonly row?: DataRow;
  readonly index?: number;
  readonly count?: number;
  readonly parent?: DataScope;
}

export function createScope(ctx: DataContext = {}, row?: DataRow, parent?: DataScope, index?: number, count?: number): DataScope {
  return { ctx, row, parent, index, count };
}

export function resolveSegments(scope: DataScope, segs: readonly string[]): unknown {
  switch (segs[0]) {
    case 'route':
      return getSegments(scope.ctx.route, segs, 1);
    case 'query':
      return getSegments(scope.ctx.query, segs, 1);
    case 'page':
      return getSegments(scope.ctx.page, segs, 1);
    case 'global':
      return getSegments(scope.ctx.global, segs, 1);
    case 'row':
      return getSegments(scope.row, segs, 1);
    case 'parent': {
      let s: DataScope | undefined = scope.parent;
      let i = 1;
      while (segs[i] === 'parent') {
        s = s?.parent;
        i++;
      }
      return s ? getSegments(s.row, segs, i) : undefined;
    }
    case '$index':
      return scope.index;
    case '$number':
      return scope.index === undefined ? undefined : scope.index + 1;
    case '$count':
      return scope.count;
    case '$first':
      return scope.index === undefined ? undefined : scope.index === 0;
    case '$last':
      return scope.index === undefined || scope.count === undefined ? undefined : scope.index === scope.count - 1;
    case '$odd':
      return scope.index === undefined ? undefined : scope.index % 2 === 1;
    case '$even':
      return scope.index === undefined ? undefined : scope.index % 2 === 0;
    default:
      return getSegments(scope.row, segs, 0);
  }
}

/** Names that are scope roots (not record fields). */
export const SCOPE_ROOTS: ReadonlySet<string> = new Set(['route', 'query', 'page', 'global', 'row', 'parent']);
