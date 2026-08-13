import { useState } from 'react';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { I18nProvider } from './i18n/I18nProvider';
import { useAuthStore } from './stores/authStore';
import LoginForm from './components/Auth/LoginForm';
import Sidebar from './components/Layout/Sidebar';
import MainArea from './components/Layout/MainArea';
import ToastContainer from './components/Toast/ToastContainer';
import { ErrorListener } from './components/Toast/ErrorListener';

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
          <div className="app">
            <Sidebar />
            <MainArea />
          </div>
          <ToastContainer />
          <ErrorListener />
        </WebSocketProvider>
      ) : (
        <LoginForm onSkip={handleSkip} />
      )}
    </I18nProvider>
  );
}
