const days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const CHECKIN_STORAGE_KEY = "lean-plan-week-checkins";
const FOOD_LOG_STORAGE_KEY = "lean-plan-food-log";
const FOOD_SETTINGS_STORAGE_KEY = "lean-plan-food-settings";
const MAX_FOOD_ENTRIES_PER_DAY = 30;
let pendingFoodEstimate = null;
let pendingFoodImageUrl = "";

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStart(date = new Date()) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function getWeekdayIndex(date = new Date()) {
  return (date.getDay() + 6) % 7;
}

function readWeekCheckins() {
  const week = dateKey(getWeekStart());
  try {
    const saved = JSON.parse(localStorage.getItem(CHECKIN_STORAGE_KEY) || "null");
    if (saved && saved.week === week && Array.isArray(saved.days) && saved.days.length === 7) {
      return saved.days.map(Boolean);
    }
  } catch (_) {
    // If storage is unavailable or malformed, the plan still works without saved check-ins.
  }
  return Array(7).fill(false);
}

function saveWeekCheckins(daysDone) {
  try {
    localStorage.setItem(CHECKIN_STORAGE_KEY, JSON.stringify({ week: dateKey(getWeekStart()), days: daysDone }));
  } catch (_) {
    // Private browsing or a full storage quota should not prevent check-ins for this session.
  }
}

function readFoodSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(FOOD_SETTINGS_STORAGE_KEY) || "{}");
    const endpoint = typeof saved.endpoint === "string" ? saved.endpoint.trim() : "";
    const token = typeof saved.token === "string" ? saved.token.trim() : "";
    return { endpoint, token };
  } catch (_) {
    return { endpoint: "", token: "" };
  }
}

