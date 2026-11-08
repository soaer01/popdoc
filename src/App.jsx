import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import AuthForm from './features/auth/AuthForm.jsx';
import Dashboard from './features/docs/Dashboard.jsx';
import DocLayout from './features/docs/DocLayout.jsx';
import Members from './features/docs/Members.jsx';
import Draft from './features/branches/Draft.jsx';
import History from './features/history/History.jsx';
import Pulls from './features/pulls/Pulls.jsx';
import NewPull from './features/pulls/NewPull.jsx';
import PullRequest from './features/pulls/PullRequest.jsx';
import Conflicts from './features/pulls/Conflicts.jsx';
import Landing from './pages/Landing.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Landing />} />
          <Route path="login" element={<AuthForm mode="login" />} />
          <Route path="signup" element={<AuthForm mode="signup" />} />
          <Route element={<RequireAuth />}>
            <Route path="docs" element={<Dashboard />} />
            <Route path="docs/:docId" element={<DocLayout />}>
              <Route index element={<Draft />} />
              <Route path="pulls" element={<Pulls />} />
              <Route path="pulls/new" element={<NewPull />} />
              <Route path="pulls/:prId" element={<PullRequest />} />
              <Route path="pulls/:prId/conflicts" element={<Conflicts />} />
              <Route path="history" element={<History />} />
              <Route path="members" element={<Members />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
