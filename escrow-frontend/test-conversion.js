// Test SOL to lamports conversion
const LAMPORTS_PER_SOL = 1_000_000_000;

function solToLamports(sol) {
  return BigInt(Math.floor(sol * LAMPORTS_PER_SOL));
}

console.log('🧪 Testing SOL to lamports conversion');

const testCases = [
  0.1,
  0.05,
  0.01,
  0.005,
  0.001
];

testCases.forEach(sol => {
  const lamports = solToLamports(sol);
  const backToSol = Number(lamports) / LAMPORTS_PER_SOL;
  const isExact = backToSol === sol;
  const status = isExact ? '✅' : '❌';
  
  console.log(`${status} ${sol} SOL → ${lamports} lamports → ${backToSol} SOL (exact: ${isExact})`);
  
  // Check minimum
  const MIN_SOL_INVESTMENT_LAMPORTS = 1_000_000;
  const meetsMinimum = Number(lamports) >= MIN_SOL_INVESTMENT_LAMPORTS;
  const minStatus = meetsMinimum ? '✅' : '❌';
  console.log(`    ${minStatus} Meets minimum: ${Number(lamports)} >= ${MIN_SOL_INVESTMENT_LAMPORTS} (${meetsMinimum})`);
});