function saveFoodSettings(settings) {
  try {
    localStorage.setItem(FOOD_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch (_) {
    return false;
  }
}

function readFoodLog() {
  try {
    const saved = JSON.parse(localStorage.getItem(FOOD_LOG_STORAGE_KEY) || "{}");
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch (_) {
    return {};
  }
}

function readTodayFoodEntries() {
  const entries = readFoodLog()[dateKey(new Date())];
  return Array.isArray(entries) ? entries.filter((entry) =>
    entry && typeof entry.id === "string" && typeof entry.name === "string" &&
    Number.isFinite(entry.low) && Number.isFinite(entry.high) && entry.low >= 0 && entry.high >= entry.low
  ).slice(0, MAX_FOOD_ENTRIES_PER_DAY) : [];
}

function saveTodayFoodEntries(entries) {
  try {
    const log = readFoodLog();
    log[dateKey(new Date())] = entries.slice(0, MAX_FOOD_ENTRIES_PER_DAY);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    Object.keys(log).forEach((key) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || new Date(`${key}T00:00:00`).getTime() < cutoff.getTime()) delete log[key];
    });
    localStorage.setItem(FOOD_LOG_STORAGE_KEY, JSON.stringify(log));
    return true;
  } catch (_) {
    return false;
  }
}

function buildWeekPlan(minutes) {
  const warmupMinutes = Math.min(5, Math.max(3, Math.round(minutes * 0.1)));
  const workMinutes = minutes - warmupMinutes;
  const strengthMinutes = Math.max(8, Math.round(workMinutes * 0.55));
  const cardioMinutes = Math.max(0, workMinutes - strengthMinutes);
  const strengthA = `先活动关节 ${warmupMinutes} 分钟；徒手深蹲、臀桥、跪姿俯卧撑各做 2 组、每组 8–12 次；平板支撑 2 组、每组 20–30 秒。力量约 ${strengthMinutes} 分钟，再轻快走 ${cardioMinutes} 分钟。`;
  const strengthB = `先活动关节 ${warmupMinutes} 分钟；反向弓步、背包划船、髋铰链、死虫各做 2 组、每组 8–12 次。力量约 ${strengthMinutes} 分钟，再轻快走 ${cardioMinutes} 分钟。`;
  return [
    { day: days[0], title: "力量 A + 快走", detail: strengthA, kind: "strength" },
    { day: days[1], title: "有氧：快走 / 骑车", detail: `共 ${minutes} 分钟，从轻松速度逐步加快；保持能说短句、略微喘的强度。`, kind: "cardio" },
    { day: days[2], title: "力量 B + 快走", detail: strengthB, kind: "strength" },
    { day: days[3], title: "轻松有氧 + 灵活性", detail: `轻松走 ${Math.round(minutes * 0.7)} 分钟，再做髋、胸椎和小腿活动 ${Math.max(5, minutes - Math.round(minutes * 0.7))} 分钟。`, kind: "recovery" },
    { day: days[4], title: "力量 A / B 交替", detail: `沿用周一或周三动作；热身 ${warmupMinutes} 分钟、力量约 ${strengthMinutes} 分钟，再轻快走 ${cardioMinutes} 分钟。`, kind: "strength" },
    { day: days[5], title: "有氧：户外步行", detail: `快走、骑车或游泳 ${minutes} 分钟；选一种能持续的活动。`, kind: "cardio" },
    { day: days[6], title: "休息", detail: "不安排正式训练。散步和日常活动随意，感觉疲劳时优先休息。", kind: "rest" }
  ];
}

function buildMonths(months, minutes) {
  const phases = [
    { title: "建立节奏", focus: "先把训练做得规律、动作做得舒服。", actions: ["前两周每次做可用时长的 60–70%；先完成 2 次力量和 2–3 次快走，其余训练日可散步或休息。", "适应良好后再加入第 3 次力量训练，记录训练和体重趋势。"] },
    { title: "稳定执行", focus: "让力量训练覆盖全身，逐渐形成固定周计划。", actions: ["每周安排 3 次全身力量、2–3 次中等强度有氧。", `单次训练上限为 ${minutes} 分钟；先增加动作次数，再增加难度。`] },
    { title: "循序进阶", focus: "在恢复良好的前提下，给身体一点新刺激。", actions: ["每个动作逐步增加 1–2 次重复，或增加一组；每周只改一项。", "有氧以快走、骑车等可持续活动为主，不需要每次练到力竭。"] },
    { title: "巩固习惯", focus: "保持训练频率，让饮食和活动都能长期坚持。", actions: ["维持每周 2–3 次力量训练；训练忙时缩短单次时长，不必完全跳过。", "若连续疲劳或睡眠变差，安排一周减量，训练量降约三分之一。"] },
    { title: "稳步推进", focus: "通过体重均值和训练表现判断方向，而非追逐单日数字。", actions: ["继续记录每周体重均值、训练次数和精神状态。", "若 2–3 周均值无变化，先检查饮料、零食和份量，再做小幅调整。"] },
    { title: "复盘与延续", focus: "把有效的安排留下来，为下一个阶段做好准备。", actions: ["复盘哪些训练和饮食习惯最容易坚持，保留它们。", "周期结束后转入可持续的维持计划，不用突然加练或极端节食。"] }
  ];
  return Array.from({ length: months }, (_, index) => ({ month: index + 1, ...phases[Math.min(index, phases.length - 1)] }));
}

function estimateDailyCalories({ height, weight, age, sex, activity, minutes }, isLowWeight) {
  if (!age || !sex || !activity) return null;
  const resting = 10 * weight + 6.25 * height - 5 * age + (sex === "male" ? 5 : -161);
  const dailyActivityFactor = { sedentary: 1.2, light: 1.35, active: 1.5 }[activity] || 1.2;
  const plannedTrainingAverage = 3 * weight * (minutes / 60) * (6 / 7);
  const maintenance = resting * dailyActivityFactor + plannedTrainingAverage;
  const target = isLowWeight ? maintenance : maintenance * 0.9;
  return {
    maintenance: Math.round(maintenance / 10) * 10,
    target: Math.round(target / 10) * 10,
    isMaintenanceOnly: isLowWeight
  };
}

function buildPlan({ height, weight, bodyFat, age, sex, activity, minutes, months }) {
  const bmi = weight / ((height / 100) ** 2);
  const isLowWeight = bmi < 18.5;
  return {
    bmi: bmi.toFixed(1),
    isLowWeight,
    bodyFat,
    age,
    sex,
    activity,
    minutes,
    months,
    calorieEstimate: estimateDailyCalories({ height, weight, age, sex, activity, minutes }, isLowWeight),
    weekPlan: buildWeekPlan(minutes),
    monthPlan: buildMonths(months, minutes)
  };
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

const LOCAL_PROFILES_STORAGE_KEY = "lean-plan-local-profiles";
const ACTIVE_PROFILE_CODE_STORAGE_KEY = "lean-plan-active-profile-code";
const restoreCard = document.querySelector("#profile-restore-card");
const restoreDivider = document.querySelector("#profile-restore-divider");
const restoreCodeInput = document.querySelector("#restore-profile-code");
const restoreButton = document.querySelector("#restore-profile-button");
const restoreStatus = document.querySelector("#profile-restore-status");
const backupInput = document.querySelector("#profile-backup-input");
const rememberCodeCheckbox = document.querySelector("#remember-binding-code");
let currentBindingCode = loadRememberedBindingCode();
let bindingStatusMessage = "";
let bindingStatusError = false;
if (currentBindingCode && rememberCodeCheckbox) rememberCodeCheckbox.checked = true;

function loadRememberedBindingCode() {
  try {
    const value = localStorage.getItem(ACTIVE_PROFILE_CODE_STORAGE_KEY) || "";
    return /^\d{6}$/.test(value) ? value : "";
  } catch (_) {
    return "";
  }
}

function saveRememberedBindingCode(code) {
  try {
    if (rememberCodeCheckbox?.checked && code) localStorage.setItem(ACTIVE_PROFILE_CODE_STORAGE_KEY, code);
    else localStorage.removeItem(ACTIVE_PROFILE_CODE_STORAGE_KEY);
  } catch (_) {
    // The user can still use or export the code for this session.
  }
}

function validateLocalProfile(value) {
  if (!value || typeof value !== "object") return null;
  const height = Number(value.height);
  const weight = Number(value.weight);
  const bodyFat = value.bodyFat === null || value.bodyFat === "" || value.bodyFat === undefined ? null : Number(value.bodyFat);
  const minutes = Number(value.minutes);
  const months = Number(value.months);
  const age = value.age === null || value.age === "" || value.age === undefined ? null : Number(value.age);
  const sex = value.sex === "female" || value.sex === "male" ? value.sex : "";
  const activity = ["sedentary", "light", "active"].includes(value.activity) ? value.activity : "";
  const hasEstimateFields = age !== null || Boolean(value.sex) || Boolean(value.activity);
  if (!Number.isFinite(height) || height < 100 || height > 230) return null;
  if (!Number.isFinite(weight) || weight < 25 || weight > 300) return null;
  if (bodyFat !== null && (!Number.isFinite(bodyFat) || bodyFat < 3 || bodyFat > 70)) return null;
  if (hasEstimateFields && (!Number.isInteger(age) || age < 18 || age > 100 || !sex || !activity)) return null;
  if (![20, 30, 45, 60, 90].includes(minutes)) return null;
  if (!Number.isInteger(months) || months < 1 || months > 6) return null;
  return { height, weight, bodyFat, age, sex, activity, minutes, months };
}

function readLocalProfiles() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_PROFILES_STORAGE_KEY) || "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved)
      .filter(([code]) => /^\d{6}$/.test(code))
      .map(([code, profile]) => [code, validateLocalProfile(profile)])
      .filter(([, profile]) => profile));
  } catch (_) {
    return {};
  }
}

function writeLocalProfiles(profiles) {
  try {
    localStorage.setItem(LOCAL_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
    return true;
  } catch (_) {
    return false;
  }
}

function generateLocalBindingCode(profiles) {
  if (!window.crypto?.getRandomValues) throw new Error("当前浏览器无法生成安全的随机码。");
  const max = 0x100000000;
  const bound = Math.floor(max / 1_000_000) * 1_000_000;
  const numbers = new Uint32Array(1);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    do window.crypto.getRandomValues(numbers); while (numbers[0] >= bound);
    const code = String(numbers[0] % 1_000_000).padStart(6, "0");
    if (!profiles[code]) return code;
  }
  throw new Error("暂时无法生成新绑定码，请重试。");
}

function setRestoreStatus(message, isError = false) {
  if (!restoreStatus) return;
  restoreStatus.textContent = message;
  restoreStatus.classList.toggle("is-error", isError);
}

function setBindingStatus(message, isError = false) {
  bindingStatusMessage = message;
  bindingStatusError = isError;
  const element = output.querySelector(".binding-status");
  if (element) {
    element.textContent = message;
    element.classList.toggle("is-error", isError);
  }
}

function getFormProfile() {
  const data = readForm();
  return {
    height: data.height,
    weight: data.weight,
    bodyFat: data.bodyFat,
    age: data.age,
    sex: data.sex,
    activity: data.activity,
    minutes: data.minutes,
    months: data.months
  };
}

