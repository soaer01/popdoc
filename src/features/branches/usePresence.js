import { useEffect, useState } from 'react';
import { getSocket, joinBranch, leaveBranch } from '../../lib/socket.js';

// Who else is in this branch right now. Presence is scoped to one branch at a time.
export function usePresence(branchId, user) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!branchId || !user) return undefined;
    const socket = getSocket();
    const onPresence = (msg) => {
      if (msg.branchId === branchId) setUsers(msg.users);
    };
    socket.on('presence', onPresence);
    joinBranch(branchId, user);
    return () => {
      socket.off('presence', onPresence);
      leaveBranch(branchId);
    };
  }, [branchId, user]);

  return users;
}
