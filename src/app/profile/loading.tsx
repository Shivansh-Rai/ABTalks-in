import { PageSkeleton } from "@/components/shared/page-skeleton";

/*
 * Plan 168. Covers this segment and every descendant that lacks its own
 * loading.tsx, and re-enables `<Link>` prefetching: Next's default
 * prefetch="auto" skips dynamic routes that have no loading boundary.
 */
export default function ProfileLoading() {
  return <PageSkeleton />;
}
