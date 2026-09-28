// app.js：资源账本视图（库存尺、安全扫掠条、事件流水）
import { needOf, sweepable } from "./resbank.js";
import { copyState, declare, request, release, finish, audit } from "./ops.js";

function needRows(state) {
  return state.alloc.map(function (row, pid) {
    if (state.done[pid]) {
      return row.map(function () { return 0; });
    }
    return state.claim[pid] ? needOf(state.claim[pid], row) : null;
  });
}

export function render(spec) {
  let state = copyState(spec.state);
  const failed = [];
  const log = [];
  let index = 0;
  for (const event of spec.events || []) {
    index += 1;
    const marked = state.denied;
    try {
      if (event.kind === "declare") {
        state = declare(state, event.pid, event.claim);
      } else if (event.kind === "request") {
        state = request(state, event.pid, event.vec);
      } else if (event.kind === "release") {
        state = release(state, event.pid, event.vec);
      } else if (event.kind === "finish") {
        state = finish(state, event.pid);
      } else if (event.kind === "audit") {
        state = audit(state);
      } else {
        throw Object.assign(new Error("E_KIND"), { code: "E_KIND" });
      }
      if (state.denied > marked) {
        const last = state.denials[state.denials.length - 1];
        log.push([index, event.kind, "拒付", String(last[2])]);
      } else {
        log.push([index, event.kind, "记账", ""]);
      }
    } catch (error) {
      const code = error && error.code ? error.code : "E_KIND";
      failed.push([event.kind, code]);
      log.push([index, event.kind, "打回", String(code)]);
    }
  }
  const need = needRows(state);
  let conserved = true;
  let avail_nonneg = true;
  for (let at = 0; at < state.total.length; at += 1) {
    let used = 0;
    for (let pid = 0; pid < state.alloc.length; pid += 1) {
      used += state.alloc[pid][at];
    }
    if (used + state.avail[at] !== state.total[at]) {
      conserved = false;
    }
    if (state.avail[at] < 0) {
      avail_nonneg = false;
    }
  }
  let need_ok = true;
  let done_zero = true;
  let within_claim = true;
  for (let pid = 0; pid < state.alloc.length; pid += 1) {
    if (state.done[pid]) {
      for (let at = 0; at < state.total.length; at += 1) {
        if (state.alloc[pid][at] !== 0) {
          done_zero = false;
        }
      }
    }
    const claim = state.claim[pid];
    if (claim) {
      for (let at = 0; at < state.total.length; at += 1) {
        if (state.alloc[pid][at] > claim[at]) {
          within_claim = false;
        }
        if (!state.done[pid] && need[pid] && state.alloc[pid][at] + need[pid][at] !== claim[at]) {
          need_ok = false;
        }
      }
    }
  }
  const safe_now = sweepable(state.avail, need, state.alloc, state.done);
  let last = null;
  if (state.audits.length > 0) {
    last = state.audits[state.audits.length - 1];
  } else if (state.grants.length > 0) {
    const grant = state.grants[state.grants.length - 1];
    last = [true, grant[2], []];
  }
  return {
    resources: state.resources, total: state.total, avail: state.avail,
    alloc: state.alloc, need: need, done: state.done, claim: state.claim,
    grants: state.grants, denials: state.denials, releases: state.releases,
    finishes: state.finishes, audits: state.audits, log: log,
    granted: state.granted, denied: state.denied, released: state.released,
    finished: state.finished, audited: state.audited,
    failed_events: failed.length, failed_marks: failed,
    conserved: conserved, need_ok: need_ok, done_zero: done_zero,
    within_claim: within_claim, avail_nonneg: avail_nonneg, safe_now: safe_now,
    last_sweep: last, count_events: (spec.events || []).length
  };
}
