from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class ReportComment(Base):
    __tablename__ = "ReportComment" # Match Prisma schema table name

    id = Column(String, primary_key=True, index=True)
    reportId = Column(String, ForeignKey("Report.id", ondelete="CASCADE"), nullable=False, index=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False) # Using Text for potentially longer comments
    createdAt = Column(DateTime(timezone=True), server_default=func.now())
    updatedAt = Column(DateTime(timezone=True), onupdate=func.now())
    parentId = Column(String, ForeignKey("ReportComment.id"), nullable=True, index=True)

    # Relationships
    report = relationship("Report", back_populates="reportComments")
    user = relationship("User", back_populates="reportComments")

    # Self-referential relationship for replies
    parent = relationship("ReportComment", remote_side=[id], back_populates="replies")
    replies = relationship("ReportComment", back_populates="parent", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ReportComment(id={self.id}, reportId='{self.reportId}', userId='{self.userId}')>"

# This model depends on Report and User models, which are already created.
