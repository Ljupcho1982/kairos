# LinkedIn post — Kairos

Attach **kairos-promo.mp4** (50 s, vertical 1080×1920 — LinkedIn plays it inline and
video reliably out-reaches a static image). Fall back to **promo-linkedin-1200x630.png**.

Put the download link in the **first comment**, not in the post body — link-in-body
posts get throttled:

> ⬇ https://ljupcho1982.github.io/kairos/
> Source & release: https://github.com/Ljupcho1982/kairos

---

## Version A — English

⏳ Every astrology app on earth does the same one thing: it tells you **what today means**.

Not one of them tells you **when to act**.

That's odd, because the oldest practical branch of astrology does exactly that. It's called *electional* — 2,200 years of technique for picking the right moment — and it has never had a decent phone app. It lives in desktop calculators for people who already speak the vocabulary.

So I built **Kairos**.

You tell it what you're about to do — sign a lease, ask for a raise, start a journey — and when you're actually free. It scans the real sky quarter-hour by quarter-hour, refines the best candidates down to the minute, and hands you your windows.

Three things I insisted on:

**1. Every point names its rule and its source.**
"+6.2 the Moon next applies to Jupiter by sextile — *Dorotheus V*". "−14 the Moon is void of course — *Lilly, Christian Astrology p.112*". No black-box cosmic energy score. The negatives are always shown next to the positives, because a score whose costs are hidden is a score nobody should trust.

**2. It refuses to overclaim.**
"Mercury retrograde" is not a universal veto. The tradition applies it to contracts, purchases, messages and travel — so Kairos does too, and tells you plainly when it *doesn't* apply to what you're doing.

**3. It keeps score on itself.**
Rate how each elected moment actually went. Kairos compares that against the times you picked yourself and reports the difference with a 95% bootstrap confidence interval — and it will say **"no measurable difference"** in the same size type as a win. An astrology app willing to be wrong is a new object in this category.

The engineering was the fun part. Positions come from astronomy-engine (MIT, ~1 arcminute, no network). I deliberately did *not* validate the chart against copied ephemeris tables — instead the tests check facts that can be proven independently: the computed Ascendant, converted back to horizontal coordinates, really does sit on the geometric horizon in the eastern sky, at three latitudes including the southern hemisphere. The Midheaven's right ascension really equals the RAMC. The Moon's latitude really is ~0 when it reaches the computed true node.

That approach paid off. Checking the void-of-course Moon against a published table turned up one disagreement — and the cause was that the table counts the Moon's square to **Uranus**, a planet no traditional author had. Traditional reading: a 43-hour void. Modern: 19. So it became a setting, defaulted to the traditional seven, documented in the UI instead of picked silently.

🔒 Works in flight mode. No account, no server, nothing leaves the phone.
💸 No subscription — the #1 complaint in every review of every competitor.
🧪 167 automated tests, built end to end with Claude Code.

Free on any Android. Link in comments 👇

#Astrology #Android #IndieDev #BuildInPublic #OpenSource #ClaudeCode #Hellenistic

---

## Version B — Македонски

⏳ Сите апликации за астрологија на светот прават една иста работа: ти кажуваат **што значи денешниот ден**.

Ниту една не ти кажува **кога да дејствуваш**.

Тоа е чудно, зашто најстарата практична гранка на астрологијата прави токму тоа. Се вика *елекциона* — 2.200 години техника за избор на вистинскиот момент — и никогаш не добила пристојна мобилна апликација. Живее во десктоп калкулатори за луѓе што веќе го знаат речникот.

Затоа го направив **Kairos**.

Му кажуваш што сакаш да направиш — да потпишеш договор за наем, да побараш зголемување на плата, да тргнеш на пат — и кога навистина си слободен. Тој го скенира вистинското небо на секои петнаесет минути, ги дотерува најдобрите кандидати до минута, и ти ги враќа твоите прозорци.

Три работи на кои инсистирав:

