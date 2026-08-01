export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function mean(values) {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

export function standardDeviation(values) {
  if (values.length === 0) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

export function quantile(sortedValues, probability) {
  if (sortedValues.length === 0) return 0;
  const position = (sortedValues.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

export function correlation(left, right) {
  if (left.length !== right.length || left.length === 0) return 0;
  const leftMean = mean(left);
  const rightMean = mean(right);
  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - leftMean;
    const rightDelta = right[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftVariance += leftDelta ** 2;
    rightVariance += rightDelta ** 2;
  }

  const denominator = Math.sqrt(leftVariance * rightVariance);
  return denominator === 0 ? 0 : numerator / denominator;
}

export function rootMeanSquareError(left, right) {
  if (left.length !== right.length || left.length === 0) return 0;
  return Math.sqrt(
    mean(left.map((value, index) => (value - right[index]) ** 2)),
  );
}
