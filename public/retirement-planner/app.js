const statusEl = document.getElementById("status");
const summaryEl = document.getElementById("summary");
const tableBodyEl = document.querySelector("#projectionTable tbody");
const rowCountEl = document.getElementById("rowCount");
const chartEl = document.getElementById("balanceChart");
const depletionBadgeEl = document.getElementById("depletionBadge");
const calculateBtn = document.getElementById("calculateBtn");

const fieldIds = [
  "currentAge",
  "retirementAge",
  "lifeExpectancy",
  "currentSavings",
  "annualContribution",
  "contributionGrowth",
  "preReturn",
  "postReturn",
  "annualSpending",
  "inflation",
  "socialSecurity"
];

const fields = Object.fromEntries(fieldIds.map((id) => [id, document.getElementById(id)]));

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function toNumber(input) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : 0;
}

function readInputs() {
  return {
    currentAge: toNumber(fields.currentAge),
    retirementAge: toNumber(fields.retirementAge),
    lifeExpectancy: toNumber(fields.lifeExpectancy),
    currentSavings: toNumber(fields.currentSavings),
    annualContribution: toNumber(fields.annualContribution),
    contributionGrowth: toNumber(fields.contributionGrowth) / 100,
    preReturn: toNumber(fields.preReturn) / 100,
    postReturn: toNumber(fields.postReturn) / 100,
    annualSpending: toNumber(fields.annualSpending),
    inflation: toNumber(fields.inflation) / 100,
    socialSecurity: toNumber(fields.socialSecurity)
  };
}

function validate(inputs) {
  if (inputs.retirementAge <= inputs.currentAge) {
    return "Retirement age must be greater than current age.";
  }
  if (inputs.lifeExpectancy <= inputs.retirementAge) {
    return "Life expectancy must be greater than retirement age.";
  }
  if (inputs.currentSavings < 0 || inputs.annualContribution < 0 || inputs.annualSpending < 0) {
    return "Savings, contribution, and spending values must be zero or higher.";
  }
  return null;
}

function calculateProjection(inputs) {
  const rows = [];
  let endBalance = inputs.currentSavings;

  for (let age = inputs.currentAge; age <= inputs.lifeExpectancy; age += 1) {
    const year = age - inputs.currentAge + 1;
    const startBalance = endBalance;
    const yearsFromNow = age - inputs.currentAge;
    const yearsInRetirement = Math.max(0, age - inputs.retirementAge);
    const inRetirement = age >= inputs.retirementAge;

    const contribution = inRetirement
      ? 0
      : inputs.annualContribution * (1 + inputs.contributionGrowth) ** yearsFromNow;
    const rate = inRetirement ? inputs.postReturn : inputs.preReturn;
    const investmentReturn = startBalance * rate;
    const socialSecurity = inRetirement
      ? inputs.socialSecurity * (1 + inputs.inflation) ** yearsInRetirement
      : 0;
    const spending = inRetirement
      ? inputs.annualSpending * (1 + inputs.inflation) ** yearsInRetirement
      : 0;

    const netCashFlow = contribution + investmentReturn + socialSecurity - spending;
    endBalance = Math.max(0, startBalance + netCashFlow);

    let status = "Accumulating";
    if (inRetirement) {
      status = endBalance <= 0 ? "Depleted" : "Funded";
    }

    rows.push({
      year,
      age,
      startBalance,
      contribution,
      investmentReturn,
      socialSecurity,
      spending,
      netCashFlow,
      endBalance,
      status
    });
  }

  return rows;
}

function summaryMetrics(rows, inputs) {
  const retirementRow = rows.find((row) => row.age === inputs.retirementAge) || rows[0];
  const finalRow = rows[rows.length - 1];
  const depletionRow = rows.find((row) => row.status === "Depleted");
  const gapAtRetirement = Math.max(0, retirementRow.spending - retirementRow.socialSecurity);

  return {
    retirementBalance: retirementRow.startBalance,
    finalBalance: finalRow.endBalance,
    depletionAge: depletionRow ? depletionRow.age : null,
    firstYearSpending: retirementRow.spending,
    incomeGap: gapAtRetirement,
    health: depletionRow ? "Needs Adjustment" : "On Track"
  };
}

