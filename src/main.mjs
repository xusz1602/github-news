import { mkdir, readFile, writeFile, rename, readdir, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dateAt, periods, shift, render, rank } from './core.mjs';
import { reportPeriod, periodLabel, readmeExcerpt, renderHTML, renderIndex } from './presentation.mjs';
import { setTimeout as watchdogTimeout } from 'node:timers';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const config = JSON.parse(await readFile(join(root, 'config.json'), 'utf8'));
const data = join(root, 'data');
const snapshots = join(data, 'snapshots');
const reports = join(root, 'reports');
for (const dir of [data, snapshots, reports]) await mkdir(dir, { recursive: true });
const token = process.env.GITHUB_TOKEN;
const now = new Date();
const today = dateAt(now, config.timezone);
const phase = process.argv[2] || 'collect';
const started = Date.now();
// Independent of individual fetch/retry timers: always terminate a stuck collection.
const watchdog = phase === 'collect' ? watchdogTimeout(() => {
  console.error('采集超过 12 分钟总时限，已终止；本次不保存不完整快照。请查看最后一条查询进度。');
  process.exit(1);
}, 12 * 60 * 1000) : null;
watchdog?.unref();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const progress = message => console.log(`[${Math.round((Date.now() - started) / 1000)}s] ${message}`);

async function readJSON(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
}
async function save(path, obj) {
  await writeFile(`${path}.tmp`, JSON.stringify(obj) + '\n');
  await rename(`${path}.tmp`, path);
}

