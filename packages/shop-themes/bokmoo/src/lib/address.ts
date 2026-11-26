/**
 * The shipping address on the checkout page: a country list in the storefront's language, and the
 * shopper's country picked from their device. Before, "Country" was a box to type in and the fields
 * carried no autofill tokens, so a browser's saved address was never recognised.
 */

/** ISO 3166-1 alpha-2. */
export const COUNTRY_CODES = [
  'AF', 'AX', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AU', 'AT', 'AZ',
  'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BQ', 'BA', 'BW', 'BV', 'BR', 'IO', 'BN', 'BG', 'BF', 'BI',
  'CV', 'KH', 'CM', 'CA', 'KY', 'CF', 'TD', 'CL', 'CN', 'CX', 'CC', 'CO', 'KM', 'CG', 'CD', 'CK', 'CR', 'CI', 'HR', 'CU', 'CW', 'CY', 'CZ',
  'DK', 'DJ', 'DM', 'DO',
  'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET',
  'FK', 'FO', 'FJ', 'FI', 'FR', 'GF', 'PF', 'TF',
  'GA', 'GM', 'GE', 'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY',
  'HT', 'HM', 'VA', 'HN', 'HK', 'HU',
  'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IM', 'IL', 'IT',
  'JM', 'JP', 'JE', 'JO',
  'KZ', 'KE', 'KI', 'KP', 'KR', 'KW', 'KG',
  'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU',
  'MO', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS', 'MA', 'MZ', 'MM',
  'NA', 'NR', 'NP', 'NL', 'NC', 'NZ', 'NI', 'NE', 'NG', 'NU', 'NF', 'MK', 'MP', 'NO',
  'OM',
  'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PN', 'PL', 'PT', 'PR',
  'QA',
  'RE', 'RO', 'RU', 'RW',
  'BL', 'SH', 'KN', 'LC', 'MF', 'PM', 'VC', 'WS', 'SM', 'ST', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SX', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'SS', 'ES', 'LK', 'SD', 'SR', 'SJ', 'SE', 'CH', 'SY',
  'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TK', 'TO', 'TT', 'TN', 'TR', 'TM', 'TC', 'TV',
  'UG', 'UA', 'AE', 'GB', 'US', 'UM', 'UY', 'UZ',
  'VU', 'VE', 'VN', 'VG', 'VI',
  'WF', 'EH',
  'YE',
  'ZM', 'ZW',
];

/** What a shopper or an old address may have written where a country code belongs. */
const COUNTRY_ALIASES: Record<string, string> = { UK: 'GB', EL: 'GR', 'P.R. CHINA': 'CN', 'P.R. OF CHINA': 'CN', 'PRC': 'CN', 'PEOPLES REPUBLIC OF CHINA': 'CN' };

const CODES = new Set(COUNTRY_CODES);

/** A country as an ISO code: trimmed, upper-cased, common spellings mapped; '' when nothing was given. */
export function normalizeCountryCode(value: string | null | undefined): string {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return '';
  if (CODES.has(raw)) return raw;
  return COUNTRY_ALIASES[raw] ?? raw;
}

const displayNamesCache = new Map<string, Intl.DisplayNames | null>();

function regionNames(locale: string): Intl.DisplayNames | null {
  const key = locale || 'en';
  if (!displayNamesCache.has(key)) {
    let names: Intl.DisplayNames | null = null;
    try {
      names = typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames([key], { type: 'region' }) : null;
    } catch {
      names = null;
    }
    displayNamesCache.set(key, names);
  }
  return displayNamesCache.get(key) ?? null;
}

/** The country's name in the storefront's language; its code where the browser cannot name it. */
export function countryName(code: string, locale: string | undefined): string {
  const names = regionNames(locale || 'en');
  if (!names) return code;
  try {
    const name = names.of(code);
    return typeof name === 'string' && name ? name : code;
  } catch {
    return code;
  }
}

export interface CountryOption {
  code: string;
  name: string;
}

