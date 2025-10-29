import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import Single from "./pages/single/Single";
import TopBar from "./components/topbar/TopBar";
import Footer from "./components/footer/Footer";
import ScrollToTop from "./components/ScrollToTop/ScrollToTop";
import Write from "./pages/write/Write";
import EditPage from "./pages/editPage/EditPage";
import Ops from "./pages/ops/Ops";
import DraftManagement from "./pages/ops/DraftManagement";
import Settings from "./pages/settings/Settings";
import Login from "./pages/login/Login";
import UserLogin from "./pages/userLogin/UserLogin";
import Register from "./pages/register/Register";
import Home from "./pages/home/Home";
import About from "./pages/about/About";
import Contact from "./pages/contact/Contact";
import DynamicPage from "./components/DynamicPage/DynamicPage";
import CognitoCallback from "./pages/auth/CognitoCallback";
// import Privacy from "./pages/privacy/Privacy";
import Terms from "./pages/terms/Terms";
import AdminLogin from "./pages/adminlogin/AdminLogin";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";
import ShareRedirect from "./components/ShareRedirect/ShareRedirect";
import { AdminProvider } from "./contexts/AdminContext";
import { UserProvider } from "./contexts/UserContext";
import { DatabaseConnectionProvider } from "./contexts/DatabaseConnectionContext";
import { HelmetProvider } from 'react-helmet-async';

function App() {
  const [showCookiesBanner, setShowCookiesBanner] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookiesConsent');
    if (!consent) {
      setShowCookiesBanner(true);
    }
  }, []);

  const handleAcceptCookies = () => {
    localStorage.setItem('cookiesConsent', 'accepted');
    setShowCookiesBanner(false);
  };

  return (
    <div className="App">
      {showCookiesBanner && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#222',
          color: '#fff',
          padding: '16px',
          zIndex: 9999,
          textAlign: 'center',
          boxShadow: '0 -2px 8px rgba(0,0,0,0.15)'
        }}>
          <span>
            This website uses cookies to ensure you get the best experience. By continuing to browse, you accept our <a href="/privacy" style={{color:'#ffd700', textDecoration:'underline'}}>Privacy Policy</a>.
          </span>
          <button
            onClick={handleAcceptCookies}
            style={{marginLeft: '16px', padding: '8px 20px', background: '#ffd700', color: '#222', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'}}
          >
            Accept
          </button>
        </div>
      )}
      <HelmetProvider>
        <UserProvider>
          <AdminProvider>
            <Router>
            <ScrollToTop />
            <TopBar />
            <Routes>
              <Route exact path="/" element={<Home />} />
              <Route path="/category/:categoryName" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/privacy" element={<DynamicPage />} />
              <Route path="/terms" element={<DynamicPage />} />
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<Login />} />
              <Route path="/userlogin" element={<UserLogin />} />
              <Route path="/auth/callback" element={<CognitoCallback />} />
              <Route path="/write" element={<Write />} />
              <Route path="/edit-page" element={
                <ProtectedRoute requireAdmin={true}>
                  <EditPage />
                </ProtectedRoute>
              } />
              <Route path="/ops" element={
                <ProtectedRoute requireAdmin={true}>
                  <DatabaseConnectionProvider>
                    <Ops />
                  </DatabaseConnectionProvider>
                </ProtectedRoute>
              } />
              <Route path="/ops/drafts" element={
                <ProtectedRoute requireAdmin={true}>
                  <DatabaseConnectionProvider>
                    <DraftManagement />
                  </DatabaseConnectionProvider>
                </ProtectedRoute>
              } />
              <Route path="/settings" element={<Settings />} />
              <Route path="/post/:postId" element={<Single />} />
              <Route path="/share/post/:postId" element={<ShareRedirect />} />
              <Route path="/adminlogin" element={<AdminLogin />} />
              {/* Static pages route - should be last to avoid conflicts */}
              <Route path="/page/:slug" element={<DynamicPage />} />
            </Routes>
            <Footer />
          </Router>
        </AdminProvider>
      </UserProvider>
      </HelmetProvider>
    </div>
  );
}

export default App;
