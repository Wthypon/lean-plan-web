# 轻盈计划 · 手机适配网站

轻量中文减脂规划网站，使用原生 HTML、CSS 和 JavaScript。个人资料、训练打卡、热量目标和饮食记录保存在当前浏览器；食物照片只会在用户选择照片并发起识别时，通过单独部署的 Worker 发送给 OpenAI API。

## 网站功能

- 输入身高、体重、年龄、生理性别、日常活动量和选填体脂率；设置每天可运动的时间和 1–6 个月周期。
- 生成 BMI 参考、逐周训练安排、逐月进阶、今日任务和每周复盘；训练完成后可点选打卡。
- 按年龄、性别、身高、体重、活动量估算基础代谢，并加入计划训练量，给出每日热量参考值。BMI 偏低时显示维持参考，不提供减脂热量目标。
- 拍摄或选择一餐照片，查看食物、份量和热量估算范围；确认或修正后再加入本机今日记录。
- 今日饮食卡片汇总记录的热量范围，并与每日参考值比较；也可手动补记、删除记录。
- 生成 6 位本机码、自动恢复、导出 JSON 备份和跨设备手动导入。
- 手机端底部导航、适配小屏幕的布局、较大的触控区域；支持打印 / 另存为 PDF。

## 照片识别配置

GitHub Pages 只托管静态网页，不能安全保存 OpenAI API 密钥。照片识别通过 Cloudflare Worker 转发；API 密钥留在 Worker Secret，不能填进网页、提交到仓库或发到聊天中。

1. 在 Cloudflare 创建账号，并在 OpenAI Platform 创建 API key。ChatGPT 订阅不包含 API 使用额度；模型调用按 API 价格另行计费。
2. 在本机安装 Node.js 后，进入 `worker` 目录并登录 Cloudflare：

   ```sh
   cd worker
   npx wrangler login
   ```

3. 设置 OpenAI API 密钥和仅供你自己使用的访问口令。第二条命令提示输入时，粘贴本机生成的随机口令；不要把它提交到 GitHub：

   ```sh
   npx wrangler secret put OPENAI_API_KEY
   openssl rand -hex 32
   npx wrangler secret put FOOD_APP_TOKEN
   ```

4. 发布 Worker：

   ```sh
   npx wrangler deploy
   ```

   Wrangler 会显示 `https://lean-plan-food.<你的 Cloudflare 子域>.workers.dev` 地址。

5. 打开轻盈计划，进入“饮食”页的“设置照片识别服务”，填入 Worker 地址和刚才生成的访问口令，然后保存。两项设置只保存在当前浏览器。若网站改用自定义域名，还需把 `worker/wrangler.toml` 的 `ALLOWED_ORIGIN` 改为新网站的来源并重新部署。

Cloudflare Workers 有免费请求额度，但 OpenAI API 模型调用单独计费，照片识别不能保证完全免费。请在 OpenAI Platform 查看当前模型与图片输入价格，并设置预算提醒。Worker 限制访问来源、校验本机口令和图片大小，不保存请求内容；不要开启会记录请求正文的调试日志。

## 隐私与数据保留

- 身高、体重、年龄、性别、日常活动量、推算目标和饮食记录只存在你当前浏览器的本地存储中；不会自动同步到云端。
- 点击识别后，所选照片会通过 Cloudflare Worker 发往 OpenAI API；身高、体重、年龄、性别、活动量和本机饮食记录不会随请求发送。网站和 Worker 代码均不保存照片。
- 请求使用 Responses API 的 `store: false`，关闭应用状态保存；OpenAI API 默认不以 API 内容训练模型，但滥用监测日志仍可能保留请求内容最多 30 天。细节见 [OpenAI API 数据控制说明](https://developers.openai.com/api/docs/guides/your-data)。
- 删除本机记录或清除浏览器数据会移除此浏览器里的饮食记录；Worker 口令可通过重新设置 `FOOD_APP_TOKEN` 来轮换。

## 本机资料与备份

6 位本机码只在相同浏览器和网站地址下查找资料，不是加密密码。备份 JSON 会包含个人资料；请妥善保管并在不需要时自行删除。饮食记录不会进入资料备份文件。

## 热量估算说明

基础代谢参考 Mifflin–St Jeor 公式，再按所选日常活动量与计划训练时长估算每日消耗；减脂参考值是应用内的粗略估算，并非医疗处方或精确测量。NIDDK 的 Body Weight Planner 同样以体重、性别、年龄、身高和活动水平作为估算输入，并说明其工具仅供成年人使用，不适用于孕期或哺乳期。若 BMI 偏低、身体不适、患有慢性病或正在用药，请咨询专业人士。

食物照片只能估计可见食物与份量，无法准确得知实际重量、用油、酱料或隐藏配料。请把 AI 结果当作区间参考，并在加入当天记录前核对或修改。

- [NIDDK Body Weight Planner](https://www.niddk.nih.gov/bwp)
- [Mifflin–St Jeor 静息能量公式研究](https://pubmed.ncbi.nlm.nih.gov/2305711/)
- [OpenAI 图片输入指南](https://developers.openai.com/api/docs/guides/images-vision)
- [Cloudflare Workers 请求限制](https://developers.cloudflare.com/workers/platform/limits/)
