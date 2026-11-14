/**
 * Shipping carrier catalog and tracking-number auto-detection.
 *
 * The catalog is deliberately local-first: detection runs entirely from
 * anchored patterns with no provider API call, so the ship dialog stays
 * instant and works before any Kuaidi100/4PX credential is configured.
 * Carriers without a confident pattern are still selectable manually.
 */

export type CarrierMatchConfidence = 'high' | 'medium';

export interface CarrierPattern {
  /** Anchored (case-insensitive) tracking-number regex source. */
  source: string;
  /**
   * 'high' = brand/country-specific shape (e.g. 1Z…, SF…, …CN suffix);
   * 'medium' = plausible length/prefix shape shared with other carriers.
   */
  confidence: CarrierMatchConfidence;
}

export interface ShippingCarrier {
  /** Machine code persisted as carrier_code on shipments (e.g. 'sf', 'ups'). */
  code: string;
  /** English display name. */
  name: string;
  /** Chinese display name. */
  nameZh: string;
  /** Free-text aliases accepted when matching a manually typed carrier. */
  aliases?: string[];
  /** Anchored tracking-number patterns, strongest first. */
  patterns?: CarrierPattern[];
  /** Tracking page URL template containing `{trackingNumber}`. */
  trackingUrlTemplate?: string;
  /** Whether the carrier is offered in the picker without extra settings. */
  defaultEnabled: boolean;
  /** Stable ordering: lower sorts first. */
  sortOrder: number;
}

