import fs from "node:fs";
import { needOf, orderOf, sweepable } from "./resbank.js";
import { declare, request, release, finish, audit } from "./ops.js";

const __lines = [];
function emit(label, value) {
  __lines.push([String(label).replace(/ =$/, ""), value]);
}

const spec = JSON.parse(fs.readFileSync(process.argv[2] || "sample/ledger.json", "utf8"));

function copy(state) {
  return {
    resources: (state.resources || []).slice(),
    total: (state.total || []).slice(),
    claim: (state.claim || []).map(function (row) { return row ? row.slice() : null; }),
    alloc: (state.alloc || []).map(function (row) { return row.slice(); }),
    avail: (state.avail || []).slice(),
    done: (state.done || []).slice(),
    grants: (state.grants || []).map(function (row) { return [row[0], row[1].slice(), row[2].slice()]; }),
    denials: (state.denials || []).map(function (row) { return [row[0], row[1].slice(), row[2], row[3].slice()]; }),
    releases: (state.releases || []).map(function (row) { return [row[0], row[1].slice()]; }),
    finishes: (state.finishes || []).map(function (row) { return [row[0], row[1].slice()]; }),
    audits: (state.audits || []).map(function (row) { return [row[0], row[1].slice(), row[2].slice()]; }),
    granted: state.granted || 0, denied: state.denied || 0, released: state.released || 0,
    finished: state.finished || 0, audited: state.audited || 0
  };
}

function apply(state, event) {
  if (event.kind === "declare") { return declare(state, event.pid, event.claim); }
  if (event.kind === "request") { return request(state, event.pid, event.vec); }
  if (event.kind === "release") { return release(state, event.pid, event.vec); }
  if (event.kind === "finish") { return finish(state, event.pid); }
  return audit(state);
}

function needRows(state) {
  return state.alloc.map(function (row, pid) {
    if (state.done[pid]) {
      return row.map(function () { return 0; });
    }
    return state.claim[pid] ? needOf(state.claim[pid], row) : null;
  });
}

const events = spec.events || [];
let state = copy(spec.state);
let failed = 0;
const marks = [];
for (const event of events) {
  try {
    state = apply(state, event);
  } catch (error) {
    failed += 1;
    marks.push([event.kind, error && error.code ? error.code : "E_KIND"]);
  }
}
const need = needRows(state);

function fingerprint(one) {
  return JSON.stringify(one);
}

let replay = copy(spec.state);
let replayFailed = 0;
for (const event of events) {
  try {
    replay = apply(replay, event);
  } catch (error) {
    replayFailed += 1;
  }
}

const half = Math.ceil(events.length / 2);
let left = copy(spec.state);
for (const event of events.slice(0, half)) {
  try { left = apply(left, event); } catch (error) { /* 前一半出错就跳过 */ }
}
const midFinger = fingerprint(left);
let right = left;
for (const event of events.slice(half)) {
  try { right = apply(right, event); } catch (error) { /* 后一半出错就跳过 */ }
}

let conserved = true;
let avail_nonneg = true;
for (let at = 0; at < state.total.length; at += 1) {
  let used = 0;
  for (let pid = 0; pid < state.alloc.length; pid += 1) {
    used += state.alloc[pid][at];
  }
  if (used + state.avail[at] !== state.total[at]) { conserved = false; }
  if (state.avail[at] < 0) { avail_nonneg = false; }
}
let need_ok = true;
let done_zero = true;
let within_claim = true;
for (let pid = 0; pid < state.alloc.length; pid += 1) {
  if (state.done[pid]) {
    for (let at = 0; at < state.total.length; at += 1) {
      if (state.alloc[pid][at] !== 0) { done_zero = false; }
    }
  }
  const claim = state.claim[pid];
  if (claim) {
    for (let at = 0; at < state.total.length; at += 1) {
      if (state.alloc[pid][at] > claim[at]) { within_claim = false; }
      if (!state.done[pid] && need[pid] && state.alloc[pid][at] + need[pid][at] !== claim[at]) { need_ok = false; }
    }
  }
}
const safe_now = sweepable(state.avail, need, state.alloc, state.done);

