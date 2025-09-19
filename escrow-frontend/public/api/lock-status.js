// Mock API endpoint for lock status
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { chain, address } = req.body;

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Mock data based on chain
  if (chain === 'bnb') {
    // BNB testnet mock data
    const mockLockStatus = {
      totalInvested: "0.020000", // 0.02 BNB
      immediateAmount: "0.010000", // 50% immediate
      lockedAmount: "0.010000", // 50% locked
      unlockTime: Math.floor(Date.now() / 1000) + 300, // 5 minutes from now
      isUnlocked: false,
      timeRemaining: 300 // 5 minutes in seconds
    };

    return res.status(200).json(mockLockStatus);
  } else if (chain === 'solana') {
    // Solana mock data
    const mockLockStatus = {
      totalInvested: "0.050000", // 0.05 SOL
      immediateAmount: "0.025000", // 50% immediate
      lockedAmount: "0.025000", // 50% locked
      unlockTime: Math.floor(Date.now() / 1000) + 180, // 3 minutes from now
      isUnlocked: false,
      timeRemaining: 180 // 3 minutes in seconds
    };

    return res.status(200).json(mockLockStatus);
  }

  return res.status(400).json({ error: 'Invalid chain' });
}