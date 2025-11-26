#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

class PostScheduler {
  constructor() {
    this.scheduleFile = path.join(__dirname, 'schedule.json');
    this.loadSchedule();
  }

  loadSchedule() {
    try {
      if (fs.existsSync(this.scheduleFile)) {
        const data = fs.readFileSync(this.scheduleFile, 'utf8');
        this.schedule = JSON.parse(data);
      } else {
        this.schedule = {
          posts: [],
          settings: {
            timezone: 'UTC',
            defaultTime: '09:00',
            autoPublish: true
          }
        };
      }
    } catch (error) {
      console.error(`${colors.red}❌ Error loading schedule: ${error.message}${colors.reset}`);
      this.schedule = { posts: [], settings: {} };
    }
  }

  saveSchedule() {
    try {
      fs.writeFileSync(this.scheduleFile, JSON.stringify(this.schedule, null, 2));
      console.log(`${colors.green}✅ Schedule saved${colors.reset}`);
    } catch (error) {
      console.error(`${colors.red}❌ Error saving schedule: ${error.message}${colors.reset}`);
    }
  }

  addPost(filePath, publishDate, publishTime = '09:00') {
    const fullPath = path.resolve(filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.error(`${colors.red}❌ File not found: ${filePath}${colors.reset}`);
      return false;
    }

    const post = {
      id: Date.now().toString(),
      file: fullPath,
      publishDate,
      publishTime,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    };

    this.schedule.posts.push(post);
    this.saveSchedule();

    console.log(`${colors.green}✅ Post scheduled:${colors.reset}`);
    console.log(`   File: ${path.basename(filePath)}`);
    console.log(`   Publish: ${publishDate} ${publishTime}`);
    
    return true;
  }

  removePost(postId) {
    const initialLength = this.schedule.posts.length;
    this.schedule.posts = this.schedule.posts.filter(post => post.id !== postId);
    
    if (this.schedule.posts.length < initialLength) {
      this.saveSchedule();
      console.log(`${colors.green}✅ Post removed from schedule${colors.reset}`);
      return true;
    }
    
    console.error(`${colors.red}❌ Post not found: ${postId}${colors.reset}`);
    return false;
  }

  listSchedule() {
    console.log(`${colors.blue}📅 Scheduled Posts${colors.reset}`);
    console.log(`${colors.blue}==================${colors.reset}`);
    
    if (this.schedule.posts.length === 0) {
      console.log(`${colors.yellow}⚠️  No posts scheduled${colors.reset}`);
      return;
    }

    // Sort posts by publish date/time
    const sortedPosts = this.schedule.posts.sort((a, b) => {
      const dateA = new Date(`${a.publishDate} ${a.publishTime}`);
      const dateB = new Date(`${b.publishDate} ${b.publishTime}`);
      return dateA - dateB;
    });

    sortedPosts.forEach(post => {
      const statusColor = post.status === 'published' ? colors.green : 
                         post.status === 'scheduled' ? colors.yellow : colors.red;
      
      console.log(`${colors.cyan}ID: ${post.id}${colors.reset}`);
      console.log(`   File: ${path.basename(post.file)}`);
      console.log(`   Publish: ${post.publishDate} ${post.publishTime}`);
      console.log(`   Status: ${statusColor}${post.status}${colors.reset}`);
      console.log('');
    });
  }

  checkDue() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);

    const duePost = this.schedule.posts.find(post => 
      post.status === 'scheduled' && 
      post.publishDate === today && 
      post.publishTime <= currentTime
    );

    return duePost;
  }

  async publishDue() {
    const duePost = this.checkDue();
    
    if (!duePost) {
      console.log(`${colors.yellow}⏰ No posts due for publishing${colors.reset}`);
      return false;
    }

    console.log(`${colors.blue}🚀 Publishing due post: ${path.basename(duePost.file)}${colors.reset}`);
    
    try {
      // Execute the blog-publish command
      const publishScript = path.join(__dirname, 'blog-publish');
      execSync(`${publishScript} "${duePost.file}"`, { 
        stdio: 'inherit',
        cwd: __dirname 
      });

      // Mark as published
      duePost.status = 'published';
      duePost.publishedAt = new Date().toISOString();
      this.saveSchedule();

      console.log(`${colors.green}✅ Post published successfully!${colors.reset}`);
      return true;
    } catch (error) {
      console.error(`${colors.red}❌ Error publishing post: ${error.message}${colors.reset}`);
      duePost.status = 'error';
      duePost.error = error.message;
      this.saveSchedule();
      return false;
    }
  }

  daemon() {
    console.log(`${colors.blue}🤖 Starting publish daemon...${colors.reset}`);
    console.log(`${colors.blue}Press Ctrl+C to stop${colors.reset}`);
    
    const checkInterval = 60000; // Check every minute
    
    setInterval(async () => {
      const now = new Date();
      console.log(`${colors.cyan}⏰ Checking for due posts... ${now.toLocaleTimeString()}${colors.reset}`);
      
      await this.publishDue();
    }, checkInterval);
  }

  showHelp() {
    console.log(`${colors.blue}📅 Post Scheduler${colors.reset}`);
    console.log(`${colors.blue}=================${colors.reset}`);
    console.log('');
    console.log('Usage: node post-scheduler.js [command] [options]');
    console.log('');
    console.log('Commands:');
    console.log('  add <file> <date> [time]  - Schedule a post');
    console.log('  remove <id>               - Remove scheduled post');
    console.log('  list                      - List scheduled posts');
    console.log('  check                     - Check for due posts');
    console.log('  publish                   - Publish due posts now');
    console.log('  daemon                    - Start auto-publish daemon');
    console.log('  help                      - Show this help');
    console.log('');
    console.log('Examples:');
    console.log('  node post-scheduler.js add ./my-post.md 2025-07-10');
    console.log('  node post-scheduler.js add ./my-post.md 2025-07-10 14:30');
    console.log('  node post-scheduler.js remove 1625123456789');
    console.log('');
  }
}

// Main execution
const scheduler = new PostScheduler();
const command = process.argv[2];

switch (command) {
  case 'add':
    if (process.argv.length < 5) {
      console.error(`${colors.red}❌ Usage: add <file> <date> [time]${colors.reset}`);
      process.exit(1);
    }
    scheduler.addPost(process.argv[3], process.argv[4], process.argv[5]);
    break;

  case 'remove':
    if (process.argv.length < 4) {
      console.error(`${colors.red}❌ Usage: remove <id>${colors.reset}`);
      process.exit(1);
    }
    scheduler.removePost(process.argv[3]);
    break;

  case 'list':
    scheduler.listSchedule();
    break;

  case 'check':
    const duePost = scheduler.checkDue();
    if (duePost) {
      console.log(`${colors.green}✅ Post due: ${path.basename(duePost.file)}${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⏰ No posts due${colors.reset}`);
    }
    break;

  case 'publish':
    scheduler.publishDue();
    break;

  case 'daemon':
    scheduler.daemon();
    break;

  case 'help':
  default:
    scheduler.showHelp();
    break;
}
