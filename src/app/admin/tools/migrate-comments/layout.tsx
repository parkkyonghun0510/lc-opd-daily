import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Migrate Comments | Admin Tools",
  description: "Migrate legacy comments to the new ReportComment model",
};

export default function MigrateCommentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
