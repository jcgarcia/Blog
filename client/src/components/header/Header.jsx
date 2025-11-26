import  './header.css'
import backgoudImage from '../../media/BedTime.jpg'

export default function Header() {
  return (
    <div className='header'>
      <div className="headerOverlay"></div>
      <div className="headerTitle">
        <span className='headerTitleSm'>Guilt & Pleasure</span>
        <span className='headerTitleLg'>Bedtime</span>
      </div>
      <img className="headerImg" 
      src={backgoudImage}
      alt="Bed time" />
    </div>
  )
}
