from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class UserRole(Base):
    __tablename__ = "UserRole" # Match Prisma schema table name

    id = Column(String, primary_key=True, index=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False, index=True)
    roleId = Column(String, ForeignKey("Role.id"), nullable=False, index=True)
    branchId = Column(String, ForeignKey("Branch.id"), nullable=True, index=True) # Optional branch association
    isDefault = Column(Boolean, default=False)
    createdAt = Column(DateTime(timezone=True), server_default=func.now())
    updatedAt = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="userRoles")
    role = relationship("Role", back_populates="userRoles")
    branch = relationship("Branch", back_populates="userRoles")

    __table_args__ = (
        UniqueConstraint('userId', 'roleId', 'branchId', name='uq_user_role_branch'),
    )

    def __repr__(self):
        return f"<UserRole(id={self.id}, userId='{self.userId}', roleId='{self.roleId}', branchId='{self.branchId}')>"

# Depends on User, Role, and Branch models.
# User, Role, and Branch models are already created.
