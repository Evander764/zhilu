import { Route, Routes } from 'react-router-dom';
import ZhiluPage from './pages/ZhiluPage/ZhiluPage';

const RoutesComponent = () => {
  return (
    <Routes>
      <Route path="*" element={<ZhiluPage />} />
    </Routes>
  );
};

export default RoutesComponent;
