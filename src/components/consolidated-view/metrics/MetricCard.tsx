"use client";

import React from "react";
import { ArrowRight, ArrowUp, ArrowDown, Minus } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  formatKHRCurrency,
  formatPercentage,
  getPercentageColorClass,
} from "../utils/formatters";
import { cn } from "../utils/helpers";

interface MetricCardProps {
  title: string;
  value: number;
  previousValue?: number;
  change?: number | string;
  changePeriod?: string;
  percentageOf?: number; // Total value this metric is a percentage of
  detailsLink?: string;
  onDetailsClick?: () => void;
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
  inverseColors?: boolean; // For metrics where decreasing is good
  currency?: boolean; // Whether to format as currency
  showBadge?: boolean; // Whether to show a badge with the percentage of total
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  previousValue,
  change,
  changePeriod = "vs previous period",
  percentageOf,
  detailsLink,
  onDetailsClick,
  loading = false,
  icon,
  className,
  inverseColors = false,
  currency = true,
  showBadge = false,
}) => {
  const hasChange = change !== undefined && change !== null;
  const numericChange =
    typeof change === "string" ? parseFloat(change) : change;
  const changeDirection = !hasChange
    ? "stable"
    : numericChange > 0
    ? "up"
    : numericChange < 0
    ? "down"
    : "stable";

  const formattedValue = currency
    ? formatKHRCurrency(value)
    : value.toLocaleString();
  const percentage =
    percentageOf !== undefined && percentageOf > 0
      ? (value / percentageOf) * 100
      : null;

  return (
    <Card className={cn("transition-all duration-200 shadow-sm", className)}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          {showBadge && percentage !== null && (
            <Badge variant="outline" className="ml-2">
              {formatPercentage(percentage)}
            </Badge>
          )}
        </div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formattedValue}</div>

        {hasChange && (
          <div className="flex items-center mt-2">
            <span
              className={cn(
                "text-sm inline-flex items-center",
                getPercentageColorClass(numericChange, inverseColors)
              )}
            >
              {changeDirection === "up" && <ArrowUp className="w-4 h-4 mr-1" />}
              {changeDirection === "down" && (
                <ArrowDown className="w-4 h-4 mr-1" />
              )}
              {changeDirection === "stable" && (
                <Minus className="w-4 h-4 mr-1" />
              )}
              {formatPercentage(Math.abs(numericChange), false)}
            </span>
            <span className="text-xs text-muted-foreground ml-2">
              {changePeriod}
            </span>
          </div>
        )}

        {previousValue !== undefined && !hasChange && (
          <div className="text-sm text-muted-foreground mt-2">
            Previous:{" "}
            {currency
              ? formatKHRCurrency(previousValue)
              : previousValue.toLocaleString()}
          </div>
        )}
      </CardContent>

      {(detailsLink || onDetailsClick) && (
        <CardFooter className="pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="px-0 hover:bg-transparent hover:text-blue-500"
            onClick={onDetailsClick}
            asChild={!!detailsLink && !onDetailsClick}
          >
            {detailsLink && !onDetailsClick ? (
              <a href={detailsLink} className="flex items-center">
                View Details <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            ) : (
              <div className="flex items-center">
                View Details <ArrowRight className="ml-1 h-4 w-4" />
              </div>
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};
