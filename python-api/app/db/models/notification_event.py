from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class NotificationEvent(Base):
    __tablename__ = "NotificationEvent" # Match Prisma schema table name

    id = Column(String, primary_key=True, index=True)
    notificationId = Column(String, ForeignKey("InAppNotification.id", ondelete="CASCADE"), nullable=False, index=True)
    event = Column(String, nullable=False, index=True)
    event_metadata = Column(JSON, nullable=True)  # Renamed from 'metadata' as it's a reserved name in SQLAlchemy
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationship
    notification = relationship("InAppNotification", back_populates="events")

    def __repr__(self):
        return f"<NotificationEvent(id={self.id}, notificationId='{self.notificationId}', event='{self.event}')>"

# Depends on InAppNotification model, which is created.
