import { useEffect } from "react";

export function useHideCameraButton() {
  useEffect(() => {
    const hideCameraButton = () => {
      const footer =
        document.querySelector('.zm-meeting-footer') ||
        document.querySelector('[class*="footer__"]');

      if (!footer) return;

      // Botones de la toolbar de Zoom (Material UI)
      const buttons = footer.querySelectorAll(
        'button.zoom-MuiButtonBase-root, button[class*="MuiButtonBase-root"]'
      );

      // Por convención: [0] audio, [1] video
      if (buttons.length >= 2) {
        const videoBtn = buttons[1];
        videoBtn.style.display = "none";
      }
    };

    hideCameraButton();
    const id = setInterval(hideCameraButton, 1500); // por si Zoom re-dibuja la barra
    return () => clearInterval(id);
  }, []);
}
