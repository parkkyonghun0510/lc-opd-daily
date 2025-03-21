-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "planReportId" TEXT;

-- CreateIndex
CREATE INDEX "Report_planReportId_idx" ON "Report"("planReportId");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_planReportId_fkey" FOREIGN KEY ("planReportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;
