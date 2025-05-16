import asyncio
import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.core.security import get_password_hash
from app.db.models import User

async def create_test_user():
    """Create a test user with a known password"""
    db = SessionLocal()
    try:
        # Create a test user with a known password
        username = "testuser"
        password = "password123"

        # Check if user already exists
        existing_user = db.query(User).filter(User.username == username).first()
        if existing_user:
            print(f"User {username} already exists with ID: {existing_user.id}")
            # Update password
            now = datetime.now(timezone.utc)
            from sqlalchemy import text
            stmt = text("""UPDATE "User" SET
                password = :password,
                "updatedAt" = :updated_at
                WHERE id = :user_id""")
            db.execute(stmt, {
                "password": get_password_hash(password),
                "updated_at": now,
                "user_id": existing_user.id
            })
            db.commit()
            print(f"Updated password for user {username}")
            return existing_user

        # Create a new user
        now = datetime.now(timezone.utc)
        user = User(
            id=str(uuid.uuid4()),  # Generate UUID for ID
            email=f"{username}@example.com",
            username=username,
            name="Test User",
            password=get_password_hash(password),
            role="user",
            isActive=True,
            failedLoginAttempts=0,
            updatedAt=now  # Add updatedAt field
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        print(f"Created test user with ID: {user.id}")
        print(f"Username: {username}")
        print(f"Password: {password}")

        return user
    except Exception as e:
        db.rollback()
        print(f"Error creating test user: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(create_test_user())
