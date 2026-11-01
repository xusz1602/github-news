import { rank, tags, shift } from './core.mjs';

export function reportPeriod(id, report = {}) {
  const end = report.end || id.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (!end) throw new Error('报告缺少日期');
  if (report.start && report.kind) return { id, start: report.start, end, kind: report.kind };
  if (id.startsWith('weekly-')) return { id, start: shift(end, -7), end, kind: '周报' };
  if (id.startsWith('monthly-')) {
    const d = new Date(`${end}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1);
    return { id, start: d.toISOString().slice(0, 10), end, kind: '月报' };
  }
  return { id, start: end, end, kind: '即时榜单' };
}

export function periodLabel(period) {
  return period.kind === '即时榜单' ? `即时榜单｜截至 ${period.end} 采样` :
    `${period.kind}｜${period.start} — ${shift(period.end, -1)}`;
}

// A short attributed excerpt, not a full README mirror. Untrusted Markdown is plain text only.
export function readmeExcerpt(markdown) {
  let text = String(markdown || '').slice(0, 150000)
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => {
    return p.length >= 60 && !/^(#{1,6}\s|\[.*\]:|\||```|[-*]\s|\d+\.\s)/.test(p)
      && !/^(?:table of contents|目录|badges|sponsors|languages?|copyright)\b/i.test(p)
      && !/https?:\/\//.test(p.slice(0, 30));
  });
  const paragraph = (paragraphs[0] || '').replace(/\s+/g, ' ').replace(/[*_`]/g, '');
  if (!paragraph) return '';
  const segments = [...new Intl.Segmenter('zh', { granularity: 'word' }).segment(paragraph)];
  let words = 0, excerpt = '';
  for (const segment of segments) {
    if (segment.isWordLike && ++words > 24) break;
    if (excerpt.length + segment.segment.length > 320) break;
    excerpt += segment.segment;
  }
  return excerpt.trim() + (excerpt.trim().length < paragraph.length ? '…' : '');
}

export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const number = n => Number(n).toLocaleString('en-US');
const css = `
:root{color-scheme:light;--ink:#142c40;--muted:#627585;--line:#dce5eb;--teal:#087e83;--paper:#f4f7fa}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif}a{color:inherit;text-decoration:none}a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid #efad43;outline-offset:4px}.wrap{max-width:1160px;margin:auto;padding:0 24px}.masthead{display:flex;align-items:center;justify-content:space-between;padding-top:23px;padding-bottom:23px;font-size:13px}.brand{font-size:17px;font-weight:800;letter-spacing:.02em}.brand b{display:inline-grid;place-items:center;background:var(--ink);color:#fff;width:31px;height:31px;margin-right:9px;border-radius:9px}.subtle{color:var(--muted)}.hero{background:linear-gradient(120deg,#102d43,#164b5c 68%,#087e83);color:white;border-radius:24px;padding:40px 44px;position:relative;overflow:hidden}.hero:after{content:"";width:300px;height:300px;border:1px solid #ffffff16;border-radius:50%;position:absolute;right:-80px;top:-120px;box-shadow:0 0 0 50px #ffffff06,0 0 0 100px #ffffff04;pointer-events:none}.eyebrow{letter-spacing:.18em;font-size:11px;font-weight:700;color:#87dcd5}.hero h1{font-size:clamp(28px,5vw,44px);letter-spacing:-.04em;line-height:1.2;margin:15px 0}.hero p{color:#c8dce5;margin:0;max-width:740px}.period{display:inline-block;background:#ffffff12;border:1px solid #ffffff28;border-radius:7px;padding:5px 11px;font-size:13px;margin:0 0 16px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:22px 0}.stat{background:white;border:1px solid var(--line);border-radius:14px;padding:18px 22px}.stat strong{display:block;font-size:27px;line-height:1.3;letter-spacing:-.04em}.stat span{color:var(--muted);font-size:12px}.toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:28px 0 16px}.tabs{display:flex;gap:7px;flex-wrap:wrap}.tab{font:inherit;font-size:13px;border:1px solid var(--line);border-radius:8px;background:white;color:var(--muted);padding:8px 13px;cursor:pointer}.tab.active{background:var(--ink);color:white;border-color:var(--ink)}input{margin-left:auto;border:1px solid var(--line);padding:10px 13px;border-radius:8px;min-width:215px;background:white;font:inherit;font-size:13px}.section-head{display:flex;align-items:baseline;gap:12px;margin:28px 0 16px}.section-head h2{font-size:22px;letter-spacing:-.03em;margin:0}.section-head span{color:var(--muted);font-size:12px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.card{background:white;border:1px solid var(--line);border-radius:16px;padding:24px;box-shadow:0 4px 14px #173e5004;min-width:0;display:flex;flex-direction:column}.card:hover{border-color:#9abdc6;box-shadow:0 7px 20px #173e500b}.card-top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.rank{color:#9aacb9;font-weight:800;font-size:23px;font-variant-numeric:tabular-nums}.owner{color:var(--muted);font-size:12px;overflow-wrap:anywhere}.card h3{font-size:21px;line-height:1.35;margin:0 0 5px;overflow-wrap:anywhere;letter-spacing:-.02em}.badges{display:flex;flex-wrap:wrap;gap:6px;margin:11px 0 15px}.badge{font-size:11px;line-height:1.6;padding:3px 8px;background:#edf5f5;color:#23666a;border-radius:5px}.badge.gray{background:#f0f3f6;color:#687b8d}.description{margin:0 0 18px;color:#465c6c;overflow-wrap:anywhere}.metrics{display:flex;gap:24px;padding:13px 0;border-top:1px solid #edf1f4;border-bottom:1px solid #edf1f4;margin-bottom:17px}.metric strong{display:block;font-size:21px;font-weight:750;line-height:1.4;font-variant-numeric:tabular-nums}.metric small{font-size:10px;color:var(--muted);letter-spacing:.05em}.positive{color:var(--teal)}.readme{border-left:3px solid #7cbab4;padding:1px 0 1px 13px;margin:0 0 19px}.readme .label{font-size:10px;letter-spacing:.06em;color:var(--teal);font-weight:700}.readme blockquote{margin:7px 0 4px;color:#536775;font-size:13px;line-height:1.8;overflow-wrap:anywhere;white-space:pre-wrap}.readme a{font-size:11px;color:var(--teal);text-decoration:underline;text-underline-offset:3px}.card-footer{display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:4px;font-size:11px;color:var(--muted)}.go{font-size:12px;color:var(--teal);font-weight:750}.empty{border:1px dashed #b7cbd5;border-radius:16px;padding:34px;background:#f9fbfc;color:var(--muted)}.empty strong{display:block;color:var(--ink);font-size:17px;margin-bottom:6px}.note{font-size:12px;color:var(--muted);margin:32px 0 0;border-top:1px solid var(--line);padding-top:20px}.note summary{cursor:pointer;font-weight:600}footer{padding:28px 0 36px;display:flex;justify-content:space-between;color:var(--muted);font-size:12px}.archive{display:grid;gap:12px;margin-top:28px}.archive a{display:flex;justify-content:space-between;gap:15px;background:white;padding:20px 24px;border:1px solid var(--line);border-radius:12px}.hidden,[hidden]{display:none!important}@media(max-width:640px){.wrap{padding:0 16px}.masthead{font-size:11px}.hero{padding:28px 24px;border-radius:18px}.stats{gap:8px;margin:14px 0}.stat{padding:14px 10px}.stat strong{font-size:22px}.stat span{font-size:10px}.grid{grid-template-columns:1fr;gap:14px}.card{padding:21px}input{width:100%;margin-left:0}.section-head{display:block}.section-head h2{font-size:20px}footer{gap:15px;flex-wrap:wrap}.archive a{padding:18px;display:block}}
`;

function shell(title, content, script = '') {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escapeHTML(title)} · GitHub 雷达</title><style>${css}</style></head><body><header class="wrap masthead"><a class="brand" href="index.html"><b>G</b>GitHub 雷达</a><span class="subtle">开源项目 · 每周 / 每月精选</span></header><main class="wrap">${content}</main><footer class="wrap"><span>从热度发现项目，从文档理解项目。</span><a href="index.html">报告归档 ↗</a></footer>${script ? `<script>${script}</script>` : ''}</body></html>`;
}

function card(r, i, cache) {
  const e = escapeHTML, [owner, name] = r.full_name.split('/');
  const readme = cache[r.id];
  const source = `https://github.com/${r.full_name}#readme`;
  return `<article class="card" data-search="${e(`${r.full_name} ${r.description || ''} ${tags(r).join(' ')}`.toLowerCase())}"><div class="card-top"><div><div class="owner">${e(owner)}</div><h3><a href="https://github.com/${e(r.full_name)}" target="_blank" rel="noopener noreferrer">${e(name)}</a></h3></div><span class="rank">${String(i + 1).padStart(2, '0')}</span></div><div class="badges">${(r.embedded ? tags(r) : []).map(t => `<span class="badge">${e(t)}</span>`).join('')}<span class="badge gray">${e(r.language || '多语言 / 未标注')}</span>${r.fork ? '<span class="badge gray">Fork / BSP 分支</span>' : ''}</div><p class="description">${e(r.description || '项目未提供简介，请查阅 README。')}</p><div class="metrics"><div class="metric"><strong>${number(r.stars)}</strong><small>STAR 总数</small></div>${r.delta === undefined ? '' : `<div class="metric positive"><strong>+${number(r.delta)}</strong><small>周期净增</small></div><div class="metric"><strong>${r.rate === null ? '—' : (r.rate * 100).toFixed(1) + '%'}</strong><small>增长率</small></div>`}</div><div class="readme"><div class="label">README 概述 · 原文节选</div>${readme?.excerpt ? `<blockquote>${e(readme.excerpt)}</blockquote><a href="${source}" target="_blank" rel="noopener noreferrer">阅读完整 README ↗</a>` : `<blockquote>尚未提取到适合展示的说明段落。</blockquote><a href="${source}" target="_blank" rel="noopener noreferrer">打开项目文档 ↗</a>`}</div><div class="card-footer"><span>代码更新 ${e(r.pushed_at?.slice(0, 10) || '未知')}</span><a class="go" href="https://github.com/${e(r.full_name)}" target="_blank" rel="noopener noreferrer">查看项目 ↗</a></div></article>`;
}

export function renderHTML(period, end, start, config, cache = {}) {
  const boards = rank(end, start, config), rows = Object.values(end.repos), label = periodLabel(period), e = escapeHTML;
  const content = `<section class="hero"><div class="eyebrow">GITHUB PROJECT RADAR / ${e(period.end)}</div><h1>值得关注的开源项目</h1><div class="period">${e(label)}</div><p>全站热度与嵌入式技术，一次看清。覆盖 MCU、RTOS、Linux、全志与 Rockchip 等方向。</p></section><div class="stats"><div class="stat"><strong>${number(rows.length)}</strong><span>持续监测项目</span></div><div class="stat"><strong>${number(rows.filter(r => r.embedded).length)}</strong><span>嵌入式候选项目</span></div><div class="stat"><strong>${start ? '已就绪' : '积累中'}</strong><span>完整周期增长基线</span></div></div><div class="toolbar"><nav class="tabs" aria-label="选择榜单"><button class="tab active" data-tab="all" aria-pressed="true">全部榜单</button>${boards.map((b, i) => `<button class="tab" data-tab="${i}" aria-pressed="false">${e(b.title.replace(' Top 10', ''))}</button>`).join('')}</nav><input type="search" aria-label="搜索项目名称、简介或分类" placeholder="搜索项目、芯片或分类…"></div>${boards.map((b, i) => `<section class="board" data-board="${i}"><div class="section-head"><h2>${e(b.title)}</h2><span>${i % 2 ? '按周期净增排序 · 仅限完整观察项目' : '按 Star 总数排序'}</span></div>${b.rows.length ? `<div class="grid">${b.rows.map((r, n) => card(r, n, cache)).join('')}</div><p class="no-match subtle" hidden>当前榜单没有匹配的项目。</p>` : `<div class="empty"><strong>${start ? '本期暂无符合条件的项目' : '增长数据正在积累'}</strong>${start ? '净增量、总星数或完整观察周期未达到榜单条件。' : '已经建立首次快照。积累完整周 / 月边界数据后，这里会显示真实净增排行。'}</div>`}</section>`).join('')}<details class="note"><summary>统计口径与来源说明</summary><p>周期展示日期为 ${e(label)}。实际结束边界采样：${e(end.at)}；起始采样：${e(start?.at || '尚无完整基线')}。统计按实际采样时间计算，并非严格午夜。</p><p>增长榜仅代表监测池，净增包含取消 Star 的影响。新发现且没有起始快照的项目不参加本期增长排序。嵌入式候选按关键词与 Topics 归类，并非硬件兼容承诺；不同仓库 ID 的同源镜像可能重复。</p><p>简介与 README 节选来自对应项目，保留原语言并链接原文；节选经过徽章、代码、HTML 和目录过滤，可能无法涵盖项目全部功能。最近代码更新时间不等于版本发布日期。</p><a href="https://github.com/${e(config.repository || 'xusz1602/github-news')}/blob/main/reports/${e(period.id)}.md">查看 Markdown 原版 ↗</a></details>`;
  const script = `let tab='all';const input=document.querySelector('input');function filter(){const q=input.value.trim().toLowerCase();document.querySelectorAll('.board').forEach(b=>{b.hidden=tab!=='all'&&b.dataset.board!==tab;let visible=0;b.querySelectorAll('.card').forEach(c=>{c.hidden=!c.dataset.search.includes(q);if(!c.hidden)visible++});const empty=b.querySelector('.no-match');if(empty)empty.hidden=visible>0})}document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(t=>{t.classList.toggle('active',t===b);t.setAttribute('aria-pressed',String(t===b))});filter()}));input.addEventListener('input',filter);`;
  return shell(label, content, script);
}

export function renderIndex(entries) {
  const sorted = [...entries].sort((a, b) => b.period.end.localeCompare(a.period.end) || b.period.id.localeCompare(a.period.id));
  return shell('报告归档', `<section class="hero"><div class="eyebrow">GITHUB PROJECT RADAR / ARCHIVE</div><h1>每一期，都有新发现。</h1><p>项目排行、README 概述和增长变化，按周期整理。</p>${sorted.length ? `<p style="margin-top:24px"><a href="${escapeHTML(sorted[0].period.id)}.html" style="color:white;font-weight:700">打开最新一期 → ${escapeHTML(periodLabel(sorted[0].period))}</a></p>` : ''}</section><div class="archive">${sorted.map(({ period }) => `<a href="${escapeHTML(period.id)}.html"><strong>${escapeHTML(periodLabel(period))}</strong><span class="subtle">查看卡片榜单 ↗</span></a>`).join('')}</div>`);
}
