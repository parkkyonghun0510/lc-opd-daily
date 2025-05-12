from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base

class RefreshToken(Base):
    __tablename__ = "RefreshToken" # Match the Prisma schema table name

    id = Column(String, primary_key=True, index=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String, unique=True, nullable=False)
    expiresAt = Column(DateTime, nullable=False)
    createdAt = Column(DateTime(timezone=True), server_default=func.now())
    isRevoked = Column(Boolean, default=False)

    # Define relationship with User model
    user = relationship("User", back_populates="refreshTokens")
