import { useEffect, useState } from 'react';
import { api, setUnauthorizedHandler } from './lib/api.js';
import AuthScreen from './components/AuthScreen.jsx';
import Dashboard from './Dashboard.jsx';

export default function App() {
  // undefined = still checking, null = signed out
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    api.me().then(setUser).catch(() => setUser(null));
  }, []);

  async function signOut() {
    await api.logout().catch(() => {});
    setUser(null);
  }

  if (user === undefined) return <div className="splash" aria-busy="true" />;
  if (!user) return <AuthScreen onSignedIn={setUser} />;
  // key forces a clean dashboard if a different person signs in.
  return <Dashboard key={user.id} user={user} onSignOut={signOut} />;
}
