// resbank.js：需求向量与安全扫掠
export function needOf(claimRow, allocRow) {
  return claimRow.map(function (value, at) { return value - allocRow[at]; });
}

function fits(needRow, work) {
  for (let at = 0; at < work.length; at += 1) {
    if (needRow[at] > work[at]) { return false; }
  }
  return true;
}

export function orderOf(avail, need, alloc, done) {
  const work = avail.slice();
  const settled = new Array(need.length).fill(false);
  const order = [];
  let moved = true;
  while (moved) {
    moved = false;
    for (let pid = 0; pid < need.length; pid += 1) {
      if (settled[pid] || done[pid] || need[pid] === null) { continue; }
      if (fits(need[pid], work)) {
        for (let at = 0; at < work.length; at += 1) {
          work[at] += alloc[pid][at];
        }
        settled[pid] = true;
        order.push(pid);
        moved = true;
      }
    }
  }
  return order;
}

export function sweepable(avail, need, alloc, done) {
  const order = orderOf(avail, need, alloc, done);
  for (let pid = 0; pid < need.length; pid += 1) {
    if (!done[pid] && need[pid] !== null && order.indexOf(pid) === -1) {
      return false;
    }
  }
  return true;
}
