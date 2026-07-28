import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent


class FrontendContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.index = (PROJECT_ROOT / "static" / "index.html").read_text(encoding="utf-8")
        cls.app_js = (PROJECT_ROOT / "static" / "js" / "app.js").read_text(encoding="utf-8")
        cls.adapters_js = (PROJECT_ROOT / "static" / "js" / "adapters.js").read_text(
            encoding="utf-8"
        )

    def test_dashboard_has_required_operational_controls(self):
        for element_id in (
            "connectionIndicator",
            "lastUpdated",
            "refreshButton",
            "refreshInterval",
            "autoRefreshToggle",
            "themeButton",
        ):
            self.assertIn(f'id="{element_id}"', self.index)

    def test_dashboard_has_all_core_sections(self):
        for element_id in (
            "healthMetric",
            "healthMetricValue",
            "healthMetricNote",
            "cpuMetric",
            "memoryMetric",
            "diskMetric",
            "networkMetric",
            "uptimeMetric",
            "cpuChart",
            "networkChart",
            "processTableBody",
            "processDialog",
        ):
            self.assertIn(f'id="{element_id}"', self.index)

    def test_api_base_is_relative_and_not_localhost(self):
        self.assertIn('content="/api"', self.index)
        self.assertNotIn("127.0.0.1", self.index)
        self.assertNotIn("127.0.0.1", self.app_js)

    def test_refresh_lifecycle_handles_visibility_and_cleanup(self):
        self.assertIn('visibilitychange', self.app_js)
        self.assertIn('pagehide', self.app_js)
        self.assertIn('state.activeRequest', self.app_js)

    def test_frontend_accepts_the_canonical_pydantic_api_keys(self):
        for api_key in (
            "cpu_percent",
            "memory_percent",
            "usage_percent",
            "bytes_sent_total",
            "upload_bytes_per_sec",
            "monitoring_scope",
        ):
            self.assertIn(api_key, self.adapters_js)

    def test_frontend_process_limit_matches_backend_allowance(self):
        config_js = (PROJECT_ROOT / "static" / "js" / "config.js").read_text(
            encoding="utf-8"
        )
        routes_py = (PROJECT_ROOT / "app" / "api" / "routes.py").read_text(
            encoding="utf-8"
        )
        self.assertIn("processLimit: 500", config_js)
        self.assertIn("le=1000", routes_py)


if __name__ == "__main__":
    unittest.main()
