import { sileo } from 'sileo';

export function confirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;
    
    const toastId = sileo.warning({
      title: 'Approval Required',
      description: message,
      button: {
        title: 'OK',
        onClick: () => {
          if (!resolved) {
            resolved = true;
            sileo.dismiss(toastId);
            resolve(true);
          }
        }
      },
      // Set a reasonable duration so the toast doesn't stay forever
      duration: 5000
    });
    
    // If the toast is dismissed without clicking OK (by timeout or click outside),
    // we'll resolve as false after a short delay to allow for the OK click
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    }, 5100); // Slightly longer than the toast duration
  });
}