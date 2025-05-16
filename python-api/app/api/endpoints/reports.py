from fastapi import APIRouter, Depends, HTTPException, status, Query, Path, Body
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import date

from app.api import deps
from app.schemas import (
    Report, ReportCreate, ReportUpdate, ReportPage,
    ReportComment, ReportCommentCreate
)
from app.services import report_service, branch_service
from app.db.models import User
from app.utils.serialization import serialize_sqlalchemy_obj, serialize_query_results

router = APIRouter()

@router.get("/", response_model=ReportPage)
async def read_reports(
    db: Session = Depends(deps.get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    branch_id: Optional[str] = None,
    report_type: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    sort_by: str = Query("date", regex="^(date|createdAt|updatedAt)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Retrieve reports with filtering and pagination.
    Updated to fix response format by changing 'items' to 'data'.
    """
    reports, total = await report_service.get_reports(
        db=db,
        skip=skip,
        limit=limit,
        branch_id=branch_id,
        user_id=None,  # Not filtering by user
        report_type=report_type,
        status=status,
        start_date=start_date,
        end_date=end_date,
        sort_by=sort_by,
        sort_order=sort_order
    )

    # Serialize SQLAlchemy objects to JSON-compatible dictionaries
    serialized_reports = serialize_query_results(reports)

    return {
        "data": serialized_reports,
        "total": total,
        "page": skip // limit + 1,
        "limit": limit,
        "totalPages": (total + limit - 1) // limit  # Ceiling division
    }

@router.get("/my-reports", response_model=ReportPage)
async def read_user_reports(
    db: Session = Depends(deps.get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    branch_id: Optional[str] = None,
    report_type: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    sort_by: str = Query("date", regex="^(date|createdAt|updatedAt)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Retrieve reports created by the current user.
    """
    reports, total = await report_service.get_reports(
        db=db,
        skip=skip,
        limit=limit,
        branch_id=branch_id,
        user_id=current_user.id,  # Filter by current user
        report_type=report_type,
        status=status,
        start_date=start_date,
        end_date=end_date,
        sort_by=sort_by,
        sort_order=sort_order
    )

    # Serialize SQLAlchemy objects to JSON-compatible dictionaries
    serialized_reports = serialize_query_results(reports)

    return {
        "data": serialized_reports,
        "total": total,
        "page": skip // limit + 1,
        "limit": limit,
        "totalPages": (total + limit - 1) // limit  # Ceiling division
    }

@router.get("/approvals", response_model=ReportPage)
async def read_reports_for_approval(
    db: Session = Depends(deps.get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    branch_id: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Retrieve reports that need approval by the current user.
    """
    reports, total = await report_service.get_reports_for_approval(
        db=db,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        status=status,
        branch_id=branch_id,
        start_date=start_date,
        end_date=end_date
    )

    # Serialize SQLAlchemy objects to JSON-compatible dictionaries
    serialized_reports = serialize_query_results(reports)

    return {
        "data": serialized_reports,
        "total": total,
        "page": skip // limit + 1,
        "limit": limit,
        "totalPages": (total + limit - 1) // limit  # Ceiling division
    }

@router.get("/{report_id}", response_model=Report)
async def read_report(
    report_id: str = Path(..., title="The ID of the report to get"),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get a specific report by id.
    """
    report = await report_service.get_report_by_id(db, report_id=report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    # Optional: Add permission check if needed
    # For example, only allow users to view reports from their branches

    # Serialize SQLAlchemy object to JSON-compatible dictionary
    return serialize_sqlalchemy_obj(report)

@router.post("/", response_model=Report, status_code=status.HTTP_201_CREATED)
async def create_report(
    *,
    db: Session = Depends(deps.get_db),
    report_in: ReportCreate,
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Create new report.
    """
    # Check if branch exists and user has access to it
    branch = await branch_service.get_branch_by_id(db, branch_id=report_in.branchId)
    if not branch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")

    # Check if user has access to this branch (if needed)
    # This depends on your business logic

    try:
        report = await report_service.create_report(
            db=db, report_in=report_in, user_id=current_user.id
        )
        # Serialize SQLAlchemy object to JSON-compatible dictionary
        return serialize_sqlalchemy_obj(report)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.put("/{report_id}", response_model=Report)
async def update_report(
    *,
    db: Session = Depends(deps.get_db),
    report_id: str = Path(..., title="The ID of the report to update"),
    report_in: ReportUpdate,
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Update a report.
    """
    report = await report_service.get_report_by_id(db, report_id=report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    # Check if user can edit this report
    # For example, only allow the creator to edit, or only if status is DRAFT or REJECTED
    # Convert SQLAlchemy object to dictionary for safe comparison
    report_dict = serialize_sqlalchemy_obj(report)
    if report_dict["submittedBy"] != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to edit this report"
        )

    if report_dict["status"] not in ["DRAFT", "REJECTED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot edit report with status {report_dict['status']}"
        )

    updated_report = await report_service.update_report(
        db=db, db_report=report, report_in=report_in
    )
    # Serialize SQLAlchemy object to JSON-compatible dictionary
    return serialize_sqlalchemy_obj(updated_report)

@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    *,
    db: Session = Depends(deps.get_db),
    report_id: str = Path(..., title="The ID of the report to delete"),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Delete a report.
    """
    report = await report_service.get_report_by_id(db, report_id=report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    # Check if user can delete this report
    # Convert SQLAlchemy object to dictionary for safe comparison
    report_dict = serialize_sqlalchemy_obj(report)
    if report_dict["submittedBy"] != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to delete this report"
        )

    # Only allow deleting draft reports
    if report_dict["status"] != "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete report with status {report_dict['status']}"
        )

    success = await report_service.delete_report(db=db, report_id=report_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete report"
        )
    return None

@router.post("/{report_id}/submit", response_model=Report)
async def submit_report(
    *,
    db: Session = Depends(deps.get_db),
    report_id: str = Path(..., title="The ID of the report to submit"),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Submit a report for approval.
    """
    report = await report_service.get_report_by_id(db, report_id=report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    # Check if user can submit this report
    # Convert SQLAlchemy object to dictionary for safe comparison
    report_dict = serialize_sqlalchemy_obj(report)
    if report_dict["submittedBy"] != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to submit this report"
        )

    try:
        submitted_report = await report_service.submit_report(
            db=db, report_id=report_id, user_id=current_user.id
        )
        # Serialize SQLAlchemy object to JSON-compatible dictionary
        return serialize_sqlalchemy_obj(submitted_report)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/{report_id}/approve", response_model=Report)
async def approve_report(
    *,
    db: Session = Depends(deps.get_db),
    report_id: str = Path(..., title="The ID of the report to approve"),
    comment: Optional[str] = Body(None, title="Optional approval comment"),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Approve a report.
    """
    report = await report_service.get_report_by_id(db, report_id=report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    # Check if user can approve reports (based on role)
    if current_user.role not in ["admin", "manager", "approver"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to approve reports"
        )

    try:
        approved_report = await report_service.approve_report(
            db=db, report_id=report_id, user_id=current_user.id, comment=comment
        )
        # Serialize SQLAlchemy object to JSON-compatible dictionary
        return serialize_sqlalchemy_obj(approved_report)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/{report_id}/reject", response_model=Report)
async def reject_report(
    *,
    db: Session = Depends(deps.get_db),
    report_id: str = Path(..., title="The ID of the report to reject"),
    comment: str = Body(..., title="Rejection reason (required)"),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Reject a report with a required comment.
    """
    report = await report_service.get_report_by_id(db, report_id=report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    # Check if user can reject reports (based on role)
    if current_user.role not in ["admin", "manager", "approver"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to reject reports"
        )

    try:
        rejected_report = await report_service.reject_report(
            db=db, report_id=report_id, user_id=current_user.id, comment=comment
        )
        # Serialize SQLAlchemy object to JSON-compatible dictionary
        return serialize_sqlalchemy_obj(rejected_report)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/{report_id}/comments", response_model=List[ReportComment])
async def read_report_comments(
    report_id: str = Path(..., title="The ID of the report"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get comments for a specific report.
    """
    report = await report_service.get_report_by_id(db, report_id=report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    comments = await report_service.get_report_comments(
        db=db, report_id=report_id, skip=skip, limit=limit
    )
    # Serialize SQLAlchemy objects to JSON-compatible dictionaries
    return serialize_query_results(comments)

@router.post("/{report_id}/comments", response_model=ReportComment, status_code=status.HTTP_201_CREATED)
async def create_report_comment(
    *,
    db: Session = Depends(deps.get_db),
    report_id: str = Path(..., title="The ID of the report"),
    comment_in: ReportCommentCreate,
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Add a comment to a report.
    """
    report = await report_service.get_report_by_id(db, report_id=report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    try:
        comment = await report_service.add_report_comment(
            db=db, report_id=report_id, user_id=current_user.id, comment_in=comment_in
        )
        # Serialize SQLAlchemy object to JSON-compatible dictionary
        return serialize_sqlalchemy_obj(comment)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
