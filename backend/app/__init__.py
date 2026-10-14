from flask import Flask, jsonify

from app.config import Config
from app.extensions import db, migrate, jwt, cors, limiter


def create_app(config=Config):
    app = Flask(__name__)
    app.config.from_object(config)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    limiter.init_app(app)
    origins = app.config["CORS_ORIGINS"]
    cors.init_app(app, resources={r"/api/*": {"origins": "*" if origins == "*" else [o.strip() for o in origins.split(",")]}})

    from app import models  # noqa: F401
    from app.routes import auth, super_admin, accounts, academics, exams, marks, analytics, reports, dashboard, misc
    for m in (auth, super_admin, accounts, academics, exams, marks, analytics, reports, dashboard, misc):
        app.register_blueprint(m.bp)

    from app.cli import create_superadmin
    app.cli.add_command(create_superadmin)

    @jwt.unauthorized_loader
    def _missing(reason):
        return jsonify(error="Please sign in to continue.", code="AUTH_REQUIRED"), 401

    @jwt.invalid_token_loader
    def _invalid(reason):
        return jsonify(error="Your session is not valid. Please sign in again.", code="AUTH_REQUIRED"), 401

    @jwt.expired_token_loader
    def _expired(header, payload):
        return jsonify(error="Your session has expired. Please sign in again.", code="AUTH_REQUIRED"), 401

    @app.get("/api/health")
    def health():
        return jsonify(status="ok", app="SMARTMARK SOLUTIONS")

    @app.errorhandler(404)
    def _404(e):
        return jsonify(error="Not found."), 404

    @app.errorhandler(429)
    def _429(e):
        return jsonify(error="Too many attempts. Please wait a minute and try again."), 429

    @app.errorhandler(500)
    def _500(e):
        db.session.rollback()
        return jsonify(error="Something went wrong on our side. Please try again."), 500

    return app
