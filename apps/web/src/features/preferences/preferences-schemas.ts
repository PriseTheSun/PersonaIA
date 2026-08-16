import { z } from 'zod';
import { strongPassword } from '@/features/forms/form-schemas';

export const changePasswordFormSchema = z.object({
  currentPassword: z.string().min(1, 'preferences.currentPasswordRequired').max(128),
  newPassword: strongPassword,
  confirmPassword: z.string().min(1, 'preferences.confirmPasswordRequired').max(128),
}).refine(({ newPassword, confirmPassword }) => newPassword === confirmPassword, {
  path: ['confirmPassword'],
  message: 'preferences.passwordMismatch',
});

export type ChangePasswordFormInput = z.infer<typeof changePasswordFormSchema>;
