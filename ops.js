// ops.js：声明、申请、释放、完结、审计
import { needOf, orderOf, sweepable } from "./resbank.js";

export function copyState(state) {
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
    granted: state.granted || 0,
    denied: state.denied || 0,
    released: state.released || 0,
    finished: state.finished || 0,
    audited: state.audited || 0
  };
}

function fail(code) {
  throw Object.assign(new Error(code), { code: code });
}

function isNonNegInt(value) {
  return Number.isInteger(value) && value >= 0;
}

function validVec(vec, width) {
  return Array.isArray(vec) && vec.length === width && vec.every(isNonNegInt);
}

function validPid(state, pid) {
  return Number.isInteger(pid) && pid >= 0 && pid < state.alloc.length;
}

function needRows(state) {
  return state.alloc.map(function (row, pid) {
    if (state.done[pid]) {
      return row.map(function () { return 0; });
    }
    return state.claim[pid] ? needOf(state.claim[pid], row) : null;
  });
}

function stuckPids(need, done, order) {
  const stuck = [];
  for (let pid = 0; pid < need.length; pid += 1) {
    if (!done[pid] && need[pid] !== null && need[pid] !== undefined && order.indexOf(pid) === -1) {
      stuck.push(pid);
    }
  }
  return stuck;
}

export function declare(state, pid, claim) {
  if (!validPid(state, pid)) {
    fail("E_PID");
  }
  if (!validVec(claim, state.total.length)) {
    fail("E_CLAIM");
  }
  for (let at = 0; at < state.total.length; at += 1) {
    if (claim[at] > state.total[at]) {
      fail("E_CLAIM");
    }
  }
  if (state.claim[pid] !== null && state.claim[pid] !== undefined) {
    fail("E_DUP");
  }
  const next = copyState(state);
  next.claim[pid] = claim.slice();
  return next;
}

export function request(state, pid, vec) {
  if (!validVec(vec, state.total.length)) {
    fail("E_VEC");
  }
  if (!validPid(state, pid)) {
    fail("E_PID");
  }
  if (state.claim[pid] === null || state.claim[pid] === undefined) {
    fail("E_NODECL");
  }
  if (state.done[pid]) {
    fail("E_DONE");
  }
  const need = needOf(state.claim[pid], state.alloc[pid]);
  for (let at = 0; at < state.total.length; at += 1) {
    if (vec[at] > need[at]) {
      fail("E_NEED");
    }
  }
  for (let at = 0; at < state.total.length; at += 1) {
    if (vec[at] > state.avail[at]) {
      fail("E_AVAIL");
    }
  }
  const trial = copyState(state);
  for (let at = 0; at < trial.total.length; at += 1) {
    trial.alloc[pid][at] += vec[at];
    trial.avail[at] -= vec[at];
  }
  const trialNeed = needRows(trial);
  const order = orderOf(trial.avail, trialNeed, trial.alloc, trial.done);
  const stuck = stuckPids(trialNeed, trial.done, order);
  if (stuck.length > 0) {
    const denied = copyState(state);
    denied.denials.push([pid, vec.slice(), "E_UNSAFE", stuck]);
    denied.denied += 1;
    return denied;
  }
  const next = trial;
  next.grants.push([pid, vec.slice(), order]);
  next.granted += 1;
  return next;
}

export function release(state, pid, vec) {
  if (!validVec(vec, state.total.length)) {
    fail("E_VEC");
  }
  if (!validPid(state, pid)) {
    fail("E_PID");
  }
  for (let at = 0; at < state.total.length; at += 1) {
    if (vec[at] > state.alloc[pid][at]) {
      fail("E_RELEASE");
    }
  }
  const next = copyState(state);
  for (let at = 0; at < next.total.length; at += 1) {
    next.alloc[pid][at] -= vec[at];
    next.avail[at] += vec[at];
  }
  next.releases.push([pid, vec.slice()]);
  next.released += 1;
  return next;
}

export function finish(state, pid) {
  if (!validPid(state, pid)) {
    fail("E_PID");
  }
  if (state.claim[pid] === null || state.claim[pid] === undefined) {
    fail("E_NODECL");
  }
  if (state.done[pid]) {
    fail("E_DONE");
  }
  const need = needOf(state.claim[pid], state.alloc[pid]);
  for (let at = 0; at < state.total.length; at += 1) {
    if (need[at] !== 0) {
      fail("E_NEED");
    }
  }
  const next = copyState(state);
  const returned = next.alloc[pid].slice();
  for (let at = 0; at < next.total.length; at += 1) {
    next.avail[at] += next.alloc[pid][at];
    next.alloc[pid][at] = 0;
  }
  next.done[pid] = true;
  next.finishes.push([pid, returned]);
  next.finished += 1;
  return next;
}

export function audit(state) {
  const next = copyState(state);
  const need = needRows(next);
  const order = orderOf(next.avail, need, next.alloc, next.done);
  const stuck = stuckPids(need, next.done, order);
  next.audits.push([stuck.length === 0, order, stuck]);
  next.audited += 1;
  return next;
}
