"use client";

import * as React from "react";

interface ScreenReaderAnnouncementProps {
  message: string;
  priority?: "polite" | "assertive";
  className?: string;
}

export function ScreenReaderAnnouncement({
  message,
  priority = "polite",
  className,
}: ScreenReaderAnnouncementProps) {
  const [announcement, setAnnouncement] = React.useState("");

  React.useEffect(() => {
    setAnnouncement(message);
  }, [message]);

  return (
    <div
      role="status"
      aria-live={priority}
      className={className}
      aria-atomic="true"
    >
      {announcement}
    </div>
  );
}
