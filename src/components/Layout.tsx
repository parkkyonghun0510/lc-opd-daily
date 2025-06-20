import { OfflineIndicator } from "./OfflineIndicator";
import { InstallPrompt } from "./InstallPrompt";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <>
      <OfflineIndicator />
      <InstallPrompt />
      <div className="min-h-screen bg-background">{children}</div>
    </>
  );
}
