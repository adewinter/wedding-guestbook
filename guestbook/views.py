import os
import json

from flask import render_template, request, redirect, url_for, Blueprint

from guestbook import dbops, S3_BUCKET, S3_CLIENT

bp = Blueprint("guestbook", __name__)

# Listen for GET requests to yourdomain.com/account/
@bp.route("/")
def index():
    # Show the index HTML page:
    entries = dbops.get_all_entries()
    return render_template('index.html', entries=entries)


# Listen for POST requests to yourdomain.com/submit_form/
@bp.route("/submit-form/", methods=["POST"])
def submit_form():
    # Collect the data posted from the HTML form in account.html:
    name = request.form["name"]
    message = request.form["message"]
    s3_object_key = request.form["s3_object_key"]

    # Provide some procedure for storing the new details
    dbops.insert_row(name, message, s3_object_key)

    # Redirect to the user's profile page, if appropriate
    return redirect(url_for('index'))


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

    print("here are only the keys", s3_keys)
    print("Here are the P urls", presigned_urls)

    return presigned_urls


@bp.route('/get-s3-objects')
def get_s3_objects():
    generate_presigned_urls_for_all_objects()
    return json.dumps(list_s3_objects(), indent=4, default=str)


def easy_generate_presigned_url(key):
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
    presigned_post = S3_CLIENT.generate_presigned_post(
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

    print("the presigned url is: ", presigned_url)

    # Return the data to the client
    return json.dumps({
        'data': presigned_post,
        'url': 'https://%s.s3.amazonaws.com/%s' % (S3_BUCKET, file_name),
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
