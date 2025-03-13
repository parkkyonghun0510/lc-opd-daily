import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  className,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl p-6 shadow-sm border border-gray-100",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <h3 className="text-2xl font-semibold mt-1">{value}</h3>

          {trend && (
            <p
              className={cn(
                "text-sm mt-2 flex items-center",
                trend.isPositive ? "text-green-600" : "text-red-600"
              )}
            >
              <span className="mr-1">{trend.isPositive ? "↑" : "↓"}</span>
              {trend.value}%
            </p>
          )}
        </div>

        <div className="p-3 bg-gray-50 rounded-lg">
          <Icon className="w-6 h-6 text-gray-600" />
        </div>
      </div>
    </div>
  );
}
