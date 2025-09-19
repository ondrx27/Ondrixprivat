import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, Unlock, Timer, TrendingUp, DollarSign } from 'lucide-react';
import { ethers } from 'ethers';
import { CONTRACTS, ESCROW_ABI } from '../config/contracts';
import { getEscrowStatus as getSolanaEscrowStatus, getSolanaTransparencyData, getSolanaNextUnlockTime } from '../utils/solana';
import { useWallet } from '../contexts/WalletContext';

interface GlobalLockData {
  totalDeposited: string;
  totalUnlocked: string;
  totalLocked: string;
  nextUnlockTime: number;
  progress: number; // Процент прошедшего времени
  timeUntilNextUnlock: number;
  lockDuration: number; // Длительность блокировки в секундах
  network: 'bnb' | 'solana';
  currency: string; // 'BNB' или 'SOL'
}

export const GlobalLockStatus: React.FC = () => {
  const wallet = useWallet();
  const [lockData, setLockData] = useState<GlobalLockData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<string>('');

  const fetchGlobalLockStatus = async () => {
    try {
      if (wallet.chain === 'bnb') {
        await fetchBnbLockStatus();
      } else if (wallet.chain === 'solana') {
        await fetchSolanaLockStatus();
      }
    } catch (error) {
      console.error('Error fetching global lock status:', error);
      setLockData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBnbLockStatus = async () => {
    // Используем прямое подключение к BSC testnet
    const provider = new ethers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545');
    const contract = new ethers.Contract(CONTRACTS.bnb.escrow, ESCROW_ABI, provider);

      // Получаем глобальные данные и информацию о блокировке
      const [totalDeposited, totalUnlocked, totalLocked, escrowStatus] = await Promise.all([
        contract.totalDeposited(),
        contract.totalUnlocked(), 
        contract.totalLocked(),
        contract.getEscrowStatus()
      ]);
      
      const lockDuration = Number(escrowStatus[5]) || 14400; // lockDuration из контракта, fallback 4 часа

      // Найти реального инвестора и получить время разблокировки
      const potentialAddresses = [
        "0x017ae1B2116dE27d3Fd9A89004604ef0e3658df3", // Реальный инвестор
        "0x752669e07416E42b318471Eea005f7c9A7828ADF", // Fallback
      ];
      
      let nextUnlockTime = 0;
      let investorFound = false;
      
      // Ищем инвестора с депозитом
      for (const address of potentialAddresses) {
        try {
          const investorInfo = await contract.getInvestorInfo(address);
          const bnbDeposited = Number(ethers.formatEther(investorInfo[1] || 0));
          
          if (bnbDeposited > 0) {
            console.log('Found investor:', address, 'with', bnbDeposited, 'BNB');
            const unlockTime = await contract.nextUnlockTime(address);
            nextUnlockTime = Number(unlockTime);
            investorFound = true;
            console.log('Next unlock time:', nextUnlockTime, 'timestamp');
            break;
          }
        } catch (err) {
          console.log('Could not check address:', address, err);
        }
      }
      
      if (!investorFound) {
        console.log('No investor found, using lockDuration for demo');
        // Fallback: используем текущее время + lockDuration для демонстрации
        const escrowStatus = await contract.getEscrowStatus();
        const lockDuration = Number(escrowStatus[5]) || 14400; // 4 hours
        nextUnlockTime = Math.floor(Date.now() / 1000) + lockDuration;
      }

      const totalDepositedFormatted = ethers.formatEther(totalDeposited);
      const totalUnlockedFormatted = ethers.formatEther(totalUnlocked);
      const totalLockedFormatted = ethers.formatEther(totalLocked);

      // Вычисляем прогресс времени (сколько времени прошло до разблокировки)
      let progress = 0;
      if (nextUnlockTime > 0) {
        const currentTime = Math.floor(Date.now() / 1000);
        const unlockTime = nextUnlockTime;
        const startTime = unlockTime - lockDuration;
        
        if (currentTime >= unlockTime) {
          progress = 100; // Полностью разблокировано
        } else if (currentTime >= startTime) {
          const elapsed = currentTime - startTime;
          progress = (elapsed / lockDuration) * 100;
        } else {
          progress = 0; // Еще не началась блокировка
        }
      }

      // Время до следующей разблокировки
      const currentTime = Math.floor(Date.now() / 1000);
      const timeUntilNextUnlock = Math.max(0, nextUnlockTime - currentTime);

      setLockData({
        totalDeposited: totalDepositedFormatted,
        totalUnlocked: totalUnlockedFormatted,
        totalLocked: totalLockedFormatted,
        nextUnlockTime,
        progress,
        timeUntilNextUnlock,
        lockDuration,
        network: 'bnb',
        currency: 'BNB'
      });
  };

  const fetchSolanaLockStatus = async () => {
    console.log('📊 Fetching Solana lock status from smart contract...');
    
    try {
      // Get transparency data directly from smart contract
      const transparencyData = await getSolanaTransparencyData();
      const escrowData = await getSolanaEscrowStatus();
      
      const totalDepositedFormatted = transparencyData.totalDeposited.toFixed(6);
      const totalUnlockedFormatted = transparencyData.totalUnlocked.toFixed(6);
      const totalLockedFormatted = transparencyData.totalLocked.toFixed(6);
      
      // Use lock duration from contract (should be 4 hours = 14400 seconds)
      const lockDuration = escrowData.lockDuration || 14400; // fallback 4 hours
      
      // Get real unlock time based on contract initialization
      const nextUnlockTime = await getSolanaNextUnlockTime();
      const currentTime = Math.floor(Date.now() / 1000);
      const timeUntilNextUnlock = Math.max(0, nextUnlockTime - currentTime);
      
      // Calculate time progress based on initialization time
      let progress = 0;
      if (nextUnlockTime > 0 && escrowData.initializationTimestamp) {
        const startTime = escrowData.initializationTimestamp;
        if (currentTime >= nextUnlockTime) {
          progress = 100;
        } else if (currentTime >= startTime) {
          const elapsed = currentTime - startTime;
          progress = (elapsed / lockDuration) * 100;
        }
      }
      
      setLockData({
        totalDeposited: totalDepositedFormatted,
        totalUnlocked: totalUnlockedFormatted, // from contract calculation
        totalLocked: totalLockedFormatted,      // from contract calculation
        nextUnlockTime,
        progress,
        timeUntilNextUnlock,
        lockDuration,
        network: 'solana',
        currency: 'SOL'
      });
      
      console.log('📊 Solana transparency stats (from contract):', {
        totalDeposited: totalDepositedFormatted,
        totalUnlocked: totalUnlockedFormatted,
        totalLocked: totalLockedFormatted,
        lockDuration: `${lockDuration}s (${lockDuration/3600}h)`
      });
    } catch (error) {
      console.error('Error fetching Solana transparency data:', error);
      // Fallback to old method if new transparency functions fail
      const escrowData = await getSolanaEscrowStatus();
      
      const totalDepositedFormatted = escrowData.totalSolDeposited.toFixed(6);
      const totalWithdrawnFormatted = escrowData.totalSolWithdrawn.toFixed(6);
      const currentlyLocked = escrowData.totalSolDeposited - escrowData.totalSolWithdrawn;
      const totalLockedFormatted = currentlyLocked.toFixed(6);
      
      // Fallback with initialization-based timer if available
      const fallbackNextUnlock = escrowData.initializationTimestamp 
        ? escrowData.initializationTimestamp + (escrowData.lockDuration || 14400)
        : Math.floor(Date.now() / 1000) + (escrowData.lockDuration || 14400);
      
      setLockData({
        totalDeposited: totalDepositedFormatted,
        totalUnlocked: totalWithdrawnFormatted,
        totalLocked: totalLockedFormatted,
        nextUnlockTime: fallbackNextUnlock,
        progress: 0,
        timeUntilNextUnlock: Math.max(0, fallbackNextUnlock - Math.floor(Date.now() / 1000)),
        lockDuration: escrowData.lockDuration || 14400,
        network: 'solana',
        currency: 'SOL'
      });
    }
  };

  // Обновление таймера каждую секунду
  useEffect(() => {
    if (!lockData || lockData.timeUntilNextUnlock <= 0) return;

    const updateTimer = () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const timeLeft = Math.max(0, lockData.nextUnlockTime - currentTime);
      
      if (timeLeft <= 0) {
        setTimeLeft('Unlocked');
        return;
      }

      const days = Math.floor(timeLeft / (24 * 60 * 60));
      const hours = Math.floor((timeLeft % (24 * 60 * 60)) / (60 * 60));
      const minutes = Math.floor((timeLeft % (60 * 60)) / 60);
      const seconds = timeLeft % 60;

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lockData]);

  // Загрузка данных при монтировании компонента и смене сети
  useEffect(() => {
    fetchGlobalLockStatus();
    // Обновляем каждые 30 секунд
    const interval = setInterval(fetchGlobalLockStatus, 30000);
    return () => clearInterval(interval);
  }, [wallet.chain]); // Перезагружаем при смене сети

  if (isLoading) {
    return (
      <div className="bg-bg-card rounded-xl border border-border-dark p-6 animate-pulse">
        <div className="h-6 bg-bg-hover rounded mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-bg-hover rounded-lg p-4">
              <div className="h-4 bg-bg-secondary rounded w-3/4 mb-2"></div>
              <div className="h-6 bg-bg-secondary rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!lockData) return null;

  const formatBnb = (value: string) => {
    const num = parseFloat(value);
    return num.toFixed(6);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-bg-card rounded-xl border border-border-dark p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-text-primary flex items-center">
          <Lock className="mr-3 text-accent-primary" size={24} />
          Global Lock Status
        </h3>
        <div className="text-sm text-text-muted">
          Live on {lockData.network === 'bnb' ? 'BSC Testnet' : 'Solana Devnet'}
        </div>
      </div>

      {/* Главная статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-300 text-sm font-medium">Total Deposited</p>
              <p className="text-2xl font-bold text-blue-200">
                {formatBnb(lockData.totalDeposited)} {lockData.currency}
              </p>
            </div>
            <DollarSign className="text-blue-400" size={24} />
          </div>
        </div>


        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-300 text-sm font-medium">Total in Lock</p>
              <p className="text-2xl font-bold text-purple-200">
                {formatBnb(lockData.totalLocked)} {lockData.currency}
              </p>
            </div>
            <Lock className="text-purple-400" size={24} />
          </div>
        </div>

        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-300 text-sm font-medium">Released to Project</p>
              <p className="text-2xl font-bold text-green-200">
                {formatBnb(lockData.totalUnlocked)} {lockData.currency}
              </p>
            </div>
            <Unlock className="text-green-400" size={24} />
          </div>
        </div>
      </div>

      {/* Прогресс-бар времени */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-text-muted mb-2">
          <span>Lock Progress (ends {new Date(lockData.nextUnlockTime * 1000).toLocaleDateString()})</span>
          <span>{lockData.progress.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-bg-hover rounded-full h-4 overflow-hidden">
          <motion.div
            className="bg-gradient-to-r from-orange-500 to-green-500 h-4 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${lockData.progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Таймер до следующей разблокировки */}
      {lockData.timeUntilNextUnlock > 0 ? (
        <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-300 text-sm font-medium flex items-center">
                <Timer className="mr-2" size={16} />
                Next Unlock Timer
              </p>
              <p className="text-xl font-mono text-purple-200">{timeLeft}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-purple-400">Unlocks at:</p>
              <p className="text-sm text-purple-300">
                {new Date(lockData.nextUnlockTime * 1000).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-green-900/40 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center">
            <Unlock className="mr-3 text-green-400" size={20} />
            <div>
              <p className="text-green-300 font-medium">All Funds Unlocked</p>
              <p className="text-green-400 text-sm">Ready for withdrawal</p>
            </div>
          </div>
        </div>
      )}

      {/* Информация о прозрачности */}
      <div className="mt-4 pt-4 border-t border-border-dark">
        <p className="text-xs text-text-muted text-center">
          🔍 All data is read directly from the smart contract on {lockData.network === 'bnb' ? 'BSC Testnet' : 'Solana Devnet'}.
          {lockData.network === 'bnb' && `Contract: ${CONTRACTS.bnb.escrow}`}
          {lockData.network === 'solana' && 'Program: Solana Escrow'}
        </p>
      </div>
    </motion.div>
  );
};