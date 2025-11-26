import Header from '../../components/header/Header'
import Posts from '../../components/posts/Posts'
import Sidebar from '../../components/sidebar/Sidebar'
import MetaTags from '../../components/MetaTags/MetaTags'

import  './home.css'

export default function Home() {
  return (
    <>
    <MetaTags 
      title="Bedtime Blog - Insightful Articles & Stories"
      description="Discover insightful articles on technology, business, and innovation. Join our community for engaging content and meaningful discussions."
    />
    <Header/>
    <div className='home'>
      <Posts />
     
      <Sidebar />
    </div>
    </>
  )
}
