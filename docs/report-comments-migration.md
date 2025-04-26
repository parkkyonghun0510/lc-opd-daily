# Report Comments Migration Guide

This document outlines the migration process from the legacy comments system to the new ReportComment model.

## Background

Previously, comments for reports were stored as a string in the `comments` field of the Report model. In some versions of the application, comments were also stored as a JSON array in the `commentArray` field, but this field may not be present in all database instances.

This approach had several limitations:
- UTF-8 encoding issues when storing special characters or emojis
- Limited ability to query or filter comments
- No proper relational structure for comments

The new approach uses a dedicated `ReportComment` model with a relation to the Report model, which provides:
- Better handling of UTF-8 characters including emojis
- Proper relational structure
- Ability to query and filter comments
- Better performance for reports with many comments

## Migration Process

The migration process involves:

1. Creating a new `ReportComment` record for each comment in the legacy formats
2. Maintaining backward compatibility with existing code
3. Gradually transitioning all code to use the new model

### Migration Steps

1. **Admin Tool**: Use the migration tool at `/admin/tools/migrate-comments` to migrate existing comments
2. **API Updates**: All API endpoints have been updated to use the new model
3. **UI Components**: UI components have been updated to use the new endpoints

### Technical Details

#### ReportComment Model

```prisma
model ReportComment {
  id        String   @id @default(cuid())
  reportId  String
  userId    String
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  report    Report   @relation(fields: [reportId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([reportId])
  @@index([userId])
}
```

#### API Endpoints

- **GET /api/reports/[id]/report-comments** - Get all comments for a report
- **POST /api/reports/[id]/report-comments** - Add a comment to a report
- **DELETE /api/reports/[id]/report-comments/[commentId]** - Delete a comment
- **PATCH /api/reports/[id]/report-comments/[commentId]** - Update a comment

#### Deprecated Endpoints

The following endpoints are deprecated and will be removed in a future update:

- **POST /api/reports/[id]/comments** - Use `/api/reports/[id]/report-comments` instead
- **POST /api/reports/[id]/comments/reply** - Use `/api/reports/[id]/report-comments` with a parentId parameter instead

## Backward Compatibility

For backward compatibility:
- The legacy `comments` field is still present in the Report model
- If the `commentArray` field exists in your database, it will also be maintained
- The deprecated endpoints still work but will create a ReportComment record in addition to updating the legacy fields
- New code should exclusively use the ReportComment model and related endpoints

### Database Compatibility

The migration tool is designed to work with different database schemas:
- If your database only has the `comments` field, the migration will only process that field
- If your database has both `comments` and `commentArray` fields, the migration will process both
- The migration is safe to run multiple times and will skip reports that already have ReportComment records

## Future Work

In the future, we plan to:
1. Standardize the database schema across all environments
2. If needed, add the `commentArray` column to databases that don't have it (for consistency)
3. Eventually remove the legacy `comments` and `commentArray` fields from the Report model
4. Remove the deprecated endpoints
5. Add support for threaded comments and reactions