**1. Секој поен го именува своето правило и својот извор.**
„+6,2 Месечината следно аплицира кон Јупитер со сектил — *Доротеј V*". „−14 Месечината е без курс — *Лили, Christian Astrology стр. 112*". Без црна кутија и без измислен „космички скор". Негативните точки секогаш стојат до позитивните, зашто скор чија цена е сокриена е скор на кој никој не треба да му верува.

**2. Одбива да ветува премногу.**
„Меркур ретрограден" не е универзална забрана. Традицијата го применува на договори, купувања, пораки и патувања — па така прави и Kairos, и отворено ти кажува кога *не* се однесува на тоа што го правиш.

**3. Води евиденција сам за себе.**
Оценуваш како всушност поминал секој избран момент. Kairos го споредува тоа со термините што ти самиот си ги одбрал и ја пријавува разликата со 95% bootstrap интервал на доверба — и ќе каже **„нема мерлива разлика"** со исто толку големи букви како и кога има. Астролошка апликација што е спремна да признае дека греши е нешто ново во оваа категорија.

Инженерството беше најинтересниот дел. Позициите доаѓаат од astronomy-engine (MIT, точност околу една лачна минута, без интернет). Намерно **не** ја проверував картата со препишани ефемеридни таблици — наместо тоа тестовите проверуваат факти што можат да се докажат независно: пресметаниот Асцендент, вратен назад во хоризонтални координати, навистина стои на геометрискиот хоризонт на исток, на три географски широчини вклучувајќи ја и јужната хемисфера. Ректасцензијата на Медиум Коели навистина е еднаква на RAMC. Латитудата на Месечината навистина е ~0 кога ќе стигне до пресметаниот вистински јазол.

Тој пристап се исплати. Проверката на Месечината без курс наспроти објавена таблица откри едно несогласување — а причината беше што таблицата го брои квадратот на Месечината со **Уран**, планета што ниту еден традиционален автор ја немал. Традиционално читање: 43-часовен период. Модерно: 19. Затоа стана поставка, поставена стандардно на традиционалните седум, објаснета во апликацијата наместо тивко одбрана.

🔒 Работи во авионски режим. Без сметка, без сервер, ништо не го напушта телефонот.
💸 Без претплата — жалба број еден во сите рецензии на сите конкуренти.
🧪 167 автоматски тестови, изработено од почеток до крај со Claude Code.

Бесплатно на кој било Android. Линк во коментарите 👇

#Астрологија #Android #ИндиРазвој #ОпенСорс #ClaudeCode

---

## Short variants (if you want something lighter)

### English — short
⏳ Every astrology app tells you what today means. None tell you **when to act**.

So I built one that does. You name the thing — sign a lease, ask for a raise, first date — and Kairos scans the real sky across your free hours and hands you your window, with every rule and every source behind the score. Then it asks how it went, and reports whether electing actually helped you — including when it didn't.

Offline. No account. No subscription. 167 tests. Free on Android 👇

#Astrology #Android #BuildInPublic #ClaudeCode

### Македонски — кратко
⏳ Сите астролошки апликации ти кажуваат што значи денес. Ниту една не ти кажува **кога да дејствуваш**.

Затоа направив една што кажува. Му го именуваш настанот — договор, барање за плата, прв состанок — и Kairos го скенира вистинското небо низ твоите слободни часови и ти го дава твојот прозорец, со секое правило и секој извор зад оценката. Потоа те прашува како поминало, и ти кажува дали изборот на време навистина ти помогнал — вклучувајќи и кога не помогнал.

Офлајн. Без сметка. Без претплата. 167 тестови. Бесплатно на Android 👇

#Астрологија #Android #ИндиРазвој #ClaudeCode

---

### Assets in this folder
| File | Use |
|---|---|
| `kairos-promo.mp4` | 50 s vertical demo, 1080×1920 — the primary attachment |
| `promo-linkedin-1200x630.png` | link-preview / OpenGraph card |
| `promo-square-1080.png` | Instagram / Facebook square |
| `../docs/qr-download.png` | QR to the download page |
