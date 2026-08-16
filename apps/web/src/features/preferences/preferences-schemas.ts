import { z } from 'zod';
import { strongPassword } from '@/lib/password-policy';

export const changePasswordFormSchema = z.object({
  newPassword: strongPassword,
  confirmPassword: z.string().min(1, 'preferences.confirmPasswordRequired').max(128),
}).refine(({ newPassword, confirmPassword }) => newPassword === confirmPassword, {
  path: ['confirmPassword'],
  message: 'preferences.passwordMismatch',
});

export type ChangePasswordFormInput = z.infer<typeof changePasswordFormSchema>;
