from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class ActivityLog(Base):
    __tablename__ = "ActivityLog" # Match Prisma schema table name

    id = Column(String, primary_key=True, index=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String, nullable=False, index=True)
    details = Column(Text, nullable=True) # Text for potentially longer details
    ipAddress = Column(String, nullable=True)
    userAgent = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationship
    user = relationship("User", back_populates="activityLogs")

    def __repr__(self):
        return f"<ActivityLog(id={self.id}, userId='{self.userId}', action='{self.action}')>"

# Depends on User model, which is created.
