/**
 * URL slug generation.
 *
 * Must stay behaviourally identical to the backfill in
 * `prisma/migrations/20260817060000_schema_revisions` — same character folding, same
 * `-2`, `-3` collision suffixes — so slugs minted by the app match slugs minted by a
 * migration.
 */

export function slugify(input: string, fallback = "item"): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || fallback;
}

/**
 * Appends a numeric suffix until the slug is free. The first collision yields `-2`,
 * matching the migration's `row_number()` numbering.
 *
 * This is check-then-write, so it races under concurrent creates. The unique index on
 * the column is the actual guarantee; callers should retry on a unique violation.
 * At a handful of admin writes a day that is not worth pre-empting.
 */
export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  let candidate = base;
  let n = 1;

  while (await exists(candidate)) {
    n += 1;
    candidate = `${base}-${n}`;
  }

  return candidate;
}
