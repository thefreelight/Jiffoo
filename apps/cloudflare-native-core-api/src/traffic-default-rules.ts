/**
 * Default channel rules for traffic collection.
 *
 * Mirrored like traffic-core.ts:
 *   apps/cloudflare-native-core-api/src/traffic-default-rules.ts
 *   apps/api/src/core/traffic/traffic-default-rules.ts
 *
 * Hosts are lowercase; `example.com` also matches its subdomains and
 * `example.*` matches the whole top-level-domain family. Entries without a
 * dot are bare `utm_source` values. Bump `version` whenever a list changes,
 * and keep the lists in a sane order within each channel (global first, then
 * regional) so diffs read.
 *
 * Where the lists come from (all open licences): PostHog
 * posthog/models/channel_type/ai_sources.py (MIT), Umami src/lib/constants.ts
 * (MIT), matomo-org/searchengine-and-social-list (CC0), and the AI assistant
 * hosts the vendors and Adobe document for referrer reporting. The affiliate
 * click parameters are the ones the networks document for their tracking
 * links. An analytics plugin may replace the document through PUT
 * /api/v1/admin/traffic/rules, so a new assistant needs no core release once
 * the list is published there.
 *
 * A host named in one list and in a list checked earlier needs an entry in
 * that earlier list's exceptions, or the earlier channel wins:
 * `tieba.baidu.com` is a community, so it is kept out of `search`.
 */

import type { TrafficChannelRules } from './traffic-core';

