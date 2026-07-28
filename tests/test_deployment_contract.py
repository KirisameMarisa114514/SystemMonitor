import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent


class DeploymentContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.compose = (PROJECT_ROOT / "docker-compose.yml").read_text(encoding="utf-8")

    def test_compose_uses_linux_host_namespaces(self):
        for setting in (
            "network_mode: host",
            "pid: host",
            "uts: host",
            'MONITOR_HOST_MODE: "1"',
        ):
            self.assertIn(setting, self.compose)
        self.assertNotIn("ports:", self.compose)

    def test_host_mode_keeps_container_hardening(self):
        for setting in (
            "read_only: true",
            "cap_drop:",
            "- ALL",
            "cap_add:",
            "- NET_BIND_SERVICE",
            "no-new-privileges:true",
        ):
            self.assertIn(setting, self.compose)


if __name__ == "__main__":
    unittest.main()
