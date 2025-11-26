import './about.css';

export default function About() {
  return (
    <div className="about">
      <div className="aboutWrapper">
        <div className="aboutHeader">
          <h1 className="aboutTitle">How It All Started: From Fire to Blog</h1>
          <p className="aboutSubtitle">The unexpected night that sparked the idea for this blog</p>
        </div>

        <div className="aboutContent">
          <div className="aboutSection">
            <p className="aboutIntro">
              Sometimes the most unexpected moments shape our future in ways we never imagine. 
              This is the story of how a frightening night turned into the inspiration for this very blog you're reading.
            </p>
          </div>

          <div className="aboutSection">
            <h2>The Night Everything Changed</h2>
            <div className="aboutImageGrid">
              <img src="/images/about/IMG-20250804-WA0001.jpg" alt="Emergency services on the night of the fire" className="aboutImage" />
              <img src="/images/about/IMG-20250804-WA0002.jpg" alt="Fire engines and police cars" className="aboutImage" />
            </div>
            <p>
              It was March 1st, 2024 - a date I'll never forget. I was exhausted and had already fallen into a deep sleep 
              when something stirred me awake. Not smoke, not alarms - just noise. Lots of noise outside my window.
            </p>
            <p>
              I groggily looked out to see a flurry of activity below: police cars, fire engines, people moving about with purpose. 
              Clearly something was happening, but living in London, emergency services rushing around wasn't exactly unusual. 
              I was so tired that after a quick glance, I decided whatever it was could wait until morning. Back to bed I went.
            </p>
            <p>
              That decision didn't last long.
            </p>
          </div>

          <div className="aboutSection">
            <div className="aboutImageContainer">
              <img src="/images/about/IMG-20250804-WA0004.jpg" alt="Building evacuation scene" className="aboutImageFull" />
            </div>
            <p>
              It wasn't until the police began systematically evacuating the adjacent buildings that my peaceful sleep was truly interrupted. 
              The sound of heavy banging on doors echoed through the building, getting closer and closer until finally - 
              BANG, BANG, BANG - they reached mine.
            </p>
            <p>
              That's when I learned that a massive fire had broken out in a building on Emperor's Gate street, right next door to where I lived. 
              Even though our building wasn't directly affected by the flames, the local council wasn't taking any chances. 
              The evacuation order was immediate and non-negotiable.
            </p>
          </div>

          <div className="aboutSection">
            <h2>A Long Night at the Millennium</h2>
            <div className="aboutImageGrid">
              <img src="/images/about/IMG-20250804-WA0005.jpg" alt="Night evacuation" className="aboutImage" />
              <img src="/images/about/IMG-20250804-WA0006.jpg" alt="Emergency response" className="aboutImage" />
            </div>
            <p>
              The evacuation wasn't a quick affair. It was a long, anxious night as authorities worked to contain the fire and assess the situation. 
              Initially, displaced residents were directed to nearby hotels, but space was limited and the process was slow. 
              It wasn't until dawn was breaking that they began assigning rooms to the most vulnerable people first.
            </p>
            <p>
              That's how I found myself in an unexpected place: a room at the Millennium Hotel. After hours of uncertainty, stress, 
              and the acrid smell of smoke still lingering in my clothes, stepping into that clean, quiet hotel room felt like entering a different world.
            </p>
          </div>

          <div className="aboutSection">
            <h2>The Moment of Clarity</h2>
            <div className="aboutImageContainer">
              <img src="/images/about/IMG-20250804-WA0007.jpg" alt="Morning light in the hotel room" className="aboutImageFull" />
            </div>
            <p>
              After a long, hot shower that seemed to wash away not just the smell of smoke but the tension of the entire night, 
              I sat on the edge of the hotel bed looking out at the city awakening. The morning light streaming through the window, 
              the crisp white sheets, the sense of unexpected peace after chaos - it all came together in that moment.
            </p>
            <p>
              I grabbed my phone and took a picture. Something about that scene, that feeling of finding calm after the storm, 
              resonated deeply with me. Later, that very image would become part of this blog, and I even created a welcome video 
              using a photo taken in that same room - a reminder of where this journey truly began.
            </p>
          </div>

          <div className="aboutSection">
            <h2>The Seed of an Idea</h2>
            <div className="aboutImageGrid">
              <img src="/images/about/IMG-20250804-WA0008.jpg" alt="Peaceful hotel room" className="aboutImage" />
              <img src="/images/about/IMG-20250804-WA0009.jpg" alt="View from the hotel" className="aboutImage" />
            </div>
            <p>
              Months passed. Life returned to normal, our building was deemed safe, and the immediate drama of that night faded into memory. 
              But something lingered. I had been thinking about rebranding my old blog for a while, searching for a fresh direction, a new voice.
            </p>
            <p>
              Then it hit me - that quiet moment in the hotel room, the peaceful end to a chaotic night, the way we often process our thoughts 
              and experiences at the day's end. Most people check blogs, social media, and catch up on content when they're winding down, 
              often already in bed, reflecting on their day.
            </p>
            <p className="aboutHighlight">
              <strong>Bedtime Blog.</strong>
            </p>
            <p>
              The name felt perfect. Not just because people often read content before sleep, but because there's something intimate and honest 
              about those quiet moments at the end of the day. That's when we're most ourselves, most reflective, most open to new ideas and perspectives.
            </p>
          </div>

          <div className="aboutSection">
            <h2>Building Something New</h2>
            <div className="aboutImageContainer">
              <img src="/images/about/IMG-20250804-WA0011.jpg" alt="The journey continues" className="aboutImageFull" />
            </div>
            <p>
              It took time to make everything work. Building a blog from scratch, developing the right tone, creating content that felt authentic - 
              none of it happened overnight. There were technical challenges, creative blocks, and moments of doubt.
            </p>
            <p>
              But here we are, sharing something with the world that was born from an unexpected night of displacement and uncertainty. 
              What started as a crisis became a moment of clarity, which became an idea, which became this space where we can connect and 
              share our thoughts as the day winds down.
            </p>
            <p>
              Sometimes our best ideas come not from comfort and planning, but from those moments when life takes an unexpected turn and 
              shows us something new about ourselves.
            </p>
            <p className="aboutConclusion">
              Welcome to the Bedtime Blog - born from fire, nurtured by reflection, and shared with you.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
