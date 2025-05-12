from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class PushSubscription(Base):
    __tablename__ = "PushSubscription" # Match Prisma schema table name

    id = Column(String, primary_key=True, index=True)
    endpoint = Column(String, unique=True, index=True, nullable=False)
    p256dh = Column(String, nullable=False)
    auth = Column(String, nullable=False)
    createdAt = Column(DateTime(timezone=True), server_default=func.now())
    updatedAt = Column(DateTime(timezone=True), onupdate=func.now())
    userId = Column(String, ForeignKey("User.id"), nullable=True, index=True) # Optional user link

    # Relationship
    user = relationship("User", back_populates="pushSubscriptions")

    def __repr__(self):
        return f"<PushSubscription(id={self.id}, endpoint='{self.endpoint}')>"

# Depends on User model, which is created.
