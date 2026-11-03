/** Public-only negative checks: deployment must not expose internal source paths.
 * HEAD requests read status only. No response body, credentials, or PII collected.
 */
export const INTERNAL_PUBLIC_PATHS=Object.freeze([
 '.github/workflows/pages-public.yml',
 'scripts/live-pages-smoke.mjs',
 'tests/step64-public-release.test.mjs',
 'supabase/'
]);
export function isInternalPathBlocked(status){
 return [401,403,404,410].includes(status);
}
