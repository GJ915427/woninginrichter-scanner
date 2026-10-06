"""Administrative provisioning Command Line Interface (CLI).

Commands:
    init-admin   Bootstrap the root system administrator account.
    create-user  Provision reviewer or administrator accounts.
"""

import argparse
import getpass
import sqlite3
import sys
from typing import List, Optional

from doc_review_app.config import settings
from doc_review_app.database import get_db, init_db
from doc_review_app.models import compute_initials
from doc_review_app.services import user_service
from doc_review_app.services.user_service import UserAlreadyExistsError


def build_parser() -> argparse.ArgumentParser:
    """Build command line argument parser with subcommands."""
    parser = argparse.ArgumentParser(
        prog="doc-review-cli",
        description="Document Review Web Application Administrative CLI",
    )
    parser.add_argument(
        "--db-path",
        default=None,
        help="Optional path to SQLite database file.",
    )

    subparsers = parser.add_subparsers(
        dest="command",
        title="commands",
        description="Available administrative commands",
    )

    # Subcommand: init-admin
    init_parser = subparsers.add_parser(
        "init-admin",
        help="Initialize root system administrator account.",
    )
    init_parser.add_argument(
        "-u",
        "--username",
        default=settings.admin_username,
        help=f"Admin username (default: {settings.admin_username})",
    )
    init_parser.add_argument(
        "-p",
        "--password",
        default=settings.admin_password,
        help="Admin password (default: configured default)",
    )
    init_parser.add_argument(
        "-n",
        "--full-name",
        default=settings.admin_full_name,
        help=f"Admin full name (default: {settings.admin_full_name})",
    )
    init_parser.add_argument(
        "-i",
        "--initials",
        default=None,
        help="Admin initials (derived from full name if not specified)",
    )
    init_parser.add_argument(
        "-e",
        "--email",
        default=settings.admin_email,
        help="Admin contact email address",
    )

    # Subcommand: create-user
    create_parser = subparsers.add_parser(
        "create-user",
        help="Create a new reviewer or administrator user account.",
    )
    create_parser.add_argument(
        "-u",
        "--username",
        required=False,
        help="User login username",
    )
    create_parser.add_argument(
        "-p",
        "--password",
        required=False,
        help="User login password",
    )
    create_parser.add_argument(
        "-n",
        "--full-name",
        required=False,
        help="User full display name",
    )
    create_parser.add_argument(
        "-i",
        "--initials",
        default=None,
        help="User initials (derived from full name if omitted)",
    )
    create_parser.add_argument(
        "-e",
        "--email",
        default=None,
        help="User contact email address",
    )
    create_parser.add_argument(
        "--admin",
        action="store_true",
        default=False,
        help="Grant administrator privileges to this user",
    )

    return parser


def handle_init_admin(args: argparse.Namespace) -> int:
    """Handle init-admin command execution."""
    db_path = getattr(args, "db_path", None)
    init_db(db_path)

    username = args.username.strip() if args.username else settings.admin_username
    password = args.password if args.password else settings.admin_password
    full_name = args.full_name.strip() if args.full_name else settings.admin_full_name
    initials = args.initials.strip() if args.initials else compute_initials(full_name=full_name, username=username)
    email = args.email.strip() if args.email else settings.admin_email

    with get_db(db_path) as db:
        existing = user_service.get_user_by_username(db, username)
        if existing:
            sys.stderr.write(f"Error: User '{username}' already exists.\n")
            return 1

        try:
            user = user_service.create_user(
                db=db,
                username=username,
                password=password,
                full_name=full_name,
                initials=initials,
                email=email,
                is_admin=True,
            )
        except (UserAlreadyExistsError, sqlite3.IntegrityError):
            sys.stderr.write(f"Error: User '{username}' already exists.\n")
            return 1

        sys.stdout.write(
            f"Admin user '{user.username}' (ID: {user.id}, Initials: {user.initials}) initialized successfully.\n"
        )
        return 0


def handle_create_user(args: argparse.Namespace) -> int:
    """Handle create-user command execution."""
    db_path = getattr(args, "db_path", None)
    init_db(db_path)

    username = args.username
    password = args.password
    full_name = args.full_name

    # Prompt interactively if missing and tty available
    if not username:
        if sys.stdin.isatty():
            username = input("Username: ").strip()
        else:
            sys.stderr.write("Error: Username is required.\n")
            return 1

    if not password:
        if sys.stdin.isatty():
            password = getpass.getpass("Password: ")
        else:
            sys.stderr.write("Error: Password is required.\n")
            return 1

    if not full_name:
        if sys.stdin.isatty():
            full_name = input("Full Name: ").strip()
        else:
            sys.stderr.write("Error: Full name is required.\n")
            return 1

    initials = args.initials
    if not initials or not initials.strip():
        initials = compute_initials(full_name=full_name, username=username)
    else:
        initials = initials.strip().upper()

    email = args.email.strip() if args.email else None
    is_admin = bool(args.admin)

    with get_db(db_path) as db:
        existing = user_service.get_user_by_username(db, username)
        if existing:
            sys.stderr.write(f"Error: User '{username}' already exists.\n")
            return 1

        try:
            user = user_service.create_user(
                db=db,
                username=username,
                password=password,
                full_name=full_name,
                initials=initials,
                email=email,
                is_admin=is_admin,
            )
        except (UserAlreadyExistsError, sqlite3.IntegrityError):
            sys.stderr.write(f"Error: User '{username}' already exists.\n")
            return 1

        role = "Administrator" if is_admin else "Reviewer"
        sys.stdout.write(
            f"User '{user.username}' (ID: {user.id}, Initials: {user.initials}, Role: {role}) created successfully.\n"
        )
        return 0


def main(argv: Optional[List[str]] = None) -> int:
    """CLI application entrypoint."""
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "init-admin":
        return handle_init_admin(args)
    elif args.command == "create-user":
        return handle_create_user(args)
    else:
        parser.print_help(sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
