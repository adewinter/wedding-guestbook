from flask import Flask
from dotenv import load_dotenv

import os
import boto3
from guestbook import dbops

load_dotenv()

ACCESS_KEY = os.getenv('AWS_ACCESS_KEY_ID')
SECRET_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
S3_BUCKET = os.getenv('S3_BUCKET')
S3_CLIENT = boto3.client('s3',
                         aws_access_key_id=ACCESS_KEY,
                         aws_secret_access_key=SECRET_KEY)
DATABASE_URL = os.getenv('DATABASE_URL')

CLOUDFLARE_API_KEY = os.getenv('CLOUDFLARE_API_KEY')
CLOUDFLARE_ACCOUNT_ID = os.getenv('CLOUDFLARE_ACCOUNT_ID')
CLOUDFLARE_EMAIL = os.getenv('CLOUDFLARE_EMAIL')


def create_app(test_config=None):
    """Create and configure an instance of the Flask application."""
    print("In create app...")

    app = Flask(__name__, instance_relative_config=True)
    dbops.init_app(app, DATABASE_URL)
    dbops.create_table_if_needed()
    app.config.from_mapping(
        # a default secret that should be overridden by instance config
        SECRET_KEY="dev",
        # store the database in the instance folder
        DATABASE=os.path.join(app.instance_path, "flaskr.sqlite"),
    )

    app.url_map.strict_slashes = False

    if test_config is None:
        # load the instance config, if it exists, when not testing
        app.config.from_pyfile("config.py", silent=True)
    else:
        # load the test config if passed in
        app.config.update(test_config)

    from guestbook import views

    app.register_blueprint(views.bp)

    return app
