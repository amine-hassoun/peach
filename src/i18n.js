// Tiny i18n: a dictionary per language, {placeholders}, and .one/.other plural keys.
// Georgian strings are a DRAFT for a native speaker to review.

export const messages = {
  en: {
    'app.name': 'peach',
    'app.tagline': 'Schengen days for iri 🥰',

    'hero.stayUntil': 'You can stay until',
    'hero.enterToday': 'If you arrive today, you can stay until',
    'hero.lastDay': 'Today is your last day',
    'hero.none': 'No days available right now',
    'hero.noneHint': 'Days free up as old stays leave the 180-day window.',
    'hero.over': 'Over the limit by {n} days',

    'gauge.left.one': 'day left',
    'gauge.left.other': 'days left',
    'gauge.aria': '{used} of 90 days used',

    'stays.title': 'My stays',
    'stays.add': 'Add stay',
    'stays.empty': 'No stays yet. Add your first one to get started 🍑',
    'stays.edit': 'Edit',
    'stays.delete': 'Delete',
    'stays.ongoing': 'still there',
    'stays.days.one': '{n} day',
    'stays.days.other': '{n} days',
    'stays.deleted': 'Stay deleted',
    'stays.undo': 'Undo',

    'form.addTitle': 'New stay',
    'form.editTitle': 'Edit stay',
    'form.entry': 'Entry date',
    'form.exit': 'Exit date',
    'form.stillThere': "I'm still there",
    'form.note': 'Note (optional)',
    'form.notePlaceholder': 'e.g. Spring trip',
    'form.save': 'Save',
    'form.cancel': 'Cancel',

    'err.required': 'Please choose the entry date.',
    'err.exitRequired': "Please choose the exit date, or tick “I'm still there”.",
    'err.exitBefore': "The exit date can't be before the entry date.",
    'err.futureOngoing': "A stay you're still in can't start in the future.",

    'timeline.title': 'The last 180 days',
    'timeline.today': 'Today',
    'timeline.aria': 'Timeline of your stays over the last 180 days',

    'footer.disclaimer':
      'A friendly planning aid, not legal advice. Always double-check with the official calculator.',
    'footer.official': 'Open the official calculator',

    'theme.toggle': 'Switch theme',
    'lang.switchTo': 'ქართული',

    'planner.title': 'Trip planner',
    'planner.entryLabel': 'If I enter on',
    'planner.hint': 'Pick an entry date to see how long you can stay.',
    'planner.none': 'No days available if you enter on that date.',
    'planner.result': 'You can stay up to {n} days, until {date}.',
    'sync.idle': 'Starting…',
    'sync.syncing': 'Syncing…',
    'sync.synced': 'Synced',
    'sync.offline': 'Offline: changes are saved on this device',
    'sync.error': 'Sync problem: will retry',
    'sync.nolink': 'Not linked: paste your personal link below',
    'sync.unauthorized': 'This link is not valid anymore',
    'settings.title': 'Sync & backup',
    'settings.copyLink': 'Copy my link',
    'settings.copied': 'Link copied',
    'settings.copyFailed': 'Could not copy',
    'settings.pastePlaceholder': 'Paste your personal link',
    'settings.linkDevice': 'Link this device',
    'settings.linked': 'Device linked',
    'settings.badLink': 'That does not look like a valid link',
    'settings.export': 'Export backup',
    'settings.imported': 'Imported {n} stays',
    'rollover.title': 'Days coming back',
    'rollover.note': 'Assuming no new stays.',
    'rollover.none': 'Nothing to come back: no stays in the last 180 days.',
    'trips.title': 'Trip planner',
    'trips.add': '+ Add trip',
    'trips.entry': 'Entry',
    'trips.exit': 'Exit',
    'trips.remove': 'Remove',
    'trips.max': 'Up to {days}, until {date}',
    'trips.blocked': 'No days left to enter on this date.',
    'trips.fits': 'Fits',
    'trips.over': 'Over by {n}',
    'trips.hint': 'Add a trip to see how long you can stay.',
    'trips.newTitle': 'New trip',
    'trips.editTitle': 'Edit trip',
    'trips.exitOptional': 'Exit date (optional)',
    'trips.exitHint': 'Leave empty to see the longest stay possible.',
    'trips.notePlaceholder': 'e.g. Summer in Lisbon',
    'trips.from': 'From {date}',
  },

  ka: {
    'app.name': 'peach',
    'app.tagline': 'შენი შენგენის დღეები, მარტივად',

    'hero.stayUntil': 'დარჩენის ბოლო დღე',
    'hero.enterToday': 'თუ დღეს შეხვალ, დარჩენის ბოლო დღე იქნება',
    'hero.lastDay': 'დღეს შენი ბოლო დღეა',
    'hero.none': 'ამჟამად თავისუფალი დღეები არ გაქვს',
    'hero.noneHint': 'დღეები თავისუფლდება, როცა ძველი ვიზიტები 180-დღიან პერიოდს ტოვებს.',
    'hero.over': 'ლიმიტი {n} დღით გადაჭარბებულია',

    'gauge.left.one': 'დღე დარჩა',
    'gauge.left.other': 'დღე დარჩა',
    'gauge.aria': '90-დან {used} დღე გამოყენებულია',

    'stays.title': 'ჩემი ვიზიტები',
    'stays.add': 'ვიზიტის დამატება',
    'stays.empty': 'ვიზიტები ჯერ არ დაგიმატებია. დაიწყე პირველით 🍑',
    'stays.edit': 'რედაქტირება',
    'stays.delete': 'წაშლა',
    'stays.ongoing': 'ახლაც იქ ხარ',
    'stays.days.one': '{n} დღე',
    'stays.days.other': '{n} დღე',
    'stays.deleted': 'ვიზიტი წაიშალა',
    'stays.undo': 'დაბრუნება',

    'form.addTitle': 'ახალი ვიზიტი',
    'form.editTitle': 'ვიზიტის რედაქტირება',
    'form.entry': 'შესვლის თარიღი',
    'form.exit': 'გასვლის თარიღი',
    'form.stillThere': 'ახლაც აქ ვარ',
    'form.note': 'შენიშვნა (არასავალდებულო)',
    'form.notePlaceholder': 'მაგ. გაზაფხულის ვიზიტი',
    'form.save': 'შენახვა',
    'form.cancel': 'გაუქმება',

    'err.required': 'აირჩიე შესვლის თარიღი.',
    'err.exitRequired': 'აირჩიე გასვლის თარიღი ან მონიშნე „ახლაც აქ ვარ“.',
    'err.exitBefore': 'გასვლის თარიღი შესვლამდე ვერ იქნება.',
    'err.futureOngoing': 'მიმდინარე ვიზიტის შესვლის თარიღი მომავალში ვერ იქნება.',

    'timeline.title': 'ბოლო 180 დღე',
    'timeline.today': 'დღეს',
    'timeline.aria': 'შენი ვიზიტების ქრონოლოგია ბოლო 180 დღის განმავლობაში',

    'footer.disclaimer':
      'მეგობრული დამხმარე საშუალებაა და არა იურიდიული რჩევა. აუცილებლად გადაამოწმე ოფიციალურ კალკულატორზე.',
    'footer.official': 'ოფიციალური კალკულატორის გახსნა',

    'theme.toggle': 'თემის შეცვლა',
    'lang.switchTo': 'English',

    'planner.title': 'მოგზაურობის დაგეგმვა',
    'planner.entryLabel': 'თუ შევალ თარიღზე',
    'planner.hint': 'აირჩიე შესვლის თარიღი, რომ ნახო რამდენ ხანს შეგიძლია დარჩენა.',
    'planner.none': 'ამ თარიღით შესვლის შემთხვევაში დარჩენის დღეები არ გაქვს.',
    'planner.result': 'შეგიძლია დარჩე მაქსიმუმ {n} დღე, {date}-მდე.',
    'sync.idle': 'იწყება…',
    'sync.syncing': 'სინქრონიზაცია…',
    'sync.synced': 'სინქრონიზებულია',
    'sync.offline': 'ოფლაინ: ცვლილებები შენახულია ამ მოწყობილობაზე',
    'sync.error': 'სინქრონიზაციის პრობლემა: ხელახლა ვცდით',
    'sync.nolink': 'ბმული არ არის მიბმული: ჩასვი შენი პირადი ბმული ქვემოთ',
    'sync.unauthorized': 'ეს ბმული აღარ მუშაობს',
    'settings.title': 'სინქრონიზაცია და ასლი',
    'settings.copyLink': 'ბმულის კოპირება',
    'settings.copied': 'ბმული დაკოპირდა',
    'settings.copyFailed': 'ვერ დაკოპირდა',
    'settings.pastePlaceholder': 'ჩასვი შენი პირადი ბმული',
    'settings.linkDevice': 'ამ მოწყობილობის მიბმა',
    'settings.linked': 'მოწყობილობა მიბმულია',
    'settings.badLink': 'ბმული არასწორია',
    'settings.export': 'ასლის გადმოწერა',
    'settings.imported': 'დაემატა {n} ვიზიტი',
    'rollover.title': 'დღეები, რომლებიც გათავისუფლდება',
    'rollover.note': 'ახალი ყოფნის გარეშე.',
    'rollover.none': 'ბოლო 180 დღეში ყოფნა არ არის.',
    'trips.title': 'მოგზაურობის დაგეგმვა',
    'trips.add': '+ მოგზაურობა',
    'trips.entry': 'შესვლა',
    'trips.exit': 'გასვლა',
    'trips.remove': 'წაშლა',
    'trips.max': 'მაქსიმუმ {days}, {date}-მდე',
    'trips.blocked': 'ამ დღეს შესვლა არ შეიძლება: დღეები აღარ დარჩა.',
    'trips.fits': 'ეტევა',
    'trips.over': 'ლიმიტს აჭარბებს: {n}',
    'trips.hint': 'დაამატე მოგზაურობა, რომ ნახო რამდენ ხანს შეგიძლია დარჩენა.',
    'trips.newTitle': 'ახალი მოგზაურობა',
    'trips.editTitle': 'მოგზაურობის რედაქტირება',
    'trips.exitOptional': 'გასვლის თარიღი (არასავალდებულო)',
    'trips.exitHint': 'დატოვე ცარიელი, რომ ნახო მაქსიმალური ხანგრძლივობა.',
    'trips.notePlaceholder': 'მაგ. ზაფხული ლისაბონში',
    'trips.from': '{date}-დან',
  },
};

