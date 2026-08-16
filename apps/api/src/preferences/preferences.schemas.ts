import { z } from 'zod';
import { passwordSchema } from '../auth/auth.schemas';
import { MAX_AVATAR_DATA_URL_LENGTH } from './avatar-image';

export const updateAvatarSchema = z.object({
  image: z.string().max(MAX_AVATAR_DATA_URL_LENGTH, 'A imagem excede o limite permitido.'),
}).strict();

export const changePasswordSchema = z.object({
  newPassword: passwordSchema,
}).strict();

export type UpdateAvatarInput = z.infer<typeof updateAvatarSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