emit("收尾后可用向量", state.avail);
emit("收尾后已分配矩阵", state.alloc);
emit("收尾后需求矩阵", need);
emit("收尾后完结位", state.done);
emit("受理记录", state.grants);
emit("拒绝记录", state.denials);
emit("释放记录", state.releases);
emit("完结记录", state.finishes);
emit("审计记录", state.audits);
emit("受理计数", state.granted);
emit("拒绝计数", state.denied);
emit("释放计数", state.released);
emit("完结计数", state.finished);
emit("审计计数", state.audited);
emit("失败事件数", failed);
emit("失败事件码", marks);
emit("守恒成立", conserved);
emit("需求一致成立", need_ok);
emit("完结行清零成立", done_zero);
emit("不超声明成立", within_claim);
emit("可用非负成立", avail_nonneg);
emit("收尾态安全成立", safe_now);
emit("重放不新增", fingerprint(replay) === fingerprint(state) ? 0 : 1);
emit("重放报错条数", replayFailed);
emit("拆两轮中间态不同", midFinger !== fingerprint(state));
emit("拆两轮收尾态一致", fingerprint(right) === fingerprint(state));
emit("辅助需求向量", needOf([5, 4, 3], [2, 4, 1]));
emit("辅助扫掠序", orderOf([2, 1, 1], [[1, 1, 1], [4, 0, 0], [1, 1, 0]], [[1, 1, 1], [4, 0, 0], [1, 1, 0]], [false, false, false]));
emit("辅助扫掠跳未声明", orderOf([1, 0, 0], [null, [1, 0, 0], [2, 0, 0]], [[0, 0, 0], [1, 0, 0], [2, 0, 0]], [false, false, false]));
emit("辅助可扫掠", sweepable([2, 1, 1], [[1, 1, 1], [4, 0, 0], [1, 1, 0]], [[1, 1, 1], [4, 0, 0], [1, 1, 0]], [false, false, false]));
emit("辅助卡住判据", sweepable([0, 1, 1], [[1, 1, 1], [1, 1, 1]], [[1, 1, 1], [1, 1, 1]], [false, false]));

// ---- 异常路径探针：真调用实现，看它报出什么码 ----
try {
  request(copy(state), 9, [1, 0, 0]);
  emit("进程号不合法报码", "没有报错");
} catch (error) {
  emit("进程号不合法报码", error && error.code ? error.code : String(error.message));
}
try {
  request(copy(state), 1, [1, 0]);
  emit("向量形状不合法报码", "没有报错");
} catch (error) {
  emit("向量形状不合法报码", error && error.code ? error.code : String(error.message));
}
try {
  declare(copy(state), 0, [1, 0, 0]);
  emit("重复声明报码", "没有报错");
} catch (error) {
  emit("重复声明报码", error && error.code ? error.code : String(error.message));
}
try {
  request(copy(state), 3, [1, 0, 0]);
  emit("未声明就申请报码", "没有报错");
} catch (error) {
  emit("未声明就申请报码", error && error.code ? error.code : String(error.message));
}
try {
  declare(copy(state), 3, [9, 1, 1]);
  emit("超额声明报码", "没有报错");
} catch (error) {
  emit("超额声明报码", error && error.code ? error.code : String(error.message));
}
try {
  request(copy(state), 1, [0, 1, 0]);
  emit("超需求申请报码", "没有报错");
} catch (error) {
  emit("超需求申请报码", error && error.code ? error.code : String(error.message));
}
try {
  release(copy(state), 1, [4, 0, 0]);
  emit("释放超量报码", "没有报错");
} catch (error) {
  emit("释放超量报码", error && error.code ? error.code : String(error.message));
}
try {
  finish(copy(state), 1);
  emit("完结时需求未清报码", "没有报错");
} catch (error) {
  emit("完结时需求未清报码", error && error.code ? error.code : String(error.message));
}
try {
  request(copy(state), 0, [1, 0, 0]);
  emit("完结后再申请报码", "没有报错");
} catch (error) {
  emit("完结后再申请报码", error && error.code ? error.code : String(error.message));
}

// 另起一个超额声明的起始账：可用为零，但仍有一项需求没满足
const tight = {
  resources: ["A", "B", "C"],
  total: [3, 3, 3],
  claim: [[3, 3, 3], [3, 3, 3], null, null],
  alloc: [[2, 2, 2], [1, 1, 1], [0, 0, 0], [0, 0, 0]],
  avail: [0, 0, 0],
  done: [false, false, false, false],
  grants: [], denials: [], releases: [], finishes: [], audits: [],
  granted: 0, denied: 0, released: 0, finished: 0, audited: 0
};
try {
  request(tight, 0, [1, 1, 1]);
  emit("超可用申请报码", "没有报错");
} catch (error) {
  emit("超可用申请报码", error && error.code ? error.code : String(error.message));
}

