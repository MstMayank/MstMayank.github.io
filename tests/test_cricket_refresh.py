import copy
from datetime import date
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('refresh', Path(__file__).resolve().parents[1] / 'scripts/refresh-cricket.py')
refresh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(refresh)


def fixture():
    return {'info': {'team_type': 'international', 'match_type': 'T20', 'teams': ['A', 'B'], 'dates': ['2025-02-03'], 'gender': 'female', 'season': '2025', 'outcome': {'winner': 'A'}, 'registry': {'people': {'Batter': 'p1', 'Bowler': 'p2'}}},
            'innings': [{'team': 'A', 'penalty_runs': {'pre': 5, 'post': 5}, 'overs': [{'over': 0, 'deliveries': [
                {'batter': 'Batter', 'bowler': 'Bowler', 'runs': {'batter': 4, 'total': 4}},
                {'batter': 'Batter', 'bowler': 'Bowler', 'runs': {'batter': 0, 'total': 2}, 'extras': {'byes': 2}},
                {'batter': 'Batter', 'bowler': 'Bowler', 'runs': {'batter': 0, 'total': 1}, 'extras': {'wides': 1}},
                {'batter': 'Batter', 'bowler': 'Bowler', 'runs': {'batter': 0, 'total': 0}, 'wickets': [{'kind': 'run out', 'player_out': 'Batter'}]},
                {'batter': 'Batter', 'bowler': 'Bowler', 'runs': {'batter': 0, 'total': 0}, 'wickets': [{'kind': 'caught', 'player_out': 'Batter'}]}
            ]}]}]}


class RefreshTests(unittest.TestCase):
    def test_innings_totals_and_bowler_attribution(self):
        key, rows, people = refresh.match_rows(fixture(), '123', date(2026, 1, 1))
        self.assertEqual(key, 'T20I')
        self.assertEqual(next(r for r in rows if r[0] == 'Team totals')[4], 17)
        self.assertEqual(next(r for r in rows if r[0] == 'Batting')[4], 4)
        self.assertEqual(next(r for r in rows if r[0] == 'Bowling')[4:6], [1, 5])
        self.assertTrue(all(r[12] == '123' for r in rows))

    def test_super_over_does_not_inflate_regular_score(self):
        match = fixture()
        extra = copy.deepcopy(match['innings'][0])
        extra['super_over'] = True
        match['innings'].append(extra)
        self.assertEqual(len(refresh.match_rows(match, '123', date(2026, 1, 1))[1]), 3)

    def test_club_future_and_unfinished_matches_are_skipped(self):
        for field, value in [('team_type', 'club'), ('dates', ['2028-01-01']), ('outcome', {})]:
            match = fixture()
            match['info'][field] = value
            self.assertIsNone(refresh.match_rows(match, '123', date(2026, 1, 1)))

    def test_all_international_t20_names_are_supported(self):
        for name in ['T20', 'IT20', 'T20I']:
            info = fixture()['info']
            info['match_type'] = name
            self.assertEqual(refresh.match_format(info), 'T20I')

    def test_merge_replaces_corrections_without_duplicates(self):
        _, rows, people = refresh.match_rows(fixture(), '123', date(2026, 1, 1))
        old = {'matches': 1, 'rows': [r[:11] for r in rows], 'aliases': {}}
        first = refresh.merge_archive(old, {'123': (rows, people)})
        second = refresh.merge_archive(first, {'123': (rows, people)})
        self.assertEqual(first, second)
        self.assertEqual(len(second['rows']), 3)
        corrected = copy.deepcopy(rows)
        corrected[0][4] = 20
        third = refresh.merge_archive(second, {'123': (corrected, people)})
        self.assertEqual(next(r for r in third['rows'] if r[0] == 'Team totals')[4], 20)
        self.assertEqual(third['matches'], 1)

    def test_preserves_uncovered_scorecards_and_same_day_matches(self):
        _, rows, people = refresh.match_rows(fixture(), '123', date(2026, 1, 1))
        extra = copy.deepcopy(rows)
        for row in extra:
            row[12] = '456'
        old_rows = copy.deepcopy(rows)
        for row in old_rows:
            row[6] = '2025-01-01'
            row[12] = '789'
        merged = refresh.merge_archive({'matches': 1, 'rows': old_rows, 'aliases': {}}, {'123': (rows, people), '456': (extra, people)})
        self.assertEqual(merged['matches'], 3)
        self.assertEqual(len(merged['rows']), 9)

    def test_history_uses_achievement_date_and_never_fabricates_records(self):
        row = ['Batting', 'Batter', 'A', 'B', 150, 0, '2025-02-03', 'female', '', '2025', 'p1', '', '123', 1, '2025-02-03']
        archives = {'ODI': {'rows': [row], 'aliases': {}}, 'T20I': {'rows': [], 'aliases': {}}}
        result = refresh.history(archives, [], date(2026, 2, 3))
        self.assertEqual(result['days']['02-03'][0]['date'], '2025-02-03')
        self.assertIn('150', result['days']['02-03'][0]['summary'])
        self.assertNotIn('record', result['days']['02-03'][0]['summary'])
        row[14] = '2025-02-04'
        self.assertEqual(refresh.history(archives, [], date(2026, 2, 3))['days'], {})

    def test_final_uses_completion_day_and_correct_winner(self):
        match = fixture()
        match['info']['event'] = {'name': 'World Cup', 'stage': 'Final'}
        match['info']['dates'] = ['2025-02-03', '2025-02-04']
        match['info']['outcome']['by'] = {'runs': 12}
        event = refresh.match_history(match, date(2026, 1, 1))
        self.assertEqual(event['date'], '2025-02-04')
        self.assertEqual(event['title'], 'A win World Cup')
        self.assertIn('by 12 runs', event['summary'])
        match['info']['event']['stage'] = 'Semi Final'
        self.assertIsNone(refresh.match_history(match, date(2026, 1, 1)))

    def test_archive_roundtrip_and_corruption_detection(self):
        data = {'matches': 1, 'rows': [['sample']], 'aliases': {}}
        with tempfile.TemporaryDirectory() as temp:
            p = Path(temp) / 'archive.bin'
            p.write_bytes(refresh.encode_archive('ODI', data))
            self.assertEqual(refresh.load_archive(p), data)
            p.write_text('not a valid download')
            with self.assertRaises(ValueError):
                refresh.load_archive(p)


if __name__ == '__main__':
    unittest.main()
