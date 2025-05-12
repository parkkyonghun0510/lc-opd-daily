# This file makes it easier to import models
# e.g., from app.db.models import User, Report

from .user import User
from .branch import Branch
from .report import Report
from .report_comment import ReportComment
from .activity_log import ActivityLog
from .role import Role
from .user_role import UserRole
from .user_branch_assignment import UserBranchAssignment
from .user_activity import UserActivity
from .organization_settings import OrganizationSettings
from .push_subscription import PushSubscription
from .in_app_notification import InAppNotification
from .notification_event import NotificationEvent
from .telegram_subscription import TelegramSubscription
from .telegram_linking_code import TelegramLinkingCode
from .refresh_token import RefreshToken

# You can also define __all__ to control what `from app.db.models import *` imports
__all__ = [
    "User",
    "Branch",
    "Report",
    "ReportComment",
    "ActivityLog",
    "Role",
    "UserRole",
    "UserBranchAssignment",
    "UserActivity",
    "OrganizationSettings",
    "PushSubscription",
    "InAppNotification",
    "NotificationEvent",
    "TelegramSubscription",
    "TelegramLinkingCode",
    "RefreshToken",
]
