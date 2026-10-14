import click
from flask.cli import with_appcontext

from app.extensions import db
from app.models import User, SUPER_ADMIN
from app.utils.security import hash_password, validate_password_strength


@click.command("create-superadmin")
@click.option("--first-name", prompt="First name")
@click.option("--second-name", prompt="Second name", default="")
@click.option("--email", prompt="Login email (e.g. you@smartmarksolutions.com)")
@click.password_option(prompt="Password")
@with_appcontext
def create_superadmin(first_name, second_name, email, password):
    """Create the platform Super Admin (the developer account)."""
    email = email.strip().lower()
    errs = validate_password_strength(password)
    if errs:
        raise click.ClickException(" ".join(errs))
    if User.query.filter_by(smartmark_email=email).first():
        raise click.ClickException("An account with that email already exists.")
    db.session.add(User(role=SUPER_ADMIN, school_id=None, first_name=first_name.strip(), second_name=second_name.strip() or None,
                        smartmark_email=email, password_hash=hash_password(password), must_change_password=False))
    db.session.commit()
    click.echo(f"Super Admin created. Sign in with {email}")
