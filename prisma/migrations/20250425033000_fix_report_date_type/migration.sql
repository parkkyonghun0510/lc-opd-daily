-- This migration ensures the Report.date field is properly converted from string to DATE type
-- If the migration has already been applied, these statements will be skipped

-- Check if date column is of type TEXT
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'Report'
        AND column_name = 'date'
        AND data_type = 'text'
    ) THEN
        -- Step 1: Add a temporary date column
        ALTER TABLE "Report" ADD COLUMN "date_new" DATE;

        -- Step 2: Convert string dates to DATE for each row
        UPDATE "Report" SET "date_new" = "date"::DATE;

        -- Step 3: Make the temporary column NOT NULL after data is migrated
        ALTER TABLE "Report" ALTER COLUMN "date_new" SET NOT NULL;

        -- Step 4: Drop the old column and rename the new one
        ALTER TABLE "Report" DROP COLUMN "date";
        ALTER TABLE "Report" RENAME COLUMN "date_new" TO "date";

        -- Step 5: Re-create the unique constraint and indexes
        CREATE UNIQUE INDEX IF NOT EXISTS "Report_date_branchId_reportType_key" ON "Report"("date", "branchId", "reportType");
        CREATE INDEX IF NOT EXISTS "Report_branchId_date_idx" ON "Report"("branchId", "date");
        CREATE INDEX IF NOT EXISTS "Report_date_status_idx" ON "Report"("date", "status");
    END IF;
END $$;
