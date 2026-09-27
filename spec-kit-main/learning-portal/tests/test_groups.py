import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from app import create_app


class GroupTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app(
            {
                "TESTING": True,
                "DATABASE": ":memory:",
                "SECRET_KEY": "test-secret",
                "ADMIN_USERNAME": "root",
                "ADMIN_PASSWORD": "root-password",
            }
        )
        self.client = self.app.test_client()
        self.login("root", "root-password")
        self.create_user("teacher-one", "teacher")
        self.create_user("teacher-two", "teacher")
        self.create_user("student-one", "student")

    def login(self, username, password):
        return self.client.post("/login", data={"username": username, "password": password}, follow_redirects=True)

    def tearDown(self):
        self.app.extensions["memory_db"].close()

    def create_user(self, username, role):
        return self.client.post(
            "/admin/users/new",
            data={"full_name": username.title(), "username": username, "role": role, "password": "secure-pass"},
            follow_redirects=True,
        )

    def test_teacher_can_create_group_and_add_student(self):
        self.client.post("/logout")
        self.login("teacher-one", "secure-pass")
        response = self.client.post("/teacher/groups/new", data={"title": "9A Алгебра"}, follow_redirects=True)
        self.assertIn("Группа создана".encode(), response.data)
        with self.app.app_context():
            group_id = self.app.extensions["memory_db"].execute(
                "SELECT id FROM groups WHERE title = '9A Алгебра'"
            ).fetchone()[0]
            student_id = self.app.extensions["memory_db"].execute(
                "SELECT id FROM users WHERE username = 'student-one'"
            ).fetchone()[0]
        response = self.client.post(
            f"/teacher/groups/{group_id}/members", data={"student_id": student_id}, follow_redirects=True
        )
        self.assertIn("Студент добавлен в группу".encode(), response.data)
        self.assertIn("Student-One".encode(), response.data)

    def test_other_teacher_cannot_open_group(self):
        self.client.post("/logout")
        self.login("teacher-one", "secure-pass")
        self.client.post("/teacher/groups/new", data={"title": "Private group"})
        with self.app.app_context():
            group_id = self.app.extensions["memory_db"].execute(
                "SELECT id FROM groups WHERE title = 'Private group'"
            ).fetchone()[0]
        self.client.post("/logout")
        self.login("teacher-two", "secure-pass")
        self.assertEqual(403, self.client.get(f"/teacher/groups/{group_id}").status_code)


if __name__ == "__main__":
    unittest.main()
