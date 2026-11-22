import importlib.util
import json
import re
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('venue_stats', ROOT / 'scripts/build-venue-stats.py')
venue_stats = importlib.util.module_from_spec(spec)
spec.loader.exec_module(venue_stats)


def delivery(batter='A', bowler='X', runs=1, extras=None, wicket=None):
    item = {'batter': batter, 'bowler': bowler, 'non_striker': 'B',
            'runs': {'batter': runs, 'extras': sum((extras or {}).values()), 'total': runs + sum((extras or {}).values())}}
    if extras:
        item['extras'] = extras
    if wicket:
        item['wickets'] = [{'player_out': batter, 'kind': wicket}]
    return item


def innings(team, per_over, overs=20, super_over=False):
    data = {'team': team, 'overs': [{'over': n, 'deliveries': [delivery(runs=per_over) for _ in range(6)]} for n in range(overs)]}
    if super_over:
        data['super_over'] = True
    return data


def match(venue='Wankhede Stadium, Mumbai', first=6, second=5, outcome=None, season='2025', date='2025-04-01', toss=('Mumbai Indians', 'field'), extra_innings=()):
    return {'info': {'venue': venue, 'city': 'Mumbai', 'dates': [date], 'season': season, 'teams': ['Mumbai Indians', 'Delhi Daredevils'],
                     'outcome': outcome or {'winner': 'Mumbai Indians', 'by': {'runs': 20}},
                     'toss': {'winner': toss[0], 'decision': toss[1]}},
            'innings': [innings('Mumbai Indians', first), innings('Delhi Daredevils', second), *extra_innings]}


