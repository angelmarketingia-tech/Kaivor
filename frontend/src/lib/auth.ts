import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'kaivor-jwt-secret-prod-2026-super-secure-key!';

export interface JwtPayload {
  sub: string;
  email: string;
  tenant_id: string;
  role: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function getTokenFromRequest(req: NextRequest): JwtPayload | null {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    return verifyToken(auth.slice(7));
  } catch {
    return null;
  }
}

export function unauthorized() {
  return Response.json({ message: 'No autorizado' }, { status: 401 });
}