async function api(path, body) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await fetch(`https://api.github.com${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'github-embedded-radar',
          ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000)
      });
    } catch {
      if (attempt === 2) throw new Error('GitHub 网络请求连续 3 次失败或超时；停止本次采集');
      progress(`请求失败或超过 20 秒，准备第 ${attempt + 2}/3 次尝试`);
      await sleep(3000 * (attempt + 1)); continue;
    }
    if (response.ok) {
      const result = await response.json();
      if (result.errors) throw new Error('GitHub GraphQL 返回错误，停止写入不完整快照');
      return result;
    }
    if (![403, 429, 500, 502, 503, 504].includes(response.status) || attempt === 2) {
      throw new Error(`GitHub 请求失败 HTTP ${response.status}（未记录凭据或响应正文）`);
    }
    const retry = Number(response.headers.get('retry-after')) || 0;
    const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000 - Date.now();
    const delay = Math.max(5000 * (attempt + 1), retry * 1000, response.headers.get('x-ratelimit-remaining') === '0' ? reset + 1000 : 0);
    if (delay > 30000) throw new Error(`GitHub HTTP ${response.status} 要求等待超过 30 秒，退出并等待下一次任务补跑`);
    progress(`GitHub HTTP ${response.status}，等待 ${Math.ceil(delay / 1000)} 秒后重试 ${attempt + 2}/3`);
    await sleep(delay);
  }
}

function normalize(r, embedded) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(r.full_name)) throw new Error('不合法的项目名称');
  return { id: r.node_id, full_name: r.full_name, stars: r.stargazers_count,
    description: r.description, topics: r.topics || [], language: r.language,
    pushed_at: r.pushed_at, archived: r.archived, fork: r.fork, embedded: Boolean(embedded) };
}

async function collect() {
  const file = join(snapshots, `${today}.json`);
  if (await readJSON(file, null)) { console.log('今日快照已存在，保留首次采样。'); return; }
  const names = (await readdir(snapshots)).filter(n => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
  const previous = names.length ? await readJSON(join(snapshots, names.at(-1)), null) : null;
  const pool = new Map();
  const excludes = new Set(config.exclude.map(x => x.toLowerCase()));
  async function search(query, pages, embedded, forks = false) {
    for (let page = 1; page <= pages; page++) {
      progress(`开始检索：${query}，第 ${page}/${pages} 页`);
      await sleep(token ? 2200 : 6500);
      const params = new URLSearchParams({ q: `${query} archived:false ${forks ? 'fork:true' : 'fork:false'}`, sort: 'stars', order: 'desc', per_page: '100', page: String(page) });
      let result = await api(`/search/repositories?${params}`);
      if (result.incomplete_results) {
        await sleep(5000); result = await api(`/search/repositories?${params}`);
        if (result.incomplete_results) throw new Error('搜索结果不完整，保留上次数据并等待重试');
      }
      for (const r of result.items) {
        if (excludes.has(r.full_name.toLowerCase())) continue;
        const old = pool.get(r.node_id) || previous?.repos[r.node_id];
        pool.set(r.node_id, normalize(r, embedded || old?.embedded));
      }
      progress(`完成检索：${query}，第 ${page} 页返回 ${result.items.length} 条，累计 ${pool.size} 个项目`);
      if (result.items.length < 100) break;
    }
  }
  console.log('检索全站高星及近期新项目……');
  await search('stars:>=20', config.globalPages, false);
  await search(`stars:>=20 created:>=${shift(today, -30)}`, 2, false);
  console.log('检索嵌入式、Linux、全志和 Rockchip 等项目……');
  for (const query of config.queries) await search(`${query} stars:>=20`, config.embeddedPages, true, true);
  for (const fullName of config.include) {
    if (excludes.has(fullName.toLowerCase())) continue;
    progress(`读取指定项目：${fullName}`);
    const r = await api(`/repos/${fullName}`);
    pool.set(r.node_id, normalize(r, true));
  }
  // Keep tracking previously discovered projects, even when they fall out of search results.
  const missing = Object.values(previous?.repos || {}).filter(r => !pool.has(r.id) && !excludes.has(r.full_name.toLowerCase()));
  console.log(`刷新历史项目 ${missing.length} 个……`);
  if (missing.length && !token) throw new Error('刷新历史项目需要 GITHUB_TOKEN；不保存部分快照');
  for (let i = 0; i < missing.length; i += 50) {
    progress(`刷新历史项目：${i + 1}–${Math.min(i + 50, missing.length)}/${missing.length}`);
    const batch = missing.slice(i, i + 50);
    const result = await api('/graphql', { query: `query($ids:[ID!]!) { nodes(ids:$ids) { ... on Repository { id nameWithOwner stargazerCount description repositoryTopics(first:30) { nodes { topic { name } } } primaryLanguage { name } pushedAt isArchived isFork } } }`, variables: { ids: batch.map(r => r.id) } });
    for (const n of result.data.nodes) {
      if (!n) continue; // Deleted or no longer accessible: exclude from the new snapshot.
      const old = previous.repos[n.id];
      pool.set(n.id, normalize({ node_id: n.id, full_name: n.nameWithOwner, stargazers_count: n.stargazerCount,
        description: n.description, topics: n.repositoryTopics.nodes.map(x => x.topic.name), language: n.primaryLanguage?.name,
        pushed_at: n.pushedAt, archived: n.isArchived, fork: n.isFork }, old.embedded));
    }
    await sleep(500);
  }
  await save(file, { date: today, at: new Date().toISOString(), repos: Object.fromEntries(pool) });
  // A year of daily history is sufficient for catch-up and calendar-month reports.
  for (const name of names) if (name.slice(0, 10) < shift(today, -400)) await unlink(join(snapshots, name));
  console.log(`已保存完整快照：${pool.size} 个项目。`);
}

async function report() {
  const names = (await readdir(snapshots)).filter(n => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
  if (!names.length) throw new Error('尚无采样数据');
  const statePath = join(data, 'state.json');
  const state = await readJSON(statePath, { firstDate: names[0].slice(0, 10), reports: {} });
  for (const period of periods(state.firstDate, today)) {
    if (state.reports[period.id]) continue;
    const end = await readJSON(join(snapshots, `${period.end}.json`), null);
    // Missing a boundary means no accurate period: skip rather than fabricate a date.
    if (!end) continue;
    const start = await readJSON(join(snapshots, `${period.start}.json`), null);
    const path = `${period.id}.md`;
    await writeFile(join(reports, path), render(period, end, start, config));
    state.reports[period.id] = { path, title: `GitHub ${period.kind} ${period.end}`, start: period.start, kind: period.kind, end: period.end, status: 'pending' };
  }
  await save(statePath, state);
  console.log('报告生成完成。');
}

async function preview() {
  const state = await readJSON(join(data, 'state.json'), { reports: {} });
  const cachePath = join(data, 'readme-excerpts.json');
  const cache = await readJSON(cachePath, {});
  const docs = join(root, 'docs');
  await mkdir(docs, { recursive: true });
  const entries = [], attempted = new Set();
  for (const [id, r] of Object.entries(state.reports)) {
    const period = reportPeriod(id, r);
    const end = await readJSON(join(snapshots, `${period.end}.json`), null);
    if (!end) continue;
    const start = period.kind === '即时榜单' ? null : await readJSON(join(snapshots, `${period.start}.json`), null);
    const projects = new Map(rank(end, start, config).flatMap(b => b.rows).map(repo => [repo.id, repo]));
    for (const repo of projects.values()) {
      if (attempted.has(repo.id)) continue;
      attempted.add(repo.id);
      if (cache[repo.id]?.extractorVersion === 2 && cache[repo.id]?.fetchedAt && Date.now() - Date.parse(cache[repo.id].fetchedAt) < 30 * 86400000) continue;
      progress(`补充 README：${repo.full_name}`);
      try {
        const response = await fetch(`https://api.github.com/repos/${repo.full_name}/readme`, {
          headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'github-embedded-radar', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) { progress(`README HTTP ${response.status}：保留已有简介并提供原文入口`); continue; }
        const value = await response.json();
        if (value.encoding !== 'base64' || !value.content) continue;
        cache[repo.id] = { extractorVersion: 2, excerpt: readmeExcerpt(Buffer.from(value.content, 'base64').toString('utf8')), fetchedAt: new Date().toISOString(), repository: repo.full_name };
      } catch { progress('README 暂时无法读取：保留原文入口，不影响榜单发布'); }
    }
    await writeFile(join(docs, `${id}.html`), renderHTML(period, end, start, config, cache));
    await writeFile(join(reports, r.path), render(period, end, start, config, cache));
    entries.push({ period });
  }
  await writeFile(join(docs, 'index.html'), renderIndex(entries));
  await writeFile(join(docs, '.nojekyll'), '');
  await save(cachePath, cache);
  console.log(`已生成 ${entries.length} 份卡片报告和归档首页。`);
}

