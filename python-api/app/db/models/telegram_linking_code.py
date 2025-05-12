from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class TelegramLinkingCode(Base):
    __tablename__ = "TelegramLinkingCode" # Match Prisma schema table name

    id = Column(String, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False, index=True)
    expiresAt = Column(DateTime(timezone=True), nullable=False, index=True)
    createdAt = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    user = relationship("User", back_populates="telegramLinkingCodes")

    def __repr__(self):
        return f"<TelegramLinkingCode(id={self.id}, userId='{self.userId}', code='{self.code}')>"

# Depends on User model, which is created.
