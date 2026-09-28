// ops.js：声明、申请、释放、完结、审计
import { needOf, orderOf, sweepable } from "./resbank.js";

function fail(code) {
  throw Object.assign(new Error(code), { code: code });
}

function isValidVec(vec, length) {
  return Array.isArray(vec) && vec.length === length &&
    vec.every(function (value) {
      return Number.isInteger(value) && value >= 0;
    });
}

function needRows(state) {
  return state.alloc.map(function (row, pid) {
    if (state.done[pid]) {
      return row.map(function () { return 0; });
    }
    return state.claim[pid] ? needOf(state.claim[pid], row) : null;
  });
}

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

export function declare(state, pid, claim) {
  if (!Number.isInteger(pid) || pid < 0 || pid >= state.alloc.length) {
    fail("E_PID");
  }
  if (!isValidVec(claim, state.total.length)) {
    fail("E_CLAIM");
  }
  if (state.claim[pid] !== null) {
    fail("E_DUP");
  }
  for (let at = 0; at < state.total.length; at += 1) {
    if (claim[at] > state.total[at]) {
      fail("E_CLAIM");
    }
  }
  const next = copyState(state);
  next.claim[pid] = claim.slice();
  return next;
}

export function request(state, pid, vec) {
  if (!isValidVec(vec, state.total.length)) {
    fail("E_VEC");
  }
  if (!Number.isInteger(pid) || pid < 0 || pid >= state.alloc.length) {
    fail("E_PID");
  }
  if (state.claim[pid] === null) {
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
    if (vec[at] > state.avail[at]) {
      fail("E_AVAIL");
    }
  }
  const next = copyState(state);
  for (let at = 0; at < next.total.length; at += 1) {
    next.alloc[pid][at] += vec[at];
    next.avail[at] -= vec[at];
  }
  const needMatrix = needRows(next);
  const order = orderOf(next.avail, needMatrix, next.alloc, next.done);
  if (!sweepable(next.avail, needMatrix, next.alloc, next.done)) {
    const stuck = [];
    for (let other = 0; other < next.alloc.length; other += 1) {
      if (!next.done[other] && next.claim[other] !== null &&
          order.indexOf(other) === -1) {
        stuck.push(other);
      }
    }
    state.denials.push([pid, vec.slice(), "E_UNSAFE", stuck]);
    state.denied += 1;
    return state;
  }
  next.grants.push([pid, vec.slice(), order]);
  next.granted += 1;
  return next;
}

export function release(state, pid, vec) {
  if (!isValidVec(vec, state.total.length)) {
    fail("E_VEC");
  }
  if (!Number.isInteger(pid) || pid < 0 || pid >= state.alloc.length) {
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
  if (!Number.isInteger(pid) || pid < 0 || pid >= state.alloc.length) {
    fail("E_PID");
  }
  if (state.claim[pid] === null) {
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
  const stuck = [];
  for (let pid = 0; pid < next.alloc.length; pid += 1) {
    if (!next.done[pid] && next.claim[pid] !== null &&
        order.indexOf(pid) === -1) {
      stuck.push(pid);
    }
  }
  const safe = stuck.length === 0;
  next.audits.push([safe, order, stuck]);
  next.audited += 1;
  return next;
}
