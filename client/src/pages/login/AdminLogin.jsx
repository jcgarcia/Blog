import { Link } from "react-router-dom";
import "./adminlogin.css";

export default function AdminLogin() {
  return (
    <div className="login">
        <span className="loginTitle">Admin Login</span>
      <form  className="loginForm">
        <label>Email</label>
        <input type="text" className="loginInput" placeholder="Username " />
        <label>Password</label>
        <input type="password" className="loginInput" placeholder="Password  " />
        <button className="loginButton">Login</button>
      </form>
    </div>
  );
}