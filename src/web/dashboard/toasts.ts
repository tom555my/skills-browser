import { toast } from 'sonner';

export const showSuccessToast = (title: string, description?: string) => {
  toast.success(title, {
    description,
  });
};

export const showErrorToast = (title: string, description?: string) => {
  toast.error(title, {
    description,
    duration: 7000,
  });
};
