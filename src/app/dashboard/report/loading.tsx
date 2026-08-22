import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
