import test from 'node:test';
import assert from 'node:assert/strict';
import { reportPeriod, periodLabel, readmeExcerpt, renderHTML } from '../src/presentation.mjs';

test('微信周期区分周报、自然月与即时采样', () => {
  assert.equal(periodLabel(reportPeriod('weekly-2026-11-02')), '周报｜2026-10-26 — 2026-11-01');
  assert.equal(periodLabel(reportPeriod('monthly-2024-03-01')), '月报｜2024-02-01 — 2024-02-29');
  assert.equal(periodLabel(reportPeriod('manual-2026-11-01')), '即时榜单｜截至 2026-11-01 采样');
});
test('README 排除徽章、目录、代码与活动内容，限制为短摘录', () => {
  const raw = '# Title\n\n![Badge](https://example.com/badge.svg)\n\n```sh\ncurl installer\n```\n\n<script>alert("danger")</script>\n\nThis project is an embedded Linux build system that helps developers create firmware for Rockchip and Allwinner devices with reproducible builds and clear documentation for beginners.\n\n## Install';
  const result = readmeExcerpt(raw);
  assert.match(result, /^This project is an embedded Linux/);
  assert.ok(!result.includes('danger') && !result.includes('curl') && !result.includes('Badge'));
  assert.ok(result.split(/\s+/).length <= 25);
});
test('卡片将项目与 README 视为纯文本，不执行仓库中的 HTML', () => {
  const config = { top: 10, exclude: [], minimumGrowthStars: 20 };
  const end = { at: '2026-11-01T00:17:00Z', repos: { a: { id: 'a', full_name: 'owner/project', stars: 100, embedded: true, description: '<img src=x onerror=alert(1)>', language: 'C' } } };
  const html = renderHTML(reportPeriod('manual-2026-11-01'), end, null, config, { a: { excerpt: '<script>alert(2)</script>' } });
  assert.ok(!html.includes('<img src=x') && !html.includes('<script>alert(2)'));
  assert.match(html, /&lt;script&gt;alert\(2\)&lt;\/script&gt;/);
  assert.match(html, /增长数据正在积累/);
  assert.match(html, /data-tab=/);
});
