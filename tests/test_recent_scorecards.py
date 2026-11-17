import copy
from datetime import date
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import urllib.error
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from recent_scorecards import candidate_leagues, parse_scorecard, get_scorecard, discovery_start

ROOT = Path(__file__).parent
TODAY = date(2026, 11, 17)

class RecentScorecardTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT / 'fixtures/recent-odi.json').read_text())

    def test_both_innings_verified_against_official_nz_scorecard(self):
        parsed = parse_scorecard(self.data, TODAY)
        totals = {r[2]: r[4] for r in parsed['rows'] if r[0] == 'Team totals'}
        self.assertEqual(totals, {'India': 209, 'New Zealand': 187})
        rohit = next(r for r in parsed['rows'] if r[0] == 'Batting' and r[1] == 'Rohit Sharma')
        self.assertEqual(rohit[4], 7)
        arshdeep = next(r for r in parsed['rows'] if r[0] == 'Bowling' and r[1] == 'Arshdeep Singh')
        self.assertEqual(arshdeep[4:6], [3, 30])
        self.assertEqual(parsed['date'], '2026-11-15')
        self.assertTrue(all(r[12] == '1539441' for r in parsed['rows']))
        self.assertTrue(all(r[15] == 'recent-scorecard' for r in parsed['rows']))

    def test_in_progress_and_future_results_are_not_imported(self):
        self.data['header']['competitions'][0]['status']['type']['state'] = 'in'
        self.assertIsNone(parse_scorecard(self.data, TODAY))
        self.data['header']['competitions'][0]['status']['type']['state'] = 'post'
        self.assertIsNone(parse_scorecard(self.data, date(2026, 11, 14)))

    def test_domestic_and_youth_are_not_international(self):
        self.data['header']['competitions'][0]['class']['internationalClassId'] = '5'
        self.assertIsNone(parse_scorecard(self.data, TODAY))

    def test_corrupt_or_incomplete_player_stats_fail_closed(self):
        self.data['header']['competitions'][0]['competitors'][1]['linescores'][0]['runs'] = 210
        with self.assertRaisesRegex(ValueError, 'extras'):
            parse_scorecard(self.data, TODAY)
        self.setUp()
        self.data['rosters'] = []
        with self.assertRaisesRegex(ValueError, 'Incomplete'):
            parse_scorecard(self.data, TODAY)

    def test_did_not_bat_and_substitutes_are_not_invented_scores(self):
        player = copy.deepcopy(self.data['rosters'][0]['roster'][0])
        player['athlete']['id'] = '99999'
        player['athlete']['displayName'] = 'Unused substitute'
        player['linescores'] = []
        self.data['rosters'][0]['roster'].append(player)
        parsed = parse_scorecard(self.data, TODAY)
        self.assertFalse(any(r[1] == 'Unused substitute' for r in parsed['rows']))

    def test_womens_internationals_are_included(self):
        self.data['header']['competitions'][0]['class']['internationalClassId'] = '9'
        parsed = parse_scorecard(self.data, TODAY)
        self.assertEqual(parsed['format'], 'ODI')
        self.assertTrue(all(r[7] == 'female' for r in parsed['rows']))

    def test_duplicate_roster_stats_are_rejected(self):
        self.data['rosters'][0]['roster'].append(self.data['rosters'][0]['roster'][0])
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            parse_scorecard(self.data, TODAY)

    def test_abandoned_without_play_has_no_fake_player_records(self):
        self.data['rosters'] = []
        for competitor in self.data['header']['competitions'][0]['competitors']:
            competitor['linescores'] = []
        self.assertEqual(parse_scorecard(self.data, TODAY)['rows'], [])

    def test_transient_delivery_error_uses_public_web_scorecard(self):
        unavailable = urllib.error.HTTPError('https://example.test', 502, 'Unavailable', {}, None)
        with patch('recent_scorecards.get_json', side_effect=[unavailable, self.data]) as request:
            self.assertEqual(get_scorecard('24467', '1539441'), self.data)
            self.assertIn('site.web.api.espn.com', request.call_args.args[0])

    def test_access_denial_is_not_retried_through_another_route(self):
        denied = urllib.error.HTTPError('https://example.test', 403, 'Denied', {}, None)
        with patch('recent_scorecards.get_json', side_effect=denied) as request:
            with self.assertRaises(urllib.error.HTTPError):
                get_scorecard('24467', '1539441')
            self.assertEqual(request.call_count, 1)

    def test_multi_day_tests_and_outage_catchup_stay_in_discovery_window(self):
        self.assertLessEqual(discovery_start({'scannedThrough': '2026-11-17'}, TODAY, 30), date(2026, 11, 13))
        self.assertLessEqual(discovery_start({'scannedThrough': '2026-10-20'}, TODAY, 30), date(2026, 10, 20))
        self.assertEqual(discovery_start({}, TODAY, 30), date(2026, 10, 18))

    def test_current_series_discovery_excludes_unofficial_and_youth(self):
        leagues = {'leagues': [{'id': str(i), 'name': name, 'season': {'endDate': '2026-11-15T23:59Z'}} for i, name in enumerate(['India in New Zealand ODI Series', 'India A unofficial Test Series', 'India Under-19s Youth ODI Series'])]}
        self.assertEqual(candidate_leagues(leagues, TODAY, date(2026, 10, 18)), ['0'])

if __name__ == '__main__':
    unittest.main()
