import { sileo } from 'sileo';

export const showSuccessToast = (title: string, description?: string) => {
  sileo.success({
    title,
    description,
  });
};

export const showErrorToast = (title: string, description?: string) => {
  sileo.error({
    title,
    description,
    duration: 7000,
  });
};
