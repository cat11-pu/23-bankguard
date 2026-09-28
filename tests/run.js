import assert from "node:assert";
import { needOf, orderOf, sweepable } from "../resbank.js";
import { copyState, declare, request, release, finish, audit } from "../ops.js";
import { render } from "../app.js";

const blank = {
  resources: ["A", "B", "C"],
  total: [6, 4, 4],
  claim: [null, null, null, null],
  alloc: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  avail: [6, 4, 4],
  done: [false, false, false, false],
  grants: [], denials: [], releases: [], finishes: [], audits: [],
  granted: 0, denied: 0, released: 0, finished: 0, audited: 0
};

const hold = {
  resources: ["A", "B", "C"],
  total: [6, 4, 4],
  claim: [[3, 2, 2], [3, 2, 2], [3, 2, 2], [0, 0, 0]],
  alloc: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  avail: [6, 4, 4],
  done: [false, false, false, false],
  grants: [], denials: [], releases: [], finishes: [], audits: [],
  granted: 0, denied: 0, released: 0, finished: 0, audited: 0
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("needOf 给数组", () => {
  assert.ok(Array.isArray(needOf([3, 2, 2], [1, 1, 1])));
});

check("orderOf 给数组", () => {
  assert.ok(Array.isArray(orderOf([1, 1, 1], [[0, 0, 0]], [[0, 0, 0]], [false])));
});

check("sweepable 给布尔", () => {
  assert.strictEqual(typeof sweepable([1, 1, 1], [[0, 0, 0]], [[0, 0, 0]], [false]), "boolean");
});

check("copyState 是深拷", () => {
  const copy = copyState(hold);
  assert.notStrictEqual(copy.alloc, hold.alloc);
  assert.strictEqual(copy.alloc[0][0], 0);
});

check("declare 给状态", () => {
  const next = declare(blank, 0, [3, 2, 2]);
  assert.ok(Array.isArray(next.claim));
  assert.ok(Array.isArray(next.avail));
});

check("request 与 release 给状态", () => {
  assert.ok(Array.isArray(request(hold, 0, [1, 1, 1]).alloc));
  assert.ok(Array.isArray(release(hold, 0, [0, 0, 0]).alloc));
});

check("finish 与 audit 给状态", () => {
  assert.ok(Array.isArray(finish(hold, 3).done));
  assert.strictEqual(typeof audit(hold).audited, "number");
});

check("render 给视图并数事件", () => {
  const view = render({ state: blank, events: [{ kind: "audit" }, { kind: "bogus" }] });
  assert.ok(Array.isArray(view.avail));
  assert.strictEqual(view.count_events, 2);
  assert.strictEqual(view.failed_events, 1);
});

console.log("8 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
