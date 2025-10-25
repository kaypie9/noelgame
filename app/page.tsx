'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';

const btn: React.CSSProperties = {
  background: '#8e44ad',
  color: '#fff',
  border: 'none',
  padding: '8px 12px',
  borderRadius: 12,
  fontWeight: 700,
  cursor: 'pointer',
};

export default function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, status } = useConnect();
  const { disconnect } = useDisconnect();

  // pick the Farcaster Mini App connector from the configured list
  const fc = connectors.find(c => c.name?.toLowerCase().includes('farcaster')) ?? connectors[0];

  const short = (a?: `0x${string}`) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

  if (!isConnected) {
    return (
      <button
        style={btn}
        onClick={() => fc && connect({ connector: fc })}
        disabled={status === 'pending' || !fc}
      >
        {status === 'pending' ? 'Connecting…' : 'Connect'}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={{ fontWeight: 700 }}>{short(address as any)}</span>
      <button style={{ ...btn, background: '#2a1f3b' }} onClick={() => disconnect()}>
        Disconnect
      </button>
    </div>
  );
}
