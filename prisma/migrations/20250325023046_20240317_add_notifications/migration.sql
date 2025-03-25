/*
  Warnings:

  - You are about to drop the `ReportHistory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ReportHistory" DROP CONSTRAINT "ReportHistory_reportId_fkey";

-- DropForeignKey
ALTER TABLE "ReportHistory" DROP CONSTRAINT "ReportHistory_userId_fkey";

-- DropTable
DROP TABLE "ReportHistory";
