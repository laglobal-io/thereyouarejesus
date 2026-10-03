// Fallback content used until the WordPress plugin's Site Settings are filled in.
// Once saved in WordPress, those values replace these on the next build.

export interface Spirit { name: string; verse: string; ref: string; meaning: string }
export interface Station { name: string; genre: string; description: string; site: string; stream: string }
export interface SiteSettings {
  heroTitle: string; heroText: string; logo: string;
  notice: { title: string; text: string; date: string; link: string };
  spirits: Spirit[]; stations: Station[];
}

export const defaults: SiteSettings = {
  heroTitle: 'In a momentary death, I was shown the Seven Spirits of God and asked to tell you about them.',
  heroText: "I'm John Levay. Between my death and resuscitation I saw seven massive columns of fire before God's Throne. This site shares what I was shown, and the modern day evidence of God speaking to all of us.",
  logo: '',
  notice: {
    title: '13 years since the vision that stopped a prayer',
    text: 'The timeline of discovery now covers every major interaction, from 2013 to today.',
    date: 'Updated September 29, 2026',
    link: '/timeline-of-discovery-on-thereyouarejesus/',
  },
  // Scripture: King James Version (public domain). Meanings are drafts for John to rewrite.
  spirits: [
    { name: 'Knowledge', verse: 'For I desired mercy, and not sacrifice; and the knowledge of God more than burnt offerings.', ref: 'Hosea 6:6, with Isaiah 11:2', meaning: 'Knowing God personally, not only knowing about Him.' },
    { name: 'Understanding', verse: 'But there is a spirit in man: and the inspiration of the Almighty giveth them understanding.', ref: 'Job 32:8, with Isaiah 11:2', meaning: 'Seeing how what God shows us fits together, and why it matters.' },
    { name: 'Wisdom', verse: 'If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.', ref: 'James 1:5, with Isaiah 11:2', meaning: 'Knowing what to do with what we know. It is asked for, and freely given.' },
    { name: 'Our Lord Jesus Christ', verse: 'A Lamb as it had been slain, having seven horns and seven eyes, which are the seven Spirits of God sent forth into all the earth.', ref: 'Revelation 5:6, with Isaiah 11:2', meaning: "The center flame. John was shown the Throne, the Lamb of God and the Seven Spirits together, and later met Jesus face to face at Heaven's entrance." },
    { name: 'Counsel', verse: 'I will instruct thee and teach thee in the way which thou shalt go: I will guide thee with mine eye.', ref: 'Psalm 32:8, with Isaiah 11:2', meaning: 'Guidance for the road in front of us, one decision at a time.' },
    { name: 'Might', verse: 'But ye shall receive power, after that the Holy Ghost is come upon you.', ref: 'Acts 1:8, with Isaiah 11:2', meaning: 'Strength to act on what God has shown us.' },
    { name: 'Reverent Fear of our Lord', verse: 'The fear of the LORD is the beginning of wisdom: and the knowledge of the holy is understanding.', ref: 'Proverbs 9:10, with Isaiah 11:2–3', meaning: 'Reverent awe of God, the place where wisdom begins.' },
  ],
  // Add each station's official stream URL (with permission) in WordPress. Without one, the card links to the station's site.
  stations: [
    { name: 'Air1', genre: 'Worship', description: "Today's top worship songs, around the clock.", site: 'https://www.air1.com/', stream: '' },
    { name: 'Moody Radio Praise & Worship', genre: 'Worship', description: "Moody Radio's internet station for praise and worship music.", site: 'https://www.moodyradio.org/', stream: '' },
    { name: 'K-LOVE', genre: 'Contemporary', description: 'Positive, encouraging contemporary Christian music.', site: 'https://www.klove.com/', stream: '' },
    { name: 'Moody Radio Urban Praise', genre: 'Gospel', description: 'Urban gospel and praise from Moody Radio.', site: 'https://www.moodyradio.org/', stream: '' },
    { name: 'Moody Radio Hymns', genre: 'Hymns', description: 'Timeless hymns of the faith.', site: 'https://www.moodyradio.org/', stream: '' },
    { name: 'Moody Radio Network', genre: 'Talk & teaching', description: 'Bible teaching, call-in talk and Christian perspective on the news.', site: 'https://www.moodyradio.org/', stream: '' },
    { name: 'American Family Radio Talk', genre: 'Talk & teaching', description: 'Christian talk on faith, family and current events.', site: 'https://afr.net/', stream: '' },
    { name: 'Relevant Radio', genre: 'Talk & teaching', description: 'Catholic talk radio, prayer and conversation.', site: 'https://relevantradio.com/', stream: '' },
  ],
};

export const topics = [
  { key: 'question', name: 'Ask John a question', sub: 'About the Seven Spirits, his account or a post', heading: 'Ask John a question', label: 'Your question', help: '' },
  { key: 'story', name: 'Share your own experience', sub: 'An afterlife memory or a coincidence too meaningful to ignore', heading: 'Share your experience', label: 'Tell us what happened', help: 'Include what you noticed and what made it feel meaningful.' },
  { key: 'guest', name: 'Be a podcast guest', sub: 'Tell your story on the show with John', heading: 'Be a guest on the podcast', label: 'What would you like to talk about?', help: "A few sentences is plenty. We'll follow up by email." },
  { key: 'prayer', name: 'Request prayer', sub: 'Kept private, never published', heading: 'Request prayer', label: 'How can we pray for you?', help: '' },
  { key: 'feedback', name: 'Respond to a post', sub: 'Your thoughts on something John wrote', heading: 'Respond to a post', label: 'Your thoughts', help: '' },
];

export const products = [
  { kind: 'Art print', name: 'The Seven Spirits Before the Throne', price: 'From $35', art: 'print' },
  { kind: 'Apparel', name: 'Seven Flames Tee', price: '$32', art: 'tee' },
  { kind: 'Digital download', name: 'The Biblical Trail of Sevens Study Guide', price: '$12', art: 'guide' },
];

export const socials = [
  { name: 'Facebook', url: 'https://www.facebook.com/thereyouarejesus' },
  { name: 'Instagram', url: 'https://www.instagram.com/thereyouarejesus' },
  { name: 'YouTube', url: 'https://www.youtube.com/@thereyouarejesus' },
  { name: 'TikTok', url: 'https://www.tiktok.com/@thereyouarejesus' },
  { name: 'X', url: 'https://x.com/thereuarejesus' },
  { name: 'Reddit', url: 'https://www.reddit.com/user/ThereYouAreJesus/' },
];

export const env = {
  kitAction: import.meta.env.PUBLIC_KIT_FORM_ACTION || '',
  passion: import.meta.env.PUBLIC_PASSION_URL || '',
  devout: import.meta.env.PUBLIC_DEVOUT_URL || '',
  store: import.meta.env.PUBLIC_STORE_URL || '',
  donate: import.meta.env.PUBLIC_DONATE_URL || 'https://donate.stripe.com/cN2047eE6a5IaPe9AA',
};
