# This file makes it easier to import schemas
# e.g., from app.schemas import User, UserCreate, Report, ReportCreate

from .user import (
    User,
    UserBase,
    UserCreate,
    UserUpdate,
    UserInDB,
    UserInDBBase,
    UserLogin,
    UserPasswordChange,
)
from .branch import (
    Branch,
    BranchBase,
    BranchCreate,
    BranchUpdate,
    BranchInDBBase,
    BranchSimple,
)
from .report import (
    Report,
    ReportBase,
    ReportCreate,
    ReportUpdate,
    ReportInDBBase,
    ReportPage,
    ReportCommentCreate as ReportSpecificCommentCreate, # Alias to avoid name clash if needed elsewhere
)
from .report_comment import (
    ReportComment,
    ReportCommentBase,
    ReportCommentCreate,
    ReportCommentUpdate,
    ReportCommentInDBBase,
)
from .token import Token, TokenPayload
from .password import PasswordReset
from .refresh_token import (
    RefreshToken,
    RefreshTokenBase,
    RefreshTokenCreate,
    RefreshTokenUpdate,
    RefreshTokenInDBBase,
    RefreshTokenInDB,
)
from .error import ErrorResponse, ValidationErrorResponse

# Add other schemas as they are created, for example:
# from .activity_log import ActivityLog, ActivityLogCreate
# from .role import Role, RoleCreate
# from .organization_settings import OrganizationSettings, OrganizationSettingsUpdate
# from .notification import InAppNotification, InAppNotificationCreate, NotificationEvent
# from .telegram import TelegramSubscription, TelegramLinkingCode

__all__ = [
    # User Schemas
    "User",
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserInDB",
    "UserInDBBase",
    "UserLogin",
    "UserPasswordChange",
    # Branch Schemas
    "Branch",
    "BranchBase",
    "BranchCreate",
    "BranchUpdate",
    "BranchInDBBase",
    "BranchSimple",
    # Report Schemas
    "Report",
    "ReportBase",
    "ReportCreate",
    "ReportUpdate",
    "ReportInDBBase",
    "ReportPage",
    "ReportSpecificCommentCreate",
    # ReportComment Schemas
    "ReportComment",
    "ReportCommentBase",
    "ReportCommentCreate",
    "ReportCommentUpdate",
    "ReportCommentInDBBase",
    # Token Schemas
    "Token",
    "TokenPayload",
    # RefreshToken Schemas
    "RefreshToken",
    "RefreshTokenBase",
    "RefreshTokenCreate",
    "RefreshTokenUpdate",
    "RefreshTokenInDBBase",
    "RefreshTokenInDB",
    # Password Schemas
    "PasswordReset",
    # Error Schemas
    "ErrorResponse",
    "ValidationErrorResponse",
    # Add other schema names here
]