export const LANGS = Object.keys(messages);
const LOCALES = { en: 'en-GB', ka: 'ka-GE' };

let lang = 'en';

export function getLang() {
  return lang;
}

export function setLang(next) {
  if (!messages[next]) return;
  lang = next;
  if (typeof document !== 'undefined') document.documentElement.lang = next;
}

export function detectLang() {
  const nav = (typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en')
    .slice(0, 2)
    .toLowerCase();
  return messages[nav] ? nav : 'en';
}

// Missing keys fall back to English, then to the key itself, so a gap never shows a blank.
export function t(key, vars = {}) {
  const raw = messages[lang][key] ?? messages.en[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? String(vars[name]) : `{${name}}`));
}

// Plural helper: tn('stays.days', 3) -> t('stays.days.other', { n: 3 }).
export function tn(key, n, vars = {}) {
  return t(`${key}.${n === 1 ? 'one' : 'other'}`, { n, ...vars });
}

// ISO date -> readable date in the current language. Formatted in UTC because the
// ISO date has no time of day: local-time formatting could shift it by a day.
export function formatDate(iso, style = 'long') {
  const month = style === 'long' ? 'long' : 'short';
  return new Intl.DateTimeFormat(LOCALES[lang], {
    day: 'numeric',
    month,
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}
