import importlib.util
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('player_pages', ROOT / 'scripts/build-player-pages.py')
pages = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pages)


def dataset():
    # Two matches. Player 0 bats, player 1 bowls; row layout as in battle-<competition>.json.
    return {
        'players': ['A Batter', 'B Bowler', 'C Other'],
        'venues': ['Ground, City'],
        'matches': [['2024', 0, '2024-04-01', ['Team A', 'Team B'], 'win', 'Team A', '1'],
                    ['2025', 0, '2025-04-01', ['Team A', 'Team B'], 'win', 'Team B', '2']],
        'rows': [
            # match bat bowl phase runs balls dots 4s 6s wkts conceded legal wd nb bdots outs
            [0, 0, 1, 0, 30, 20, 5, 4, 1, 1, 30, 20, 0, 0, 5, 1],
            [1, 0, 1, 2, 55, 25, 3, 5, 3, 0, 56, 25, 1, 0, 3, 0],
            [1, 2, 1, 1, 10, 12, 6, 1, 0, 2, 10, 12, 0, 0, 6, 2],
        ],
        'dismissals': [[0, 0, 1, 'bowled', 0, []]],
    }


class SlugTests(unittest.TestCase):
    def test_short_slug(self):
        self.assertEqual(pages.short_slug('Jasprit Jasbirsingh Bumrah'), 'jasprit-bumrah')
        self.assertEqual(pages.short_slug('Abraham Benjamin de Villiers'), 'abraham-de-villiers')
        self.assertEqual(pages.short_slug('MS Dhoni'), 'ms-dhoni')
        self.assertEqual(pages.slugify('Zoë Ström'), 'zoe-strom')


class StatsTests(unittest.TestCase):
    def test_batting_and_bowling(self):
        data = dataset()
        bat = pages.league_stats(data, 0)
        self.assertEqual(bat['batting']['runs'], 85)
        self.assertEqual(bat['batting']['innings'], 2)
        self.assertEqual(bat['batting']['outs'], 1)
        self.assertEqual(bat['batting']['highest'], '55*')
        self.assertEqual(bat['batting']['fifties'], 1)
        self.assertIsNone(bat['bowling'])
        self.assertEqual(bat['batPhases'][2][:3], [55, 25, 0])
        bowl = pages.league_stats(data, 1)
        self.assertIsNone(bowl['batting'])
        self.assertEqual(bowl['bowling']['wickets'], 3)
        self.assertEqual(bowl['bowling']['legal'], 57)
        self.assertEqual(bowl['bowling']['best'], '2/66')
        self.assertEqual([s for s, _ in bowl['seasons']], ['2025', '2024'])
        self.assertIsNone(pages.league_stats(data, 5))


class BuiltPagesTests(unittest.TestCase):
    """Checks the committed output, so a stale or broken build fails the tests."""

    def setUp(self):
        if not (ROOT / 'player' / 'links.json').exists():
            self.skipTest('player pages not built')
        self.links = json.loads((ROOT / 'player' / 'links.json').read_text())

    def test_links_point_at_pages(self):
        for key in ('ipl', 'wpl'):
            for slug in self.links[key].values():
                self.assertTrue((ROOT / 'player' / f'{slug}.html').exists(), slug)
        self.assertEqual(len(set(self.links['byId'].values())), len(self.links['byId']))

    def test_page_has_unique_meta(self):
        text = (ROOT / 'player' / f'{self.links["ipl"]["V Kohli"]}.html').read_text()
        self.assertIn('<link rel="canonical" href="https://mstmayank.github.io/player/virat-kohli.html">', text)
        self.assertRegex(text, r'<title>Virat Kohli: IPL stats')
        self.assertIn('Batting by phase', text)
        self.assertEqual(len(re.findall(r'id="top"', text)), 1)
        sitemap = (ROOT / 'sitemap.xml').read_text()
        self.assertIn('/player/virat-kohli.html</loc>', sitemap)


if __name__ == '__main__':
    unittest.main()
