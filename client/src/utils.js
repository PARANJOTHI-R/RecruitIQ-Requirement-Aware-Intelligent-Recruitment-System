export const formatScore = (score) => {
  if (score === null || score === undefined) return '0.0';
  
  const numScore = Number(score);
  if (isNaN(numScore)) return '0.0';

  // If score is represented as a ratio [0,1], convert it to percentage
  // Otherwise assume it's already a percentage [0,100]
  const percentage = numScore <= 1.0 ? numScore * 100 : numScore;
  
  return percentage.toFixed(1);
};
