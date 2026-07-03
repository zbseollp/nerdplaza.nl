import fs from 'fs';

const xmlPath = process.argv[2] || 'C:/Users/Nilesh rana/Downloads/nerdplazanl.WordPress.2026-06-30.xml';
const xml = fs.readFileSync(xmlPath, 'utf8');

function getCdata(block, tag) {
  const re = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

function getMeta(block, key) {
  const re = new RegExp(
    `<wp:postmeta>[\\s\\S]*?<wp:meta_key><!\\[CDATA\\[${key}\\]\\]></wp:meta_key>[\\s\\S]*?<wp:meta_value><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></wp:meta_value>[\\s\\S]*?</wp:postmeta>`,
    'i',
  );
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

function getCategories(block) {
  const cats = [];
  const re = /<category domain="category" nicename="([^"]*)"><!\[CDATA\[([\s\S]*?)\]\]><\/category>/gi;
  let m;
  while ((m = re.exec(block))) {
    cats.push({ nicename: m[1], name: m[2].trim() });
  }
  return cats;
}

function getTags(block) {
  const tags = [];
  const re = /<category domain="post_tag" nicename="([^"]*)"><!\[CDATA\[([\s\S]*?)\]\]><\/category>/gi;
  let m;
  while ((m = re.exec(block))) {
    tags.push({ nicename: m[1], name: m[2].trim() });
  }
  return tags;
}

const items = xml.split(/\s*<item>/).slice(1);
const posts = [];
const pages = [];
const attachments = new Map();
const authors = new Map();

// Parse authors from channel
const authorRe = /<wp:author>[\s\S]*?<wp:author_login><!\[CDATA\[([\s\S]*?)\]\]><\/wp:author_login>[\s\S]*?<wp:author_display_name><!\[CDATA\[([\s\S]*?)\]\]><\/wp:author_display_name>/gi;
let am;
while ((am = authorRe.exec(xml))) {
  authors.set(am[1], am[2]);
}

for (const item of items) {
  const postType = getCdata(item, 'wp:post_type');
  const status = getCdata(item, 'wp:status');
  const postId = getCdata(item, 'wp:post_id');

  if (postType === 'attachment') {
    const url = getCdata(item, 'wp:attachment_url');
    if (url) attachments.set(postId, { url, title: getCdata(item, 'title'), alt: getMeta(item, '_wp_attachment_image_alt') });
    continue;
  }

  if (status !== 'publish') continue;

  const entry = {
    id: postId,
    title: getCdata(item, 'title'),
    slug: getCdata(item, 'wp:post_name'),
    link: getCdata(item, 'link'),
    content: getCdata(item, 'content:encoded'),
    excerpt: getCdata(item, 'excerpt:encoded'),
    pubDate: getCdata(item, 'wp:post_date'),
    modified: getCdata(item, 'wp:post_modified'),
    author: getCdata(item, 'dc:creator'),
    authorName: authors.get(getCdata(item, 'dc:creator')) || getCdata(item, 'dc:creator'),
    categories: getCategories(item),
    tags: getTags(item),
    featuredMediaId: getMeta(item, '_thumbnail_id'),
  };

  if (postType === 'post') posts.push(entry);
  if (postType === 'page') pages.push(entry);
}

console.log(JSON.stringify({
  posts: posts.length,
  pages: pages.length,
  attachments: attachments.size,
  authors: Object.fromEntries(authors),
  pageSlugs: pages.map((p) => p.slug),
  postSlugs: posts.map((p) => p.slug),
}, null, 2));
