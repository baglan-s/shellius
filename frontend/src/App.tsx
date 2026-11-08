import { useState, useEffect, useCallback } from 'react';
import { WebSocketProvider, useWS } from './contexts/WebSocketContext';
import { I18nProvider } from './i18n/I18nProvider';
import { useAuthStore } from './stores/authStore';
import LoginForm from './components/Auth/LoginForm';
import MasterPasswordPrompt from './components/MasterPassword/MasterPasswordPrompt';
import HostVerifyDialog from './components/HostVerify/HostVerifyDialog';
import Sidebar from './components/Layout/Sidebar';
import MainArea from './components/Layout/MainArea';
import ToastContainer from './components/Toast/ToastContainer';
import { ErrorListener } from './components/Toast/ErrorListener';

interface HostVerifyData {
  id: string;
  hostname: string;
  port: number;
  fingerprint: string;
  key_type: string;
  status: 'new' | 'changed';
  old_fingerprint?: string;
}

function AppContent() {
  const [masterState, setMasterState] = useState<'loading' | 'setup' | 'unlock' | 'unlocked'>('loading');
  const [masterError, setMasterError] = useState('');
  const [masterLoading, setMasterLoading] = useState(false);
  const [hostVerify, setHostVerify] = useState<HostVerifyData | null>(null);
  const { send, subscribe, connected } = useWS();

  useEffect(() => {
    if (!connected) return;
    send({ type: 'master.status' });
  }, [connected, send]);

  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === 'master.status') {
        const p = msg.payload as { configured: boolean; locked: boolean };
        if (!p.configured) {
          setMasterState('setup');
        } else if (p.locked) {
          setMasterState('unlock');
        } else {
          setMasterState('unlocked');
        }
      }
      if (msg.type === 'success' && msg.id === 'master-op') {
        setMasterState('unlocked');
        setMasterLoading(false);
        setMasterError('');
      }
      if (msg.type === 'error' && msg.id === 'master-op') {
        const p = msg.payload as { message: string };
        setMasterError(p.message);
        setMasterLoading(false);
      }
      // Host key verification
      if (msg.type === 'ssh.host_verify' && msg.id) {
        const p = msg.payload as {
          hostname: string; port: number; fingerprint: string;
          key_type: string; status: 'new' | 'changed'; old_fingerprint?: string;
        };
        setHostVerify({
          id: msg.id,
          hostname: p.hostname,
          port: p.port,
          fingerprint: p.fingerprint,
          key_type: p.key_type,
          status: p.status,
          old_fingerprint: p.old_fingerprint,
        });
      }
    });
  }, [subscribe]);

  const handleMasterSubmit = useCallback((password: string) => {
    setMasterError('');
    setMasterLoading(true);
    const type = masterState === 'setup' ? 'master.setup' : 'master.unlock';
    send({ type, id: 'master-op', payload: { password } });
  }, [send, masterState]);

  const handleHostVerifyResponse = useCallback((accept: boolean) => {
    if (hostVerify) {
      send({
        type: 'ssh.host_confirm',
        id: hostVerify.id,
        payload: { accept },
      });
      setHostVerify(null);
    }
  }, [send, hostVerify]);

  if (masterState === 'loading') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
        fontSize: 14,
      }}>
        Connecting...
      </div>
    );
  }

  if (masterState === 'setup' || masterState === 'unlock') {
    return (
      <MasterPasswordPrompt
        configured={masterState === 'unlock'}
        onSubmit={handleMasterSubmit}
        error={masterError}
        loading={masterLoading}
      />
    );
  }

  return (
    <>
      <div className="app">
        <Sidebar />
        <MainArea />
      </div>
      <ToastContainer />
      <ErrorListener />
      {hostVerify && (
        <HostVerifyDialog
          hostname={hostVerify.hostname}
          port={hostVerify.port}
          fingerprint={hostVerify.fingerprint}
          keyType={hostVerify.key_type}
          status={hostVerify.status}
          oldFingerprint={hostVerify.old_fingerprint}
          onAccept={() => handleHostVerifyResponse(true)}
          onReject={() => handleHostVerifyResponse(false)}
        />
      )}
    </>
  );
}

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [skipped, setSkipped] = useState(
    () => localStorage.getItem('shellius_auth_skipped') === 'true'
  );

  const handleSkip = () => {
    localStorage.setItem('shellius_auth_skipped', 'true');
    setSkipped(true);
  };

  const showApp = isAuthenticated || skipped;

  return (
    <I18nProvider>
      {showApp ? (
        <WebSocketProvider>
          <AppContent />
        </WebSocketProvider>
      ) : (
        <LoginForm onSkip={handleSkip} />
      )}
    </I18nProvider>
  );
}