class VenueStatsTests(unittest.TestCase):
    def test_alias_list_matches_player_battle(self):
        source = (ROOT / 'player-battle.js').read_text(encoding='utf-8')
        block = re.search(r'const venueAliases = \[(.*?)\];', source, re.S).group(1)
        self.assertEqual(re.findall(r'"([^"]+)"', block), venue_stats.VENUE_ALIASES)

    def test_venue_names_are_merged(self):
        label = venue_stats.venue_label
        self.assertEqual(label('M.Chinnaswamy Stadium, Bengaluru'), 'M Chinnaswamy Stadium')
        self.assertEqual(label('Feroz Shah Kotla, Delhi'), 'Arun Jaitley Stadium')
        self.assertEqual(label('Subrata Roy Sahara Stadium, Pune'), 'Maharashtra Cricket Association Stadium')
        self.assertEqual(label('Kingsmead, Durban'), 'Kingsmead, Durban')

    def test_innings_summary_scores_and_phases(self):
        data = innings('Mumbai Indians', 1)
        data['overs'][0]['deliveries'].append(delivery(runs=0, extras={'wides': 1}))
        data['overs'][1]['deliveries'][0] = delivery(runs=0, extras={'legbyes': 4})
        data['overs'][19]['deliveries'][5] = delivery(runs=0, wicket='run out')
        summary = venue_stats.innings_summary(data)
        self.assertEqual(summary['runs'], 120 - 1 + 1 + 4 - 1)
        self.assertEqual(summary['balls'], 120)
        self.assertEqual(summary['at'][6], (6 * 6 - 1 + 1 + 4, 0))
        self.assertEqual([p['balls'] for p in summary['phases']], [36, 54, 30])
        self.assertEqual(summary['phases'][2]['wickets'], 1)
        self.assertEqual(summary['bowlers']['X']['wickets'], 0, 'run outs are not credited to the bowler')
        self.assertEqual(summary['bowlers']['X']['runs'], 120 - 1 + 1 - 1, 'wides count against the bowler, leg byes do not')
        self.assertEqual(summary['team'], 'Mumbai Indians')

    def test_results_ties_no_results_and_renamed_teams(self):
        tie = venue_stats.match_record('1', match(outcome={'result': 'tie', 'eliminator': 'Delhi Daredevils'},
                                                  extra_innings=[innings('Delhi Daredevils', 3, overs=1, super_over=True)]))
        self.assertEqual((tie['result'], tie['winner']), ('tie', 'Delhi Capitals'))
        self.assertEqual(len(tie['innings']), 2, 'super overs are left out')
        washed = venue_stats.match_record('2', match(outcome={'result': 'no result'}))
        self.assertEqual(washed['result'], 'no result')
        rain = venue_stats.match_record('3', match(outcome={'winner': 'Mumbai Indians', 'by': {'runs': 5}, 'method': 'D/L'}))
        self.assertTrue(rain['reduced'])

    def test_build_summarises_a_venue(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'ipl_json.zip'
            with zipfile.ZipFile(path, 'w') as archive:
                archive.writestr('1.json', json.dumps(match(first=6, second=5)))
                archive.writestr('2.json', json.dumps(match(first=5, second=7, date='2024-04-01', season='2024',
                                                            outcome={'winner': 'Delhi Daredevils', 'by': {'wickets': 5}}, toss=('Delhi Daredevils', 'bat'))))
                archive.writestr('3.json', json.dumps(match(outcome={'result': 'no result'}, date='2023-04-01', season='2023')))
                archive.writestr('4.json', json.dumps(match(venue='M.Chinnaswamy Stadium, Bangalore', date='2008-04-18', season='2008')))
                archive.writestr('README.txt', 'not a match')
            data = venue_stats.build(path, 'ipl')
        self.assertEqual(data['matches'], 4)
        self.assertEqual(data['recentSeasons'], ['2023', '2024', '2025'])
        wankhede = next(v for v in data['venues'] if v['slug'] == 'wankhede-stadium')
        summary = wankhede['all']
        self.assertEqual(summary['matches'], 3)
        self.assertEqual(summary['counted'], 2)
        self.assertEqual(summary['firstInnings']['average'], (720 + 600) / 2)
        self.assertEqual(summary['par']['6'], {'runs': (216 + 180) / 2, 'wickets': 0})
        self.assertEqual(summary['results']['chaseWins'], 1)
        self.assertEqual(summary['results']['chaseWinPct'], 50.0)
        self.assertEqual(summary['results']['noResult'], 1)
        self.assertEqual(summary['toss']['fieldFirstPct'], round(2 / 3 * 100, 1))
        self.assertEqual(summary['highest'][0]['runs'], 840)
        self.assertEqual(summary['teams'][0]['team'], 'Delhi Capitals')
        self.assertEqual(summary['topBatters'][0]['name'], 'A')
        self.assertEqual(wankhede['recent']['matches'], 3)
        self.assertEqual(next(v for v in data['venues'] if v['slug'] == 'm-chinnaswamy-stadium')['recent'], None)

    def test_team_stats_results_phases_and_squads(self):
        first = match()
        first['info']['players'] = {'Mumbai Indians': ['A', 'B'], 'Delhi Daredevils': ['X', 'Y']}
        second = match(date='2025-04-03', outcome={'winner': 'Delhi Daredevils', 'by': {'wickets': 3}})
        second['info']['players'] = {'Mumbai Indians': ['A', 'C'], 'Delhi Daredevils': ['X']}
        washed = match(date='2025-04-05', outcome={'result': 'no result'})
        records = [venue_stats.match_record(str(i), m) for i, m in enumerate([first, second, washed])]
        data = venue_stats.build_teams(records, 'ipl')
        mi = data['teams']['Mumbai Indians']
        self.assertEqual(mi['squad'], ['A', 'B', 'C'])
        season = mi['seasons']['2025']
        self.assertEqual((season['played'], season['won'], season['lost']), (3, 1, 1))
        self.assertEqual(season['batting'][0], {'runs': 2 * 216, 'balls': 72, 'wickets': 0, 'innings': 2}, 'no-result matches are left out of phase totals')
        self.assertEqual(season['bowling'][2]['runs'], 2 * 150)
        self.assertIn('Delhi Capitals', data['teams'])
        self.assertEqual(data['matches'][1][5:], ['Delhi Capitals', 'win', '3 wickets'])
        self.assertEqual(data['matches'][0][2], 'wankhede-stadium')


if __name__ == '__main__':
    unittest.main()
