import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('bowler_types', ROOT / 'scripts/build-bowler-types.py')
types = importlib.util.module_from_spec(spec)
spec.loader.exec_module(types)


def match(people, bowlers, gender='male'):
    return {'info': {'gender': gender, 'registry': {'people': people}},
            'innings': [{'overs': [{'over': 0, 'deliveries': [{'bowler': b} for b in bowlers]}]}]}


class BowlerTypeTests(unittest.TestCase):
    def test_classify_styles(self):
        cases = {
            'Right arm Fast': ('pace', 'right-pace'), 'Left arm Fast medium': ('pace', 'left-pace'),
            'Right-arm medium-fast': ('pace', 'right-pace'), 'Right arm Slow medium': ('pace', 'right-pace'),
            'Right arm Offbreak': ('spin', 'off-spin'), 'Legbreak Googly': ('spin', 'leg-spin'), 'Legbreak': ('spin', 'leg-spin'),
            'Slow Left arm Orthodox': ('spin', 'left-orthodox'), 'Left arm Wrist spin': ('spin', 'left-wrist'),
            'Right arm Medium, Right arm Offbreak': ('pace', 'right-pace'), 'Right arm Slow': ('spin', 'off-spin'),
            'Right arm Bowler': (None, None), '': (None, None), None: (None, None),
        }
        for style, expected in cases.items():
            self.assertEqual(types.classify(style), expected, style)

    def test_names_are_resolved_per_competition(self):
        with tempfile.TemporaryDirectory() as temp:
            ipl, t20s = Path(temp) / 'ipl_json.zip', Path(temp) / 't20s_json.zip'
            with zipfile.ZipFile(ipl, 'w') as z:
                z.writestr('1.json', json.dumps(match({'Rashid Khan': 'aa', 'JJ Bumrah': 'bb'}, ['Rashid Khan', 'JJ Bumrah'])))
            with zipfile.ZipFile(t20s, 'w') as z:
                z.writestr('2.json', json.dumps(match({'Rashid Khan': 'aa'}, ['Rashid Khan'])))
                z.writestr('3.json', json.dumps(match({'Rashid Khan': 'zz'}, ['Rashid Khan'])))
                z.writestr('4.json', json.dumps(match({'S Mandhana': 'cc'}, ['S Mandhana'], gender='female')))
            ids = types.bowler_ids([ipl, t20s])
        self.assertEqual(set(ids), {'ipl', 't20s_male', 't20s_female'})
        styles = {'aa': 'Legbreak Googly', 'bb': 'Right arm Fast', 'zz': 'Right arm Medium', 'cc': 'Right arm Offbreak'}
        players, by_comp, counts = types.build(styles, ids)
        self.assertEqual(players['JJ Bumrah']['sub'], 'right-pace')
        self.assertEqual(by_comp['ipl']['Rashid Khan']['sub'], 'leg-spin', 'unique within the IPL')
        self.assertEqual(by_comp['t20s_male']['Rashid Khan']['type'], 'unknown', 'two players share the name in T20Is')
        self.assertEqual(types.lookup(players, by_comp, 'ipl', 'Rashid Khan')['type'], 'spin')
        self.assertEqual(types.lookup(players, by_comp, 'ipl', 'Nobody')['type'], 'unknown')


if __name__ == '__main__':
    unittest.main()
