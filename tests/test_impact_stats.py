import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('impact_stats', ROOT / 'scripts/build-impact-stats.py')
impact = importlib.util.module_from_spec(spec)
spec.loader.exec_module(impact)


def ball(batter, bowler, runs=1, wicket=None, extras=None):
    item = {'batter': batter, 'bowler': bowler, 'non_striker': 'NS',
            'runs': {'batter': runs, 'extras': sum((extras or {}).values()), 'total': runs + sum((extras or {}).values())}}
    if extras:
        item['extras'] = extras
    if wicket:
        item['wickets'] = [{'player_out': batter, 'kind': wicket}]
    return item


def innings(team, batter, bowler, runs_per_ball, overs=20, target=None, wickets_at=()):
    data = {'team': team, 'overs': []}
    for n in range(overs):
        deliveries = [ball(batter, bowler, runs_per_ball, 'bowled' if (n, i) in wickets_at else None) for i in range(6)]
        data['overs'].append({'over': n, 'deliveries': deliveries})
    if target:
        data['target'] = {'overs': 20, 'runs': target}
    return data


def match(first, second, outcome, date='2025-04-01'):
    return {'info': {'dates': [date], 'teams': ['A', 'B'], 'outcome': outcome}, 'innings': [first, second]}


class ImpactTests(unittest.TestCase):
    def test_pressure_batting_rules(self):
        self.assertTrue(impact.pressure_batting(10, {'runs': 100, 'wickets': 2, 'balls': 60, 'target': 220}))
        self.assertFalse(impact.pressure_batting(10, {'runs': 150, 'wickets': 2, 'balls': 60, 'target': 220}))
        self.assertTrue(impact.pressure_batting(5, {'runs': 30, 'wickets': 3, 'balls': 30, 'target': None}))
        self.assertFalse(impact.pressure_batting(9, {'runs': 30, 'wickets': 3, 'balls': 54, 'target': None}))

    def test_close_matches(self):
        self.assertTrue(impact.close_match({'outcome': {'winner': 'A', 'by': {'runs': 14}}}))
        self.assertFalse(impact.close_match({'outcome': {'winner': 'A', 'by': {'runs': 15}}}))
        self.assertTrue(impact.close_match({'outcome': {'winner': 'B', 'by': {'wickets': 2}}}))
        self.assertTrue(impact.close_match({'outcome': {'result': 'tie', 'eliminator': 'A'}}))

    def test_build_counts_pressure_knocks_and_impact(self):
        # A bats first at 1 a ball (120). B chases 121 at 2 a ball and wins inside 11 overs.
        first = innings('A', 'Anchor', 'Quick', 1)
        chase = innings('B', 'Hitter', 'Slow', 2, overs=11, target=121)
        close_first = innings('A', 'Anchor', 'Quick', 1)
        close_chase = innings('B', 'Hitter', 'Slow', 1, overs=20, target=121, wickets_at={(19, 5)})
        washed = match(innings('A', 'Anchor', 'Quick', 6), innings('B', 'Hitter', 'Slow', 6), {'result': 'no result'})
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'ipl_json.zip'
            with zipfile.ZipFile(path, 'w') as archive:
                archive.writestr('1.json', json.dumps(match(first, chase, {'winner': 'B', 'by': {'wickets': 10}})))
                archive.writestr('2.json', json.dumps(match(close_first, close_chase, {'winner': 'A', 'by': {'runs': 1}}, date='2025-04-03')))
                archive.writestr('3.json', json.dumps(washed))
            data = impact.build(path, 'ipl')
        hitter = data['all']['Hitter']['batting']
        self.assertEqual(hitter['balls'], 66 + 120, 'no-result matches are left out')
        self.assertEqual(hitter['winningKnocks'], 1, 'a 30+ run chase at SR 150+ that wins')
        self.assertEqual(hitter['bestKnocks'][0]['runs'], 132)
        self.assertGreater(hitter['pressure']['balls'], 0, 'the slow chase needed more than 10 an over late on')
        self.assertGreater(hitter['aboveExpectedPer100'], data['all']['Anchor']['batting']['aboveExpectedPer100'])
        anchor = data['all']['Anchor']['batting']
        self.assertEqual(anchor['winningKnocks'], 1, 'top score (30+) for the winning side')
        quick = data['all']['Quick']['bowling']
        self.assertEqual(quick['pressure']['balls'], 30, 'only the close match counts: its overs 16-20, not the 10-wicket win')
        slow = data['all']['Slow']['bowling']
        self.assertEqual(slow['pressure']['balls'], 30, 'overs 16-20 of the 1-run match')
        self.assertEqual(slow['pressure']['wickets'], 1)
        self.assertIsNotNone(slow['runsSavedPer24'])

    def test_entry_points_track_arrival_over_and_wickets(self):
        overs = []
        for n in range(4):
            deliveries = [ball('Opener', 'X', 1) for _ in range(6)]
            overs.append({'over': n, 'deliveries': deliveries})
        overs[2]['deliveries'][3] = ball('Opener', 'X', 0, wicket='bowled')   # 15th legal ball: 2.3 overs
        for i in range(4, 6):
            overs[2]['deliveries'][i] = ball('Three', 'X', 4)
        for i in range(6):
            overs[3]['deliveries'][i] = ball('Three', 'X', 1)
        first = {'team': 'A', 'overs': overs}
        second = innings('B', 'Chaser', 'Y', 6, overs=4, target=25)
        records = dict((name, r) for name, r in impact.entry_innings([('1', match(first, second, {'winner': 'B', 'by': {'wickets': 10}}))]) if name != 'NS')
        self.assertEqual((records['Opener']['over'], records['Opener']['wickets'], records['Opener']['out']), (0, 0, True))
        self.assertEqual((records['Three']['over'], records['Three']['wickets']), (2, 1), 'arrives in the 3rd over with 1 down')
        self.assertEqual((records['Three']['runs'], records['Three']['balls']), (14, 8))

    def test_entry_roles(self):
        role = impact.entry_role
        self.assertEqual(role({0: [8, 0, 0, 0], 1: [2, 0, 0, 0], 12: [2, 0, 0, 0]}), 'Top order')
        self.assertEqual(role({12: [6, 0, 0, 0], 16: [4, 0, 0, 0], 5: [3, 0, 0, 0]}), 'Finisher')
        self.assertEqual(role({5: [7, 0, 0, 0], 8: [3, 0, 0, 0], 0: [2, 0, 0, 0]}), 'Middle order')
        self.assertEqual(role({0: [4, 0, 0, 0], 6: [4, 0, 0, 0], 15: [4, 0, 0, 0]}), 'Floater')
        self.assertIsNone(role({0: [5, 0, 0, 0]}), 'needs 10+ innings')


if __name__ == '__main__':
    unittest.main()
