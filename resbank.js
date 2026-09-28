// resbank.js：需求向量与安全扫掠
export function needOf(claimRow, allocRow) {
  return claimRow.map(function (value, at) { return value - allocRow[at]; });
}

// 按进程号从小到大反复扫描：已声明、未完结且需求逐项不超过工作向量的进程可做完
export function orderOf(avail, need, alloc, done) {
  const work = avail.slice();
  const width = work.length;
  const finished = done.slice();
  const order = [];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (let pid = 0; pid < need.length; pid += 1) {
      if (finished[pid] || need[pid] === null || need[pid] === undefined) {
        continue;
      }
      let fits = true;
      for (let at = 0; at < width; at += 1) {
        if (need[pid][at] > work[at]) {
          fits = false;
          break;
        }
      }
      if (fits) {
        for (let at = 0; at < width; at += 1) {
          work[at] += alloc[pid][at];
        }
        finished[pid] = true;
        order.push(pid);
        progressed = true;
      }
    }
  }
  return order;
}

export function sweepable(avail, need, alloc, done) {
  const order = orderOf(avail, need, alloc, done);
  for (let pid = 0; pid < need.length; pid += 1) {
    if (!done[pid] && need[pid] !== null && need[pid] !== undefined && order.indexOf(pid) === -1) {
      return false;
    }
  }
  return true;
}
