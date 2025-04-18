import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function linkPlanActualReports() {
  //console.log('Starting to link plan and actual reports...');

  try {
    // Get all actual reports that don't have a plan report linked
    const actualReports = await prisma.report.findMany({
      where: {
        reportType: 'actual',
        planReportId: null
      }
    });

    //console.log(`Found ${actualReports.length} actual reports without linked plan reports`);

    let successCount = 0;
    let failureCount = 0;

    // For each actual report, find the corresponding plan report and link them
    for (const actualReport of actualReports) {
      // Find the plan report for the same date and branch
      const planReport = await prisma.report.findFirst({
        where: {
          date: actualReport.date,
          branchId: actualReport.branchId,
          reportType: 'plan'
        }
      });

      if (planReport) {
        // Update the actual report to link it to the plan report
        await prisma.report.update({
          where: { id: actualReport.id },
          data: { planReportId: planReport.id }
        });

        //console.log(`Linked actual report ${actualReport.id} to plan report ${planReport.id}`);
        successCount++;
      } else {
        console.warn(`No plan report found for date=${actualReport.date}, branchId=${actualReport.branchId}`);
        failureCount++;
      }
    }

    //console.log(`Completed linking reports. Success: ${successCount}, Failure: ${failureCount}`);
  } catch (error) {
    console.error('Error linking reports:', error);
  } finally {
    await prisma.$disconnect();
  }
}

linkPlanActualReports()
  .then(() => //console.log('Migration completed'))
  .catch(e => console.error('Migration failed:', e)); 