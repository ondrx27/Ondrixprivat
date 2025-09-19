// Mock API endpoint for global stats
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { chain } = req.body;

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));

  // Mock data based on chain
  if (chain === 'bnb') {
    // BNB testnet mock global stats
    const mockGlobalStats = {
      totalDeposited: "1.250000", // 1.25 BNB total deposited
      totalUnlocked: "0.312500", // 25% of total (50% immediate + some unlocked)
      totalLocked: "0.312500" // 25% still locked
    };

    return res.status(200).json(mockGlobalStats);
  } else if (chain === 'solana') {
    // Solana mock global stats
    const mockGlobalStats = {
      totalDeposited: "2.500000", // 2.5 SOL total deposited
      totalUnlocked: "0.750000", // 30% of total
      totalLocked: "0.500000" // 20% still locked
    };

    return res.status(200).json(mockGlobalStats);
  }

  return res.status(400).json({ error: 'Invalid chain' });
}