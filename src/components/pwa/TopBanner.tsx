"use client";

import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { X } from "lucide-react";

type BannerProps = {
  title: string;
  description: string;
  isVisible: boolean;
  onDismiss: () => void;
  actions: ReactNode;
};

export function TopBanner({
  title,
  description,
  isVisible,
  onDismiss,
  actions,
}: BannerProps) {
  const animationClass = isVisible
    ? "translate-y-0 opacity-100 transition-all duration-300 ease-out"
    : "-translate-y-full opacity-0 transition-all duration-300 ease-in pointer-events-none";

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${animationClass}`}>
      <Card className="mx-4 mt-4 md:mx-auto md:max-w-md p-4 bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {description}
              </p>
            </div>
            <button
              onClick={onDismiss}
              className="ml-2 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex justify-end gap-2">{actions}</div>
        </div>
      </Card>
    </div>
  );
}
