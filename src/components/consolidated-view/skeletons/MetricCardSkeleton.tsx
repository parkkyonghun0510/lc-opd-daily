"use client";

import { Card, CardContent } from "@/components/ui/card";

export const MetricCardSkeleton = () => {
  return (
    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 overflow-hidden">
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
          <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded mt-2 w-full"></div>
        </div>
      </CardContent>
    </Card>
  );
};
