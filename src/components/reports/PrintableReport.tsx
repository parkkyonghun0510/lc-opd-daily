"use client";

import React, { forwardRef } from "react";
import { format } from "date-fns";

type Branch = { name: string; code?: string };

type Report = {
  id: string;
  date: string;
  branch: Branch;
  reportType: string;
  status: string;
  writeOffs: number;
  ninetyPlus: number;
  submittedBy?: string | null;
  comments?: string | null;
  ReportComment?: Array<any>;
};

type PrintOptions = {
  includeAnalytics: boolean;
  includeComments: boolean;
};

interface PrintableReportProps {
  reports: Report[];
  trends?: any;
  printOptions: PrintOptions;
}

export const PrintableReport = forwardRef<HTMLDivElement, PrintableReportProps>(
  function PrintableReport({ reports, trends, printOptions }, ref) {
    const totals = reports.reduce(
      (acc, r) => {
        acc.writeOffs += Number(r.writeOffs || 0);
        acc.ninetyPlus += Number(r.ninetyPlus || 0);
        return acc;
      },
      { writeOffs: 0, ninetyPlus: 0 }
    );

    const generatedAt = new Date();

    return (
      <div ref={ref} className="p-6 bg-white text-black">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm">Generated on {format(generatedAt, "yyyy-MM-dd HH:mm")}</p>
        </div>

        {printOptions.includeAnalytics && (
          <div className="mb-4">
            <h2 className="font-semibold mb-2">Summary</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Total Write-offs: {totals.writeOffs}</div>
              <div>Total 90+ Days: {totals.ninetyPlus}</div>
              <div>Report Count: {reports.length}</div>
            </div>
          </div>
        )}

        <table className="w-full text-sm border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-left">Date</th>
              <th className="border p-2 text-left">Branch</th>
              <th className="border p-2 text-left">Type</th>
              <th className="border p-2 text-left">Status</th>
              <th className="border p-2 text-right">Write-offs</th>
              <th className="border p-2 text-right">90+ Days</th>
              <th className="border p-2 text-left">Submitted By</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td className="border p-2">{r.date}</td>
                <td className="border p-2">{r.branch?.name ?? ""}</td>
                <td className="border p-2 capitalize">{r.reportType}</td>
                <td className="border p-2 capitalize">{r.status}</td>
                <td className="border p-2 text-right">{Number(r.writeOffs ?? 0)}</td>
                <td className="border p-2 text-right">{Number(r.ninetyPlus ?? 0)}</td>
                <td className="border p-2">{r.submittedBy ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {printOptions.includeComments && (
          <div className="mt-4">
            <h2 className="font-semibold mb-2">Comments</h2>
            {reports.map((r) => (
              <div key={`${r.id}-comments`} className="mb-2">
                <div className="font-medium">
                  {r.branch?.name} - {r.date}
                </div>
                <div className="text-xs text-gray-700 whitespace-pre-wrap">
                  {Array.isArray(r.ReportComment) && r.ReportComment.length > 0
                    ? r.ReportComment
                        .map((c: any) => `• ${c.user?.name || "User"}: ${c.content}`)
                        .join("\n")
                    : r.comments || "No comments"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);

export default PrintableReport;