export const SHIPPING_CARRIERS: readonly ShippingCarrier[] = [
  // ---- China mainland ----
  {
    code: 'sf', name: 'SF Express', nameZh: '顺丰速运',
    aliases: ['顺丰', 'SF'],
    patterns: [{ source: '^SF\\d{12,16}$', confidence: 'high' }],
    trackingUrlTemplate: 'https://www.sf-express.com/chn/sc/waybill/{trackingNumber}',
    defaultEnabled: true, sortOrder: 10,
  },
  {
    code: 'zto', name: 'ZTO Express', nameZh: '中通快递',
    aliases: ['中通', 'ZTO'],
    patterns: [{ source: '^ZTO\\d{11,14}$', confidence: 'high' }, { source: '^7[0-9]{11,13}$', confidence: 'medium' }],
    defaultEnabled: true, sortOrder: 20,
  },
  {
    code: 'yto', name: 'YTO Express', nameZh: '圆通速递',
    aliases: ['圆通', 'YTO'],
    patterns: [{ source: '^YT\\d{13,15}$', confidence: 'high' }],
    defaultEnabled: true, sortOrder: 30,
  },
  {
    code: 'sto', name: 'STO Express', nameZh: '申通快递',
    aliases: ['申通', 'STO'],
    patterns: [{ source: '^STO\\d{12,14}$', confidence: 'high' }, { source: '^77[0-9]{11,13}$', confidence: 'medium' }],
    defaultEnabled: true, sortOrder: 40,
  },
  {
    code: 'yunda', name: 'Yunda Express', nameZh: '韵达快递',
    aliases: ['韵达', 'YUNDA'],
    patterns: [{ source: '^YD\\d{13,15}$', confidence: 'high' }, { source: '^4[0-9]{13,14}$', confidence: 'medium' }],
    defaultEnabled: true, sortOrder: 50,
  },
  {
    code: 'jd', name: 'JD Logistics', nameZh: '京东物流',
    aliases: ['京东', 'JD'],
    patterns: [{ source: '^JD\\d{13,15}$', confidence: 'high' }],
    defaultEnabled: true, sortOrder: 60,
  },
  {
    code: 'jt', name: 'J&T Express', nameZh: '极兔速递',
    aliases: ['极兔', 'JT'],
    patterns: [{ source: '^JT\\d{13,15}$', confidence: 'high' }],
    defaultEnabled: true, sortOrder: 70,
  },
  {
    code: 'ems', name: 'EMS / China Post', nameZh: '邮政EMS',
    aliases: ['EMS', 'China Post', '邮政', 'ePacket'],
    patterns: [{ source: '^[A-Z]{2}[0-9]{9}CN$', confidence: 'high' }, { source: '^EM[0-9]{11,13}$', confidence: 'medium' }],
    defaultEnabled: true, sortOrder: 80,
  },
  {
    code: 'deppon', name: 'Deppon Express', nameZh: '德邦快递',
    aliases: ['德邦', 'Deppon'],
    defaultEnabled: false, sortOrder: 90,
  },
  // ---- International ----
  {
    code: 'dhl', name: 'DHL Express', nameZh: 'DHL',
    aliases: ['DHL'],
    patterns: [{ source: '^[0-9]{10}$', confidence: 'medium' }],
    trackingUrlTemplate: 'https://www.dhl.com/track?tracking-id={trackingNumber}',
    defaultEnabled: true, sortOrder: 110,
  },
  {
    code: 'fedex', name: 'FedEx', nameZh: 'FedEx',
    aliases: ['Federal Express'],
    patterns: [{ source: '^[0-9]{12}$', confidence: 'medium' }, { source: '^[0-9]{15}$', confidence: 'medium' }, { source: '^[0-9]{20}$', confidence: 'medium' }],
    trackingUrlTemplate: 'https://www.fedex.com/fedextrack/?trknbr={trackingNumber}',
    defaultEnabled: true, sortOrder: 120,
  },
  {
    code: 'ups', name: 'UPS', nameZh: 'UPS',
    aliases: ['United Parcel Service'],
    patterns: [{ source: '^1Z[0-9A-Z]{16}$', confidence: 'high' }],
    trackingUrlTemplate: 'https://www.ups.com/track?tracknum={trackingNumber}',
    defaultEnabled: true, sortOrder: 130,
  },
  {
    code: 'usps', name: 'USPS', nameZh: 'USPS',
    aliases: ['United States Postal Service'],
    patterns: [{ source: '^9[245][0-9]{18,22}$', confidence: 'high' }, { source: '^[A-Z]{2}[0-9]{9}US$', confidence: 'high' }],
    trackingUrlTemplate: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={trackingNumber}',
    defaultEnabled: true, sortOrder: 140,
  },
  {
    code: 'royal-mail', name: 'Royal Mail', nameZh: 'Royal Mail',
    aliases: ['RoyalMail'],
    patterns: [{ source: '^[A-Z]{2}[0-9]{9}GB$', confidence: 'high' }],
    trackingUrlTemplate: 'https://www.royalmail.com/track-your-item?a=Track&tracknum={trackingNumber}',
    defaultEnabled: false, sortOrder: 150,
  },
  {
    code: 'canada-post', name: 'Canada Post', nameZh: 'Canada Post',
    aliases: ['Postes Canada'],
    patterns: [{ source: '^[0-9]{16}$', confidence: 'medium' }],
    defaultEnabled: false, sortOrder: 160,
  },
  {
    code: 'australia-post', name: 'Australia Post', nameZh: 'Australia Post',
    aliases: ['AusPost'],
    defaultEnabled: false, sortOrder: 170,
  },
  {
    code: 'postnl', name: 'PostNL', nameZh: 'PostNL',
    aliases: ['PostNL International'],
    patterns: [{ source: '^(3S)?[A-Z]{2}[0-9]{9}NL$', confidence: 'high' }],
    defaultEnabled: false, sortOrder: 180,
  },
  {
    code: 'colissimo', name: 'Colissimo', nameZh: 'Colissimo',
    aliases: ['La Poste'],
    patterns: [{ source: '^[0-9]{11}FR$', confidence: 'high' }, { source: '^6[LR][0-9]{13}$', confidence: 'medium' }],
    defaultEnabled: false, sortOrder: 190,
  },
  {
    code: 'dpd', name: 'DPD', nameZh: 'DPD',
    aliases: ['Dynamic Parcel Distribution'],
    patterns: [{ source: '^[0-9]{14}$', confidence: 'medium' }],
    defaultEnabled: false, sortOrder: 200,
  },
  {
    code: 'gls', name: 'GLS', nameZh: 'GLS',
    aliases: ['General Logistics Systems'],
    defaultEnabled: false, sortOrder: 210,
  },
  {
    code: 'evri', name: 'Evri', nameZh: 'Evri',
    aliases: ['Hermes UK'],
    patterns: [{ source: '^[A-Z]{3,4}[0-9]{10,12}$', confidence: 'medium' }],
    defaultEnabled: false, sortOrder: 220,
  },
  {
    code: 'aramex', name: 'Aramex', nameZh: 'Aramex',
    defaultEnabled: false, sortOrder: 230,
  },
  {
    code: 'cainiao', name: 'Cainiao Global', nameZh: '菜鸟国际',
    aliases: ['菜鸟', 'Cainiao'],
    patterns: [{ source: '^(LP|CP)[0-9]{12,16}$', confidence: 'high' }],
    trackingUrlTemplate: 'https://global.cainiao.com/newDetail.htm?mailNoList={trackingNumber}',
    defaultEnabled: false, sortOrder: 240,
  },
  {
    code: 'yanwen', name: 'Yanwen', nameZh: '燕文物流',
    aliases: ['燕文', 'Yanwen Express'],
    patterns: [{ source: '^Y[WTZ][0-9]{12,15}$', confidence: 'high' }],
    defaultEnabled: false, sortOrder: 250,
  },
  {
    code: 'yunexpress', name: 'YunExpress', nameZh: '云途物流',
    aliases: ['云途', 'Yun Express'],
    patterns: [{ source: '^YT[0-9]{14,16}$', confidence: 'medium' }],
    defaultEnabled: false, sortOrder: 260,
  },
  {
    code: 'sunyou', name: 'SunYou', nameZh: '速优物流',
    aliases: ['SunYou Economic Air Mail'],
    defaultEnabled: false, sortOrder: 270,
  },
  {
    code: 'ubi', name: 'UBI Smart Parcel', nameZh: 'UBI',
    aliases: ['UBI'],
    defaultEnabled: false, sortOrder: 280,
  },
  {
    code: '4px', name: '4PX', nameZh: '递四方',
    aliases: ['递四方', 'FourPX'],
    defaultEnabled: false, sortOrder: 290,
  },
];

