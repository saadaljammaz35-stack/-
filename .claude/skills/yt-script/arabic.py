#!/usr/bin/env python3
"""arabic.py - shared Arabic helpers for the yt-* tools. Standard library only.

The upstream tools tokenised on [a-z] only, so an Arabic hook, title or transcript came back empty
and scored zero. Every tool now runs its text through normalize() first:

  - diacritics (harakat, shadda, tanween) and tatweel are dropped
  - alef variants  أ إ آ ٱ -> ا    ة -> ه    ى -> ي    ؤ -> و    ئ -> ي
  - Arabic-Indic digits -> 0-9, and ٪ ٫ ٬ ، ؟ ؛ -> % . , , ? ;

and matches words through forms(), which also tries the word without an attached ال / وال / بال /
فال / كال / لل or a leading و / ف, so "والقناة" and "قناة" count as the same word.

The word lists cover Modern Standard Arabic and Gulf / Saudi speech (وش، ليش، تبي، لين، محد...).
They are hand-written heuristics, not a trained model, in the same spirit as the English lists.

    from arabic import normalize, tokens, forms, has, is_arabic
"""
import re

_DIACRITICS = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")
_TABLE = str.maketrans({
    "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ة": "ه", "ى": "ي", "ؤ": "و", "ئ": "ي",
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
    "٪": "%", "٫": ".", "٬": ",", "،": ",", "؟": "?", "؛": ";", "ک": "ك", "ی": "ي",
})
AR_LETTER = "ء-غف-ي"
_TOKEN = re.compile(r"[a-z0-9'" + AR_LETTER + r"]+")
_AR = re.compile("[" + AR_LETTER + "]")
_LATIN = re.compile(r"[A-Za-z]")


def normalize(text):
    """Spelling-variant, digit and punctuation normalisation. Does NOT lowercase, so it is safe
    to run over a regex pattern as well as over text."""
    return _DIACRITICS.sub("", text or "").translate(_TABLE)


def tokens(text):
    """Lowercased Latin words and normalised Arabic words, in order."""
    return _TOKEN.findall(normalize(text).lower())


def is_arabic(text):
    """True when Arabic letters outnumber Latin ones."""
    return len(_AR.findall(text or "")) > len(_LATIN.findall(text or ""))


_ARTICLES = ("وال", "فال", "بال", "كال", "لل", "ال")


def forms(word):
    """The word plus the versions of it without an attached article or conjunction. Matching
    against every form keeps a real word like "واضح" from being mangled into "اضح": both are
    tried, and only the one that is in a list can match."""
    w = normalize(word).lower()
    out = {w}
    for p in _ARTICLES:
        if w.startswith(p) and len(w) - len(p) >= 2:
            out.add(w[len(p):])
            break
    if w[:1] in ("و", "ف") and len(w) >= 4:
        rest = w[1:]
        out.add(rest)
        if rest.startswith("ال") and len(rest) >= 4:
            out.add(rest[2:])
    return out


def key(word):
    """One canonical form for comparing two words: the article-stripped form if there is one."""
    w = normalize(word).lower()
    for p in _ARTICLES:
        if w.startswith(p) and len(w) - len(p) >= 2:
            return w[len(p):]
    return w


def has(word, wordset):
    return bool(forms(word) & wordset)


def count(words, wordset):
    return sum(1 for w in words if has(w, wordset))


def _set(text):
    return {normalize(w).lower() for w in text.split()}


# --------------------------------------------------------------------------------------- lists

