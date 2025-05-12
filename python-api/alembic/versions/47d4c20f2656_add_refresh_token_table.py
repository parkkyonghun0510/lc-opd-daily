"""add_refresh_token_table

Revision ID: 47d4c20f2656
Revises: b12c97b5b604
Create Date: 2025-05-12 20:48:34.842559

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '47d4c20f2656'
down_revision = 'b12c97b5b604'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the RefreshToken table
    op.create_table(
        'RefreshToken',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('userId', sa.String(), nullable=False),
        sa.Column('token', sa.String(), nullable=False),
        sa.Column('expiresAt', sa.DateTime(), nullable=False),
        sa.Column('createdAt', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column('isRevoked', sa.Boolean(), nullable=False,
                  server_default=sa.text("FALSE")),
        sa.ForeignKeyConstraint(['userId'], ['User.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token')
    )
    op.create_index(op.f('ix_RefreshToken_id'), 'RefreshToken', ['id'], unique=False)
    op.create_index(op.f('ix_RefreshToken_userId'), 'RefreshToken', ['userId'], unique=False)


def downgrade() -> None:
    # Drop the RefreshToken table
    op.drop_index(op.f('ix_RefreshToken_userId'), table_name='RefreshToken')
    op.drop_index(op.f('ix_RefreshToken_id'), table_name='RefreshToken')
    op.drop_table('RefreshToken')
