export function importanceClass(score = 0): string {
  if (score >= 85) {
    return 'high';
  }
  if (score >= 70) {
    return 'mid';
  }
  return 'low';
}

export function importanceLabel(score: number): string {
  if (score >= 85) {
    return '高';
  }
  if (score >= 70) {
    return '中';
  }
  return '低';
}
