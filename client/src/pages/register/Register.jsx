import { Link } from "react-router-dom";
import "./register.css";

export default function Register() {
  return (
    <div className="register">
        <span className="registerTitle">Req</span>
      <form  className="registerForm">
        <label>Username</label>
        <input type="text" className="registerInput" placeholder="Username " />
        <label>Email</label>
        <input type="text" className="registerInput" placeholder="Email " />
        <label>Password</label>
        <input type="email" className="registerInput" placeholder="Password  " />
        <button className="registerButton">Req</button>
      </form>
      <button className="registerLoginButton">
      <Link to="/login">Login</Link> 
      </button>

    </div>
  )
}

