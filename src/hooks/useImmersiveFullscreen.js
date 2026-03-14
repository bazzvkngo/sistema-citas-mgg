import { useCallback, useEffect } from "react";

export default function useImmersiveFullscreen(rootRef, { styleId, bodyClassName }) {
  useEffect(() => {
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        body.${bodyClassName} .cp-navbar{display:none!important;}
        html.${bodyClassName}{
          overflow:hidden!important;
          scrollbar-width:none;
        }
        body.${bodyClassName}{
          overflow:hidden!important;
          scrollbar-width:none;
        }
        html.${bodyClassName}::-webkit-scrollbar{
          width:0!important;
          height:0!important;
          display:none!important;
        }
        body.${bodyClassName}::-webkit-scrollbar{
          width:0!important;
          height:0!important;
          display:none!important;
        }
        html.${bodyClassName} body{
          overflow:hidden!important;
        }
        html.${bodyClassName} #root{
          height:100vh;
          overflow:hidden!important;
        }
      `;
      document.head.appendChild(style);
    }

    const onFs = () => {
      const fs = !!document.fullscreenElement;
      const targets = [document.documentElement, document.body];
      targets.forEach((node) => {
        if (!node) return;
        if (fs) node.classList.add(bodyClassName);
        else node.classList.remove(bodyClassName);
      });
    };

    document.addEventListener("fullscreenchange", onFs);
    onFs();

    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.body.classList.remove(bodyClassName);
      document.documentElement.classList.remove(bodyClassName);
    };
  }, [bodyClassName, styleId]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      const el = rootRef.current || document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
    } catch (e) {
      console.error("Fullscreen error:", e);
    }
  }, [rootRef]);

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      const isTypingTarget =
        tag === "input" || tag === "textarea" || e.target?.isContentEditable;
      if (isTypingTarget) return;

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleFullscreen]);

  return { toggleFullscreen };
}