STOP = _set("""
من في فى على عن الى إلى مع عند لدى بين حتى منذ خلال ضد نحو
هذا هذه هذي هاذا هاذي ذا ذي ذلك تلك هذول هذولا هؤلاء اولئك هنا هناك هنالك
الذي التي الذين اللي اللى الي
انا أنا احنا نحن انت أنت انتي أنتِ انتم أنتم انتو هو هي هم هن
كان كانت كانوا كانو يكون تكون صار صارت يصير
لا ما لم لن قد لقد ليس مو مب ماهو
ان أن إن انه أنه انها أنها انو اني إني
و او أو ثم بل لكن بس يعني طيب عشان علشان لان لأن كذا كذلك لذلك
كل بعض اي أي غير مثل زي
وش ايش إيش شو كيف ليش ليه متى وين فين اذا إذا لو
عندي عندك عنده عندها عندنا فيه فيها فيني له لها لك لي لنا لهم
شي شيء اشياء أشياء مره مرة جدا زين ايه إيه نعم الحين الآن اليوم
يا اما أما ايضا أيضا برضو كمان واجد كثير شوي قليل اكثر أكثر اقل أقل
فيديو الفيديو مقطع المقطع قناه قناة القناة قناتي
اسمه اسمها وقتها وقته جماعه جماعة صاحبي حبيبي اخوي تخيل تخيلوا طبعا اساسا أساسا فعلا حرفيا
يب ايوه عاد كده كذا واحد وحده نفس فكره فكرة الشي هالشي ترى المهم بعدين خلاص يلا والله
""")

FILLER = _set("""
يعني طيب طب اوكي اوك حلو اهلا أهلا هلا مرحبا السلام عليكم ياهلا
اليوم فيديو الفيديو مقطع المقطع اشترك اشتركوا اشتراك القناة قناتي لايك
حرفيا حرفياً فعلا فعلاً فعليا تقريبا مره مرة جدا شباب جماعه جماعة
""")

VAGUE = _set("""
رهيب رهيبه رهيبة خرافي خرافيه خرافية خيالي خياليه مذهل مذهله مذهلة مجنون مجنونه جنوني جنون
مدهش مدهشه عجيب عجيبه رائع رائعه خطير خطيره خطيرة فظيع فضيع اسطوري أسطوري اسطوره أسطورة
افضل أفضل احسن أحسن اقوى أقوى قوي قويه قوية عظيم عظيمه ضخم ضخمه هائل هائله جبار
نهائي النهائي كامل كامله كاملة شامل شامله مثالي مثاليه سري سريه سرية سر اسرار أسرار
ثوري لايصدق خارق خارقه
""")

STAKE = _set("""
تخسر يخسر خسرت خسر خسارة خساره خسائر تضيع يضيع ضيعت ضيع ضياع مضيعة مضيعه
تفشل يفشل فشل فشلت مفلس افلست أفلست تكلف يكلف يكلفك تكلفة تكلفه كلفني كلفتني
خطر مخاطرة مخاطره قبل توقف وقف وقفت تندم ندم ندمت غلط غلطة غلطه خطأ خطا أخطاء اخطاء
ابدا أبدا عمرك يموت مات ميت تموت موت الموت انتبه احذر تحذير
""")

CURIOSITY = _set("""
ليش ليه لماذا لمادا كيف شلون وشلون وش ايش إيش شو ماذا مين كم متى وين
لين حتى قبل لكن بس محد ماحد احد أحد تقريبا الا إلا غير السبب فعلا فعلاً الحقيقه الحقيقة
""")

# "because" / "so that" - a hook that answers itself has no gap left
CLOSED = re.compile(normalize(r"\b(لأن|بسبب|لذلك|وبالتالي|عشان كذا|علشان كذا|يعني إن|يعني أن)\b"))

NUMBER_WORDS = _set("""
واحد وحده وحدة اثنين اثنان ثنين ثلاث ثلاثه ثلاثة اربع أربع اربعه أربعة خمس خمسه خمسة
ست سته ستة سبع سبعه سبعة ثمان ثمانيه ثمانية تسع تسعه تسعة عشر عشره عشرة
عشرين ثلاثين اربعين أربعين خمسين ستين سبعين ثمانين تسعين ميه مية مئه مئة الف ألف آلاف الاف
مليون ملايين مليار نص نصف ربع ثلث
يومين ساعتين دقيقتين اسبوعين أسبوعين شهرين سنتين ثانيتين مرتين
""")

