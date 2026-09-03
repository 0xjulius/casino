import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import GyreRoulette from "./components/GyreRoulette";
import CoinCanvas from "./components/CoinCanvas";
import GoldDust from "./components/GoldDust";
import LightningCanvas from "./components/LightningCanvas";
import bgImage from "./assets/bg2.png";

function App() {
  const [mounted, setMounted] = useState(false);
  const [isDarkFlash, setIsDarkFlash] = useState(false);
  const [showLightning, setShowLightning] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const triggerDarkFlash = () => {
    // Soitetaan ääni public/sounds/0.wav -kansiosta
    const audio = new Audio("/sounds/0.wav");
    audio.play().catch((err) => console.error("Audio playback error:", err));

    setIsDarkFlash(true);
    setShowLightning(true);

    // Salama kestävä animaatio n. 0.6s
    setTimeout(() => {
      setShowLightning(false);
    }, 600);

    // Tummennus kestää 1.2s
    setTimeout(() => {
      setIsDarkFlash(false);
    }, 1200);
  };

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
      {/* Tummentava kerros */}
      <div
        className={`fixed inset-0 bg-black/80 transition-opacity duration-300 pointer-events-none z-10 ${
          isDarkFlash ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* CANVAKSELLA TOTEUTETTU AITO SALAMA */}
      {showLightning && <LightningCanvas />}

      <GoldDust />

      {/* 3D-PÄÄ (Piilotetaan isHidden-propilla kun modal on auki) */}
      {mounted && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute top-0 left-0 w-full z-30 pointer-events-none"
        >
          <CoinCanvas isHidden={isModalOpen} />
        </motion.div>
      )}

      {/* PÄÄSISÄLTÖ (z-20) */}
      <main className="w-full z-20 px-2 sm:px-4 pt-12 sm:pt-0">
        <GyreRoulette 
          onZeroWin={triggerDarkFlash} 
          onModalToggle={(isOpen) => setIsModalOpen(isOpen)} 
        />
      </main>
    </div>
  );
}

export default App;