function applySavedProfile(profile) {
  form.elements.height.value = profile.height;
  form.elements.weight.value = profile.weight;
  form.elements.bodyFat.value = profile.bodyFat === null ? "" : profile.bodyFat;
  form.elements.age.value = profile.age ?? "";
  form.elements.sex.value = profile.sex || "";
  form.elements.activity.value = profile.activity || "";
  form.elements.minutes.value = String(profile.minutes);
  form.elements.months.value = String(profile.months);
  form.elements.adultConfirm.checked = false;
  currentPlan = null;
  results.hidden = true;
  setResultsNavigationEnabled(false);
  setNavigationActive("planner");
  errorMessage.textContent = "";
}

function renderBindingCard() {
  const codeRow = currentBindingCode
    ? `<div class="binding-code-row"><span class="binding-code-label">你的 6 位本机码</span><strong class="binding-code-value">${escapeHTML(currentBindingCode)}</strong><button class="binding-action-secondary" type="button" data-copy-binding-code>复制</button></div>`
    : `<p class="binding-local-intro">创建后，资料和绑定码只保存在当前浏览器，不会上传。需要换设备时，可下载备份文件并手动导入。</p>`;
  const actionButtons = currentBindingCode
    ? `<button class="binding-action" type="button" data-update-binding>保存本机资料</button><button class="binding-action" type="button" data-export-binding>导出备份</button><button class="binding-action binding-action-danger" type="button" data-delete-binding>删除本机资料</button>`
    : `<button class="binding-action" type="button" data-create-binding>生成 6 位本机码并保存</button>`;
  return `<section class="binding-card" aria-labelledby="binding-card-title">
    <div class="binding-card-heading"><div><h3 id="binding-card-title">本机资料卡</h3><p>资料仅保存在此浏览器的本机存储中。</p></div><span class="binding-home-mark" aria-hidden="true">⌂</span></div>
    ${codeRow}
    <div class="binding-actions">${actionButtons}</div>
    <p class="binding-status ${bindingStatusError ? "is-error" : ""}" role="status" aria-live="polite">${escapeHTML(bindingStatusMessage)}</p>
    <p class="binding-warning">本机码只在同一浏览器、同一网站地址有效，不是加密密码；清除浏览器数据会删除资料。换设备请导出备份并自行传输，文件包含绑定码和个人资料，请妥善保管。</p>
  </section>`;
}

let foodStatusMessage = "照片识别服务需要先配置；也可以直接手动记录。";
let foodStatusError = false;

function formatCalories(value) {
  return Math.max(0, Math.round(Number(value) || 0)).toLocaleString("zh-CN");
}

function renderFoodDiary(plan) {
  const entries = readTodayFoodEntries();
  const totalLow = entries.reduce((sum, entry) => sum + entry.low, 0);
  const totalHigh = entries.reduce((sum, entry) => sum + entry.high, 0);
  const totalMiddle = Math.round((totalLow + totalHigh) / 2);
  const target = plan.calorieEstimate?.target || 0;
  const percent = target > 0 ? Math.min(100, Math.round((totalMiddle / target) * 100)) : 0;
  let summary = "记下今天吃的东西，这里会汇总估算摄入。";
  if (entries.length && totalLow > target) summary = `按估算范围，今日已比目标多约 ${formatCalories(totalLow - target)}–${formatCalories(totalHigh - target)} 千卡。`;
  else if (entries.length && totalHigh > target) summary = "摄入接近目标；份量、用油和酱料会影响实际热量。";
  else if (entries.length) summary = `按估算中值，今日约剩 ${formatCalories(target - totalMiddle)} 千卡。实际摄入可能有较大误差。`;
  const meals = entries.length
    ? `<ul class="food-entry-list">${entries.map((entry) => `
        <li class="food-entry" data-food-entry-id="${escapeHTML(entry.id)}">
          <time>${escapeHTML(entry.time || "今天")}</time>
          <div class="food-entry-description"><strong>${escapeHTML(entry.name)}</strong><span>${escapeHTML(entry.detail || "饮食记录")}</span></div>
          <strong class="food-entry-calories">${formatCalories(entry.low)}–${formatCalories(entry.high)}<small>千卡</small></strong>
          <button class="food-entry-remove" type="button" data-remove-food-entry="${escapeHTML(entry.id)}" aria-label="删除${escapeHTML(entry.name)}">删除</button>
        </li>`).join("")}</ul>`
    : `<p class="food-empty">今天还没有饮食记录。</p>`;
  const estimateLabel = plan.isLowWeight ? "每日维持参考" : "每日减脂参考";
  return `<section id="nutrition-diary" class="nutrition-diary" aria-labelledby="nutrition-title">
    <div class="nutrition-heading"><div><p class="eyebrow">今天吃了什么</p><h3 id="nutrition-title">今日饮食</h3></div><span class="nutrition-date">${new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(new Date())}</span></div>
    <div class="nutrition-overview">
      <div class="nutrition-total"><span>今日估算摄入</span><strong>${entries.length ? `${formatCalories(totalLow)}–${formatCalories(totalHigh)}` : "0"}<small>千卡</small></strong></div>
      <div class="nutrition-target"><span>${estimateLabel}</span><strong>约 ${formatCalories(target)}<small>千卡 / 天</small></strong></div>
    </div>
    <div class="nutrition-progress" role="progressbar" aria-label="今日摄入与参考目标对比" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div>
    <p class="nutrition-summary ${entries.length && totalLow > target ? "is-over" : ""}" aria-live="polite">${escapeHTML(summary)}</p>
    <div class="food-photo-actions">
      <label class="food-photo-button" for="food-photo-input"><span aria-hidden="true">▧</span>拍摄 / 选择食物照片</label>
      <input id="food-photo-input" class="visually-hidden" type="file" accept="image/*" capture="environment">
      <p>照片会发送给 OpenAI API 识别；本机不保存照片。确认估算后才记入本机日志。</p>
    </div>
    <div id="food-analysis-status" class="food-analysis-status ${foodStatusError ? "is-error" : ""}" role="status" aria-live="polite">${escapeHTML(foodStatusMessage)}</div>
    <div id="food-analysis-preview" class="food-analysis-preview"></div>
    ${meals}
    <details class="food-manual-entry"><summary>手动补记一餐</summary>
      <form id="manual-food-form" class="manual-food-form">
        <label>餐食名称<input id="manual-food-name" type="text" maxlength="60" placeholder="例如：早餐" required></label>
        <div class="manual-food-calories"><label>最低估算（千卡）<input id="manual-food-low" type="number" min="0" max="5000" step="10" required></label><label>最高估算（千卡）<input id="manual-food-high" type="number" min="0" max="5000" step="10" required></label></div>
        <button class="binding-action" type="submit">加入今日记录</button>
      </form>
    </details>
    <details class="food-service-settings"><summary>设置照片识别服务</summary>
      <form id="food-service-form" class="food-service-form">
        <label>服务地址<input id="food-service-endpoint" type="url" inputmode="url" autocomplete="url" placeholder="https://你的服务名.workers.dev" value="${escapeHTML(readFoodSettings().endpoint)}"></label>
        <label>本机访问口令<input id="food-service-token" type="password" autocomplete="off" placeholder="粘贴部署时设置的访问口令" value="${escapeHTML(readFoodSettings().token)}"></label>
        <button class="binding-action" type="submit">保存本机设置</button>
      </form>
      <p class="food-service-note">OpenAI 密钥只放在服务端，切勿填进此网页。识别服务部署说明见 <a href="https://github.com/Wthypon/lean-plan-web/blob/main/worker/README.md" target="_blank" rel="noopener">配置指南</a>。OpenAI API 按使用量计费。</p>
      <p class="food-service-note">年龄、性别、活动量、热量目标和饮食记录保存在本机；请求只发送所选照片，不带个人档案。OpenAI 默认不使用 API 内容训练模型，但滥用监测日志可能保留内容最多 30 天；本服务关闭 Responses 应用状态保存。<a href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noopener">数据保留说明</a></p>
    </details>
    <p class="calorie-estimate-note">目标根据基础代谢、日常活动量和计划训练时间粗略估算，不是医疗处方。食物热量来自照片推测，份量、烹调油和隐藏配料会造成误差；可手动修正。</p>
  </section>`;
}

