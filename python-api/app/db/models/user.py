from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class User(Base):
    __tablename__ = "User" # Match the Prisma schema table name

    id = Column(String, primary_key=True, index=True) # Assuming CUIDs are stored as strings
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False) # Hashed password
    role = Column(String, default="user", nullable=False)
    branchId = Column(String, ForeignKey("Branch.id"), nullable=True, index=True)
    isActive = Column(Boolean, default=True)
    lastLogin = Column(DateTime, nullable=True)
    createdAt = Column(DateTime(timezone=True), server_default=func.now())
    updatedAt = Column(DateTime(timezone=True), onupdate=func.now())
    failedLoginAttempts = Column(Integer, default=0)
    lockedUntil = Column(DateTime(timezone=True), nullable=True)
    image = Column(String, nullable=True)
    preferences = Column(JSON, nullable=True)

    # Relationships (back_populates will be defined in the related models)
    branch = relationship("Branch", back_populates="users")
    activityLogs = relationship("ActivityLog", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("InAppNotification", back_populates="user", cascade="all, delete-orphan")
    pushSubscriptions = relationship("PushSubscription", back_populates="user", cascade="all, delete-orphan")
    reportComments = relationship("ReportComment", back_populates="user", cascade="all, delete-orphan")
    telegramLinkingCodes = relationship("TelegramLinkingCode", back_populates="user", cascade="all, delete-orphan")
    telegramSubscription = relationship("TelegramSubscription", back_populates="user", uselist=False, cascade="all, delete-orphan")
    activities = relationship("UserActivity", back_populates="user", cascade="all, delete-orphan")
    branchAssignments = relationship("UserBranchAssignment", back_populates="user", cascade="all, delete-orphan")
    userRoles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")
    refreshTokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', username='{self.username}')>"

# Need to create Branch, ActivityLog, InAppNotification, PushSubscription,
# ReportComment, TelegramLinkingCode, TelegramSubscription, UserActivity,
# UserBranchAssignment, UserRole, RefreshToken models as well.
