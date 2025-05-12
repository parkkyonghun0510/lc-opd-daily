from sqlalchemy import Column, String, DateTime, JSON
from sqlalchemy.sql import func
from app.db.base_class import Base

class OrganizationSettings(Base):
    __tablename__ = "OrganizationSettings" # Match the actual table name in the database

    id = Column(String, primary_key=True, index=True)
    organizationId = Column(String, unique=True, index=True, nullable=False)
    # Storing validationRules as JSON, default is a string representation of JSON
    validationRules = Column(JSON, default='{"comments": {"required": true, "minLength": 10}, "writeOffs": {"maxAmount": 1000, "requireApproval": true}, "ninetyPlus": {"maxAmount": 5000, "requireApproval": true}, "duplicateCheck": {"enabled": true}}', nullable=False)
    createdAt = Column(DateTime(timezone=True), server_default=func.now())
    updatedAt = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<OrganizationSettings(id={self.id}, organizationId='{self.organizationId}')>"

# This is a standalone model.