function renderFoodAnalysisPreview(estimate) {
  const container = output.querySelector("#food-analysis-preview");
  if (!container) return;
  if (!estimate) {
    container.innerHTML = "";
    return;
  }
  const items = estimate.items.length
    ? `<ul>${estimate.items.map((item) => `<li><span>${escapeHTML(item.name)} · ${escapeHTML(item.portion)}</span><strong>${formatCalories(item.kcal_low)}–${formatCalories(item.kcal_high)} 千卡</strong></li>`).join("")}</ul>`
    : `<p class="food-empty">暂时无法从照片辨认食物，请换个角度拍摄或手动记录。</p>`;
  container.innerHTML = `<div class="food-preview-card">
    ${pendingFoodImageUrl ? `<img src="${escapeHTML(pendingFoodImageUrl)}" alt="本次选择的餐食照片">` : ""}
    <div class="food-preview-content"><strong class="food-preview-title">${escapeHTML(estimate.meal_name)}</strong>${items}<p>${escapeHTML(estimate.note)}</p>
      ${estimate.items.length ? `<div class="food-preview-confirm"><label>名称<input id="food-confirm-name" type="text" maxlength="60" value="${escapeHTML(estimate.meal_name)}"></label><label>估算下限<input id="food-confirm-low" type="number" min="0" max="5000" step="10" value="${estimate.total_kcal_low}"></label><label>估算上限<input id="food-confirm-high" type="number" min="0" max="5000" step="10" value="${estimate.total_kcal_high}"></label><button class="binding-action" type="button" data-confirm-food>确认并记入今天</button></div>` : ""}
    </div>
  </div>`;
}

function normalizeFoodEstimate(value) {
  const number = (input) => Number.isInteger(input) && input >= 0 && input <= 5000 ? input : null;
  if (!value || !Array.isArray(value.items) || value.items.length > 12) throw new Error("识别结果格式不完整，请重新拍摄或手动记录。");
  const items = value.items.map((item) => {
    const low = number(item?.kcal_low);
    const high = number(item?.kcal_high);
    if (!item || typeof item.name !== "string" || typeof item.portion !== "string" || low === null || high === null || high < low) {
      throw new Error("识别结果格式不完整，请重新拍摄或手动记录。");
    }
    return { name: item.name.slice(0, 40), portion: item.portion.slice(0, 40), kcal_low: low, kcal_high: high };
  });
  const total_kcal_low = number(value.total_kcal_low);
  const total_kcal_high = number(value.total_kcal_high);
  if (total_kcal_low === null || total_kcal_high === null || total_kcal_high < total_kcal_low) {
    throw new Error("识别结果格式不完整，请重新拍摄或手动记录。");
  }
  return {
    meal_name: String(value.meal_name || "本餐").slice(0, 60),
    items,
    total_kcal_low,
    total_kcal_high,
    note: String(value.note || "热量仅为照片估算，请结合实际份量确认。").slice(0, 240)
  };
}

function validateFoodServiceSettings() {
  const settings = readFoodSettings();
  if (!settings.endpoint || !settings.token) throw new Error("请先展开“设置照片识别服务”，填入服务地址和本机访问口令。");
  let endpoint;
  try { endpoint = new URL(settings.endpoint); } catch (_) { throw new Error("服务地址格式不正确。"); }
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) throw new Error("照片识别服务必须使用有效的 HTTPS 地址。");
  return { endpoint: endpoint.href, token: settings.token };
}

