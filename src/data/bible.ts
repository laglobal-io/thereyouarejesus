// Book list, verse of the day, and study paths for the Bible page.

export const BOOKS: [string, number][] = [
  ['Genesis', 50], ['Exodus', 40], ['Leviticus', 27], ['Numbers', 36], ['Deuteronomy', 34], ['Joshua', 24], ['Judges', 21], ['Ruth', 4],
  ['1 Samuel', 31], ['2 Samuel', 24], ['1 Kings', 22], ['2 Kings', 25], ['1 Chronicles', 29], ['2 Chronicles', 36], ['Ezra', 10], ['Nehemiah', 13],
  ['Esther', 10], ['Job', 42], ['Psalms', 150], ['Proverbs', 31], ['Ecclesiastes', 12], ['Song of Solomon', 8], ['Isaiah', 66], ['Jeremiah', 52],
  ['Lamentations', 5], ['Ezekiel', 48], ['Daniel', 12], ['Hosea', 14], ['Joel', 3], ['Amos', 9], ['Obadiah', 1], ['Jonah', 4], ['Micah', 7],
  ['Nahum', 3], ['Habakkuk', 3], ['Zephaniah', 3], ['Haggai', 2], ['Zechariah', 14], ['Malachi', 4],
  ['Matthew', 28], ['Mark', 16], ['Luke', 24], ['John', 21], ['Acts', 28], ['Romans', 16], ['1 Corinthians', 16], ['2 Corinthians', 13],
  ['Galatians', 6], ['Ephesians', 6], ['Philippians', 4], ['Colossians', 4], ['1 Thessalonians', 5], ['2 Thessalonians', 3], ['1 Timothy', 6],
  ['2 Timothy', 4], ['Titus', 3], ['Philemon', 1], ['Hebrews', 13], ['James', 5], ['1 Peter', 5], ['2 Peter', 3], ['1 John', 5], ['2 John', 1],
  ['3 John', 1], ['Jude', 1], ['Revelation', 22],
];

export const TRANSLATIONS = [
  { id: 'kjv', name: 'King James Version', short: 'KJV' },
  { id: 'bbe', name: 'Bible in Basic English', short: 'Basic English' },
];

// Rotates daily. References only; the text comes from the Bible itself.
export const DAILY = [
  'Isaiah 11:2', 'Revelation 4:5', 'John 3:16', 'Psalm 23:1', 'Proverbs 3:5', 'James 1:5', 'Philippians 4:13', 'Romans 8:28',
  'Jeremiah 29:11', 'Joshua 1:9', 'Matthew 11:28', 'Psalm 46:10', 'Isaiah 40:31', 'Revelation 5:6', 'Hebrews 11:1', 'Psalm 32:8',
  '1 Corinthians 13:4', 'Romans 12:2', 'Galatians 5:22', 'Proverbs 9:10', 'Micah 6:8', 'Lamentations 3:22', 'John 14:6', 'Revelation 1:4',
  'Zechariah 4:6', 'Psalm 119:105', 'Matthew 6:33', '2 Timothy 1:7', 'Ephesians 2:8', 'Job 32:8', 'Acts 1:8',
];

export const PATHS = [
  {
    title: 'The Seven Spirits of God',
    about: 'Every passage where the Seven Spirits appear, from Isaiah to Revelation.',
    refs: ['Isaiah 11:1-3', 'Zechariah 4:2-6', 'Revelation 1:4', 'Revelation 3:1', 'Revelation 4:5', 'Revelation 5:6'],
  },
  {
    title: 'Sevens in Scripture',
    about: 'A taste of the Biblical Trail of Sevens, from creation to the seven lampstands.',
    refs: ['Genesis 2:2-3', 'Joshua 6:15-16', 'Proverbs 9:1', 'Matthew 18:21-22', 'Revelation 1:20'],
  },
  {
    title: 'Life after death',
    about: 'What Scripture says about the moment we leave this life and what follows.',
    refs: ['2 Corinthians 5:6-8', 'Luke 23:43', 'John 14:2-3', 'Philippians 1:21-23', '1 Corinthians 15:51-55', 'Revelation 21:3-4'],
  },
  {
    title: 'God speaks through His creation',
    about: 'Passages behind the Nature category of evidence.',
    refs: ['Psalm 19:1-4', 'Romans 1:20', 'Job 12:7-10', 'Matthew 6:26-29', 'Psalm 104:24'],
  },
];
