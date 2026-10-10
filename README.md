# 轻盈计划 · 手机适配网站

纯 HTML、CSS 和 JavaScript 的响应式单页网站，不依赖框架、第三方库或后端。身高、体重和选填体脂率仅在当前浏览器中用于计算计划，不会保存或上传。

## 打开方式

直接在浏览器打开 `index.html`，或在此目录运行任意静态文件服务器。部署时可发布到 GitHub Pages、Cloudflare Pages、Netlify 等静态托管服务。

## 当前功能

- 输入身高、体重及选填体脂率。
- 选择每天可运动 20、30、45、60 或 90 分钟，周期为 1–6 个月。
- 生成 BMI 参考、每周训练安排、逐月进阶、饮食习惯提示和每周复盘建议。
- 手机端纵向布局，桌面端双栏布局；支持打印/另存为 PDF。
- 成人确认、低 BMI 提示、基本输入范围校验。

## 说明

面向成年人的一般健康信息原型，不是诊断或医疗建议。BMI 低于 18.5 时不建议设置减脂目标。活动建议参考成人每周至少 150 分钟中等强度有氧活动和每周 2 天力量活动；基础信息不足以安全地计算个人热量目标，因此页面不生成热量处方或预测减重数字。

- [CDC：健康、循序渐进的体重管理](https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html)
- [美国卫生与公众服务部：成人活动指南摘要](https://odphp.health.gov/our-work/nutrition-physical-activity/physical-activity-guidelines/current-guidelines/top-10-things-know)
- [WHO：成人 BMI 参考](https://www.who.int/data/gho/data/indicators/indicator-details/GHO/prevalence-of-underweight-among-adults-bmi-18-%28crude-estimate%29-%28-%29)
