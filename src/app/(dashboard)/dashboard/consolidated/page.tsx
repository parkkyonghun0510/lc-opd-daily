import { Metadata } from "next";
import ConsolidatedView from "@/components/consolidated-view";

export const metadata: Metadata = {
  title: "Consolidated Reports | LC Daily Reports",
  description: "View consolidated reports across all branches",
};

export default function ConsolidatedPage() {
  return <ConsolidatedView />;
}
