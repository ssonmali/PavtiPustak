import { Skeleton } from "@/components/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-2 py-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="py-6">
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
