import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    req.companyId = payload.companyId;
    req.role = payload.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export async function loadUser(req, res, next) {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user || !user.isActive) {
      return res.status(403).json({ error: 'User inactive or not found' });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(500).json({ error: 'Failed to load user' });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
