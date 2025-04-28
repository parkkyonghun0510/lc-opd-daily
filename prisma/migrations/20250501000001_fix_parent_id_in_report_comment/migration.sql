-- This migration ensures the ReportComment.parentId field is properly set up
-- If the migration has already been applied, these statements will be skipped

-- Check if parentId column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'ReportComment'
        AND column_name = 'parentId'
    ) THEN
        -- Add the parentId column if it doesn't exist
        ALTER TABLE "ReportComment" ADD COLUMN "parentId" TEXT;
        
        -- Create index for parentId
        CREATE INDEX "ReportComment_parentId_idx" ON "ReportComment"("parentId");
        
        -- Add foreign key constraint
        ALTER TABLE "ReportComment" ADD CONSTRAINT "ReportComment_parentId_fkey" 
        FOREIGN KEY ("parentId") REFERENCES "ReportComment"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
        
        RAISE NOTICE 'Added parentId column to ReportComment table';
    ELSE
        RAISE NOTICE 'The parentId column already exists in the ReportComment table';
    END IF;
END $$;
