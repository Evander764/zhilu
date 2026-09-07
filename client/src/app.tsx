import { Route, Routes, useLocation } from 'react-router-dom';
import ZhiluPage from './pages/ZhiluPage/ZhiluPage';
import QuestionMapPage from './pages/QuestionMapPage/QuestionMapPage';

function HomePage() {
  const location = useLocation();
  return new URLSearchParams(location.search).has('p') ? (
    <ZhiluPage />
  ) : (
    <QuestionMapPage />
  );
}

const RoutesComponent = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/map" element={<QuestionMapPage />} />
      <Route path="/read" element={<ZhiluPage />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  );
};

export default RoutesComponent;
