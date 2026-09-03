import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import GyreRoulette from "./components/GyreRoulette";
import CoinCanvas from "./components/CoinCanvas";
import GoldDust from "./components/GoldDust";
import bgImage from "./assets/bg2.png";

function App() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      className="min-h-screen w-full relative flex flex-col items-center justify-start pt-24 sm:pt-32 overflow-x-hidden"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      {/* OMA PUHDAS CANVAS-KULTAPÖLY */}
      <GoldDust />

      {/* Kolikon Fade-in */}
      {mounted && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            ease: "easeOut",
          }}
          className="absolute top-0 left-0 w-full z-50 pointer-events-none"
        >
          <CoinCanvas />
        </motion.div>
      )}

      {/* Pelikortti */}
      <main className="w-full z-20 px-2 sm:px-4 pt-12 sm:pt-0">
        <GyreRoulette />
      </main>
    </div>
  );
}

export default App;