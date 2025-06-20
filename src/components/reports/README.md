# Report Components

## EnhancedReportApproval

The `EnhancedReportApproval` component is a streamlined version of the original `ReportApproval` component, designed to be more concise and maintainable. It provides a user interface for approving or rejecting reports, with appropriate UI elements based on the report's current status.

### Features

- Displays appropriate UI based on report status (pending, approved, rejected)
- Integrates with the ReportCommentsList component for displaying comments
- Uses server actions for approval/rejection operations
- Provides role-specific guidance for users
- Safely handles Date objects to prevent rendering errors
- Supports dark mode

### Usage

```tsx
import { EnhancedReportApproval } from "@/components/reports/EnhancedReportApproval";
import { Report } from "@/types/reports";

// Your component
function ReportDetails({ report }: { report: Report }) {
  const handleApprovalComplete = () => {
    // Refresh data or perform other actions after approval/rejection
    console.log("Report status updated");
  };

  return (
    <div>
      <h2>Report Details</h2>
      {/* Other report details */}

      <EnhancedReportApproval
        report={report}
        onApprovalComplete={handleApprovalComplete}
      />
    </div>
  );
}
```

### Props

| Prop                 | Type         | Description                                                     |
| -------------------- | ------------ | --------------------------------------------------------------- |
| `report`             | `Report`     | The report object to display and process                        |
| `onApprovalComplete` | `() => void` | Callback function called after successful approval or rejection |

### Report Object Requirements

The `report` object must include:

- `id`: Report identifier
- `status`: Current report status ("pending", "pending_approval", "approved", "rejected")
- `writeOffs`: Write-offs amount
- `ninetyPlus`: 90+ days amount
- `branch`: Object containing branch information (at least `name`)
- `submittedAt`: Submission timestamp
- `ReportComment`: Array of report comments (optional)

### Integration with Server Actions

This component uses the `approveReportAction` server action from `@/app/_actions/report-actions` to process approvals and rejections. The server action handles:

- Permission checking
- Status updates
- Comment creation
- Notification sending
- Audit logging

### Date Handling

The component includes special handling for Date objects to prevent React rendering errors:

- Uses a `safeFormatDate` helper function to convert Date objects to strings
- Processes all date fields in the report object before rendering
- Handles both string and Date formats for compatibility
- Provides fallbacks for invalid date values

This ensures that the component can safely handle date fields regardless of whether they come from the database as Date objects or strings.

### Test Component

A test component is available at `/test-approval` to demonstrate the usage of the EnhancedReportApproval component with different report statuses.
