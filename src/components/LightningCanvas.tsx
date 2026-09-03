import { useEffect, useRef } from "react";

export default function LightningCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Rekursiivinen funktio salamapolun pisteiden laskemiseen
    const getLightningPoints = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      displacement: number
    ): { x: number; y: number }[] => {
      if (displacement < 10) {
        return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
      }

      const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * displacement;
      const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * displacement;

      const left = getLightningPoints(x1, y1, midX, midY, displacement / 2);
      const right = getLightningPoints(midX, midY, x2, y2, displacement / 2);

      return [...left.slice(0, -1), ...right];
    };

    // Piirretään salama monikerroksisella hehkulla
    const drawGlowingLightning = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      displacement: number
    ) => {
      const points = getLightningPoints(x1, y1, x2, y2, displacement);
      if (points.length === 0) return;

      ctx.save();
      
      // 1. KERROS: Laaja sininen ulko-hehku (Outer Glow)
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.strokeStyle = "rgba(59, 130, 246, 0.8)"; // Vivid blue
      ctx.lineWidth = 12 + Math.random() * 4;
      ctx.shadowBlur = 45;
      ctx.shadowColor = "#3b82f6";
      ctx.stroke();

      // 2. KERROS: Keskimmäinen kirkas neon-hehku (Mid Glow)
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.strokeStyle = "#60a5fa"; // Cyan/Light Blue
      ctx.lineWidth = 5 + Math.random() * 2;
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#93c5fd";
      ctx.stroke();

      // 3. KERROS: Terävä valkoinen ydin (Core Strike)
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.strokeStyle = "#ffffff"; // Puhdas valkoinen
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#ffffff";
      ctx.stroke();

      ctx.restore();
    };

    let frame = 0;
    const interval = setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (Math.random() > 0.25) {
        // Taustavälähdys vahvistamaan hehkutuntumaa
        ctx.fillStyle = "rgba(59, 130, 246, 0.12)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const startX = canvas.width / 2 + (Math.random() - 0.5) * 350;
        const endX = startX + (Math.random() - 0.5) * 200;
        
        drawGlowingLightning(startX, 0, endX, canvas.height, 160);
      }

      frame++;
      if (frame > 12) clearInterval(interval);
    }, 45);

    return () => clearInterval(interval);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-15 mix-blend-screen"
    />
  );
}