export const DEFAULT_ENABLED_CARRIER_CODES: readonly string[] = SHIPPING_CARRIERS
  .filter((carrier) => carrier.defaultEnabled)
  .map((carrier) => carrier.code);

export function getCarrier(code: string): ShippingCarrier | null {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return null;
  return SHIPPING_CARRIERS.find((carrier) => carrier.code === normalized) ?? null;
}

/**
 * Resolve a manually typed carrier string (code, name, or alias) to a
 * catalog carrier so the ship dialog can store a structured code even
 * when the operator types instead of picking.
 */
export function matchCarrierByName(value: string): ShippingCarrier | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  const byCode = getCarrier(normalized);
  if (byCode) return byCode;
  return SHIPPING_CARRIERS.find((carrier) => (
    carrier.name.toLowerCase() === normalized
    || carrier.nameZh === value.trim()
    || (carrier.aliases ?? []).some((alias) => alias.toLowerCase() === normalized)
  )) ?? null;
}

export interface CarrierCandidate {
  code: string;
  name: string;
  nameZh: string;
  confidence: CarrierMatchConfidence;
}

/**
 * Detect candidate carriers from a tracking number against the enabled
 * subset of the catalog. Returns a confidence-ranked list; an empty list
 * means "no confident match, let the operator pick manually".
 */
export function detectCarriers(trackingNumber: string, enabledCodes?: ReadonlySet<string>): CarrierCandidate[] {
  const normalized = trackingNumber.trim().toUpperCase();
  if (normalized.length < 5) return [];
  const candidates: CarrierCandidate[] = [];
  for (const carrier of SHIPPING_CARRIERS) {
    if (enabledCodes && !enabledCodes.has(carrier.code)) continue;
    let best: CarrierMatchConfidence | null = null;
    for (const pattern of carrier.patterns ?? []) {
      // Patterns ship pre-anchored; a malformed stored source must not
      // break detection for the remaining carriers.
      let matcher: RegExp;
      try {
        matcher = new RegExp(pattern.source, 'i');
      } catch {
        continue;
      }
      if (!matcher.test(normalized)) continue;
      if (pattern.confidence === 'high') {
        best = 'high';
        break;
      }
      best ??= 'medium';
    }
    if (best) {
      candidates.push({ code: carrier.code, name: carrier.name, nameZh: carrier.nameZh, confidence: best });
    }
  }
  return candidates.sort((left, right) => {
    if (left.confidence !== right.confidence) return left.confidence === 'high' ? -1 : 1;
    return (getCarrier(left.code)?.sortOrder ?? 0) - (getCarrier(right.code)?.sortOrder ?? 0);
  });
}

/** Build a carrier tracking URL, or null when the carrier has no template. */
export function trackingUrlFor(code: string, trackingNumber: string): string | null {
  const carrier = getCarrier(code);
  const template = carrier?.trackingUrlTemplate;
  if (!template) return null;
  return template.replace('{trackingNumber}', encodeURIComponent(trackingNumber.trim().toUpperCase()));
}
