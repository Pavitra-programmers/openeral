"""Offline privacy/resource regressions for the sandbox's embedded parser."""
import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

SKILL = Path(__file__).resolve().parents[1] / '.claude/skills/excel-report/SKILL.md'
namespace = {}
source = SKILL.read_text(encoding='utf-8').split("cat << 'EOF' > /tmp/openrind-excel-parse.py\n", 1)[1].split('\nEOF', 1)[0]
with contextlib.redirect_stdout(io.StringIO()):
    exec(compile(source.split('target_files = sys.argv[1:]')[0], str(SKILL), 'exec'), namespace)


class ParserSafetyTests(unittest.TestCase):
    def test_values_under_innocent_headers_never_escape(self):
        values = ['password=fixture-secret', 'person@example.test', 4111111111111111]
        result = namespace['analyze_matrix']([['notes'], *[[value] for value in values]])
        rendered = json.dumps(result)
        for value in values:
            self.assertNotIn(str(value), rendered)
        self.assertEqual(result['total_rows'], 3)
        self.assertTrue(result['columns']['notes']['values_withheld'])

    def test_oversized_csv_rejected_before_read(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'large.csv'
            with path.open('wb') as file:
                file.truncate(namespace['MAX_FILE'] + 1)
            with self.assertRaisesRegex(ValueError, '10 MiB'):
                namespace['read_csv'](path)

    def test_zip_expansion_is_bounded(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'expanded.xlsx'
            with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as archive:
                archive.writestr('xl/workbook.xml', 'x' * 100000)
            with self.assertRaisesRegex(ValueError, 'ZIP expansion'):
                namespace['read_xlsx'](path)

    def test_sparse_dimensions_and_csv_columns_are_bounded(self):
        with self.assertRaises(ValueError):
            namespace['check_shape'](1, 16384)
        with self.assertRaises(ValueError):
            namespace['check_shape'](10000, 256)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'wide.csv'
            path.write_text(','.join(['x'] * 257))
            with self.assertRaises(ValueError):
                namespace['read_csv'](path)


if __name__ == '__main__':
    unittest.main()
