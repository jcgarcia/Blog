import './post.css'
import PostBox from '../../media/NewPost.jpg'
import { Link } from 'react-router-dom'
import LikeButton from '../Social/LikeButton'
import ShareButton from '../Social/ShareButton'

export default function Post({ post }) {
  // Format date to be more readable
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  // Extract description from content (first 150 characters)
  const getDescription = (content) => {
    if (!content) return 'No description available';
    const plainText = content.replace(/<[^>]*>/g, '').replace(/#+\s*/g, ''); // Remove HTML tags and markdown headers
    return plainText.length > 150 ? plainText.substring(0, 150) + '...' : plainText;
  };

  // Extract tags from categories or meta data
  const getTags = () => {
    const tags = [];
    if (post?.status) tags.push(post.status);
    if (post?.visibility) tags.push(post.visibility);
    if (post?.category_name) tags.push(post.category_name);
    return tags;
  };

  // Format author name to prioritize real name over username
  const formatAuthorName = (post) => {
    if (post?.first_name && post?.last_name) {
      return `${post.first_name} ${post.last_name}`;
    } else if (post?.first_name) {
      return post.first_name;
    } else if (post?.username) {
      return post.username;
    } else {
      return 'Unknown Author';
    }
  };

  return (
    <div className='post'>
        <img 
        className='postImg'
        src={post?.featured_image || PostBox}
        alt={post?.title || "Blog post"} 
        />
        <div className='postInfo'>
            <div className='postCats'>
                {getTags().map((tag, index) => (
                  <span key={index} className='postCat'>{tag}</span>
                ))}
            </div>
            <Link to={`/post/${post?.id}`} className="link">
              <span className="postTitle">
                  {post?.title || 'Untitled Post'}
              </span>
            </Link>
            <hr />
            <div className="postMeta">
              <span className="postDate">
                {post?.published_at ? formatDate(post.published_at) : 
                 post?.created_at ? formatDate(post.created_at) : 'Unknown date'}
              </span>
              <span className="postAuthor">
                by {formatAuthorName(post)}
              </span>
            </div>
        </div>

        <p className='postDescription'>
          {getDescription(post?.content || post?.excerpt)}
        </p>

        {/* Social Actions */}
        <div className="postSocialActions">
          <LikeButton 
            postId={post?.id} 
            initialLikes={post?.like_count || 0}
          />
          <ShareButton 
            postId={post?.id}
            postTitle={post?.title}
            postDescription={post?.excerpt || getDescription(post?.content)}
            postUrl={`${window.location.origin}/post/${post?.id}`}
            initialShareCount={post?.share_count || 0}
          />
        </div>
   
    </div>
  )
}
