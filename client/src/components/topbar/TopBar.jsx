import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import Search from "../search/Search";
import UserDropdown from "../UserDropdown/UserDropdown";
import { useSocialLinks } from "../../hooks/useSocialLinks";
import { useUser } from "../../contexts/UserContext";
import { useAdmin } from "../../contexts/AdminContext";
import "./topbar.css"

export default function TopBar() {
  const { user } = useUser();
  const { isAdmin, adminUser } = useAdmin();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loginMenuOpen, setLoginMenuOpen] = useState(false);
  const { socialLinks, loading } = useSocialLinks();

  // Use admin user info if logged in as admin, otherwise use regular user
  const currentUser = isAdmin && adminUser ? {
    ...adminUser,
    name: `${adminUser.firstName} ${adminUser.lastName}`,
    avatar: adminUser.avatar || null
  } : user;

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const toggleSearch = () => {
    setSearchOpen(!searchOpen);
  };

  const closeSearch = () => {
    setSearchOpen(false);
  };

  const toggleLoginMenu = () => {
    setLoginMenuOpen(!loginMenuOpen);
  };

  // Check if we're on mobile and handle responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setMenuOpen(false);
      }
    };

    const handleClickOutside = (event) => {
      if (!event.target.closest('.top')) {
        setMenuOpen(false);
        setLoginMenuOpen(false);
      }
    };

    // Initial check
    checkMobile();

    window.addEventListener('resize', checkMobile);
    document.addEventListener('click', handleClickOutside);

    return () => {
      window.removeEventListener('resize', checkMobile);
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Menu items component
  const MenuItems = () => (
    <ul className={`topList ${menuOpen ? "open" : ""}`}>
      <li className="topListItem"><Link className="link" to="/" onClick={() => setMenuOpen(false)} > Home </Link></li>
      <li className="topListItem"><Link className="link" to="/about" onClick={() => setMenuOpen(false)} > About </Link></li>
      <li className="topListItem"><Link className="link" to="/contact" onClick={() => setMenuOpen(false)} > Contact </Link></li>
      <li className="topListItem"><Link className="link" to="/ops" onClick={() => setMenuOpen(false)} > Ops </Link></li>
    </ul>
  );

  return (
    <div className='top'>
      <div className="topLeft">
        {!loading && socialLinks.linkedin && (
          <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer">
            <i className="topIcon fa-brands fa-linkedin"></i>
          </a>
        )}
        {!loading && socialLinks.twitter && (
          <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer">
            <i className="topIcon fa-brands fa-square-x-twitter"></i>
          </a>
        )}
        {!loading && socialLinks.instagram && (
          <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer">
            <i className="topIcon fa-brands fa-square-instagram"></i>
          </a>
        )}
        {!loading && socialLinks.threads && (
          <a href={socialLinks.threads} target="_blank" rel="noopener noreferrer">
            <i className="topIcon fa-brands fa-square-threads"></i>
          </a>
        )}
      </div>
      
      {/* Desktop menu - only render on desktop */}
      {!isMobile && (
        <div className="topCenter">
          <MenuItems />
        </div>
      )}

      <div className="topRight">
        {
          currentUser ? (
            <UserDropdown user={currentUser} />
          ) : (
            <div className="loginMenu">
              <div className="loginIcon" onClick={toggleLoginMenu}>
                <i className="fa-solid fa-right-to-bracket"></i>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
              {loginMenuOpen && (
                <div className="loginDropdown">
                  <Link className="loginOption" to="/login" onClick={() => setLoginMenuOpen(false)}>
                    <i className="fa-solid fa-comments"></i>
                    <div>
                      <strong>Reader Login</strong>
                      <span>AWS Cognito secure authentication</span>
                    </div>
                  </Link>
                  <Link className="loginOption" to="/userlogin" onClick={() => setLoginMenuOpen(false)}>
                    <i className="fa-solid fa-pen"></i>
                    <div>
                      <strong>Writer Login</strong>
                      <span>Create & edit posts</span>
                    </div>
                  </Link>
                  <Link className="loginOption admin" to="/adminlogin" onClick={() => setLoginMenuOpen(false)}>
                    <i className="fa-solid fa-shield"></i>
                    <div>
                      <strong>Admin Login</strong>
                      <span>Full system access</span>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          )
        }

        <i className="topSearchIcon fa-brands fa-searchengin" onClick={toggleSearch}></i>
        {/* Only show hamburger on mobile */}
        {isMobile && <i className="hamburgerIcon fa-solid fa-bars" onClick={toggleMenu}></i>}
      </div>

      {/* Mobile menu - only render when mobile and menu is open */}
      {isMobile && menuOpen && (
        <div className="mobileMenu">
          <MenuItems />
        </div>
      )}

      {/* Search Modal */}
      <Search isOpen={searchOpen} onClose={closeSearch} />
    </div>
  )
}
