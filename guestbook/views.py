import os
import json
import uuid

from flask import render_template, request, redirect, url_for, Blueprint
from slugify import slugify

from guestbook import dbops, S3_BUCKET, S3_CLIENT

bp = Blueprint("guestbook", __name__)


# Listen for GET requests to yourdomain.com/account/
@bp.route("/")
def index():
    # Show the index HTML page:
    raw_entries = [dict(entry) for entry in dbops.get_all_entries()]
    entries = add_presigned_image_urls(raw_entries)
    return render_template('index.html', entries=entries)


def add_presigned_image_urls(entries):
    for entry in entries:
        entry['url'] = easy_generate_presigned_url(entry['s3_object_key'])
    return entries


def generate_s3_object_key(person_name, filename):
    folder = slugify(person_name)
    _, file_extension = os.path.splitext(filename)
    filename = f"{uuid.uuid1()}{file_extension}"
    return f"{folder}/{filename}"


# Listen for POST requests to yourdomain.com/submit_form/
@bp.route("/submit-form/", methods=["POST"])
def submit_form():
    # Collect the data posted from the HTML form in account.html:
    person_name = request.form["person-name"]
    message = request.form["message"]
    filename = request.form["filename"]
    filetype = request.form["filetype"]

    print("This is the form", request.form)

    if(filename == ''):
        s3_object_key = ''
    else:
        s3_object_key = generate_s3_object_key(person_name, filename)

    # persist the important bits
    dbops.insert_row(person_name, message, filename, filetype, s3_object_key)

    return json.dumps({
        "person-name": person_name,
        "message": message,
        "old_filename": filename,
        "filetype": filetype,
        "s3_object_key": s3_object_key
    })


def list_s3_objects():
    response = S3_CLIENT.list_objects_v2(
        Bucket=S3_BUCKET,
        # Prefix='string',
    )

    return response['Contents']


def generate_presigned_urls_for_all_objects():
    s3_objects = list_s3_objects()
    s3_keys = [s3_object["Key"] for s3_object in s3_objects]
    presigned_urls = [easy_generate_presigned_url(key) for key in s3_keys]

    return presigned_urls


@bp.route('/get-s3-objects')
def get_s3_objects():
    generate_presigned_urls_for_all_objects()
    return json.dumps(list_s3_objects(), indent=4, default=str)


def easy_generate_presigned_url(key):
    if not key:
        return ''

    presigned_url = S3_CLIENT.generate_presigned_url(
        ClientMethod='get_object',
        Params={
            "Bucket": S3_BUCKET,
            "Key": key,
        },
        ExpiresIn=3600
    )

    return presigned_url


@bp.route('/sign-s3/')
def sign_s3():
    # Load required data from the request
    file_name = request.args.get('file-name')
    file_type = request.args.get('file-type')

    # Generate and return the presigned URL
    presigned_post_data = S3_CLIENT.generate_presigned_post(
        Bucket=S3_BUCKET,
        Key=file_name,
        Fields={
            "Content-Type": file_type},
        Conditions=[
            {"Content-Type": file_type}
        ],
        ExpiresIn=3600
    )

    presigned_url = easy_generate_presigned_url(file_name)

    # Return the data to the client
    return json.dumps({
        's3Data': presigned_post_data,
        'presigned_url': presigned_url
    })


def startup_init():
    print("Doing initial setup tasks")
    dbops.create_table_if_needed()


# startup_init()


# Main code
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
