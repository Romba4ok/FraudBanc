import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from app import create_app


class AdminPanelTests(unittest.TestCase):
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

    def login(self, username="root", password="root-password"):
        return self.client.post("/login", data={"username": username, "password": password}, follow_redirects=True)

    def tearDown(self):
        self.app.extensions["memory_db"].close()

    def create_user(self, username, role="teacher"):
        return self.client.post(
            "/admin/users/new",
            data={"full_name": username.title(), "username": username, "role": role, "password": "secure-pass"},
            follow_redirects=True,
        )

    def test_admin_can_create_edit_and_delete_users(self):
        self.login()
        response = self.create_user("teacher-one")
        self.assertIn("Учётная запись создана".encode(), response.data)
        self.create_user("student-one", "student")

        with self.app.app_context():
            teacher_id = self.app.extensions["memory_db"].execute(
                "SELECT id FROM users WHERE username = 'teacher-one'"
            ).fetchone()[0]

        response = self.client.post(
            f"/admin/users/{teacher_id}/edit",
            data={"full_name": "Updated Teacher", "username": "teacher-updated", "password": "new-secret", "role": "teacher"},
            follow_redirects=True,
        )
        self.assertIn("Учётная запись обновлена".encode(), response.data)
        response = self.client.post(f"/admin/users/{teacher_id}/delete", follow_redirects=True)
        self.assertIn("Учётная запись удалена".encode(), response.data)

    def test_student_cannot_open_admin_panel(self):
        self.login()
        self.create_user("student-one", "student")
        self.client.post("/logout")
        self.login("student-one", "secure-pass")
        response = self.client.get("/admin/users")
        self.assertEqual(403, response.status_code)

    def test_last_admin_cannot_be_deleted(self):
        self.login()
        response = self.client.post("/admin/users/1/delete", follow_redirects=True)
        self.assertIn("Нельзя удалить последнего администратора".encode(), response.data)


if __name__ == "__main__":
    unittest.main()
