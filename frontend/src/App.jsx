import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import HomePage from "./pages/HomePage"; 
import ProtectedRoute from "./components/ProtectedRoute";
import DetectionsPage from "./components/DetectionsPage";

function App(){
  return (
    <Routes>
      {/* public routes */}
      <Route path='/login' element={<Login/>}/>
      <Route path='/register' element={<Register/>}/>
      <Route path='/forgot-password' element={<ForgotPassword/>}/>
      <Route path='/reset-password' element={<ResetPassword/>}/>

      {/* protected route */}
      <Route path='/home' element={
        <ProtectedRoute>
          <HomePage/>
        </ProtectedRoute>
      }/>

      <Route path="/detections" element={
          <ProtectedRoute>
            <DetectionsPage />
          </ProtectedRoute>
        }/>

      {/* default route */}
      <Route path="/" element={<Navigate to="/login" replace/>}/>

      {/* invalid route */}
      <Route path="*" element={<Navigate to="/login" replace/>}/>
      
    </Routes>
  );
}

export default App;
