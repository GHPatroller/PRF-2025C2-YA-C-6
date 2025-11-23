import { useEffect } from "react";

export function useHideCameraButton() {
  useEffect(() => {
    const hideCameraButton = () => {
      // Buscamos botones con la clase que viste en DevTools
      const buttons = document.querySelectorAll("button.css-1lnylgv");

      console.log("[ZFEv1] hideCameraButton -> css-1lnylgv encontrados:", buttons.length);

      buttons.forEach((btn) => {
        btn.style.display = "none";
      });
    };

    hideCameraButton();
    const id = setInterval(hideCameraButton, 1500); // por si Zoom re-renderiza el footer
    return () => clearInterval(id);
  }, []);
}
