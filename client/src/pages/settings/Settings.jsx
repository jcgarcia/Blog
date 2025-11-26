import "./settings.css"
import Sidebar from "../../components/sidebar/Sidebar"
export default function Settings() {
  return (
    <div className="settings">
       <div className="settingsWrapper">
        <div className="settingsTitle">
            <span className="settingsUpdateTitle">Update Account</span>
            <span className="settingsDeleteTitle">Delete Account</span>
        </div>
        <form  className="settingsForm">
            <label>Profile picture</label>
            <div className="settingsPP">
                <img 
                src="https://lh3.googleusercontent.com/a/ACg8ocKyzBlZ6G6WI8BZQpstO_hcA3hhfSuyesOerch4wMn0ISfAXY8v=s96-c" 
                alt="" 
                />
                <label htmlFor="fileImput">
                <i class="settingsPPIcon fa-solid fa-user-secret"></i>
                </label>
                <input type="file" id="fileInput" style={{display:"none"}}/>
            </div>
            <label>Userrname</label>
            <input type="text" placeholder="YoJulito" />
            <label>Email</label>
            <input type="text" placeholder="yojulito@ingasti.com" />
            <label>Password</label>
            <input type="password" />
            <button className="settingsSubmit">Update</button>
        </form>
            <Sidebar/>
       </div>
    </div>
  )
}
