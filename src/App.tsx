import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Tracker } from './pages/Tracker';
import { Settings } from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col h-full max-w-lg mx-auto">
        <Header />
        <Routes>
          <Route path="/" element={<Tracker />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