async function send(test = false, resend = false) {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw new Error('缺少合法的 GITHUB_REPOSITORY');
  const branch = process.env.GITHUB_REF_NAME || 'main';
  const statePath = join(data, 'state.json');
  const state = await readJSON(statePath, { reports: {} });
  const pending = resend ? Object.entries(state.reports).sort((a, b) => b[1].end.localeCompare(a[1].end) || b[0].localeCompare(a[0])).slice(0, 1) :
    Object.entries(state.reports).filter(([, r]) => r.status === 'pending').sort(([a], [b]) => b.localeCompare(a));
  // Bound the free-tier usage. One request/day, combining weekly/monthly catch-up links.
  const ledgerPath = join(data, 'delivery.json');
  const ledger = await readJSON(ledgerPath, {});
  if (!test && ((!resend && ledger[today]) || !pending.length)) { console.log('今日无需推送。'); return; }
  const key = process.env.SERVERCHAN_SENDKEY;
  if (!key || !/^SCT[A-Za-z0-9]+$/.test(key)) throw new Error('请在 Secrets 配置 Server酱 Turbo 的 SERVERCHAN_SENDKEY（SCT 开头）');
  const url = path => `https://github.com/${repository}/blob/${encodeURIComponent(branch)}/${path}`;
  const base = config.publicBaseUrl?.replace(/\/$/, '');
  if (base && !/^https:\/\/[-a-zA-Z0-9.]+(?:\/[-a-zA-Z0-9._~%]+)*$/.test(base)) throw new Error('publicBaseUrl 必须为合法 HTTPS 地址');
  if (resend && base) {
    const page = await fetch(`${base}/${pending[0][0]}.html`, { signal: AbortSignal.timeout(15000) });
    if (!page.ok) throw new Error('卡片预览尚未可访问，停止补发，避免发送失效入口');
    await page.body?.cancel();
  }
  const labels = pending.map(([id, r]) => periodLabel(reportPeriod(id, r)));
  const title = pending.length === 1 ? `GitHub 雷达｜${labels[0]}` : `GitHub 雷达｜${pending.length} 份报告｜截至 ${today}`;
  const body = test ? `微信推送连接测试成功。\n\n[查看项目](${url('README.md')})` :
    ['## 本次报告周期', '', ...labels.map(label => `- **${label}**`), '',
      '项目卡片包含 Star 数据、项目简介、README 概述及来源。', '',
      ...pending.slice(0, 8).flatMap(([id, r], i) => [base ? `### [${labels[i]} · 卡片预览](${base}/${id}.html)` : `### ${labels[i]}`,
        `[Markdown 备份](${url(`reports/${r.path}`)})`, '']),
      `[查看全部历史报告](${base ? base + '/index.html' : url('reports')})`, '',
      '周报/月报日期表示自然周期，数值以边界日实际采样为准。即时榜单仅展示截至采样日的数据；不足完整周期时不显示增长排名。'].join('\n');
  let response;
  try {
    response = await fetch(`https://sctapi.ftqq.com/${key}.send`, { method: 'POST',
      body: new URLSearchParams({ title: test ? 'GitHub 雷达 · 微信连接测试' : title, desp: body }), signal: AbortSignal.timeout(30000) });
  } catch { throw new Error('推送网络失败：为避免重复投递，本次不立即重试，下次定时运行再检查'); }
  if (!response.ok) throw new Error(`推送 HTTP ${response.status}；未记录含密钥的请求地址`);
  const result = await response.json();
  if (result.code !== 0) throw new Error('推送服务未接受请求，请检查控制台配置和额度');
  if (!test) {
    for (const [, r] of pending) {
      r.status = 'accepted';
      if (resend) r.lastResentAt = new Date().toISOString();
      else r.acceptedAt = new Date().toISOString();
    }
    ledger[today] = new Date().toISOString();
    await save(statePath, state); await save(ledgerPath, ledger);
  }
  console.log('推送接口已接受请求；最终微信送达请在手机确认。');
}

try {
  if (phase === 'collect') { await collect(); await report(); }
  else if (phase === 'report') await report();
  else if (phase === 'preview') await preview();
  else if (phase === 'send') await send();
  else if (phase === 'resend') await send(false, true);
  else if (phase === 'test-push') await send(true);
  else throw new Error('未知命令，支持 collect / report / preview / send / resend / test-push');
} catch (error) {
  // Never log native fetch errors, which may include the secret-bearing URL.
  console.error(error.message?.includes('SCT') ? '请检查 SERVERCHAN_SENDKEY 的 Secrets 配置（Turbo SCT 类型）' : error.message);
  process.exitCode = 1;
} finally {
  if (watchdog) clearTimeout(watchdog);
}
