/*
  Warnings:

  - You are about to drop the column `reviewedAt` on the `Report` table. All the data in the column will be lost.
  - You are about to drop the column `reviewedBy` on the `Report` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[date,branchId,reportType]` on the table `Report` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Report" DROP COLUMN "reviewedAt",
DROP COLUMN "reviewedBy",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "reportType" TEXT NOT NULL DEFAULT 'actual',
ALTER COLUMN "date" SET DATA TYPE TEXT,
ALTER COLUMN "submittedAt" DROP DEFAULT,
ALTER COLUMN "submittedAt" SET DATA TYPE TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Report_date_branchId_reportType_key" ON "Report"("date", "branchId", "reportType");
