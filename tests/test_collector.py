import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app import collector
from app.app import app


class CollectorTests(unittest.TestCase):
    def tearDown(self):
        collector._last_network_sample = None

    def test_memory_keeps_legacy_fields_and_adds_raw_values(self):
        memory = SimpleNamespace(
            total=8 * 1024**3,
            used=3 * 1024**3,
            available=5 * 1024**3,
            cached=1024**3,
            buffers=128 * 1024**2,
            percent=37.5,
        )
        with patch.object(collector.psutil, "virtual_memory", return_value=memory):
            result = collector.get_memory()

        self.assertEqual(result["占用率"], 37.5)
        self.assertEqual(result["total_bytes"], 8 * 1024**3)
        self.assertEqual(result["memory_percent"], 37.5)
        self.assertEqual(result["used_bytes"], 3 * 1024**3)
        self.assertIn("MB", result["总计"])

    def test_network_rates_use_counter_delta_without_sleeping(self):
        first = SimpleNamespace(bytes_sent=1000, bytes_recv=2000)
        second = SimpleNamespace(bytes_sent=1200, bytes_recv=2600)
        with (
            patch.object(collector.psutil, "net_io_counters", side_effect=[first, second]),
            patch.object(collector.time, "monotonic", side_effect=[10.0, 12.0]),
        ):
            initial = collector.get_network()
            current = collector.get_network()

        self.assertEqual(initial["upload_bytes_per_second"], 0)
        self.assertEqual(initial["download_bytes_per_second"], 0)
        self.assertEqual(current["upload_bytes_per_second"], 100)
        self.assertEqual(current["download_bytes_per_second"], 300)
        self.assertEqual(current["upload_bytes_per_sec"], 100)
        self.assertEqual(current["download_bytes_per_sec"], 300)

    def test_network_counter_reset_never_returns_negative_rate(self):
        collector._last_network_sample = (10.0, 5000, 8000)
        reset = SimpleNamespace(bytes_sent=100, bytes_recv=200)
        with (
            patch.object(collector.psutil, "net_io_counters", return_value=reset),
            patch.object(collector.time, "monotonic", return_value=12.0),
        ):
            result = collector.get_network()

        self.assertEqual(result["upload_bytes_per_second"], 0)
        self.assertEqual(result["download_bytes_per_second"], 0)

    def test_disks_have_root_fallback_when_container_only_lists_file_mounts(self):
        partition = SimpleNamespace(
            device="/dev/example",
            mountpoint="/etc/hosts",
            fstype="xfs",
        )
        usage = SimpleNamespace(total=1000, used=400, free=600, percent=40)
        with (
            patch.object(collector.psutil, "disk_partitions", return_value=[partition]),
            patch.object(collector.psutil, "disk_usage", return_value=usage),
            patch.object(collector.os.path, "isdir", return_value=False),
        ):
            result = collector.get_disks()

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["mountpoint"], "/")
        self.assertEqual(result[0]["free_bytes"], 600)
        self.assertEqual(result[0]["usage_percent"], 40)

    def test_disks_ignore_read_only_loop_images(self):
        root = SimpleNamespace(device="/dev/root", mountpoint="/", fstype="ext4")
        snap = SimpleNamespace(
            device="/dev/loop3",
            mountpoint="/snap/example/1",
            fstype="squashfs",
        )
        usage = SimpleNamespace(total=1000, used=400, free=600, percent=40)
        with (
            patch.object(collector.psutil, "disk_partitions", return_value=[root, snap]),
            patch.object(collector.psutil, "disk_usage", return_value=usage),
            patch.object(collector.os.path, "isdir", return_value=True),
        ):
            result = collector.get_disks()

        self.assertEqual([disk["mountpoint"] for disk in result], ["/"])

    def test_system_summary_exposes_runtime_context(self):
        result = collector.get_system()
        required = {
            "hostname",
            "os",
            "kernel",
            "logical_cores",
            "load_average",
            "boot_time",
            "uptime_seconds",
            "python_version",
            "environment",
            "process_count",
        }
        self.assertTrue(required.issubset(result))
        self.assertGreaterEqual(result["uptime_seconds"], 0)

    def test_existing_api_paths_are_preserved(self):
        paths = {route.path for route in app.routes}
        expected = {
            "/",
            "/api/cpu",
            "/api/memory",
            "/api/disks",
            "/api/network",
            "/api/processes",
            "/api/system",
        }
        self.assertTrue(expected.issubset(paths))

        monitored_routes = {
            route.path: route for route in app.routes if route.path.startswith("/api/")
        }
        for path in expected - {"/"}:
            self.assertIsNotNone(monitored_routes[path].response_model)


if __name__ == "__main__":
    unittest.main()