// ---- 期望值（由参考模型算出，见生成器）----
const EXPECTED = {
  "收尾后可用向量": [
    3,
    2,
    2
  ],
  "收尾后已分配矩阵": [
    [
      0,
      0,
      0
    ],
    [
      2,
      2,
      2
    ],
    [
      1,
      0,
      0
    ],
    [
      0,
      0,
      0
    ]
  ],
  "收尾后需求矩阵": [
    [
      0,
      0,
      0
    ],
    [
      1,
      0,
      0
    ],
    [
      2,
      2,
      2
    ],
    null
  ],
  "收尾后完结位": [
    true,
    false,
    false,
    false
  ],
  "受理记录": [
    [
      0,
      [
        2,
        1,
        1
      ],
      [
        0,
        1,
        2
      ]
    ],
    [
      1,
      [
        2,
        1,
        1
      ],
      [
        0,
        1,
        2
      ]
    ],
    [
      2,
      [
        2,
        1,
        1
      ],
      [
        1,
        2,
        0
      ]
    ],
    [
      0,
      [
        2,
        2,
        2
      ],
      [
        0,
        1,
        2
      ]
    ],
    [
      1,
      [
        2,
        1,
        1
      ],
      [
        1,
        2
      ]
    ],
    [
      2,
      [
        2,
        2,
        2
      ],
      [
        1,
        2
      ]
    ],
    [
      2,
      [
        1,
        0,
        0
      ],
      [
        1,
        2
      ]
    ]
  ],
  "拒绝记录": [
    [
      2,
      [
        2,
        1,
        1
      ],
      "E_UNSAFE",
      [
        0,
        1,
        2
      ]
    ]
  ],
  "释放记录": [
    [
      0,
      [
        1,
        1,
        1
      ]
    ],
    [
      1,
      [
        1,
        0,
        0
      ]
    ],
    [
      2,
      [
        1,
        1,
        1
      ]
    ],
    [
      1,
      [
        1,
        0,
        0
      ]
    ],
    [
      2,
      [
        3,
        2,
        2
      ]
    ]
  ],
  "完结记录": [
    [
      0,
      [
        3,
        2,
        2
      ]
    ]
  ],
  "审计记录": [
    [
      true,
      [
        1,
        2,
        0
      ],
      []
    ],
    [
      true,
      [
        1,
        2
      ],
      []
    ],
    [
      true,
      [
        1,
        2
      ],
      []
    ],
    [
      true,
      [
        1,
        2
      ],
      []
    ]
  ],
  "受理计数": 7,
  "拒绝计数": 1,
  "释放计数": 5,
  "完结计数": 1,
  "审计计数": 4,
  "失败事件数": 5,
  "失败事件码": [
    [
      "request",
      "E_AVAIL"
    ],
    [
      "request",
      "E_AVAIL"
    ],
    [
      "finish",
      "E_NEED"
    ],
    [
      "finish",
      "E_NEED"
    ],
    [
      "request",
      "E_NEED"
    ]
  ],
  "守恒成立": true,
  "需求一致成立": true,
  "完结行清零成立": true,
  "不超声明成立": true,
  "可用非负成立": true,
  "收尾态安全成立": true,
  "重放不新增": 0,
  "重放报错条数": 5,
  "拆两轮中间态不同": true,
  "拆两轮收尾态一致": true,
  "辅助需求向量": [
    3,
    0,
    2
  ],
  "辅助扫掠序": [
    0,
    2,
    1
  ],
  "辅助扫掠跳未声明": [
    1,
    2
  ],
  "辅助可扫掠": true,
  "辅助卡住判据": false,
  "进程号不合法报码": "E_PID",
  "向量形状不合法报码": "E_VEC",
  "重复声明报码": "E_DUP",
  "未声明就申请报码": "E_NODECL",
  "超额声明报码": "E_CLAIM",
  "超需求申请报码": "E_NEED",
  "释放超量报码": "E_RELEASE",
  "完结时需求未清报码": "E_NEED",
  "完结后再申请报码": "E_DONE",
  "超可用申请报码": "E_AVAIL"
};
function __same(got, want) {
  if (typeof got === "string") {
    try {
      const parsed = JSON.parse(got);
      if (JSON.stringify(parsed) === JSON.stringify(want)) { return true; }
    } catch (error) { /* 非 JSON 的字符串直接比 */ }
  }
  return JSON.stringify(got) === JSON.stringify(want);
}
let __bad = 0;
for (const [label, want] of Object.entries(EXPECTED)) {
  const found = __lines.find((pair) => pair[0] === label);
  if (!found) { __bad += 1; console.log("缺失验收项 " + label); continue; }
  if (__same(found[1], want)) { console.log("一致 " + label + " = " + JSON.stringify(found[1])); }
  else { __bad += 1; console.log("不一致 " + label + " 期望 " + JSON.stringify(want) + " 实际 " + JSON.stringify(found[1])); }
}
console.log("验收项 " + (Object.keys(EXPECTED).length - __bad) + "/" + Object.keys(EXPECTED).length + " 通过");
process.exit(__bad === 0 ? 0 : 1);
