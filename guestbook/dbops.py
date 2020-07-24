import psycopg2 as pg
from psycopg2.extras import DictCursor
import os

DATABASE_URL = os.getenv('DATABASE_URL')

db_connection = pg.connect(DATABASE_URL, cursor_factory=DictCursor)
db_connection.set_session(autocommit=True)


def create_table_if_needed():
    print("In create table if needed()")
    with db_connection.cursor() as cursor:
        table_query = """
        CREATE TABLE IF NOT EXISTS guestbook (
        id integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        created_at timestamp not null default CURRENT_TIMESTAMP,
        name text,
        message text,
        filename text,
        filetype text,
        s3_object_key text,
        thumbnail_url text,
        cloudflare_uid text,
        cloudflare_status text
        );
        """
        cursor.execute(table_query)

        print("Cursor message:", cursor.statusmessage)
    print("Done with create table")


def insert_row(name, message, filename, filetype, s3_object_key, thumbnail_url='', cloudflare_uid=''):
    with db_connection.cursor() as cursor:
        insert_query = """
          INSERT INTO guestbook VALUES
            (DEFAULT, DEFAULT, %(name)s, %(message)s, %(filename)s, %(filetype)s, %(s3_object_key)s, %(thumbnail_url)s, %(cloudflare_uid)s, '');
        """
        cursor.execute(insert_query, {'name': name, 'message': message,
                                      'filename': filename,
                                      'filetype': filetype,
                                      's3_object_key': s3_object_key,
                                      'thumbnail_url': thumbnail_url,
                                      'cloudflare_uid': cloudflare_uid})

        result = cursor.statusmessage

    return result

def update_cloudflare_status(s3_object_key, thumbnail_url, cloudflare_uid, cloudflare_status):
    with db_connection.cursor() as cursor:
        update_query = """
            UPDATE guestbook
                SET thumbnail_url = %(thumbnail_url)s,
                    cloudflare_status = %(cloudflare_status)s,
                    cloudflare_uid = %(cloudflare_uid)s
                WHERE s3_object_key = %(s3_object_key)s;
        """
        cursor.execute(update_query, {'s3_object_key': s3_object_key,
                                      'cloudflare_uid': cloudflare_uid, 
                                      'thumbnail_url': thumbnail_url,
                                      'cloudflare_status': cloudflare_status})
        result = cursor.statusmessage

    return result

def get_all_entries():
    with db_connection.cursor() as cursor:
        select_query = """
            SELECT * from guestbook;
        """
        cursor.execute(select_query)
        result = cursor.fetchall()

    return result
