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
 * hosts the vendors and Adobe document for referrer reporting. An analytics
 * plugin may replace the document through PUT /api/v1/admin/traffic/rules, so
 * a new assistant needs no core release once the list is published there.
 */

import type { TrafficChannelRules } from './traffic-core';

export const DEFAULT_TRAFFIC_RULES: TrafficChannelRules = {
  version: 1,
  ai: [
    // OpenAI
    'chatgpt.com', 'chat.openai.com', 'chat.com', 'chatgpt',
    // Anthropic
    'claude.ai', 'claude',
    // Google
    'gemini.google.com', 'bard.google.com', 'notebooklm.google.com', 'gemini',
    // Microsoft
    'copilot.microsoft.com', 'm365.cloud.microsoft', 'copilot.cloud.microsoft', 'copilot',
    // xAI
    'grok.com', 'grok',
    // Perplexity
    'perplexity.ai', 'pplx.ai', 'perplexity',
    // Others
    'chat.mistral.ai', 'meta.ai', 'duck.ai', 'chat.deepseek.com', 'deepseek.com', 'deepseek',
    'phind.com', 'andisearch.com', 'komo.ai', 'you.com', 'poe.com', 'hey.pi.ai', 'pi.ai',
    'genspark.ai', 'felo.ai', 't3.chat', 'iask.ai', 'venice.ai', 'lumo.proton.me', 'manus.im',
    'writesonic.com', 'app.writesonic.com', 'chat-gpt.org', 'chatplus.com',
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
    // Meta search (community SearXNG instances)
    'searx.be', 'priv.au', 'searxng.site', 'search.inetol.net', 'searx.tiekoetter.com',
    'baresearch.org', 'opnxng.com', 'paulgo.io', 'searx.work', 'search.hbubli.cc', 'search.sapti.me',
    'northboot.xyz', 'searxng.world', 'search.projectsegfau.lt', 'searx.perrette.link',
    // China
    'baidu.com', 'sogou.com', 'so.com', 'sm.cn', 'quark.cn', 'so.toutiao.com', 'chinaso.com',
    'yisou.com', 'www.haosou.com', 'www.soso.com',
  ],
  searchExclude: [
    'mail.google.com', 'translate.google.*', 'docs.google.com', 'drive.google.com',
    'support.google.com', 'maps.google.*', 'productforums.google.com',
  ],
  social: [
    // Global networks
    'facebook.com', 'fb.me', 'instagram.com', 'threads.net', 'threads.com',
    'twitter.com', 't.co', 'x.com', 'bsky.app', 'linkedin.com', 'lnkd.in', 'pinterest.*',
    'reddit.com', 'redd.it', 'youtube.com', 'youtu.be', 'tiktok.com', 'snapchat.com',
    'quora.com', 'news.ycombinator.com', 'medium.com', 'tumblr.com',
    // Chat and community
    'discord.com', 'discord.gg', 'discordapp.com', 'mastodon.social', 'mastodon.online',
    'mstdn.social', 'hachyderm.io', 'mas.to', 'fosstodon.org', 'indieweb.social',
    'slack.com', 'teams.microsoft.com', 'telegram.org', 't.me', 'whatsapp.com', 'wa.me',
    // Regional
    'vk.com', 'ok.ru', 'my.mail.ru', 'moikrug.ru',
    'blog.naver.com', 'cafe.naver.com', 'in.naver.com', 'post.naver.com', 'note.com', 'ameblo.jp',
    'weibo.com', 'weibo.cn', 'zhihu.com', 'douban.com', 'tieba.baidu.com', 'xiaohongshu.com',
    'bilibili.com', 'douyin.com', 'toutiao.com', 'kuaishou.com', 'weixin.qq.com', 'wechat.com',
  ],
  email: [
    // Global webmail
    'mail.google.com', 'gmail.com', 'outlook.live.com', 'outlook.office.com',
    'outlook.office365.com', 'outlook.com', 'mail.yahoo.com', 'mail.aol.com', 'proton.me',
    'protonmail.com', 'hey.com', 'zoho.com', 'mail.zoho.com', 'mail.zoho.eu', 'fastmail.com',
    'gmx.net', 'mail.gmx.net', 'web.de', 'freenet.de', 't-online.de',
    'mail.ru', 'e.mail.ru', 'mail.yandex.com', 'mail.yandex.ru',
    // Asia
    'mail.qq.com', 'wx.mail.qq.com', 'mail.163.com', 'mail.126.com', 'mail.yeah.net',
    'mail.sina.com.cn', 'mail.aliyun.com', 'qiye.aliyun.com', 'mail.china.com', 'mail.sohu.com',
    'mail.wo.cn', 'mail.189.cn', 'mail.10086.cn', 'mail.139.com', 'mail.tom.com', 'mail.21cn.com',
    'mail.naver.com', 'mail.daum.net', 'mail.goo.ne.jp', 'mail.dreamwiz.com',
  ],
  paidMediums: [
    'cpc', 'ppc', 'cpm', 'cpa', 'paidsearch', 'paid-search', 'paid_search',
    'display', 'displayads', 'display-ads', 'display_ads',
    'paid-social', 'paidsocial', 'paid_social', 'paidmedia', 'paid-media', 'paid_media',
    'retargeting', 'remarketing', 'performance-max', 'pmax',
    'shopping', 'paidshopping', 'paid-shopping', 'paid_shopping',
    'app-install', 'appinstall', 'paidappinstall', 'paid-app-install',
    'affiliate', 'sponsored',
  ],
  paidClickParams: [
    'gclid', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'ttclid', 'twclid', 'yclid', 'li_fat_id', 'rb_clickid',
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