async function compressFoodImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("请选择图片文件。");
  if (file.size > 20 * 1024 * 1024) throw new Error("照片不能超过 20 MB。");
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("无法读取这张照片，请改用 JPG 或 PNG 后重试；HEIC 照片可先转换为 JPG。"));
      element.src = sourceUrl;
    });
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) throw new Error("照片压缩失败，请换一张照片重试。");
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("照片读取失败，请重试。"));
      reader.readAsDataURL(blob);
    });
    return { imageData: dataUrl.split(",")[1], mimeType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

async function requestFoodEstimate(image) {
  const settings = validateFoodServiceSettings();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 60_000);
  let response;
  try {
    response = await fetch(settings.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.token}` },
      body: JSON.stringify(image),
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") throw new Error("识别等待时间过长，请检查网络后重试。");
    throw new Error("无法连接识别服务，请检查网络，并确认 Worker 允许当前网站地址访问。");
  } finally {
    window.clearTimeout(timeout);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `识别失败（${response.status}），请检查服务设置后重试。`);
  if (!payload.estimate) throw new Error("识别服务没有返回可用的估算结果。");
  return normalizeFoodEstimate(payload.estimate);
}

function addFoodEntry({ name, low, high, detail, items = [] }) {
  if (!name.trim() || !Number.isFinite(low) || !Number.isFinite(high) || low < 0 || high < low || high > 5000) {
    setFoodStatus("请检查餐食名称和热量范围。", true);
    return false;
  }
  const entries = readTodayFoodEntries();
  if (entries.length >= MAX_FOOD_ENTRIES_PER_DAY) {
    setFoodStatus("今天的记录已达到上限。", true);
    return false;
  }
  const id = window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const entry = {
    id,
    time: new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
    name: name.trim().slice(0, 60),
    low: Math.round(low),
    high: Math.round(high),
    detail: String(detail || "饮食记录").slice(0, 240),
    items: items.slice(0, 12).map((item) => ({ name: String(item.name).slice(0, 40), portion: String(item.portion).slice(0, 40) }))
  };
  if (!saveTodayFoodEntries([entry, ...entries])) {
    setFoodStatus("本机存储不可用，无法保存饮食记录。", true);
    return false;
  }
  pendingFoodEstimate = null;
  if (pendingFoodImageUrl) URL.revokeObjectURL(pendingFoodImageUrl);
  pendingFoodImageUrl = "";
  setFoodStatus("已记入今天，饮食记录仅保存在本机。", false);
  renderPlan(currentPlan);
  return true;
}

function setFoodStatus(message, isError = false) {
  foodStatusMessage = message;
  foodStatusError = isError;
  const status = output?.querySelector("#food-analysis-status");
  if (status) {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }
}

function wireFoodDiary(plan) {
  const settingsForm = output.querySelector("#food-service-form");
  settingsForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const endpoint = output.querySelector("#food-service-endpoint").value.trim();
    const token = output.querySelector("#food-service-token").value.trim();
    let parsedUrl;
    try { parsedUrl = new URL(endpoint); } catch (_) { setFoodStatus("请填写有效的 HTTPS 服务地址。", true); return; }
    if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password) {
      setFoodStatus("服务地址必须使用有效的 HTTPS 地址。", true);
      return;
    }
    if (token.length < 20 || token.length > 200) {
      setFoodStatus("访问口令长度不正确，请粘贴部署时生成的完整口令。", true);
      return;
    }
    if (!saveFoodSettings({ endpoint: parsedUrl.href, token })) {
      setFoodStatus("无法保存在本机，请检查浏览器存储设置。", true);
      return;
    }
    setFoodStatus("照片识别服务设置已保存在本机。", false);
  });

  const photoInput = output.querySelector("#food-photo-input");
  photoInput?.addEventListener("change", async () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    const button = output.querySelector(".food-photo-button");
    photoInput.disabled = true;
    if (button) button.classList.add("is-loading");
    pendingFoodEstimate = null;
    if (pendingFoodImageUrl) URL.revokeObjectURL(pendingFoodImageUrl);
    pendingFoodImageUrl = "";
    renderFoodAnalysisPreview(null);
    try {
      setFoodStatus("正在压缩照片…", false);
      const image = await compressFoodImage(file);
      setFoodStatus("照片将发送给 OpenAI 估算餐食和份量…", false);
      const estimate = await requestFoodEstimate(image);
      if (pendingFoodImageUrl) URL.revokeObjectURL(pendingFoodImageUrl);
      pendingFoodImageUrl = URL.createObjectURL(file);
      pendingFoodEstimate = estimate;
      renderFoodAnalysisPreview(estimate);
      setFoodStatus("请核对餐食和热量范围，确认后才会记入本机。", false);
    } catch (error) {
      setFoodStatus(error.message || "识别失败，请稍后重试。", true);
    } finally {
      photoInput.value = "";
      photoInput.disabled = false;
      if (button) button.classList.remove("is-loading");
    }
  });

  output.querySelector("[data-confirm-food]")?.addEventListener("click", () => {
    if (!pendingFoodEstimate) return;
    addFoodEntry({
      name: output.querySelector("#food-confirm-name").value,
      low: Number(output.querySelector("#food-confirm-low").value),
      high: Number(output.querySelector("#food-confirm-high").value),
      detail: pendingFoodEstimate.items.map((item) => `${item.name} ${item.portion}`).join("、"),
      items: pendingFoodEstimate.items
    });
  });

  output.querySelector("#manual-food-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const low = Number(output.querySelector("#manual-food-low").value);
    const high = Number(output.querySelector("#manual-food-high").value);
    addFoodEntry({ name: output.querySelector("#manual-food-name").value, low, high, detail: "手动记录" });
  });

  output.querySelectorAll("[data-remove-food-entry]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.removeFoodEntry;
      const entries = readTodayFoodEntries().filter((entry) => entry.id !== id);
      if (!saveTodayFoodEntries(entries)) {
        setFoodStatus("本机存储不可用，无法删除记录。", true);
        return;
      }
      setFoodStatus("已删除这条本机记录。", false);
      renderPlan(currentPlan);
    });
  });

  renderFoodAnalysisPreview(pendingFoodEstimate);
}

function restoreLocalProfile(code, automatic = false) {
  if (!/^\d{6}$/.test(code)) {
    setRestoreStatus("请输入完整的 6 位数字绑定码。", true);
    return;
  }
  const profile = readLocalProfiles()[code];
  if (!profile) {
    if (automatic) {
      currentBindingCode = "";
      saveRememberedBindingCode("");
    }
    setRestoreStatus("此浏览器和网站地址没有对应资料。绑定码不能单独跨设备恢复；请在原设备导出备份文件。", true);
    return;
  }
  currentBindingCode = code;
  saveRememberedBindingCode(code);
  applySavedProfile(profile);
  setRestoreStatus(profile.age ? "本机资料已恢复。请再次确认适用范围，再生成计划。" : "旧资料已恢复；请补填年龄、性别和日常活动量，以估算每日热量目标。", !profile.age);
  bindingStatusMessage = "资料已从当前浏览器恢复；修改后点“保存本机资料”。";
  bindingStatusError = false;
}

async function importLocalBackup(file) {
  if (file.size > 50_000) throw new Error("备份文件过大，无法导入。");
  const backup = JSON.parse(await file.text());
  const profile = validateLocalProfile(backup?.profile);
  if (backup?.app !== "lean-plan-web" || backup?.version !== 1 || !/^\d{6}$/.test(backup?.code || "") || !profile) {
    throw new Error("备份文件格式不正确或版本不受支持。");
  }
  const profiles = readLocalProfiles();
  const existing = profiles[backup.code];
  if (existing && JSON.stringify(existing) !== JSON.stringify(profile) &&
    !window.confirm("此浏览器已存在相同绑定码但资料不同。导入会覆盖本机这条资料，继续吗？")) {
    setRestoreStatus("已取消导入，现有本机资料未更改。", false);
    return;
  }
  profiles[backup.code] = profile;
  if (!writeLocalProfiles(profiles)) throw new Error("本机存储不可用，无法导入资料。");
  currentBindingCode = backup.code;
  saveRememberedBindingCode(currentBindingCode);
  if (restoreCodeInput) restoreCodeInput.value = currentBindingCode;
  applySavedProfile(profile);
  setRestoreStatus("备份已在本机导入。请再次确认适用范围，再生成计划。");
  bindingStatusMessage = "备份已导入此浏览器。";
  bindingStatusError = false;
}

function exportLocalBackup() {
  if (!currentBindingCode) throw new Error("请先创建本机码或恢复一份本机资料。");
  const profile = validateLocalProfile(getFormProfile());
  if (!profile) throw new Error("请先检查身高、体重、体脂率和计划选项。");
  const profiles = readLocalProfiles();
  if (!profiles[currentBindingCode]) throw new Error("本机没有找到这条资料，请重新创建本机码。");
  profiles[currentBindingCode] = profile;
  if (!writeLocalProfiles(profiles)) throw new Error("本机存储不可用，无法生成备份。");
  const backup = {
    app: "lean-plan-web",
    version: 1,
    savedAt: new Date().toISOString(),
    code: currentBindingCode,
    profile
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lean-plan-backup-${dateKey(new Date())}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  setBindingStatus("备份文件已下载到设备。可手动传到另一台设备后导入。", false);
}

const form = document.querySelector("#planner-form");
const results = document.querySelector("#results");
const output = document.querySelector("#plan-output");
const errorMessage = document.querySelector("#form-error");
const printButton = document.querySelector("#print-plan");
let currentPlan = null;
let showAllMonths = false;
let lastRenderedDate = dateKey(new Date());

function readForm() {
  return {
    height: Number(form.elements.height.value),
    weight: Number(form.elements.weight.value),
    bodyFat: form.elements.bodyFat.value === "" ? null : Number(form.elements.bodyFat.value),
    age: form.elements.age.value === "" ? null : Number(form.elements.age.value),
    sex: form.elements.sex.value,
    activity: form.elements.activity.value,
    minutes: Number(form.elements.minutes.value),
    months: Number(form.elements.months.value)
  };
}

function renderPlan(plan) {
  const today = new Date();
  const todayIndex = getWeekdayIndex(today);
  const todayPlan = plan.weekPlan[todayIndex];
  const weekCheckins = readWeekCheckins();
  const dateLabel = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(today);
  const bmiNote = plan.isLowWeight
    ? "当前 BMI 偏低，不建议设置减脂目标。BMI 仅作筛查参考，不能单独判断体脂或健康状况。"
    : "BMI 仅作粗略参考，不能单独判断体脂或健康状况。计划不会预测具体减重结果。";
  const bodyFatNote = plan.bodyFat === null
    ? ""
    : `<p class="bodyfat-note">已记录体脂率：${escapeHTML(plan.bodyFat)}% · 建议用同一设备和时段观察趋势</p>`;
  const lowWeightAlert = plan.isLowWeight
    ? `<div class="lowweight-alert">体重偏低时不建议主动减重。下方安排请用于保持活动和基础力量，建议先与医疗专业人士讨论目标。</div>`
    : "";
  const todayCard = `
    <section class="today-plan-card ${weekCheckins[todayIndex] ? "is-complete" : ""}" aria-labelledby="today-plan-title">
      <div class="today-plan-top"><span class="today-date"><i aria-hidden="true"></i>${dateLabel}</span><span class="today-plan-label">${todayPlan.kind === "rest" ? "恢复日" : "今日训练"}</span></div>
      <h3 id="today-plan-title">今天的安排</h3>
      <strong class="today-task-title">${escapeHTML(todayPlan.title)}</strong>
      <p class="today-task-detail">${escapeHTML(todayPlan.detail)}</p>
      <label class="today-complete-control">
        <input class="checkin-toggle" type="checkbox" data-day-index="${todayIndex}" ${weekCheckins[todayIndex] ? "checked" : ""}>
        <span class="checkin-box" aria-hidden="true"></span>
        <span class="today-check-label">${weekCheckins[todayIndex] ? "今天已完成" : "完成今天安排"}</span>
      </label>
    </section>`;
  const weekCards = plan.weekPlan.map((item, index) => `
    <article class="day-card ${index === todayIndex ? "is-today" : ""} ${weekCheckins[index] ? "is-complete" : ""}">
      <span class="day-name ${item.kind}">${item.day}${index === todayIndex ? `<small class="today-badge">今天</small>` : ""}</span>
      <div><strong class="day-title">${escapeHTML(item.title)}</strong><span class="day-detail">${escapeHTML(item.detail)}</span></div>
      <label class="day-check" aria-label="标记${item.day}安排完成">
        <input class="checkin-toggle" type="checkbox" data-day-index="${index}" ${weekCheckins[index] ? "checked" : ""}>
        <span class="checkin-box" aria-hidden="true"></span>
      </label>
    </article>`).join("");
  const monthCards = plan.monthPlan
    .filter((phase) => showAllMonths || phase.month <= 2)
    .map((phase) => `
      <article class="month-card">
        <span class="month-index">${String(phase.month).padStart(2, "0")}</span>
        <div class="month-content">
          <div class="month-title">第 ${phase.month} 个月 · ${phase.title}</div>
          <p class="month-focus">${phase.focus}</p>
          ${phase.actions.map((action) => `<div class="month-action">${action}</div>`).join("")}
        </div>
      </article>`).join("");
  const foodCard = plan.isLowWeight
    ? `<section class="habit-card">
        <div class="habit-header"><div><div class="habit-kicker">饮食建议</div><h3>先照顾好日常营养</h3></div><span class="habit-spark" aria-hidden="true">✳</span></div>
        <div class="habit-list">
          <div class="habit-item"><span class="habit-number">01</span><span>规律吃三餐，每餐都包含主食、蛋白质和蔬果，不刻意缩小份量。</span></div>
          <div class="habit-item"><span class="habit-number">02</span><span>选择自己能长期坚持、种类多样的食物；不需要为了体重删掉某一类食物。</span></div>
          <div class="habit-item"><span class="habit-number">03</span><span>先与医生或营养专业人士讨论体重目标，再决定是否需要调整饮食。</span></div>
        </div>
        <p class="habit-foot">BMI 是筛查参考，不代表体脂率或个人健康诊断。</p>
      </section>`
    : `<section class="habit-card">
        <div class="habit-header"><div><div class="habit-kicker">日常饮食</div><h3>配合运动的饮食习惯</h3></div><span class="habit-spark" aria-hidden="true">✳</span></div>
        <div class="habit-list">
          <div class="habit-item"><span class="habit-number">01</span><span>主餐先盛蔬菜，再配一掌蛋白质（鱼、蛋、豆腐或鸡肉）和一拳主食。</span></div>
          <div class="habit-item"><span class="habit-number">02</span><span>日常饮品优先选水或无糖茶；含糖饮料留作偶尔选择。</span></div>
          <div class="habit-item"><span class="habit-number">03</span><span>观察一周常吃的零食和饮料，先调整最容易的一项；不挨饿、不极端忌口。</span></div>
        </div>
        <p class="habit-foot">热量目标是结合个人资料的粗略估算，不是医疗处方，也不是精确测量值。</p>
      </section>`;

  output.innerHTML = `
    <div class="summary-card">
      <div class="summary-metrics">
        <div class="metric"><span class="metric-label">计划周期</span><strong class="metric-value">${plan.months}<small>个月</small></strong></div>
        <div class="metric"><span class="metric-label">每周安排</span><strong class="metric-value">6<small>次活动</small></strong></div>
        <div class="metric"><span class="metric-label">BMI 参考</span><strong class="metric-value">${plan.bmi}</strong></div>
      </div>
      <p class="summary-note">${bmiNote}</p>${bodyFatNote}${lowWeightAlert}
    </div>
    ${renderBindingCard()}
    ${renderFoodDiary(plan)}
    ${todayCard}
    <div class="week-progress-card">
      <div class="week-progress-heading"><strong>本周打卡</strong><span data-progress-count>0 / 7 天</span></div>
      <div class="week-progress-track" role="progressbar" aria-label="本周完成进度" aria-valuemin="0" aria-valuemax="7" aria-valuenow="0"><span data-progress-fill></span></div>
      <p>点按每一天右侧的圆框，完成后这条安排会变灰。记录只保存在本机。</p>
    </div>
    <div id="training-plan" class="result-subheading"><h3>你的每周训练表</h3><span>单次不超过 ${plan.minutes} 分钟</span></div>
    <p class="week-intro">动作平稳、保留余力；第 1 个月前两周按逐月路线减量，热身计入单次时间。</p>
    <div class="week-grid">${weekCards}</div>
    <p class="guideline-note">一般成人活动建议包括每周至少 150 分钟中等强度有氧和每周 2 天力量活动。时间有限时先从能坚持的安排开始，再逐步增加。</p>
    ${foodCard}
    <div class="result-subheading"><h3>逐月进阶路线</h3><span>按感觉调整</span></div>
    <div class="month-list">${monthCards}</div>
    ${plan.months > 2 ? `<button id="month-toggle" class="month-toggle" type="button" aria-expanded="${showAllMonths}">${showAllMonths ? "收起后续月份" : "展开全部计划"}</button>` : ""}
    <div class="tracking-card"><span class="tracking-icon" aria-hidden="true">↗</span><div><strong class="tracking-title">每周复盘一次</strong><span class="tracking-copy">固定在起床后称重，观察 7 天平均值；再结合腰围、睡眠和训练状态判断变化。体重短期波动很正常。</span></div></div>
    <p class="disclaimer">本计划为一般健康信息，不构成诊断或医疗建议。若运动中出现胸闷、头晕或明显疼痛，请停止并寻求专业帮助。</p>`;

  const toggle = document.querySelector("#month-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      showAllMonths = !showAllMonths;
      renderPlan(currentPlan);
    });
  }

  output.querySelectorAll(".checkin-toggle").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const updatedCheckins = readWeekCheckins();
      updatedCheckins[Number(checkbox.dataset.dayIndex)] = checkbox.checked;
      saveWeekCheckins(updatedCheckins);
      updateCheckinViews(updatedCheckins);
    });
  });
  updateCheckinViews(weekCheckins);
  wireBindingCard();
  wireFoodDiary(plan);
}

function wireBindingCard() {
  const createButton = output.querySelector("[data-create-binding]");
  if (createButton) {
    createButton.addEventListener("click", () => {
      if (!form.checkValidity()) {
        setBindingStatus("请先完成基础资料并确认计划适用范围。", true);
        return;
      }
      try {
        const profiles = readLocalProfiles();
        currentBindingCode = generateLocalBindingCode(profiles);
        profiles[currentBindingCode] = getFormProfile();
        if (!writeLocalProfiles(profiles)) throw new Error("本机存储不可用，请检查浏览器设置或可用空间。");
        saveRememberedBindingCode(currentBindingCode);
        bindingStatusError = false;
        bindingStatusMessage = "已保存在当前浏览器。请保存本机码，或导出备份文件换设备使用。";
        if (restoreCodeInput) restoreCodeInput.value = currentBindingCode;
        setRestoreStatus("本机码已创建，资料只保存在此浏览器。");
        renderPlan(currentPlan);
      } catch (error) {
        setBindingStatus(error.message || "创建失败，请稍后重试。", true);
      }
    });
  }

  const updateButton = output.querySelector("[data-update-binding]");
  if (updateButton) {
    updateButton.addEventListener("click", () => {
      if (!form.checkValidity()) {
        setBindingStatus("请先检查资料并确认计划适用范围。", true);
        return;
      }
      try {
        const profiles = readLocalProfiles();
        if (!profiles[currentBindingCode]) throw new Error("本机没有找到这条资料，请重新创建本机码。");
        profiles[currentBindingCode] = getFormProfile();
        if (!writeLocalProfiles(profiles)) throw new Error("本机存储不可用，请检查浏览器设置或可用空间。");
        bindingStatusError = false;
        bindingStatusMessage = "本机资料已保存。";
        renderPlan(currentPlan);
      } catch (error) {
        setBindingStatus(error.message || "保存失败，请稍后重试。", true);
      }
    });
  }

  const exportButton = output.querySelector("[data-export-binding]");
  if (exportButton) {
    exportButton.addEventListener("click", () => {
      try {
        exportLocalBackup();
      } catch (error) {
        setBindingStatus(error.message || "备份失败，请稍后重试。", true);
      }
    });
  }

  const deleteButton = output.querySelector("[data-delete-binding]");
  if (deleteButton) {
    deleteButton.addEventListener("click", async () => {
      const confirmed = window.confirm("删除后会清除此浏览器保存的资料和绑定码。若已有备份文件，文件不会被删除。确定继续吗？");
      if (!confirmed) return;
      try {
        const profiles = readLocalProfiles();
        delete profiles[currentBindingCode];
        if (!writeLocalProfiles(profiles)) throw new Error("本机存储不可用，无法删除资料。");
        currentBindingCode = "";
        saveRememberedBindingCode("");
        bindingStatusError = false;
        bindingStatusMessage = "本机资料和绑定码已删除。";
        setRestoreStatus("本机资料已删除。");
        renderPlan(currentPlan);
      } catch (error) {
        setBindingStatus(error.message || "删除失败，请稍后重试。", true);
      }
    });
  }

  const copyButton = output.querySelector("[data-copy-binding-code]");
  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(currentBindingCode);
        setBindingStatus("本机码已复制。", false);
      } catch (_) {
        setBindingStatus(`请手动保存本机码：${currentBindingCode}`, false);
      }
    });
  }
}

function updateCheckinViews(checkins = readWeekCheckins()) {
  output.querySelectorAll(".checkin-toggle").forEach((checkbox) => {
    const isComplete = Boolean(checkins[Number(checkbox.dataset.dayIndex)]);
    checkbox.checked = isComplete;
    checkbox.closest(".day-card, .today-plan-card")?.classList.toggle("is-complete", isComplete);
  });
  const completeCount = checkins.filter(Boolean).length;
  const count = output.querySelector("[data-progress-count]");
  const fill = output.querySelector("[data-progress-fill]");
  const progress = output.querySelector(".week-progress-track");
  if (count) count.textContent = `${completeCount} / 7 天`;
  if (fill) fill.style.width = `${(completeCount / 7) * 100}%`;
  if (progress) progress.setAttribute("aria-valuenow", String(completeCount));
  const todayLabel = output.querySelector(".today-check-label");
  if (todayLabel) todayLabel.textContent = checkins[getWeekdayIndex()] ? "今天已完成" : "完成今天安排";
}

if (restoreCard) restoreCard.hidden = false;
if (restoreDivider) restoreDivider.hidden = false;
restoreButton?.addEventListener("click", () => restoreLocalProfile(restoreCodeInput.value.trim()));
restoreCodeInput?.addEventListener("input", () => {
  restoreCodeInput.value = restoreCodeInput.value.replace(/\D/g, "").slice(0, 6);
});
restoreCodeInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    restoreLocalProfile(restoreCodeInput.value.trim());
  }
});
rememberCodeCheckbox?.addEventListener("change", () => {
  if (!currentBindingCode) return;
  saveRememberedBindingCode(currentBindingCode);
  setRestoreStatus(rememberCodeCheckbox.checked ? "下次打开此浏览器会自动恢复本机资料。" : "已关闭自动恢复；本机资料仍保留，可输入本机码恢复。");
});
backupInput?.addEventListener("change", async () => {
  const file = backupInput.files?.[0];
  if (!file) return;
  try {
    await importLocalBackup(file);
  } catch (error) {
    setRestoreStatus(error.message || "无法读取备份文件。", true);
  } finally {
    backupInput.value = "";
  }
});
const navLinks = Array.from(document.querySelectorAll(".mobile-nav-link"));
const resultsNavLink = document.querySelector('[data-nav-target="results"]');
const dietNavLink = document.querySelector('[data-nav-target="diet"]');

function setNavigationActive(target) {
  navLinks.forEach((link) => {
    const active = link.dataset.navTarget === target;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function setResultsNavigationEnabled(enabled) {
  [resultsNavLink, dietNavLink].filter(Boolean).forEach((link) => {
    link.classList.toggle("is-disabled", !enabled);
    if (enabled) {
      link.removeAttribute("aria-disabled");
      link.removeAttribute("tabindex");
    } else {
      link.setAttribute("aria-disabled", "true");
      link.setAttribute("tabindex", "-1");
    }
  });
}

if (currentBindingCode) {
  if (restoreCodeInput) restoreCodeInput.value = currentBindingCode;
  restoreLocalProfile(currentBindingCode, true);
}

navLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    if (link.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      return;
    }
    setNavigationActive(link.dataset.navTarget);
  });
});

let scrollFrame = 0;
function updateNavigationFromScroll() {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    const probe = window.innerHeight * 0.38;
    const sections = [
      { id: "top", element: document.querySelector(".hero") },
      { id: "planner", element: document.querySelector("#planner") },
      { id: "results", element: results },
      { id: "diet", element: document.querySelector("#nutrition-diary") },
      { id: "results", element: document.querySelector("#training-plan") }
    ].filter((entry) => entry.element && (entry.id !== "results" || !results.hidden));
    let active = sections[0]?.id || "top";
    sections.forEach((section) => {
      if (section.element.getBoundingClientRect().top <= probe) active = section.id;
    });
    setNavigationActive(active);
  });
}
window.addEventListener("scroll", updateNavigationFromScroll, { passive: true });

function updateCurrentPlan() {
  if (!currentPlan) return;
  const data = readForm();
  if (!form.checkValidity()) {
    currentPlan = null;
    results.hidden = true;
    setResultsNavigationEnabled(false);
    updateNavigationFromScroll();
    return;
  }
  currentPlan = buildPlan(data);
  renderPlan(currentPlan);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  errorMessage.textContent = "";
  if (!form.reportValidity()) {
    errorMessage.textContent = "请检查身高、体重、年龄范围，选择估算系数和日常活动量，并确认计划适用范围。";
    return;
  }
  currentPlan = buildPlan(readForm());
  showAllMonths = false;
  renderPlan(currentPlan);
  results.hidden = false;
  setResultsNavigationEnabled(true);
  lastRenderedDate = dateKey(new Date());
  setNavigationActive("results");
  requestAnimationFrame(() => results.scrollIntoView({ behavior: "smooth", block: "start" }));
});

form.addEventListener("input", () => {
  errorMessage.textContent = "";
  updateCurrentPlan();
});
form.addEventListener("change", updateCurrentPlan);
printButton.addEventListener("click", () => window.print());

function refreshForToday() {
  const todayKey = dateKey(new Date());
  if (currentPlan && todayKey !== lastRenderedDate) {
    renderPlan(currentPlan);
    lastRenderedDate = todayKey;
  }
  updateNavigationFromScroll();
}

function scheduleMidnightRefresh() {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  window.setTimeout(() => {
    refreshForToday();
    scheduleMidnightRefresh();
  }, nextMidnight.getTime() - now.getTime() + 50);
}

window.addEventListener("focus", refreshForToday);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshForToday();
});
scheduleMidnightRefresh();
