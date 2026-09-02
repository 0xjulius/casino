import GyreRoulette from './components/GyreRoulette';
import CoinCanvas from './components/CoinCanvas';
import bgImage from './assets/bg.png';

function App() {
  return (
<div 
      className="min-h-screen w-full"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'scroll',
      }}
    >
      <CoinCanvas />
      <GyreRoulette /> 
    </div>
  );
}

export default App;