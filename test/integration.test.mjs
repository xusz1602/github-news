import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

test('采集→刷新跌出候选池的项目→报告→推送回执→重复运行不重发', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'github-radar-test-'));
  try {
    await cp(fileURLToPath(new URL('../src', import.meta.url)), join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'config.json'), JSON.stringify({ timezone: 'Asia/Shanghai', top: 10,
      minimumGrowthStars: 20, globalPages: 1, embeddedPages: 1, queries: [], include: [], exclude: [] }));
    await mkdir(join(dir, 'data', 'snapshots'), { recursive: true });
    await writeFile(join(dir, 'data', 'snapshots', '2026-10-26.json'), JSON.stringify({ date: '2026-10-26', at: '2026-10-26T00:17:00Z', repos: {
      a: { id: 'a', full_name: 'owner/a', stars: 100, embedded: false },
      b: { id: 'b', full_name: 'owner/b', stars: 100, embedded: true }
    } }));
    await writeFile(join(dir, 'mock.mjs'), `
import { appendFileSync } from 'node:fs';
const OriginalDate = Date;
globalThis.Date = class extends OriginalDate {
  constructor(...args) { super(...(args.length ? args : ['2026-11-02T00:17:00Z'])); }
  static now() { return new OriginalDate('2026-11-02T00:17:00Z').getTime(); }
};
globalThis.setTimeout = callback => { queueMicrotask(callback); return 0; };
globalThis.fetch = async (input, options) => {
  const url = new URL(input);
  if (process.env.RADAR_TEST_LIMIT === '1') {
    appendFileSync(${JSON.stringify(join(dir, 'limit-count.txt'))}, 'request\\n');
    return new Response('{}', { status: 403, headers: { 'retry-after': '3600' } });
  }
  if (url.hostname === 'sctapi.ftqq.com') {
    appendFileSync(${JSON.stringify(join(dir, 'push-count.txt'))}, 'accepted\\n');
    return Response.json({code:0});
  }
  if (url.pathname === '/search/repositories') return Response.json({incomplete_results:false,items:[{
    node_id:'a',full_name:'owner/a',stargazers_count:120,description:'hello',topics:[],archived:false,fork:false
  }]});
  if (url.pathname === '/graphql') return Response.json({data:{nodes:[{
    id:'b',nameWithOwner:'renamed/b',stargazerCount:250,description:'Rockchip Linux',
    repositoryTopics:{nodes:[]},primaryLanguage:{name:'C'},isArchived:false,isFork:true
  }]}});
  throw new Error('Unexpected test endpoint');
};
`);
    const limited = spawnSync(process.execPath, ['--import', pathToFileURL(join(dir, 'mock.mjs')).href, join(dir, 'src', 'main.mjs'), 'collect'], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, GITHUB_TOKEN: 'fixture', RADAR_TEST_LIMIT: '1' }
    });
    assert.equal(limited.status, 1);
    assert.match(limited.stderr, /超过 30 秒/);
    assert.equal(await readFile(join(dir, 'limit-count.txt'), 'utf8'), 'request\n');
    await assert.rejects(readFile(join(dir, 'data', 'snapshots', '2026-11-02.json')), { code: 'ENOENT' });
    const run = phase => {
      const child = spawnSync(process.execPath, ['--import', pathToFileURL(join(dir, 'mock.mjs')).href, join(dir, 'src', 'main.mjs'), phase], {
        cwd: dir, encoding: 'utf8', env: { ...process.env, GITHUB_TOKEN: 'fixture', GITHUB_REPOSITORY: 'fixture/radar', SERVERCHAN_SENDKEY: 'SCTfixture' }
      });
      assert.equal(child.status, 0, child.stderr + child.stdout);
      return child.stdout;
    };
    run('collect');
    const snapshot = JSON.parse(await readFile(join(dir, 'data', 'snapshots', '2026-11-02.json'), 'utf8'));
    assert.equal(snapshot.repos.b.stars, 250);
    assert.equal(snapshot.repos.b.full_name, 'renamed/b');
    assert.equal(snapshot.repos.b.embedded, true);
    const md = await readFile(join(dir, 'reports', 'weekly-2026-11-02.md'), 'utf8');
    assert.match(md, /净增 \+150/);
    assert.match(md, /净增 \+20/);
    run('send');
    run('send');
    run('collect');
    assert.equal(await readFile(join(dir, 'push-count.txt'), 'utf8'), 'accepted\n');
    const state = JSON.parse(await readFile(join(dir, 'data', 'state.json'), 'utf8'));
    assert.equal(state.reports['weekly-2026-11-02'].status, 'accepted');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
