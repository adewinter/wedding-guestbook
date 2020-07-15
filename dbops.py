import psycopg2 as pg
import os

DATABASE_URL = os.getenv('DATABASE_URL')

db_connection = pg.connect(DATABASE_URL)


def create_table_if_needed():
    with db_connection.cursor() as cursor:
        table_query = """
        CREATE TABLE IF NOT EXISTS guestbook (
        id integer primary key generated always as identity,
        created_at timestamp not null default now(),
        name text,
        message text,
        s3_object_key text
        )
        """
        cursor.execute(table_query)


def insert_row(name, message, s3_object_key):
    with db_connection.cursor() as cursor:
        insert_query = """
          INSERT INTO guestbook VALUES
            (DEFAULT, DEFAULT, %(name)s, %(message)s, %(s3_object_key)s);
        """
        cursor.execute(insert_query, {'name': name, 'message': message,
                                      's3_object_key': s3_object_key})

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
