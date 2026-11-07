import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import Landing from './pages/Landing.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Landing />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
