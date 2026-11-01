export function dateAt(time, timezone = 'Asia/Shanghai') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(time));
}

export function shift(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function periods(first, today) {
  const result = [];
  // Catch up after outages; never generate a report whose end is in the future.
  for (let end = shift(first, 1); end <= today; end = shift(end, 1)) {
    if (new Date(`${end}T00:00:00Z`).getUTCDay() === 1) {
      result.push({ id: `weekly-${end}`, kind: '周报', start: shift(end, -7), end });
    }
    if (end.endsWith('-01')) {
      const d = new Date(`${end}T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() - 1);
      result.push({ id: `monthly-${end}`, kind: '月报', start: d.toISOString().slice(0, 10), end });
    }
  }
  return result;
}

export function tags(repo) {
  const text = `${repo.full_name} ${repo.description || ''} ${(repo.topics || []).join(' ')}`.toLowerCase();
  const result = [];
  if (/allwinner|sunxi|\b(?:t113|t507|h616|h618)\b/.test(text)) result.push('全志');
  if (/rockchip|\b(?:rk\d{4}|rv11\d{2})\b/.test(text)) result.push('Rockchip');
  if (/amlogic/.test(text)) result.push('Amlogic');
  if (/linux|u-boot|buildroot|yocto|armbian|openwrt|device.tree|\bbsp\b/.test(text)) result.push('Linux/系统');
  if (/stm32|esp32|esp8266|microcontroller|micropython|\bmcu\b/.test(text)) result.push('MCU');
  if (/rtos|freertos|zephyr|rt-thread/.test(text)) result.push('RTOS');
  return result.length ? result : ['嵌入式相关'];
}

export function rank(endSnapshot, startSnapshot, config) {
  const rows = Object.values(endSnapshot.repos).filter(r => !config.exclude.some(x => x.toLowerCase() === r.full_name.toLowerCase()) && !r.archived);
  const high = list => [...list].sort((a, b) => b.stars - a.stars || a.full_name.localeCompare(b.full_name)).slice(0, config.top);
  const growth = list => list.flatMap(r => {
    const old = startSnapshot?.repos[r.id];
    if (!old) return [];
    return [{ ...r, delta: r.stars - old.stars, rate: old.stars > 0 ? (r.stars - old.stars) / old.stars : null }];
  }).filter(r => r.delta > 0 && r.stars >= config.minimumGrowthStars)
    .sort((a, b) => b.delta - a.delta || b.stars - a.stars).slice(0, config.top);
  const embedded = rows.filter(r => r.embedded);
  return [
    { title: '全站高星 Top 10', rows: high(rows.filter(r => !r.fork)) },
    { title: '监测池增长 Top 10', rows: growth(rows.filter(r => !r.fork)) },
    { title: '嵌入式高星 Top 10', rows: high(embedded) },
    { title: '嵌入式增长 Top 10', rows: growth(embedded) }
  ];
}

export function plain(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').replace(/[\\`*_{}\[\]<>#|!]/g, '\\$&').slice(0, 600);
}

export function render(period, end, start, config) {
  const boards = rank(end, start, config);
  const lines = [`# GitHub 项目${period.kind} · ${period.end}`, '',
    `周期日期：${period.start} 至 ${period.end}（${config.timezone}）。`,
    `结束采样：${end.at}；起始采样：${start?.at || '缺失，增长榜等待完整基线'}。`, '',
    `监测项目 ${Object.keys(end.repos).length} 个。增长榜仅代表监测池，数值为 Star 净增量。`,
    '周期按边界日的实际采样时间计算，并非严格午夜；新发现且缺少起始快照的项目不参与增长排序。',
    '嵌入式包含 MCU、RTOS、Linux、全志、Rockchip、系统构建及相关工具；分类是检索线索，不代表已验证硬件支持。',
    '嵌入式榜保留 BSP/内核分支；相同 GitHub 仓库 ID 去重，其他同源镜像仍可能出现。简介保留项目原文。', ''];
  for (const board of boards) {
    lines.push(`## ${board.title}`, '');
    if (!board.rows.length) lines.push('暂无满足完整观察周期及筛选条件的项目。', '');
    board.rows.forEach((r, i) => {
      lines.push(`### ${i + 1}. [${r.full_name}](https://github.com/${r.full_name})`, '',
        `⭐ ${r.stars.toLocaleString('en-US')}${r.delta !== undefined ? ` ｜净增 +${r.delta.toLocaleString('en-US')} ｜增长率 ${r.rate === null ? '基数为 0' : (r.rate * 100).toFixed(1) + '%'}` : ''}`,
        `语言：${plain(r.language || '未标注')}${r.embedded ? ` ｜分类：${tags(r).join(' / ')}` : ''}${r.fork ? ' ｜Fork/BSP 分支' : ''}`, '',
        plain(r.description || '项目未提供简介，请查看仓库。'), '',
        `最近代码推送：${r.pushed_at || '未知'}（不等同于本周期发布新版本）。`, '');
    });
  }
  return lines.join('\n');
}
