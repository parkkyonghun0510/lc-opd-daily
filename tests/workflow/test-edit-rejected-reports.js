// Test script to verify editing rejected reports
// Run this script with Node.js

async function testEditRejectedReports() {
  console.log("Testing editing rejected reports...");

  // Test case 1: Editing a rejected report as the owner
  console.log("\nTest case 1: Editing a rejected report as the owner");
  console.log(
    "Expected: Should successfully update the report and change status to pending_approval",
  );
  console.log("API call: PATCH /api/reports with id=<report_id>");

  // Test case 2: Editing a rejected report for a branch the user is no longer assigned to
  console.log(
    "\nTest case 2: Editing a rejected report for a branch the user is no longer assigned to",
  );
  console.log(
    "Expected: Should still allow editing since it's the user's own rejected report",
  );
  console.log("API call: PATCH /api/reports with id=<report_id>");

  console.log("\nTo test these cases:");
  console.log("1. Log in to the application");
  console.log("2. Create a report for a branch you have access to");
  console.log("3. Log in as an admin and reject the report");
  console.log(
    "4. Log in as the original user and edit the rejected report (should be allowed)",
  );
  console.log(
    "5. Check that the status changes to pending_approval after saving",
  );
  console.log("6. Have an admin remove your access to the branch");
  console.log(
    "7. Try to edit the rejected report again (should still be allowed)",
  );
}

testEditRejectedReports();
