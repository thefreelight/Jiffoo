var __JIFFOO_THEME_RUNTIME__ = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/runtime.ts
  var runtime_exports = {};
  __export(runtime_exports, {
    default: () => runtime_default,
    theme: () => theme
  });

  // theme-host:react
  var React = globalThis.__JIFFOO_THEME_HOST__?.React;
  if (!React) {
    throw new Error("Theme runtime host bridge is missing React");
  }
  var react_default = React;
  var Children = React.Children;
  var Fragment = React.Fragment;
  var Suspense = React.Suspense;
  var cloneElement = React.cloneElement;
  var createContext = React.createContext;
  var createElement = React.createElement;
  var createRef = React.createRef;
  var forwardRef = React.forwardRef;
  var isValidElement = React.isValidElement;
  var lazy = React.lazy;
  var memo = React.memo;
  var startTransition = React.startTransition;
  var useCallback = React.useCallback;
  var useContext = React.useContext;
  var useDeferredValue = React.useDeferredValue;
  var useEffect = React.useEffect;
  var useId = React.useId;
  var useImperativeHandle = React.useImperativeHandle;
  var useLayoutEffect = React.useLayoutEffect;
  var useMemo = React.useMemo;
  var useReducer = React.useReducer;
  var useRef = React.useRef;
  var useState = React.useState;
  var useTransition = React.useTransition;

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/shared/src/utils.js
  var toKebabCase = (string) => string.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  var mergeClasses = (...classes) => classes.filter((className, index, array) => {
    return Boolean(className) && className.trim() !== "" && array.indexOf(className) === index;
  }).join(" ").trim();

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/defaultAttributes.js
  var defaultAttributes = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  };

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/Icon.js
  var Icon = forwardRef(
    ({
      color = "currentColor",
      size = 24,
      strokeWidth = 2,
      absoluteStrokeWidth,
      className = "",
      children,
      iconNode,
      ...rest
    }, ref) => {
      return createElement(
        "svg",
        {
          ref,
          ...defaultAttributes,
          width: size,
          height: size,
          stroke: color,
          strokeWidth: absoluteStrokeWidth ? Number(strokeWidth) * 24 / Number(size) : strokeWidth,
          className: mergeClasses("lucide", className),
          ...rest
        },
        [
          ...iconNode.map(([tag, attrs]) => createElement(tag, attrs)),
          ...Array.isArray(children) ? children : [children]
        ]
      );
    }
  );

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/createLucideIcon.js
  var createLucideIcon = (iconName, iconNode) => {
    const Component = forwardRef(
      ({ className, ...props }, ref) => createElement(Icon, {
        ref,
        iconNode,
        className: mergeClasses(`lucide-${toKebabCase(iconName)}`, className),
        ...props
      })
    );
    Component.displayName = `${iconName}`;
    return Component;
  };

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/arrow-left.js
  var ArrowLeft = createLucideIcon("ArrowLeft", [
    ["path", { d: "m12 19-7-7 7-7", key: "1l729n" }],
    ["path", { d: "M19 12H5", key: "x3x0zl" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/arrow-right.js
  var ArrowRight = createLucideIcon("ArrowRight", [
    ["path", { d: "M5 12h14", key: "1ays0h" }],
    ["path", { d: "m12 5 7 7-7 7", key: "xquz4c" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/badge-check.js
  var BadgeCheck = createLucideIcon("BadgeCheck", [
    [
      "path",
      {
        d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
        key: "3c2336"
      }
    ],
    ["path", { d: "m9 12 2 2 4-4", key: "dzmm74" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/bell.js
  var Bell = createLucideIcon("Bell", [
    ["path", { d: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", key: "1qo2s2" }],
    ["path", { d: "M10.3 21a1.94 1.94 0 0 0 3.4 0", key: "qgo35s" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/bookmark.js
  var Bookmark = createLucideIcon("Bookmark", [
    ["path", { d: "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z", key: "1fy3hk" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/calendar-days.js
  var CalendarDays = createLucideIcon("CalendarDays", [
    ["path", { d: "M8 2v4", key: "1cmpym" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["rect", { width: "18", height: "18", x: "3", y: "4", rx: "2", key: "1hopcy" }],
    ["path", { d: "M3 10h18", key: "8toen8" }],
    ["path", { d: "M8 14h.01", key: "6423bh" }],
    ["path", { d: "M12 14h.01", key: "1etili" }],
    ["path", { d: "M16 14h.01", key: "1gbofw" }],
    ["path", { d: "M8 18h.01", key: "lrp35t" }],
    ["path", { d: "M12 18h.01", key: "mhygvu" }],
    ["path", { d: "M16 18h.01", key: "kzsmim" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/check.js
  var Check = createLucideIcon("Check", [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/circle-alert.js
  var CircleAlert = createLucideIcon("CircleAlert", [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["line", { x1: "12", x2: "12", y1: "8", y2: "12", key: "1pkeuh" }],
    ["line", { x1: "12", x2: "12.01", y1: "16", y2: "16", key: "4dfq90" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/circle-check.js
  var CircleCheck = createLucideIcon("CircleCheck", [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m9 12 2 2 4-4", key: "dzmm74" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/circle-help.js
  var CircleHelp = createLucideIcon("CircleHelp", [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", key: "1u773s" }],
    ["path", { d: "M12 17h.01", key: "p32p05" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/circle-x.js
  var CircleX = createLucideIcon("CircleX", [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m15 9-6 6", key: "1uzhvr" }],
    ["path", { d: "m9 9 6 6", key: "z0biqf" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/compass.js
  var Compass = createLucideIcon("Compass", [
    [
      "path",
      {
        d: "m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z",
        key: "9ktpf1"
      }
    ],
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/credit-card.js
  var CreditCard = createLucideIcon("CreditCard", [
    ["rect", { width: "20", height: "14", x: "2", y: "5", rx: "2", key: "ynyp8z" }],
    ["line", { x1: "2", x2: "22", y1: "10", y2: "10", key: "1b3vmo" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/ellipsis.js
  var Ellipsis = createLucideIcon("Ellipsis", [
    ["circle", { cx: "12", cy: "12", r: "1", key: "41hilf" }],
    ["circle", { cx: "19", cy: "12", r: "1", key: "1wjl8i" }],
    ["circle", { cx: "5", cy: "12", r: "1", key: "1pcz8c" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/eye-off.js
  var EyeOff = createLucideIcon("EyeOff", [
    [
      "path",
      {
        d: "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49",
        key: "ct8e1f"
      }
    ],
    ["path", { d: "M14.084 14.158a3 3 0 0 1-4.242-4.242", key: "151rxh" }],
    [
      "path",
      {
        d: "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143",
        key: "13bj9a"
      }
    ],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/eye.js
  var Eye = createLucideIcon("Eye", [
    [
      "path",
      {
        d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",
        key: "1nclc0"
      }
    ],
    ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/file-text.js
  var FileText = createLucideIcon("FileText", [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "M10 9H8", key: "b1mrlr" }],
    ["path", { d: "M16 13H8", key: "t4e002" }],
    ["path", { d: "M16 17H8", key: "z1uh3a" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/grid-3x3.js
  var Grid3x3 = createLucideIcon("Grid3x3", [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M3 9h18", key: "1pudct" }],
    ["path", { d: "M3 15h18", key: "5xshup" }],
    ["path", { d: "M9 3v18", key: "fh3hqa" }],
    ["path", { d: "M15 3v18", key: "14nvp0" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/heart.js
  var Heart = createLucideIcon("Heart", [
    [
      "path",
      {
        d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",
        key: "c3ymky"
      }
    ]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/house.js
  var House = createLucideIcon("House", [
    ["path", { d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8", key: "5wwlr5" }],
    [
      "path",
      {
        d: "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
        key: "1d0kgt"
      }
    ]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/list.js
  var List = createLucideIcon("List", [
    ["path", { d: "M3 12h.01", key: "nlz23k" }],
    ["path", { d: "M3 18h.01", key: "1tta3j" }],
    ["path", { d: "M3 6h.01", key: "1rqtza" }],
    ["path", { d: "M8 12h13", key: "1za7za" }],
    ["path", { d: "M8 18h13", key: "1lx6n3" }],
    ["path", { d: "M8 6h13", key: "ik3vkj" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/loader-circle.js
  var LoaderCircle = createLucideIcon("LoaderCircle", [
    ["path", { d: "M21 12a9 9 0 1 1-6.219-8.56", key: "13zald" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/lock-keyhole.js
  var LockKeyhole = createLucideIcon("LockKeyhole", [
    ["circle", { cx: "12", cy: "16", r: "1", key: "1au0dj" }],
    ["rect", { x: "3", y: "10", width: "18", height: "12", rx: "2", key: "6s8ecr" }],
    ["path", { d: "M7 10V7a5 5 0 0 1 10 0v3", key: "1pqi11" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/log-in.js
  var LogIn = createLucideIcon("LogIn", [
    ["path", { d: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4", key: "u53s6r" }],
    ["polyline", { points: "10 17 15 12 10 7", key: "1ail0h" }],
    ["line", { x1: "15", x2: "3", y1: "12", y2: "12", key: "v6grx8" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/mail.js
  var Mail = createLucideIcon("Mail", [
    ["rect", { width: "20", height: "16", x: "2", y: "4", rx: "2", key: "18n3k1" }],
    ["path", { d: "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7", key: "1ocrg3" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/menu.js
  var Menu = createLucideIcon("Menu", [
    ["line", { x1: "4", x2: "20", y1: "12", y2: "12", key: "1e0a9i" }],
    ["line", { x1: "4", x2: "20", y1: "6", y2: "6", key: "1owob3" }],
    ["line", { x1: "4", x2: "20", y1: "18", y2: "18", key: "yk5zj1" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/minus.js
  var Minus = createLucideIcon("Minus", [["path", { d: "M5 12h14", key: "1ays0h" }]]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/package-2.js
  var Package2 = createLucideIcon("Package2", [
    ["path", { d: "M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z", key: "1ront0" }],
    ["path", { d: "m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9", key: "19h2x1" }],
    ["path", { d: "M12 3v6", key: "1holv5" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/plus.js
  var Plus = createLucideIcon("Plus", [
    ["path", { d: "M5 12h14", key: "1ays0h" }],
    ["path", { d: "M12 5v14", key: "s699le" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/save.js
  var Save = createLucideIcon("Save", [
    [
      "path",
      {
        d: "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
        key: "1c8476"
      }
    ],
    ["path", { d: "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7", key: "1ydtos" }],
    ["path", { d: "M7 3v4a1 1 0 0 0 1 1h7", key: "t51u73" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/scale.js
  var Scale = createLucideIcon("Scale", [
    ["path", { d: "m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z", key: "7g6ntu" }],
    ["path", { d: "m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z", key: "ijws7r" }],
    ["path", { d: "M7 21h10", key: "1b0cd5" }],
    ["path", { d: "M12 3v18", key: "108xh3" }],
    ["path", { d: "M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2", key: "3gwbw2" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/search.js
  var Search = createLucideIcon("Search", [
    ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }],
    ["path", { d: "m21 21-4.3-4.3", key: "1qie3q" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/send.js
  var Send = createLucideIcon("Send", [
    [
      "path",
      {
        d: "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",
        key: "1ffxy3"
      }
    ],
    ["path", { d: "m21.854 2.147-10.94 10.939", key: "12cjpa" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/settings-2.js
  var Settings2 = createLucideIcon("Settings2", [
    ["path", { d: "M20 7h-9", key: "3s1dr2" }],
    ["path", { d: "M14 17H5", key: "gfn3mx" }],
    ["circle", { cx: "17", cy: "17", r: "3", key: "18b49y" }],
    ["circle", { cx: "7", cy: "7", r: "3", key: "dfmy0x" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/share-2.js
  var Share2 = createLucideIcon("Share2", [
    ["circle", { cx: "18", cy: "5", r: "3", key: "gq8acd" }],
    ["circle", { cx: "6", cy: "12", r: "3", key: "w7nqdw" }],
    ["circle", { cx: "18", cy: "19", r: "3", key: "1xt0gg" }],
    ["line", { x1: "8.59", x2: "15.42", y1: "13.51", y2: "17.49", key: "47mynk" }],
    ["line", { x1: "15.41", x2: "8.59", y1: "6.51", y2: "10.49", key: "1n3mei" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/shield-alert.js
  var ShieldAlert = createLucideIcon("ShieldAlert", [
    [
      "path",
      {
        d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
        key: "oel41y"
      }
    ],
    ["path", { d: "M12 8v4", key: "1got3b" }],
    ["path", { d: "M12 16h.01", key: "1drbdi" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/shield-check.js
  var ShieldCheck = createLucideIcon("ShieldCheck", [
    [
      "path",
      {
        d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
        key: "oel41y"
      }
    ],
    ["path", { d: "m9 12 2 2 4-4", key: "dzmm74" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/shopping-bag.js
  var ShoppingBag = createLucideIcon("ShoppingBag", [
    ["path", { d: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z", key: "hou9p0" }],
    ["path", { d: "M3 6h18", key: "d0wm0j" }],
    ["path", { d: "M16 10a4 4 0 0 1-8 0", key: "1ltviw" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/sliders-horizontal.js
  var SlidersHorizontal = createLucideIcon("SlidersHorizontal", [
    ["line", { x1: "21", x2: "14", y1: "4", y2: "4", key: "obuewd" }],
    ["line", { x1: "10", x2: "3", y1: "4", y2: "4", key: "1q6298" }],
    ["line", { x1: "21", x2: "12", y1: "12", y2: "12", key: "1iu8h1" }],
    ["line", { x1: "8", x2: "3", y1: "12", y2: "12", key: "ntss68" }],
    ["line", { x1: "21", x2: "16", y1: "20", y2: "20", key: "14d8ph" }],
    ["line", { x1: "12", x2: "3", y1: "20", y2: "20", key: "m0wm8r" }],
    ["line", { x1: "14", x2: "14", y1: "2", y2: "6", key: "14e1ph" }],
    ["line", { x1: "8", x2: "8", y1: "10", y2: "14", key: "1i6ji0" }],
    ["line", { x1: "16", x2: "16", y1: "18", y2: "22", key: "1lctlv" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/sparkles.js
  var Sparkles = createLucideIcon("Sparkles", [
    [
      "path",
      {
        d: "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",
        key: "4pj2yx"
      }
    ],
    ["path", { d: "M20 3v4", key: "1olli1" }],
    ["path", { d: "M22 5h-4", key: "1gvqau" }],
    ["path", { d: "M4 17v2", key: "vumght" }],
    ["path", { d: "M5 18H3", key: "zchphs" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/trash-2.js
  var Trash2 = createLucideIcon("Trash2", [
    ["path", { d: "M3 6h18", key: "d0wm0j" }],
    ["path", { d: "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6", key: "4alrt4" }],
    ["path", { d: "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2", key: "v07s0e" }],
    ["line", { x1: "10", x2: "10", y1: "11", y2: "17", key: "1uufr5" }],
    ["line", { x1: "14", x2: "14", y1: "11", y2: "17", key: "xtxkd" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/triangle-alert.js
  var TriangleAlert = createLucideIcon("TriangleAlert", [
    [
      "path",
      {
        d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
        key: "wmoenq"
      }
    ],
    ["path", { d: "M12 9v4", key: "juzpu7" }],
    ["path", { d: "M12 17h.01", key: "p32p05" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/user-round.js
  var UserRound = createLucideIcon("UserRound", [
    ["circle", { cx: "12", cy: "8", r: "5", key: "1hypcn" }],
    ["path", { d: "M20 21a8 8 0 0 0-16 0", key: "rfgkzh" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/users.js
  var Users = createLucideIcon("Users", [
    ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", key: "1yyitq" }],
    ["circle", { cx: "9", cy: "7", r: "4", key: "nufk8" }],
    ["path", { d: "M22 21v-2a4 4 0 0 0-3-3.87", key: "kshegd" }],
    ["path", { d: "M16 3.13a4 4 0 0 1 0 7.75", key: "1da9ce" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/wallet.js
  var Wallet = createLucideIcon("Wallet", [
    [
      "path",
      {
        d: "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",
        key: "18etb6"
      }
    ],
    ["path", { d: "M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4", key: "xoc0q4" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/wand-sparkles.js
  var WandSparkles = createLucideIcon("WandSparkles", [
    [
      "path",
      {
        d: "m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72",
        key: "ul74o6"
      }
    ],
    ["path", { d: "m14 7 3 3", key: "1r5n42" }],
    ["path", { d: "M5 6v4", key: "ilb8ba" }],
    ["path", { d: "M19 14v4", key: "blhpug" }],
    ["path", { d: "M10 2v2", key: "7u0qdc" }],
    ["path", { d: "M7 8H3", key: "zfb6yr" }],
    ["path", { d: "M21 16h-4", key: "1cnmox" }],
    ["path", { d: "M11 3H9", key: "1obp7u" }]
  ]);

  // ../../../node_modules/.pnpm/lucide-react@0.460.0_react@file+.tools+npm+react-19.2.1.tgz/node_modules/lucide-react/dist/esm/icons/x.js
  var X = createLucideIcon("X", [
    ["path", { d: "M18 6 6 18", key: "1bl5f8" }],
    ["path", { d: "m6 6 12 12", key: "d8bk6v" }]
  ]);

  // theme-host:react/jsx-runtime
  var runtime = globalThis.__JIFFOO_THEME_HOST__?.jsxRuntime;
  if (!runtime) {
    throw new Error("Theme runtime host bridge is missing react/jsx-runtime");
  }
  var Fragment2 = runtime.Fragment;
  var jsx = runtime.jsx;
  var jsxs = runtime.jsxs;
  var jsxDEV = runtime.jsxDEV;

  // src/components/AuthCallbackPage.tsx
  var AuthCallbackPage = react_default.memo(function AuthCallbackPage2({
    provider,
    isLoading,
    error,
    onRetry,
    onNavigateToHome
  }) {
    const title = error ? "Authentication could not be completed." : "Finalizing your private access.";
    return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell flex min-h-screen items-center justify-center px-4 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]", children: /* @__PURE__ */ jsxs("div", { className: "modelsfind-panel max-w-[38rem] rounded-[2rem] border border-[var(--modelsfind-line)] p-8 text-center", children: [
      /* @__PURE__ */ jsx("div", { className: "mx-auto flex h-20 w-20 items-center justify-center rounded-[1.6rem] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]", children: error ? /* @__PURE__ */ jsx(CircleAlert, { className: "h-10 w-10" }) : isLoading ? /* @__PURE__ */ jsx(LoaderCircle, { className: "h-10 w-10 animate-spin" }) : /* @__PURE__ */ jsx(ShieldCheck, { className: "h-10 w-10" }) }),
      /* @__PURE__ */ jsx("p", { className: "mt-6 text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]", children: provider ? `${provider} authentication` : "Authentication" }),
      /* @__PURE__ */ jsx("h1", { className: "mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.5rem,7vw,4rem)] leading-[0.92] tracking-[-0.05em] text-white", children: title }),
      /* @__PURE__ */ jsx("p", { className: "mx-auto mt-4 max-w-[30rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: error ? error : "Please wait while the archive verifies your sign-in and returns you to the booking experience." }),
      /* @__PURE__ */ jsxs("div", { className: "mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center", children: [
        error ? /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: onRetry,
            className: "inline-flex min-h-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)]",
            children: "Retry"
          }
        ) : null,
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: onNavigateToHome,
            className: "inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-ink)]",
            children: "Back to home"
          }
        )
      ] })
    ] }) });
  });

  // src/commerce.ts
  function formatMoneyPrecise(value, currency = "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  }
  function formatDateTime(value) {
    if (!value) {
      return "Unknown";
    }
    return new Date(value).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  function formatOrderId(id) {
    return id.slice(-8).toUpperCase();
  }
  function humanizeStatus(status) {
    if (!status) {
      return "Pending";
    }
    return status.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  }
  function getStatusClasses(status) {
    switch ((status || "").toLowerCase()) {
      case "pending":
        return "border-yellow-500/20 bg-yellow-500/10 text-yellow-100";
      case "processing":
      case "paid":
        return "border-blue-500/20 bg-blue-500/10 text-blue-100";
      case "completed":
      case "delivered":
        return "border-emerald-500/20 bg-emerald-500/10 text-emerald-100";
      case "shipped":
        return "border-violet-500/20 bg-violet-500/10 text-violet-100";
      case "cancelled":
        return "border-red-500/20 bg-red-500/10 text-red-100";
      default:
        return "border-white/10 bg-white/5 text-[var(--modelsfind-copy)]";
    }
  }
  function summarizeAddress(address) {
    if (!address) {
      return "Address provided during checkout";
    }
    const line = address.addressLine1 || address.address || address.street || "";
    const city = address.city || "";
    const region = address.state || "";
    const country = address.country || "";
    return [line, city, region, country].filter(Boolean).join(", ") || "Address provided during checkout";
  }
  function getCartSelection(cart, selectedItemIds, fallbackToAll = true) {
    const selectedIds = selectedItemIds !== void 0 ? selectedItemIds : fallbackToAll ? cart.items.map((item) => item.id) : [];
    const selectedSet = new Set(selectedIds);
    const selectedItems = cart.items.filter((item) => selectedSet.has(item.id));
    const selectedSubtotal = selectedItems.reduce((sum, item) => sum + item.subtotal, 0);
    const ratio = cart.subtotal > 0 ? selectedSubtotal / cart.subtotal : 0;
    return {
      selectedIds,
      selectedSet,
      selectedItems,
      selectedSubtotal,
      selectedTax: Number(((cart.tax || 0) * ratio).toFixed(2)),
      selectedShipping: Number(((cart.shipping || 0) * ratio).toFixed(2)),
      selectedDiscount: Number(((cart.discount || 0) * ratio).toFixed(2))
    };
  }

  // src/components/CartPage.tsx
  var CartPage = react_default.memo(function CartPage2({
    cart,
    isLoading,
    onUpdateQuantity,
    onRemoveItem,
    onCheckout,
    onCheckoutSelected,
    selectedItemIds,
    onToggleItemSelection,
    onSelectAllItems,
    onDeselectAllItems,
    onContinueShopping
  }) {
    const supportsSelection = Boolean(
      onCheckoutSelected && onToggleItemSelection && onSelectAllItems && onDeselectAllItems
    );
    const {
      selectedIds,
      selectedSet,
      selectedSubtotal,
      selectedTax,
      selectedShipping,
      selectedDiscount
    } = getCartSelection(cart, supportsSelection ? selectedItemIds ?? [] : void 0, !supportsSelection);
    const selectedTotal = Number(
      (selectedSubtotal + selectedTax + selectedShipping - selectedDiscount).toFixed(2)
    );
    const allSelected = cart.items.length > 0 && selectedIds.length === cart.items.length;
    const hasSelection = selectedIds.length > 0;
    const bookingItems = supportsSelection ? cart.items.filter((item) => selectedSet.has(item.id)) : cart.items;
    const leadItem = bookingItems[0] || cart.items[0];
    const bookingMonth = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric"
    }).format(/* @__PURE__ */ new Date());
    const bookingDays = Array.from({ length: 21 }, (_, index) => {
      const date = /* @__PURE__ */ new Date();
      date.setDate(date.getDate() + index);
      return {
        label: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date).slice(0, 1),
        day: date.getDate(),
        active: index === 3,
        muted: index < 2
      };
    });
    const depositValue = Number((selectedTotal * 0.2).toFixed(2));
    if (cart.items.length === 0) {
      return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell min-h-screen px-4 pb-24 pt-24 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-[960px]", children: /* @__PURE__ */ jsxs("div", { className: "modelsfind-panel rounded-[2rem] border border-[var(--modelsfind-line)] p-10 text-center", children: [
        /* @__PURE__ */ jsx("div", { className: "mx-auto flex h-20 w-20 items-center justify-center rounded-[1.6rem] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]", children: /* @__PURE__ */ jsx(ShoppingBag, { className: "h-9 w-9" }) }),
        /* @__PURE__ */ jsx("h1", { className: "mt-6 [font-family:var(--modelsfind-display)] text-[clamp(2.6rem,7vw,4rem)] leading-[0.92] tracking-[-0.05em] text-white", children: "Your private cart is empty." }),
        /* @__PURE__ */ jsx("p", { className: "mx-auto mt-4 max-w-[30rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: "Keep the empty state quiet and premium. Encourage exploration without collapsing into generic storefront language." }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: onContinueShopping,
            className: "mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)]",
            children: [
              /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
              "Continue browsing"
            ]
          }
        )
      ] }) }) });
    }
    return /* @__PURE__ */ jsxs("div", { className: "modelsfind-shell min-h-screen px-4 pb-32 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]", children: [
      /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1560px] md:hidden", children: [
        /* @__PURE__ */ jsxs("header", { className: "modelsfind-mobile-topbar fixed inset-x-0 top-0 z-[75] flex h-16 items-center justify-between px-6", children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: onContinueShopping,
              className: "inline-flex items-center gap-3 text-white",
              children: [
                /* @__PURE__ */ jsx(ShoppingBag, { className: "h-4 w-4 text-[var(--modelsfind-primary)]" }),
                /* @__PURE__ */ jsx("span", { className: "[font-family:var(--modelsfind-display)] text-[1rem] italic tracking-[0.16em] uppercase", children: leadItem.productName })
              ]
            }
          ),
          /* @__PURE__ */ jsx(Check, { className: "h-4 w-4 text-[var(--modelsfind-copy-soft)]" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-10 pb-12", children: [
          /* @__PURE__ */ jsxs("section", { className: "pt-4", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.2rem] text-[var(--modelsfind-primary)]", children: "Reservation" }),
            /* @__PURE__ */ jsxs("h1", { className: "mt-3 [font-family:var(--modelsfind-display)] text-[3rem] leading-[0.96] tracking-[-0.05em] text-white", children: [
              "Secure Your ",
              /* @__PURE__ */ jsx("br", {}),
              /* @__PURE__ */ jsx("span", { className: "italic", children: "Private Occasion" })
            ] }),
            /* @__PURE__ */ jsx("p", { className: "mt-4 max-w-[18rem] text-sm leading-6 text-[var(--modelsfind-copy)]", children: "Select your preferred service tier and scheduling window. Our concierge will finalize the details." })
          ] }),
          /* @__PURE__ */ jsxs("section", { className: "space-y-4", children: [
            /* @__PURE__ */ jsx("h2", { className: "text-[10px] uppercase tracking-[0.15rem] text-[var(--modelsfind-copy-soft)]", children: "Service type" }),
            /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
              bookingItems.slice(0, 2).map((item, index) => /* @__PURE__ */ jsxs(
                "article",
                {
                  className: [
                    "rounded-[1rem] p-4",
                    index === 0 ? "modelsfind-mobile-surface border-b-2 border-[var(--modelsfind-primary)] shadow-[0_0_18px_rgba(255,122,251,0.12)]" : "border border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] bg-[rgba(17,14,20,0.78)]"
                  ].join(" "),
                  children: [
                    /* @__PURE__ */ jsxs("div", { className: "mb-6 flex items-start justify-between gap-3", children: [
                      /* @__PURE__ */ jsx("span", { className: "text-[var(--modelsfind-primary)]", children: index === 0 ? "\u2726" : "\u25CC" }),
                      /* @__PURE__ */ jsxs("span", { className: "text-[10px] font-bold tracking-tight text-[var(--modelsfind-copy-soft)]", children: [
                        "Tier ",
                        index === 0 ? "I" : "II"
                      ] })
                    ] }),
                    /* @__PURE__ */ jsx("h3", { className: index === 0 ? "[font-family:var(--modelsfind-display)] text-[1.3rem] text-white" : "[font-family:var(--modelsfind-display)] text-[1.3rem] text-[var(--modelsfind-copy)]", children: item.variantName || item.productName }),
                    /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs leading-5 text-[var(--modelsfind-copy-soft)]", children: index === 0 ? "High-fashion productions and discreet curated sets." : "Exclusive gatherings and private concierge experiences." })
                  ]
                },
                item.id
              )),
              bookingItems.length < 2 ? /* @__PURE__ */ jsxs("article", { className: "rounded-[1rem] border border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] bg-[rgba(17,14,20,0.78)] p-4", children: [
                /* @__PURE__ */ jsxs("div", { className: "mb-6 flex items-start justify-between gap-3", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-[var(--modelsfind-copy-soft)]", children: "\u25CC" }),
                  /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold tracking-tight text-[var(--modelsfind-copy-soft)]", children: "Tier II" })
                ] }),
                /* @__PURE__ */ jsx("h3", { className: "[font-family:var(--modelsfind-display)] text-[1.3rem] text-[var(--modelsfind-copy)]", children: "Private Event" }),
                /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs leading-5 text-[var(--modelsfind-copy-soft)]", children: "Exclusive gatherings and curated experiences." })
              ] }) : null
            ] })
          ] }),
          /* @__PURE__ */ jsxs("section", { className: "space-y-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-end justify-between gap-4", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("h2", { className: "text-[10px] uppercase tracking-[0.15rem] text-[var(--modelsfind-copy-soft)]", children: "Select date" }),
                /* @__PURE__ */ jsx("p", { className: "[font-family:var(--modelsfind-display)] text-[1.7rem] text-white", children: bookingMonth })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex gap-4 text-[var(--modelsfind-copy-soft)]", children: [
                /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
                /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4 rotate-180" })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "rounded-[1.4rem] border border-[color-mix(in_srgb,var(--modelsfind-line)_50%,transparent)] bg-[rgba(0,0,0,0.28)] p-5", children: [
              /* @__PURE__ */ jsx("div", { className: "mb-4 grid grid-cols-7 text-center text-[10px] font-bold uppercase text-[var(--modelsfind-copy-soft)]", children: ["M", "T", "W", "T", "F", "S", "S"].map((day) => /* @__PURE__ */ jsx("span", { children: day }, day)) }),
              /* @__PURE__ */ jsx("div", { className: "grid grid-cols-7 gap-y-4 text-center", children: bookingDays.map((day, index) => /* @__PURE__ */ jsxs(
                "div",
                {
                  className: [
                    "relative py-2 text-sm",
                    day.active ? "rounded-full border border-[var(--modelsfind-line-strong)] bg-[var(--modelsfind-primary-soft)] text-white" : day.muted ? "text-[color-mix(in_srgb,var(--modelsfind-copy-soft)_35%,transparent)]" : "text-[var(--modelsfind-copy)]"
                  ].join(" "),
                  children: [
                    day.day,
                    day.active ? /* @__PURE__ */ jsx("span", { className: "absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[var(--modelsfind-primary)]" }) : null
                  ]
                },
                `${day.day}-${index}`
              )) })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("section", { className: "modelsfind-mobile-surface relative overflow-hidden rounded-[1.7rem] border border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] p-6", children: [
            /* @__PURE__ */ jsx("div", { className: "absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[var(--modelsfind-primary-soft)] blur-[72px]" }),
            /* @__PURE__ */ jsxs("div", { className: "relative", children: [
              /* @__PURE__ */ jsxs("div", { className: "mb-8 flex items-baseline justify-between gap-4", children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("h2", { className: "text-[10px] uppercase tracking-[0.15rem] text-[var(--modelsfind-copy-soft)]", children: "Estimated total" }),
                  /* @__PURE__ */ jsx("p", { className: "[font-family:var(--modelsfind-display)] text-[2.6rem] text-white", children: formatMoneyPrecise(selectedTotal) })
                ] }),
                /* @__PURE__ */ jsx("span", { className: "rounded-full bg-[var(--modelsfind-primary-soft)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14rem] text-[var(--modelsfind-primary)]", children: "Elite tier" })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "space-y-3 text-xs", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex justify-between gap-4 text-[var(--modelsfind-copy)]", children: [
                  /* @__PURE__ */ jsx("span", { children: leadItem.variantName || leadItem.productName }),
                  /* @__PURE__ */ jsx("span", { className: "text-white", children: formatMoneyPrecise(leadItem.subtotal) })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex justify-between gap-4 text-[var(--modelsfind-copy)]", children: [
                  /* @__PURE__ */ jsx("span", { children: "Location Concierge" }),
                  /* @__PURE__ */ jsx("span", { className: "text-white", children: formatMoneyPrecise(selectedShipping) })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex justify-between gap-4 border-t border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] pt-3 font-bold", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-white", children: "Deposit Required (20%)" }),
                  /* @__PURE__ */ jsx("span", { className: "text-[var(--modelsfind-primary)]", children: formatMoneyPrecise(depositValue) })
                ] })
              ] }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => {
                    if (supportsSelection && onCheckoutSelected) {
                      onCheckoutSelected(selectedIds);
                      return;
                    }
                    onCheckout();
                  },
                  disabled: isLoading || supportsSelection && !hasSelection,
                  className: "modelsfind-mobile-cta mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-bold uppercase tracking-[0.22em] text-[#210025] disabled:opacity-60",
                  children: "Request Booking"
                }
              )
            ] })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mx-auto hidden max-w-[1560px] md:block", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: onContinueShopping,
              className: "inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] text-[var(--modelsfind-copy)]",
              children: /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" })
            }
          ),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]", children: "Checkout" }),
            /* @__PURE__ */ jsx("h1", { className: "[font-family:var(--modelsfind-display)] text-[2.3rem] leading-none tracking-[-0.04em] text-white", children: "Curated cart" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start", children: [
          /* @__PURE__ */ jsxs("section", { className: "modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] p-4 md:p-6 xl:p-8", children: [
            supportsSelection ? /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between rounded-[1.2rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3", children: [
              /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  onClick: () => {
                    if (allSelected) {
                      onDeselectAllItems?.();
                      return;
                    }
                    onSelectAllItems?.();
                  },
                  className: "inline-flex items-center gap-2 text-sm text-[var(--modelsfind-ink)]",
                  children: [
                    /* @__PURE__ */ jsx(
                      "span",
                      {
                        className: [
                          "flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
                          allSelected ? "border-[var(--modelsfind-primary)] bg-[var(--modelsfind-primary)] text-[#140d16]" : "border-[var(--modelsfind-line)] text-transparent"
                        ].join(" "),
                        children: /* @__PURE__ */ jsx(Check, { className: "h-3.5 w-3.5" })
                      }
                    ),
                    allSelected ? "Deselect all" : "Select all"
                  ]
                }
              ),
              /* @__PURE__ */ jsxs("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: [
                selectedIds.length,
                " selected"
              ] })
            ] }) : null,
            /* @__PURE__ */ jsx("div", { className: "mt-6 grid gap-4", children: cart.items.map((item) => /* @__PURE__ */ jsx(
              "article",
              {
                className: "rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-4 sm:p-5",
                children: /* @__PURE__ */ jsxs("div", { className: "flex gap-4", children: [
                  supportsSelection ? /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: () => onToggleItemSelection?.(item.id),
                      className: [
                        "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                        selectedSet.has(item.id) ? "border-[var(--modelsfind-primary)] bg-[var(--modelsfind-primary)] text-[#140d16]" : "border-[var(--modelsfind-line)] text-transparent"
                      ].join(" "),
                      "aria-label": selectedSet.has(item.id) ? "Deselect item" : "Select item",
                      children: /* @__PURE__ */ jsx(Check, { className: "h-3.5 w-3.5" })
                    }
                  ) : null,
                  /* @__PURE__ */ jsx("div", { className: "h-24 w-24 shrink-0 overflow-hidden rounded-[1.1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)]", children: /* @__PURE__ */ jsx(
                    "img",
                    {
                      src: item.productImage || "/placeholder-product.svg",
                      alt: item.productName,
                      className: "h-full w-full object-cover grayscale"
                    }
                  ) }),
                  /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", children: [
                      /* @__PURE__ */ jsxs("div", { children: [
                        /* @__PURE__ */ jsx("h2", { className: "[font-family:var(--modelsfind-display)] text-[1.8rem] leading-none tracking-[-0.04em] text-white", children: item.productName }),
                        item.variantName ? /* @__PURE__ */ jsx("p", { className: "mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: item.variantName }) : null
                      ] }),
                      /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold text-[var(--modelsfind-primary)]", children: formatMoneyPrecise(item.price) })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [
                      /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-1", children: [
                        /* @__PURE__ */ jsx(
                          "button",
                          {
                            type: "button",
                            onClick: () => void onUpdateQuantity(item.id, item.quantity - 1),
                            disabled: isLoading || item.quantity <= 1,
                            className: "flex h-9 w-9 items-center justify-center rounded-full text-[var(--modelsfind-copy)] disabled:opacity-40",
                            children: /* @__PURE__ */ jsx(Minus, { className: "h-4 w-4" })
                          }
                        ),
                        /* @__PURE__ */ jsx("span", { className: "min-w-[2.75rem] text-center text-sm font-semibold text-white", children: item.quantity }),
                        /* @__PURE__ */ jsx(
                          "button",
                          {
                            type: "button",
                            onClick: () => void onUpdateQuantity(item.id, item.quantity + 1),
                            disabled: isLoading || item.quantity >= item.maxQuantity,
                            className: "flex h-9 w-9 items-center justify-center rounded-full text-[var(--modelsfind-copy)] disabled:opacity-40",
                            children: /* @__PURE__ */ jsx(Plus, { className: "h-4 w-4" })
                          }
                        )
                      ] }),
                      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                        /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: formatMoneyPrecise(item.subtotal) }),
                        /* @__PURE__ */ jsx(
                          "button",
                          {
                            type: "button",
                            onClick: () => void onRemoveItem(item.id),
                            disabled: isLoading,
                            className: "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] text-[var(--modelsfind-copy)] transition-colors hover:text-red-300",
                            children: /* @__PURE__ */ jsx(Trash2, { className: "h-4 w-4" })
                          }
                        )
                      ] })
                    ] })
                  ] })
                ] })
              },
              item.id
            )) })
          ] }),
          /* @__PURE__ */ jsxs("aside", { className: "modelsfind-panel rounded-[1.6rem] border border-[var(--modelsfind-line)] p-5", children: [
            /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]", children: "Summary" }),
            /* @__PURE__ */ jsx("h2", { className: "mt-3 [font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white", children: "Booking total" }),
            /* @__PURE__ */ jsxs("div", { className: "mt-5 space-y-3 text-sm", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-[var(--modelsfind-copy)]", children: [
                /* @__PURE__ */ jsx("span", { children: "Subtotal" }),
                /* @__PURE__ */ jsx("span", { className: "text-white", children: formatMoneyPrecise(selectedSubtotal) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-[var(--modelsfind-copy)]", children: [
                /* @__PURE__ */ jsx("span", { children: "Tax" }),
                /* @__PURE__ */ jsx("span", { className: "text-white", children: formatMoneyPrecise(selectedTax) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-[var(--modelsfind-copy)]", children: [
                /* @__PURE__ */ jsx("span", { children: "Shipping" }),
                /* @__PURE__ */ jsx("span", { className: "text-white", children: selectedShipping === 0 ? "Included" : formatMoneyPrecise(selectedShipping) })
              ] }),
              selectedDiscount > 0 ? /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-emerald-200", children: [
                /* @__PURE__ */ jsx("span", { children: "Discount" }),
                /* @__PURE__ */ jsxs("span", { children: [
                  "-",
                  formatMoneyPrecise(selectedDiscount)
                ] })
              ] }) : null,
              /* @__PURE__ */ jsxs("div", { className: "flex justify-between border-t border-[var(--modelsfind-line)] pt-3 text-base", children: [
                /* @__PURE__ */ jsx("span", { className: "font-semibold text-white", children: "Total" }),
                /* @__PURE__ */ jsx("span", { className: "font-semibold text-[var(--modelsfind-primary)]", children: formatMoneyPrecise(selectedTotal) })
              ] })
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => {
                  if (supportsSelection && onCheckoutSelected) {
                    onCheckoutSelected(selectedIds);
                    return;
                  }
                  onCheckout();
                },
                disabled: isLoading || supportsSelection && !hasSelection,
                className: "mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)] disabled:opacity-60",
                children: "Proceed to checkout"
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: onContinueShopping,
                className: "mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-ink)]",
                children: [
                  /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
                  "Continue browsing"
                ]
              }
            )
          ] })
        ] })
      ] })
    ] });
  });

  // src/site.ts
  var defaultModelsfindThemeConfig = {
    brand: {
      name: "modelsfind",
      primaryColor: "#e84fda",
      secondaryColor: "#9a6cff",
      fontFamily: '"Noto Serif", "Iowan Old Style", serif'
    },
    layout: {
      headerSticky: true,
      showFooterLinks: true,
      maxWidth: "1280px"
    },
    features: {
      showWishlist: true,
      showRatings: false,
      enableQuickView: false
    },
    site: {
      archetype: "product-site",
      eyebrow: "Curated exclusivity",
      headline: "modelsfind",
      subheadline: "Curated exclusivity beyond the ordinary.",
      primaryCtaLabel: "Browse collection",
      primaryCtaHref: "/products",
      secondaryCtaLabel: "Private access",
      secondaryCtaHref: "/auth/register",
      docsHref: "/help",
      demoHref: "/products",
      supportEmail: "concierge@modelsfind.com",
      installCommand: "pnpm theme:add modelsfind"
    }
  };
  var DEFAULT_SITE_CONFIG = {
    brandName: defaultModelsfindThemeConfig.brand.name,
    archetype: defaultModelsfindThemeConfig.site.archetype,
    eyebrow: defaultModelsfindThemeConfig.site.eyebrow,
    headline: defaultModelsfindThemeConfig.site.headline,
    subheadline: defaultModelsfindThemeConfig.site.subheadline,
    primaryCtaLabel: defaultModelsfindThemeConfig.site.primaryCtaLabel,
    primaryCtaHref: defaultModelsfindThemeConfig.site.primaryCtaHref,
    secondaryCtaLabel: defaultModelsfindThemeConfig.site.secondaryCtaLabel,
    secondaryCtaHref: defaultModelsfindThemeConfig.site.secondaryCtaHref,
    docsHref: defaultModelsfindThemeConfig.site.docsHref,
    demoHref: defaultModelsfindThemeConfig.site.demoHref,
    supportEmail: defaultModelsfindThemeConfig.site.supportEmail,
    installCommand: defaultModelsfindThemeConfig.site.installCommand
  };
  function resolveText(value, fallback) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : fallback;
  }
  function resolveModelsfindSiteConfig(config) {
    return {
      ...DEFAULT_SITE_CONFIG,
      brandName: resolveText(config?.brand?.name, DEFAULT_SITE_CONFIG.brandName),
      archetype: config?.site?.archetype || DEFAULT_SITE_CONFIG.archetype,
      eyebrow: resolveText(config?.site?.eyebrow, DEFAULT_SITE_CONFIG.eyebrow),
      headline: resolveText(config?.site?.headline, DEFAULT_SITE_CONFIG.headline),
      subheadline: resolveText(config?.site?.subheadline, DEFAULT_SITE_CONFIG.subheadline),
      primaryCtaLabel: resolveText(config?.site?.primaryCtaLabel, DEFAULT_SITE_CONFIG.primaryCtaLabel),
      primaryCtaHref: resolveText(config?.site?.primaryCtaHref, DEFAULT_SITE_CONFIG.primaryCtaHref),
      secondaryCtaLabel: resolveText(config?.site?.secondaryCtaLabel, DEFAULT_SITE_CONFIG.secondaryCtaLabel),
      secondaryCtaHref: resolveText(config?.site?.secondaryCtaHref, DEFAULT_SITE_CONFIG.secondaryCtaHref),
      docsHref: resolveText(config?.site?.docsHref, DEFAULT_SITE_CONFIG.docsHref),
      demoHref: resolveText(config?.site?.demoHref, DEFAULT_SITE_CONFIG.demoHref),
      supportEmail: resolveText(config?.site?.supportEmail, DEFAULT_SITE_CONFIG.supportEmail),
      installCommand: resolveText(config?.site?.installCommand, DEFAULT_SITE_CONFIG.installCommand)
    };
  }
  function isExternalHref(href) {
    return Boolean(href && (/^(https?:)?\/\//.test(href) || /^mailto:/.test(href)));
  }
  var desktopNavItems = ["Models", "Services", "Booking"];
  var frameNavItems = ["Models", "Services", "Booking"];
  var heroRegions = ["China", "Japan", "Korea", "Europe & US", "SE Asia"];
  var previewPortraits = [
    {
      name: "Ximena",
      region: "China",
      cities: "Shanghai / Beijing",
      mood: "Haute editorial",
      age: "27",
      height: "5\u203211\u2033",
      measurements: "34B / 24 / 35",
      badge: "Featured",
      image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1400&q=80"
    },
    {
      name: "Kenji",
      region: "Japan",
      cities: "Tokyo / Kyoto",
      mood: "Minimal tailoring",
      age: "29",
      height: "6\u20321\u2033",
      measurements: "Runway",
      image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1400&q=80"
    },
    {
      name: "Aria",
      region: "Korea",
      cities: "Seoul / Busan",
      mood: "Midnight allure",
      age: "24",
      height: "5\u20329\u2033",
      measurements: "34 / 24 / 35",
      badge: "Private Match",
      image: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=1400&q=80"
    },
    {
      name: "Soren",
      region: "Europe & US",
      cities: "Paris / Milan",
      mood: "Sharp monochrome",
      age: "31",
      height: "6\u20320\u2033",
      measurements: "Editorial",
      image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1400&q=80"
    },
    {
      name: "Mila",
      region: "Europe & US",
      cities: "Berlin / London",
      mood: "Glass skin",
      age: "25",
      height: "5\u203210\u2033",
      measurements: "33 / 23 / 34",
      image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1400&q=80"
    },
    {
      name: "Dorian",
      region: "SE Asia",
      cities: "Bangkok / Singapore",
      mood: "After-dark precision",
      age: "28",
      height: "6\u20321\u2033",
      measurements: "Campaign",
      image: "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=1400&q=80"
    }
  ];
  function findPreviewPortraitByName(name) {
    if (!name) {
      return void 0;
    }
    const normalized = name.trim().toLowerCase();
    return previewPortraits.find((portrait) => portrait.name.trim().toLowerCase() === normalized);
  }
  var conciergeSuggestions = [
    {
      name: "Elena V.",
      role: "Milan classic",
      city: "St. Moritz",
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80"
    },
    {
      name: "Julian K.",
      role: "High-fashion tailoring",
      city: "Tokyo",
      image: "https://images.unsplash.com/photo-1504257432389-52343af06ae3?auto=format&fit=crop&w=900&q=80"
    },
    {
      name: "Sasha L.",
      role: "Midnight allure",
      city: "Paris",
      image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80"
    }
  ];
  var conciergePrompts = [
    "I need someone with an editorial look for a gallery opening in Roppongi Hills.",
    "Show me couture faces in Tokyo for a night editorial shoot.",
    "I want a discreet private-event profile with runway-level polish."
  ];
  var conciergeConversation = [
    {
      role: "assistant",
      text: "Good evening. I have curated an exclusive selection of talent currently available in Tokyo for high-fashion commissions. Shall I refine by specific aesthetic or availability for next week?"
    },
    {
      role: "user",
      text: "Show me models in Tokyo for a night-time editorial shoot. High contrast, noir vibes."
    },
    {
      role: "assistant",
      text: "I suggest a Tokyo editorial shortlist led by Sasha L. for noir contrast and Elena V. for sculpted evening polish. I can narrow by budget or booking window next."
    }
  ];
  var conciergeQuickActions = [
    "Show me models in Tokyo",
    "Book Sasha V.",
    "Filter by available now"
  ];

  // src/components/CategoriesPage.tsx
  function getFallbackCategoryImage(index) {
    const fallbacks = [
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=80"
    ];
    return fallbacks[index % fallbacks.length];
  }
  var CategoriesPage = react_default.memo(function CategoriesPage2({
    categories,
    isLoading,
    error,
    onCategoryClick,
    onNavigateToHome
  }) {
    if (isLoading) {
      return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell min-h-screen" });
    }
    return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell min-h-screen px-4 pb-32 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 sm:pt-24 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1560px]", children: [
      onNavigateToHome ? /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: onNavigateToHome,
          className: "inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-copy)]",
          children: [
            /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
            "Back home"
          ]
        }
      ) : null,
      /* @__PURE__ */ jsxs("div", { className: "mt-4 xl:flex", children: [
        /* @__PURE__ */ jsxs("aside", { className: "modelsfind-frame hidden w-[16rem] shrink-0 rounded-l-[2rem] rounded-r-none border-r border-[var(--modelsfind-line)] xl:flex xl:min-h-[calc(100vh-8rem)] xl:flex-col xl:px-8 xl:py-8", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-[11px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]", children: "Region lanes" }),
            /* @__PURE__ */ jsx("h2", { className: "mt-2 [font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-[var(--modelsfind-primary)]", children: "Discovery map" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "mt-8 grid gap-2", children: heroRegions.map((region, index) => /* @__PURE__ */ jsx(
            "div",
            {
              className: [
                "rounded-[1rem] border px-4 py-4 text-[11px] uppercase tracking-[0.18em]",
                index === 0 ? "border-[var(--modelsfind-line-strong)] bg-[rgba(255,255,255,0.06)] text-[var(--modelsfind-primary)]" : "border-[var(--modelsfind-line)] text-[var(--modelsfind-copy-soft)]"
              ].join(" "),
              children: region
            },
            region
          )) }),
          /* @__PURE__ */ jsxs("div", { className: "modelsfind-panel mt-auto rounded-[1.4rem] border border-[var(--modelsfind-line)] p-5", children: [
            /* @__PURE__ */ jsx("div", { className: "inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]", children: /* @__PURE__ */ jsx(Compass, { className: "h-4 w-4" }) }),
            /* @__PURE__ */ jsx("p", { className: "mt-4 text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]", children: "Inside this page" }),
            /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]", children: "Use region lanes as the fastest way to narrow the private archive before switching into mood-driven search or direct booking." })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "min-w-0 flex-1", children: /* @__PURE__ */ jsx("div", { className: "modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] xl:rounded-l-none xl:border-l-0", children: /* @__PURE__ */ jsxs("div", { className: "p-4 md:p-6 xl:p-8", children: [
          /* @__PURE__ */ jsxs("section", { className: "modelsfind-hero overflow-hidden rounded-[1.8rem] border border-[var(--modelsfind-line)]", children: [
            /* @__PURE__ */ jsx(
              "img",
              {
                src: categories[0]?.image || getFallbackCategoryImage(0),
                alt: "Region archive",
                className: "absolute inset-0 h-full w-full object-cover grayscale opacity-40"
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "relative z-10 grid min-h-[24rem] gap-6 px-6 pb-8 pt-10 md:px-10 md:pb-10 md:pt-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end", children: [
              /* @__PURE__ */ jsxs("div", { className: "max-w-[40rem]", children: [
                /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]", children: [
                  /* @__PURE__ */ jsx(Compass, { className: "h-4 w-4" }),
                  "Region archive"
                ] }),
                /* @__PURE__ */ jsx("h1", { className: "mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.9rem,6vw,5.2rem)] leading-[0.92] tracking-[-0.05em] text-white", children: "Browse the private archive by region and curation lane." }),
                /* @__PURE__ */ jsx("p", { className: "mt-4 max-w-[34rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: "This page behaves like a mobile-first routing map: lead with region, then hand off to the tighter directory or concierge flow." })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "modelsfind-panel rounded-[1.5rem] border border-[var(--modelsfind-line)] p-5", children: [
                /* @__PURE__ */ jsx("p", { className: "text-[9px] uppercase tracking-[0.2em] text-[var(--modelsfind-copy-soft)]", children: "Available lanes" }),
                /* @__PURE__ */ jsx("p", { className: "mt-2 [font-family:var(--modelsfind-display)] text-[2.4rem] leading-none tracking-[-0.04em] text-white", children: categories.length }),
                /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]", children: "Region-led entry points tuned for operators who need to move from browse to shortlist without losing the editorial mood." })
              ] })
            ] })
          ] }),
          error ? /* @__PURE__ */ jsx("div", { className: "mt-6 rounded-[1.4rem] border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-200", children: error }) : null,
          /* @__PURE__ */ jsxs("section", { className: "mt-8", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-4", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]", children: "Navigation lanes" }),
                /* @__PURE__ */ jsx("h2", { className: "[font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white", children: "Region-led entry points" })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "hidden items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)] md:flex", children: [
                /* @__PURE__ */ jsx(Sparkles, { className: "h-4 w-4 text-[var(--modelsfind-primary)]" }),
                "Mobile-first routing"
              ] })
            ] }),
            categories.length === 0 ? /* @__PURE__ */ jsx("div", { className: "mt-6 rounded-[1.6rem] border border-dashed border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.02)] p-16 text-center text-[var(--modelsfind-copy)]", children: "No regions available yet." }) : /* @__PURE__ */ jsx("div", { className: "mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3", children: categories.map((category, index) => /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => onCategoryClick(category.id),
                className: "group overflow-hidden rounded-[1.5rem] border border-[var(--modelsfind-line)] bg-[rgba(20,16,24,0.92)] text-left transition-transform duration-500 hover:-translate-y-1",
                children: [
                  /* @__PURE__ */ jsxs("div", { className: "relative aspect-[1.05] overflow-hidden", children: [
                    /* @__PURE__ */ jsx(
                      "img",
                      {
                        src: category.image || getFallbackCategoryImage(index),
                        alt: category.name,
                        className: "h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-[1.05] group-hover:grayscale-0"
                      }
                    ),
                    /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[linear-gradient(180deg,rgba(8,7,10,0.08),rgba(8,7,10,0.86))]" }),
                    /* @__PURE__ */ jsxs("div", { className: "absolute left-4 right-4 top-4 flex items-center justify-between gap-3", children: [
                      /* @__PURE__ */ jsxs("span", { className: "rounded-full border border-[var(--modelsfind-line-strong)] bg-[rgba(15,12,18,0.7)] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-primary)]", children: [
                        category.productCount,
                        " profiles"
                      ] }),
                      category.featured ? /* @__PURE__ */ jsx("span", { className: "rounded-full bg-[var(--modelsfind-primary-soft)] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--modelsfind-primary)]", children: "Featured" }) : null
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "absolute bottom-0 left-0 right-0 p-4", children: [
                      /* @__PURE__ */ jsxs("p", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: [
                        "Region lane ",
                        String(index + 1).padStart(2, "0")
                      ] }),
                      /* @__PURE__ */ jsx("h3", { className: "mt-2 [font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white", children: category.name })
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "p-4", children: [
                    /* @__PURE__ */ jsx("p", { className: "text-sm leading-7 text-[var(--modelsfind-copy)]", children: category.description || "Browse a tighter lane of the private archive with cleaner editorial grouping." }),
                    /* @__PURE__ */ jsxs("div", { className: "mt-4 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--modelsfind-copy)] transition-colors group-hover:text-[var(--modelsfind-primary)]", children: [
                      "Open lane",
                      /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" })
                    ] })
                  ] })
                ]
              },
              category.id
            )) })
          ] }),
          /* @__PURE__ */ jsxs("section", { className: "mt-8 rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-5", children: [
            /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]", children: [
              /* @__PURE__ */ jsx(WandSparkles, { className: "h-4 w-4" }),
              "Concierge prompts"
            ] }),
            /* @__PURE__ */ jsx("p", { className: "mt-3 max-w-[38rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: "Borrowing from the mobile AI concierge board, these quick phrases can later become tappable filters or pre-filled assistant prompts." }),
            /* @__PURE__ */ jsx("div", { className: "mt-5 flex flex-wrap gap-2", children: conciergePrompts.map((prompt) => /* @__PURE__ */ jsx(
              "div",
              {
                className: "rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-[var(--modelsfind-copy)]",
                children: prompt
              },
              prompt
            )) })
          ] })
        ] }) }) })
      ] })
    ] }) });
  });

  // src/components/CheckoutPage.tsx
  var CheckoutPage = react_default.memo(function CheckoutPage2({
    cart,
    isLoading,
    isProcessing,
    requireShippingAddress,
    countriesRequireStatePostal,
    currentUserEmail,
    availablePaymentMethods,
    onSubmit,
    onBack
  }) {
    const paymentMethods = react_default.useMemo(
      () => availablePaymentMethods || [{ name: "card", displayName: "Credit or Debit Card" }],
      [availablePaymentMethods]
    );
    const { selectedItems, selectedSubtotal, selectedTax, selectedShipping, selectedDiscount } = getCartSelection(cart);
    const total = Number((selectedSubtotal + selectedTax + selectedShipping - selectedDiscount).toFixed(2));
    const leadItem = selectedItems[0] || cart.items[0];
    const leadPortrait = findPreviewPortraitByName(leadItem?.productName) || previewPortraits[1];
    const reservationDate = new Date(cart.updatedAt || Date.now()).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric"
    });
    const [formData, setFormData] = react_default.useState({
      email: currentUserEmail || "",
      firstName: "",
      lastName: "",
      phone: "",
      addressLine1: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      paymentMethod: paymentMethods[0]?.name || "card"
    });
    const [errors, setErrors] = react_default.useState({});
    react_default.useEffect(() => {
      if (!currentUserEmail) {
        return;
      }
      setFormData((prev) => prev.email ? prev : { ...prev, email: currentUserEmail });
    }, [currentUserEmail]);
    const needsShipping = Boolean(
      requireShippingAddress || [
        formData.firstName,
        formData.lastName,
        formData.phone,
        formData.addressLine1,
        formData.city,
        formData.state,
        formData.postalCode,
        formData.country
      ].some((value) => value.trim())
    );
    const postalSet = react_default.useMemo(() => {
      const source = countriesRequireStatePostal?.length ? countriesRequireStatePostal : ["US", "CA", "AU", "CN", "GB"];
      return new Set(source.map((item) => item.trim().toUpperCase()).map((item) => item === "UK" ? "GB" : item));
    }, [countriesRequireStatePostal]);
    const normalizedCountry = formData.country.trim().toUpperCase() === "UK" ? "GB" : formData.country.trim().toUpperCase();
    const needsStatePostal = needsShipping && postalSet.has(normalizedCountry);
    const updateField = (key, value) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
      if (errors[key]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    };
    const validate = () => {
      const nextErrors = {};
      if (!formData.email.trim()) nextErrors.email = "Required";
      else if (!/\S+@\S+\.\S+/.test(formData.email)) nextErrors.email = "Invalid email";
      if (!formData.firstName.trim()) nextErrors.firstName = "Required";
      if (!formData.lastName.trim()) nextErrors.lastName = "Required";
      if (!formData.phone.trim()) nextErrors.phone = "Required";
      if (needsShipping) {
        if (!formData.addressLine1.trim()) nextErrors.addressLine1 = "Required";
        if (!formData.city.trim()) nextErrors.city = "Required";
        if (!formData.country.trim()) nextErrors.country = "Required";
        if (needsStatePostal && !formData.state.trim()) nextErrors.state = "Required";
        if (needsStatePostal && !formData.postalCode.trim()) nextErrors.postalCode = "Required";
      }
      setErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    };
    const handleSubmit = async (event) => {
      event.preventDefault();
      if (!validate()) {
        return;
      }
      await onSubmit(formData);
    };
    if (isLoading) {
      return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell flex min-h-screen items-center justify-center [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]", children: /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
        /* @__PURE__ */ jsx(Sparkles, { className: "mx-auto h-12 w-12 animate-pulse text-[var(--modelsfind-primary)]" }),
        /* @__PURE__ */ jsx("p", { className: "mt-4 text-[11px] uppercase tracking-[0.28em] text-[var(--modelsfind-copy-soft)]", children: "Preparing checkout" })
      ] }) });
    }
    return /* @__PURE__ */ jsxs("div", { className: "modelsfind-shell min-h-screen px-4 pb-20 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 sm:pt-24 lg:px-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[28rem] md:hidden", children: [
        /* @__PURE__ */ jsxs("header", { className: "modelsfind-mobile-topbar fixed inset-x-0 top-0 z-[78] flex h-16 items-center justify-between px-6", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: onBack,
                className: "text-[var(--modelsfind-copy-soft)]",
                children: /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" })
              }
            ),
            /* @__PURE__ */ jsx("h1", { className: "[font-family:var(--modelsfind-display)] text-[1.1rem] italic uppercase tracking-[0.16em] text-white", children: "modelsfind" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "h-10 w-10 overflow-hidden rounded-full border border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)]", children: /* @__PURE__ */ jsx("img", { src: leadPortrait.image, alt: leadPortrait.name, className: "h-full w-full object-cover" }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-8", children: [
          /* @__PURE__ */ jsxs("section", { className: "relative", children: [
            /* @__PURE__ */ jsx("div", { className: "absolute -left-4 -top-4 h-28 w-28 rounded-full bg-[var(--modelsfind-primary-soft)] blur-3xl" }),
            /* @__PURE__ */ jsxs("div", { className: "relative z-10 flex items-end gap-4", children: [
              /* @__PURE__ */ jsx("div", { className: "h-36 w-24 rotate-[-2deg] overflow-hidden rounded-[1rem] shadow-2xl", children: /* @__PURE__ */ jsx(
                "img",
                {
                  src: leadItem?.productImage || leadPortrait.image,
                  alt: leadItem?.productName || leadPortrait.name,
                  className: "h-full w-full object-cover"
                }
              ) }),
              /* @__PURE__ */ jsxs("div", { className: "flex-1 pb-2", children: [
                /* @__PURE__ */ jsx("span", { className: "block text-[10px] uppercase tracking-[0.2rem] text-[var(--modelsfind-primary)]", children: "Booking selection" }),
                /* @__PURE__ */ jsx("h2", { className: "[font-family:var(--modelsfind-display)] text-[2rem] italic leading-none text-white", children: leadItem?.productName || leadPortrait.name }),
                /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-[var(--modelsfind-copy-soft)]", children: leadPortrait.cities || leadPortrait.region })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "mt-5 rounded-[1.4rem] border-l-2 border-[var(--modelsfind-primary)]/30 bg-[rgba(18,16,22,0.92)] p-5", children: [
              /* @__PURE__ */ jsxs("div", { className: "mb-4 flex items-center justify-between gap-4", children: [
                /* @__PURE__ */ jsx("span", { className: "text-[11px] uppercase tracking-[0.16rem] text-[var(--modelsfind-copy-soft)]", children: "Schedule" }),
                /* @__PURE__ */ jsx("span", { className: "text-sm font-semibold text-white", children: reservationDate })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "mb-4 flex items-center justify-between gap-4", children: [
                /* @__PURE__ */ jsx("span", { className: "text-[11px] uppercase tracking-[0.16rem] text-[var(--modelsfind-copy-soft)]", children: "Experience" }),
                /* @__PURE__ */ jsx("span", { className: "text-sm font-semibold text-white", children: leadItem?.variantName || leadPortrait.mood })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-4 border-t border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] pt-4", children: [
                /* @__PURE__ */ jsx("span", { className: "text-[11px] uppercase tracking-[0.16rem] text-[var(--modelsfind-copy-soft)]", children: "Total investment" }),
                /* @__PURE__ */ jsx("span", { className: "[font-family:var(--modelsfind-display)] text-[2rem] tracking-[-0.04em] text-[var(--modelsfind-primary)]", children: formatMoneyPrecise(total) })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("section", { className: "space-y-5", children: [
            /* @__PURE__ */ jsx("h3", { className: "[font-family:var(--modelsfind-display)] text-[1.4rem] text-white", children: "Payment Method" }),
            /* @__PURE__ */ jsx("div", { className: "grid gap-4", children: paymentMethods.map((method) => {
              const lowerName = method.name.toLowerCase();
              const isCard = lowerName.includes("card") || lowerName.includes("stripe");
              const Icon2 = isCard ? CreditCard : Wallet;
              const active = formData.paymentMethod === method.name;
              return /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => updateField("paymentMethod", method.name),
                  className: [
                    "rounded-[1.2rem] border px-5 py-5 text-left transition-all duration-300",
                    active ? "border-[var(--modelsfind-line-strong)] bg-[rgba(31,29,36,0.92)]" : "border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] bg-[rgba(23,22,26,0.88)]"
                  ].join(" "),
                  children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-4", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
                      /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)]", children: /* @__PURE__ */ jsx(Icon2, { className: "h-5 w-5 text-white" }) }),
                      /* @__PURE__ */ jsxs("div", { children: [
                        /* @__PURE__ */ jsx("p", { className: "font-semibold text-white", children: method.displayName }),
                        /* @__PURE__ */ jsx("p", { className: "text-xs text-[var(--modelsfind-copy-soft)]", children: isCard ? "Visa, Mastercard, Amex" : "BTC, ETH, USDT (ERC20)" })
                      ] })
                    ] }),
                    /* @__PURE__ */ jsx("div", { className: active ? "flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--modelsfind-primary)]" : "flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--modelsfind-copy-soft)]/40", children: /* @__PURE__ */ jsx("div", { className: active ? "h-2.5 w-2.5 rounded-full bg-[var(--modelsfind-primary)]" : "h-2.5 w-2.5 rounded-full bg-transparent" }) })
                  ] })
                },
                method.name
              );
            }) })
          ] }),
          /* @__PURE__ */ jsx("section", { className: "space-y-4", children: /* @__PURE__ */ jsx("div", { className: "grid gap-4", children: [
            ["email", "Email", "email"],
            ["firstName", "First name", "text"],
            ["lastName", "Last name", "text"],
            ["phone", "Phone", "text"]
          ].map(([key, label, type]) => {
            const name = key;
            return /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.12rem] text-[var(--modelsfind-copy-soft)]", children: label }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type,
                  value: formData[name],
                  onChange: (event) => updateField(name, event.target.value),
                  className: "modelsfind-field h-12 border-0 border-b border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] bg-transparent px-0 text-sm text-[var(--modelsfind-ink)]"
                }
              ),
              errors[key] ? /* @__PURE__ */ jsx("span", { className: "text-xs text-red-300", children: errors[key] }) : null
            ] }, key);
          }) }) }),
          needsShipping ? /* @__PURE__ */ jsxs("section", { className: "space-y-4", children: [
            /* @__PURE__ */ jsx("h3", { className: "[font-family:var(--modelsfind-display)] text-[1.25rem] text-white", children: "Reservation venue" }),
            /* @__PURE__ */ jsx("div", { className: "grid gap-4", children: [
              { key: "addressLine1", label: "Address", type: "text", hidden: false },
              { key: "city", label: "City", type: "text", hidden: false },
              { key: "country", label: "Country", type: "text", hidden: false },
              { key: "state", label: "State", type: "text", hidden: !needsStatePostal },
              { key: "postalCode", label: "Postal code", type: "text", hidden: !needsStatePostal }
            ].map((field) => {
              if (field.hidden) {
                return null;
              }
              const name = field.key;
              return /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
                /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.12rem] text-[var(--modelsfind-copy-soft)]", children: field.label }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: field.type,
                    value: formData[name],
                    onChange: (event) => updateField(name, event.target.value),
                    className: "modelsfind-field h-12 border-0 border-b border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] bg-transparent px-0 text-sm text-[var(--modelsfind-ink)]"
                  }
                ),
                errors[field.key] ? /* @__PURE__ */ jsx("span", { className: "text-xs text-red-300", children: errors[field.key] }) : null
              ] }, field.key);
            }) })
          ] }) : null,
          /* @__PURE__ */ jsxs("div", { className: "mb-8 flex items-start gap-3 px-2", children: [
            /* @__PURE__ */ jsx(ShieldCheck, { className: "mt-0.5 h-4 w-4 text-[var(--modelsfind-primary)]" }),
            /* @__PURE__ */ jsx("p", { className: "text-[11px] uppercase leading-relaxed tracking-[0.12rem] text-[var(--modelsfind-copy-soft)]", children: "Encryption protocol active. Your transaction is secured via 256-bit AES vault. Modelsfind does not store primary card data." })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "fixed bottom-8 left-4 right-4 z-[110]", children: /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => {
              if (!validate()) {
                return;
              }
              void onSubmit(formData);
            },
            disabled: isProcessing,
            className: "modelsfind-mobile-cta inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-bold uppercase tracking-[0.2em] text-[#210025] disabled:opacity-60",
            children: isProcessing ? "Processing..." : "Complete secure booking"
          }
        ) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mx-auto hidden max-w-[1240px] md:block", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: onBack,
              className: "inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] text-[var(--modelsfind-copy)]",
              children: /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" })
            }
          ),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]", children: "ModelsFind" }),
            /* @__PURE__ */ jsx("h1", { className: "[font-family:var(--modelsfind-display)] text-[2.5rem] italic leading-none tracking-[-0.04em] text-white", children: "Confirm Booking" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start", children: [
          /* @__PURE__ */ jsxs(
            "form",
            {
              onSubmit: handleSubmit,
              className: "modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] bg-[rgba(10,8,12,0.96)] p-4 md:p-6 xl:p-8",
              children: [
                /* @__PURE__ */ jsx("section", { className: "overflow-hidden rounded-[1.55rem] border border-[var(--modelsfind-line)] bg-[linear-gradient(180deg,rgba(18,15,22,0.95),rgba(12,10,16,0.96))]", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-4 p-5 md:grid-cols-[7rem_minmax(0,1fr)] md:p-6", children: [
                  /* @__PURE__ */ jsx(
                    "img",
                    {
                      src: leadItem?.productImage || leadPortrait.image,
                      alt: leadItem?.productName || leadPortrait.name,
                      className: "h-28 w-full rounded-[1.1rem] object-cover grayscale md:h-full md:min-h-[8rem]"
                    }
                  ),
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("span", { className: "block text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]", children: "Booking Selection" }),
                    /* @__PURE__ */ jsx("h2", { className: "mt-2 [font-family:var(--modelsfind-display)] text-[2.2rem] italic leading-none text-white", children: leadItem?.productName || leadPortrait.name }),
                    /* @__PURE__ */ jsxs("div", { className: "mt-5 grid gap-3 text-sm text-[var(--modelsfind-copy)] sm:grid-cols-3", children: [
                      /* @__PURE__ */ jsxs("div", { children: [
                        /* @__PURE__ */ jsx("p", { className: "text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Schedule" }),
                        /* @__PURE__ */ jsx("p", { className: "mt-2 text-white", children: reservationDate })
                      ] }),
                      /* @__PURE__ */ jsxs("div", { children: [
                        /* @__PURE__ */ jsx("p", { className: "text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Experience" }),
                        /* @__PURE__ */ jsx("p", { className: "mt-2 text-white", children: leadItem?.variantName || leadPortrait.mood })
                      ] }),
                      /* @__PURE__ */ jsxs("div", { children: [
                        /* @__PURE__ */ jsx("p", { className: "text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Total investment" }),
                        /* @__PURE__ */ jsx("p", { className: "mt-2 text-[var(--modelsfind-primary)]", children: formatMoneyPrecise(total) })
                      ] })
                    ] })
                  ] })
                ] }) }),
                /* @__PURE__ */ jsxs("section", { className: "mt-6 rounded-[1.55rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-5 md:p-6", children: [
                  /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]", children: [
                    /* @__PURE__ */ jsx(Wallet, { className: "h-4 w-4" }),
                    "Payment Method"
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: "mt-5 grid gap-3", children: paymentMethods.map((method) => {
                    const lowerName = method.name.toLowerCase();
                    const isCard = lowerName.includes("card") || lowerName.includes("stripe");
                    const Icon2 = isCard ? CreditCard : Wallet;
                    const active = formData.paymentMethod === method.name;
                    return /* @__PURE__ */ jsxs(
                      "button",
                      {
                        type: "button",
                        onClick: () => updateField("paymentMethod", method.name),
                        className: [
                          "flex items-center gap-4 rounded-[1.2rem] border px-4 py-4 text-left transition-colors",
                          active ? "border-[var(--modelsfind-line-strong)] bg-[rgba(255,255,255,0.08)]" : "border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)]"
                        ].join(" "),
                        children: [
                          /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]", children: /* @__PURE__ */ jsx(Icon2, { className: "h-5 w-5" }) }),
                          /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                            /* @__PURE__ */ jsx("p", { className: "font-semibold text-white", children: method.displayName }),
                            /* @__PURE__ */ jsx("p", { className: "mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: isCard ? "Visa \xB7 Mastercard \xB7 Amex" : "Discreet settlement" })
                          ] }),
                          /* @__PURE__ */ jsx(
                            "div",
                            {
                              className: [
                                "h-5 w-5 rounded-full border",
                                active ? "border-[var(--modelsfind-primary)] bg-[var(--modelsfind-primary)]" : "border-[var(--modelsfind-line)]"
                              ].join(" ")
                            }
                          )
                        ]
                      },
                      method.name
                    );
                  }) })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]", children: [
                  /* @__PURE__ */ jsxs("section", { className: "rounded-[1.55rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-5 md:p-6", children: [
                    /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]", children: [
                      /* @__PURE__ */ jsx(ShieldCheck, { className: "h-4 w-4" }),
                      "Client Details"
                    ] }),
                    /* @__PURE__ */ jsx("div", { className: "mt-5 grid gap-4", children: [
                      ["email", "Email", "email"],
                      ["firstName", "First name", "text"],
                      ["lastName", "Last name", "text"],
                      ["phone", "Phone", "text"]
                    ].map(([key, label, type]) => {
                      const name = key;
                      return /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
                        /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: label }),
                        /* @__PURE__ */ jsx(
                          "input",
                          {
                            type,
                            value: formData[name],
                            onChange: (event) => updateField(name, event.target.value),
                            className: "modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)]"
                          }
                        ),
                        errors[key] ? /* @__PURE__ */ jsx("span", { className: "text-xs text-red-300", children: errors[key] }) : null
                      ] }, key);
                    }) })
                  ] }),
                  /* @__PURE__ */ jsxs("section", { className: "rounded-[1.55rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-5 md:p-6", children: [
                    /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]", children: [
                      /* @__PURE__ */ jsx(ShieldCheck, { className: "h-4 w-4" }),
                      "Reservation Venue"
                    ] }),
                    /* @__PURE__ */ jsx("div", { className: "mt-5 grid gap-4", children: [
                      { key: "addressLine1", label: "Address", type: "text", hidden: false },
                      { key: "city", label: "City", type: "text", hidden: false },
                      { key: "country", label: "Country", type: "text", hidden: false },
                      { key: "state", label: "State", type: "text", hidden: !needsStatePostal },
                      { key: "postalCode", label: "Postal code", type: "text", hidden: !needsStatePostal }
                    ].map((field) => {
                      if (field.hidden) {
                        return null;
                      }
                      const name = field.key;
                      return /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
                        /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: field.label }),
                        /* @__PURE__ */ jsx(
                          "input",
                          {
                            type: field.type,
                            value: formData[name],
                            onChange: (event) => updateField(name, event.target.value),
                            className: "modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)]"
                          }
                        ),
                        errors[field.key] ? /* @__PURE__ */ jsx("span", { className: "text-xs text-red-300", children: errors[field.key] }) : null
                      ] }, field.key);
                    }) })
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "mt-6 flex flex-col gap-4 border-t border-[var(--modelsfind-line)] pt-5", children: [
                  /* @__PURE__ */ jsx("p", { className: "text-[11px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Authorized transaction portal" }),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "submit",
                      disabled: isProcessing,
                      className: "inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)] disabled:opacity-60",
                      children: isProcessing ? "Processing..." : "Complete secure booking"
                    }
                  )
                ] })
              ]
            }
          ),
          /* @__PURE__ */ jsxs("aside", { className: "modelsfind-panel rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(12,10,16,0.94)] p-5 xl:sticky xl:top-[6rem]", children: [
            /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]", children: [
              /* @__PURE__ */ jsx(ShieldCheck, { className: "h-4 w-4" }),
              "Booking Summary"
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "mt-4 rounded-[1.2rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-4", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                /* @__PURE__ */ jsx(
                  "img",
                  {
                    src: leadItem?.productImage || leadPortrait.image,
                    alt: leadItem?.productName || leadPortrait.name,
                    className: "h-14 w-14 rounded-[0.95rem] object-cover grayscale"
                  }
                ),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("p", { className: "[font-family:var(--modelsfind-display)] text-[1.6rem] leading-none text-white", children: leadItem?.productName || leadPortrait.name }),
                  /* @__PURE__ */ jsx("p", { className: "mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: leadItem?.variantName || leadPortrait.mood })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "mt-5 space-y-3 text-sm", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex justify-between gap-4 text-[var(--modelsfind-copy)]", children: [
                  /* @__PURE__ */ jsx("span", { children: "Subtotal" }),
                  /* @__PURE__ */ jsx("span", { className: "text-white", children: formatMoneyPrecise(selectedSubtotal) })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex justify-between gap-4 text-[var(--modelsfind-copy)]", children: [
                  /* @__PURE__ */ jsx("span", { children: "Tax" }),
                  /* @__PURE__ */ jsx("span", { className: "text-white", children: formatMoneyPrecise(selectedTax) })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex justify-between gap-4 text-[var(--modelsfind-copy)]", children: [
                  /* @__PURE__ */ jsx("span", { children: "Shipping" }),
                  /* @__PURE__ */ jsx("span", { className: "text-white", children: selectedShipping === 0 ? "Included" : formatMoneyPrecise(selectedShipping) })
                ] }),
                selectedDiscount > 0 ? /* @__PURE__ */ jsxs("div", { className: "flex justify-between gap-4 text-emerald-200", children: [
                  /* @__PURE__ */ jsx("span", { children: "Discount" }),
                  /* @__PURE__ */ jsxs("span", { children: [
                    "-",
                    formatMoneyPrecise(selectedDiscount)
                  ] })
                ] }) : null,
                /* @__PURE__ */ jsxs("div", { className: "flex justify-between gap-4 border-t border-[var(--modelsfind-line)] pt-3 text-base", children: [
                  /* @__PURE__ */ jsx("span", { className: "font-semibold text-white", children: "Total" }),
                  /* @__PURE__ */ jsx("span", { className: "font-semibold text-[var(--modelsfind-primary)]", children: formatMoneyPrecise(total) })
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "mt-5 rounded-[1.2rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-4", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Private assurance" }),
              /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]", children: "Payment and reservation data remain contained in the same discreet booking flow, with operator follow-up after confirmation." })
            ] })
          ] })
        ] })
      ] })
    ] });
  });

  // src/components/CollectionPages.tsx
  function getProductImage(product) {
    const mainImage = product.images?.find((image) => image.isMain) || product.images?.[0];
    return mainImage?.url || previewPortraits[0].image;
  }
  function getProductSubtitle(product) {
    return product.tags?.slice(0, 2).join(" \u2022 ") || "Editorial profile";
  }
  function ArchiveCollection({
    products,
    isLoading,
    title,
    description,
    eyebrow,
    config,
    onProductClick
  }) {
    const site = resolveModelsfindSiteConfig(config);
    if (isLoading) {
      return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell min-h-screen" });
    }
    return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell min-h-screen px-4 pb-32 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 sm:pt-24 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1560px] xl:flex", children: [
      /* @__PURE__ */ jsxs("aside", { className: "modelsfind-frame hidden w-[16rem] shrink-0 rounded-l-[2rem] rounded-r-none border-r border-[var(--modelsfind-line)] xl:flex xl:min-h-[calc(100vh-8rem)] xl:flex-col xl:px-8 xl:py-8", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-[11px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]", children: "Collection lane" }),
          /* @__PURE__ */ jsx("h2", { className: "mt-2 [font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-[var(--modelsfind-primary)]", children: eyebrow })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "modelsfind-panel mt-8 rounded-[1.4rem] border border-[var(--modelsfind-line)] p-5", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]", children: "Profiles in lane" }),
          /* @__PURE__ */ jsx("p", { className: "mt-3 [font-family:var(--modelsfind-display)] text-[3rem] leading-none tracking-[-0.05em] text-white", children: products.length }),
          /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm leading-6 text-[var(--modelsfind-copy)]", children: "This lane stays visually aligned with the main directory, but narrows the story to one editorial angle." })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "modelsfind-panel mt-auto rounded-[1.4rem] border border-[var(--modelsfind-line)] p-5", children: [
          /* @__PURE__ */ jsx("div", { className: "inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]", children: /* @__PURE__ */ jsx(WandSparkles, { className: "h-4 w-4" }) }),
          /* @__PURE__ */ jsx("p", { className: "mt-4 text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]", children: "Lane note" }),
          /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]", children: "These secondary pages should still feel like part of the same mobile-and-desktop system, not a detached archive microsite." })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "min-w-0 flex-1", children: /* @__PURE__ */ jsx("div", { className: "modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] xl:rounded-l-none xl:border-l-0", children: /* @__PURE__ */ jsxs("div", { className: "p-4 md:p-6 xl:p-8", children: [
        /* @__PURE__ */ jsxs("section", { className: "modelsfind-hero overflow-hidden rounded-[1.8rem] border border-[var(--modelsfind-line)]", children: [
          /* @__PURE__ */ jsx(
            "img",
            {
              src: products[0] ? getProductImage(products[0]) : previewPortraits[0].image,
              alt: title,
              className: "absolute inset-0 h-full w-full object-cover grayscale opacity-40"
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "relative z-10 grid min-h-[24rem] gap-6 px-6 pb-8 pt-10 md:px-10 md:pb-10 md:pt-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end", children: [
            /* @__PURE__ */ jsxs("div", { className: "max-w-[40rem]", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.32em] text-[var(--modelsfind-primary)]", children: eyebrow }),
              /* @__PURE__ */ jsx("h1", { className: "mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.8rem,6vw,5rem)] leading-[0.92] tracking-[-0.05em] text-white", children: title }),
              /* @__PURE__ */ jsx("p", { className: "mt-4 max-w-[34rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: description })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "modelsfind-panel rounded-[1.5rem] border border-[var(--modelsfind-line)] p-5", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[9px] uppercase tracking-[0.2em] text-[var(--modelsfind-copy-soft)]", children: "Brand voice" }),
              /* @__PURE__ */ jsx("p", { className: "mt-2 [font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white", children: site.brandName }),
              /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]", children: "Editorial search, private access, and quiet luxury remain intact even when the page narrows to a single lane." })
            ] })
          ] })
        ] }),
        products.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "mt-6 rounded-[1.8rem] border border-dashed border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-6 py-16 text-center", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]", children: "This lane is empty" }),
          /* @__PURE__ */ jsx("h2", { className: "mt-4 [font-family:var(--modelsfind-display)] text-[2.6rem] leading-none tracking-[-0.04em] text-white", children: "Nothing is staged here yet." }),
          /* @__PURE__ */ jsx("p", { className: "mx-auto mt-4 max-w-[28rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: "Keep the empty state editorial and restrained rather than dropping back to a generic placeholder." })
        ] }) : /* @__PURE__ */ jsxs("section", { className: "mt-8", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 border-b border-[var(--modelsfind-line)] pb-6 md:flex-row md:items-end md:justify-between", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]", children: "Profiles" }),
              /* @__PURE__ */ jsx("h2", { className: "[font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white", children: "Styled like a focused shortlist" })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "hidden items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)] md:flex", children: [
              /* @__PURE__ */ jsx(Sparkles, { className: "h-4 w-4 text-[var(--modelsfind-primary)]" }),
              "Mobile and desktop aligned"
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "mt-6 grid gap-5 md:grid-cols-2 2xl:grid-cols-3", children: products.map((product, index) => /* @__PURE__ */ jsxs(
            "article",
            {
              className: [
                "group overflow-hidden rounded-[1.5rem] border border-[var(--modelsfind-line)] bg-[rgba(20,16,24,0.92)] transition-transform duration-500 hover:-translate-y-1",
                index % 2 === 1 ? "md:translate-y-6" : ""
              ].join(" "),
              children: [
                /* @__PURE__ */ jsx("button", { type: "button", onClick: () => onProductClick(product.id), className: "block w-full text-left", children: /* @__PURE__ */ jsxs("div", { className: "relative aspect-[0.78] overflow-hidden", children: [
                  /* @__PURE__ */ jsx(
                    "img",
                    {
                      src: getProductImage(product),
                      alt: product.name,
                      className: "h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-[1.04] group-hover:grayscale-0"
                    }
                  ),
                  /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[linear-gradient(180deg,rgba(8,7,10,0.08),rgba(8,7,10,0.84))]" }),
                  /* @__PURE__ */ jsxs("div", { className: "absolute left-4 right-4 top-4 flex items-center justify-between gap-3", children: [
                    /* @__PURE__ */ jsx("span", { className: "rounded-full border border-[var(--modelsfind-line-strong)] bg-[rgba(15,12,18,0.7)] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-primary)]", children: eyebrow }),
                    /* @__PURE__ */ jsx(Heart, { className: "h-4 w-4 text-[var(--modelsfind-primary)] opacity-70 transition-opacity group-hover:opacity-100" })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "absolute bottom-0 left-0 right-0 p-4", children: [
                    /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: getProductSubtitle(product) }),
                    /* @__PURE__ */ jsx("h3", { className: "mt-2 [font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white", children: product.name })
                  ] })
                ] }) }),
                /* @__PURE__ */ jsxs("div", { className: "p-4", children: [
                  /* @__PURE__ */ jsx("p", { className: "text-sm leading-7 text-[var(--modelsfind-copy)]", children: product.description || "Curated profile presented for a tighter archive lane with the same cinematic browse language." }),
                  /* @__PURE__ */ jsxs(
                    "button",
                    {
                      type: "button",
                      onClick: () => onProductClick(product.id),
                      className: "mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--modelsfind-ink)] transition-colors hover:border-[var(--modelsfind-primary)] hover:bg-[var(--modelsfind-primary)] hover:text-[#140d16]",
                      children: [
                        "View profile",
                        /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4" })
                      ]
                    }
                  )
                ] })
              ]
            },
            product.id
          )) })
        ] }),
        /* @__PURE__ */ jsxs("section", { className: "mt-8 rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-5", children: [
          /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]", children: [
            /* @__PURE__ */ jsx(WandSparkles, { className: "h-4 w-4" }),
            "Concierge follow-ups"
          ] }),
          /* @__PURE__ */ jsx("p", { className: "mt-3 max-w-[38rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: "Quick prompts borrowed from the AI concierge mobile draft. These can become future shortcuts on curated collection pages too." }),
          /* @__PURE__ */ jsx("div", { className: "mt-5 flex flex-wrap gap-2", children: conciergePrompts.map((prompt) => /* @__PURE__ */ jsx(
            "div",
            {
              className: "rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-[var(--modelsfind-copy)]",
              children: prompt
            },
            prompt
          )) })
        ] })
      ] }) }) })
    ] }) });
  }
  var BestsellersPage = react_default.memo(function BestsellersPage2(props) {
    return /* @__PURE__ */ jsx(
      ArchiveCollection,
      {
        products: props.products,
        isLoading: props.isLoading,
        title: "Most-saved portrait profiles in the current private archive.",
        description: "This lane surfaces the editorial sets operators shortlist most often when curating featured boards.",
        eyebrow: "Editor picks",
        config: props.config,
        onProductClick: props.onProductClick
      }
    );
  });
  var NewArrivalsPage = react_default.memo(function NewArrivalsPage2(props) {
    return /* @__PURE__ */ jsx(
      ArchiveCollection,
      {
        products: props.products,
        isLoading: props.isLoading,
        title: "Fresh arrivals added to the archive this cycle.",
        description: "Use new arrivals to review recently added portrait sets before they are grouped into broader curated boards.",
        eyebrow: "New arrivals",
        config: props.config,
        onProductClick: props.onProductClick
      }
    );
  });
  var DealsPage = react_default.memo(function DealsPage2(props) {
    return /* @__PURE__ */ jsx(
      ArchiveCollection,
      {
        products: props.products,
        isLoading: props.isLoading,
        title: "Private bundles, highlighted boards, and limited-access offers.",
        description: "Use this view when the archive needs a promotional lane without breaking the darker editorial mood.",
        eyebrow: "Featured offers",
        config: props.config,
        onProductClick: props.onProductClick
      }
    );
  });
  var SearchPage = react_default.memo(function SearchPage2(props) {
    return /* @__PURE__ */ jsx(
      ArchiveCollection,
      {
        products: props.products,
        isLoading: props.isLoading,
        title: `Results for \u201C${props.searchQuery || "archive search"}\u201D`,
        description: "Search stays framed like an editorial directory so operators can narrow results without losing category context.",
        eyebrow: "Search",
        config: props.config,
        onProductClick: props.onProductClick
      }
    );
  });

  // src/components/ContactPage.tsx
  var ContactPage = react_default.memo(function ContactPage2({ onSubmitForm }) {
    const [formData, setFormData] = react_default.useState({
      name: "",
      email: "",
      subject: "",
      message: ""
    });
    const [isSubmitting, setIsSubmitting] = react_default.useState(false);
    const [status, setStatus] = react_default.useState(null);
    const [submitError, setSubmitError] = react_default.useState(null);
    const canSubmit = Boolean(
      formData.name.trim() && formData.email.trim() && formData.subject.trim() && formData.message.trim()
    );
    const handleSubmit = async (event) => {
      event.preventDefault();
      if (!canSubmit) return;
      setIsSubmitting(true);
      setStatus(null);
      setSubmitError(null);
      try {
        await onSubmitForm({
          name: formData.name.trim(),
          email: formData.email.trim(),
          subject: formData.subject.trim(),
          message: formData.message.trim()
        });
        setStatus("Message sent.");
        setFormData({ name: "", email: "", subject: "", message: "" });
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Failed to send message.");
      } finally {
        setIsSubmitting(false);
      }
    };
    return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell min-h-screen px-4 pb-32 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-[1120px]", children: /* @__PURE__ */ jsx("section", { className: "modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] p-4 md:p-6 xl:p-8", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(20rem,0.72fr)]", children: [
      /* @__PURE__ */ jsxs("div", { className: "modelsfind-hero overflow-hidden rounded-[1.8rem] border border-[var(--modelsfind-line)]", children: [
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_24%_22%,rgba(255,108,240,0.24),transparent_24%),radial-gradient(circle_at_78%_18%,rgba(214,184,255,0.14),transparent_20%),linear-gradient(180deg,rgba(10,8,14,0.82),rgba(10,8,14,0.96))]" }),
        /* @__PURE__ */ jsxs("div", { className: "relative z-10 flex min-h-[22rem] flex-col justify-end px-6 pb-8 pt-10 md:px-10 md:pb-10 md:pt-12", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.32em] text-[var(--modelsfind-primary)]", children: "Contact" }),
          /* @__PURE__ */ jsx("h1", { className: "mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.8rem,7vw,4.8rem)] leading-[0.92] tracking-[-0.05em] text-white", children: "Reach the concierge team directly." }),
          /* @__PURE__ */ jsx("p", { className: "mt-4 max-w-[34rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: "Support and inquiry forms should feel like part of the product, with the same visual restraint as the booking flow." })
        ] })
      ] }),
      /* @__PURE__ */ jsxs(
        "form",
        {
          onSubmit: handleSubmit,
          className: "rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-6",
          children: [
            /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]", children: [
              /* @__PURE__ */ jsx(Mail, { className: "h-4 w-4" }),
              "Inquiry form"
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "mt-5 grid gap-4", children: [
              [
                ["name", "Name"],
                ["email", "Email"],
                ["subject", "Subject"]
              ].map(([key, label]) => /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
                /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: label }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: key === "email" ? "email" : "text",
                    value: formData[key],
                    onChange: (event) => setFormData((prev) => ({ ...prev, [key]: event.target.value })),
                    className: "modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)]"
                  }
                )
              ] }, key)),
              /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
                /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Message" }),
                /* @__PURE__ */ jsx(
                  "textarea",
                  {
                    value: formData.message,
                    onChange: (event) => setFormData((prev) => ({ ...prev, message: event.target.value })),
                    className: "modelsfind-field min-h-[140px] rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--modelsfind-ink)]"
                  }
                )
              ] })
            ] }),
            submitError ? /* @__PURE__ */ jsx("div", { className: "mt-4 rounded-[1rem] border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-200", children: submitError }) : null,
            status ? /* @__PURE__ */ jsx("div", { className: "mt-4 rounded-[1rem] border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200", children: status }) : null,
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "submit",
                disabled: isSubmitting || !canSubmit,
                className: "mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)] disabled:opacity-60",
                children: [
                  /* @__PURE__ */ jsx(Send, { className: "h-4 w-4" }),
                  isSubmitting ? "Sending..." : "Send message"
                ]
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "mt-5 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: [
              /* @__PURE__ */ jsx(Sparkles, { className: "h-4 w-4 text-[var(--modelsfind-primary)]" }),
              "Keep support accessible without breaking the luxury mood."
            ] })
          ]
        }
      )
    ] }) }) }) });
  });

  // src/components/Footer.tsx
  var Footer = react_default.memo(function Footer2({
    config,
    onNavigate,
    onNavigateToProducts,
    onNavigateToCategories,
    onNavigateToDeals,
    onNavigateToNewArrivals,
    onNavigateToBestsellers,
    onNavigateToHelp,
    onNavigateToContact,
    onNavigateToPrivacy,
    onNavigateToTerms
  }) {
    const site = resolveModelsfindSiteConfig(config);
    const year = (/* @__PURE__ */ new Date()).getFullYear();
    const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
    const normalizedPathname = pathname.replace(/^\/[a-z]{2}(?:-[A-Z]{2})?(?=\/|$)/, "") || "/";
    const hideMobileChrome = pathname !== "" && [
      /^\/checkout(?:\/.*)?$/,
      /^\/products\/[^/]+$/
    ].some((pattern) => pattern.test(normalizedPathname));
    const openHref = react_default.useCallback(
      (href) => {
        if (href.startsWith("mailto:")) {
          window.open(href, "_self");
          return;
        }
        if (isExternalHref(href)) {
          window.open(href, "_blank", "noopener,noreferrer");
          return;
        }
        onNavigate?.(href);
      },
      [onNavigate]
    );
    if (hideMobileChrome) {
      return /* @__PURE__ */ jsx("footer", { className: "hidden border-t border-[var(--modelsfind-line)] bg-[rgba(4,4,8,0.96)] px-4 pb-28 pt-10 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 md:block lg:px-8", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-[1560px]", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-8 border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-6 py-8 md:rounded-[2rem] lg:flex-row lg:items-end lg:justify-between", children: [
        /* @__PURE__ */ jsxs("div", { className: "max-w-[26rem]", children: [
          /* @__PURE__ */ jsx("p", { className: "[font-family:var(--modelsfind-display)] text-[2rem] italic tracking-[-0.04em] text-[var(--modelsfind-primary)]", children: site.brandName }),
          /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]", children: "Curated model discovery with private booking cues, AI-assisted filtering, and an editorial shell designed for premium operators." })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-6 text-[11px] uppercase tracking-[0.2em] text-[var(--modelsfind-copy-soft)] sm:grid-cols-2 lg:text-right", children: [
          /* @__PURE__ */ jsxs("div", { className: "grid gap-3", children: [
            /* @__PURE__ */ jsx("button", { type: "button", onClick: onNavigateToProducts, className: "transition-colors hover:text-[var(--modelsfind-ink)]", children: "Explore" }),
            /* @__PURE__ */ jsx("button", { type: "button", onClick: onNavigateToCategories, className: "transition-colors hover:text-[var(--modelsfind-ink)]", children: "Regions" }),
            /* @__PURE__ */ jsx("button", { type: "button", onClick: onNavigateToDeals, className: "transition-colors hover:text-[var(--modelsfind-ink)]", children: "Services" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "grid gap-3", children: [
            /* @__PURE__ */ jsx("button", { type: "button", onClick: onNavigateToHelp, className: "transition-colors hover:text-[var(--modelsfind-ink)]", children: "Help" }),
            /* @__PURE__ */ jsx("button", { type: "button", onClick: onNavigateToPrivacy, className: "transition-colors hover:text-[var(--modelsfind-ink)]", children: "Privacy" }),
            /* @__PURE__ */ jsx("button", { type: "button", onClick: onNavigateToTerms, className: "transition-colors hover:text-[var(--modelsfind-ink)]", children: "Terms" })
          ] })
        ] })
      ] }) }) });
    }
    return /* @__PURE__ */ jsxs("footer", { className: "border-t border-[var(--modelsfind-line)] bg-[rgba(4,4,8,0.96)] px-4 pb-28 pt-10 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 lg:px-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "mx-auto hidden max-w-[1560px] md:block", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-8 border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-6 py-8 md:rounded-[2rem] lg:flex-row lg:items-end lg:justify-between", children: [
          /* @__PURE__ */ jsxs("div", { className: "max-w-[26rem]", children: [
            /* @__PURE__ */ jsx("p", { className: "[font-family:var(--modelsfind-display)] text-[2rem] italic tracking-[-0.04em] text-[var(--modelsfind-primary)]", children: site.brandName }),
            /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]", children: "Curated model discovery with private booking cues, AI-assisted filtering, and an editorial shell designed for premium operators." }),
            /* @__PURE__ */ jsxs("div", { className: "mt-5 flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.2em] text-[var(--modelsfind-copy-soft)]", children: [
              /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-2 rounded-full border border-[var(--modelsfind-line)] px-3 py-2", children: [
                /* @__PURE__ */ jsx(ShieldCheck, { className: "h-3.5 w-3.5 text-[var(--modelsfind-primary)]" }),
                "Private access"
              ] }),
              /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-2 rounded-full border border-[var(--modelsfind-line)] px-3 py-2", children: [
                /* @__PURE__ */ jsx(WandSparkles, { className: "h-3.5 w-3.5 text-[var(--modelsfind-primary)]" }),
                "AI concierge"
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "grid gap-6 text-[11px] uppercase tracking-[0.2em] text-[var(--modelsfind-copy-soft)] sm:grid-cols-2 lg:text-right", children: [
            /* @__PURE__ */ jsxs("div", { className: "grid gap-3", children: [
              /* @__PURE__ */ jsx("button", { type: "button", onClick: onNavigateToProducts, className: "transition-colors hover:text-[var(--modelsfind-ink)]", children: "Explore" }),
              /* @__PURE__ */ jsx("button", { type: "button", onClick: onNavigateToCategories, className: "transition-colors hover:text-[var(--modelsfind-ink)]", children: "Regions" }),
              /* @__PURE__ */ jsx("button", { type: "button", onClick: onNavigateToDeals, className: "transition-colors hover:text-[var(--modelsfind-ink)]", children: "Services" }),
              /* @__PURE__ */ jsx("button", { type: "button", onClick: onNavigateToNewArrivals, className: "transition-colors hover:text-[var(--modelsfind-ink)]", children: "New arrivals" }),
              /* @__PURE__ */ jsx("button", { type: "button", onClick: onNavigateToBestsellers, className: "transition-colors hover:text-[var(--modelsfind-ink)]", children: "Editor picks" })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "grid gap-3", children: [
              /* @__PURE__ */ jsx("button", { type: "button", onClick: onNavigateToHelp, className: "transition-colors hover:text-[var(--modelsfind-ink)]", children: "Help" }),
              /* @__PURE__ */ jsx("button", { type: "button", onClick: onNavigateToPrivacy, className: "transition-colors hover:text-[var(--modelsfind-ink)]", children: "Privacy" }),
              /* @__PURE__ */ jsx("button", { type: "button", onClick: onNavigateToTerms, className: "transition-colors hover:text-[var(--modelsfind-ink)]", children: "Terms" }),
              /* @__PURE__ */ jsx("button", { type: "button", onClick: onNavigateToContact, className: "transition-colors hover:text-[var(--modelsfind-ink)]", children: "Contact" })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-6 flex flex-col gap-4 text-[10px] uppercase tracking-[0.2em] text-[var(--modelsfind-copy-soft)] md:flex-row md:items-center md:justify-between", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [
            /* @__PURE__ */ jsxs("span", { children: [
              year,
              " ",
              site.brandName,
              ". Private booking archive."
            ] }),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => openHref(`mailto:${site.supportEmail}`),
                className: "inline-flex items-center gap-2 transition-colors hover:text-[var(--modelsfind-ink)]",
                children: [
                  /* @__PURE__ */ jsx(Mail, { className: "h-3.5 w-3.5 text-[var(--modelsfind-primary)]" }),
                  site.supportEmail
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsx("span", { children: "Powered by Jiffoo" })
        ] })
      ] }),
      /* @__PURE__ */ jsx("nav", { className: "modelsfind-mobile-nav fixed bottom-0 left-0 right-0 z-[120] flex items-center justify-around rounded-t-[1.9rem] border-t border-[var(--modelsfind-line)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.9rem)] pt-3 md:hidden", children: [
        {
          label: "Explore",
          icon: Sparkles,
          action: onNavigateToProducts,
          active: normalizedPathname === "/" || normalizedPathname.startsWith("/products") || normalizedPathname.startsWith("/checkout")
        },
        {
          label: "Regions",
          icon: Compass,
          action: onNavigateToCategories,
          active: normalizedPathname.startsWith("/categories")
        },
        {
          label: "AI Concierge",
          icon: WandSparkles,
          action: () => openHref(site.docsHref),
          active: normalizedPathname.startsWith("/help") || normalizedPathname.startsWith("/contact")
        },
        {
          label: "Profile",
          icon: UserRound,
          action: () => onNavigate?.("/profile"),
          active: normalizedPathname.startsWith("/profile")
        }
      ].map((item) => {
        const Icon2 = item.icon;
        return /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: item.action,
            className: [
              "flex flex-col items-center gap-1 text-[9px] uppercase tracking-[0.16em] transition-all duration-300",
              item.active ? "scale-[1.02] text-[var(--modelsfind-primary)] drop-shadow-[0_0_10px_rgba(255,122,251,0.45)]" : "text-[var(--modelsfind-copy-soft)]"
            ].join(" "),
            children: [
              /* @__PURE__ */ jsx(Icon2, { className: item.active ? "h-4 w-4" : "h-4 w-4 opacity-80" }),
              item.label
            ]
          },
          item.label
        );
      }) })
    ] });
  });

  // src/components/Header.tsx
  var Header = react_default.memo(function Header2({
    isAuthenticated,
    user,
    cartItemCount,
    config,
    onSearch,
    onLogout,
    onNavigateToCart,
    onNavigateToProfile,
    onNavigateToLogin,
    onNavigateToRegister,
    onNavigateToHome,
    onNavigateToProducts,
    onNavigateToDeals
  }) {
    const site = resolveModelsfindSiteConfig(config);
    const [menuOpen, setMenuOpen] = react_default.useState(false);
    const [query, setQuery] = react_default.useState("");
    const [pathname, setPathname] = react_default.useState(
      () => typeof window !== "undefined" ? window.location.pathname : ""
    );
    const normalizedPathname = pathname.replace(/^\/[a-z]{2}(?:-[A-Z]{2})?(?=\/|$)/, "") || "/";
    react_default.useEffect(() => {
      if (typeof window === "undefined") {
        return;
      }
      const nextPath = window.location.pathname;
      setPathname(nextPath);
    }, []);
    const navItems = [
      { label: desktopNavItems[0], action: onNavigateToProducts },
      { label: desktopNavItems[1], action: onNavigateToDeals },
      { label: "Access", action: isAuthenticated ? onNavigateToProfile : onNavigateToRegister }
    ];
    const shouldHideOnLanding = pathname !== "" && /^\/(?:[a-z]{2}(?:-[A-Z]{2})?)?$/.test(pathname);
    const shouldHideOnMobile = pathname !== "" && [
      /^\/products(?:\/.*)?$/,
      /^\/cart(?:\/.*)?$/,
      /^\/checkout(?:\/.*)?$/
    ].some((pattern) => pattern.test(normalizedPathname));
    if (shouldHideOnLanding) {
      return null;
    }
    const submitSearch = (event) => {
      event.preventDefault();
      onSearch(query.trim());
    };
    return /* @__PURE__ */ jsxs(
      "header",
      {
        className: [
          "fixed inset-x-0 top-0 z-50 border-b border-[var(--modelsfind-line)] bg-[rgba(9,8,12,0.88)] backdrop-blur-xl [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]",
          shouldHideOnMobile ? "hidden md:block" : ""
        ].join(" "),
        children: [
          /* @__PURE__ */ jsxs("div", { className: "mx-auto flex h-[4.5rem] max-w-[1240px] items-center gap-4 px-4 sm:px-6", children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: onNavigateToHome,
                className: "[font-family:var(--modelsfind-display)] text-[1.9rem] font-semibold tracking-[-0.04em] text-[var(--modelsfind-primary)]",
                children: site.brandName
              }
            ),
            /* @__PURE__ */ jsx("nav", { className: "hidden items-center gap-8 md:flex", children: navItems.map((item) => /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: item.action,
                className: "text-[11px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)] transition-colors hover:text-[var(--modelsfind-ink)]",
                children: item.label
              },
              item.label
            )) }),
            /* @__PURE__ */ jsx("form", { onSubmit: submitSearch, className: "ml-auto hidden flex-1 justify-end md:flex", children: /* @__PURE__ */ jsxs("div", { className: "relative w-full max-w-[28rem]", children: [
              /* @__PURE__ */ jsx(Search, { className: "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--modelsfind-copy-soft)]" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  value: query,
                  onChange: (event) => setQuery(event.target.value),
                  placeholder: "Search models",
                  className: "h-11 w-full rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] pl-11 pr-4 text-sm text-[var(--modelsfind-ink)] outline-none placeholder:text-[var(--modelsfind-copy-soft)]"
                }
              )
            ] }) }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: isAuthenticated ? onNavigateToProfile : onNavigateToRegister,
                className: "hidden min-h-11 items-center justify-center rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--modelsfind-primary)_82%,white),color-mix(in_oklab,var(--modelsfind-primary)_72%,black))] px-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white md:inline-flex",
                children: "Request Access"
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: onNavigateToCart,
                className: "relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] text-[var(--modelsfind-copy)] md:hidden",
                "aria-label": "Open cart",
                children: [
                  /* @__PURE__ */ jsx(ShoppingBag, { className: "h-4 w-4" }),
                  cartItemCount > 0 ? /* @__PURE__ */ jsx("span", { className: "absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--modelsfind-primary)] px-1 text-[9px] font-semibold text-black", children: cartItemCount }) : null
                ]
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => setMenuOpen((value) => !value),
                className: "inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] text-[var(--modelsfind-ink)] md:hidden",
                "aria-label": "Toggle navigation",
                children: menuOpen ? /* @__PURE__ */ jsx(X, { className: "h-5 w-5" }) : /* @__PURE__ */ jsx(Menu, { className: "h-5 w-5" })
              }
            )
          ] }),
          menuOpen ? /* @__PURE__ */ jsxs("div", { className: "border-t border-[var(--modelsfind-line)] bg-[rgba(10,8,12,0.96)] px-4 py-4 md:hidden", children: [
            /* @__PURE__ */ jsxs("form", { onSubmit: submitSearch, className: "relative", children: [
              /* @__PURE__ */ jsx(Search, { className: "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--modelsfind-copy-soft)]" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  value: query,
                  onChange: (event) => setQuery(event.target.value),
                  placeholder: "Search models",
                  className: "h-11 w-full rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] pl-11 pr-4 text-sm text-[var(--modelsfind-ink)] outline-none placeholder:text-[var(--modelsfind-copy-soft)]"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "mt-4 grid gap-2", children: [
              navItems.map((item) => /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => {
                    setMenuOpen(false);
                    item.action();
                  },
                  className: "rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-left text-sm text-[var(--modelsfind-ink)]",
                  children: item.label
                },
                item.label
              )),
              isAuthenticated ? /* @__PURE__ */ jsxs(Fragment2, { children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => {
                      setMenuOpen(false);
                      onNavigateToProfile();
                    },
                    className: "rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-left text-sm text-[var(--modelsfind-ink)]",
                    children: /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-2", children: [
                      /* @__PURE__ */ jsx(UserRound, { className: "h-4 w-4 text-[var(--modelsfind-primary)]" }),
                      user?.firstName || user?.lastName || "Profile"
                    ] })
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => {
                      setMenuOpen(false);
                      onLogout();
                    },
                    className: "rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-left text-sm text-[var(--modelsfind-copy)]",
                    children: "Sign out"
                  }
                )
              ] }) : /* @__PURE__ */ jsxs(Fragment2, { children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => {
                      setMenuOpen(false);
                      onNavigateToLogin();
                    },
                    className: "rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-left text-sm text-[var(--modelsfind-ink)]",
                    children: "Sign in"
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => {
                      setMenuOpen(false);
                      onNavigateToRegister();
                    },
                    className: "rounded-[1rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--modelsfind-primary)_82%,white),color-mix(in_oklab,var(--modelsfind-primary)_72%,black))] px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.16em] text-white",
                    children: "Request Access"
                  }
                )
              ] })
            ] })
          ] }) : null
        ]
      }
    );
  });

  // src/components/HelpPage.tsx
  var HelpPage = react_default.memo(function HelpPage2({ onNavigateToContact }) {
    const [draft, setDraft] = react_default.useState("");
    return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell min-h-screen px-4 pb-24 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 sm:pt-24 lg:px-8", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-[1280px]", children: /* @__PURE__ */ jsxs("div", { className: "modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] bg-[rgba(10,8,12,0.96)]", children: [
      /* @__PURE__ */ jsxs("div", { className: "hidden items-center justify-between border-b border-[var(--modelsfind-line)] px-5 py-4 md:flex", children: [
        /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 text-[var(--modelsfind-primary)]", children: [
          /* @__PURE__ */ jsx(Sparkles, { className: "h-4 w-4" }),
          /* @__PURE__ */ jsx("span", { className: "[font-family:var(--modelsfind-display)] text-lg italic text-white", children: "ModelsFind Concierge" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 text-[var(--modelsfind-copy-soft)]", children: [
          /* @__PURE__ */ jsx("button", { type: "button", className: "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)]", children: /* @__PURE__ */ jsx(Search, { className: "h-4 w-4" }) }),
          /* @__PURE__ */ jsx("button", { type: "button", className: "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)]", children: /* @__PURE__ */ jsx(Bell, { className: "h-4 w-4" }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid gap-4 p-4 md:grid-cols-[16rem_minmax(0,1fr)] md:p-5", children: [
        /* @__PURE__ */ jsxs("aside", { className: "hidden rounded-[1.2rem] border border-[var(--modelsfind-line)] bg-[rgba(15,12,18,0.92)] p-4 md:block", children: [
          /* @__PURE__ */ jsx("h2", { className: "[font-family:var(--modelsfind-display)] text-[1.6rem] italic text-white", children: "Recent Match Suggestions" }),
          /* @__PURE__ */ jsx("div", { className: "mt-4 grid gap-3", children: conciergeSuggestions.map((suggestion) => /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              className: "flex items-center gap-3 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-2.5 text-left transition-colors hover:border-[var(--modelsfind-line-strong)]",
              children: [
                /* @__PURE__ */ jsx("img", { src: suggestion.image, alt: suggestion.name, className: "h-14 w-14 rounded-[0.9rem] object-cover grayscale" }),
                /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                  /* @__PURE__ */ jsx("p", { className: "[font-family:var(--modelsfind-display)] text-[1.2rem] text-white", children: suggestion.name }),
                  /* @__PURE__ */ jsx("p", { className: "truncate text-[10px] uppercase tracking-[0.14em] text-[var(--modelsfind-primary)]", children: suggestion.role })
                ] })
              ]
            },
            suggestion.name
          )) }),
          /* @__PURE__ */ jsx("div", { className: "mt-6 flex flex-wrap gap-2", children: conciergeQuickActions.map((action) => /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: "rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]",
              children: action
            },
            action
          )) })
        ] }),
        /* @__PURE__ */ jsxs("section", { className: "rounded-[1.2rem] border border-[var(--modelsfind-line)] bg-[rgba(14,11,18,0.96)] p-4 md:p-5", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between border-b border-[var(--modelsfind-line)] pb-4", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "[font-family:var(--modelsfind-display)] text-[2.1rem] italic text-white md:text-[2.4rem]", children: "AI Concierge" }),
              /* @__PURE__ */ jsx("p", { className: "mt-2 text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]", children: "Personalizing your elite experience" })
            ] }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "hidden text-[var(--modelsfind-copy-soft)] md:inline-flex", children: /* @__PURE__ */ jsx(Ellipsis, { className: "h-4 w-4" }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-5 grid gap-4", children: [
            conciergeConversation.map((message, index) => /* @__PURE__ */ jsxs(
              "div",
              {
                className: message.role === "user" ? "ml-auto max-w-[32rem]" : "max-w-[36rem]",
                children: [
                  /* @__PURE__ */ jsx(
                    "div",
                    {
                      className: [
                        "rounded-[1rem] px-4 py-4 text-sm leading-6",
                        message.role === "user" ? "bg-[rgba(58,31,69,0.72)] text-[var(--modelsfind-copy)]" : "bg-[rgba(24,22,29,0.96)] text-[var(--modelsfind-copy)]"
                      ].join(" "),
                      children: message.text
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "p",
                    {
                      className: [
                        "mt-2 text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]",
                        message.role === "user" ? "text-right" : ""
                      ].join(" "),
                      children: message.role === "user" ? "You \xB7 10:43 PM" : "Concierge \xB7 10:42 PM"
                    }
                  )
                ]
              },
              `${message.role}-${index}`
            )),
            /* @__PURE__ */ jsx("div", { className: "grid gap-3 md:grid-cols-2", children: conciergeSuggestions.slice(0, 2).map((suggestion) => /* @__PURE__ */ jsxs(
              "article",
              {
                className: "overflow-hidden rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)]",
                children: [
                  /* @__PURE__ */ jsx("img", { src: suggestion.image, alt: suggestion.name, className: "h-56 w-full object-cover grayscale" }),
                  /* @__PURE__ */ jsxs("div", { className: "p-3", children: [
                    /* @__PURE__ */ jsx("p", { className: "[font-family:var(--modelsfind-display)] text-[1.3rem] text-white", children: suggestion.name }),
                    /* @__PURE__ */ jsx("p", { className: "mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--modelsfind-primary)]", children: suggestion.role }),
                    /* @__PURE__ */ jsx("div", { className: "mt-3 flex gap-2", children: conciergeQuickActions.slice(0, 2).map((action) => /* @__PURE__ */ jsx(
                      "button",
                      {
                        type: "button",
                        className: "rounded-full border border-[var(--modelsfind-line)] px-3 py-2 text-[9px] uppercase tracking-[0.16em] text-[var(--modelsfind-copy-soft)]",
                        children: action
                      },
                      `${suggestion.name}-${action}`
                    )) })
                  ] })
                ]
              },
              suggestion.name
            )) }),
            /* @__PURE__ */ jsx("div", { className: "md:hidden", children: /* @__PURE__ */ jsx("div", { className: "flex gap-2 overflow-x-auto pb-1", children: conciergeQuickActions.map((action) => /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                className: "whitespace-nowrap rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]",
                children: action
              },
              action
            )) }) }),
            /* @__PURE__ */ jsxs(
              "form",
              {
                onSubmit: (event) => {
                  event.preventDefault();
                  if (onNavigateToContact) {
                    onNavigateToContact();
                  }
                },
                className: "mt-2 flex items-center gap-3 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-3",
                children: [
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      value: draft,
                      onChange: (event) => setDraft(event.target.value),
                      placeholder: "Inquire with your AI Concierge...",
                      className: "h-11 flex-1 bg-transparent px-2 text-sm text-[var(--modelsfind-ink)] outline-none placeholder:text-[var(--modelsfind-copy-soft)]"
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "submit",
                      className: "inline-flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--modelsfind-primary)_82%,white),color-mix(in_oklab,var(--modelsfind-primary)_72%,black))] text-white",
                      children: /* @__PURE__ */ jsx(Send, { className: "h-4 w-4" })
                    }
                  )
                ]
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.02)] p-4 md:hidden", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Suggested prompts" }),
              /* @__PURE__ */ jsx("div", { className: "mt-3 grid gap-2", children: conciergePrompts.slice(0, 2).map((prompt) => /* @__PURE__ */ jsx("div", { className: "rounded-[0.9rem] bg-[rgba(24,22,29,0.96)] px-4 py-3 text-sm leading-6 text-[var(--modelsfind-copy)]", children: prompt }, prompt)) })
            ] })
          ] })
        ] })
      ] })
    ] }) }) });
  });

  // src/components/HomePage.tsx
  function ProfileCard({
    name,
    mood,
    image,
    badge,
    onClick
  }) {
    return /* @__PURE__ */ jsxs("article", { className: "group overflow-hidden rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(18,15,22,0.96)] transition-transform duration-300 hover:-translate-y-1", children: [
      /* @__PURE__ */ jsx("button", { type: "button", onClick, className: "block w-full text-left", children: /* @__PURE__ */ jsxs("div", { className: "relative aspect-[0.82] overflow-hidden md:aspect-[0.76]", children: [
        /* @__PURE__ */ jsx(
          "img",
          {
            src: image,
            alt: name,
            className: "h-full w-full object-cover grayscale transition-transform duration-500 group-hover:scale-[1.03]"
          }
        ),
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[linear-gradient(180deg,rgba(8,7,10,0.04),rgba(8,7,10,0.78))]" }),
        badge ? /* @__PURE__ */ jsx("div", { className: "absolute right-3 top-3 rounded-full bg-[rgba(29,24,34,0.92)] px-2.5 py-1 text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy)]", children: badge }) : null
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "p-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-2", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { className: "[font-family:var(--modelsfind-display)] text-[1.25rem] leading-none tracking-[-0.04em] text-[var(--modelsfind-ink)]", children: name }),
            /* @__PURE__ */ jsx("p", { className: "mt-1 text-[11px] text-[var(--modelsfind-copy-soft)]", children: mood })
          ] }),
          /* @__PURE__ */ jsx(Heart, { className: "mt-0.5 h-3.5 w-3.5 text-[var(--modelsfind-primary)]" })
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick,
            className: "mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.02)] px-3 text-[9px] font-semibold uppercase tracking-[0.24em] text-[var(--modelsfind-copy)] transition-colors hover:border-[var(--modelsfind-primary)] hover:text-[var(--modelsfind-ink)] md:min-h-8",
            children: "Reserve"
          }
        )
      ] })
    ] });
  }
  function MobileModelCard({
    name,
    mood,
    location,
    image,
    className,
    onClick
  }) {
    return /* @__PURE__ */ jsxs("article", { className: ["flex flex-col gap-3", className || ""].join(" "), children: [
      /* @__PURE__ */ jsx("button", { type: "button", onClick, className: "block w-full text-left", children: /* @__PURE__ */ jsxs("div", { className: "relative aspect-[3/4] overflow-hidden rounded-[1.2rem] bg-[rgba(19,19,21,0.96)]", children: [
        /* @__PURE__ */ jsx("img", { src: image, alt: name, className: "h-full w-full object-cover grayscale transition-transform duration-700 hover:scale-[1.04]" }),
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[linear-gradient(180deg,rgba(10,8,12,0.04),rgba(10,8,12,0.82))]" }),
        /* @__PURE__ */ jsxs("div", { className: "absolute bottom-3 left-3 right-3", children: [
          /* @__PURE__ */ jsx("p", { className: "[font-family:var(--modelsfind-display)] text-[1.3rem] italic leading-none text-white", children: name }),
          /* @__PURE__ */ jsx("p", { className: "mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--modelsfind-copy-soft)]", children: location })
        ] })
      ] }) }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick,
          className: "inline-flex min-h-11 w-full items-center justify-center rounded-[0.9rem] border border-[var(--modelsfind-line-strong)] bg-[rgba(38,38,40,0.78)] px-3 text-[9px] font-extrabold uppercase tracking-[0.24em] text-[var(--modelsfind-primary)] transition-colors hover:bg-[var(--modelsfind-primary)] hover:text-[#17091a]",
          children: "Reserve"
        }
      )
    ] });
  }
  var HomePage = react_default.memo(function HomePage2({ config, onNavigate }) {
    const site = resolveModelsfindSiteConfig(config);
    const openHref = react_default.useCallback(
      (href) => {
        if (isExternalHref(href)) {
          window.open(href, "_blank", "noopener,noreferrer");
          return;
        }
        onNavigate?.(href);
      },
      [onNavigate]
    );
    const heroPortrait = previewPortraits[0];
    const collection = previewPortraits.slice(0, 6);
    return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell min-h-screen pb-24 pt-0 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] md:px-6 md:pt-10 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1240px]", children: [
      /* @__PURE__ */ jsx("div", { className: "md:hidden", children: /* @__PURE__ */ jsxs("div", { className: "relative", children: [
        /* @__PURE__ */ jsxs("header", { className: "modelsfind-mobile-topbar fixed inset-x-0 top-0 z-[70] flex h-16 items-center justify-between px-6", children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: () => openHref("/"),
              className: "inline-flex items-center gap-3 text-[var(--modelsfind-primary)]",
              children: [
                /* @__PURE__ */ jsx(Menu, { className: "h-4 w-4 text-[var(--modelsfind-copy-soft)]" }),
                /* @__PURE__ */ jsx("span", { className: "[font-family:var(--modelsfind-display)] text-[1.45rem] italic tracking-[-0.03em]", children: site.brandName })
              ]
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => openHref("/products"),
              className: "inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--modelsfind-copy)]",
              "aria-label": "Search models",
              children: /* @__PURE__ */ jsx(Search, { className: "h-4 w-4" })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("main", { className: "pb-10 pt-0", children: [
          /* @__PURE__ */ jsxs("section", { className: "modelsfind-vignette relative h-[46rem] overflow-hidden", children: [
            /* @__PURE__ */ jsx(
              "img",
              {
                src: heroPortrait.image,
                alt: heroPortrait.name,
                className: "absolute inset-0 h-full w-full object-cover grayscale brightness-[0.72]"
              }
            ),
            /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[linear-gradient(180deg,rgba(14,14,16,0.42),transparent_22%,rgba(10,8,12,0.92)_88%)]" }),
            /* @__PURE__ */ jsxs("div", { className: "absolute bottom-12 left-0 w-full px-6", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.3em] text-[var(--modelsfind-primary)]", children: "Est. 2026" }),
              /* @__PURE__ */ jsxs("h1", { className: "mt-3 max-w-[14rem] [font-family:var(--modelsfind-display)] text-[3.55rem] font-bold italic leading-[0.88] tracking-[-0.06em] text-white", children: [
                site.brandName,
                " Elite"
              ] }),
              /* @__PURE__ */ jsx("p", { className: "mt-3 max-w-[18rem] text-sm leading-6 text-[var(--modelsfind-copy)]", children: "Bringing the premium end of high-fashion companionship into a fully curated mobile surface." }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => openHref(site.primaryCtaHref),
                  className: "modelsfind-mobile-cta mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-8 text-[10px] font-bold uppercase tracking-[0.22em] text-[#210025]",
                  children: "Explore Collection"
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxs("section", { className: "mt-8 px-6", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-4", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]", children: "Selected regions" }),
              /* @__PURE__ */ jsx("div", { className: "h-px flex-1 bg-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)]" })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "mt-4 flex gap-3 overflow-x-auto pb-3", children: heroRegions.map((region, index) => /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => openHref(`/products?region=${encodeURIComponent(region)}`),
                className: [
                  "whitespace-nowrap rounded-full border px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em]",
                  index === 0 ? "border-[var(--modelsfind-primary)] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]" : "border-[color-mix(in_srgb,var(--modelsfind-line)_90%,transparent)] text-[var(--modelsfind-copy-soft)]"
                ].join(" "),
                children: region
              },
              region
            )) })
          ] }),
          /* @__PURE__ */ jsx("section", { className: "mt-2 px-6", children: /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: () => openHref(site.docsHref),
              className: "modelsfind-mobile-surface relative w-full overflow-hidden rounded-[1.6rem] border border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] px-5 py-5 text-left",
              children: [
                /* @__PURE__ */ jsx("div", { className: "absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[var(--modelsfind-primary-soft)] blur-3xl" }),
                /* @__PURE__ */ jsxs("div", { className: "relative flex items-center gap-4", children: [
                  /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] text-[#210025] shadow-[0_0_18px_rgba(255,122,251,0.35)]", children: /* @__PURE__ */ jsx(WandSparkles, { className: "h-5 w-5" }) }),
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("p", { className: "text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]", children: "AI Concierge" }),
                    /* @__PURE__ */ jsx("h2", { className: "[font-family:var(--modelsfind-display)] text-[1.2rem] italic text-white", children: "Ask AI for your perfect match" })
                  ] })
                ] })
              ]
            }
          ) }),
          /* @__PURE__ */ jsx("section", { className: "mt-10 px-6", children: /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-4", children: collection.slice(0, 4).map((portrait, index) => /* @__PURE__ */ jsx(
            MobileModelCard,
            {
              name: portrait.name,
              mood: portrait.mood,
              location: portrait.cities || portrait.region,
              image: portrait.image,
              className: index % 2 === 1 ? "translate-y-8" : index === 2 ? "mt-4" : "",
              onClick: () => openHref("/products")
            },
            portrait.name
          )) }) })
        ] })
      ] }) }),
      /* @__PURE__ */ jsx("div", { className: "hidden md:block", children: /* @__PURE__ */ jsxs("div", { className: "modelsfind-frame overflow-hidden rounded-[2.25rem] border border-[var(--modelsfind-line-strong)] bg-[rgba(10,8,12,0.96)]", children: [
        /* @__PURE__ */ jsxs("div", { className: "hidden items-center gap-6 border-b border-[var(--modelsfind-line)] px-5 py-4 md:flex", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => openHref("/"),
              className: "[font-family:var(--modelsfind-display)] text-[1.05rem] font-semibold tracking-[0.02em] text-[var(--modelsfind-primary)]",
              children: site.brandName
            }
          ),
          /* @__PURE__ */ jsx("nav", { className: "flex items-center gap-5", children: frameNavItems.map((item, index) => /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => openHref(item === "Models" ? "/products" : item === "Booking" ? "/checkout" : "/help"),
              className: [
                "text-[11px] uppercase tracking-[0.24em] transition-colors",
                index === 0 ? "text-[var(--modelsfind-primary)]" : "text-[var(--modelsfind-copy-soft)] hover:text-[var(--modelsfind-copy)]"
              ].join(" "),
              children: item
            },
            item
          )) }),
          /* @__PURE__ */ jsxs("div", { className: "ml-auto flex min-w-[17rem] items-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.02)] px-4 py-2", children: [
            /* @__PURE__ */ jsx(Search, { className: "h-4 w-4 text-[var(--modelsfind-copy-soft)]" }),
            /* @__PURE__ */ jsx("span", { className: "text-xs text-[var(--modelsfind-copy-soft)]", children: "Search models" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between border-b border-[var(--modelsfind-line)] px-4 py-3 md:hidden", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => openHref("/"),
              className: "[font-family:var(--modelsfind-display)] text-[1.05rem] font-semibold italic tracking-[0.02em] text-[var(--modelsfind-primary)]",
              children: site.brandName
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => openHref("/products"),
              className: "flex h-8 w-8 items-center justify-center rounded-full text-[var(--modelsfind-copy)]",
              "aria-label": "Search models",
              children: /* @__PURE__ */ jsx(Search, { className: "h-4 w-4" })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid md:grid-cols-[10.5rem_minmax(0,1fr)]", children: [
          /* @__PURE__ */ jsxs("aside", { className: "hidden border-r border-[var(--modelsfind-line)] bg-[rgba(18,15,21,0.9)] px-4 py-5 md:block", children: [
            /* @__PURE__ */ jsx("p", { className: "text-[11px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]", children: "Regions" }),
            /* @__PURE__ */ jsx("div", { className: "mt-4 grid gap-3", children: heroRegions.slice(0, 4).map((region, index) => /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => openHref(`/products?region=${encodeURIComponent(region)}`),
                className: [
                  "rounded-[1rem] border px-3 py-4 text-left text-[11px] uppercase tracking-[0.18em] transition-colors",
                  index === 0 ? "border-[var(--modelsfind-primary)] bg-[rgba(232,79,218,0.16)] text-[var(--modelsfind-primary)]" : "border-[var(--modelsfind-line)] text-[var(--modelsfind-copy-soft)] hover:text-[var(--modelsfind-copy)]"
                ].join(" "),
                children: region
              },
              region
            )) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "p-4 md:p-5", children: [
            /* @__PURE__ */ jsxs("section", { className: "modelsfind-portrait relative min-h-[18rem] overflow-hidden rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(10,8,12,0.94)] md:min-h-[20rem]", children: [
              /* @__PURE__ */ jsx(
                "img",
                {
                  src: heroPortrait.image,
                  alt: heroPortrait.name,
                  className: "absolute inset-0 h-full w-full object-cover grayscale"
                }
              ),
              /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[linear-gradient(90deg,rgba(8,7,10,0.76),rgba(8,7,10,0.22)_58%,rgba(8,7,10,0.58))]" }),
              /* @__PURE__ */ jsxs("div", { className: "relative z-10 flex h-full flex-col justify-end px-5 pb-5 pt-8 md:px-8 md:pb-8", children: [
                /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.3em] text-[var(--modelsfind-copy-soft)]", children: "Est. 2026" }),
                /* @__PURE__ */ jsx("h1", { className: "mt-3 max-w-[12rem] [font-family:var(--modelsfind-display)] text-[clamp(2.3rem,8vw,5.8rem)] font-semibold leading-[0.88] tracking-[-0.05em] text-[var(--modelsfind-ink)] md:mt-4 md:max-w-[18rem]", children: site.headline }),
                /* @__PURE__ */ jsx("p", { className: "mt-3 max-w-[15rem] text-[13px] leading-6 text-[var(--modelsfind-copy)] md:max-w-[30rem] md:text-sm md:leading-7", children: site.subheadline }),
                /* @__PURE__ */ jsxs("div", { className: "mt-5 flex flex-col gap-3 sm:flex-row", children: [
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: () => openHref(site.primaryCtaHref),
                      className: "inline-flex min-h-11 items-center justify-center rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--modelsfind-primary)_82%,white),color-mix(in_oklab,var(--modelsfind-primary)_72%,black))] px-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white",
                      children: site.primaryCtaLabel
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: () => openHref(site.secondaryCtaHref),
                      className: "inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--modelsfind-line-strong)] bg-[rgba(20,16,22,0.68)] px-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--modelsfind-ink)]",
                      children: site.secondaryCtaLabel
                    }
                  )
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("section", { className: "mt-5 md:hidden", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-copy-soft)]", children: "Selected regions" }),
              /* @__PURE__ */ jsx("div", { className: "mt-3 flex gap-2 overflow-x-auto pb-1", children: heroRegions.map((region, index) => /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => openHref(`/products?region=${encodeURIComponent(region)}`),
                  className: [
                    "whitespace-nowrap rounded-full border px-3 py-2 text-[10px] uppercase tracking-[0.18em]",
                    index === 0 ? "border-[var(--modelsfind-primary)] bg-[rgba(232,79,218,0.16)] text-[var(--modelsfind-primary)]" : "border-[var(--modelsfind-line)] text-[var(--modelsfind-copy)]"
                  ].join(" "),
                  children: region
                },
                region
              )) })
            ] }),
            /* @__PURE__ */ jsxs("section", { className: "mt-6", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 md:flex-row md:items-end md:justify-between", children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("h2", { className: "[font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-[var(--modelsfind-ink)] md:text-[2.45rem]", children: "The Collection" }),
                  /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs text-[var(--modelsfind-copy-soft)]", children: "Showing 72 elite editorials across China" })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "hidden items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-copy-soft)] md:flex", children: [
                  /* @__PURE__ */ jsx(Sparkles, { className: "h-3.5 w-3.5 text-[var(--modelsfind-primary)]" }),
                  "Curated nightly"
                ] })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "mt-4 grid grid-cols-2 gap-3 md:grid-cols-3", children: collection.map((portrait, index) => /* @__PURE__ */ jsxs("div", { className: "relative", children: [
                /* @__PURE__ */ jsx(
                  ProfileCard,
                  {
                    name: portrait.name,
                    mood: portrait.mood,
                    image: portrait.image,
                    badge: index === 2 ? "Private Match" : portrait.badge,
                    onClick: () => openHref("/products")
                  }
                ),
                index === 2 ? /* @__PURE__ */ jsxs("div", { className: "pointer-events-none absolute -left-24 top-12 hidden rounded-[1rem] border border-[var(--modelsfind-line-strong)] bg-[rgba(24,18,30,0.94)] px-4 py-3 shadow-[var(--modelsfind-card-shadow)] lg:block", children: [
                  /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-[var(--modelsfind-primary)]", children: [
                    /* @__PURE__ */ jsx(WandSparkles, { className: "h-3.5 w-3.5" }),
                    "AI concierge"
                  ] }),
                  /* @__PURE__ */ jsx("p", { className: "mt-2 text-[11px] uppercase tracking-[0.16em] text-white", children: "Find your ideal match" })
                ] }) : null
              ] }, portrait.name)) })
            ] }),
            /* @__PURE__ */ jsxs("section", { className: "mt-6 rounded-[1.2rem] border border-[var(--modelsfind-line)] bg-[rgba(31,23,34,0.82)] p-4 md:hidden", children: [
              /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]", children: [
                /* @__PURE__ */ jsx(WandSparkles, { className: "h-3.5 w-3.5" }),
                "AI Concierge"
              ] }),
              /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm italic leading-6 text-[var(--modelsfind-ink)]", children: "Ask AI for your perfect match" }),
              /* @__PURE__ */ jsx("p", { className: "mt-3 text-xs leading-6 text-[var(--modelsfind-copy)]", children: "Personalize your shortlist by city, mood, or event brief before sending a reservation." }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => openHref("/help"),
                  className: "mt-4 inline-flex min-h-10 items-center justify-center rounded-full bg-[rgba(232,79,218,0.14)] px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-primary)]",
                  children: "Open concierge"
                }
              )
            ] }),
            /* @__PURE__ */ jsx("section", { className: "mt-8 hidden border-t border-[var(--modelsfind-line)] pt-6 md:block", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]", children: [
              /* @__PURE__ */ jsxs("div", { className: "rounded-[1.2rem] border border-[var(--modelsfind-line)] bg-[rgba(20,16,24,0.92)] p-4", children: [
                /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]", children: [
                  /* @__PURE__ */ jsx(WandSparkles, { className: "h-4 w-4" }),
                  "AI Concierge"
                ] }),
                /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]", children: "Ask AI for your perfect match." })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "grid gap-4 md:grid-cols-3", children: conciergeSuggestions.map((suggestion) => /* @__PURE__ */ jsxs(
                "article",
                {
                  className: "rounded-[1.2rem] border border-[var(--modelsfind-line)] bg-[rgba(18,15,22,0.92)] p-3",
                  children: [
                    /* @__PURE__ */ jsx(
                      "img",
                      {
                        src: suggestion.image,
                        alt: suggestion.name,
                        className: "h-44 w-full rounded-[0.9rem] object-cover grayscale"
                      }
                    ),
                    /* @__PURE__ */ jsx("p", { className: "mt-3 [font-family:var(--modelsfind-display)] text-[1.5rem] text-white", children: suggestion.name }),
                    /* @__PURE__ */ jsxs("p", { className: "mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--modelsfind-copy-soft)]", children: [
                      suggestion.role,
                      " \xB7 ",
                      suggestion.city
                    ] })
                  ]
                },
                suggestion.name
              )) })
            ] }) })
          ] })
        ] })
      ] }) })
    ] }) });
  });

  // src/components/LoginPage.tsx
  var LoginPage = react_default.memo(function LoginPage2({
    isLoading,
    error,
    config,
    onSubmit,
    onOAuthClick,
    onNavigateToRegister,
    onNavigateToForgotPassword
  }) {
    const site = resolveModelsfindSiteConfig(config);
    const [email, setEmail] = react_default.useState("");
    const [password, setPassword] = react_default.useState("");
    const [showPassword, setShowPassword] = react_default.useState(false);
    const canSubmit = Boolean(email.trim() && password);
    const handleSubmit = async (event) => {
      event.preventDefault();
      if (!canSubmit) return;
      await onSubmit(email.trim(), password);
    };
    return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell min-h-screen px-4 py-12 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-[1120px]", children: /* @__PURE__ */ jsx("section", { className: "modelsfind-frame modelsfind-noise overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)]", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-0 lg:grid-cols-[minmax(0,0.94fr)_minmax(24rem,0.76fr)]", children: [
      /* @__PURE__ */ jsxs("div", { className: "modelsfind-hero overflow-hidden border-b border-[var(--modelsfind-line)] lg:border-b-0 lg:border-r", children: [
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_24%_22%,rgba(255,108,240,0.24),transparent_24%),radial-gradient(circle_at_78%_18%,rgba(214,184,255,0.14),transparent_20%),linear-gradient(180deg,rgba(10,8,14,0.82),rgba(10,8,14,0.96))]" }),
        /* @__PURE__ */ jsxs("div", { className: "relative z-10 flex min-h-[24rem] flex-col justify-end px-6 pb-8 pt-12 md:px-10 md:pb-10", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.32em] text-[var(--modelsfind-primary)]", children: "Private access" }),
          /* @__PURE__ */ jsxs("h1", { className: "mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.9rem,7vw,5.2rem)] leading-[0.92] tracking-[-0.05em] text-white", children: [
            "Enter the ",
            site.brandName,
            " archive."
          ] }),
          /* @__PURE__ */ jsx("p", { className: "mt-4 max-w-[32rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: "Sign in for booking requests, shortlist history, and concierge sessions across desktop and mobile." })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "p-5 md:p-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[28rem]", children: [
        /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]", children: [
          /* @__PURE__ */ jsx(Sparkles, { className: "h-4 w-4" }),
          "Authentication"
        ] }),
        /* @__PURE__ */ jsx("h2", { className: "mt-3 [font-family:var(--modelsfind-display)] text-[2.4rem] leading-none tracking-[-0.04em] text-white", children: "Welcome back" }),
        error ? /* @__PURE__ */ jsx("div", { className: "mt-5 rounded-[1rem] border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-200", children: error }) : null,
        /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, className: "mt-6 grid gap-4", children: [
          /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Email" }),
            /* @__PURE__ */ jsxs("div", { className: "relative", children: [
              /* @__PURE__ */ jsx(Mail, { className: "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--modelsfind-copy-soft)]" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "email",
                  value: email,
                  onChange: (event) => setEmail(event.target.value),
                  placeholder: "you@example.com",
                  className: "modelsfind-field h-12 w-full rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] pl-11 pr-4 text-sm text-[var(--modelsfind-ink)] placeholder:text-[var(--modelsfind-copy-soft)]",
                  disabled: isLoading
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Password" }),
            /* @__PURE__ */ jsxs("div", { className: "relative", children: [
              /* @__PURE__ */ jsx(LockKeyhole, { className: "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--modelsfind-copy-soft)]" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: showPassword ? "text" : "password",
                  value: password,
                  onChange: (event) => setPassword(event.target.value),
                  placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
                  className: "modelsfind-field h-12 w-full rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] pl-11 pr-12 text-sm text-[var(--modelsfind-ink)] placeholder:text-[var(--modelsfind-copy-soft)]",
                  disabled: isLoading
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => setShowPassword((value) => !value),
                  className: "absolute right-4 top-1/2 -translate-y-1/2 text-[var(--modelsfind-copy-soft)] transition-colors hover:text-[var(--modelsfind-ink)]",
                  children: showPassword ? /* @__PURE__ */ jsx(EyeOff, { className: "h-4 w-4" }) : /* @__PURE__ */ jsx(Eye, { className: "h-4 w-4" })
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "submit",
              disabled: isLoading || !canSubmit,
              className: "mt-2 inline-flex min-h-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)] disabled:opacity-60",
              children: isLoading ? "Signing in..." : "Sign in"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-4 flex flex-col gap-3", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => onOAuthClick("google"),
              className: "inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-ink)]",
              children: "Continue with Google"
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: [
            /* @__PURE__ */ jsx("button", { type: "button", onClick: onNavigateToForgotPassword, className: "transition-colors hover:text-[var(--modelsfind-ink)]", children: "Forgot password" }),
            /* @__PURE__ */ jsx("button", { type: "button", onClick: onNavigateToRegister, className: "transition-colors hover:text-[var(--modelsfind-primary)]", children: "Create account" })
          ] })
        ] })
      ] }) })
    ] }) }) }) });
  });

  // src/components/NotFound.tsx
  var NotFound = react_default.memo(function NotFound2({ route, message, onGoHome }) {
    return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell flex min-h-screen items-center justify-center px-4 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]", children: /* @__PURE__ */ jsxs("div", { className: "modelsfind-panel max-w-[42rem] rounded-[2rem] border border-[var(--modelsfind-line)] p-8 text-center", children: [
      /* @__PURE__ */ jsx("p", { className: "[font-family:var(--modelsfind-display)] text-[5rem] leading-none tracking-[-0.06em] text-[var(--modelsfind-primary)]", children: "404" }),
      /* @__PURE__ */ jsx("h1", { className: "mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.6rem,7vw,4rem)] leading-[0.92] tracking-[-0.05em] text-white", children: "This page slipped out of the archive." }),
      /* @__PURE__ */ jsx("p", { className: "mx-auto mt-4 max-w-[30rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: message || `We couldn't find${route ? ` \u201C${route}\u201D` : " that destination"} in the current private directory.` }),
      /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: onGoHome,
          className: "mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)]",
          children: [
            /* @__PURE__ */ jsx(House, { className: "h-4 w-4" }),
            "Back to home"
          ]
        }
      )
    ] }) });
  });

  // src/components/OrderCancelledPage.tsx
  var OrderCancelledPage = react_default.memo(function OrderCancelledPage2({
    onReturnToCart,
    onContinueShopping,
    onContactSupport
  }) {
    return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell min-h-screen px-4 py-12 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-[960px]", children: /* @__PURE__ */ jsxs("div", { className: "modelsfind-panel rounded-[2rem] border border-[var(--modelsfind-line)] p-8 text-center", children: [
      /* @__PURE__ */ jsx("div", { className: "mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-yellow-500/10 text-yellow-100", children: /* @__PURE__ */ jsx(CircleX, { className: "h-12 w-12" }) }),
      /* @__PURE__ */ jsx("p", { className: "mt-6 text-[10px] uppercase tracking-[0.24em] text-yellow-100", children: "Payment cancelled" }),
      /* @__PURE__ */ jsx("h1", { className: "mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.8rem,7vw,4.6rem)] leading-[0.92] tracking-[-0.05em] text-white", children: "Nothing has been charged." }),
      /* @__PURE__ */ jsx("p", { className: "mx-auto mt-4 max-w-[32rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: "Keep the cancellation state reassuring. The cart remains intact and the path back to checkout stays obvious on mobile." }),
      /* @__PURE__ */ jsxs("div", { className: "mt-8 grid gap-3 sm:grid-cols-2", children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: onReturnToCart,
            className: "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)]",
            children: [
              /* @__PURE__ */ jsx(ShoppingBag, { className: "h-4 w-4" }),
              "Return to cart"
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: onContinueShopping,
            className: "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-ink)]",
            children: [
              /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
              "Continue browsing"
            ]
          }
        )
      ] }),
      onContactSupport ? /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: onContactSupport,
          className: "mt-4 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)] transition-colors hover:text-[var(--modelsfind-primary)]",
          children: [
            /* @__PURE__ */ jsx(CircleHelp, { className: "h-4 w-4" }),
            "Contact support"
          ]
        }
      ) : null
    ] }) }) });
  });

  // src/components/OrderDetailPage.tsx
  var OrderDetailPage = react_default.memo(function OrderDetailPage2({
    order,
    isLoading,
    onBack,
    onBackToOrders,
    onCancelOrder
  }) {
    const handleBack = onBack || onBackToOrders;
    if (isLoading) {
      return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell min-h-screen" });
    }
    if (!order) {
      return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell flex min-h-screen items-center justify-center px-4 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]", children: /* @__PURE__ */ jsxs("div", { className: "modelsfind-panel max-w-[36rem] rounded-[2rem] border border-[var(--modelsfind-line)] p-8 text-center", children: [
        /* @__PURE__ */ jsx(CircleAlert, { className: "mx-auto h-10 w-10 text-red-300" }),
        /* @__PURE__ */ jsx("h1", { className: "mt-5 [font-family:var(--modelsfind-display)] text-[2.6rem] leading-none tracking-[-0.04em] text-white", children: "Order not found" }),
        handleBack ? /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: handleBack,
            className: "mt-6 inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--modelsfind-line)] px-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-ink)]",
            children: [
              /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
              "Back to orders"
            ]
          }
        ) : null
      ] }) });
    }
    return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell min-h-screen px-4 pb-32 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1280px]", children: [
      handleBack ? /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: handleBack,
          className: "inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-copy)]",
          children: [
            /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
            "Back to orders"
          ]
        }
      ) : null,
      /* @__PURE__ */ jsxs("div", { className: "mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]", children: [
        /* @__PURE__ */ jsxs("div", { className: "modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] p-4 md:p-6 xl:p-8", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 md:flex-row md:items-start md:justify-between", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("p", { className: "text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]", children: [
                "Order #",
                formatOrderId(order.id)
              ] }),
              /* @__PURE__ */ jsx("h1", { className: "mt-3 [font-family:var(--modelsfind-display)] text-[2.6rem] leading-none tracking-[-0.04em] text-white", children: formatMoneyPrecise(order.totalAmount, order.currency) }),
              /* @__PURE__ */ jsxs("p", { className: "mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]", children: [
                "Placed ",
                formatDateTime(order.createdAt)
              ] })
            ] }),
            /* @__PURE__ */ jsx(
              "span",
              {
                className: [
                  "inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                  getStatusClasses(order.status)
                ].join(" "),
                children: humanizeStatus(order.status)
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("section", { className: "mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]", children: [
            /* @__PURE__ */ jsx("div", { className: "grid gap-4", children: order.items.map((item) => /* @__PURE__ */ jsx(
              "div",
              {
                className: "rounded-[1.4rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-5",
                children: /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-4", children: [
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold text-white", children: item.productName }),
                    /* @__PURE__ */ jsxs("p", { className: "mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: [
                      "Qty ",
                      item.quantity,
                      item.variantName ? ` \u2022 ${item.variantName}` : ""
                    ] })
                  ] }),
                  /* @__PURE__ */ jsx("p", { className: "text-sm text-[var(--modelsfind-copy)]", children: formatMoneyPrecise(item.totalPrice, order.currency) })
                ] })
              },
              item.id
            )) }),
            /* @__PURE__ */ jsxs("aside", { className: "modelsfind-panel rounded-[1.6rem] border border-[var(--modelsfind-line)] p-5", children: [
              /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]", children: [
                /* @__PURE__ */ jsx(Package2, { className: "h-4 w-4" }),
                "Details"
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "mt-5 grid gap-3 text-sm", children: [
                /* @__PURE__ */ jsxs("div", { className: "rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 py-3", children: [
                  /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Payment" }),
                  /* @__PURE__ */ jsx("p", { className: "mt-2 text-white", children: humanizeStatus(order.paymentStatus) })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 py-3", children: [
                  /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Address" }),
                  /* @__PURE__ */ jsx("p", { className: "mt-2 text-[var(--modelsfind-copy)]", children: summarizeAddress(order.shippingAddress) })
                ] }),
                order.cancelReason ? /* @__PURE__ */ jsxs("div", { className: "rounded-[1rem] border border-red-500/20 bg-red-500/5 px-4 py-3", children: [
                  /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.18em] text-red-200", children: "Cancellation note" }),
                  /* @__PURE__ */ jsx("p", { className: "mt-2 text-red-100", children: order.cancelReason })
                ] }) : null
              ] }),
              order.status.toLowerCase() === "pending" && onCancelOrder ? /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => void onCancelOrder(),
                  className: "mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-red-500/20 bg-red-500/5 px-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-red-200",
                  children: "Cancel order"
                }
              ) : null
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("aside", { className: "modelsfind-panel rounded-[1.6rem] border border-[var(--modelsfind-line)] p-5", children: [
          /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]", children: [
            /* @__PURE__ */ jsx(ShieldCheck, { className: "h-4 w-4" }),
            "Timeline"
          ] }),
          /* @__PURE__ */ jsx("div", { className: "mt-5 grid gap-4", children: [
            `Order placed \u2022 ${formatDateTime(order.createdAt)}`,
            `Payment status \u2022 ${humanizeStatus(order.paymentStatus)}`,
            `Latest update \u2022 ${formatDateTime(order.updatedAt)}`
          ].map((line) => /* @__PURE__ */ jsx(
            "div",
            {
              className: "rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--modelsfind-copy)]",
              children: line
            },
            line
          )) })
        ] })
      ] })
    ] }) });
  });

  // src/components/OrdersPage.tsx
  var OrdersPage = react_default.memo(function OrdersPage2({
    orders,
    isLoading,
    error,
    currentPage,
    totalPages,
    onPageChange,
    onOrderClick,
    onCancelOrder
  }) {
    if (isLoading) {
      return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell min-h-screen" });
    }
    return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell min-h-screen px-4 pb-32 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1280px]", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
        /* @__PURE__ */ jsx("div", { className: "inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] text-[var(--modelsfind-copy)]", children: /* @__PURE__ */ jsx(Package2, { className: "h-4 w-4" }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]", children: "Order history" }),
          /* @__PURE__ */ jsx("h1", { className: "[font-family:var(--modelsfind-display)] text-[2.3rem] leading-none tracking-[-0.04em] text-white", children: "Private bookings" })
        ] })
      ] }),
      error ? /* @__PURE__ */ jsx("div", { className: "mt-6 rounded-[1.4rem] border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-200", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
        /* @__PURE__ */ jsx(CircleAlert, { className: "mt-0.5 h-4 w-4" }),
        /* @__PURE__ */ jsx("span", { children: error })
      ] }) }) : null,
      orders.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "modelsfind-panel mt-6 rounded-[2rem] border border-[var(--modelsfind-line)] p-10 text-center", children: [
        /* @__PURE__ */ jsx("h2", { className: "[font-family:var(--modelsfind-display)] text-[2.6rem] leading-none tracking-[-0.04em] text-white", children: "No bookings yet" }),
        /* @__PURE__ */ jsx("p", { className: "mx-auto mt-4 max-w-[28rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: "Once bookings are placed, this page should read like a polished private ledger rather than an admin table." })
      ] }) : /* @__PURE__ */ jsx("div", { className: "mt-6 grid gap-4", children: orders.map((order) => /* @__PURE__ */ jsxs(
        "article",
        {
          className: "rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-5",
          children: [
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 md:flex-row md:items-start md:justify-between", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsxs("p", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: [
                  "Order #",
                  formatOrderId(order.id)
                ] }),
                /* @__PURE__ */ jsx("h2", { className: "mt-2 [font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white", children: formatMoneyPrecise(order.totalAmount, order.currency) }),
                /* @__PURE__ */ jsxs("p", { className: "mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]", children: [
                  "Placed ",
                  formatDateTime(order.createdAt)
                ] })
              ] }),
              /* @__PURE__ */ jsx(
                "span",
                {
                  className: [
                    "inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                    getStatusClasses(order.status)
                  ].join(" "),
                  children: humanizeStatus(order.status)
                }
              )
            ] }),
            /* @__PURE__ */ jsx("div", { className: "mt-5 grid gap-3", children: order.items.map((item) => /* @__PURE__ */ jsxs(
              "div",
              {
                className: "flex items-center justify-between rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3",
                children: [
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold text-white", children: item.productName }),
                    /* @__PURE__ */ jsxs("p", { className: "mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: [
                      "Qty ",
                      item.quantity
                    ] })
                  ] }),
                  /* @__PURE__ */ jsx("p", { className: "text-sm text-[var(--modelsfind-copy)]", children: formatMoneyPrecise(item.totalPrice, order.currency) })
                ]
              },
              item.id
            )) }),
            /* @__PURE__ */ jsxs("div", { className: "mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end", children: [
              order.status.toLowerCase() === "pending" ? /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => void onCancelOrder(order.id),
                  className: "inline-flex min-h-11 items-center justify-center rounded-full border border-red-500/20 bg-red-500/5 px-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-red-200",
                  children: "Cancel"
                }
              ) : null,
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => onOrderClick(order.id),
                  className: "inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-ink)]",
                  children: "View details"
                }
              )
            ] })
          ]
        },
        order.id
      )) }),
      totalPages > 1 ? /* @__PURE__ */ jsxs("div", { className: "mt-8 flex items-center justify-center gap-2", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => onPageChange(Math.max(1, currentPage - 1)),
            disabled: currentPage === 1,
            className: "inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy)] disabled:opacity-40",
            children: /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" })
          }
        ),
        /* @__PURE__ */ jsxs("span", { className: "px-4 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: [
          "Page ",
          currentPage,
          " of ",
          totalPages
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => onPageChange(Math.min(totalPages, currentPage + 1)),
            disabled: currentPage === totalPages,
            className: "inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy)] disabled:opacity-40",
            children: /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4 rotate-180" })
          }
        )
      ] }) : null
    ] }) });
  });

  // src/components/OrderSuccessPage.tsx
  var OrderSuccessPage = react_default.memo(function OrderSuccessPage2({
    orderNumber,
    order,
    onContinueShopping,
    onViewOrders
  }) {
    const leadItem = order?.items?.[0];
    const leadPortrait = findPreviewPortraitByName(leadItem?.productName) || previewPortraits[0];
    const reservationDate = order ? formatDateTime(order.createdAt) : "October 24, 2026";
    return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell min-h-screen px-4 py-12 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 lg:px-8", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-[1180px]", children: /* @__PURE__ */ jsx("div", { className: "modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] bg-[rgba(10,8,12,0.96)] p-4 md:p-6 xl:p-8", children: /* @__PURE__ */ jsxs("section", { className: "relative overflow-hidden rounded-[1.8rem] border border-[var(--modelsfind-line)] bg-[linear-gradient(180deg,rgba(10,8,12,0.92),rgba(8,7,10,0.98))]", children: [
      /* @__PURE__ */ jsx(
        "img",
        {
          src: leadPortrait.image,
          alt: leadItem?.productName || leadPortrait.name,
          className: "absolute inset-0 h-full w-full object-cover grayscale opacity-20"
        }
      ),
      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,rgba(10,8,12,0.46),rgba(10,8,12,0.96))]" }),
      /* @__PURE__ */ jsxs("div", { className: "relative z-10 px-6 py-10 md:px-10 md:py-14", children: [
        /* @__PURE__ */ jsx("p", { className: "text-center text-[10px] uppercase tracking-[0.3em] text-[var(--modelsfind-primary)]", children: "ModelsFind" }),
        /* @__PURE__ */ jsxs("div", { className: "mx-auto mt-8 max-w-[38rem] text-center", children: [
          /* @__PURE__ */ jsx("div", { className: "mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/14 text-emerald-200", children: /* @__PURE__ */ jsx(CircleCheck, { className: "h-7 w-7" }) }),
          /* @__PURE__ */ jsx("h1", { className: "mt-6 [font-family:var(--modelsfind-display)] text-[clamp(3rem,7vw,5.3rem)] leading-[0.9] tracking-[-0.05em] text-white", children: "Booking Confirmed" }),
          /* @__PURE__ */ jsx("p", { className: "mt-4 text-sm leading-7 text-[var(--modelsfind-copy)]", children: "Your reservation has been secured and the concierge timeline is now active for private follow-through." })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mx-auto mt-10 grid max-w-[48rem] gap-5 md:grid-cols-[15rem_minmax(0,1fr)]", children: [
          /* @__PURE__ */ jsx("div", { className: "overflow-hidden rounded-[1.25rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)]", children: /* @__PURE__ */ jsx(
            "img",
            {
              src: leadPortrait.image,
              alt: leadItem?.productName || leadPortrait.name,
              className: "h-full min-h-[14rem] w-full object-cover grayscale"
            }
          ) }),
          /* @__PURE__ */ jsxs("div", { className: "rounded-[1.25rem] border border-[var(--modelsfind-line)] bg-[rgba(16,13,18,0.92)] p-5 text-left", children: [
            /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Reservation summary" }),
            /* @__PURE__ */ jsx("h2", { className: "mt-3 [font-family:var(--modelsfind-display)] text-[2rem] leading-none text-white", children: leadItem?.productName || leadPortrait.name }),
            /* @__PURE__ */ jsxs("div", { className: "mt-5 grid gap-3 text-sm text-[var(--modelsfind-copy)]", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex justify-between gap-4", children: [
                /* @__PURE__ */ jsx("span", { children: "Date" }),
                /* @__PURE__ */ jsx("span", { className: "text-white", children: reservationDate })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex justify-between gap-4", children: [
                /* @__PURE__ */ jsx("span", { children: "Experience" }),
                /* @__PURE__ */ jsx("span", { className: "text-white", children: leadItem?.variantName || leadPortrait.mood })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex justify-between gap-4", children: [
                /* @__PURE__ */ jsx("span", { children: "Reference" }),
                /* @__PURE__ */ jsx("span", { className: "text-white", children: orderNumber })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex justify-between gap-4", children: [
                /* @__PURE__ */ jsx("span", { children: "Total" }),
                /* @__PURE__ */ jsx("span", { className: "text-[var(--modelsfind-primary)]", children: formatMoneyPrecise(order?.totalAmount || leadItem?.totalPrice || 0, order?.currency || "USD") })
              ] })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: onContinueShopping,
              className: "inline-flex min-h-12 items-center justify-center rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--modelsfind-primary)_82%,white),color-mix(in_oklab,var(--modelsfind-primary)_72%,black))] px-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-white",
              children: "Continue exploring"
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: onViewOrders,
              className: "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-ink)]",
              children: [
                "View reservations",
                /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4" })
              ]
            }
          )
        ] })
      ] })
    ] }) }) }) });
  });

  // src/components/PrivacyPage.tsx
  var sections = [
    ["Information we collect", "Theme-level default text: account details, booking requests, and support messages may be stored so operators can fulfill inquiries and manage private access.", FileText],
    ["How information is used", "Data may be used to process bookings, verify access, provide concierge support, and improve archive discovery across desktop and mobile experiences.", Eye],
    ["Sharing and disclosures", "Information should only be shared with service providers or operators directly involved in delivering the requested booking or support flow, subject to production policy.", Users],
    ["Security posture", "The storefront should apply appropriate safeguards for personal data, authentication, and transaction details. Replace this section with production legal and operational specifics.", LockKeyhole],
    ["User rights", "Users may request access, correction, or deletion of relevant personal information, subject to operational and legal constraints in the production environment.", ShieldCheck]
  ];
  var PrivacyPage = react_default.memo(function PrivacyPage2(_) {
    return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell min-h-screen px-4 pb-32 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-[1180px]", children: /* @__PURE__ */ jsxs("section", { className: "modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] p-4 md:p-6 xl:p-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "modelsfind-hero overflow-hidden rounded-[1.8rem] border border-[var(--modelsfind-line)]", children: [
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_24%_22%,rgba(255,108,240,0.24),transparent_24%),radial-gradient(circle_at_78%_18%,rgba(214,184,255,0.14),transparent_20%),linear-gradient(180deg,rgba(10,8,14,0.82),rgba(10,8,14,0.96))]" }),
        /* @__PURE__ */ jsxs("div", { className: "relative z-10 flex min-h-[22rem] flex-col justify-end px-6 pb-8 pt-10 md:px-10 md:pb-10 md:pt-12", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.32em] text-[var(--modelsfind-primary)]", children: "Privacy" }),
          /* @__PURE__ */ jsx("h1", { className: "mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.8rem,7vw,4.8rem)] leading-[0.92] tracking-[-0.05em] text-white", children: "Privacy framework for the private archive." }),
          /* @__PURE__ */ jsx("p", { className: "mt-4 max-w-[34rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: "This is a theme-level default. Production shops should replace it with jurisdiction-specific legal text before launch." })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "mt-8 grid gap-4", children: sections.map(([title, body, icon]) => {
        const Icon2 = icon;
        return /* @__PURE__ */ jsx(
          "article",
          {
            className: "rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-6",
            children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4", children: [
              /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]", children: /* @__PURE__ */ jsx(Icon2, { className: "h-5 w-5" }) }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("h2", { className: "[font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white", children: title }),
                /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-7 text-[var(--modelsfind-copy)]", children: body })
              ] })
            ] })
          },
          title
        );
      }) })
    ] }) }) });
  });

  // src/components/ProductDetailPage.tsx
  var PROFILE_COPY = {
    ximena: {
      essence: "A fusion of classical grace and contemporary edge. Ximena defines the new era of high-fashion minimalism with a silhouette that stays poised and memorable under discreet lighting.",
      story: "Ximena possesses a rare, chameleonic ability to transform. She doesn't just wear the collection; she embodies the narrative, shifting from couture restraint to after-dark editorial intensity without losing presence.",
      eyes: "Hazel Glow",
      nationality: "Spanish",
      languages: "Spanish, English, French",
      serviceLabel: "Editorial",
      logisticsNote: "Discrete arrival routing, private venue logistics, and concierge check-ins remain coordinated from the same request."
    },
    elena: {
      essence: "Elena moves between alpine polish and dark-luxe glamour with an ease that reads private, expensive, and camera-ready at every angle.",
      story: "Her booking profile is designed for discreet getaways, premium hospitality partnerships, and event-led experiences where composure matters as much as appearance.",
      eyes: "Amber",
      nationality: "Swiss",
      languages: "English, Italian, German",
      serviceLabel: "Full weekend concierge",
      logisticsNote: "Preference and schedule details stay condensed into a single brief so the host team and concierge stay aligned."
    }
  };
  function formatPrice(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(value || 0);
  }
  function findSpecValue(specifications, candidates, fallback) {
    const match = specifications?.find(
      (spec) => candidates.some((candidate) => spec.name.toLowerCase().includes(candidate.toLowerCase()))
    );
    return match?.value || fallback;
  }
  function parseMeasurements(value) {
    if (!value) {
      return ["34B", '24"', '35"'];
    }
    const parts = value.split("/").map((part) => part.trim()).filter(Boolean);
    return [
      parts[0] || "34B",
      parts[1] ? `${parts[1].replace(/"/g, "")}"` : '24"',
      parts[2] ? `${parts[2].replace(/"/g, "")}"` : '35"'
    ];
  }
  function resolveEditorialFallback(product, currentVariantName) {
    const key = product?.name?.trim().toLowerCase() || "";
    return PROFILE_COPY[key] || {
      essence: product?.description || `${product?.name || "This profile"} is shaped for discreet editorial bookings, balancing statement imagery with concierge-grade coordination.`,
      story: "Precision, privacy, and booking readiness stay foregrounded throughout the profile so the creative brief and the logistics brief never feel disconnected.",
      eyes: findSpecValue(product?.specifications, ["eyes", "eye color"], "Hazel Glow"),
      nationality: findSpecValue(product?.specifications, ["nationality", "origin"], product?.category?.name || "International"),
      languages: findSpecValue(product?.specifications, ["language"], "English"),
      serviceLabel: currentVariantName || "Editorial",
      logisticsNote: "Location, arrival, and deposit details stay consolidated in one elevated booking flow."
    };
  }
  function getProductImages(product) {
    const fallbackPortrait = findPreviewPortraitByName(product?.name) || previewPortraits[0];
    const baseImages = product?.images?.length ? product.images.map((image) => image.url || fallbackPortrait.image) : [fallbackPortrait.image];
    while (baseImages.length < 4) {
      const nextPortrait = previewPortraits[baseImages.length % previewPortraits.length];
      baseImages.push(nextPortrait.image);
    }
    return baseImages;
  }
  function getLocalizedShopPath(path) {
    if (typeof window === "undefined") {
      return path;
    }
    const segments = window.location.pathname.split("/").filter(Boolean);
    const firstSegment = segments[0];
    const localePattern = /^[a-z]{2}(?:-[A-Z]{2})?$/;
    if (firstSegment && localePattern.test(firstSegment)) {
      return `/${firstSegment}${path}`;
    }
    return path;
  }
  function readPersistedCartSignature(productId, variantId) {
    if (typeof window === "undefined") {
      return null;
    }
    try {
      const raw = window.localStorage.getItem("cart-storage");
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      const state = parsed?.state ?? parsed;
      const localCart = Array.isArray(state?.localCart) ? state.localCart : [];
      const cartItems = Array.isArray(state?.cart?.items) ? state.cart.items : [];
      const localMatch = localCart.find((item) => item?.productId === productId && (variantId ? item?.variantId === variantId : true));
      const cartMatch = cartItems.find((item) => item?.productId === productId && (variantId ? item?.variantId === variantId : true));
      return JSON.stringify({
        localQuantity: localMatch?.quantity ?? null,
        cartQuantity: cartMatch?.quantity ?? null,
        itemCount: state?.cart?.itemCount ?? cartItems.length ?? null
      });
    } catch {
      return null;
    }
  }
  var ProductDetailPage = react_default.memo(function ProductDetailPage2({
    product,
    isLoading,
    selectedVariant,
    quantity,
    onVariantChange,
    onQuantityChange,
    onAddToCart,
    onBack
  }) {
    const images = react_default.useMemo(() => getProductImages(product), [product]);
    const [activeImage, setActiveImage] = react_default.useState(images[0]);
    const [telegramSession, setTelegramSession] = react_default.useState(null);
    const [bookingForm, setBookingForm] = react_default.useState({
      scheduledAt: "",
      location: "",
      roomOrUnit: "",
      contactName: "",
      contactPhone: "",
      notes: ""
    });
    const [bookingState, setBookingState] = react_default.useState({
      submitting: false,
      successMessage: "",
      errorMessage: ""
    });
    react_default.useEffect(() => {
      setActiveImage(images[0]);
    }, [images]);
    react_default.useEffect(() => {
      if (typeof window === "undefined") {
        return;
      }
      const applyVerifiedSession = () => {
        try {
          const raw = sessionStorage.getItem("telegram.webapp.verified");
          if (!raw) {
            setTelegramSession(null);
            return;
          }
          setTelegramSession(JSON.parse(raw));
        } catch {
          setTelegramSession(null);
        }
      };
      applyVerifiedSession();
      const onVerified = (event) => {
        const customEvent = event;
        if (customEvent.detail) {
          setTelegramSession(customEvent.detail);
        } else {
          applyVerifiedSession();
        }
      };
      window.addEventListener("telegram:webapp-verified", onVerified);
      return () => {
        window.removeEventListener("telegram:webapp-verified", onVerified);
      };
    }, []);
    const currentVariant = react_default.useMemo(
      () => product?.variants?.find((variant) => variant.id === selectedVariant) || product?.variants?.[0],
      [product, selectedVariant]
    );
    const stockValue = currentVariant?.inventory ?? product?.inventory?.available ?? 0;
    const maxQuantity = Math.max(1, Math.min(stockValue || 1, 12));
    const previewPortrait = findPreviewPortraitByName(product?.name) || previewPortraits[0];
    if (isLoading) {
      return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell flex min-h-screen items-center justify-center [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]", children: /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
        /* @__PURE__ */ jsx(Sparkles, { className: "mx-auto h-12 w-12 animate-pulse text-[var(--modelsfind-primary)]" }),
        /* @__PURE__ */ jsx("p", { className: "mt-4 text-[11px] uppercase tracking-[0.28em] text-[var(--modelsfind-copy-soft)]", children: "Opening profile" })
      ] }) });
    }
    if (!product) {
      return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell flex min-h-screen items-center justify-center px-4 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]", children: /* @__PURE__ */ jsxs("div", { className: "modelsfind-panel max-w-[36rem] rounded-[2rem] border border-[var(--modelsfind-line)] p-8 text-center", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]", children: "Missing profile" }),
        /* @__PURE__ */ jsx("h1", { className: "mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.6rem,7vw,4rem)] leading-[0.92] tracking-[-0.05em] text-white", children: "Profile not found" }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: onBack,
            className: "mt-6 inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--modelsfind-line)] px-5 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--modelsfind-copy)]",
            children: [
              /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
              "Back to collection"
            ]
          }
        )
      ] }) });
    }
    const serviceLabel = currentVariant?.name || currentVariant?.value || previewPortrait.mood;
    const editorialFallback = resolveEditorialFallback(product, serviceLabel);
    const [bust, waist, hips] = parseMeasurements(previewPortrait.measurements);
    const estimatedTotal = (currentVariant?.price || product.price || 0) * quantity;
    const depositValue = estimatedTotal * 0.2;
    const portfolioImages = images.slice(0, 4);
    const attributeRows = [
      { label: "Height", value: findSpecValue(product.specifications, ["height"], previewPortrait.height || "5\u203211\u2033") },
      { label: "Measurements", value: previewPortrait.measurements || "34B / 24 / 35" },
      { label: "Region", value: previewPortrait.cities || previewPortrait.region },
      { label: "Access", value: serviceLabel }
    ];
    const personalDetails = [
      { label: "Age", value: previewPortrait.age || findSpecValue(product.specifications, ["age"], "27") },
      { label: "Eyes", value: findSpecValue(product.specifications, ["eyes", "eye color"], editorialFallback.eyes) },
      {
        label: "Nationality",
        value: findSpecValue(product.specifications, ["nationality", "origin"], editorialFallback.nationality)
      },
      { label: "Languages", value: findSpecValue(product.specifications, ["language"], editorialFallback.languages) }
    ];
    const mobileStats = [
      { label: "Height", value: attributeRows[0].value },
      { label: "Bust", value: bust },
      { label: "Waist", value: waist },
      { label: "Hips", value: hips }
    ];
    const telegramUserLabel = telegramSession?.user ? [telegramSession.user.first_name, telegramSession.user.last_name].filter(Boolean).join(" ") || telegramSession.user.username || `User #${telegramSession.user.id}` : null;
    const handleBookingField = (key, value) => {
      setBookingForm((prev) => ({ ...prev, [key]: value }));
    };
    const handleSubmitBooking = async () => {
      if (!telegramSession?.raw) {
        setBookingState({
          submitting: false,
          successMessage: "",
          errorMessage: "Open this page from the Telegram bot to submit an appointment request."
        });
        return;
      }
      if (!bookingForm.scheduledAt || !bookingForm.location) {
        setBookingState({
          submitting: false,
          successMessage: "",
          errorMessage: "Please provide the appointment time and location before sending the request."
        });
        return;
      }
      setBookingState({
        submitting: true,
        successMessage: "",
        errorMessage: ""
      });
      try {
        const response = await fetch("/api/telegram/bookings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            initData: telegramSession.raw,
            productId: product.id,
            productVariantId: currentVariant?.id,
            productName: product.name,
            packageName: serviceLabel,
            scheduledAt: bookingForm.scheduledAt,
            location: bookingForm.location,
            roomOrUnit: bookingForm.roomOrUnit,
            contactName: bookingForm.contactName,
            contactPhone: bookingForm.contactPhone,
            notes: bookingForm.notes
          })
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error?.message || "Failed to submit appointment request");
        }
        setBookingState({
          submitting: false,
          successMessage: "Appointment request sent to Telegram. A confirmation message should arrive in your Telegram chat shortly.",
          errorMessage: ""
        });
      } catch (error) {
        setBookingState({
          submitting: false,
          successMessage: "",
          errorMessage: error instanceof Error ? error.message : "Failed to submit appointment request"
        });
      }
    };
    const scrollToBookingForm = () => {
      if (typeof document === "undefined") {
        return;
      }
      document.getElementById("modelsfind-booking-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    };
    const handleMobileReserve = async () => {
      if (!onAddToCart) {
        scrollToBookingForm();
        return;
      }
      try {
        const before = readPersistedCartSignature(product.id, selectedVariant);
        await onAddToCart();
        await new Promise((resolve) => window.setTimeout(resolve, 120));
        const after = readPersistedCartSignature(product.id, selectedVariant);
        if (before !== after) {
          window.location.assign(getLocalizedShopPath("/cart"));
        }
      } catch {
      }
    };
    return /* @__PURE__ */ jsxs("div", { className: "modelsfind-shell min-h-screen px-4 pb-32 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 sm:pt-24 lg:px-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1320px] md:hidden", children: [
        /* @__PURE__ */ jsxs("div", { className: "overflow-hidden bg-[rgba(10,8,12,0.98)]", children: [
          /* @__PURE__ */ jsxs("header", { className: "modelsfind-mobile-topbar fixed inset-x-0 top-0 z-[78] flex h-16 items-center justify-between px-6", children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: onBack,
                className: "inline-flex items-center gap-3 text-white",
                children: [
                  /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
                  /* @__PURE__ */ jsx("span", { className: "[font-family:var(--modelsfind-display)] text-[1rem] italic tracking-[0.18em] uppercase", children: previewPortrait.region })
                ]
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx(Heart, { className: "h-4 w-4 text-[var(--modelsfind-primary)]" }),
              /* @__PURE__ */ jsx("div", { className: "h-8 w-8 overflow-hidden rounded-full border border-[var(--modelsfind-line-strong)]", children: /* @__PURE__ */ jsx("img", { src: portfolioImages[1], alt: `${product.name} avatar`, className: "h-full w-full object-cover" }) })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("main", { className: "pb-32 pt-0", children: [
            /* @__PURE__ */ jsxs("section", { className: "relative h-[46rem] overflow-hidden", children: [
              /* @__PURE__ */ jsx("img", { src: activeImage, alt: product.name, className: "absolute inset-0 h-full w-full object-cover" }),
              /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[linear-gradient(180deg,rgba(14,14,16,0.38),transparent_26%,rgba(10,8,12,0.94)_100%)]" }),
              /* @__PURE__ */ jsxs("div", { className: "absolute bottom-0 left-0 w-full p-8", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsx("span", { className: "h-2 w-2 rounded-full bg-[var(--modelsfind-primary)]" }),
                  /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.2rem] text-[var(--modelsfind-primary)]", children: "Available tonight" })
                ] }),
                /* @__PURE__ */ jsx("h1", { className: "mt-3 [font-family:var(--modelsfind-display)] text-[3.9rem] font-bold italic leading-[0.88] tracking-[-0.06em] text-white", children: product.name }),
                /* @__PURE__ */ jsxs("p", { className: "mt-2 max-w-[17rem] text-[11px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: [
                  "Haute Couture & Editorial Specialist | ",
                  previewPortrait.cities || previewPortrait.region
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsx("section", { className: "relative z-10 -mt-12 grid grid-cols-2 gap-3 px-6", children: mobileStats.map((metric, index) => /* @__PURE__ */ jsxs(
              "div",
              {
                className: "modelsfind-mobile-surface rounded-[1rem] border border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] p-5",
                children: [
                  /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.16em] text-[var(--modelsfind-copy-soft)]", children: metric.label }),
                  /* @__PURE__ */ jsx("p", { className: index === 0 ? "mt-5 [font-family:var(--modelsfind-display)] text-[2rem] leading-none text-[var(--modelsfind-primary)]" : "mt-5 [font-family:var(--modelsfind-display)] text-[2rem] leading-none text-white", children: metric.value })
                ]
              },
              `${metric.label}-${index}`
            )) }),
            /* @__PURE__ */ jsxs("section", { className: "space-y-8 px-6 py-12", children: [
              /* @__PURE__ */ jsxs("div", { className: "space-y-5", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-baseline gap-4", children: [
                  /* @__PURE__ */ jsx("span", { className: "[font-family:var(--modelsfind-display)] text-[3.2rem] text-[var(--modelsfind-primary)]/24", children: "01" }),
                  /* @__PURE__ */ jsx("h2", { className: "[font-family:var(--modelsfind-display)] text-[2rem] italic tracking-[-0.04em] text-white", children: "The Essence" })
                ] }),
                /* @__PURE__ */ jsx("p", { className: "text-[1rem] leading-8 text-[var(--modelsfind-copy)]", children: editorialFallback.story })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "space-y-5", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-end justify-between gap-4", children: [
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]", children: "Gallery" }),
                    /* @__PURE__ */ jsx("h2", { className: "[font-family:var(--modelsfind-display)] text-[2.4rem] tracking-[-0.05em] text-white", children: "Portfolio" })
                  ] }),
                  /* @__PURE__ */ jsx("span", { className: "border-b border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] pb-1 text-[10px] uppercase tracking-[0.16em] text-[var(--modelsfind-copy-soft)]", children: "View all sets" })
                ] }),
                /* @__PURE__ */ jsx("div", { className: "flex gap-4 overflow-x-auto pb-2", children: portfolioImages.map((image, index) => /* @__PURE__ */ jsxs(
                  "button",
                  {
                    type: "button",
                    onClick: () => setActiveImage(image),
                    className: "group relative h-[23rem] w-[16rem] flex-none overflow-hidden rounded-[1rem]",
                    children: [
                      /* @__PURE__ */ jsx("img", { src: image, alt: `${product.name} set ${index + 1}`, className: "h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]" }),
                      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.78))]" }),
                      /* @__PURE__ */ jsx("div", { className: "absolute bottom-5 left-5", children: /* @__PURE__ */ jsx("p", { className: "[font-family:var(--modelsfind-display)] text-[1.2rem] italic text-white", children: index === 0 ? "Silk & Stone" : index === 1 ? "Shadow Work" : index === 2 ? "The Archive" : "After Dark" }) })
                    ]
                  },
                  `${image}-${index}`
                )) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "modelsfind-mobile-surface rounded-[1.4rem] border border-[color-mix(in_srgb,var(--modelsfind-line)_70%,transparent)] p-6", children: [
                /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-primary)]", children: "Personal details" }),
                /* @__PURE__ */ jsx("div", { className: "mt-5 grid gap-4", children: personalDetails.map((detail) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-4 border-b border-[color-mix(in_srgb,var(--modelsfind-line)_65%,transparent)] pb-3", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: detail.label }),
                  /* @__PURE__ */ jsx("span", { className: "max-w-[52%] text-right text-sm text-white", children: detail.value })
                ] }, detail.label)) })
              ] })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "fixed bottom-0 left-0 right-0 z-[90] bg-[linear-gradient(180deg,rgba(8,8,12,0),rgba(8,8,12,0.92)_42%,rgba(8,8,12,1)_100%)] px-6 pb-10 pt-6", children: /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: () => {
              void handleMobileReserve();
            },
            className: "modelsfind-mobile-cta flex h-16 w-full items-center justify-center gap-3 rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] text-[11px] font-bold uppercase tracking-[0.24em] text-[#210025]",
            children: [
              /* @__PURE__ */ jsx("span", { children: "Reserve for Booking" }),
              /* @__PURE__ */ jsx(CalendarDays, { className: "h-4 w-4" })
            ]
          }
        ) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mx-auto hidden max-w-[1320px] md:block", children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: onBack,
            className: "inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-copy)]",
            children: [
              /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
              "Back to collection"
            ]
          }
        ),
        /* @__PURE__ */ jsx("section", { className: "modelsfind-frame modelsfind-noise mt-4 overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] bg-[rgba(10,8,12,0.96)] p-4 md:p-6 xl:p-8", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start", children: [
          /* @__PURE__ */ jsxs("div", { className: "grid gap-6", children: [
            /* @__PURE__ */ jsxs("section", { className: "relative overflow-hidden rounded-[1.9rem] border border-[var(--modelsfind-line)] bg-[rgba(8,8,12,0.95)]", children: [
              /* @__PURE__ */ jsx(
                "img",
                {
                  src: activeImage,
                  alt: product.name,
                  className: "absolute inset-0 h-full w-full object-cover grayscale opacity-90"
                }
              ),
              /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[linear-gradient(90deg,rgba(7,7,10,0.88),rgba(7,7,10,0.38)_48%,rgba(7,7,10,0.8)),linear-gradient(180deg,rgba(7,7,10,0.08),rgba(7,7,10,0.78))]" }),
              /* @__PURE__ */ jsxs("div", { className: "relative z-10 flex min-h-[32rem] flex-col justify-between px-6 py-6 md:min-h-[40rem] md:px-8 md:py-8", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-4", children: [
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.26em] text-[var(--modelsfind-primary)]", children: "ModelsFind" }),
                    /* @__PURE__ */ jsx("p", { className: "mt-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-copy-soft)]", children: previewPortrait.region })
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: "hidden rounded-full border border-[var(--modelsfind-line)] bg-[rgba(10,8,12,0.5)] px-3 py-1 text-[9px] uppercase tracking-[0.22em] text-[var(--modelsfind-copy-soft)] md:block", children: stockValue > 0 ? `${stockValue} open slots` : "Request only" })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "max-w-[38rem]", children: [
                  /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.3em] text-[var(--modelsfind-copy-soft)]", children: "Haute couture & editorial" }),
                  /* @__PURE__ */ jsx("h1", { className: "mt-5 [font-family:var(--modelsfind-display)] text-[clamp(3.4rem,9vw,8rem)] italic leading-[0.84] tracking-[-0.06em] text-white drop-shadow-[0_16px_40px_rgba(0,0,0,0.45)]", children: product.name }),
                  /* @__PURE__ */ jsx("p", { className: "mt-4 max-w-[30rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: editorialFallback.essence }),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: scrollToBookingForm,
                      className: "mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--modelsfind-primary)_82%,white),color-mix(in_oklab,var(--modelsfind-primary)_72%,black))] px-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white",
                      children: "Reserve for booking"
                    }
                  )
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsx("section", { className: "grid grid-cols-2 gap-px overflow-hidden rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[var(--modelsfind-line)] md:hidden", children: mobileStats.map((metric, index) => /* @__PURE__ */ jsxs("div", { className: "bg-[rgba(17,14,20,0.95)] p-5", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.2em] text-[var(--modelsfind-copy-soft)]", children: metric.label }),
              /* @__PURE__ */ jsx("p", { className: "mt-3 [font-family:var(--modelsfind-display)] text-[2rem] leading-none text-white", children: metric.value })
            ] }, `${metric.label}-${index}`)) }),
            /* @__PURE__ */ jsxs("section", { className: "grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]", children: [
              /* @__PURE__ */ jsxs("div", { className: "rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-6", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-baseline gap-4", children: [
                  /* @__PURE__ */ jsx("span", { className: "[font-family:var(--modelsfind-display)] text-5xl text-[var(--modelsfind-primary)]/26", children: "01" }),
                  /* @__PURE__ */ jsxs("h2", { className: "[font-family:var(--modelsfind-display)] text-[2.2rem] italic leading-none tracking-[-0.04em] text-white", children: [
                    "The ",
                    /* @__PURE__ */ jsx("span", { className: "text-[var(--modelsfind-primary)]", children: "Attributes" })
                  ] })
                ] }),
                /* @__PURE__ */ jsx("div", { className: "mt-6 grid gap-5", children: attributeRows.map((attribute) => /* @__PURE__ */ jsxs(
                  "div",
                  {
                    className: "flex items-start justify-between gap-4 border-b border-[var(--modelsfind-line)]/70 pb-4",
                    children: [
                      /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-copy-soft)]", children: attribute.label }),
                      /* @__PURE__ */ jsx("span", { className: "max-w-[60%] text-right text-sm text-[var(--modelsfind-ink)]", children: attribute.value })
                    ]
                  },
                  attribute.label
                )) })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "overflow-hidden rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)]", children: /* @__PURE__ */ jsx("img", { src: portfolioImages[1], alt: `${product.name} portrait`, className: "h-full min-h-[18rem] w-full object-cover grayscale" }) })
            ] }),
            /* @__PURE__ */ jsxs("section", { className: "rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-6", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-end justify-between gap-4", children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]", children: "Portfolio" }),
                  /* @__PURE__ */ jsx("h2", { className: "[font-family:var(--modelsfind-display)] text-[2.4rem] italic leading-none tracking-[-0.04em] text-white", children: "Highlights" })
                ] }),
                /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "View all sets" })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]", children: [
                /* @__PURE__ */ jsx("div", { className: "overflow-hidden rounded-[1.25rem] border border-[var(--modelsfind-line)]", children: /* @__PURE__ */ jsx(
                  "img",
                  {
                    src: portfolioImages[0],
                    alt: `${product.name} portfolio lead`,
                    className: "h-full min-h-[18rem] w-full object-cover"
                  }
                ) }),
                /* @__PURE__ */ jsx("div", { className: "grid gap-3", children: portfolioImages.slice(1, 4).map((image, index) => /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => setActiveImage(image),
                    className: [
                      "group overflow-hidden rounded-[1.1rem] border bg-[rgba(255,255,255,0.02)] text-left transition-colors",
                      activeImage === image ? "border-[var(--modelsfind-line-strong)]" : "border-[var(--modelsfind-line)]"
                    ].join(" "),
                    children: /* @__PURE__ */ jsxs("div", { className: "relative", children: [
                      /* @__PURE__ */ jsx(
                        "img",
                        {
                          src: image,
                          alt: `${product.name} detail ${index + 2}`,
                          className: "h-28 w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        }
                      ),
                      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[linear-gradient(180deg,rgba(8,7,10,0.02),rgba(8,7,10,0.7))]" }),
                      /* @__PURE__ */ jsx("div", { className: "absolute bottom-3 left-3", children: /* @__PURE__ */ jsxs("p", { className: "text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: [
                        "Volume ",
                        String(index + 2).padStart(2, "0")
                      ] }) })
                    ] })
                  },
                  `${image}-${index}`
                )) })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("section", { className: "grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]", children: [
              /* @__PURE__ */ jsxs("div", { className: "rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-6", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-baseline gap-4", children: [
                  /* @__PURE__ */ jsx("span", { className: "[font-family:var(--modelsfind-display)] text-5xl text-[var(--modelsfind-primary)]/26", children: "02" }),
                  /* @__PURE__ */ jsx("h2", { className: "[font-family:var(--modelsfind-display)] text-[2.1rem] italic leading-none tracking-[-0.04em] text-white", children: "The Essence" })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-5 text-sm leading-8 text-[var(--modelsfind-copy)]", children: [
                  /* @__PURE__ */ jsx("p", { children: editorialFallback.story }),
                  /* @__PURE__ */ jsx("p", { children: product.description || editorialFallback.logisticsNote })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-6", children: [
                /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]", children: "Personal details" }),
                /* @__PURE__ */ jsx("div", { className: "mt-5 grid gap-4", children: personalDetails.map((detail) => /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("p", { className: "text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: detail.label }),
                  /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-white", children: detail.value })
                ] }, detail.label)) })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("section", { className: "relative overflow-hidden rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[linear-gradient(180deg,rgba(14,11,18,0.97),rgba(10,8,12,0.98))] px-6 py-10 md:px-8", children: [
              /* @__PURE__ */ jsx("div", { className: "absolute right-3 top-0 [font-family:var(--modelsfind-display)] text-[10rem] leading-none text-[var(--modelsfind-primary)]/12 md:text-[13rem]", children: "X" }),
              /* @__PURE__ */ jsxs("div", { className: "relative z-10 max-w-[28rem]", children: [
                /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]", children: "Private reservation" }),
                /* @__PURE__ */ jsxs("h2", { className: "mt-5 [font-family:var(--modelsfind-display)] text-[clamp(2.4rem,7vw,4.6rem)] italic leading-[0.92] tracking-[-0.05em] text-white", children: [
                  "Secure her ",
                  /* @__PURE__ */ jsx("span", { className: "text-[var(--modelsfind-primary)]", children: "presence." })
                ] }),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: scrollToBookingForm,
                    className: "mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--modelsfind-primary)_82%,white),color-mix(in_oklab,var(--modelsfind-primary)_72%,black))] px-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white",
                    children: "Reserve for booking"
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxs(
              "section",
              {
                id: "modelsfind-booking-form",
                className: "rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-6",
                children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-4 border-b border-[var(--modelsfind-line)] pb-5", children: [
                    /* @__PURE__ */ jsxs("div", { children: [
                      /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]", children: "ModelsFind" }),
                      /* @__PURE__ */ jsxs("h2", { className: "[font-family:var(--modelsfind-display)] text-[clamp(2.1rem,6vw,3.3rem)] leading-[0.94] tracking-[-0.05em] text-white", children: [
                        "Booking Request for ",
                        /* @__PURE__ */ jsx("span", { className: "italic text-[var(--modelsfind-primary)]", children: product.name })
                      ] })
                    ] }),
                    /* @__PURE__ */ jsx("div", { className: "hidden rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)] md:block", children: telegramUserLabel ? `Connected as ${telegramUserLabel}` : "Telegram session required" })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]", children: [
                    /* @__PURE__ */ jsxs("div", { className: "grid gap-6", children: [
                      /* @__PURE__ */ jsxs("section", { className: "rounded-[1.3rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-5", children: [
                        /* @__PURE__ */ jsx("h3", { className: "[font-family:var(--modelsfind-display)] text-[1.8rem] text-white", children: "Service Preference" }),
                        /* @__PURE__ */ jsx("div", { className: "mt-4 grid gap-3 sm:grid-cols-2", children: (product.variants?.length ? product.variants : [currentVariant].filter(Boolean)).map((variant, index) => /* @__PURE__ */ jsxs(
                          "button",
                          {
                            type: "button",
                            onClick: () => {
                              if (variant?.id) {
                                onVariantChange(variant.id);
                              }
                            },
                            className: [
                              "rounded-[1.1rem] border px-4 py-4 text-left transition-colors",
                              currentVariant?.id === variant?.id ? "border-[var(--modelsfind-line-strong)] bg-[rgba(255,255,255,0.08)]" : "border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.02)]"
                            ].join(" "),
                            children: [
                              /* @__PURE__ */ jsxs("p", { className: "text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: [
                                "Tier ",
                                String(index + 1).padStart(2, "0")
                              ] }),
                              /* @__PURE__ */ jsx("p", { className: "mt-3 [font-family:var(--modelsfind-display)] text-[1.45rem] leading-none text-white", children: variant?.name || variant?.value || editorialFallback.serviceLabel }),
                              /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs text-[var(--modelsfind-copy)]", children: currentVariant?.id === variant?.id ? "Selected service" : "Tap to select" })
                            ]
                          },
                          variant?.id || `variant-${index}`
                        )) })
                      ] }),
                      /* @__PURE__ */ jsxs("section", { className: "rounded-[1.3rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-5", children: [
                        /* @__PURE__ */ jsx("h3", { className: "[font-family:var(--modelsfind-display)] text-[1.8rem] text-white", children: "Scheduling Details" }),
                        /* @__PURE__ */ jsxs("div", { className: "mt-4 grid gap-4 md:grid-cols-2", children: [
                          /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
                            /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Preferred date & time" }),
                            /* @__PURE__ */ jsx(
                              "input",
                              {
                                type: "datetime-local",
                                value: bookingForm.scheduledAt,
                                onChange: (event) => handleBookingField("scheduledAt", event.target.value),
                                className: "modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)]"
                              }
                            )
                          ] }),
                          /* @__PURE__ */ jsxs("div", { className: "grid gap-2", children: [
                            /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Quantity" }),
                            /* @__PURE__ */ jsxs("div", { className: "inline-flex h-12 items-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-1", children: [
                              /* @__PURE__ */ jsx(
                                "button",
                                {
                                  type: "button",
                                  onClick: () => onQuantityChange(Math.max(1, quantity - 1)),
                                  className: "flex h-10 w-10 items-center justify-center rounded-full text-[var(--modelsfind-copy)]",
                                  children: /* @__PURE__ */ jsx(Minus, { className: "h-4 w-4" })
                                }
                              ),
                              /* @__PURE__ */ jsx("span", { className: "min-w-[3rem] text-center text-base font-semibold text-white", children: quantity }),
                              /* @__PURE__ */ jsx(
                                "button",
                                {
                                  type: "button",
                                  onClick: () => onQuantityChange(Math.min(maxQuantity, quantity + 1)),
                                  className: "flex h-10 w-10 items-center justify-center rounded-full text-[var(--modelsfind-copy)]",
                                  children: /* @__PURE__ */ jsx(Plus, { className: "h-4 w-4" })
                                }
                              )
                            ] })
                          ] })
                        ] })
                      ] }),
                      /* @__PURE__ */ jsxs("section", { className: "rounded-[1.3rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-5", children: [
                        /* @__PURE__ */ jsx("h3", { className: "[font-family:var(--modelsfind-display)] text-[1.8rem] text-white", children: "Location & Logistics" }),
                        /* @__PURE__ */ jsxs("div", { className: "mt-4 grid gap-4 md:grid-cols-2", children: [
                          /* @__PURE__ */ jsxs("label", { className: "grid gap-2 md:col-span-2", children: [
                            /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Location" }),
                            /* @__PURE__ */ jsx(
                              "input",
                              {
                                type: "text",
                                value: bookingForm.location,
                                onChange: (event) => handleBookingField("location", event.target.value),
                                placeholder: "Hotel, studio, apartment, or private venue",
                                className: "modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)] placeholder:text-[var(--modelsfind-copy-soft)]"
                              }
                            )
                          ] }),
                          /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
                            /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Room / Unit" }),
                            /* @__PURE__ */ jsx(
                              "input",
                              {
                                type: "text",
                                value: bookingForm.roomOrUnit,
                                onChange: (event) => handleBookingField("roomOrUnit", event.target.value),
                                placeholder: "Optional",
                                className: "modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)] placeholder:text-[var(--modelsfind-copy-soft)]"
                              }
                            )
                          ] }),
                          /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
                            /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Contact name" }),
                            /* @__PURE__ */ jsx(
                              "input",
                              {
                                type: "text",
                                value: bookingForm.contactName,
                                onChange: (event) => handleBookingField("contactName", event.target.value),
                                placeholder: "Your name",
                                className: "modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)] placeholder:text-[var(--modelsfind-copy-soft)]"
                              }
                            )
                          ] }),
                          /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
                            /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Contact phone" }),
                            /* @__PURE__ */ jsx(
                              "input",
                              {
                                type: "text",
                                value: bookingForm.contactPhone,
                                onChange: (event) => handleBookingField("contactPhone", event.target.value),
                                placeholder: "Optional",
                                className: "modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)] placeholder:text-[var(--modelsfind-copy-soft)]"
                              }
                            )
                          ] }),
                          /* @__PURE__ */ jsxs("label", { className: "grid gap-2 md:col-span-2", children: [
                            /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Notes" }),
                            /* @__PURE__ */ jsx(
                              "textarea",
                              {
                                value: bookingForm.notes,
                                onChange: (event) => handleBookingField("notes", event.target.value),
                                placeholder: "Arrival notes, privacy requests, or special instructions",
                                className: "modelsfind-field min-h-[110px] rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--modelsfind-ink)] placeholder:text-[var(--modelsfind-copy-soft)]"
                              }
                            )
                          ] })
                        ] })
                      ] })
                    ] }),
                    /* @__PURE__ */ jsxs("aside", { className: "rounded-[1.3rem] border border-[var(--modelsfind-line)] bg-[rgba(12,10,16,0.94)] p-5", children: [
                      /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]", children: "Reservation Summary" }),
                      /* @__PURE__ */ jsxs("div", { className: "mt-4 flex items-center gap-3 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-3", children: [
                        /* @__PURE__ */ jsx("img", { src: previewPortrait.image, alt: product.name, className: "h-16 w-16 rounded-[0.9rem] object-cover grayscale" }),
                        /* @__PURE__ */ jsxs("div", { children: [
                          /* @__PURE__ */ jsx("p", { className: "[font-family:var(--modelsfind-display)] text-[1.5rem] leading-none text-white", children: product.name }),
                          /* @__PURE__ */ jsx("p", { className: "mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: previewPortrait.cities || previewPortrait.region })
                        ] })
                      ] }),
                      /* @__PURE__ */ jsxs("div", { className: "mt-5 grid gap-3 text-sm", children: [
                        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-4 text-[var(--modelsfind-copy)]", children: [
                          /* @__PURE__ */ jsx("span", { children: "Service" }),
                          /* @__PURE__ */ jsx("span", { className: "text-white", children: serviceLabel })
                        ] }),
                        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-4 text-[var(--modelsfind-copy)]", children: [
                          /* @__PURE__ */ jsx("span", { children: "Scheduling" }),
                          /* @__PURE__ */ jsx("span", { className: "text-right text-white", children: bookingForm.scheduledAt ? new Date(bookingForm.scheduledAt).toLocaleDateString("en-US") : "Select date" })
                        ] }),
                        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-4 text-[var(--modelsfind-copy)]", children: [
                          /* @__PURE__ */ jsx("span", { children: "Deposit required" }),
                          /* @__PURE__ */ jsx("span", { className: "text-[var(--modelsfind-primary)]", children: formatPrice(depositValue) })
                        ] })
                      ] }),
                      /* @__PURE__ */ jsxs("div", { className: "mt-5 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-4", children: [
                        /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Estimated Total" }),
                        /* @__PURE__ */ jsx("p", { className: "mt-3 [font-family:var(--modelsfind-display)] text-[2.6rem] leading-none text-white", children: formatPrice(estimatedTotal) }),
                        /* @__PURE__ */ jsx("p", { className: "mt-4 text-xs leading-6 text-[var(--modelsfind-copy)]", children: editorialFallback.logisticsNote })
                      ] }),
                      bookingState.errorMessage ? /* @__PURE__ */ jsx("div", { className: "mt-4 rounded-[1rem] border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-200", children: bookingState.errorMessage }) : null,
                      bookingState.successMessage ? /* @__PURE__ */ jsx("div", { className: "mt-4 rounded-[1rem] border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200", children: bookingState.successMessage }) : null,
                      /* @__PURE__ */ jsxs("div", { className: "mt-5 grid gap-3", children: [
                        /* @__PURE__ */ jsx(
                          "button",
                          {
                            type: "button",
                            onClick: () => {
                              void handleSubmitBooking();
                            },
                            disabled: bookingState.submitting,
                            className: "inline-flex min-h-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)] disabled:opacity-60",
                            children: bookingState.submitting ? "Sending request..." : "Request Booking"
                          }
                        ),
                        /* @__PURE__ */ jsx("p", { className: "text-xs leading-6 text-[var(--modelsfind-copy-soft)]", children: "Telegram concierge flow: verify inside the bot, send the request to the manager chat, and return a confirmation message to the requester." })
                      ] })
                    ] })
                  ] })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsx("aside", { className: "hidden xl:block", children: /* @__PURE__ */ jsxs("div", { className: "sticky top-[6rem] rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(12,10,16,0.94)] p-5 shadow-[var(--modelsfind-card-shadow)]", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx("img", { src: previewPortrait.image, alt: product.name, className: "h-16 w-16 rounded-[1rem] object-cover grayscale" }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-primary)]", children: "Model profile" }),
                /* @__PURE__ */ jsx("p", { className: "[font-family:var(--modelsfind-display)] text-[1.7rem] leading-none text-white", children: product.name })
              ] })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "mt-5 grid gap-3", children: mobileStats.map((metric) => /* @__PURE__ */ jsxs(
              "div",
              {
                className: "flex items-center justify-between rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3",
                children: [
                  /* @__PURE__ */ jsx("span", { className: "text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: metric.label }),
                  /* @__PURE__ */ jsx("span", { className: "[font-family:var(--modelsfind-display)] text-[1.35rem] text-white", children: metric.value })
                ]
              },
              metric.label
            )) }),
            /* @__PURE__ */ jsxs("div", { className: "mt-5 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-4", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-primary)]", children: [
                /* @__PURE__ */ jsx(CalendarDays, { className: "h-4 w-4" }),
                "Reservation"
              ] }),
              /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]", children: previewPortrait.mood }),
              /* @__PURE__ */ jsxs("div", { className: "mt-4 flex items-center justify-between gap-3 text-[var(--modelsfind-copy)]", children: [
                /* @__PURE__ */ jsx("span", { children: "Rate" }),
                /* @__PURE__ */ jsx("span", { className: "text-white", children: formatPrice(currentVariant?.price || product.price) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "mt-3 flex items-center justify-between gap-3 text-[var(--modelsfind-copy)]", children: [
                /* @__PURE__ */ jsx("span", { children: "Location" }),
                /* @__PURE__ */ jsx("span", { className: "text-right text-white", children: previewPortrait.cities || previewPortrait.region })
              ] })
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: scrollToBookingForm,
                className: "mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)]",
                children: "Reserve for booking"
              }
            )
          ] }) })
        ] }) })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "fixed bottom-0 left-0 right-0 z-40 bg-[linear-gradient(180deg,rgba(8,8,12,0),rgba(8,8,12,0.94)_42%,rgba(8,8,12,1)_100%)] px-4 pb-8 pt-8 md:hidden hidden", children: /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: scrollToBookingForm,
          className: "w-full rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#140d16] shadow-[0_0_28px_var(--modelsfind-glow)]",
          children: "Reserve for booking"
        }
      ) })
    ] });
  });

  // src/components/ProductsPage.tsx
  function getProductImage2(product) {
    const mainImage = product.images?.find((image) => image.isMain) || product.images?.[0];
    return mainImage?.url || previewPortraits[0]?.image || "/placeholder-product.svg";
  }
  function getProductRegion(product) {
    const regionTag = product.tags?.find(
      (tag) => heroRegions.some((region) => tag.toLowerCase().includes(region.toLowerCase()))
    );
    return regionTag || product.category?.name || "Private directory";
  }
  function getProductSubtitle2(product) {
    return product.tags?.slice(0, 2).join(" \u2022 ") || "Editorial profile";
  }
  function getProductStatus(product) {
    const available = product.inventory?.available ?? 0;
    return available > 0 ? "Verified" : "Request only";
  }
  function formatPrice2(value) {
    if (!value) {
      return "Private rate";
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(value);
  }
  function MobileReelCard({
    product,
    region,
    image,
    onProductClick
  }) {
    return /* @__PURE__ */ jsxs("article", { className: "modelsfind-vignette relative h-[calc(100dvh-5.8rem)] snap-start overflow-hidden bg-[rgba(8,8,10,0.98)]", children: [
      /* @__PURE__ */ jsxs("button", { type: "button", onClick: () => onProductClick(product.id), className: "absolute inset-0", children: [
        /* @__PURE__ */ jsx("img", { src: image, alt: product.name, className: "h-full w-full object-cover" }),
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[linear-gradient(180deg,rgba(14,14,16,0.22),rgba(14,14,16,0.04)_26%,rgba(0,0,0,0.82)_100%)]" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "pointer-events-none absolute inset-0 flex flex-col justify-end px-6 pb-32", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-end justify-between gap-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "max-w-[70%]", children: [
            /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 rounded-full border border-[var(--modelsfind-line-strong)] bg-[rgba(255,122,251,0.12)] px-3 py-1", children: [
              /* @__PURE__ */ jsx("span", { className: "h-2 w-2 rounded-full bg-[var(--modelsfind-primary)]" }),
              /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.14rem] text-[var(--modelsfind-primary)]", children: getProductStatus(product) === "Verified" ? "Available tonight" : "Request only" })
            ] }),
            /* @__PURE__ */ jsx("h2", { className: "mt-4 [font-family:var(--modelsfind-display)] text-[3.4rem] font-bold leading-[0.86] tracking-[-0.06em] text-white", children: product.name }),
            /* @__PURE__ */ jsx("div", { className: "mt-2 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: /* @__PURE__ */ jsx("span", { children: region }) }),
            /* @__PURE__ */ jsx("p", { className: "mt-4 max-w-[16rem] text-sm leading-6 text-[color-mix(in_srgb,var(--modelsfind-copy)_90%,white)]", children: product.description || "Editorial excellence meets midnight allure. Swipe through profiles and open the one that fits the brief." })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "pointer-events-auto mb-3 flex flex-col items-center gap-5", children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => onProductClick(product.id),
                className: "relative rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] p-[2px]",
                "aria-label": "Open profile",
                children: [
                  /* @__PURE__ */ jsx("img", { src: image, alt: product.name, className: "h-14 w-14 rounded-full border-2 border-[rgba(8,8,10,0.95)] object-cover" }),
                  /* @__PURE__ */ jsx("span", { className: "absolute -bottom-1 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border-2 border-[rgba(8,8,10,0.95)] bg-[var(--modelsfind-primary)] text-[10px] font-bold text-[#210025]", children: "+" })
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => onProductClick(product.id),
                className: "flex flex-col items-center gap-1",
                "aria-label": "Save profile",
                children: [
                  /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] backdrop-blur-md", children: /* @__PURE__ */ jsx(Heart, { className: "h-5 w-5 text-[var(--modelsfind-primary)]" }) }),
                  /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold text-white/70", children: "2.4K" })
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => onProductClick(product.id),
                className: "flex flex-col items-center gap-1",
                "aria-label": "Reserve",
                children: [
                  /* @__PURE__ */ jsx("div", { className: "modelsfind-mobile-cta flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] text-[#210025]", children: /* @__PURE__ */ jsx(Bookmark, { className: "h-5 w-5" }) }),
                  /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold uppercase tracking-[0.08rem] text-[var(--modelsfind-primary)]", children: "Reserve" })
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => onProductClick(product.id),
                className: "flex flex-col items-center gap-1",
                "aria-label": "Share",
                children: [
                  /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] backdrop-blur-md", children: /* @__PURE__ */ jsx(Share2, { className: "h-5 w-5 text-white" }) }),
                  /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold text-white/65", children: "Share" })
                ]
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "pointer-events-none absolute bottom-24 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 opacity-40", children: [
          /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4 rotate-90" }),
          /* @__PURE__ */ jsx("span", { className: "text-[9px] uppercase tracking-[0.2em]", children: "Swipe for more" })
        ] })
      ] })
    ] });
  }
  var ProductsPage = react_default.memo(function ProductsPage2({
    products,
    isLoading,
    totalProducts,
    currentPage,
    totalPages,
    sortBy,
    viewMode,
    config,
    onSortChange,
    onViewModeChange,
    onPageChange,
    onProductClick,
    onSearch
  }) {
    const site = resolveModelsfindSiteConfig(config);
    const [searchQuery, setSearchQuery] = react_default.useState("");
    const [activeRegion, setActiveRegion] = react_default.useState(heroRegions[0]);
    const heroImage = products[0] ? getProductImage2(products[0]) : previewPortraits[0].image;
    const handleSearchSubmit = (event) => {
      event.preventDefault();
      onSearch?.(searchQuery.trim());
    };
    const handleRegionClick = (region) => {
      setActiveRegion(region);
      onSearch?.(region);
    };
    if (isLoading) {
      return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell flex min-h-screen items-center justify-center [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]", children: /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
        /* @__PURE__ */ jsx(LoaderCircle, { className: "mx-auto h-12 w-12 animate-spin text-[var(--modelsfind-primary)]" }),
        /* @__PURE__ */ jsx("p", { className: "mt-4 text-[11px] uppercase tracking-[0.28em] text-[var(--modelsfind-copy-soft)]", children: "Loading directory" })
      ] }) });
    }
    return /* @__PURE__ */ jsxs("div", { className: "modelsfind-shell min-h-screen pb-32 pt-0 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] md:px-6 md:pt-24 lg:px-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "md:hidden", children: [
        /* @__PURE__ */ jsxs("header", { className: "modelsfind-mobile-topbar fixed inset-x-0 top-0 z-[75] flex h-16 items-center justify-between px-6", children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: () => handleRegionClick(activeRegion),
              className: "inline-flex items-center gap-3 text-[var(--modelsfind-primary)]",
              children: [
                /* @__PURE__ */ jsx(Grid3x3, { className: "h-4 w-4" }),
                /* @__PURE__ */ jsx("span", { className: "[font-family:var(--modelsfind-display)] text-[1.35rem] italic tracking-[0.18em] uppercase", children: site.brandName })
              ]
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => onSearch?.(activeRegion),
              className: "inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--modelsfind-primary)]",
              "aria-label": "Search models",
              children: /* @__PURE__ */ jsx(Search, { className: "h-4 w-4" })
            }
          )
        ] }),
        /* @__PURE__ */ jsx("main", { className: "h-[calc(100dvh-1.2rem)] snap-y snap-mandatory overflow-y-auto", children: products.slice(0, 6).map((product) => /* @__PURE__ */ jsx(
          MobileReelCard,
          {
            product,
            region: getProductRegion(product),
            image: getProductImage2(product),
            onProductClick
          },
          product.id
        )) })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "hidden md:block", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1560px] xl:flex", children: [
        /* @__PURE__ */ jsxs("aside", { className: "modelsfind-frame hidden w-[16rem] shrink-0 rounded-l-[2rem] rounded-r-none border-r border-[var(--modelsfind-line)] xl:flex xl:min-h-[calc(100vh-8rem)] xl:flex-col xl:px-8 xl:py-8", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-[11px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]", children: "Regions" }),
            /* @__PURE__ */ jsx("h2", { className: "mt-2 [font-family:var(--modelsfind-display)] text-[2.1rem] leading-none tracking-[-0.04em] text-[var(--modelsfind-primary)]", children: "Global talent" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "mt-8 grid gap-2.5", children: heroRegions.map((region) => /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => handleRegionClick(region),
              className: [
                "rounded-[1rem] border px-4 py-4 text-left text-[11px] uppercase tracking-[0.18em] transition-all",
                activeRegion === region ? "border-[var(--modelsfind-line-strong)] bg-[rgba(255,255,255,0.06)] text-[var(--modelsfind-primary)]" : "border-[var(--modelsfind-line)] text-[var(--modelsfind-copy-soft)] hover:border-[var(--modelsfind-line-strong)] hover:text-[var(--modelsfind-ink)]"
              ].join(" "),
              children: region
            },
            region
          )) }),
          /* @__PURE__ */ jsxs("div", { className: "modelsfind-panel mt-8 rounded-[1.4rem] border border-[var(--modelsfind-line)] p-5", children: [
            /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]", children: "Indexed now" }),
            /* @__PURE__ */ jsx("p", { className: "mt-3 [font-family:var(--modelsfind-display)] text-[3rem] leading-none tracking-[-0.05em] text-white", children: totalProducts }),
            /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm leading-6 text-[var(--modelsfind-copy)]", children: "Live profiles available for booking-led storefronts and private shortlist reviews." })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "modelsfind-panel mt-auto rounded-[1.4rem] border border-[var(--modelsfind-line)] p-5", children: [
            /* @__PURE__ */ jsx("div", { className: "inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]", children: /* @__PURE__ */ jsx(WandSparkles, { className: "h-4 w-4" }) }),
            /* @__PURE__ */ jsx("p", { className: "mt-4 text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]", children: "AI concierge" }),
            /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm leading-6 text-[var(--modelsfind-copy)]", children: "Use natural language to jump from mood to shortlist without giving up the editorial presentation." })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "min-w-0 flex-1", children: /* @__PURE__ */ jsx("div", { className: "modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] xl:rounded-l-none xl:border-l-0", children: /* @__PURE__ */ jsxs("div", { className: "p-4 md:p-6 xl:p-8", children: [
          /* @__PURE__ */ jsxs("section", { className: "modelsfind-hero overflow-hidden rounded-[1.8rem] border border-[var(--modelsfind-line)]", children: [
            /* @__PURE__ */ jsx(
              "img",
              {
                src: heroImage,
                alt: site.headline,
                className: "absolute inset-0 h-full w-full object-cover grayscale opacity-45"
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "relative z-10 grid min-h-[24rem] gap-6 px-6 pb-8 pt-10 md:px-10 md:pb-10 md:pt-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end", children: [
              /* @__PURE__ */ jsxs("div", { className: "max-w-[40rem]", children: [
                /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.32em] text-[var(--modelsfind-primary)]", children: site.eyebrow }),
                /* @__PURE__ */ jsx("h1", { className: "mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.8rem,6vw,5rem)] leading-[0.92] tracking-[-0.05em] text-white", children: site.headline }),
                /* @__PURE__ */ jsxs("p", { className: "mt-4 max-w-[32rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: [
                  "Showing ",
                  totalProducts,
                  " profiles tuned for fast browse, discreet booking requests, and high-contrast editorial presentation."
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "modelsfind-panel rounded-[1.5rem] border border-[var(--modelsfind-line)] p-5", children: [
                /* @__PURE__ */ jsx("p", { className: "text-[9px] uppercase tracking-[0.2em] text-[var(--modelsfind-copy-soft)]", children: "Active region" }),
                /* @__PURE__ */ jsx("p", { className: "mt-2 [font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white", children: activeRegion }),
                /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]", children: "Sort by newest arrivals, name, or price while keeping the same cinematic card rhythm." })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("section", { className: "mt-6 xl:hidden", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-4", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]", children: "Selected regions" }),
              /* @__PURE__ */ jsx("div", { className: "h-px flex-1 bg-[var(--modelsfind-line)]" })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "mt-4 flex gap-2 overflow-x-auto pb-1", children: heroRegions.map((region) => /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => handleRegionClick(region),
                className: [
                  "whitespace-nowrap rounded-full border px-4 py-2.5 text-[10px] uppercase tracking-[0.18em]",
                  activeRegion === region ? "border-[var(--modelsfind-line-strong)] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]" : "border-[var(--modelsfind-line)] text-[var(--modelsfind-copy)]"
                ].join(" "),
                children: region
              },
              region
            )) })
          ] }),
          /* @__PURE__ */ jsx("section", { className: "modelsfind-panel mt-6 rounded-[1.6rem] border border-[var(--modelsfind-line)] p-4 md:p-5", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between", children: [
            /* @__PURE__ */ jsxs("form", { onSubmit: handleSearchSubmit, className: "relative flex-1", children: [
              /* @__PURE__ */ jsx(Search, { className: "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--modelsfind-copy-soft)]" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "search",
                  value: searchQuery,
                  onChange: (event) => setSearchQuery(event.target.value),
                  placeholder: "Search models, moods, cities, or looks",
                  className: "modelsfind-field h-12 w-full rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.05)] pl-11 pr-4 text-sm text-[var(--modelsfind-ink)] placeholder:text-[var(--modelsfind-copy-soft)]"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
              /* @__PURE__ */ jsxs("div", { className: "inline-flex h-12 items-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-copy)]", children: [
                /* @__PURE__ */ jsx(SlidersHorizontal, { className: "h-4 w-4 text-[var(--modelsfind-primary)]" }),
                totalProducts,
                " indexed"
              ] }),
              /* @__PURE__ */ jsxs(
                "select",
                {
                  value: sortBy,
                  onChange: (event) => onSortChange(event.target.value),
                  className: "modelsfind-field h-12 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-ink)]",
                  children: [
                    /* @__PURE__ */ jsx("option", { value: "createdAt", children: "Newest" }),
                    /* @__PURE__ */ jsx("option", { value: "name", children: "Name" }),
                    /* @__PURE__ */ jsx("option", { value: "price", children: "Price" })
                  ]
                }
              ),
              /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] p-1", children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => onViewModeChange("grid"),
                    className: [
                      "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                      viewMode === "grid" ? "bg-[var(--modelsfind-primary)] text-[#140d16]" : "text-[var(--modelsfind-copy)] hover:text-[var(--modelsfind-ink)]"
                    ].join(" "),
                    "aria-label": "Grid view",
                    children: /* @__PURE__ */ jsx(Grid3x3, { className: "h-4 w-4" })
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => onViewModeChange("list"),
                    className: [
                      "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                      viewMode === "list" ? "bg-[var(--modelsfind-primary)] text-[#140d16]" : "text-[var(--modelsfind-copy)] hover:text-[var(--modelsfind-ink)]"
                    ].join(" "),
                    "aria-label": "List view",
                    children: /* @__PURE__ */ jsx(List, { className: "h-4 w-4" })
                  }
                )
              ] })
            ] })
          ] }) }),
          products.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "mt-6 rounded-[1.8rem] border border-dashed border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-6 py-16 text-center", children: [
            /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]", children: "No profiles found" }),
            /* @__PURE__ */ jsx("h2", { className: "mt-4 [font-family:var(--modelsfind-display)] text-[2.6rem] leading-none tracking-[-0.04em] text-white", children: "Try a tighter region or a softer mood query." }),
            /* @__PURE__ */ jsx("p", { className: "mx-auto mt-4 max-w-[28rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: "The directory stays intentionally selective. Switch region lanes or use a broader mood search to surface more profiles." })
          ] }) : /* @__PURE__ */ jsx(
            "div",
            {
              className: [
                "mt-8 gap-5",
                viewMode === "grid" ? "grid md:grid-cols-2 2xl:grid-cols-3" : "grid gap-4"
              ].join(" "),
              children: products.map((product, index) => {
                const status = getProductStatus(product);
                const image = getProductImage2(product);
                const region = getProductRegion(product);
                return /* @__PURE__ */ jsxs(
                  "article",
                  {
                    className: [
                      "group overflow-hidden border border-[var(--modelsfind-line)] bg-[rgba(20,16,24,0.92)] transition-all duration-500 hover:-translate-y-1",
                      viewMode === "grid" ? "rounded-[1.5rem]" : "grid rounded-[1.6rem] md:grid-cols-[18rem_minmax(0,1fr)]",
                      viewMode === "grid" && index % 2 === 1 ? "md:translate-y-6" : ""
                    ].join(" "),
                    children: [
                      /* @__PURE__ */ jsx(
                        "button",
                        {
                          type: "button",
                          onClick: () => onProductClick(product.id),
                          className: "block w-full text-left",
                          children: /* @__PURE__ */ jsxs(
                            "div",
                            {
                              className: viewMode === "grid" ? "relative aspect-[0.76] overflow-hidden" : "relative h-full min-h-[17rem] overflow-hidden",
                              children: [
                                /* @__PURE__ */ jsx(
                                  "img",
                                  {
                                    src: image,
                                    alt: product.name,
                                    className: "h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-[1.03] group-hover:grayscale-0"
                                  }
                                ),
                                /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[linear-gradient(180deg,rgba(7,6,10,0.08),rgba(7,6,10,0.82))]" }),
                                /* @__PURE__ */ jsxs("div", { className: "absolute left-4 right-4 top-4 flex items-center justify-between gap-3", children: [
                                  /* @__PURE__ */ jsx("span", { className: "rounded-full border border-[var(--modelsfind-line-strong)] bg-[rgba(15,12,18,0.7)] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-primary)]", children: region }),
                                  /* @__PURE__ */ jsx(Heart, { className: "h-4 w-4 text-[var(--modelsfind-primary)] opacity-70 transition-opacity group-hover:opacity-100" })
                                ] }),
                                viewMode === "grid" ? /* @__PURE__ */ jsxs("div", { className: "absolute bottom-0 left-0 right-0 p-4", children: [
                                  /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: getProductSubtitle2(product) }),
                                  /* @__PURE__ */ jsx("h3", { className: "mt-2 [font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white", children: product.name })
                                ] }) : null
                              ]
                            }
                          )
                        }
                      ),
                      /* @__PURE__ */ jsxs("div", { className: "flex flex-col justify-between p-4 md:p-5", children: [
                        /* @__PURE__ */ jsxs("div", { children: [
                          viewMode === "list" ? /* @__PURE__ */ jsxs(Fragment2, { children: [
                            /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [
                              /* @__PURE__ */ jsxs("div", { children: [
                                /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]", children: status }),
                                /* @__PURE__ */ jsx("h3", { className: "mt-2 [font-family:var(--modelsfind-display)] text-[2.8rem] leading-none tracking-[-0.05em] text-white", children: product.name })
                              ] }),
                              /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.2em] text-[var(--modelsfind-copy-soft)]", children: formatPrice2(product.price) })
                            ] }),
                            /* @__PURE__ */ jsx("p", { className: "mt-4 max-w-[38rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: product.description || "Cinematic profile prepared for booking-first storefront presentation." })
                          ] }) : /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
                            /* @__PURE__ */ jsxs("div", { children: [
                              /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.2em] text-[var(--modelsfind-primary)]", children: status }),
                              /* @__PURE__ */ jsx("p", { className: "mt-2 text-[11px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: product.tags?.slice(0, 2).join(" \u2022 ") || region })
                            ] }),
                            /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: formatPrice2(product.price) })
                          ] }),
                          /* @__PURE__ */ jsx("div", { className: "mt-5 flex flex-wrap gap-2", children: [
                            status,
                            product.reviewCount ? `${product.reviewCount} reviews` : "Newly staged",
                            product.inventory?.available ? `${product.inventory.available} slots` : "By request"
                          ].map((item) => /* @__PURE__ */ jsx(
                            "span",
                            {
                              className: "rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[9px] uppercase tracking-[0.16em] text-[var(--modelsfind-copy)]",
                              children: item
                            },
                            item
                          )) })
                        ] }),
                        /* @__PURE__ */ jsx("div", { className: "mt-5 flex gap-2", children: /* @__PURE__ */ jsx(
                          "button",
                          {
                            type: "button",
                            onClick: () => onProductClick(product.id),
                            className: "inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)]",
                            children: "View profile"
                          }
                        ) })
                      ] })
                    ]
                  },
                  product.id
                );
              })
            }
          ),
          /* @__PURE__ */ jsxs("section", { className: "mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]", children: [
            /* @__PURE__ */ jsxs("div", { className: "modelsfind-panel rounded-[1.6rem] border border-[var(--modelsfind-line)] p-5", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]", children: "AI concierge" }),
              /* @__PURE__ */ jsx("h2", { className: "mt-3 [font-family:var(--modelsfind-display)] text-[2.3rem] leading-none tracking-[-0.04em] text-white", children: "Search like a stylist, not a spreadsheet." }),
              /* @__PURE__ */ jsx("p", { className: "mt-3 max-w-[36rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: "Use a mood sentence and let the directory respond with a sharper shortlist. This keeps the concierge concept alive inside a real browse flow." }),
              /* @__PURE__ */ jsx("div", { className: "mt-5 flex flex-wrap gap-2", children: conciergePrompts.map((prompt) => /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => {
                    setSearchQuery(prompt);
                    onSearch?.(prompt);
                  },
                  className: "rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 py-2 text-left text-[10px] uppercase tracking-[0.16em] text-[var(--modelsfind-copy)] transition-colors hover:border-[var(--modelsfind-line-strong)] hover:text-[var(--modelsfind-ink)]",
                  children: prompt
                },
                prompt
              )) })
            ] }),
            totalPages > 1 ? /* @__PURE__ */ jsxs("div", { className: "modelsfind-panel flex flex-col justify-between rounded-[1.6rem] border border-[var(--modelsfind-line)] p-5", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]", children: "Pagination" }),
                /* @__PURE__ */ jsx("p", { className: "mt-3 [font-family:var(--modelsfind-display)] text-[2.3rem] leading-none tracking-[-0.04em] text-white", children: currentPage }),
                /* @__PURE__ */ jsxs("p", { className: "mt-2 text-sm text-[var(--modelsfind-copy)]", children: [
                  "of ",
                  totalPages,
                  " pages staged"
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-2", children: [
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    type: "button",
                    onClick: () => onPageChange(Math.max(1, currentPage - 1)),
                    disabled: currentPage === 1,
                    className: "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-copy)] disabled:cursor-not-allowed disabled:opacity-40",
                    children: [
                      /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
                      "Previous"
                    ]
                  }
                ),
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    type: "button",
                    onClick: () => onPageChange(Math.min(totalPages, currentPage + 1)),
                    disabled: currentPage === totalPages,
                    className: "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-copy)] disabled:cursor-not-allowed disabled:opacity-40",
                    children: [
                      "Next",
                      /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4" })
                    ]
                  }
                )
              ] })
            ] }) : /* @__PURE__ */ jsxs("div", { className: "modelsfind-panel rounded-[1.6rem] border border-[var(--modelsfind-line)] p-5", children: [
              /* @__PURE__ */ jsx("div", { className: "inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]", children: /* @__PURE__ */ jsx(Sparkles, { className: "h-4 w-4" }) }),
              /* @__PURE__ */ jsx("p", { className: "mt-4 text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]", children: "Directory state" }),
              /* @__PURE__ */ jsx("p", { className: "mt-3 [font-family:var(--modelsfind-display)] text-[2.2rem] leading-none tracking-[-0.04em] text-white", children: "Single lane" }),
              /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]", children: "The current query fits on one page, so operators can stay focused without pagination friction." })
            ] })
          ] })
        ] }) }) })
      ] }) })
    ] });
  });

  // src/components/ProfilePage.tsx
  var ProfilePage = react_default.memo(function ProfilePage2({
    user,
    isLoading,
    isAuthenticated,
    onNavigateToSettings,
    onNavigateToOrders,
    onNavigateToLogin
  }) {
    if (isLoading) {
      return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell min-h-screen" });
    }
    if (!isAuthenticated || !user) {
      return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell flex min-h-screen items-center justify-center px-4 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]", children: /* @__PURE__ */ jsxs("div", { className: "modelsfind-panel max-w-[36rem] rounded-[2rem] border border-[var(--modelsfind-line)] p-8 text-center", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]", children: "Private account" }),
        /* @__PURE__ */ jsx("h1", { className: "mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.6rem,7vw,4rem)] leading-[0.92] tracking-[-0.05em] text-white", children: "Sign in to view your profile." }),
        /* @__PURE__ */ jsx("p", { className: "mx-auto mt-4 max-w-[28rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: "Profile and booking history stay behind the same refined access wall as the rest of the archive." }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: onNavigateToLogin,
            className: "mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)]",
            children: [
              /* @__PURE__ */ jsx(LogIn, { className: "h-4 w-4" }),
              "Sign in"
            ]
          }
        )
      ] }) });
    }
    const joinedDate = new Date(user.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
    return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell min-h-screen px-4 pb-32 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-[1560px]", children: /* @__PURE__ */ jsx("section", { className: "modelsfind-frame modelsfind-noise overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)]", children: /* @__PURE__ */ jsxs("div", { className: "p-4 md:p-6 xl:p-8", children: [
      /* @__PURE__ */ jsxs("section", { className: "modelsfind-hero overflow-hidden rounded-[1.8rem] border border-[var(--modelsfind-line)]", children: [
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_24%_22%,rgba(255,108,240,0.24),transparent_24%),radial-gradient(circle_at_78%_18%,rgba(214,184,255,0.14),transparent_20%),linear-gradient(180deg,rgba(10,8,14,0.82),rgba(10,8,14,0.96))]" }),
        /* @__PURE__ */ jsxs("div", { className: "relative z-10 grid min-h-[22rem] gap-6 px-6 pb-8 pt-10 md:px-10 md:pb-10 md:pt-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end", children: [
          /* @__PURE__ */ jsxs("div", { className: "max-w-[40rem]", children: [
            /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.32em] text-[var(--modelsfind-primary)]", children: "Private account" }),
            /* @__PURE__ */ jsx("h1", { className: "mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.8rem,6vw,5rem)] leading-[0.92] tracking-[-0.05em] text-white", children: user.name }),
            /* @__PURE__ */ jsx("p", { className: "mt-4 max-w-[34rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: "Keep profile actions and order history aligned with the same premium editorial mood as the storefront." })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "modelsfind-panel rounded-[1.5rem] border border-[var(--modelsfind-line)] p-5", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]", children: user.avatar ? /* @__PURE__ */ jsx("img", { src: user.avatar, alt: user.name, className: "h-full w-full rounded-[1rem] object-cover" }) : /* @__PURE__ */ jsx(UserRound, { className: "h-5 w-5" }) }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("p", { className: "text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Member since" }),
                /* @__PURE__ */ jsx("p", { className: "[font-family:var(--modelsfind-display)] text-[1.8rem] leading-none tracking-[-0.04em] text-white", children: joinedDate })
              ] })
            ] }),
            /* @__PURE__ */ jsx("p", { className: "mt-4 text-sm text-[var(--modelsfind-copy)]", children: user.email })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-10 grid gap-6 lg:grid-cols-2", children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: onNavigateToOrders,
            className: "group rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-6 text-left transition-transform duration-300 hover:-translate-y-1",
            children: [
              /* @__PURE__ */ jsx("div", { className: "inline-flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]", children: /* @__PURE__ */ jsx(ShoppingBag, { className: "h-5 w-5" }) }),
              /* @__PURE__ */ jsx("p", { className: "mt-5 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Orders" }),
              /* @__PURE__ */ jsx("h2", { className: "mt-2 [font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white", children: "Booking history" }),
              /* @__PURE__ */ jsx("p", { className: "mt-3 max-w-[28rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: "Review current and past requests without dropping back to the default account-center styling." })
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: onNavigateToSettings,
            className: "group rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-6 text-left transition-transform duration-300 hover:-translate-y-1",
            children: [
              /* @__PURE__ */ jsx("div", { className: "inline-flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]", children: /* @__PURE__ */ jsx(Settings2, { className: "h-5 w-5" }) }),
              /* @__PURE__ */ jsx("p", { className: "mt-5 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Preferences" }),
              /* @__PURE__ */ jsx("h2", { className: "mt-2 [font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white", children: "Settings" }),
              /* @__PURE__ */ jsx("p", { className: "mt-3 max-w-[28rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: "Update profile details, language, timezone, and account security from a mobile-friendly settings surface." })
            ]
          }
        )
      ] })
    ] }) }) }) });
  });

  // src/components/ProfileSettingsPage.tsx
  var ProfileSettingsPage = react_default.memo(function ProfileSettingsPage2({
    user,
    isLoading,
    isAuthenticated,
    onSaveProfile,
    onChangePassword,
    onNavigateBack,
    onNavigateToLogin
  }) {
    const [profile, setProfile] = react_default.useState({
      name: user?.name || "",
      phone: user?.phone || "",
      dateOfBirth: user?.dateOfBirth || "",
      gender: user?.gender || "OTHER",
      preferredLanguage: user?.preferredLanguage || "en",
      timezone: user?.timezone || "UTC"
    });
    const [password, setPassword] = react_default.useState({
      currentPassword: "",
      newPassword: ""
    });
    const [savingProfile, setSavingProfile] = react_default.useState(false);
    const [savingPassword, setSavingPassword] = react_default.useState(false);
    react_default.useEffect(() => {
      setProfile({
        name: user?.name || "",
        phone: user?.phone || "",
        dateOfBirth: user?.dateOfBirth || "",
        gender: user?.gender || "OTHER",
        preferredLanguage: user?.preferredLanguage || "en",
        timezone: user?.timezone || "UTC"
      });
    }, [user]);
    if (isLoading) {
      return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell min-h-screen" });
    }
    if (!isAuthenticated || !user) {
      return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell flex min-h-screen items-center justify-center px-4 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]", children: /* @__PURE__ */ jsxs("div", { className: "modelsfind-panel max-w-[36rem] rounded-[2rem] border border-[var(--modelsfind-line)] p-8 text-center", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]", children: "Private account" }),
        /* @__PURE__ */ jsx("h1", { className: "mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.6rem,7vw,4rem)] leading-[0.92] tracking-[-0.05em] text-white", children: "Sign in to manage your private archive access." }),
        /* @__PURE__ */ jsx("p", { className: "mx-auto mt-4 max-w-[28rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: "Keep profile details, language preferences, and security settings ready for the next shortlist session." }),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: onNavigateToLogin,
            className: "mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)]",
            children: "Sign in"
          }
        )
      ] }) });
    }
    return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell min-h-screen px-4 pb-32 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 sm:pt-24 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1560px]", children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: onNavigateBack,
          className: "inline-flex items-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-copy)]",
          children: [
            /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
            "Back"
          ]
        }
      ),
      /* @__PURE__ */ jsx("section", { className: "modelsfind-frame modelsfind-noise mt-4 overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)]", children: /* @__PURE__ */ jsxs("div", { className: "p-4 md:p-6 xl:p-8", children: [
        /* @__PURE__ */ jsxs("section", { className: "modelsfind-hero overflow-hidden rounded-[1.8rem] border border-[var(--modelsfind-line)]", children: [
          /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_24%_22%,rgba(255,108,240,0.24),transparent_24%),radial-gradient(circle_at_78%_18%,rgba(214,184,255,0.14),transparent_20%),linear-gradient(180deg,rgba(10,8,14,0.82),rgba(10,8,14,0.96))]" }),
          /* @__PURE__ */ jsxs("div", { className: "relative z-10 grid min-h-[22rem] gap-6 px-6 pb-8 pt-10 md:px-10 md:pb-10 md:pt-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end", children: [
            /* @__PURE__ */ jsxs("div", { className: "max-w-[40rem]", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.32em] text-[var(--modelsfind-primary)]", children: "Profile settings" }),
              /* @__PURE__ */ jsx("h1", { className: "mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.8rem,6vw,5rem)] leading-[0.92] tracking-[-0.05em] text-white", children: "Keep your private account polished for the next booking cycle." }),
              /* @__PURE__ */ jsx("p", { className: "mt-4 max-w-[34rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: "Treat settings like part of the premium flow: clear identity, minimal friction, and mobile-friendly controls." })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "modelsfind-panel rounded-[1.5rem] border border-[var(--modelsfind-line)] p-5", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]", children: /* @__PURE__ */ jsx(UserRound, { className: "h-5 w-5" }) }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("p", { className: "text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Account holder" }),
                  /* @__PURE__ */ jsx("p", { className: "[font-family:var(--modelsfind-display)] text-[1.8rem] leading-none tracking-[-0.04em] text-white", children: user.name })
                ] })
              ] }),
              /* @__PURE__ */ jsx("p", { className: "mt-4 text-sm text-[var(--modelsfind-copy)]", children: user.email })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "relative z-10 -mt-10 grid grid-cols-2 gap-3 px-1 md:-mt-12 md:grid-cols-4 md:gap-4 md:px-0", children: [
          { label: "Language", value: profile.preferredLanguage || "en" },
          { label: "Timezone", value: profile.timezone || "UTC" },
          { label: "Security", value: "Active" },
          { label: "Profile", value: profile.name ? "Ready" : "Draft" }
        ].map((metric, index) => /* @__PURE__ */ jsxs(
          "div",
          {
            className: "modelsfind-panel rounded-[1.25rem] border border-[var(--modelsfind-line)] p-4",
            children: [
              /* @__PURE__ */ jsx("p", { className: "text-[9px] uppercase tracking-[0.2em] text-[var(--modelsfind-copy-soft)]", children: metric.label }),
              /* @__PURE__ */ jsx("p", { className: index === 2 ? "mt-3 [font-family:var(--modelsfind-display)] text-[1.8rem] leading-none text-[var(--modelsfind-primary)]" : "mt-3 [font-family:var(--modelsfind-display)] text-[1.8rem] leading-none text-white", children: metric.value })
            ]
          },
          metric.label
        )) }),
        /* @__PURE__ */ jsxs("div", { className: "mt-10 grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(20rem,0.72fr)]", children: [
          /* @__PURE__ */ jsxs("section", { className: "rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-6", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4", children: [
              /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]", children: /* @__PURE__ */ jsx(UserRound, { className: "h-5 w-5" }) }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Identity" }),
                /* @__PURE__ */ jsx("h2", { className: "mt-2 [font-family:var(--modelsfind-display)] text-[2.1rem] leading-[0.96] tracking-[-0.05em] text-white", children: "Profile details" }),
                /* @__PURE__ */ jsx("p", { className: "mt-3 max-w-[34rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: "This section should feel like a premium mobile form, not a generic settings backend." })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-4 sm:grid-cols-2", children: [
              /* @__PURE__ */ jsxs("label", { className: "grid gap-2 sm:col-span-2", children: [
                /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Email" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    value: user.email,
                    readOnly: true,
                    className: "h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-copy)]"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("label", { className: "grid gap-2 sm:col-span-2", children: [
                /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Name" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    value: profile.name,
                    onChange: (event) => setProfile((prev) => ({ ...prev, name: event.target.value })),
                    className: "modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)]"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
                /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Phone" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    value: profile.phone,
                    onChange: (event) => setProfile((prev) => ({ ...prev, phone: event.target.value })),
                    className: "modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)]"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
                /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Date of birth" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    value: profile.dateOfBirth,
                    onChange: (event) => setProfile((prev) => ({ ...prev, dateOfBirth: event.target.value })),
                    className: "modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)]"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
                /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Language" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    value: profile.preferredLanguage,
                    onChange: (event) => setProfile((prev) => ({ ...prev, preferredLanguage: event.target.value })),
                    className: "modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)]"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
                /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Timezone" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    value: profile.timezone,
                    onChange: (event) => setProfile((prev) => ({ ...prev, timezone: event.target.value })),
                    className: "modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)]"
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: async () => {
                  setSavingProfile(true);
                  try {
                    await onSaveProfile(profile);
                  } finally {
                    setSavingProfile(false);
                  }
                },
                className: "mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)]",
                disabled: savingProfile,
                children: [
                  /* @__PURE__ */ jsx(Save, { className: "h-4 w-4" }),
                  savingProfile ? "Saving..." : "Save profile"
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "grid gap-6", children: [
            /* @__PURE__ */ jsxs("section", { className: "rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-6", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4", children: [
                /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]", children: /* @__PURE__ */ jsx(LockKeyhole, { className: "h-5 w-5" }) }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Security" }),
                  /* @__PURE__ */ jsx("h2", { className: "mt-2 [font-family:var(--modelsfind-display)] text-[2rem] leading-[0.96] tracking-[-0.05em] text-white", children: "Password controls" })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-4", children: [
                /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Current password" }),
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: "password",
                      value: password.currentPassword,
                      onChange: (event) => setPassword((prev) => ({ ...prev, currentPassword: event.target.value })),
                      className: "modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)]"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "New password" }),
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: "password",
                      value: password.newPassword,
                      onChange: (event) => setPassword((prev) => ({ ...prev, newPassword: event.target.value })),
                      className: "modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)]"
                    }
                  )
                ] })
              ] }),
              /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  onClick: async () => {
                    setSavingPassword(true);
                    try {
                      await onChangePassword(password.currentPassword, password.newPassword);
                      setPassword({ currentPassword: "", newPassword: "" });
                    } finally {
                      setSavingPassword(false);
                    }
                  },
                  className: "mt-6 inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-ink)]",
                  disabled: savingPassword,
                  children: [
                    /* @__PURE__ */ jsx(LockKeyhole, { className: "h-4 w-4 text-[var(--modelsfind-primary)]" }),
                    savingPassword ? "Updating..." : "Change password"
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("section", { className: "modelsfind-panel rounded-[1.6rem] border border-[var(--modelsfind-line)] p-6", children: [
              /* @__PURE__ */ jsx("div", { className: "inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]", children: /* @__PURE__ */ jsx(ShieldCheck, { className: "h-4 w-4" }) }),
              /* @__PURE__ */ jsx("p", { className: "mt-4 text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]", children: "Operator note" }),
              /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-7 text-[var(--modelsfind-copy)]", children: "Settings should stay calm and confidence-building on mobile. The account area is part of the premium product, not a disposable admin screen." }),
              /* @__PURE__ */ jsxs("div", { className: "mt-5 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--modelsfind-copy)]", children: [
                /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[var(--modelsfind-primary)]", children: [
                  /* @__PURE__ */ jsx(WandSparkles, { className: "h-4 w-4" }),
                  "Mobile guidance"
                ] }),
                /* @__PURE__ */ jsx("p", { className: "mt-3", children: "Keep primary actions close, avoid dense rows, and let each control breathe on smaller screens." })
              ] })
            ] })
          ] })
        ] })
      ] }) })
    ] }) });
  });

  // src/components/RegisterPage.tsx
  var RegisterPage = react_default.memo(function RegisterPage2({
    isLoading,
    error,
    config,
    onSubmit,
    onOAuthClick,
    onNavigateToLogin
  }) {
    const site = resolveModelsfindSiteConfig(config);
    const [formData, setFormData] = react_default.useState({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: ""
    });
    const [showPassword, setShowPassword] = react_default.useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = react_default.useState(false);
    const [acceptTerms, setAcceptTerms] = react_default.useState(false);
    const passwordsMatch = !formData.confirmPassword || formData.password === formData.confirmPassword;
    const canSubmit = Boolean(
      formData.firstName.trim() && formData.lastName.trim() && formData.email.trim() && formData.password && formData.confirmPassword
    ) && passwordsMatch && acceptTerms;
    const handleSubmit = async (event) => {
      event.preventDefault();
      if (!canSubmit) return;
      await onSubmit({
        ...formData,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim()
      });
    };
    return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell min-h-screen px-4 py-12 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-[1120px]", children: /* @__PURE__ */ jsx("section", { className: "modelsfind-frame modelsfind-noise overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)]", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-0 lg:grid-cols-[minmax(0,0.92fr)_minmax(24rem,0.84fr)]", children: [
      /* @__PURE__ */ jsxs("div", { className: "modelsfind-hero overflow-hidden border-b border-[var(--modelsfind-line)] lg:border-b-0 lg:border-r", children: [
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_24%_22%,rgba(255,108,240,0.24),transparent_24%),radial-gradient(circle_at_78%_18%,rgba(214,184,255,0.14),transparent_20%),linear-gradient(180deg,rgba(10,8,14,0.82),rgba(10,8,14,0.96))]" }),
        /* @__PURE__ */ jsxs("div", { className: "relative z-10 flex min-h-[24rem] flex-col justify-end px-6 pb-8 pt-12 md:px-10 md:pb-10", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.32em] text-[var(--modelsfind-primary)]", children: "Membership" }),
          /* @__PURE__ */ jsxs("h1", { className: "mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.9rem,7vw,5.2rem)] leading-[0.92] tracking-[-0.05em] text-white", children: [
            "Request a private ",
            site.brandName,
            " account."
          ] }),
          /* @__PURE__ */ jsx("p", { className: "mt-4 max-w-[32rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: "Registration should feel like a premium entry point, with minimal noise and mobile-first clarity." })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "p-5 md:p-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[30rem]", children: [
        /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]", children: [
          /* @__PURE__ */ jsx(Sparkles, { className: "h-4 w-4" }),
          "New account"
        ] }),
        /* @__PURE__ */ jsx("h2", { className: "mt-3 [font-family:var(--modelsfind-display)] text-[2.4rem] leading-none tracking-[-0.04em] text-white", children: "Create your access" }),
        error ? /* @__PURE__ */ jsx("div", { className: "mt-5 rounded-[1rem] border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-200", children: error }) : null,
        /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, className: "mt-6 grid gap-4", children: [
          /* @__PURE__ */ jsx("div", { className: "grid gap-4 sm:grid-cols-2", children: [
            ["firstName", "First name", "Ava"],
            ["lastName", "Last name", "Noir"]
          ].map(([key, label, placeholder]) => /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: label }),
            /* @__PURE__ */ jsxs("div", { className: "relative", children: [
              /* @__PURE__ */ jsx(UserRound, { className: "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--modelsfind-copy-soft)]" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "text",
                  value: formData[key],
                  onChange: (event) => setFormData((prev) => ({ ...prev, [key]: event.target.value })),
                  placeholder,
                  className: "modelsfind-field h-12 w-full rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] pl-11 pr-4 text-sm text-[var(--modelsfind-ink)] placeholder:text-[var(--modelsfind-copy-soft)]",
                  disabled: isLoading
                }
              )
            ] })
          ] }, key)) }),
          /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Email" }),
            /* @__PURE__ */ jsxs("div", { className: "relative", children: [
              /* @__PURE__ */ jsx(Mail, { className: "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--modelsfind-copy-soft)]" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "email",
                  value: formData.email,
                  onChange: (event) => setFormData((prev) => ({ ...prev, email: event.target.value })),
                  placeholder: "you@example.com",
                  className: "modelsfind-field h-12 w-full rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] pl-11 pr-4 text-sm text-[var(--modelsfind-ink)] placeholder:text-[var(--modelsfind-copy-soft)]",
                  disabled: isLoading
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Password" }),
            /* @__PURE__ */ jsxs("div", { className: "relative", children: [
              /* @__PURE__ */ jsx(LockKeyhole, { className: "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--modelsfind-copy-soft)]" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: showPassword ? "text" : "password",
                  value: formData.password,
                  onChange: (event) => setFormData((prev) => ({ ...prev, password: event.target.value })),
                  placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
                  className: "modelsfind-field h-12 w-full rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] pl-11 pr-12 text-sm text-[var(--modelsfind-ink)] placeholder:text-[var(--modelsfind-copy-soft)]",
                  disabled: isLoading
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => setShowPassword((value) => !value),
                  className: "absolute right-4 top-1/2 -translate-y-1/2 text-[var(--modelsfind-copy-soft)] transition-colors hover:text-[var(--modelsfind-ink)]",
                  children: showPassword ? /* @__PURE__ */ jsx(EyeOff, { className: "h-4 w-4" }) : /* @__PURE__ */ jsx(Eye, { className: "h-4 w-4" })
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]", children: "Confirm password" }),
            /* @__PURE__ */ jsxs("div", { className: "relative", children: [
              /* @__PURE__ */ jsx(LockKeyhole, { className: "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--modelsfind-copy-soft)]" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: showConfirmPassword ? "text" : "password",
                  value: formData.confirmPassword,
                  onChange: (event) => setFormData((prev) => ({ ...prev, confirmPassword: event.target.value })),
                  placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
                  className: "modelsfind-field h-12 w-full rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] pl-11 pr-12 text-sm text-[var(--modelsfind-ink)] placeholder:text-[var(--modelsfind-copy-soft)]",
                  disabled: isLoading
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => setShowConfirmPassword((value) => !value),
                  className: "absolute right-4 top-1/2 -translate-y-1/2 text-[var(--modelsfind-copy-soft)] transition-colors hover:text-[var(--modelsfind-ink)]",
                  children: showConfirmPassword ? /* @__PURE__ */ jsx(EyeOff, { className: "h-4 w-4" }) : /* @__PURE__ */ jsx(Eye, { className: "h-4 w-4" })
                }
              )
            ] })
          ] }),
          !passwordsMatch ? /* @__PURE__ */ jsx("p", { className: "text-xs text-red-300", children: "Passwords do not match." }) : null,
          /* @__PURE__ */ jsxs("label", { className: "flex items-start gap-3 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--modelsfind-copy)]", children: [
            /* @__PURE__ */ jsx("input", { type: "checkbox", checked: acceptTerms, onChange: (event) => setAcceptTerms(event.target.checked), className: "mt-1 h-4 w-4 rounded border-[var(--modelsfind-line)] bg-transparent" }),
            /* @__PURE__ */ jsx("span", { children: "I agree to the private access terms and archive usage policy." })
          ] }),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "submit",
              disabled: isLoading || !canSubmit,
              className: "mt-2 inline-flex min-h-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)] disabled:opacity-60",
              children: isLoading ? "Creating account..." : "Create account"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-4 flex flex-col gap-3", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => onOAuthClick("google"),
              className: "inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-ink)]",
              children: "Continue with Google"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: onNavigateToLogin,
              className: "text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)] transition-colors hover:text-[var(--modelsfind-primary)]",
              children: "Already have access? Sign in"
            }
          )
        ] })
      ] }) })
    ] }) }) }) });
  });

  // src/components/TermsPage.tsx
  var sections2 = [
    ["Acceptance", "Using this storefront implies acceptance of the production operator\u2019s terms, booking rules, and access requirements. Replace this template before public launch.", BadgeCheck],
    ["Private access", "Operators may restrict certain content, booking windows, or concierge features to approved users. Membership and access decisions should be documented in the live policy.", ShieldAlert],
    ["Booking conduct", "Bookings, cancellations, and scheduling requests should be governed by explicit house rules in production, including timelines, fees, and verification requirements.", Scale],
    ["Liability and disclaimers", "This theme includes placeholder language only. Production deployments should add operator-specific legal disclaimers, limitations of liability, and dispute procedures.", TriangleAlert],
    ["Policy updates", "Production terms should specify how changes are communicated, when they take effect, and which jurisdiction or governing law applies.", FileText]
  ];
  var TermsPage = react_default.memo(function TermsPage2(_) {
    return /* @__PURE__ */ jsx("div", { className: "modelsfind-shell min-h-screen px-4 pb-32 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-[1180px]", children: /* @__PURE__ */ jsxs("section", { className: "modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] p-4 md:p-6 xl:p-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "modelsfind-hero overflow-hidden rounded-[1.8rem] border border-[var(--modelsfind-line)]", children: [
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_24%_22%,rgba(255,108,240,0.24),transparent_24%),radial-gradient(circle_at_78%_18%,rgba(214,184,255,0.14),transparent_20%),linear-gradient(180deg,rgba(10,8,14,0.82),rgba(10,8,14,0.96))]" }),
        /* @__PURE__ */ jsxs("div", { className: "relative z-10 flex min-h-[22rem] flex-col justify-end px-6 pb-8 pt-10 md:px-10 md:pb-10 md:pt-12", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[10px] uppercase tracking-[0.32em] text-[var(--modelsfind-primary)]", children: "Terms" }),
          /* @__PURE__ */ jsx("h1", { className: "mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.8rem,7vw,4.8rem)] leading-[0.92] tracking-[-0.05em] text-white", children: "Terms framework for premium booking experiences." }),
          /* @__PURE__ */ jsx("p", { className: "mt-4 max-w-[34rem] text-sm leading-7 text-[var(--modelsfind-copy)]", children: "This is default theme text only. Production storefronts should replace it with complete legal language and enforceable booking terms." })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "mt-8 grid gap-4", children: sections2.map(([title, body, icon]) => {
        const Icon2 = icon;
        return /* @__PURE__ */ jsx(
          "article",
          {
            className: "rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-6",
            children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4", children: [
              /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]", children: /* @__PURE__ */ jsx(Icon2, { className: "h-5 w-5" }) }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("h2", { className: "[font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white", children: title }),
                /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-7 text-[var(--modelsfind-copy)]", children: body })
              ] })
            ] })
          },
          title
        );
      }) })
    ] }) }) });
  });

  // src/runtime.ts
  var theme = {
    components: {
      HomePage,
      ProductsPage,
      ProductDetailPage,
      CartPage,
      CheckoutPage,
      NotFound,
      BestsellersPage,
      NewArrivalsPage,
      CategoriesPage,
      SearchPage,
      OrdersPage,
      OrderDetailPage,
      OrderSuccessPage,
      OrderCancelledPage,
      ProfilePage,
      ProfileSettingsPage,
      ContactPage,
      HelpPage,
      PrivacyPage,
      TermsPage,
      DealsPage,
      LoginPage,
      RegisterPage,
      AuthCallbackPage,
      Header,
      Footer
    },
    defaultConfig: defaultModelsfindThemeConfig
  };
  var runtime_default = theme;
  return __toCommonJS(runtime_exports);
})();
