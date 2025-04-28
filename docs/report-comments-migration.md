# Report Comments Migration Guide

This document outlines the migration process from the legacy comments system to the new ReportComment model with threaded comments support.

## Background

Previously, comments for reports were stored as a string in the `comments` field of the Report model. This approach had several limitations:
- UTF-8 encoding issues when storing special characters or emojis
- Limited ability to query or filter comments
- No proper relational structure for comments
- No support for threaded comments or replies

The new approach uses a dedicated `ReportComment` model with a relation to the Report model, which provides:
- Better handling of UTF-8 characters including emojis
- Proper relational structure
- Ability to query and filter comments
- Better performance for reports with many comments
- Support for threaded comments with parent-child relationships

## Migration Process

The migration process involves:

1. Creating a new `ReportComment` record for each comment in the legacy formats
2. Maintaining backward compatibility with existing code
3. Gradually transitioning all code to use the new model
4. Adding support for threaded comments with the `parentId` field

### Migration Steps

1. **Admin Tool**: Use the migration tool at `/admin/tools/migrate-comments` to migrate existing comments
2. **API Updates**: All API endpoints have been updated to use the new model
3. **UI Components**: UI components have been updated to use the new endpoints
4. **Schema Update**: The ReportComment model has been updated to include the `parentId` field for threaded comments

### Recent Updates

#### April 28, 2025: Added Threaded Comments Support

A new migration (`20250428043425_add_parent_id_to_report_comment`) has been created to add support for threaded comments:

- Added `parentId` field to the ReportComment model
- Added self-relation for parent-child comment relationships
- Updated API endpoints to support the `parentId` parameter
- Updated documentation to reflect these changes

This update allows users to reply to existing comments, creating conversation threads within reports.

### Technical Details

#### ReportComment Model

```prisma
model ReportComment {
  id        String   @id @default(cuid())
  reportId  String
  userId    String
  content   String
  parentId  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  report    Report   @relation(fields: [reportId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  parent    ReportComment?  @relation("CommentReplies", fields: [parentId], references: [id], onDelete: SetNull)
  replies   ReportComment[] @relation("CommentReplies")

  @@index([reportId])
  @@index([userId])
  @@index([parentId])
}
```

#### API Endpoints

- **GET /api/reports/[id]/report-comments** - Get all comments for a report
- **POST /api/reports/[id]/report-comments** - Add a comment to a report (include `parentId` for replies)
- **DELETE /api/reports/[id]/report-comments/[commentId]** - Delete a comment
- **PATCH /api/reports/[id]/report-comments/[commentId]** - Update a comment

#### Deprecated Endpoints

The following endpoints are deprecated and will be removed in a future update:

- **POST /api/reports/[id]/comments** - Use `/api/reports/[id]/report-comments` instead
- **POST /api/reports/[id]/comments/reply** - Use `/api/reports/[id]/report-comments` with a parentId parameter instead

## Backward Compatibility

For backward compatibility:
- The legacy `comments` field is still present in the Report model
- The deprecated endpoints still work but will create a ReportComment record in addition to updating the legacy comments field
- New code should exclusively use the ReportComment model and related endpoints

### Database Compatibility

The migration tool is designed to be safe and efficient:
- The migration processes the `comments` field from the Report model
- The migration is safe to run multiple times and will skip reports that already have ReportComment records
- The migration preserves the relationship between comments and their parent comments for threaded discussions

## Threaded Comments

The ReportComment model now supports threaded comments through the `parentId` field. This allows for:

- Creating replies to existing comments
- Building conversation threads
- Organizing comments in a hierarchical structure

### Using Threaded Comments

To create a reply to an existing comment:

1. Use the `POST /api/reports/[id]/report-comments` endpoint
2. Include the `parentId` parameter with the ID of the parent comment
3. The comment will be linked to the parent comment and appear as a reply

Example request:
```json
POST /api/reports/[reportId]/report-comments
{
  "content": "This is a reply to the previous comment",
  "parentId": "parent-comment-id"
}
```

### Displaying Threaded Comments

When fetching comments, you can organize them into a hierarchical structure:

1. Fetch all comments for a report
2. Group comments by their parent-child relationships
3. Display top-level comments (those with no parent) first
4. Nest child comments under their respective parents

## Troubleshooting

### Common Issues

#### Unknown argument `parentId`

If you encounter an error like:
```
Unknown argument `parentId`. Available options are marked with ?.
```

This indicates that the `parentId` field is missing from your ReportComment model in the database. To fix this:

1. Make sure you've applied all migrations:
   ```bash
   npx prisma migrate deploy
   ```

2. If the error persists, you may need to manually add the column:
   ```sql
   ALTER TABLE "ReportComment" ADD COLUMN "parentId" TEXT;
   CREATE INDEX "ReportComment_parentId_idx" ON "ReportComment"("parentId");
   ALTER TABLE "ReportComment" ADD CONSTRAINT "ReportComment_parentId_fkey"
   FOREIGN KEY ("parentId") REFERENCES "ReportComment"("id")
   ON DELETE SET NULL ON UPDATE CASCADE;
   ```

3. Regenerate the Prisma client:
   ```bash
   npx prisma generate
   ```

#### Database Schema Drift

If you encounter schema drift errors when applying migrations, you may need to:

1. Mark problematic migrations as resolved:
   ```bash
   npx prisma migrate resolve --applied [migration_name]
   ```

2. Manually apply the necessary schema changes

## Future Work

In the future, we plan to:
1. Standardize the database schema across all environments
2. Eventually remove the legacy `comments` field from the Report model
3. Remove the deprecated endpoints
4. Add support for comment reactions (like, dislike, etc.)
5. Implement comment editing history
