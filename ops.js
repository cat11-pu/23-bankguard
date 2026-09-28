// ops.js：声明、申请、释放、完结、审计（基线：一律原样返回）
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

export function declare(state, pid, claim) {
  return state;
}

export function request(state, pid, vec) {
  return state;
}

export function release(state, pid, vec) {
  return state;
}

export function finish(state, pid) {
  return state;
}

export function audit(state) {
  return state;
}
