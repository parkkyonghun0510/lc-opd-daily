from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class InAppNotification(Base):
    __tablename__ = "InAppNotification" # Match Prisma schema table name

    id = Column(String, primary_key=True, index=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False) # Text for potentially longer body
    type = Column(String, nullable=False, index=True)
    data = Column(JSON, nullable=True)
    isRead = Column(Boolean, default=False, index=True)
    createdAt = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    readAt = Column(DateTime(timezone=True), nullable=True)
    actionUrl = Column(String, nullable=True)

    # Relationships
    user = relationship("User", back_populates="notifications")
    events = relationship("NotificationEvent", back_populates="notification", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<InAppNotification(id={self.id}, userId='{self.userId}', title='{self.title}')>"

# Depends on User and NotificationEvent models.
# User model is created. NotificationEvent will be created next.
