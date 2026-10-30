import AppIntents
internal import ExpoAppIntents

// «افتح سورة …»: opens the mushaf at the start of a surah. The cases and names come from the
// app's content database (surahs.name); the app routes the invocation (src/features/siri.ios.ts).

enum SurahChoice: String, AppEnum {
  case s1 = "1"
  case s2 = "2"
  case s3 = "3"
  case s4 = "4"
  case s5 = "5"
  case s6 = "6"
  case s7 = "7"
  case s8 = "8"
  case s9 = "9"
  case s10 = "10"
  case s11 = "11"
  case s12 = "12"
  case s13 = "13"
  case s14 = "14"
  case s15 = "15"
  case s16 = "16"
  case s17 = "17"
  case s18 = "18"
  case s19 = "19"
  case s20 = "20"
  case s21 = "21"
  case s22 = "22"
  case s23 = "23"
  case s24 = "24"
  case s25 = "25"
  case s26 = "26"
  case s27 = "27"
  case s28 = "28"
  case s29 = "29"
  case s30 = "30"
  case s31 = "31"
  case s32 = "32"
  case s33 = "33"
  case s34 = "34"
  case s35 = "35"
  case s36 = "36"
  case s37 = "37"
  case s38 = "38"
  case s39 = "39"
  case s40 = "40"
  case s41 = "41"
  case s42 = "42"
  case s43 = "43"
  case s44 = "44"
  case s45 = "45"
  case s46 = "46"
  case s47 = "47"
  case s48 = "48"
  case s49 = "49"
  case s50 = "50"
  case s51 = "51"
  case s52 = "52"
  case s53 = "53"
  case s54 = "54"
  case s55 = "55"
  case s56 = "56"
  case s57 = "57"
  case s58 = "58"
  case s59 = "59"
  case s60 = "60"
  case s61 = "61"
  case s62 = "62"
  case s63 = "63"
  case s64 = "64"
  case s65 = "65"
  case s66 = "66"
  case s67 = "67"
  case s68 = "68"
  case s69 = "69"
  case s70 = "70"
  case s71 = "71"
  case s72 = "72"
  case s73 = "73"
  case s74 = "74"
  case s75 = "75"
  case s76 = "76"
  case s77 = "77"
  case s78 = "78"
  case s79 = "79"
  case s80 = "80"
  case s81 = "81"
  case s82 = "82"
  case s83 = "83"
  case s84 = "84"
  case s85 = "85"
  case s86 = "86"
  case s87 = "87"
  case s88 = "88"
  case s89 = "89"
  case s90 = "90"
  case s91 = "91"
  case s92 = "92"
  case s93 = "93"
  case s94 = "94"
  case s95 = "95"
  case s96 = "96"
  case s97 = "97"
  case s98 = "98"
  case s99 = "99"
  case s100 = "100"
  case s101 = "101"
  case s102 = "102"
  case s103 = "103"
  case s104 = "104"
  case s105 = "105"
  case s106 = "106"
  case s107 = "107"
  case s108 = "108"
  case s109 = "109"
  case s110 = "110"
  case s111 = "111"
  case s112 = "112"
  case s113 = "113"
  case s114 = "114"

  static let typeDisplayRepresentation: TypeDisplayRepresentation = "سورة"
  static let caseDisplayRepresentations: [SurahChoice: DisplayRepresentation] = [
    .s1: "الفاتحة",
    .s2: "البقرة",
    .s3: "آل عمران",
    .s4: "النساء",
    .s5: "المائدة",
    .s6: "الأنعام",
    .s7: "الأعراف",
    .s8: "الأنفال",
    .s9: "التوبة",
    .s10: "يونس",
    .s11: "هود",
    .s12: "يوسف",
    .s13: "الرعد",
    .s14: "ابراهيم",
    .s15: "الحجر",
    .s16: "النحل",
    .s17: "الإسراء",
    .s18: "الكهف",
    .s19: "مريم",
    .s20: "طه",
    .s21: "الأنبياء",
    .s22: "الحج",
    .s23: "المؤمنون",
    .s24: "النور",
    .s25: "الفرقان",
    .s26: "الشعراء",
    .s27: "النمل",
    .s28: "القصص",
    .s29: "العنكبوت",
    .s30: "الروم",
    .s31: "لقمان",
    .s32: "السجدة",
    .s33: "الأحزاب",
    .s34: "سبإ",
    .s35: "فاطر",
    .s36: "يس",
    .s37: "الصافات",
    .s38: "ص",
    .s39: "الزمر",
    .s40: "غافر",
    .s41: "فصلت",
    .s42: "الشورى",
    .s43: "الزخرف",
    .s44: "الدخان",
    .s45: "الجاثية",
    .s46: "الأحقاف",
    .s47: "محمد",
    .s48: "الفتح",
    .s49: "الحجرات",
    .s50: "ق",
    .s51: "الذاريات",
    .s52: "الطور",
    .s53: "النجم",
    .s54: "القمر",
    .s55: "الرحمن",
    .s56: "الواقعة",
    .s57: "الحديد",
    .s58: "المجادلة",
    .s59: "الحشر",
    .s60: "الممتحنة",
    .s61: "الصف",
    .s62: "الجمعة",
    .s63: "المنافقون",
    .s64: "التغابن",
    .s65: "الطلاق",
    .s66: "التحريم",
    .s67: "الملك",
    .s68: "القلم",
    .s69: "الحاقة",
    .s70: "المعارج",
    .s71: "نوح",
    .s72: "الجن",
    .s73: "المزمل",
    .s74: "المدثر",
    .s75: "القيامة",
    .s76: "الانسان",
    .s77: "المرسلات",
    .s78: "النبإ",
    .s79: "النازعات",
    .s80: "عبس",
    .s81: "التكوير",
    .s82: "الإنفطار",
    .s83: "المطففين",
    .s84: "الإنشقاق",
    .s85: "البروج",
    .s86: "الطارق",
    .s87: "الأعلى",
    .s88: "الغاشية",
    .s89: "الفجر",
    .s90: "البلد",
    .s91: "الشمس",
    .s92: "الليل",
    .s93: "الضحى",
    .s94: "الشرح",
    .s95: "التين",
    .s96: "العلق",
    .s97: "القدر",
    .s98: "البينة",
    .s99: "الزلزلة",
    .s100: "العاديات",
    .s101: "القارعة",
    .s102: "التكاثر",
    .s103: "العصر",
    .s104: "الهمزة",
    .s105: "الفيل",
    .s106: "قريش",
    .s107: "الماعون",
    .s108: "الكوثر",
    .s109: "الكافرون",
    .s110: "النصر",
    .s111: "المسد",
    .s112: "الإخلاص",
    .s113: "الفلق",
    .s114: "الناس",
  ]
}

struct OpenSurahIntent: AppIntent {
  static let title: LocalizedStringResource = "افتح سورة"
  static let description = IntentDescription("يفتح المصحف على أول السورة")
  static let openAppWhenRun: Bool = true

  @Parameter(title: "السورة")
  var surah: SurahChoice

  static var parameterSummary: some ParameterSummary {
    Summary("افتح سورة \(\.$surah)")
  }

  @MainActor
  func perform() async throws -> some IntentResult {
    await AppIntentDispatcher.shared.dispatch(name: "open", params: ["screen": "surah", "surah": surah.rawValue])
    return .result()
  }
}
