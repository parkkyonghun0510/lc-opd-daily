from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any, Union, Tuple
from sqlalchemy import and_, or_, func, desc, asc
from datetime import date, datetime, timedelta

from app.db.models import Report, ReportComment, User, Branch
from app.schemas import ReportCreate, ReportUpdate, ReportCommentCreate

async def get_report_by_id(db: Session, report_id: str) -> Optional[Report]:
    """Get a report by its ID."""
    return db.query(Report).filter(Report.id == report_id).first()

async def get_reports(
    db: Session, 
    skip: int = 0, 
    limit: int = 100,
    branch_id: Optional[str] = None,
    user_id: Optional[str] = None,
    report_type: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    sort_by: str = "date",
    sort_order: str = "desc"
) -> Tuple[List[Report], int]:
    """
    Get reports with filtering and sorting options.
    Returns a tuple of (reports, total_count)
    """
    query = db.query(Report)
    
    # Apply filters
    if branch_id:
        query = query.filter(Report.branchId == branch_id)
    
    if user_id:
        query = query.filter(Report.userId == user_id)
    
    if report_type:
        query = query.filter(Report.type == report_type)
    
    if status:
        query = query.filter(Report.status == status)
    
    if start_date:
        query = query.filter(Report.date >= start_date)
    
    if end_date:
        query = query.filter(Report.date <= end_date)
    
    # Get total count before pagination
    total_count = query.count()
    
    # Apply sorting
    if sort_by == "date":
        if sort_order == "asc":
            query = query.order_by(asc(Report.date))
        else:
            query = query.order_by(desc(Report.date))
    elif sort_by == "createdAt":
        if sort_order == "asc":
            query = query.order_by(asc(Report.createdAt))
        else:
            query = query.order_by(desc(Report.createdAt))
    elif sort_by == "updatedAt":
        if sort_order == "asc":
            query = query.order_by(asc(Report.updatedAt))
        else:
            query = query.order_by(desc(Report.updatedAt))
    
    # Apply pagination
    reports = query.offset(skip).limit(limit).all()
    
    return reports, total_count

async def get_reports_for_approval(
    db: Session,
    user_id: str,
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    branch_id: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> Tuple[List[Report], int]:
    """
    Get reports that need approval by the specified user.
    This depends on your business logic for who can approve reports.
    """
    # Get user's role
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return [], 0
    
    query = db.query(Report)
    
    # Apply status filter
    if status:
        query = query.filter(Report.status == status)
    else:
        # Default to pending reports if no status specified
        query = query.filter(Report.status == "PENDING")
    
    # Apply branch filter if specified
    if branch_id:
        query = query.filter(Report.branchId == branch_id)
    
    # Apply date filters
    if start_date:
        query = query.filter(Report.date >= start_date)
    
    if end_date:
        query = query.filter(Report.date <= end_date)
    
    # Get total count before pagination
    total_count = query.count()
    
    # Apply pagination
    reports = query.order_by(desc(Report.date)).offset(skip).limit(limit).all()
    
    return reports, total_count

async def create_report(
    db: Session, 
    report_in: ReportCreate,
    user_id: str
) -> Report:
    """Create a new report."""
    # Check if a report already exists for this date, branch, and type
    existing_report = db.query(Report).filter(
        and_(
            Report.date == report_in.date,
            Report.branchId == report_in.branchId,
            Report.type == report_in.type
        )
    ).first()
    
    if existing_report:
        raise ValueError(f"A report already exists for this date, branch, and type")
    
    # Create new report
    db_report = Report(
        userId=user_id,
        branchId=report_in.branchId,
        date=report_in.date,
        type=report_in.type,
        status="DRAFT",  # Initial status
        data=report_in.data,
        # Add any other fields from your Report model
    )
    
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report

async def update_report(
    db: Session, 
    db_report: Report, 
    report_in: Union[ReportUpdate, Dict[str, Any]]
) -> Report:
    """Update a report."""
    if isinstance(report_in, dict):
        update_data = report_in
    else:
        update_data = report_in.dict(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(db_report, field, value)
    
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report

async def delete_report(db: Session, report_id: str) -> bool:
    """Delete a report."""
    report = await get_report_by_id(db, report_id)
    if not report:
        return False
    
    db.delete(report)
    db.commit()
    return True

async def submit_report(db: Session, report_id: str, user_id: str) -> Report:
    """Submit a report for approval."""
    report = await get_report_by_id(db, report_id)
    if not report:
        raise ValueError("Report not found")
    
    if report.status != "DRAFT":
        raise ValueError(f"Report cannot be submitted. Current status: {report.status}")
    
    # Update status to PENDING
    report.status = "PENDING"
    report.submittedAt = datetime.utcnow()
    report.submittedById = user_id
    
    db.add(report)
    db.commit()
    db.refresh(report)
    return report

async def approve_report(
    db: Session, 
    report_id: str, 
    user_id: str,
    comment: Optional[str] = None
) -> Report:
    """Approve a report."""
    report = await get_report_by_id(db, report_id)
    if not report:
        raise ValueError("Report not found")
    
    if report.status != "PENDING":
        raise ValueError(f"Report cannot be approved. Current status: {report.status}")
    
    # Update status to APPROVED
    report.status = "APPROVED"
    report.approvedAt = datetime.utcnow()
    report.approvedById = user_id
    
    db.add(report)
    db.commit()
    db.refresh(report)
    
    # Add comment if provided
    if comment:
        await add_report_comment(
            db=db,
            report_id=report_id,
            user_id=user_id,
            comment_in=ReportCommentCreate(content=comment, type="APPROVAL")
        )
    
    return report

async def reject_report(
    db: Session, 
    report_id: str, 
    user_id: str,
    comment: str
) -> Report:
    """Reject a report with a required comment."""
    report = await get_report_by_id(db, report_id)
    if not report:
        raise ValueError("Report not found")
    
    if report.status != "PENDING":
        raise ValueError(f"Report cannot be rejected. Current status: {report.status}")
    
    # Update status to REJECTED
    report.status = "REJECTED"
    report.rejectedAt = datetime.utcnow()
    report.rejectedById = user_id
    
    db.add(report)
    db.commit()
    db.refresh(report)
    
    # Add rejection comment
    await add_report_comment(
        db=db,
        report_id=report_id,
        user_id=user_id,
        comment_in=ReportCommentCreate(content=comment, type="REJECTION")
    )
    
    return report

async def add_report_comment(
    db: Session,
    report_id: str,
    user_id: str,
    comment_in: ReportCommentCreate
) -> ReportComment:
    """Add a comment to a report."""
    # Check if report exists
    report = await get_report_by_id(db, report_id)
    if not report:
        raise ValueError("Report not found")
    
    # Create comment
    db_comment = ReportComment(
        reportId=report_id,
        userId=user_id,
        content=comment_in.content,
        type=comment_in.type or "COMMENT",  # Default to regular comment
        parentId=comment_in.parentId  # May be None for top-level comments
    )
    
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return db_comment

async def get_report_comments(
    db: Session,
    report_id: str,
    skip: int = 0,
    limit: int = 100
) -> List[ReportComment]:
    """Get comments for a specific report."""
    return db.query(ReportComment).filter(
        ReportComment.reportId == report_id
    ).order_by(asc(ReportComment.createdAt)).offset(skip).limit(limit).all()
