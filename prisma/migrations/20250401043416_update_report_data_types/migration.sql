/*
  Warnings:

  - You are about to alter the column `writeOffs` on the `Report` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(15,2)`.
  - You are about to alter the column `ninetyPlus` on the `Report` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(15,2)`.
  - The `submittedAt` column on the `Report` table would be dropped and recreated. This will lead to data loss if there is data in the column.
*/

-- Step 1: Add a temporary date column
ALTER TABLE "Report" ADD COLUMN "date_new" DATE;

-- Step 2: Convert string dates to DATE for each row
UPDATE "Report" SET "date_new" = "date"::DATE;

-- Step 3: Make the temporary column NOT NULL after data is migrated
ALTER TABLE "Report" ALTER COLUMN "date_new" SET NOT NULL;

-- Step 4: Drop the old column and rename the new one
ALTER TABLE "Report" DROP COLUMN "date";
ALTER TABLE "Report" RENAME COLUMN "date_new" TO "date";

-- Step 5: Convert numeric columns to decimal
ALTER TABLE "Report" 
ALTER COLUMN "writeOffs" SET DATA TYPE DECIMAL(15,2),
ALTER COLUMN "ninetyPlus" SET DATA TYPE DECIMAL(15,2);

-- Step 6: Fix submittedAt similar to date
ALTER TABLE "Report" ADD COLUMN "submittedAt_new" TIMESTAMP(3);
UPDATE "Report" SET "submittedAt_new" = "submittedAt"::TIMESTAMP;
ALTER TABLE "Report" ALTER COLUMN "submittedAt_new" SET NOT NULL;
ALTER TABLE "Report" ALTER COLUMN "submittedAt_new" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Report" DROP COLUMN "submittedAt";
ALTER TABLE "Report" RENAME COLUMN "submittedAt_new" TO "submittedAt";

-- Step 7: Add indexes for optimization
CREATE INDEX "Report_branchId_date_idx" ON "Report"("branchId", "date");
CREATE INDEX "Report_submittedBy_status_idx" ON "Report"("submittedBy", "status");
CREATE INDEX "Report_reportType_status_idx" ON "Report"("reportType", "status");
CREATE INDEX "Report_date_status_idx" ON "Report"("date", "status");

-- Step 8: Re-create the unique constraint
CREATE UNIQUE INDEX "Report_date_branchId_reportType_key" ON "Report"("date", "branchId", "reportType");
