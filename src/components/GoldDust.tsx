import { useEffect, useRef } from "react";

export default function GoldDust() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    // 180 leijuvaa valohiukkasta hitaammalla liikkeellä
    const particles = Array.from({ length: 180 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 3.5 + 1.5,
      speedY: Math.random() * 0.25 + 0.05, // Pudotettu tuntuvasti (oli 0.7 + 0.2)
      speedX: (Math.random() - 0.5) * 0.15, // Rauhoitettu sivuttaisliike
      opacity: Math.random() * 0.7 + 0.3,
      fadeSpeed: Math.random() * 0.003 + 0.001, // Pehmeämpi tuikkiminen
    }));

    const colors = ["#FFFFFF", "#FFFDF0", "#F8F9FA", "#E2E8F0"];

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p, i) => {
        p.y -= p.speedY;
        p.x += p.speedX;
        p.opacity += p.fadeSpeed;

        if (p.opacity >= 0.95 || p.opacity <= 0.2) {
          p.fadeSpeed = -p.fadeSpeed;
        }

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = colors[i % colors.length];
        ctx.globalAlpha = Math.max(0, Math.min(1, p.opacity));

        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgba(255, 255, 255, 1)";
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-10"
    />
  );
}