import test from 'node:test';
import assert from 'node:assert/strict';
import { dateAt, periods, rank, render, tags } from '../src/core.mjs';

const config = { top: 10, exclude: [], minimumGrowthStars: 20, timezone: 'Asia/Shanghai' };
const repo = (id, stars, extra = {}) => ({ id, full_name: `owner/${id}`, stars, embedded: false, fork: false, archived: false, ...extra });
const snap = rows => ({ at: '2026-11-01T00:17:00Z', repos: Object.fromEntries(rows.map(r => [r.id, r])) });

test('北京时间跨日与闰年自然月', () => {
  assert.equal(dateAt('2026-11-01T17:00:00Z'), '2026-11-02');
  const list = periods('2024-02-01', '2024-03-01');
  assert.deepEqual(list.find(p => p.id === 'monthly-2024-03-01'), { id: 'monthly-2024-03-01', kind: '月报', start: '2024-02-01', end: '2024-03-01' });
  assert.ok(list.every(p => p.end <= '2024-03-01'));
});
test('每周一生成上周，漏跑可枚举补发', () => {
  const list = periods('2026-10-25', '2026-11-03');
  assert.ok(list.some(p => p.id === 'weekly-2026-11-02' && p.start === '2026-10-26'));
  assert.ok(list.some(p => p.id === 'monthly-2026-11-01'));
  assert.equal(new Set(list.map(p => p.id)).size, list.length);
});
test('净增排名排除缺基线、负增长、归档、全站 Fork；嵌入式保留 Fork', () => {
  const start = snap([repo('a', 100), repo('b', 50), repo('d', 100), repo('f', 10), repo('z', 50)]);
  const end = snap([repo('a', 110), repo('b', 100, { full_name: 'renamed/b' }), repo('new', 1000), repo('d', 90), repo('f', 300, { embedded: true, fork: true }), repo('z', 500, { archived: true })]);
  const boards = rank(end, start, config);
  assert.deepEqual(boards[1].rows.map(r => [r.id, r.delta]), [['b', 50], ['a', 10]]);
  assert.equal(boards[3].rows[0].id, 'f');
  assert.ok(!boards[0].rows.some(r => r.id === 'f' || r.id === 'z'));
});
test('没有完整基线时不生成伪造增长值', () => {
  const end = snap([repo('a', 100, { embedded: true })]);
  const boards = rank(end, null, config);
  assert.equal(boards[1].rows.length, 0);
  const md = render({ kind: '周报', start: '2026-10-26', end: '2026-11-02' }, end, null, config);
  assert.match(md, /缺失/);
  assert.match(md, /owner\/a/);
});
test('零基线、白黑名单过滤与 SoC 标签', () => {
  const end = snap([repo('a', 50, { embedded: true, description: 'Rockchip RK3588 Linux NPU' }), repo('b', 100)]);
  const start = snap([repo('a', 0), repo('b', 10)]);
  const boards = rank(end, start, { ...config, exclude: ['OWNER/B'] });
  assert.equal(boards[1].rows.length, 1);
  assert.equal(boards[1].rows[0].rate, null);
  assert.deepEqual(tags(end.repos.a), ['Rockchip', 'Linux/系统']);
});
