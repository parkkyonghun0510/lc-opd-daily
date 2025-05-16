import asyncio
import uuid
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.core.security import get_password_hash
from app.db.models import User

async def create_admin_user():
    """Create an admin user with a generated UUID"""
    db = SessionLocal()
    try:
        # Check if admin user already exists
        admin = db.query(User).filter(User.username == "admin").first()
        if admin:
            print(f"Admin user already exists with ID: {admin.id}")
            return admin
            
        # Create a new admin user with UUID
        admin_user = User(
            id=str(uuid.uuid4()),  # Generate UUID for ID
            email="admin@example.com",
            username="admin",
            name="Admin User",
            password=get_password_hash("admin123"),
            role="admin",
            isActive=True,
            failedLoginAttempts=0
        )
        
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        print(f"Created admin user with ID: {admin_user.id}")
        print(f"Username: admin")
        print(f"Password: admin123")
        
        return admin_user
    except Exception as e:
        db.rollback()
        print(f"Error creating admin user: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(create_admin_user())