/** Every country, named in the storefront's language and listed in that language's order. */
export function countryOptions(locale: string | undefined): CountryOption[] {
  let collator: Intl.Collator | null = null;
  try {
    collator = typeof Intl !== 'undefined' && typeof Intl.Collator === 'function' ? new Intl.Collator(locale || 'en') : null;
  } catch {
    collator = null;
  }
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code, locale) }))
    .sort((left, right) => (collator ? collator.compare(left.name, right.name) : left.name.localeCompare(right.name)) || left.code.localeCompare(right.code));
}

/**
 * The code a country was written as: an ISO code as it is, otherwise the country whose name — in English
 * or in the storefront's language — is what was written. '' when it names no country.
 */
export function countryCodeOf(value: string | null | undefined, locale?: string): string {
  const code = normalizeCountryCode(value);
  if (!code) return '';
  if (CODES.has(code)) return code;
  for (const candidate of COUNTRY_CODES) {
    if (countryName(candidate, 'en').toUpperCase() === code || countryName(candidate, locale || 'en').toUpperCase() === code) return candidate;
  }
  return '';
}

/** Time zone → the one country it belongs to. Zones shared by several countries are left out. */
const ZONE_COUNTRY: Record<string, string> = {
  'Africa/Abidjan': 'CI', 'Africa/Accra': 'GH', 'Africa/Addis_Ababa': 'ET', 'Africa/Algiers': 'DZ', 'Africa/Bissau': 'GW', 'Africa/Cairo': 'EG',
  'Africa/Casablanca': 'MA', 'Africa/El_Aaiun': 'EH', 'Africa/Johannesburg': 'ZA', 'Africa/Juba': 'SS', 'Africa/Kampala': 'UG', 'Africa/Khartoum': 'SD',
  'Africa/Kigali': 'RW', 'Africa/Luanda': 'AO', 'Africa/Lubumbashi': 'CD', 'Africa/Lusaka': 'ZM', 'Africa/Malabo': 'GQ', 'Africa/Mogadishu': 'SO',
  'Africa/Nairobi': 'KE', 'Africa/Ndjamena': 'TD', 'Africa/Tripoli': 'LY', 'Africa/Tunis': 'TN', 'Africa/Windhoek': 'NA',
  'America/Anguilla': 'AI', 'America/Araguaina': 'BR', 'America/Argentina/Buenos_Aires': 'AR', 'America/Aruba': 'AW', 'America/Asuncion': 'PY',
  'America/Bahia': 'BR', 'America/Bogota': 'CO', 'America/Campo_Grande': 'BR', 'America/Cancun': 'MX', 'America/Caracas': 'VE', 'America/Cayenne': 'GF',
  'America/Cayman': 'KY', 'America/Chicago': 'US', 'America/Costa_Rica': 'CR', 'America/Cuiaba': 'BR', 'America/Curacao': 'CW', 'America/Danmarkshavn': 'GL',
  'America/Denver': 'US', 'America/Detroit': 'US', 'America/Dominica': 'DM', 'America/Edmonton': 'CA', 'America/Eirunepe': 'BR', 'America/El_Salvador': 'SV',
  'America/Fort_Nelson': 'CA', 'America/Fortaleza': 'BR', 'America/Glace_Bay': 'CA', 'America/Goose_Bay': 'CA', 'America/Grand_Turk': 'TC',
  'America/Grenada': 'GD', 'America/Guadeloupe': 'GP', 'America/Guatemala': 'GT', 'America/Guayaquil': 'EC', 'America/Guyana': 'GY', 'America/Halifax': 'CA',
  'America/Havana': 'CU', 'America/Hermosillo': 'MX', 'America/Indiana/Indianapolis': 'US', 'America/Indiana/Knox': 'US', 'America/Jamaica': 'JM',
  'America/Juneau': 'US', 'America/La_Paz': 'BO', 'America/Lima': 'PE', 'America/Los_Angeles': 'US', 'America/Lower_Princes': 'SX', 'America/Maceio': 'BR',
  'America/Managua': 'NI', 'America/Manaus': 'BR', 'America/Marigot': 'MF', 'America/Martinique': 'MQ', 'America/Matamoros': 'MX', 'America/Mazatlan': 'MX',
  'America/Menominee': 'US', 'America/Merida': 'MX', 'America/Metlakatla': 'US', 'America/Mexico_City': 'MX', 'America/Miquelon': 'PM', 'America/Moncton': 'CA',
  'America/Monterrey': 'MX', 'America/Montevideo': 'UY', 'America/Montserrat': 'MS', 'America/Nassau': 'BS', 'America/New_York': 'US', 'America/Nome': 'US',
  'America/Noronha': 'BR', 'America/North_Dakota/Beulah': 'US', 'America/North_Dakota/Center': 'US', 'America/North_Dakota/New_Salem': 'US', 'America/Nuuk': 'GL',
  'America/Ojinaga': 'MX', 'America/Panama': 'PA', 'America/Paramaribo': 'SR', 'America/Phoenix': 'US', 'America/Port-au-Prince': 'HT', 'America/Port_of_Spain': 'TT',
  'America/Porto_Velho': 'BR', 'America/Puerto_Rico': 'PR', 'America/Punta_Arenas': 'CL', 'America/Rankin_Inlet': 'CA', 'America/Recife': 'BR', 'America/Regina': 'CA',
  'America/Resolute': 'CA', 'America/Rio_Branco': 'BR', 'America/Santarem': 'BR', 'America/Santiago': 'CL', 'America/Santo_Domingo': 'DO', 'America/Sao_Paulo': 'BR',
  'America/Scoresbysund': 'GL', 'America/Sitka': 'US', 'America/St_Barthelemy': 'BL', 'America/St_Johns': 'CA', 'America/St_Kitts': 'KN', 'America/St_Lucia': 'LC',
  'America/St_Thomas': 'VI', 'America/St_Vincent': 'VC', 'America/Swift_Current': 'CA', 'America/Tegucigalpa': 'HN', 'America/Thule': 'GL', 'America/Tijuana': 'MX',
  'America/Toronto': 'CA', 'America/Tortola': 'VG', 'America/Vancouver': 'CA', 'America/Whitehorse': 'CA', 'America/Winnipeg': 'CA', 'America/Yakutat': 'US',
  'Antarctica/Casey': 'AQ', 'Antarctica/Davis': 'AQ', 'Antarctica/DumontDUrville': 'AQ', 'Antarctica/Macquarie': 'AU', 'Antarctica/Mawson': 'AQ', 'Antarctica/McMurdo': 'AQ',
  'Antarctica/Palmer': 'AQ', 'Antarctica/Rothera': 'AQ', 'Antarctica/Syowa': 'AQ', 'Antarctica/Troll': 'AQ', 'Antarctica/Vostok': 'AQ',
  'Arctic/Longyearbyen': 'SJ', 'Asia/Aden': 'YE', 'Asia/Almaty': 'KZ', 'Asia/Amman': 'JO', 'Asia/Anadyr': 'RU', 'Asia/Aqtau': 'KZ', 'Asia/Aqtobe': 'KZ', 'Asia/Ashgabat': 'TM',
  'Asia/Atyrau': 'KZ', 'Asia/Baghdad': 'IQ', 'Asia/Bahrain': 'BH', 'Asia/Baku': 'AZ', 'Asia/Bangkok': 'TH', 'Asia/Barnaul': 'RU', 'Asia/Beirut': 'LB', 'Asia/Bishkek': 'KG',
  'Asia/Brunei': 'BN', 'Asia/Chita': 'RU', 'Asia/Colombo': 'LK', 'Asia/Damascus': 'SY', 'Asia/Dhaka': 'BD', 'Asia/Dili': 'TL', 'Asia/Dubai': 'AE', 'Asia/Dushanbe': 'TJ',
  'Asia/Famagusta': 'CY', 'Asia/Gaza': 'PS', 'Asia/Hebron': 'PS', 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Hong_Kong': 'HK', 'Asia/Hovd': 'MN', 'Asia/Irkutsk': 'RU', 'Asia/Jakarta': 'ID',
  'Asia/Jayapura': 'ID', 'Asia/Jerusalem': 'IL', 'Asia/Kabul': 'AF', 'Asia/Kamchatka': 'RU', 'Asia/Karachi': 'PK', 'Asia/Kathmandu': 'NP', 'Asia/Khandyga': 'RU',
  'Asia/Kolkata': 'IN', 'Asia/Krasnoyarsk': 'RU', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Kuching': 'MY', 'Asia/Kuwait': 'KW', 'Asia/Macau': 'MO', 'Asia/Magadan': 'RU',
  'Asia/Makassar': 'ID', 'Asia/Manila': 'PH', 'Asia/Muscat': 'OM', 'Asia/Nicosia': 'CY', 'Asia/Novokuznetsk': 'RU', 'Asia/Novosibirsk': 'RU', 'Asia/Omsk': 'RU',
  'Asia/Oral': 'KZ', 'Asia/Phnom_Penh': 'KH', 'Asia/Pontianak': 'ID', 'Asia/Pyongyang': 'KP', 'Asia/Qatar': 'QA', 'Asia/Qostanay': 'KZ', 'Asia/Qyzylorda': 'KZ',
  'Asia/Riyadh': 'SA', 'Asia/Sakhalin': 'RU', 'Asia/Samarkand': 'UZ', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN', 'Asia/Singapore': 'SG', 'Asia/Srednekolymsk': 'RU',
  'Asia/Taipei': 'TW', 'Asia/Tashkent': 'UZ', 'Asia/Tbilisi': 'GE', 'Asia/Tehran': 'IR', 'Asia/Thimphu': 'BT', 'Asia/Tokyo': 'JP', 'Asia/Tomsk': 'RU', 'Asia/Ulaanbaatar': 'MN',
  'Asia/Urumqi': 'CN', 'Asia/Ust-Nera': 'RU', 'Asia/Vientiane': 'LA', 'Asia/Vladivostok': 'RU', 'Asia/Yakutsk': 'RU', 'Asia/Yangon': 'MM', 'Asia/Yekaterinburg': 'RU',
  'Asia/Yerevan': 'AM',
  'Atlantic/Azores': 'PT', 'Atlantic/Bermuda': 'BM', 'Atlantic/Canary': 'ES', 'Atlantic/Cape_Verde': 'CV', 'Atlantic/Faroe': 'FO', 'Atlantic/Madeira': 'PT',
  'Atlantic/Reykjavik': 'IS', 'Atlantic/South_Georgia': 'GS', 'Atlantic/St_Helena': 'SH', 'Atlantic/Stanley': 'FK',
  'Australia/Adelaide': 'AU', 'Australia/Brisbane': 'AU', 'Australia/Broken_Hill': 'AU', 'Australia/Darwin': 'AU', 'Australia/Eucla': 'AU', 'Australia/Hobart': 'AU',
  'Australia/Lindeman': 'AU', 'Australia/Lord_Howe': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Perth': 'AU', 'Australia/Sydney': 'AU',
  'Europe/Amsterdam': 'NL', 'Europe/Andorra': 'AD', 'Europe/Astrakhan': 'RU', 'Europe/Athens': 'GR', 'Europe/Belgrade': 'RS', 'Europe/Berlin': 'DE', 'Europe/Bratislava': 'SK',
  'Europe/Brussels': 'BE', 'Europe/Bucharest': 'RO', 'Europe/Budapest': 'HU', 'Europe/Busingen': 'DE', 'Europe/Chisinau': 'MD', 'Europe/Copenhagen': 'DK', 'Europe/Dublin': 'IE',
  'Europe/Gibraltar': 'GI', 'Europe/Guernsey': 'GG', 'Europe/Helsinki': 'FI', 'Europe/Isle_of_Man': 'IM', 'Europe/Istanbul': 'TR', 'Europe/Jersey': 'JE', 'Europe/Kaliningrad': 'RU',
  'Europe/Kirov': 'RU', 'Europe/Kyiv': 'UA', 'Europe/Lisbon': 'PT', 'Europe/Ljubljana': 'SI', 'Europe/London': 'GB', 'Europe/Luxembourg': 'LU', 'Europe/Madrid': 'ES',
  'Europe/Malta': 'MT', 'Europe/Mariehamn': 'AX', 'Europe/Minsk': 'BY', 'Europe/Monaco': 'MC', 'Europe/Moscow': 'RU', 'Europe/Oslo': 'NO', 'Europe/Paris': 'FR',
  'Europe/Podgorica': 'ME', 'Europe/Prague': 'CZ', 'Europe/Riga': 'LV', 'Europe/Rome': 'IT', 'Europe/Samara': 'RU', 'Europe/San_Marino': 'SM', 'Europe/Sarajevo': 'BA',
  'Europe/Saratov': 'RU', 'Europe/Simferopol': 'UA', 'Europe/Skopje': 'MK', 'Europe/Sofia': 'BG', 'Europe/Stockholm': 'SE', 'Europe/Tallinn': 'EE', 'Europe/Tirane': 'AL',
  'Europe/Ulyanovsk': 'RU', 'Europe/Vaduz': 'LI', 'Europe/Vatican': 'VA', 'Europe/Vienna': 'AT', 'Europe/Vilnius': 'LT', 'Europe/Volgograd': 'RU', 'Europe/Warsaw': 'PL',
  'Europe/Zagreb': 'HR', 'Europe/Zurich': 'CH',
  'Indian/Antananarivo': 'MG', 'Indian/Chagos': 'IO', 'Indian/Christmas': 'CX', 'Indian/Cocos': 'CC', 'Indian/Comoro': 'KM', 'Indian/Kerguelen': 'TF', 'Indian/Mahe': 'SC',
  'Indian/Maldives': 'MV', 'Indian/Mauritius': 'MU', 'Indian/Mayotte': 'YT', 'Indian/Reunion': 'RE',
  'Pacific/Apia': 'WS', 'Pacific/Auckland': 'NZ', 'Pacific/Bougainville': 'PG', 'Pacific/Chatham': 'NZ', 'Pacific/Easter': 'CL', 'Pacific/Efate': 'VU', 'Pacific/Fakaofo': 'TK',
  'Pacific/Fiji': 'FJ', 'Pacific/Funafuti': 'TV', 'Pacific/Galapagos': 'EC', 'Pacific/Gambier': 'PF', 'Pacific/Guadalcanal': 'SB', 'Pacific/Guam': 'GU', 'Pacific/Honolulu': 'US',
  'Pacific/Kanton': 'KI', 'Pacific/Kiritimati': 'KI', 'Pacific/Kosrae': 'FM', 'Pacific/Kwajalein': 'MH', 'Pacific/Majuro': 'MH', 'Pacific/Marquesas': 'PF', 'Pacific/Midway': 'UM',
  'Pacific/Nauru': 'NR', 'Pacific/Niue': 'NU', 'Pacific/Norfolk': 'NF', 'Pacific/Noumea': 'NC', 'Pacific/Pago_Pago': 'AS', 'Pacific/Palau': 'PW', 'Pacific/Pitcairn': 'PN',
  'Pacific/Pohnpei': 'FM', 'Pacific/Port_Moresby': 'PG', 'Pacific/Rarotonga': 'CK', 'Pacific/Saipan': 'MP', 'Pacific/Tahiti': 'PF', 'Pacific/Tarawa': 'KI', 'Pacific/Tongatapu': 'TO',
  'Pacific/Wake': 'UM', 'Pacific/Wallis': 'WF',
};

/** Where most readers of a storefront language are, for devices whose zone is not on the list above. */
const LANGUAGE_COUNTRY: Record<string, string> = { ja: 'JP', ko: 'KR', fr: 'FR', de: 'DE', 'zh-hans': 'CN' };

/**
 * The shopper's country, from their device: the time zone it is set to, else the storefront language.
 * '' when neither says. It is only a first choice for the country list — the shopper can change it.
 */
export function detectShopperCountry(locale: string | undefined): string {
  if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') return '';
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (zone && ZONE_COUNTRY[zone]) return ZONE_COUNTRY[zone];
  } catch {
    /* a device that will not say its zone gets the language's country, or nothing */
  }
  return LANGUAGE_COUNTRY[String(locale || '').toLowerCase()] ?? '';
}
