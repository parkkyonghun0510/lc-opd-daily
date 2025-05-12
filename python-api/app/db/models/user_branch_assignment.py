from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class UserBranchAssignment(Base):
    __tablename__ = "UserBranchAssignment" # Match Prisma schema table name

    id = Column(String, primary_key=True, index=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False, index=True)
    branchId = Column(String, ForeignKey("Branch.id", ondelete="CASCADE"), nullable=False, index=True)
    isDefault = Column(Boolean, default=False)
    createdAt = Column(DateTime(timezone=True), server_default=func.now())
    updatedAt = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="branchAssignments")
    branch = relationship("Branch", back_populates="branchAssignments")

    __table_args__ = (
        UniqueConstraint('userId', 'branchId', name='uq_user_branch_assignment'),
    )

    def __repr__(self):
        return f"<UserBranchAssignment(id={self.id}, userId='{self.userId}', branchId='{self.branchId}')>"

# Depends on User and Branch models, which are created.
