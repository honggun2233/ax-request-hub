
/**
 * GATE3 ?꾪솚 怨듯넻 濡쒖쭅 ??PATCH /api/registry ? sandbox-complete 媛 怨듭쑀.
 * gate3Passed / gate3PassedAt ?명똿?????⑥닔濡쒕쭔 泥섎━?쒕떎.
 */
export function buildGate3UpdateData(now: Date): {
  gate3Passed: boolean
  gate3PassedAt: Date
} {
  return {
    gate3Passed: true,
    gate3PassedAt: now,
  }
}
