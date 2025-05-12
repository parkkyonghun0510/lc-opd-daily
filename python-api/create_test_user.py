import asyncio
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.services.user_service import create_user
from app.schemas.user import UserCreate

async def create_test_admin():
    """Create a test admin user for testing purposes"""
    db = SessionLocal()
    try:
        # Create admin user
        admin_data = UserCreate(
            email="admin@example.com",
            username="admin",
            name="Admin User",
            password="password123",
            role="admin",
            isActive=True
        )
        
        try:
            user = await create_user(db=db, user_in=admin_data)
            print(f"Created admin user: {user.username} (ID: {user.id})")
        except Exception as e:
            print(f"Error creating admin user: {e}")
            print("User might already exist")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(create_test_admin())
