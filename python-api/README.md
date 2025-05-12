# LC Reports Python API

This is the Python FastAPI backend for the LC Reports application. It provides a RESTful API for managing users, branches, reports, and comments.

## Features

- JWT-based authentication
- User management with role-based access control
- Branch management
- Report creation, submission, approval, and rejection
- Comment system for reports
- Database migrations with Alembic

## Project Structure

```
python-api/
├── alembic/                  # Database migration scripts
├── app/
│   ├── api/                  # API routes and dependencies
│   │   ├── endpoints/        # API endpoint modules
│   │   │   ├── auth.py       # Authentication endpoints
│   │   │   ├── branches.py   # Branch management endpoints
│   │   │   ├── reports.py    # Report management endpoints
│   │   │   └── users.py      # User management endpoints
│   │   ├── deps.py           # Dependency injection functions
│   │   └── router.py         # Main API router
│   ├── core/                 # Core functionality
│   │   ├── config.py         # Application configuration
│   │   └── security.py       # Security utilities
│   ├── db/                   # Database models and session
│   │   ├── models/           # SQLAlchemy models
│   │   ├── base_class.py     # Base model class
│   │   └── session.py        # Database session management
│   ├── schemas/              # Pydantic schemas
│   ├── services/             # Business logic services
│   └── main.py               # Application entry point
├── alembic.ini               # Alembic configuration
└── README.md                 # This file
```

## Getting Started

### Prerequisites

- Python 3.8+
- PostgreSQL database

### Installation

1. Clone the repository
2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the `python-api` directory with the following variables:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/lc_reports
   SECRET_KEY=your-secret-key-here
   CORS_ORIGINS=http://localhost:3000,http://localhost:8000
   ```

### Database Setup

1. Create a PostgreSQL database:
   ```bash
   createdb lc_reports
   ```
2. Run database migrations:
   ```bash
   cd python-api
   alembic upgrade head
   ```

### Running the API

```bash
cd python-api
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at http://localhost:8000. You can access the interactive API documentation at http://localhost:8000/docs.

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login with form data
- `POST /api/auth/login/json` - Login with JSON payload
- `GET /api/auth/me` - Get current user information

### Users

- `GET /api/users/` - List users
- `POST /api/users/` - Create user
- `GET /api/users/{user_id}` - Get user by ID
- `PUT /api/users/{user_id}` - Update user
- `DELETE /api/users/{user_id}` - Delete user

### Branches

- `GET /api/branches/` - List branches
- `GET /api/branches/my-branches` - List branches assigned to current user
- `GET /api/branches/{branch_id}` - Get branch by ID
- `POST /api/branches/` - Create branch (admin only)
- `PUT /api/branches/{branch_id}` - Update branch (admin only)
- `DELETE /api/branches/{branch_id}` - Delete branch (admin only)
- `POST /api/branches/{branch_id}/assign-user/{user_id}` - Assign user to branch
- `DELETE /api/branches/{branch_id}/remove-user/{user_id}` - Remove user from branch

### Reports

- `GET /api/reports/` - List reports
- `GET /api/reports/my-reports` - List reports created by current user
- `GET /api/reports/approvals` - List reports for approval
- `GET /api/reports/{report_id}` - Get report by ID
- `POST /api/reports/` - Create report
- `PUT /api/reports/{report_id}` - Update report
- `DELETE /api/reports/{report_id}` - Delete report
- `POST /api/reports/{report_id}/submit` - Submit report for approval
- `POST /api/reports/{report_id}/approve` - Approve report
- `POST /api/reports/{report_id}/reject` - Reject report
- `GET /api/reports/{report_id}/comments` - List comments for a report
- `POST /api/reports/{report_id}/comments` - Add comment to a report

## Development

### Creating Database Migrations

After making changes to the database models, create a new migration:

```bash
cd python-api
alembic revision --autogenerate -m "Description of changes"
```

Then apply the migration:

```bash
alembic upgrade head
```

### Running Tests

```bash
cd python-api
pytest
```

## License

This project is licensed under the MIT License.
