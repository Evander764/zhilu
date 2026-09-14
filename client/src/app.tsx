import { Route, Routes } from 'react-router-dom';
import ZhiluPage from './pages/ZhiluPage/ZhiluPage';
import QuestionMapPage from './pages/QuestionMapPage/QuestionMapPage';
import ZhihuDemoPage from './pages/ZhihuDemoPage/ZhihuDemoPage';

const RoutesComponent = () => {
  return (
    <Routes>
      <Route path="/" element={<ZhihuDemoPage />} />
      <Route path="/question/:id" element={<ZhihuDemoPage />} />
      <Route
        path="/question/:id/answer/:answerId"
        element={<ZhihuDemoPage />}
      />
      <Route path="/settings" element={<ZhihuDemoPage />} />
      <Route path="/settings/:section" element={<ZhihuDemoPage />} />
      <Route path="/auth/zhihu/callback" element={<ZhihuDemoPage />} />
      <Route path="/map" element={<QuestionMapPage />} />
      <Route path="/read" element={<ZhiluPage />} />
      <Route path="*" element={<ZhihuDemoPage />} />
    </Routes>
  );
};

export default RoutesComponent;
