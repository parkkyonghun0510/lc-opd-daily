from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class UserActivity(Base):
    __tablename__ = "UserActivity" # Match Prisma schema table name

    id = Column(String, primary_key=True, index=True)
    userId = Column(String, ForeignKey("User.id"), nullable=False, index=True)
    action = Column(String, nullable=False, index=True)
    details = Column(JSON, nullable=False) # Storing as JSON as per Prisma schema
    ipAddress = Column(String, nullable=False)
    userAgent = Column(String, nullable=False)
    createdAt = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationship
    user = relationship("User", back_populates="activities")

    def __repr__(self):
        return f"<UserActivity(id={self.id}, userId='{self.userId}', action='{self.action}')>"

# Depends on User model, which is created.
