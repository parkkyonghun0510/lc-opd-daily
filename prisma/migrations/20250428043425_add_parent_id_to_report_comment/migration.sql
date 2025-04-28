-- Check if commentArray column exists before dropping it
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'Report'
        AND column_name = 'commentArray'
    ) THEN
        ALTER TABLE "Report" DROP COLUMN "commentArray";
    END IF;
END $$;

-- AlterTable
ALTER TABLE "ReportComment" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "ReportComment_parentId_idx" ON "ReportComment"("parentId");

-- AddForeignKey
ALTER TABLE "ReportComment" ADD CONSTRAINT "ReportComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ReportComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
