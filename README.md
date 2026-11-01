# GitHub 嵌入式项目雷达

卡片预览：[报告首页](https://xusz1602.github.io/github-news/)。支持移动端、榜单切换和项目搜索，项目卡片展示 README 原文短节选及来源链接。微信标题和正文均显示报告周期。

首次启用预览：仓库 **Settings → Pages → Build and deployment → Source → GitHub Actions**。`Publish Card Reports` 工作流会构建静态网页、补充 README 并部署到 GitHub Pages，无需购买域名或维护服务器。如首次部署在设置前失败，配置完成后手动重新运行该工作流。

更新网页不会改变已经发送到微信的旧链接。如需补发最新卡片入口，手动运行 `Resend Latest Card Report` 工作流；它会检查网页可访问后发送一次，明确绕过正常每日去重并保存补发回执。补发也消耗推送服务免费条数，请勿反复点击。

周报日期显示周一至周日，月报显示自然月第一天至最后一天；实际增长仍按下一边界日采样值计算。即时榜单显示“截至 YYYY-MM-DD 采样”。README 短节选保留项目原文，每个项目最多约 24 个词；完整说明请通过卡片来源链接查看。

每天采集 GitHub Star 快照，每周／每月生成四张 Top 10 榜单，通过 Server酱 Turbo 免费通道通知个人微信。无需服务器或付费 AI API。

## 首次部署

1. 新建一个 **公开 GitHub 仓库**。上传本项目全部文件，包括隐藏目录 `.github/workflows/radar.yml`，把代码提交到默认分支。
2. 打开仓库 **Settings → Actions → General → Workflow permissions**，允许 **Read and write permissions** 并保存。如果组织策略或默认分支保护禁止机器人直接提交，需要调整该仓库规则。
3. 在 [Server酱 Turbo](https://sct.ftqq.com/) 用微信登录，绑定默认微信服务号通道，获取 **SCT 开头的 SendKey**。先使用免费通道，无需购买会员。不要把 SendKey 提交到仓库或发到聊天中。
4. 仓库 **Settings → Secrets and variables → Actions → New repository secret**：名称 `SERVERCHAN_SENDKEY`，值为你的 SendKey。
5. 打开 **Actions → GitHub Embedded Radar → Run workflow**，选择 `test-push`，确认手机收到测试通知。新用户试用到期后也建议确认免费通道仍可接收。
6. 再手动运行一次，选择 `run`。成功后仓库会出现 `data/snapshots/日期.json`。从此自动执行，电脑无需开机。

仓库使用内置 `github.token` 读取公开数据及提交自身数据，不需要配置个人 GitHub Token。微信密钥只在推送步骤注入。公开仓库里的快照和报告均为公开信息，请勿加入私人备注或凭据。

## 时间与报告

- 每天北京时间约 **08:17** 运行，**12:47** 再检查补跑。定时任务有可能延迟，不保证准点。
- 周一生成上周报告，每月 1 日生成上月报告；同日的周报和月报合并为一条微信通知。
- 数据先提交，再发微信，保证微信里的报告链接已存在。
- 每个日期保留首次成功采样。周期以边界日实际采样时间为准，报告明确显示 UTC 时间戳，并非严格午夜统计。
- 无历史快照时无法回溯过去的增长；首个报告可能只有高星榜。完整周增长需积累整个周边界区间，月增长需积累整个月边界区间。
- 中途发现的老项目没有周期起始数据时，不参与该周期增长榜。
- 漏跑后补发已有边界快照的报告；若边界日全天未采集，不编造该期排名。
- 接口接受推送不等于微信最终送达。网络超时或推送成功后保存回执失败时，可能重复发送，第三方接口无法保证严格仅一次送达。

## 四张榜单

1. 全站高星 Top 10：检索的全站高星结果与其他候选池合并，排除 Fork、归档项目。
2. 监测池增长 Top 10：完整起止快照的 Star 净增量，排除 Fork，默认当前至少 20 星。
3. 嵌入式高星 Top 10：允许 BSP、内核等 Fork 分支。
4. 嵌入式增长 Top 10：完整起止快照的嵌入式项目净增量。

嵌入式覆盖 MCU、RTOS、嵌入式 Linux、全志/sunxi、Rockchip/RK3588/RK3568/RV1106、Amlogic、U-Boot、Buildroot、Yocto、Armbian、OpenWrt、驱动、设备树和开发板。关键词和 Topics 是候选分类依据，未通过 README 人工验证，不应当作硬件兼容承诺。

增长榜不是 GitHub 全量增长榜：搜索只发现部分项目，默认全站高星前 1000、近期新项目前 200、每条嵌入式查询前 200。曾经发现的项目会继续刷新，不因跌出搜索结果而停止统计。按 GitHub 仓库 ID 去重和处理更名；不同 ID 的同源镜像仍可能重复上榜，可用黑名单排除。

简介保留项目原文，没有自动翻译或 AI 摘要。最近代码推送时间不是 Release 发布信息。后续可选接入 AI，但核心功能不依赖任何 AI 免费额度。

## 配置

修改 `config.json`：

- `queries`：嵌入式候选检索词，各条分别查询，合并去重。
- `include`：强制纳入嵌入式的 `owner/repo`，适合厂商 BSP、低星但重要的项目。
- `exclude`：排除误匹配或镜像仓库；大小写不敏感。
- `globalPages` / `embeddedPages`：每页最多 100 个，每条查询不得超过 10 页。
- `minimumGrowthStars`：增长榜当前总星数下限。

建议保持北京时间配置；修改时区后应重新建立基线，避免混用旧快照日期。已经写入的历史报告不会随配置变化重写。

## 免费与维护边界

- 使用公开仓库的标准 Ubuntu GitHub-hosted Runner；不要改为收费的大型 Runner。无需租服务器或购买域名。
- Server酱 Turbo 当前免费额度为每天 5 条，本工具正常每天最多调用一次报告推送，测试推送另算。免费通知正文保留约 1 天，完整报告长期保存在仓库 `reports/`。
- 公开仓库连续 60 天无活动，GitHub 会停用定时工作流。每日真实快照提交让仓库正常更新；如任务长期报错，需要查看 Actions 失败信息并修复。
- 快照滚动保留 400 天，历史报告和通知状态保留。Git 历史仍会增长，长期使用可能需要归档旧数据。
- 第三方免费政策、微信通道和 API 都可能变化，无法承诺永久免费或永远无需调整。

## 本地运行（Node.js 22 以上，无第三方依赖）

```sh
npm test
# 设置 GITHUB_TOKEN 后：
node src/main.mjs collect
# 设置 SERVERCHAN_SENDKEY 和 GITHUB_REPOSITORY 后：
node src/main.mjs test-push
node src/main.mjs send
```

`GITHUB_REPOSITORY` 形如 `用户名/仓库名`；本地推送如默认分支不是 main，还需设置 `GITHUB_REF_NAME`。

## 排错

- 没有定时执行：确认工作流已提交到默认分支、Actions 已启用，必要时手动 Run workflow。
- `git push` 失败：检查 Workflow permissions 和分支保护；未成功保存数据时不会发报告。
- GitHub 403/429：限流会做有限重试，仍失败则停止写入部分快照，等待第二次运行补跑。
- 搜索不完整：重试后仍不完整则终止采集，防止部分数据污染榜单。
- 采集日志会显示每条查询、页码、结果数及已用时间。每次 HTTP 请求超时 20 秒，最多尝试 3 次；服务端要求等待超过 30 秒时直接退出，等待下次补跑。Node 采集进程最多运行 12 分钟，Actions 采集步骤最多 13 分钟，整个任务最多 18 分钟。
- 微信没收到：先运行 `test-push`，检查 Secret 名称、SCT 密钥、微信关注状态和 Server酱通道配置。
- Actions 的红色失败状态是主要故障记录；微信通道自身失效时，无法依靠同一微信通道提醒故障。

参考：[GitHub Actions 计费](https://docs.github.com/en/billing/concepts/product-billing/github-actions)、[定时任务限制](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)、[Server酱额度](https://sct.ftqq.com/docs/getting-started/faq/)。
