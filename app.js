const days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

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

function buildPlan({ height, weight, bodyFat, minutes, months }) {
  const bmi = weight / ((height / 100) ** 2);
  return {
    bmi: bmi.toFixed(1),
    isLowWeight: bmi < 18.5,
    bodyFat,
    minutes,
    months,
    weekPlan: buildWeekPlan(minutes),
    monthPlan: buildMonths(months, minutes)
  };
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

const form = document.querySelector("#planner-form");
const results = document.querySelector("#results");
const output = document.querySelector("#plan-output");
const errorMessage = document.querySelector("#form-error");
const printButton = document.querySelector("#print-plan");
let currentPlan = null;
let showAllMonths = false;

function readForm() {
  return {
    height: Number(form.elements.height.value),
    weight: Number(form.elements.weight.value),
    bodyFat: form.elements.bodyFat.value === "" ? null : Number(form.elements.bodyFat.value),
    minutes: Number(form.elements.minutes.value),
    months: Number(form.elements.months.value)
  };
}

function renderPlan(plan) {
  const bmiNote = plan.isLowWeight
    ? "当前 BMI 偏低，不建议设置减脂目标。BMI 仅作筛查参考，不能单独判断体脂或健康状况。"
    : "BMI 仅作粗略参考，不能单独判断体脂或健康状况。计划不会预测具体减重结果。";
  const bodyFatNote = plan.bodyFat === null
    ? ""
    : `<p class="bodyfat-note">已记录体脂率：${escapeHTML(plan.bodyFat)}% · 建议用同一设备和时段观察趋势</p>`;
  const lowWeightAlert = plan.isLowWeight
    ? `<div class="lowweight-alert">体重偏低时不建议主动减重。下方安排请用于保持活动和基础力量，建议先与医疗专业人士讨论目标。</div>`
    : "";
  const weekCards = plan.weekPlan.map((item) => `
    <article class="day-card">
      <span class="day-name ${item.kind}">${item.day}</span>
      <div><strong class="day-title">${item.title}</strong><span class="day-detail">${item.detail}</span></div>
      <i class="day-dot ${item.kind}" aria-hidden="true"></i>
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
        <div class="habit-header"><div><div class="habit-kicker">STEADY & NOURISHED</div><h3>先照顾好日常营养</h3></div><span class="habit-spark" aria-hidden="true">✳</span></div>
        <div class="habit-list">
          <div class="habit-item"><span class="habit-number">01</span><span>规律吃三餐，每餐都包含主食、蛋白质和蔬果，不刻意缩小份量。</span></div>
          <div class="habit-item"><span class="habit-number">02</span><span>选择自己能长期坚持、种类多样的食物；不需要为了体重删掉某一类食物。</span></div>
          <div class="habit-item"><span class="habit-number">03</span><span>先与医生或营养专业人士讨论体重目标，再决定是否需要调整饮食。</span></div>
        </div>
        <p class="habit-foot">BMI 是筛查参考，不代表体脂率或个人健康诊断。</p>
      </section>`
    : `<section class="habit-card">
        <div class="habit-header"><div><div class="habit-kicker">EVERY DAY</div><h3>配合运动的饮食习惯</h3></div><span class="habit-spark" aria-hidden="true">✳</span></div>
        <div class="habit-list">
          <div class="habit-item"><span class="habit-number">01</span><span>主餐先盛蔬菜，再配一掌蛋白质（鱼、蛋、豆腐或鸡肉）和一拳主食。</span></div>
          <div class="habit-item"><span class="habit-number">02</span><span>日常饮品优先选水或无糖茶；含糖饮料留作偶尔选择。</span></div>
          <div class="habit-item"><span class="habit-number">03</span><span>观察一周常吃的零食和饮料，先调整最容易的一项；不挨饿、不极端忌口。</span></div>
        </div>
        <p class="habit-foot">没有年龄、性别和健康史信息，因此不提供热量处方。</p>
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
    <div class="result-subheading"><h3>你的每周训练表</h3><span>单次不超过 ${plan.minutes} 分钟</span></div>
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
}

function updateCurrentPlan() {
  if (!currentPlan) return;
  const data = readForm();
  if (!form.checkValidity()) {
    currentPlan = null;
    results.hidden = true;
    return;
  }
  currentPlan = buildPlan(data);
  renderPlan(currentPlan);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  errorMessage.textContent = "";
  if (!form.reportValidity()) {
    errorMessage.textContent = "请检查身高、体重、体脂率范围，并确认计划适用范围。";
    return;
  }
  currentPlan = buildPlan(readForm());
  showAllMonths = false;
  renderPlan(currentPlan);
  results.hidden = false;
  requestAnimationFrame(() => results.scrollIntoView({ behavior: "smooth", block: "start" }));
});

form.addEventListener("input", () => {
  errorMessage.textContent = "";
  updateCurrentPlan();
});
form.addEventListener("change", updateCurrentPlan);
printButton.addEventListener("click", () => window.print());
