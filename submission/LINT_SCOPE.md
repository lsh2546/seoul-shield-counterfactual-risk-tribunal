# Production lint scope

The production route imports `components/capital-control-tower.tsx` directly. `npm run lint` checks that route and its active source.

The following files are unused scaffold/template code and are excluded from the production lint gate:

- `components/ui/**` — generated shadcn component catalog, not imported by the production route.
- `components/tribunal-experience.tsx` — retired prototype, not imported by the production route.
- `hooks/use-mobile.ts` — unused scaffold hook.

The exclusions do not hide generated build output or errors in the active Capital Control Tower. Before any excluded component is imported into a production route, it must be removed from this list and pass lint.
