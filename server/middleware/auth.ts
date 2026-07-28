import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    clinic_name?: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'rxguardian_secure_jwt_secret_key_2026_clinic';

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token: string | undefined;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    console.warn(`[Auth Guard] Unauthenticated request to ${req.path}. Origin: ${req.headers.origin || 'none'}`);
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string; clinic_name?: string };
    req.user = decoded;
    next();
  } catch (err) {
    console.warn(`[Auth Guard] Invalid token for ${req.path}. Origin: ${req.headers.origin || 'none'}. Error: ${(err as Error).message}`);
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}
