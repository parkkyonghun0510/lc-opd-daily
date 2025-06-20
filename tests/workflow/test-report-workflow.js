// Test script to verify report workflow changes
// Run this script with Node.js

async function testReportWorkflow() {
  console.log("Testing report workflow changes...");

  // Test case 1: Creating an Actual report without a Plan report
  console.log("\nTest case 1: Creating an Actual report without a Plan report");
  console.log(
    'Expected: Should return error "A plan report must exist before submitting an actual report"',
  );
  console.log('API call: POST /api/reports with reportType="actual"');

  // Test case 2: Creating an Actual report with an unapproved Plan report
  console.log(
    "\nTest case 2: Creating an Actual report with an unapproved Plan report",
  );
  console.log(
    'Expected: Should return error "The plan report must be approved before submitting an actual report"',
  );
  console.log('API call: POST /api/reports with reportType="actual"');

  // Test case 3: Creating an Actual report with an approved Plan report
  console.log(
    "\nTest case 3: Creating an Actual report with an approved Plan report",
  );
  console.log("Expected: Should successfully create the Actual report");
  console.log('API call: POST /api/reports with reportType="actual"');

  // Test case 4: Editing a rejected report as the owner
  console.log("\nTest case 4: Editing a rejected report as the owner");
  console.log("Expected: Should successfully update the report");
  console.log("API call: PATCH /api/reports with id=<report_id>");

  // Test case 5: Resubmitting a rejected report as the owner
  console.log("\nTest case 5: Resubmitting a rejected report as the owner");
  console.log(
    'Expected: Should successfully update the report status to "pending_approval"',
  );
  console.log(
    'API call: PATCH /api/reports with id=<report_id> and status="pending_approval"',
  );

  console.log("\nTo test these cases:");
  console.log("1. Log in to the application");
  console.log("2. Create a Plan report for today");
  console.log(
    "3. Try to create an Actual report for today (should be disabled until Plan is approved)",
  );
  console.log("4. Log in as an admin and approve the Plan report");
  console.log("5. Create an Actual report for today (should now be allowed)");
  console.log("6. Log in as an admin and reject the Actual report");
  console.log(
    "7. Edit and resubmit the rejected Actual report (should be allowed)",
  );
}

testReportWorkflow();
