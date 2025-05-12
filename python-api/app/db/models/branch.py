from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class Branch(Base):
    __tablename__ = "Branch"

    id = Column(String, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    isActive = Column(Boolean, default=True)
    createdAt = Column(DateTime(timezone=True), server_default=func.now())
    updatedAt = Column(DateTime(timezone=True), onupdate=func.now())
    parentId = Column(String, ForeignKey("Branch.id"), nullable=True)

    # Self-referential relationship for parent/children
    parent = relationship("Branch", remote_side=[id], back_populates="children")
    children = relationship("Branch", back_populates="parent")

    # Relationships to other models
    users = relationship("User", back_populates="branch")
    reports = relationship("Report", back_populates="branch", cascade="all, delete-orphan")
    branchAssignments = relationship("UserBranchAssignment", back_populates="branch", cascade="all, delete-orphan")
    userRoles = relationship("UserRole", back_populates="branch", cascade="all, delete-orphan")


    def __repr__(self):
        return f"<Branch(id={self.id}, name='{self.name}', code='{self.code}')>"

# Need to create User, Report, UserBranchAssignment, UserRole models.
# User model is already created.