TIME_UNITS = _set("""
ثانيه ثانية ثواني ثوان دقيقه دقيقة دقايق دقائق ساعه ساعة ساعات يوم ايام أيام
اسبوع أسبوع اسابيع أسابيع شهر شهور اشهر أشهر سنه سنة سنين سنوات ريال دولار
""")

YOU_WORDS = _set("""
انت أنت إنت انتي أنتي انتم أنتم انتو إنتو انتن
تبي تبغى تبغي تعرف تدري تقدر تسوي تحتاج تخسر تشوف تفكر تنشر ترفع تصور تبدا تبدأ تجرب
تتعلم تكسب تضيع تخاف تحاول تبيع تشتري تكتب تسمع تحس تخيل تخيلي تخيلوا تتخيل
""")

# words that end in ك without being "your"
_NOT_YOU = _set("""
ذلك تلك هناك هنالك كذلك لذلك بذلك اولئك أولئك ملك بنك شك سمك فلك سلك ترك شبك ديك
مشترك مبارك تبارك ضحك شريك شباك سميك تحرك حرك محرك معرك معارك مسك نيزك
""")


def second_person(word):
    """Heuristic 'you' detector: a standalone pronoun, a common 2nd-person verb, or a word
    carrying the attached ـك / ـكم / ـكي pronoun (قناتك، وقتك، عندكم)."""
    f = forms(word)
    if f & YOU_WORDS:
        return True
    if f & _NOT_YOU:
        return False
    return any(len(w) >= 3 and re.search("[" + AR_LETTER + "](ك|كم|كي)$", w) for w in f)


def concrete_count(words):
    """Numbers written as words (سبع، ألف، مليون) and duals of time units (يومين، شهرين). Digits are
    left to each tool's own digit regex, so "30 يوم" counts once, the same as "30 days"."""
    return count(words, NUMBER_WORDS)


def time_unit_count(words):
    return count(words, TIME_UNITS)


# Spoken filler for transcripts: a cue made of nothing but these is cut by deadair.py
FILLER_CUE = _set("""
يعني طيب طب اوكي اوك زين المهم يلا خلاص بس حسنا ايوه ايوا اي ايه صح تمام اها اه آه هاه ها اوه
امم اممم ام هممم همم
""")
_FILLER_PHRASES = re.compile(normalize(
    r"\b(كيف اقول|كيف أقول|شلون اقول|شلون أقول|وش اسمه|ايش اسمه|إيش اسمه|وش اسمها|خلني اشوف|"
    r"خليني اشوف|خلني أشوف|لحظه|لحظة|ثانيه بس|ثانية بس|يا شباب|يا جماعه|يا جماعة|"
    r"المهم يعني|طيب يعني|يعني يعني)\b"))
_ELONGATED = re.compile(r"^(ا*م{2,}|ا+ه+|ا{2,}|ه+م+|اوه+|ها+|ه{2,}|م+)$")


def is_filler_only(text):
    """True when every Arabic word in a cue is filler ("اممم يعني", "طيب، خلاص"). Returns False
    for a cue with no Arabic, so the English check stays in charge there."""
    t = normalize(text).lower()
    if not _AR.search(t):
        return False
    t = _FILLER_PHRASES.sub(" ", t)
    words = _TOKEN.findall(t)
    return all(has(w, FILLER_CUE) or _ELONGATED.match(w) for w in words)


def surface_words(text):
    """(key, display) pairs for Arabic words, keeping the creator's spelling for display."""
    out = []
    for raw in re.findall("[" + AR_LETTER + "ً-ٰٟـ]+", text or ""):
        display = _DIACRITICS.sub("", raw)
        out.append((key(display), display))
    return out
