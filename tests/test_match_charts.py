import importlib.util
import json
import random
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('match_charts', ROOT / 'scripts/build-match-charts.py')
charts = importlib.util.module_from_spec(spec)
spec.loader.exec_module(charts)


def ball(runs=1, wicket=False, extras=None, batter='A', bowler='X'):
    item = {'batter': batter, 'bowler': bowler, 'non_striker': 'B',
            'runs': {'batter': runs, 'extras': sum((extras or {}).values()), 'total': runs + sum((extras or {}).values())}}
    if extras:
        item['extras'] = extras
    if wicket:
        item['wickets'] = [{'player_out': batter, 'kind': 'caught', 'fielders': [{'name': 'F'}]}]
    return item


def innings(team, per_ball, overs, target=None):
    data = {'team': team, 'overs': [{'over': n, 'deliveries': [ball(per_ball) for _ in range(6)]} for n in range(overs)]}
    if target:
        data['target'] = {'overs': 20, 'runs': target}
    return data


def match(first, second, outcome, date='2025-04-01'):
    return {'info': {'dates': [date], 'teams': ['Kings XI Punjab', 'B'], 'venue': 'Wankhede Stadium, Mumbai', 'city': 'Mumbai',
                     'outcome': outcome, 'toss': {'winner': 'B', 'decision': 'field'}, 'event': {'name': 'IPL', 'match_number': 3}},
            'innings': [first, second]}


class MatchChartTests(unittest.TestCase):
    def test_probability_edges(self):
        coef = [0.0] * 5
        self.assertEqual(charts.probability(coef, 0, 10, 5), 1.0, 'target reached')
        self.assertEqual(charts.probability(coef, 5, 0, 5), 0.0, 'out of balls')
        self.assertEqual(charts.probability(coef, 5, 10, 0), 0.0, 'all out')
        self.assertAlmostEqual(charts.probability(coef, 5, 10, 5), 0.5)

    def test_fit_learns_that_easier_chases_win(self):
        rng = random.Random(4)
        samples = []
        for _ in range(3000):
            need, left, wih = rng.randint(1, 200), rng.randint(1, 120), rng.randint(1, 10)
            rate = need / left * 6
            won = rng.random() < (0.85 if rate < 8 and wih > 4 else 0.15)
            samples.append((charts.features(need, left, wih), 1.0 if won else 0.0))
        coef = charts.fit(samples)
        self.assertGreater(charts.probability(coef, 30, 60, 8), 0.6)
        self.assertLess(charts.probability(coef, 120, 30, 3), 0.4)

    def test_chase_states_and_label(self):
        m = match(innings('Kings XI Punjab', 1, 20), innings('B', 2, 11, target=121), {'winner': 'B', 'by': {'wickets': 10}})
        won, states = charts.chase_states(m)
        self.assertTrue(won)
        self.assertEqual(states[0], (121, 120, 10))
        self.assertEqual(states[6], (121 - 12, 114, 10))
        rain = match(innings('Kings XI Punjab', 1, 20), innings('B', 2, 11, target=121), {'winner': 'B', 'by': {'wickets': 10}, 'method': 'D/L'})
        self.assertIsNone(charts.chase_states(rain)[0], 'rain-reduced chases are not used for the model')

    def test_match_data_flags_scorecard_and_files(self):
        first = innings('Kings XI Punjab', 1, 2)
        first['overs'][0]['deliveries'][2] = ball(0, wicket=True)
        first['overs'][1]['deliveries'].append(ball(0, extras={'wides': 1}))
        m = match(first, innings('B', 2, 2, target=14), {'winner': 'B', 'by': {'wickets': 10}})
        data = charts.match_data('77', m)
        self.assertEqual(data['teams'][0], 'Punjab Kings', 'renamed teams are combined')
        self.assertEqual(data['event'], 'Match 3')
        balls = data['innings'][0]['balls']
        self.assertEqual(balls[6:9], [0, 0, 3], 'over 0, no runs, legal + wicket')
        self.assertEqual(balls[-3:], [1, 1, 0], 'a wide is not a legal ball')
        self.assertEqual(data['innings'][0]['wickets'][0][:3], [2, 'A', 'caught'])
        self.assertEqual(data['innings'][1]['target'], 14)
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'ipl_json.zip'
            with zipfile.ZipFile(path, 'w') as archive:
                archive.writestr('77.json', json.dumps(m))
            payload, _ = charts.build(path, 'ipl', out_root=Path(temp))
            season = json.loads((Path(temp) / 'matches/ipl/2025.json').read_text())
        self.assertIn('77', season['matches'])
        self.assertEqual(payload['matches'][0][:3], ['77', '2025-04-01', '2025'])
        self.assertEqual(len(payload['winModel']['coef']), 5)


if __name__ == '__main__':
    unittest.main()
