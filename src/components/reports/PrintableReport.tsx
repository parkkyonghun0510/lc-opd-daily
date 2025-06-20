import { forwardRef } from "react";
import { formatKHRCurrency } from "@/lib/utils";

interface ReportComment {
  id: string;
  content: string;
  user: {
    name: string;
  };
  createdAt: string | Date;
}

interface Report {
  id: string;
  date: string;
  branch: {
    name: string;
    code: string;
  };
  writeOffs: number;
  ninetyPlus: number;
  status: string;
  ReportComment?: ReportComment[];
}

interface TrendData {
  writeOffs: {
    average: number;
    trend: number;
    direction: "up" | "down" | "stable";
  };
  ninetyPlus: {
    average: number;
    trend: number;
    direction: "up" | "down" | "stable";
  };
  branchPerformance: Array<{
    branchId: string;
    averageWriteOffs: number;
    averageNinetyPlus: number;
    reportCount: number;
  }>;
}

interface PrintableReportProps {
  reports: Report[];
  trends?: TrendData;
  printOptions: {
    includeAnalytics: boolean;
    includeComments: boolean;
  };
}

export const PrintableReport = forwardRef<HTMLDivElement, PrintableReportProps>(
  ({ reports, trends, printOptions }, ref) => {
    return (
      <div ref={ref} className="p-8 bg-white print:p-0">
        <style>{`
          @media print {
            .print-only { display: block; }
            @page { margin: 2cm; }
          }
        `}</style>

        <div className="mb-8 print:mb-6">
          <h1 className="text-2xl font-bold mb-2">Reports Summary</h1>
          <p className="text-sm text-gray-600">
            Generated on {new Date().toLocaleDateString()} at{" "}
            {new Date().toLocaleTimeString()}
          </p>
        </div>

        {printOptions.includeAnalytics && trends && (
          <div className="mb-8 print:mb-6">
            <h2 className="text-xl font-semibold mb-4">Analytics Overview</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <h3 className="text-sm font-medium">Write-offs Trend</h3>
                <p className="text-2xl font-bold">
                  {formatKHRCurrency(trends.writeOffs.average)}
                </p>
                <p
                  className={`text-sm ${
                    trends.writeOffs.direction === "up"
                      ? "text-red-500"
                      : trends.writeOffs.direction === "down"
                        ? "text-green-500"
                        : "text-gray-500"
                  }`}
                >
                  {trends.writeOffs.direction === "up"
                    ? "↑"
                    : trends.writeOffs.direction === "down"
                      ? "↓"
                      : "−"}{" "}
                  {formatKHRCurrency(Math.abs(trends.writeOffs.trend))}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium">90+ Days Trend</h3>
                <p className="text-2xl font-bold">
                  {formatKHRCurrency(trends.ninetyPlus.average)}
                </p>
                <p
                  className={`text-sm ${
                    trends.ninetyPlus.direction === "up"
                      ? "text-red-500"
                      : trends.ninetyPlus.direction === "down"
                        ? "text-green-500"
                        : "text-gray-500"
                  }`}
                >
                  {trends.ninetyPlus.direction === "up"
                    ? "↑"
                    : trends.ninetyPlus.direction === "down"
                      ? "↓"
                      : "−"}{" "}
                  {formatKHRCurrency(Math.abs(trends.ninetyPlus.trend))}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8 print:mb-6">
          <h2 className="text-xl font-semibold mb-4">Reports Detail</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="py-2 px-4 text-left">Date</th>
                  <th className="py-2 px-4 text-left">Branch</th>
                  <th className="py-2 px-4 text-right">Write-offs</th>
                  <th className="py-2 px-4 text-right">90+ Days</th>
                  <th className="py-2 px-4 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report, index) => (
                  <tr
                    key={report.id}
                    className={index % 2 === 0 ? "bg-gray-50" : ""}
                  >
                    <td className="py-2 px-4">
                      {new Date(report.date).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-4">
                      {report.branch.name}
                      <span className="text-gray-500 text-sm ml-1">
                        ({report.branch.code})
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right">
                      {formatKHRCurrency(report.writeOffs)}
                    </td>
                    <td className="py-2 px-4 text-right">
                      {formatKHRCurrency(report.ninetyPlus)}
                    </td>
                    <td className="py-2 px-4">
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs ${
                          report.status === "approved"
                            ? "bg-green-100 text-green-800"
                            : report.status === "rejected"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {report.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {printOptions.includeComments && (
          <div className="mb-8 print:mb-6">
            <h2 className="text-xl font-semibold mb-4">Comments</h2>
            {reports.map(
              (report) =>
                report.ReportComment &&
                report.ReportComment.length > 0 && (
                  <div key={report.id} className="mb-4">
                    <h3 className="text-sm font-medium mb-2">
                      {report.branch.name} -{" "}
                      {new Date(report.date).toLocaleDateString()}
                    </h3>
                    {report.ReportComment.map((comment) => (
                      <div
                        key={comment.id}
                        className="pl-4 border-l-2 border-gray-200 mb-2"
                      >
                        <p className="text-sm">{comment.content}</p>
                        <p className="text-xs text-gray-500">
                          {comment.user.name} -{" "}
                          {new Date(comment.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ),
            )}
          </div>
        )}

        <div className="text-xs text-gray-500 text-center print:mt-8">
          Generated from LC Reports System
        </div>
      </div>
    );
  },
);