function metricCard(label, value, tone = "") {
  const toneClass = tone ? ` ${tone}` : "";
  return `<article class="card metric${toneClass}"><p class="meta-row">${label}</p><h3 class="title">${value}</h3></article>`;
}

function renderSummary(metrics) {
  summaryEl.innerHTML = [
    metricCard("Projected Balance at Retirement", currencyFmt.format(metrics.retirementBalance)),
    metricCard("Final Balance at Life Expectancy", currencyFmt.format(metrics.finalBalance), metrics.finalBalance === 0 ? "warn" : ""),
    metricCard("First Depletion Age", metrics.depletionAge ? intFmt.format(metrics.depletionAge) : "Not Depleted", metrics.depletionAge ? "warn" : ""),
    metricCard("First-Year Retirement Spending", currencyFmt.format(metrics.firstYearSpending)),
    metricCard("Income Gap at Retirement", currencyFmt.format(metrics.incomeGap), metrics.incomeGap > 0 ? "warn" : ""),
    metricCard("Plan Health", metrics.health, metrics.health === "On Track" ? "good" : "warn")
  ].join("");

  depletionBadgeEl.textContent = metrics.depletionAge
    ? `Depletion starts at age ${metrics.depletionAge}`
    : "No depletion detected";
  depletionBadgeEl.className = `badge ${metrics.depletionAge ? "warn" : "good"}`;
}

function renderTable(rows) {
  tableBodyEl.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>${row.year}</td>
        <td>${row.age}</td>
        <td>${currencyFmt.format(row.startBalance)}</td>
        <td>${currencyFmt.format(row.contribution)}</td>
        <td>${currencyFmt.format(row.investmentReturn)}</td>
        <td>${currencyFmt.format(row.socialSecurity)}</td>
        <td>${currencyFmt.format(row.spending)}</td>
        <td class="${row.netCashFlow < 0 ? "negative" : ""}">${currencyFmt.format(row.netCashFlow)}</td>
        <td>${currencyFmt.format(row.endBalance)}</td>
        <td><span class="impact ${row.status === "Depleted" ? "down" : row.status === "Funded" ? "up" : "flat"}">${row.status}</span></td>
      </tr>
    `
    )
    .join("");

  rowCountEl.textContent = `${rows.length} years`;
}

function renderChart(rows) {
  const width = 900;
  const height = 320;
  const padX = 36;
  const padY = 24;
  const maxBalance = Math.max(...rows.map((r) => r.endBalance), 1);

  const points = rows
    .map((row, i) => {
      const x = padX + (i / (rows.length - 1 || 1)) * (width - padX * 2);
      const y = height - padY - (row.endBalance / maxBalance) * (height - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  chartEl.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
    <line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" stroke="rgba(255,255,255,0.25)" />
    <line x1="${padX}" y1="${padY}" x2="${padX}" y2="${height - padY}" stroke="rgba(255,255,255,0.25)" />
    <polyline points="${points}" fill="none" stroke="#20e39a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
  `;
}

function runPlanner() {
  const inputs = readInputs();
  const error = validate(inputs);

  if (error) {
    statusEl.textContent = error;
    statusEl.classList.add("error");
    return;
  }

  const projection = calculateProjection(inputs);
  const metrics = summaryMetrics(projection, inputs);

  renderSummary(metrics);
  renderTable(projection);
  renderChart(projection);

  statusEl.classList.remove("error");
  statusEl.textContent = `Updated ${new Date().toLocaleString()} · ${projection.length} years projected.`;
}

calculateBtn.addEventListener("click", runPlanner);
fieldIds.forEach((id) => {
  fields[id].addEventListener("keydown", (event) => {
    if (event.key === "Enter") runPlanner();
  });
});

runPlanner();
