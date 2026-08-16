import { z } from 'zod';
import { passwordSchema } from '../auth/auth.schemas';
import { MAX_AVATAR_DATA_URL_LENGTH } from './avatar-image';

export const updateAvatarSchema = z.object({
  image: z.string().max(MAX_AVATAR_DATA_URL_LENGTH, 'A imagem excede o limite permitido.'),
}).strict();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual.').max(128),
  newPassword: passwordSchema,
}).strict().refine(
  ({ currentPassword, newPassword }) => currentPassword !== newPassword,
  { path: ['newPassword'], message: 'A nova senha deve ser diferente da senha atual.' },
);

export type UpdateAvatarInput = z.infer<typeof updateAvatarSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
