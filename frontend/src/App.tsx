import { WebSocketProvider } from './contexts/WebSocketContext';
import Sidebar from './components/Layout/Sidebar';
import MainArea from './components/Layout/MainArea';

export default function App() {
  return (
    <WebSocketProvider>
      <div className="app">
        <Sidebar />
        <MainArea />
      </div>
    </WebSocketProvider>
  );
}
