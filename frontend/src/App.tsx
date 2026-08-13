import { WebSocketProvider } from './contexts/WebSocketContext';
import Sidebar from './components/Layout/Sidebar';
import MainArea from './components/Layout/MainArea';
import ToastContainer from './components/Toast/ToastContainer';
import { ErrorListener } from './components/Toast/ErrorListener';

export default function App() {
  return (
    <WebSocketProvider>
      <div className="app">
        <Sidebar />
        <MainArea />
      </div>
      <ToastContainer />
      <ErrorListener />
    </WebSocketProvider>
  );
}
