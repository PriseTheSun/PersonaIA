import { Request } from 'express';
import { Principal } from './principal';

export interface AuthenticatedRequest extends Request {
  user: Principal;
}