export const DEFAULT_TRAFFIC_RULES: TrafficChannelRules = {
  version: 2,
  ai: [
    // OpenAI
    'chatgpt.com', 'chat.openai.com', 'chat.com', 'chatgpt',
    // Anthropic
    'claude.ai', 'claude',
    // Google
    'gemini.google.com', 'bard.google.com', 'notebooklm.google.com', 'aistudio.google.com', 'labs.google', 'gemini',
    // Microsoft
    'copilot.microsoft.com', 'm365.cloud.microsoft', 'copilot.cloud.microsoft', 'copilot',
    // xAI
    'grok.com', 'grok.x.ai', 'grok',
    // Perplexity
    'perplexity.ai', 'pplx.ai', 'perplexity',
    // Mistral
    'chat.mistral.ai', 'lechat.mistral.com', 'mistral',
    // Others
    'meta.ai', 'duck.ai', 'chat.deepseek.com', 'deepseek.com', 'deepseek',
    'phind.com', 'andisearch.com', 'komo.ai', 'you.com', 'poe.com', 'hey.pi.ai', 'pi.ai',
    'genspark.ai', 'felo.ai', 't3.chat', 'iask.ai', 'venice.ai', 'lumo.proton.me', 'manus.im',
    'writesonic.com', 'app.writesonic.com', 'chat-gpt.org', 'chatplus.com',
    'huggingface.co', 'devv.ai', 'chat.z.ai',
    // China
    'doubao.com', 'doubao',
    'kimi.com', 'kimi.moonshot.cn', 'kimi.ai', 'kimi',
    'yuanbao.tencent.com', 'hunyuan.tencent.com', 'yuanbao',
    'yiyan.baidu.com', 'ernie.baidu.com', 'ai.baidu.com', 'chat.baidu.com', 'wenxin',
    'tongyi.aliyun.com', 'tongyi.com', 'qianwen.com', 'chat.qwen.ai', 'qwen.ai', 'qwen', 'tongyi',
    'chatglm.cn', 'open.bigmodel.cn', 'chatglm',
    'xinghuo.xfyun.cn',
    'metaso.cn', 'metaso', 'n.cn', 'zhida.zhihu.com', 'tiangong.cn',
  ],
  search: [
    // Global
    'google.*',
    'bing.com', 'duckduckgo.com', 'startpage.com', 'search.brave.com', 'ecosia.org', 'yandex.*',
    'qwant.com', 'kagi.com', 'search.yahoo.com', 'search.yahoo.co.jp', 'search.aol.com',
    'search.seznam.cz', 'www.mojeek.com', 'yep.com', 'stract.com', 'presearch.com',
    'search.naver.com', 'search.daum.net', 'search.nate.com', 'search.nifty.com', 'search.goo.ne.jp',
    'websearch.rakuten.co.jp', 'search.seesaa.jp', 'go.mail.ru', 'nova.rambler.ru', 'search.qip.ru',
    'suche.gmx.net', 'suche.1und1.de', 'suche.web.de', 'suche.t-online.de', 'search.xfinity.com',
    'search.bt.com', 'search.rr.com',
    'search.marginalia.nu', 'coccoc.com', 'search.zum.com', 'search.biglobe.ne.jp',
    'dogpile.com', 'webcrawler.com', 'info.com', 'search.lycos.com', 'metacrawler.com',
    // Meta search (community SearXNG instances)
    'searx.be', 'priv.au', 'searxng.site', 'search.inetol.net', 'searx.tiekoetter.com',
    'baresearch.org', 'opnxng.com', 'paulgo.io', 'searx.work', 'search.hbubli.cc', 'search.sapti.me',
    'northboot.xyz', 'searxng.world', 'search.projectsegfau.lt', 'searx.perrette.link',
    // China
    'baidu.com', 'sogou.com', 'so.com', 'sm.cn', 'quark.cn', 'so.toutiao.com', 'chinaso.com',
    'yisou.com', 'www.haosou.com', 'www.soso.com',
  ],
  searchExclude: [
    // Google is more than its results page
    'mail.google.com', 'chat.google.com', 'translate.google.*', 'docs.google.com', 'drive.google.com',
    'support.google.com', 'maps.google.*', 'productforums.google.com',
    'sites.google.com', 'classroom.google.com', 'meet.google.com', 'hangouts.google.com',
    'photos.google.com', 'calendar.google.com', 'groups.google.com', 'play.google.com',
    // Yandex
    'mail.yandex.com', 'mail.yandex.ru', 'mail.yandex.kz', 'mail.yandex.by', 'mail.yandex.ua',
    'mail.yandex.uz', 'mail.yandex.com.tr', 'zen.yandex.ru', 'disk.yandex.ru', 'disk.yandex.com',
    // Baidu
    'mail.baidu.com', 'tieba.baidu.com', 'pan.baidu.com', 'wenku.baidu.com', 'baike.baidu.com', 'zhidao.baidu.com',
    'map.baidu.com', 'maps.baidu.com', 'yun.baidu.com', 'fanyi.baidu.com', 'passport.baidu.com',
    'cache.baiducontent.com', 'mbd.baidu.com', 'haokan.baidu.com',
    // Sogou, 360 and Bing
    'mail.sogou.com', 'fanyi.sogou.com', 'baike.sogou.com', 'wenda.sogou.com',
    'mail.so.com', 'fanyi.so.com', 'baike.so.com', 'wenda.so.com', 'news.so.com', 'hanyu.so.com',
    'translator.bing.com', 'blogs.bing.com',
  ],
  social: [
    // Global networks
    'facebook.com', 'fb.me', 'instagram.com', 'threads.net', 'threads.com', 'messenger.com',
    'twitter.com', 't.co', 'x.com', 'bsky.app', 'linkedin.com', 'lnkd.in', 'pinterest.*', 'pin.it',
    'reddit.com', 'redd.it', 'youtube.com', 'youtu.be', 'tiktok.com', 'snapchat.com', 'snap.com',
    'quora.com', 'qr.ae', 'news.ycombinator.com', 'medium.com', 'tumblr.com', 't.umblr.com',
    // Chat and community
    'discord.com', 'discord.gg', 'discordapp.com', 'mastodon.*',
    'mstdn.social', 'hachyderm.io', 'mas.to', 'fosstodon.org', 'indieweb.social',
    'slack.com', 'teams.microsoft.com', 'telegram.org', 't.me', 'whatsapp.com', 'wa.me',
    'viber.com', 'vb.me', 'skype.com', 'line.me', 'lin.ee', 'line.tv', 'story.kakao.com', 'pf.kakao.com',
    'dev.to', 'hashnode.dev', 'v2ex.com', 'lobste.rs', 'slashdot.org', 'digg.com', '9gag.com', 'imgur.com',
    'lemmy.*',
    // Video platforms
    'vimeo.com', 'twitch.tv', 'rumble.com', 'odysee.com', 'dailymotion.com', 'dai.ly',
    // Regional
    'vk.com', 'ok.ru', 'my.mail.ru', 'moikrug.ru', 'dzen.ru',
    'naver.com', 'note.com', 'ameblo.jp', 'daum.net',
    'weibo.com', 'weibo.cn', 't.cn', 'zhihu.com', 'zhi.hu', 'douban.com', 'tieba.baidu.com',
    'xiaohongshu.com', 'xhslink.com',
    'bilibili.com', 'b23.tv', 'acfun.cn', 'ixigua.com', 'douyin.com', 'iesdouyin.com', 'toutiao.com', 'kuaishou.com',
    'weixin.qq.com', 'wechat.com', 'weixin.com', 'qzone.qq.com', 'connect.qq.com', 'im.qq.com',
    // Travel communities
    'tripadvisor.*', 'mafengwo.cn', 'qyer.com', 'flyert.com',
  ],
  email: [
    // Global webmail
    'mail.google.com', 'gmail.com', 'chat.google.com', 'outlook.live.com', 'outlook.office.com',
    'outlook.office365.com', 'outlook.com', 'hotmail.com', 'mail.yahoo.com', 'mail.aol.com', 'webmail.aol.com', 'proton.me',
    'protonmail.com', 'hey.com', 'zoho.com', 'mail.zoho.com', 'mail.zoho.eu', 'fastmail.com',
    'gmx.net', 'mail.gmx.net', 'web.de', 'freenet.de', 't-online.de', 'webmail.t-online.de',
    'e.mail.ru', 'touch.mail.ru', 'internet.ru', 'mail.yandex.com', 'mail.yandex.ru', 'email.seznam.cz',
    'webmail.rr.com',
    // Newsletter and mailing services: their links go out through these hosts
    'list-manage.com', 'mailchi.mp', 'mailchimp.net', 'campaign-monitor.com', 'acemln.com', 'mandrillapp.com',
    'sendgrid.net', 'exacttarget.com', 'brevo.com', 'mlsend.com', 'substack.com',
    // Asia
    'mail.qq.com', 'wx.mail.qq.com', 'wxmail.qq.com', 'exmail.qq.com', 'mail.163.com', 'qiye.163.com', 'mail.126.com', 'mail.yeah.net',
    'mail.sina.com.cn', 'mail.aliyun.com', 'mail.alibaba.com', 'qiye.aliyun.com', 'mail.china.com', 'mail.sohu.com',
    'mail.wo.cn', 'mail.189.cn', 'mail.10086.cn', 'mail.139.com', 'mail.tom.com', 'mail.21cn.com',
    'mail.sogou.com', 'mail.so.com', 'mail.baidu.com', 'mail.foxmail.com', 'mail.wps.cn',
    'mail.naver.com', 'mail.daum.net', 'mail.goo.ne.jp', 'mail.dreamwiz.com',
  ],
  paidMediums: [
    'cpc', 'ppc', 'cpm', 'cpa', 'cpv', 'cpl', 'paidsearch', 'paid-search', 'paid_search',
    'display', 'displayads', 'display-ads', 'display_ads',
    'paid-social', 'paidsocial', 'paid_social', 'paidmedia', 'paid-media', 'paid_media',
    'paidvideo', 'paid-video', 'paid_video',
    'retargeting', 'remarketing', 'performance-max', 'pmax',
    'shopping', 'paidshopping', 'paid-shopping', 'paid_shopping',
    'app-install', 'appinstall', 'paidappinstall', 'paid-app-install',
    'sponsored',
  ],
  paidClickParams: [
    'gclid', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'ttclid', 'twclid', 'yclid', 'li_fat_id', 'rb_clickid',
    'gdt_vid', 'qhclickid',
  ],
  affiliate: [
    // Networks
    'shareasale.com', 'cj.com', 'linksynergy.com', 'impact.com', 'impactradius.com', 'awin.com', 'awin1.com',
    'partnerize.com', 'rakutenadvertising.com', 'flexoffers.com', 'admitad.com', 'tradedoubler.com',
    'webgains.com', 'affiliatewindow.com', 'partnerstack.com', 'avantlink.com', 'viglink.com', 'skimlinks.com',
    'sovrn.com', 'rewardstyle.com', 'shopmy.us', 'cuelinks.com',
    // Cashback and deal services
    'rakuten.com', 'topcashback.com', 'retailmenot.com', 'fanli.com', '51fanli.com',
    // China
    's.click.taobao.com', 'uland.taobao.com', 'u.jd.com', 'union-click.jd.com', 'p.pinduoduo.com',
  ],
  affiliateMediums: [
    'affiliate', 'aff', 'affiliates', 'partner', 'partners', 'influencer', 'creator',
    'referral-program', 'referral_program',
  ],
  affiliateClickParams: [
    'sscid', 'cjevent', 'irclickid', 'ransiteid', 'raneaid',
  ],
  emailMediums: [
    'email', 'e-mail', 'mail', 'newsletter', 'email-marketing', 'email_marketing',
    'email-newsletter', 'email_newsletter', 'mailchimp', 'klaviyo', 'edm',
  ],
  socialMediums: [
    'social', 'social-media', 'social_media', 'socialnetwork', 'social-network', 'social_network',
    'organic-social', 'organic_social', 'community',
  ],
};
