# 部署照片识别 Worker

照片识别通过这个 Cloudflare Worker 转发到 OpenAI Responses API。不要把 OpenAI API key 写到网页、GitHub 仓库或聊天消息中。

## 部署

1. 在 OpenAI Platform 创建 API key，并确认 API 计费已启用。ChatGPT 订阅不包含 API 费用。
2. 在电脑终端进入本目录，登录 Cloudflare：

   ```sh
   cd worker
   npx wrangler login
   ```

3. 依次设置两个服务端密钥：

   ```sh
   npx wrangler secret put OPENAI_API_KEY
   openssl rand -hex 32
   npx wrangler secret put FOOD_APP_TOKEN
   ```

   Wrangler 会提示输入密钥。`OPENAI_API_KEY` 粘贴 OpenAI API key；`FOOD_APP_TOKEN` 粘贴 `openssl` 输出的随机口令。请把随机口令暂时保存在自己的密码管理器中，不要提交到 GitHub。

4. 发布：

   ```sh
   npx wrangler deploy
   ```

   部署完成后，复制 Wrangler 显示的 `https://lean-plan-food.<Cloudflare 子域>.workers.dev` 地址。

5. 在网站“饮食”卡片的“设置照片识别服务”中填入 Worker 地址和 `FOOD_APP_TOKEN`，保存后即可拍摄或选择照片识别。

默认允许的网站来源写在 `wrangler.toml`，当前为 `https://wthypon.github.io`。如果 Pages 网站以后改用其他域名，请更新 `ALLOWED_ORIGIN` 后重新部署 Worker。网站本身必须通过 HTTPS 打开；直接用 `file://` 打开网页时，浏览器跨域限制会阻止照片识别。

## 数据与费用

Worker 仅转发压缩后的 JPG 照片，不接收年龄、性别、身高、体重、活动量或饮食日志。代码不保存照片或请求正文，并通过 `store: false` 关闭 Responses 应用状态存储。OpenAI API 默认不以 API 内容训练模型；滥用监测日志仍可能保留请求内容最多 30 天，详见 [OpenAI API 数据控制说明](https://developers.openai.com/api/docs/guides/your-data)。

Cloudflare Workers 有免费请求额度；OpenAI 图片识别按模型 API 使用量单独计费。发布前请在 OpenAI Platform 查看当前价格，并设置可用的支出限制或提醒。每次识别前，网站会显示照片将发送给 OpenAI API。

## 密钥轮换

若怀疑 `FOOD_APP_TOKEN` 泄露，重新运行 `openssl rand -hex 32`，然后执行 `npx wrangler secret put FOOD_APP_TOKEN` 并在网站保存新的口令。若 OpenAI API key 泄露，请在 OpenAI Platform 撤销并重新创建，再用 `npx wrangler secret put OPENAI_API_KEY` 更新。
