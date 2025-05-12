from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class TelegramSubscription(Base):
    __tablename__ = "TelegramSubscription" # Match Prisma schema table name

    id = Column(String, primary_key=True, index=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    chatId = Column(String, unique=True, nullable=False, index=True) # chatId should be unique
    username = Column(String, nullable=True)
    createdAt = Column(DateTime(timezone=True), server_default=func.now())
    updatedAt = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship
    user = relationship("User", back_populates="telegramSubscription")

    def __repr__(self):
        return f"<TelegramSubscription(id={self.id}, userId='{self.userId}', chatId='{self.chatId}')>"

# Depends on User model, which is created.
