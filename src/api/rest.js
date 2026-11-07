// REST implementation. Each method maps to an Express route that the backend will provide.
import { http } from './http.js';

export const rest = {
  auth: {
    me: () => http('/auth/me'),
    login: (body) => http('/auth/login', { method: 'POST', body }),
    signup: (body) => http('/auth/signup', { method: 'POST', body }),
    logout: () => http('/auth/logout', { method: 'POST' }),
  },
};
