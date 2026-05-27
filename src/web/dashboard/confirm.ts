import { toast } from 'sonner';

export function confirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;

    const toastId = toast.warning('Approval Required', {
      description: message,
      action: {
        label: 'OK',
        onClick: () => {
          if (!resolved) {
            resolved = true;
            toast.dismiss(toastId);
            resolve(true);
          }
        },
      },
      duration: 5000,
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    }, 5100); // Slightly longer than the toast duration
  });
}
