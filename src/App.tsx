import { HashRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Tracker } from './pages/Tracker';
import { Settings } from './pages/Settings';

function App() {
  return (
    <HashRouter>
      <div className="flex flex-col h-full max-w-lg mx-auto">
        <Header />
        <Routes>
          <Route path="/" element={<Tracker />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </HashRouter>
  );
}

export default App;
