from sqlalchemy import (
    Column, String, Float, DateTime, ForeignKey, Date, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class Report(Base):
    __tablename__ = "Report"

    id = Column(String, primary_key=True, index=True)
    branchId = Column(String, ForeignKey("Branch.id"), nullable=False, index=True)
    writeOffs = Column(Float, nullable=False)
    ninetyPlus = Column(Float, nullable=False)
    reportType = Column(String, default="actual", nullable=False)
    status = Column(String, default="pending", nullable=False)
    submittedBy = Column(String, ForeignKey("User.id"), nullable=False) # Assuming submittedBy is a user ID
    comments = Column(String, nullable=True) # Legacy comments field
    createdAt = Column(DateTime(timezone=True), server_default=func.now())
    updatedAt = Column(DateTime(timezone=True), onupdate=func.now())
    planReportId = Column(String, ForeignKey("Report.id"), nullable=True, index=True)
    submittedAt = Column(String, nullable=False) # Storing as string as per Prisma schema, consider DateTime
    date = Column(Date, nullable=False, index=True) # Using Date type for date-only storage

    # Relationships
    branch = relationship("Branch", back_populates="reports")
    submitter = relationship("User") # Relationship to the user who submitted the report

    # Self-referential relationship for plan/actual reports
    planReport = relationship("Report", remote_side=[id], back_populates="actualReports", foreign_keys=[planReportId])
    actualReports = relationship("Report", back_populates="planReport", foreign_keys=[planReportId])

    reportComments = relationship("ReportComment", back_populates="report", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint('date', 'branchId', 'reportType', name='uq_report_date_branch_type'),
        # Additional indexes from Prisma schema
        # Index("ix_report_branch_date", "branchId", "date"), - Covered by UniqueConstraint or individual indexes
        # Index("ix_report_date_status", "date", "status"), - Covered by individual indexes
    )

    def __repr__(self):
        return f"<Report(id={self.id}, branchId='{self.branchId}', date='{self.date}', type='{self.reportType}')>"

# Need to create User and ReportComment models.
# User model is already created.
