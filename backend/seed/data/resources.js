/**
 * Resources are generated from the curriculum so every topic has something to
 * open. Video links use a YouTube search for the topic rather than a hard coded
 * video id, so the links stay valid and point at real teaching channels instead
 * of invented URLs. Admins can replace any of them from Manage resources.
 */
const javaTopics = require('./javaTopics');
const pythonTopics = require('./pythonTopics');

const COURSE_META = {
  java: {
    docs: { title: 'The Java Tutorials (Oracle)', url: 'https://docs.oracle.com/javase/tutorial/' },
    reference: { title: 'W3Schools Java reference', url: 'https://www.w3schools.com/java/' },
    practice: { title: 'HackerRank Java practice', url: 'https://www.hackerrank.com/domains/java' },
    channel: { title: 'freeCodeCamp full Java courses', url: 'https://www.youtube.com/@freecodecamp/search?query=java' }
  },
  python: {
    docs: { title: 'The Python Tutorial (python.org)', url: 'https://docs.python.org/3/tutorial/' },
    reference: { title: 'W3Schools Python reference', url: 'https://www.w3schools.com/python/' },
    practice: { title: 'HackerRank Python practice', url: 'https://www.hackerrank.com/domains/python' },
    channel: { title: 'freeCodeCamp full Python courses', url: 'https://www.youtube.com/@freecodecamp/search?query=python' }
  }
};

const searchUrl = (course, topicName) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${course} ${topicName} tutorial for beginners`)}`;

function build(topics, course) {
  const meta = COURSE_META[course];
  const out = [];
  for (const topic of topics) {
    out.push({
      course,
      topic: topic.slug,
      title: `${topic.name} explained on video`,
      description: `Curated video walkthroughs of ${topic.name.toLowerCase()} in ${course === 'java' ? 'Java' : 'Python'}. Learn this topic visually.`,
      type: 'video',
      url: searchUrl(course, topic.name)
    });
    out.push({
      course,
      topic: topic.slug,
      title: meta.docs.title,
      description: `Official documentation covering ${topic.name.toLowerCase()} and the rest of the language.`,
      type: 'docs',
      url: meta.docs.url
    });
    out.push({
      course,
      topic: topic.slug,
      title: `${meta.reference.title}: quick syntax refresher`,
      description: 'Short examples you can skim before a quiz.',
      type: 'article',
      url: meta.reference.url
    });
    if (topic.section.includes('Problem Solving')) {
      out.push({
        course,
        topic: topic.slug,
        title: meta.practice.title,
        description: 'Practice problems to apply what you have learned.',
        type: 'practice',
        url: meta.practice.url
      });
    }
  }
  return out;
}

module.exports = [...build(javaTopics, 'java'), ...build(pythonTopics, 'python')];
