(() => {
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });

  // theme-host:react
  var React = globalThis.__JIFFOO_THEME_HOST__?.React;
  if (!React) {
    throw new Error("Theme runtime host bridge is missing React");
  }
  var react_default = React;
  var Children = React.Children;
  var Component = React.Component;
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
  var useInsertionEffect = React.useInsertionEffect || React.useLayoutEffect;
  var useLayoutEffect = React.useLayoutEffect;
  var useMemo = React.useMemo;
  var useReducer = React.useReducer;
  var useRef = React.useRef;
  var useState = React.useState;
  var useTransition = React.useTransition;

  // ../../../node_modules/lucide-react/dist/esm/shared/src/utils.js
  var toKebabCase = (string) => string.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  var mergeClasses = (...classes) => classes.filter((className, index, array) => {
    return Boolean(className) && className.trim() !== "" && array.indexOf(className) === index;
  }).join(" ").trim();

  // ../../../node_modules/lucide-react/dist/esm/defaultAttributes.js
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

  // ../../../node_modules/lucide-react/dist/esm/Icon.js
  var Icon = forwardRef(
    ({
      color: color2 = "currentColor",
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
          stroke: color2,
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

  // ../../../node_modules/lucide-react/dist/esm/createLucideIcon.js
  var createLucideIcon = (iconName, iconNode) => {
    const Component2 = forwardRef(
      ({ className, ...props }, ref) => createElement(Icon, {
        ref,
        iconNode,
        className: mergeClasses(`lucide-${toKebabCase(iconName)}`, className),
        ...props
      })
    );
    Component2.displayName = `${iconName}`;
    return Component2;
  };

  // ../../../node_modules/lucide-react/dist/esm/icons/apple.js
  var Apple = createLucideIcon("Apple", [
    [
      "path",
      {
        d: "M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z",
        key: "3s7exb"
      }
    ],
    ["path", { d: "M10 2c1 .5 2 2 2 5", key: "fcco2y" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/arrow-left.js
  var ArrowLeft = createLucideIcon("ArrowLeft", [
    ["path", { d: "m12 19-7-7 7-7", key: "1l729n" }],
    ["path", { d: "M19 12H5", key: "x3x0zl" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/arrow-right.js
  var ArrowRight = createLucideIcon("ArrowRight", [
    ["path", { d: "M5 12h14", key: "1ays0h" }],
    ["path", { d: "m12 5 7 7-7 7", key: "xquz4c" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/check.js
  var Check = createLucideIcon("Check", [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]]);

  // ../../../node_modules/lucide-react/dist/esm/icons/chevron-down.js
  var ChevronDown = createLucideIcon("ChevronDown", [
    ["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/chevron-left.js
  var ChevronLeft = createLucideIcon("ChevronLeft", [
    ["path", { d: "m15 18-6-6 6-6", key: "1wnfg3" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/chevron-right.js
  var ChevronRight = createLucideIcon("ChevronRight", [
    ["path", { d: "m9 18 6-6-6-6", key: "mthhwq" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/chrome.js
  var Chrome = createLucideIcon("Chrome", [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["circle", { cx: "12", cy: "12", r: "4", key: "4exip2" }],
    ["line", { x1: "21.17", x2: "12", y1: "8", y2: "8", key: "a0cw5f" }],
    ["line", { x1: "3.95", x2: "8.54", y1: "6.06", y2: "14", key: "1kftof" }],
    ["line", { x1: "10.88", x2: "15.46", y1: "21.94", y2: "14", key: "1ymyh8" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/circle-check.js
  var CircleCheck = createLucideIcon("CircleCheck", [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m9 12 2 2 4-4", key: "dzmm74" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/circle-help.js
  var CircleHelp = createLucideIcon("CircleHelp", [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", key: "1u773s" }],
    ["path", { d: "M12 17h.01", key: "p32p05" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/circle-x.js
  var CircleX = createLucideIcon("CircleX", [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m15 9-6 6", key: "1uzhvr" }],
    ["path", { d: "m9 9 6 6", key: "z0biqf" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/clock-3.js
  var Clock3 = createLucideIcon("Clock3", [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["polyline", { points: "12 6 12 12 16.5 12", key: "1aq6pp" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/copy.js
  var Copy = createLucideIcon("Copy", [
    ["rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2", key: "17jyea" }],
    ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2", key: "zix9uf" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/credit-card.js
  var CreditCard = createLucideIcon("CreditCard", [
    ["rect", { width: "20", height: "14", x: "2", y: "5", rx: "2", key: "ynyp8z" }],
    ["line", { x1: "2", x2: "22", y1: "10", y2: "10", key: "1b3vmo" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/earth.js
  var Earth = createLucideIcon("Earth", [
    ["path", { d: "M21.54 15H17a2 2 0 0 0-2 2v4.54", key: "1djwo0" }],
    [
      "path",
      {
        d: "M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17",
        key: "1tzkfa"
      }
    ],
    ["path", { d: "M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05", key: "14pb5j" }],
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/external-link.js
  var ExternalLink = createLucideIcon("ExternalLink", [
    ["path", { d: "M15 3h6v6", key: "1q9fwt" }],
    ["path", { d: "M10 14 21 3", key: "gplh6r" }],
    ["path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6", key: "a6xqqp" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/eye-off.js
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

  // ../../../node_modules/lucide-react/dist/esm/icons/eye.js
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

  // ../../../node_modules/lucide-react/dist/esm/icons/grid-3x3.js
  var Grid3x3 = createLucideIcon("Grid3x3", [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M3 9h18", key: "1pudct" }],
    ["path", { d: "M3 15h18", key: "5xshup" }],
    ["path", { d: "M9 3v18", key: "fh3hqa" }],
    ["path", { d: "M15 3v18", key: "14nvp0" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/headphones.js
  var Headphones = createLucideIcon("Headphones", [
    [
      "path",
      {
        d: "M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3",
        key: "1xhozi"
      }
    ]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/house.js
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

  // ../../../node_modules/lucide-react/dist/esm/icons/layout-grid.js
  var LayoutGrid = createLucideIcon("LayoutGrid", [
    ["rect", { width: "7", height: "7", x: "3", y: "3", rx: "1", key: "1g98yp" }],
    ["rect", { width: "7", height: "7", x: "14", y: "3", rx: "1", key: "6d4xhi" }],
    ["rect", { width: "7", height: "7", x: "14", y: "14", rx: "1", key: "nxv5o0" }],
    ["rect", { width: "7", height: "7", x: "3", y: "14", rx: "1", key: "1bb6yr" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/life-buoy.js
  var LifeBuoy = createLucideIcon("LifeBuoy", [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m4.93 4.93 4.24 4.24", key: "1ymg45" }],
    ["path", { d: "m14.83 9.17 4.24-4.24", key: "1cb5xl" }],
    ["path", { d: "m14.83 14.83 4.24 4.24", key: "q42g0n" }],
    ["path", { d: "m9.17 14.83-4.24 4.24", key: "bqpfvv" }],
    ["circle", { cx: "12", cy: "12", r: "4", key: "4exip2" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/list.js
  var List = createLucideIcon("List", [
    ["path", { d: "M3 12h.01", key: "nlz23k" }],
    ["path", { d: "M3 18h.01", key: "1tta3j" }],
    ["path", { d: "M3 6h.01", key: "1rqtza" }],
    ["path", { d: "M8 12h13", key: "1za7za" }],
    ["path", { d: "M8 18h13", key: "1lx6n3" }],
    ["path", { d: "M8 6h13", key: "ik3vkj" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/loader-circle.js
  var LoaderCircle = createLucideIcon("LoaderCircle", [
    ["path", { d: "M21 12a9 9 0 1 1-6.219-8.56", key: "13zald" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/lock-keyhole.js
  var LockKeyhole = createLucideIcon("LockKeyhole", [
    ["circle", { cx: "12", cy: "16", r: "1", key: "1au0dj" }],
    ["rect", { x: "3", y: "10", width: "18", height: "12", rx: "2", key: "6s8ecr" }],
    ["path", { d: "M7 10V7a5 5 0 0 1 10 0v3", key: "1pqi11" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/mail.js
  var Mail = createLucideIcon("Mail", [
    ["rect", { width: "20", height: "16", x: "2", y: "4", rx: "2", key: "18n3k1" }],
    ["path", { d: "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7", key: "1ocrg3" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/menu.js
  var Menu = createLucideIcon("Menu", [
    ["line", { x1: "4", x2: "20", y1: "12", y2: "12", key: "1e0a9i" }],
    ["line", { x1: "4", x2: "20", y1: "6", y2: "6", key: "1owob3" }],
    ["line", { x1: "4", x2: "20", y1: "18", y2: "18", key: "yk5zj1" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/minus.js
  var Minus = createLucideIcon("Minus", [["path", { d: "M5 12h14", key: "1ays0h" }]]);

  // ../../../node_modules/lucide-react/dist/esm/icons/package-2.js
  var Package2 = createLucideIcon("Package2", [
    ["path", { d: "M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z", key: "1ront0" }],
    ["path", { d: "m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9", key: "19h2x1" }],
    ["path", { d: "M12 3v6", key: "1holv5" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/package-check.js
  var PackageCheck = createLucideIcon("PackageCheck", [
    ["path", { d: "m16 16 2 2 4-4", key: "gfu2re" }],
    [
      "path",
      {
        d: "M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14",
        key: "e7tb2h"
      }
    ],
    ["path", { d: "m7.5 4.27 9 5.15", key: "1c824w" }],
    ["polyline", { points: "3.29 7 12 12 20.71 7", key: "ousv84" }],
    ["line", { x1: "12", x2: "12", y1: "22", y2: "12", key: "a4e8g8" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/plus.js
  var Plus = createLucideIcon("Plus", [
    ["path", { d: "M5 12h14", key: "1ays0h" }],
    ["path", { d: "M12 5v14", key: "s699le" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/qr-code.js
  var QrCode = createLucideIcon("QrCode", [
    ["rect", { width: "5", height: "5", x: "3", y: "3", rx: "1", key: "1tu5fj" }],
    ["rect", { width: "5", height: "5", x: "16", y: "3", rx: "1", key: "1v8r4q" }],
    ["rect", { width: "5", height: "5", x: "3", y: "16", rx: "1", key: "1x03jg" }],
    ["path", { d: "M21 16h-3a2 2 0 0 0-2 2v3", key: "177gqh" }],
    ["path", { d: "M21 21v.01", key: "ents32" }],
    ["path", { d: "M12 7v3a2 2 0 0 1-2 2H7", key: "8crl2c" }],
    ["path", { d: "M3 12h.01", key: "nlz23k" }],
    ["path", { d: "M12 3h.01", key: "n36tog" }],
    ["path", { d: "M12 16v.01", key: "133mhm" }],
    ["path", { d: "M16 12h1", key: "1slzba" }],
    ["path", { d: "M21 12v.01", key: "1lwtk9" }],
    ["path", { d: "M12 21v-1", key: "1880an" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/receipt-text.js
  var ReceiptText = createLucideIcon("ReceiptText", [
    [
      "path",
      { d: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z", key: "q3az6g" }
    ],
    ["path", { d: "M14 8H8", key: "1l3xfs" }],
    ["path", { d: "M16 12H8", key: "1fr5h0" }],
    ["path", { d: "M13 16H8", key: "wsln4y" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/refresh-cw.js
  var RefreshCw = createLucideIcon("RefreshCw", [
    ["path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", key: "v9h5vc" }],
    ["path", { d: "M21 3v5h-5", key: "1q7to0" }],
    ["path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", key: "3uifl3" }],
    ["path", { d: "M8 16H3v5", key: "1cv678" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/save.js
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

  // ../../../node_modules/lucide-react/dist/esm/icons/search.js
  var Search = createLucideIcon("Search", [
    ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }],
    ["path", { d: "m21 21-4.3-4.3", key: "1qie3q" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/shield-check.js
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

  // ../../../node_modules/lucide-react/dist/esm/icons/shopping-bag.js
  var ShoppingBag = createLucideIcon("ShoppingBag", [
    ["path", { d: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z", key: "hou9p0" }],
    ["path", { d: "M3 6h18", key: "d0wm0j" }],
    ["path", { d: "M16 10a4 4 0 0 1-8 0", key: "1ltviw" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/shopping-cart.js
  var ShoppingCart = createLucideIcon("ShoppingCart", [
    ["circle", { cx: "8", cy: "21", r: "1", key: "jimo8o" }],
    ["circle", { cx: "19", cy: "21", r: "1", key: "13723u" }],
    [
      "path",
      {
        d: "M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12",
        key: "9zh506"
      }
    ]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/signal.js
  var Signal = createLucideIcon("Signal", [
    ["path", { d: "M2 20h.01", key: "4haj6o" }],
    ["path", { d: "M7 20v-4", key: "j294jx" }],
    ["path", { d: "M12 20v-8", key: "i3yub9" }],
    ["path", { d: "M17 20V8", key: "1tkaf5" }],
    ["path", { d: "M22 4v16", key: "sih9yq" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/smartphone.js
  var Smartphone = createLucideIcon("Smartphone", [
    ["rect", { width: "14", height: "20", x: "5", y: "2", rx: "2", ry: "2", key: "1yt0o3" }],
    ["path", { d: "M12 18h.01", key: "mhygvu" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/sparkles.js
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

  // ../../../node_modules/lucide-react/dist/esm/icons/star.js
  var Star = createLucideIcon("Star", [
    [
      "path",
      {
        d: "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",
        key: "r04s7s"
      }
    ]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/trash-2.js
  var Trash2 = createLucideIcon("Trash2", [
    ["path", { d: "M3 6h18", key: "d0wm0j" }],
    ["path", { d: "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6", key: "4alrt4" }],
    ["path", { d: "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2", key: "v07s0e" }],
    ["line", { x1: "10", x2: "10", y1: "11", y2: "17", key: "1uufr5" }],
    ["line", { x1: "14", x2: "14", y1: "11", y2: "17", key: "xtxkd" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/triangle-alert.js
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

  // ../../../node_modules/lucide-react/dist/esm/icons/user-round.js
  var UserRound = createLucideIcon("UserRound", [
    ["circle", { cx: "12", cy: "8", r: "5", key: "1hypcn" }],
    ["path", { d: "M20 21a8 8 0 0 0-16 0", key: "rfgkzh" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/user.js
  var User = createLucideIcon("User", [
    ["path", { d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", key: "975kel" }],
    ["circle", { cx: "12", cy: "7", r: "4", key: "17ys0d" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/wallet-cards.js
  var WalletCards = createLucideIcon("WalletCards", [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2", key: "4125el" }],
    [
      "path",
      {
        d: "M3 11h3c.8 0 1.6.3 2.1.9l1.1.9c1.6 1.6 4.1 1.6 5.7 0l1.1-.9c.5-.5 1.3-.9 2.1-.9H21",
        key: "1dpki6"
      }
    ]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/wallet.js
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

  // ../../../node_modules/lucide-react/dist/esm/icons/x.js
  var X = createLucideIcon("X", [
    ["path", { d: "M18 6 6 18", key: "1bl5f8" }],
    ["path", { d: "m6 6 12 12", key: "d8bk6v" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/zap.js
  var Zap = createLucideIcon("Zap", [
    [
      "path",
      {
        d: "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",
        key: "1xq2db"
      }
    ]
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

  // ../../../node_modules/framer-motion/dist/es/context/LayoutGroupContext.mjs
  var LayoutGroupContext = createContext({});

  // ../../../node_modules/framer-motion/dist/es/utils/use-constant.mjs
  function useConstant(init) {
    const ref = useRef(null);
    if (ref.current === null) {
      ref.current = init();
    }
    return ref.current;
  }

  // ../../../node_modules/framer-motion/dist/es/context/PresenceContext.mjs
  var PresenceContext = createContext(null);

  // ../../../node_modules/framer-motion/dist/es/context/MotionConfigContext.mjs
  var MotionConfigContext = createContext({
    transformPagePoint: (p) => p,
    isStatic: false,
    reducedMotion: "never"
  });

  // ../../../node_modules/framer-motion/dist/es/components/AnimatePresence/PopChild.mjs
  var PopChildMeasure = class extends Component {
    getSnapshotBeforeUpdate(prevProps) {
      const element = this.props.childRef.current;
      if (element && prevProps.isPresent && !this.props.isPresent) {
        const size = this.props.sizeRef.current;
        size.height = element.offsetHeight || 0;
        size.width = element.offsetWidth || 0;
        size.top = element.offsetTop;
        size.left = element.offsetLeft;
      }
      return null;
    }
    /**
     * Required with getSnapshotBeforeUpdate to stop React complaining.
     */
    componentDidUpdate() {
    }
    render() {
      return this.props.children;
    }
  };
  function PopChild({ children, isPresent }) {
    const id3 = useId();
    const ref = useRef(null);
    const size = useRef({
      width: 0,
      height: 0,
      top: 0,
      left: 0
    });
    const { nonce } = useContext(MotionConfigContext);
    useInsertionEffect(() => {
      const { width, height, top, left } = size.current;
      if (isPresent || !ref.current || !width || !height)
        return;
      ref.current.dataset.motionPopId = id3;
      const style = document.createElement("style");
      if (nonce)
        style.nonce = nonce;
      document.head.appendChild(style);
      if (style.sheet) {
        style.sheet.insertRule(`
          [data-motion-pop-id="${id3}"] {
            position: absolute !important;
            width: ${width}px !important;
            height: ${height}px !important;
            top: ${top}px !important;
            left: ${left}px !important;
          }
        `);
      }
      return () => {
        document.head.removeChild(style);
      };
    }, [isPresent]);
    return jsx(PopChildMeasure, { isPresent, childRef: ref, sizeRef: size, children: cloneElement(children, { ref }) });
  }

  // ../../../node_modules/framer-motion/dist/es/components/AnimatePresence/PresenceChild.mjs
  var PresenceChild = ({ children, initial, isPresent, onExitComplete, custom, presenceAffectsLayout, mode }) => {
    const presenceChildren = useConstant(newChildrenMap);
    const id3 = useId();
    const memoizedOnExitComplete = useCallback((childId) => {
      presenceChildren.set(childId, true);
      for (const isComplete of presenceChildren.values()) {
        if (!isComplete)
          return;
      }
      onExitComplete && onExitComplete();
    }, [presenceChildren, onExitComplete]);
    const context = useMemo(
      () => ({
        id: id3,
        initial,
        isPresent,
        custom,
        onExitComplete: memoizedOnExitComplete,
        register: (childId) => {
          presenceChildren.set(childId, false);
          return () => presenceChildren.delete(childId);
        }
      }),
      /**
       * If the presence of a child affects the layout of the components around it,
       * we want to make a new context value to ensure they get re-rendered
       * so they can detect that layout change.
       */
      presenceAffectsLayout ? [Math.random(), memoizedOnExitComplete] : [isPresent, memoizedOnExitComplete]
    );
    useMemo(() => {
      presenceChildren.forEach((_, key) => presenceChildren.set(key, false));
    }, [isPresent]);
    useEffect(() => {
      !isPresent && !presenceChildren.size && onExitComplete && onExitComplete();
    }, [isPresent]);
    if (mode === "popLayout") {
      children = jsx(PopChild, { isPresent, children });
    }
    return jsx(PresenceContext.Provider, { value: context, children });
  };
  function newChildrenMap() {
    return /* @__PURE__ */ new Map();
  }

  // ../../../node_modules/framer-motion/dist/es/components/AnimatePresence/use-presence.mjs
  function usePresence(subscribe = true) {
    const context = useContext(PresenceContext);
    if (context === null)
      return [true, null];
    const { isPresent, onExitComplete, register } = context;
    const id3 = useId();
    useEffect(() => {
      if (subscribe)
        register(id3);
    }, [subscribe]);
    const safeToRemove = useCallback(() => subscribe && onExitComplete && onExitComplete(id3), [id3, onExitComplete, subscribe]);
    return !isPresent && onExitComplete ? [false, safeToRemove] : [true];
  }

  // ../../../node_modules/framer-motion/dist/es/components/AnimatePresence/utils.mjs
  var getChildKey = (child) => child.key || "";
  function onlyElements(children) {
    const filtered = [];
    Children.forEach(children, (child) => {
      if (isValidElement(child))
        filtered.push(child);
    });
    return filtered;
  }

  // ../../../node_modules/framer-motion/dist/es/utils/is-browser.mjs
  var isBrowser = typeof window !== "undefined";

  // ../../../node_modules/framer-motion/dist/es/utils/use-isomorphic-effect.mjs
  var useIsomorphicLayoutEffect = isBrowser ? useLayoutEffect : useEffect;

  // ../../../node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs
  var AnimatePresence = ({ children, custom, initial = true, onExitComplete, presenceAffectsLayout = true, mode = "sync", propagate = false }) => {
    const [isParentPresent, safeToRemove] = usePresence(propagate);
    const presentChildren = useMemo(() => onlyElements(children), [children]);
    const presentKeys = propagate && !isParentPresent ? [] : presentChildren.map(getChildKey);
    const isInitialRender = useRef(true);
    const pendingPresentChildren = useRef(presentChildren);
    const exitComplete = useConstant(() => /* @__PURE__ */ new Map());
    const [diffedChildren, setDiffedChildren] = useState(presentChildren);
    const [renderedChildren, setRenderedChildren] = useState(presentChildren);
    useIsomorphicLayoutEffect(() => {
      isInitialRender.current = false;
      pendingPresentChildren.current = presentChildren;
      for (let i = 0; i < renderedChildren.length; i++) {
        const key = getChildKey(renderedChildren[i]);
        if (!presentKeys.includes(key)) {
          if (exitComplete.get(key) !== true) {
            exitComplete.set(key, false);
          }
        } else {
          exitComplete.delete(key);
        }
      }
    }, [renderedChildren, presentKeys.length, presentKeys.join("-")]);
    const exitingChildren = [];
    if (presentChildren !== diffedChildren) {
      let nextChildren = [...presentChildren];
      for (let i = 0; i < renderedChildren.length; i++) {
        const child = renderedChildren[i];
        const key = getChildKey(child);
        if (!presentKeys.includes(key)) {
          nextChildren.splice(i, 0, child);
          exitingChildren.push(child);
        }
      }
      if (mode === "wait" && exitingChildren.length) {
        nextChildren = exitingChildren;
      }
      setRenderedChildren(onlyElements(nextChildren));
      setDiffedChildren(presentChildren);
      return;
    }
    if (mode === "wait" && renderedChildren.length > 1) {
      console.warn(`You're attempting to animate multiple children within AnimatePresence, but its mode is set to "wait". This will lead to odd visual behaviour.`);
    }
    const { forceRender } = useContext(LayoutGroupContext);
    return jsx(Fragment2, { children: renderedChildren.map((child) => {
      const key = getChildKey(child);
      const isPresent = propagate && !isParentPresent ? false : presentChildren === renderedChildren || presentKeys.includes(key);
      const onExit = () => {
        if (exitComplete.has(key)) {
          exitComplete.set(key, true);
        } else {
          return;
        }
        let isEveryExitComplete = true;
        exitComplete.forEach((isExitComplete) => {
          if (!isExitComplete)
            isEveryExitComplete = false;
        });
        if (isEveryExitComplete) {
          forceRender === null || forceRender === void 0 ? void 0 : forceRender();
          setRenderedChildren(pendingPresentChildren.current);
          propagate && (safeToRemove === null || safeToRemove === void 0 ? void 0 : safeToRemove());
          onExitComplete && onExitComplete();
        }
      };
      return jsx(PresenceChild, { isPresent, initial: !isInitialRender.current || initial ? void 0 : false, custom: isPresent ? void 0 : custom, presenceAffectsLayout, mode, onExitComplete: isPresent ? void 0 : onExit, children: child }, key);
    }) });
  };

  // ../../../node_modules/motion-utils/dist/es/noop.mjs
  var noop = /* @__NO_SIDE_EFFECTS__ */ (any) => any;

  // ../../../node_modules/motion-utils/dist/es/errors.mjs
  var warning = noop;
  var invariant = noop;
  if (true) {
    warning = (check, message) => {
      if (!check && typeof console !== "undefined") {
        console.warn(message);
      }
    };
    invariant = (check, message) => {
      if (!check) {
        throw new Error(message);
      }
    };
  }

  // ../../../node_modules/motion-utils/dist/es/memo.mjs
  // @__NO_SIDE_EFFECTS__
  function memo2(callback) {
    let result;
    return () => {
      if (result === void 0)
        result = callback();
      return result;
    };
  }

  // ../../../node_modules/motion-utils/dist/es/progress.mjs
  var progress = /* @__NO_SIDE_EFFECTS__ */ (from, to, value) => {
    const toFromDifference = to - from;
    return toFromDifference === 0 ? 1 : (value - from) / toFromDifference;
  };

  // ../../../node_modules/motion-utils/dist/es/time-conversion.mjs
  var secondsToMilliseconds = /* @__NO_SIDE_EFFECTS__ */ (seconds) => seconds * 1e3;
  var millisecondsToSeconds = /* @__NO_SIDE_EFFECTS__ */ (milliseconds) => milliseconds / 1e3;

  // ../../../node_modules/framer-motion/dist/es/utils/GlobalConfig.mjs
  var MotionGlobalConfig = {
    skipAnimations: false,
    useManualTiming: false
  };

  // ../../../node_modules/framer-motion/dist/es/frameloop/render-step.mjs
  function createRenderStep(runNextFrame) {
    let thisFrame = /* @__PURE__ */ new Set();
    let nextFrame = /* @__PURE__ */ new Set();
    let isProcessing = false;
    let flushNextFrame = false;
    const toKeepAlive = /* @__PURE__ */ new WeakSet();
    let latestFrameData = {
      delta: 0,
      timestamp: 0,
      isProcessing: false
    };
    function triggerCallback(callback) {
      if (toKeepAlive.has(callback)) {
        step.schedule(callback);
        runNextFrame();
      }
      callback(latestFrameData);
    }
    const step = {
      /**
       * Schedule a process to run on the next frame.
       */
      schedule: (callback, keepAlive = false, immediate = false) => {
        const addToCurrentFrame = immediate && isProcessing;
        const queue = addToCurrentFrame ? thisFrame : nextFrame;
        if (keepAlive)
          toKeepAlive.add(callback);
        if (!queue.has(callback))
          queue.add(callback);
        return callback;
      },
      /**
       * Cancel the provided callback from running on the next frame.
       */
      cancel: (callback) => {
        nextFrame.delete(callback);
        toKeepAlive.delete(callback);
      },
      /**
       * Execute all schedule callbacks.
       */
      process: (frameData2) => {
        latestFrameData = frameData2;
        if (isProcessing) {
          flushNextFrame = true;
          return;
        }
        isProcessing = true;
        [thisFrame, nextFrame] = [nextFrame, thisFrame];
        thisFrame.forEach(triggerCallback);
        thisFrame.clear();
        isProcessing = false;
        if (flushNextFrame) {
          flushNextFrame = false;
          step.process(frameData2);
        }
      }
    };
    return step;
  }

  // ../../../node_modules/framer-motion/dist/es/frameloop/batcher.mjs
  var stepsOrder = [
    "read",
    // Read
    "resolveKeyframes",
    // Write/Read/Write/Read
    "update",
    // Compute
    "preRender",
    // Compute
    "render",
    // Write
    "postRender"
    // Compute
  ];
  var maxElapsed = 40;
  function createRenderBatcher(scheduleNextBatch, allowKeepAlive) {
    let runNextFrame = false;
    let useDefaultElapsed = true;
    const state = {
      delta: 0,
      timestamp: 0,
      isProcessing: false
    };
    const flagRunNextFrame = () => runNextFrame = true;
    const steps = stepsOrder.reduce((acc, key) => {
      acc[key] = createRenderStep(flagRunNextFrame);
      return acc;
    }, {});
    const { read, resolveKeyframes, update, preRender, render, postRender } = steps;
    const processBatch = () => {
      const timestamp = MotionGlobalConfig.useManualTiming ? state.timestamp : performance.now();
      runNextFrame = false;
      state.delta = useDefaultElapsed ? 1e3 / 60 : Math.max(Math.min(timestamp - state.timestamp, maxElapsed), 1);
      state.timestamp = timestamp;
      state.isProcessing = true;
      read.process(state);
      resolveKeyframes.process(state);
      update.process(state);
      preRender.process(state);
      render.process(state);
      postRender.process(state);
      state.isProcessing = false;
      if (runNextFrame && allowKeepAlive) {
        useDefaultElapsed = false;
        scheduleNextBatch(processBatch);
      }
    };
    const wake = () => {
      runNextFrame = true;
      useDefaultElapsed = true;
      if (!state.isProcessing) {
        scheduleNextBatch(processBatch);
      }
    };
    const schedule = stepsOrder.reduce((acc, key) => {
      const step = steps[key];
      acc[key] = (process2, keepAlive = false, immediate = false) => {
        if (!runNextFrame)
          wake();
        return step.schedule(process2, keepAlive, immediate);
      };
      return acc;
    }, {});
    const cancel = (process2) => {
      for (let i = 0; i < stepsOrder.length; i++) {
        steps[stepsOrder[i]].cancel(process2);
      }
    };
    return { schedule, cancel, state, steps };
  }

  // ../../../node_modules/framer-motion/dist/es/frameloop/frame.mjs
  var { schedule: frame, cancel: cancelFrame, state: frameData, steps: frameSteps } = createRenderBatcher(typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame : noop, true);

  // ../../../node_modules/framer-motion/dist/es/context/LazyContext.mjs
  var LazyContext = createContext({ strict: false });

  // ../../../node_modules/framer-motion/dist/es/motion/features/definitions.mjs
  var featureProps = {
    animation: [
      "animate",
      "variants",
      "whileHover",
      "whileTap",
      "exit",
      "whileInView",
      "whileFocus",
      "whileDrag"
    ],
    exit: ["exit"],
    drag: ["drag", "dragControls"],
    focus: ["whileFocus"],
    hover: ["whileHover", "onHoverStart", "onHoverEnd"],
    tap: ["whileTap", "onTap", "onTapStart", "onTapCancel"],
    pan: ["onPan", "onPanStart", "onPanSessionStart", "onPanEnd"],
    inView: ["whileInView", "onViewportEnter", "onViewportLeave"],
    layout: ["layout", "layoutId"]
  };
  var featureDefinitions = {};
  for (const key in featureProps) {
    featureDefinitions[key] = {
      isEnabled: (props) => featureProps[key].some((name) => !!props[name])
    };
  }

  // ../../../node_modules/framer-motion/dist/es/motion/features/load-features.mjs
  function loadFeatures(features) {
    for (const key in features) {
      featureDefinitions[key] = {
        ...featureDefinitions[key],
        ...features[key]
      };
    }
  }

  // ../../../node_modules/framer-motion/dist/es/motion/utils/valid-prop.mjs
  var validMotionProps = /* @__PURE__ */ new Set([
    "animate",
    "exit",
    "variants",
    "initial",
    "style",
    "values",
    "variants",
    "transition",
    "transformTemplate",
    "custom",
    "inherit",
    "onBeforeLayoutMeasure",
    "onAnimationStart",
    "onAnimationComplete",
    "onUpdate",
    "onDragStart",
    "onDrag",
    "onDragEnd",
    "onMeasureDragConstraints",
    "onDirectionLock",
    "onDragTransitionEnd",
    "_dragX",
    "_dragY",
    "onHoverStart",
    "onHoverEnd",
    "onViewportEnter",
    "onViewportLeave",
    "globalTapTarget",
    "ignoreStrict",
    "viewport"
  ]);
  function isValidMotionProp(key) {
    return key.startsWith("while") || key.startsWith("drag") && key !== "draggable" || key.startsWith("layout") || key.startsWith("onTap") || key.startsWith("onPan") || key.startsWith("onLayout") || validMotionProps.has(key);
  }

  // ../../../node_modules/framer-motion/dist/es/render/dom/utils/filter-props.mjs
  var shouldForward = (key) => !isValidMotionProp(key);
  function loadExternalIsValidProp(isValidProp) {
    if (!isValidProp)
      return;
    shouldForward = (key) => key.startsWith("on") ? !isValidMotionProp(key) : isValidProp(key);
  }
  try {
    loadExternalIsValidProp(__require("@emotion/is-prop-valid").default);
  } catch (_a) {
  }
  function filterProps(props, isDom, forwardMotionProps) {
    const filteredProps = {};
    for (const key in props) {
      if (key === "values" && typeof props.values === "object")
        continue;
      if (shouldForward(key) || forwardMotionProps === true && isValidMotionProp(key) || !isDom && !isValidMotionProp(key) || // If trying to use native HTML drag events, forward drag listeners
      props["draggable"] && key.startsWith("onDrag")) {
        filteredProps[key] = props[key];
      }
    }
    return filteredProps;
  }

  // ../../../node_modules/framer-motion/dist/es/utils/warn-once.mjs
  var warned = /* @__PURE__ */ new Set();
  function warnOnce(condition, message, element) {
    if (condition || warned.has(message))
      return;
    console.warn(message);
    if (element)
      console.warn(element);
    warned.add(message);
  }

  // ../../../node_modules/framer-motion/dist/es/render/components/create-proxy.mjs
  function createDOMMotionComponentProxy(componentFactory) {
    if (typeof Proxy === "undefined") {
      return componentFactory;
    }
    const componentCache = /* @__PURE__ */ new Map();
    const deprecatedFactoryFunction = (...args) => {
      if (true) {
        warnOnce(false, "motion() is deprecated. Use motion.create() instead.");
      }
      return componentFactory(...args);
    };
    return new Proxy(deprecatedFactoryFunction, {
      /**
       * Called when `motion` is referenced with a prop: `motion.div`, `motion.input` etc.
       * The prop name is passed through as `key` and we can use that to generate a `motion`
       * DOM component with that name.
       */
      get: (_target, key) => {
        if (key === "create")
          return componentFactory;
        if (!componentCache.has(key)) {
          componentCache.set(key, componentFactory(key));
        }
        return componentCache.get(key);
      }
    });
  }

  // ../../../node_modules/framer-motion/dist/es/context/MotionContext/index.mjs
  var MotionContext = createContext({});

  // ../../../node_modules/framer-motion/dist/es/render/utils/is-variant-label.mjs
  function isVariantLabel(v) {
    return typeof v === "string" || Array.isArray(v);
  }

  // ../../../node_modules/framer-motion/dist/es/animation/utils/is-animation-controls.mjs
  function isAnimationControls(v) {
    return v !== null && typeof v === "object" && typeof v.start === "function";
  }

  // ../../../node_modules/framer-motion/dist/es/render/utils/variant-props.mjs
  var variantPriorityOrder = [
    "animate",
    "whileInView",
    "whileFocus",
    "whileHover",
    "whileTap",
    "whileDrag",
    "exit"
  ];
  var variantProps = ["initial", ...variantPriorityOrder];

  // ../../../node_modules/framer-motion/dist/es/render/utils/is-controlling-variants.mjs
  function isControllingVariants(props) {
    return isAnimationControls(props.animate) || variantProps.some((name) => isVariantLabel(props[name]));
  }
  function isVariantNode(props) {
    return Boolean(isControllingVariants(props) || props.variants);
  }

  // ../../../node_modules/framer-motion/dist/es/context/MotionContext/utils.mjs
  function getCurrentTreeVariants(props, context) {
    if (isControllingVariants(props)) {
      const { initial, animate } = props;
      return {
        initial: initial === false || isVariantLabel(initial) ? initial : void 0,
        animate: isVariantLabel(animate) ? animate : void 0
      };
    }
    return props.inherit !== false ? context : {};
  }

  // ../../../node_modules/framer-motion/dist/es/context/MotionContext/create.mjs
  function useCreateMotionContext(props) {
    const { initial, animate } = getCurrentTreeVariants(props, useContext(MotionContext));
    return useMemo(() => ({ initial, animate }), [variantLabelsAsDependency(initial), variantLabelsAsDependency(animate)]);
  }
  function variantLabelsAsDependency(prop) {
    return Array.isArray(prop) ? prop.join(" ") : prop;
  }

  // ../../../node_modules/framer-motion/dist/es/motion/utils/symbol.mjs
  var motionComponentSymbol = /* @__PURE__ */ Symbol.for("motionComponentSymbol");

  // ../../../node_modules/framer-motion/dist/es/utils/is-ref-object.mjs
  function isRefObject(ref) {
    return ref && typeof ref === "object" && Object.prototype.hasOwnProperty.call(ref, "current");
  }

  // ../../../node_modules/framer-motion/dist/es/motion/utils/use-motion-ref.mjs
  function useMotionRef(visualState, visualElement, externalRef) {
    return useCallback(
      (instance) => {
        if (instance) {
          visualState.onMount && visualState.onMount(instance);
        }
        if (visualElement) {
          if (instance) {
            visualElement.mount(instance);
          } else {
            visualElement.unmount();
          }
        }
        if (externalRef) {
          if (typeof externalRef === "function") {
            externalRef(instance);
          } else if (isRefObject(externalRef)) {
            externalRef.current = instance;
          }
        }
      },
      /**
       * Only pass a new ref callback to React if we've received a visual element
       * factory. Otherwise we'll be mounting/remounting every time externalRef
       * or other dependencies change.
       */
      [visualElement]
    );
  }

  // ../../../node_modules/framer-motion/dist/es/render/dom/utils/camel-to-dash.mjs
  var camelToDash = (str) => str.replace(/([a-z])([A-Z])/gu, "$1-$2").toLowerCase();

  // ../../../node_modules/framer-motion/dist/es/animation/optimized-appear/data-id.mjs
  var optimizedAppearDataId = "framerAppearId";
  var optimizedAppearDataAttribute = "data-" + camelToDash(optimizedAppearDataId);

  // ../../../node_modules/framer-motion/dist/es/frameloop/microtask.mjs
  var { schedule: microtask, cancel: cancelMicrotask } = createRenderBatcher(queueMicrotask, false);

  // ../../../node_modules/framer-motion/dist/es/context/SwitchLayoutGroupContext.mjs
  var SwitchLayoutGroupContext = createContext({});

  // ../../../node_modules/framer-motion/dist/es/motion/utils/use-visual-element.mjs
  function useVisualElement(Component2, visualState, props, createVisualElement, ProjectionNodeConstructor) {
    var _a, _b;
    const { visualElement: parent } = useContext(MotionContext);
    const lazyContext = useContext(LazyContext);
    const presenceContext = useContext(PresenceContext);
    const reducedMotionConfig = useContext(MotionConfigContext).reducedMotion;
    const visualElementRef = useRef(null);
    createVisualElement = createVisualElement || lazyContext.renderer;
    if (!visualElementRef.current && createVisualElement) {
      visualElementRef.current = createVisualElement(Component2, {
        visualState,
        parent,
        props,
        presenceContext,
        blockInitialAnimation: presenceContext ? presenceContext.initial === false : false,
        reducedMotionConfig
      });
    }
    const visualElement = visualElementRef.current;
    const initialLayoutGroupConfig = useContext(SwitchLayoutGroupContext);
    if (visualElement && !visualElement.projection && ProjectionNodeConstructor && (visualElement.type === "html" || visualElement.type === "svg")) {
      createProjectionNode(visualElementRef.current, props, ProjectionNodeConstructor, initialLayoutGroupConfig);
    }
    const isMounted = useRef(false);
    useInsertionEffect(() => {
      if (visualElement && isMounted.current) {
        visualElement.update(props, presenceContext);
      }
    });
    const optimisedAppearId = props[optimizedAppearDataAttribute];
    const wantsHandoff = useRef(Boolean(optimisedAppearId) && !((_a = window.MotionHandoffIsComplete) === null || _a === void 0 ? void 0 : _a.call(window, optimisedAppearId)) && ((_b = window.MotionHasOptimisedAnimation) === null || _b === void 0 ? void 0 : _b.call(window, optimisedAppearId)));
    useIsomorphicLayoutEffect(() => {
      if (!visualElement)
        return;
      isMounted.current = true;
      window.MotionIsMounted = true;
      visualElement.updateFeatures();
      microtask.render(visualElement.render);
      if (wantsHandoff.current && visualElement.animationState) {
        visualElement.animationState.animateChanges();
      }
    });
    useEffect(() => {
      if (!visualElement)
        return;
      if (!wantsHandoff.current && visualElement.animationState) {
        visualElement.animationState.animateChanges();
      }
      if (wantsHandoff.current) {
        queueMicrotask(() => {
          var _a2;
          (_a2 = window.MotionHandoffMarkAsComplete) === null || _a2 === void 0 ? void 0 : _a2.call(window, optimisedAppearId);
        });
        wantsHandoff.current = false;
      }
    });
    return visualElement;
  }
  function createProjectionNode(visualElement, props, ProjectionNodeConstructor, initialPromotionConfig) {
    const { layoutId, layout: layout2, drag: drag2, dragConstraints, layoutScroll, layoutRoot } = props;
    visualElement.projection = new ProjectionNodeConstructor(visualElement.latestValues, props["data-framer-portal-id"] ? void 0 : getClosestProjectingNode(visualElement.parent));
    visualElement.projection.setOptions({
      layoutId,
      layout: layout2,
      alwaysMeasureLayout: Boolean(drag2) || dragConstraints && isRefObject(dragConstraints),
      visualElement,
      /**
       * TODO: Update options in an effect. This could be tricky as it'll be too late
       * to update by the time layout animations run.
       * We also need to fix this safeToRemove by linking it up to the one returned by usePresence,
       * ensuring it gets called if there's no potential layout animations.
       *
       */
      animationType: typeof layout2 === "string" ? layout2 : "both",
      initialPromotionConfig,
      layoutScroll,
      layoutRoot
    });
  }
  function getClosestProjectingNode(visualElement) {
    if (!visualElement)
      return void 0;
    return visualElement.options.allowProjection !== false ? visualElement.projection : getClosestProjectingNode(visualElement.parent);
  }

  // ../../../node_modules/framer-motion/dist/es/motion/index.mjs
  function createRendererMotionComponent({ preloadedFeatures, createVisualElement, useRender, useVisualState, Component: Component2 }) {
    var _a, _b;
    preloadedFeatures && loadFeatures(preloadedFeatures);
    function MotionComponent(props, externalRef) {
      let MeasureLayout2;
      const configAndProps = {
        ...useContext(MotionConfigContext),
        ...props,
        layoutId: useLayoutId(props)
      };
      const { isStatic } = configAndProps;
      const context = useCreateMotionContext(props);
      const visualState = useVisualState(props, isStatic);
      if (!isStatic && isBrowser) {
        useStrictMode(configAndProps, preloadedFeatures);
        const layoutProjection = getProjectionFunctionality(configAndProps);
        MeasureLayout2 = layoutProjection.MeasureLayout;
        context.visualElement = useVisualElement(Component2, visualState, configAndProps, createVisualElement, layoutProjection.ProjectionNode);
      }
      return jsxs(MotionContext.Provider, { value: context, children: [MeasureLayout2 && context.visualElement ? jsx(MeasureLayout2, { visualElement: context.visualElement, ...configAndProps }) : null, useRender(Component2, props, useMotionRef(visualState, context.visualElement, externalRef), visualState, isStatic, context.visualElement)] });
    }
    MotionComponent.displayName = `motion.${typeof Component2 === "string" ? Component2 : `create(${(_b = (_a = Component2.displayName) !== null && _a !== void 0 ? _a : Component2.name) !== null && _b !== void 0 ? _b : ""})`}`;
    const ForwardRefMotionComponent = forwardRef(MotionComponent);
    ForwardRefMotionComponent[motionComponentSymbol] = Component2;
    return ForwardRefMotionComponent;
  }
  function useLayoutId({ layoutId }) {
    const layoutGroupId = useContext(LayoutGroupContext).id;
    return layoutGroupId && layoutId !== void 0 ? layoutGroupId + "-" + layoutId : layoutId;
  }
  function useStrictMode(configAndProps, preloadedFeatures) {
    const isStrict = useContext(LazyContext).strict;
    if (preloadedFeatures && isStrict) {
      const strictMessage = "You have rendered a `motion` component within a `LazyMotion` component. This will break tree shaking. Import and render a `m` component instead.";
      configAndProps.ignoreStrict ? warning(false, strictMessage) : invariant(false, strictMessage);
    }
  }
  function getProjectionFunctionality(props) {
    const { drag: drag2, layout: layout2 } = featureDefinitions;
    if (!drag2 && !layout2)
      return {};
    const combined = { ...drag2, ...layout2 };
    return {
      MeasureLayout: (drag2 === null || drag2 === void 0 ? void 0 : drag2.isEnabled(props)) || (layout2 === null || layout2 === void 0 ? void 0 : layout2.isEnabled(props)) ? combined.MeasureLayout : void 0,
      ProjectionNode: combined.ProjectionNode
    };
  }

  // ../../../node_modules/framer-motion/dist/es/render/svg/lowercase-elements.mjs
  var lowercaseSVGElements = [
    "animate",
    "circle",
    "defs",
    "desc",
    "ellipse",
    "g",
    "image",
    "line",
    "filter",
    "marker",
    "mask",
    "metadata",
    "path",
    "pattern",
    "polygon",
    "polyline",
    "rect",
    "stop",
    "switch",
    "symbol",
    "svg",
    "text",
    "tspan",
    "use",
    "view"
  ];

  // ../../../node_modules/framer-motion/dist/es/render/dom/utils/is-svg-component.mjs
  function isSVGComponent(Component2) {
    if (
      /**
       * If it's not a string, it's a custom React component. Currently we only support
       * HTML custom React components.
       */
      typeof Component2 !== "string" || /**
       * If it contains a dash, the element is a custom HTML webcomponent.
       */
      Component2.includes("-")
    ) {
      return false;
    } else if (
      /**
       * If it's in our list of lowercase SVG tags, it's an SVG component
       */
      lowercaseSVGElements.indexOf(Component2) > -1 || /**
       * If it contains a capital letter, it's an SVG component
       */
      /[A-Z]/u.test(Component2)
    ) {
      return true;
    }
    return false;
  }

  // ../../../node_modules/framer-motion/dist/es/render/utils/resolve-variants.mjs
  function getValueState(visualElement) {
    const state = [{}, {}];
    visualElement === null || visualElement === void 0 ? void 0 : visualElement.values.forEach((value, key) => {
      state[0][key] = value.get();
      state[1][key] = value.getVelocity();
    });
    return state;
  }
  function resolveVariantFromProps(props, definition, custom, visualElement) {
    if (typeof definition === "function") {
      const [current, velocity] = getValueState(visualElement);
      definition = definition(custom !== void 0 ? custom : props.custom, current, velocity);
    }
    if (typeof definition === "string") {
      definition = props.variants && props.variants[definition];
    }
    if (typeof definition === "function") {
      const [current, velocity] = getValueState(visualElement);
      definition = definition(custom !== void 0 ? custom : props.custom, current, velocity);
    }
    return definition;
  }

  // ../../../node_modules/framer-motion/dist/es/animation/utils/is-keyframes-target.mjs
  var isKeyframesTarget = (v) => {
    return Array.isArray(v);
  };

  // ../../../node_modules/framer-motion/dist/es/utils/resolve-value.mjs
  var isCustomValue = (v) => {
    return Boolean(v && typeof v === "object" && v.mix && v.toValue);
  };
  var resolveFinalValueInKeyframes = (v) => {
    return isKeyframesTarget(v) ? v[v.length - 1] || 0 : v;
  };

  // ../../../node_modules/framer-motion/dist/es/value/utils/is-motion-value.mjs
  var isMotionValue = (value) => Boolean(value && value.getVelocity);

  // ../../../node_modules/framer-motion/dist/es/value/utils/resolve-motion-value.mjs
  function resolveMotionValue(value) {
    const unwrappedValue = isMotionValue(value) ? value.get() : value;
    return isCustomValue(unwrappedValue) ? unwrappedValue.toValue() : unwrappedValue;
  }

  // ../../../node_modules/framer-motion/dist/es/motion/utils/use-visual-state.mjs
  function makeState({ scrapeMotionValuesFromProps: scrapeMotionValuesFromProps3, createRenderState, onUpdate }, props, context, presenceContext) {
    const state = {
      latestValues: makeLatestValues(props, context, presenceContext, scrapeMotionValuesFromProps3),
      renderState: createRenderState()
    };
    if (onUpdate) {
      state.onMount = (instance) => onUpdate({ props, current: instance, ...state });
      state.onUpdate = (visualElement) => onUpdate(visualElement);
    }
    return state;
  }
  var makeUseVisualState = (config) => (props, isStatic) => {
    const context = useContext(MotionContext);
    const presenceContext = useContext(PresenceContext);
    const make = () => makeState(config, props, context, presenceContext);
    return isStatic ? make() : useConstant(make);
  };
  function makeLatestValues(props, context, presenceContext, scrapeMotionValues) {
    const values = {};
    const motionValues = scrapeMotionValues(props, {});
    for (const key in motionValues) {
      values[key] = resolveMotionValue(motionValues[key]);
    }
    let { initial, animate } = props;
    const isControllingVariants$1 = isControllingVariants(props);
    const isVariantNode$1 = isVariantNode(props);
    if (context && isVariantNode$1 && !isControllingVariants$1 && props.inherit !== false) {
      if (initial === void 0)
        initial = context.initial;
      if (animate === void 0)
        animate = context.animate;
    }
    let isInitialAnimationBlocked = presenceContext ? presenceContext.initial === false : false;
    isInitialAnimationBlocked = isInitialAnimationBlocked || initial === false;
    const variantToSet = isInitialAnimationBlocked ? animate : initial;
    if (variantToSet && typeof variantToSet !== "boolean" && !isAnimationControls(variantToSet)) {
      const list = Array.isArray(variantToSet) ? variantToSet : [variantToSet];
      for (let i = 0; i < list.length; i++) {
        const resolved = resolveVariantFromProps(props, list[i]);
        if (resolved) {
          const { transitionEnd, transition, ...target } = resolved;
          for (const key in target) {
            let valueTarget = target[key];
            if (Array.isArray(valueTarget)) {
              const index = isInitialAnimationBlocked ? valueTarget.length - 1 : 0;
              valueTarget = valueTarget[index];
            }
            if (valueTarget !== null) {
              values[key] = valueTarget;
            }
          }
          for (const key in transitionEnd) {
            values[key] = transitionEnd[key];
          }
        }
      }
    }
    return values;
  }

  // ../../../node_modules/framer-motion/dist/es/render/html/utils/keys-transform.mjs
  var transformPropOrder = [
    "transformPerspective",
    "x",
    "y",
    "z",
    "translateX",
    "translateY",
    "translateZ",
    "scale",
    "scaleX",
    "scaleY",
    "rotate",
    "rotateX",
    "rotateY",
    "rotateZ",
    "skew",
    "skewX",
    "skewY"
  ];
  var transformProps = new Set(transformPropOrder);

  // ../../../node_modules/framer-motion/dist/es/render/dom/utils/is-css-variable.mjs
  var checkStringStartsWith = (token) => (key) => typeof key === "string" && key.startsWith(token);
  var isCSSVariableName = /* @__PURE__ */ checkStringStartsWith("--");
  var startsAsVariableToken = /* @__PURE__ */ checkStringStartsWith("var(--");
  var isCSSVariableToken = (value) => {
    const startsWithToken = startsAsVariableToken(value);
    if (!startsWithToken)
      return false;
    return singleCssVariableRegex.test(value.split("/*")[0].trim());
  };
  var singleCssVariableRegex = /var\(--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)$/iu;

  // ../../../node_modules/framer-motion/dist/es/render/dom/value-types/get-as-type.mjs
  var getValueAsType = (value, type) => {
    return type && typeof value === "number" ? type.transform(value) : value;
  };

  // ../../../node_modules/framer-motion/dist/es/utils/clamp.mjs
  var clamp = (min, max, v) => {
    if (v > max)
      return max;
    if (v < min)
      return min;
    return v;
  };

  // ../../../node_modules/framer-motion/dist/es/value/types/numbers/index.mjs
  var number = {
    test: (v) => typeof v === "number",
    parse: parseFloat,
    transform: (v) => v
  };
  var alpha = {
    ...number,
    transform: (v) => clamp(0, 1, v)
  };
  var scale = {
    ...number,
    default: 1
  };

  // ../../../node_modules/framer-motion/dist/es/value/types/numbers/units.mjs
  var createUnitType = (unit) => ({
    test: (v) => typeof v === "string" && v.endsWith(unit) && v.split(" ").length === 1,
    parse: parseFloat,
    transform: (v) => `${v}${unit}`
  });
  var degrees = /* @__PURE__ */ createUnitType("deg");
  var percent = /* @__PURE__ */ createUnitType("%");
  var px = /* @__PURE__ */ createUnitType("px");
  var vh = /* @__PURE__ */ createUnitType("vh");
  var vw = /* @__PURE__ */ createUnitType("vw");
  var progressPercentage = {
    ...percent,
    parse: (v) => percent.parse(v) / 100,
    transform: (v) => percent.transform(v * 100)
  };

  // ../../../node_modules/framer-motion/dist/es/render/dom/value-types/number-browser.mjs
  var browserNumberValueTypes = {
    // Border props
    borderWidth: px,
    borderTopWidth: px,
    borderRightWidth: px,
    borderBottomWidth: px,
    borderLeftWidth: px,
    borderRadius: px,
    radius: px,
    borderTopLeftRadius: px,
    borderTopRightRadius: px,
    borderBottomRightRadius: px,
    borderBottomLeftRadius: px,
    // Positioning props
    width: px,
    maxWidth: px,
    height: px,
    maxHeight: px,
    top: px,
    right: px,
    bottom: px,
    left: px,
    // Spacing props
    padding: px,
    paddingTop: px,
    paddingRight: px,
    paddingBottom: px,
    paddingLeft: px,
    margin: px,
    marginTop: px,
    marginRight: px,
    marginBottom: px,
    marginLeft: px,
    // Misc
    backgroundPositionX: px,
    backgroundPositionY: px
  };

  // ../../../node_modules/framer-motion/dist/es/render/dom/value-types/transform.mjs
  var transformValueTypes = {
    rotate: degrees,
    rotateX: degrees,
    rotateY: degrees,
    rotateZ: degrees,
    scale,
    scaleX: scale,
    scaleY: scale,
    scaleZ: scale,
    skew: degrees,
    skewX: degrees,
    skewY: degrees,
    distance: px,
    translateX: px,
    translateY: px,
    translateZ: px,
    x: px,
    y: px,
    z: px,
    perspective: px,
    transformPerspective: px,
    opacity: alpha,
    originX: progressPercentage,
    originY: progressPercentage,
    originZ: px
  };

  // ../../../node_modules/framer-motion/dist/es/render/dom/value-types/type-int.mjs
  var int = {
    ...number,
    transform: Math.round
  };

  // ../../../node_modules/framer-motion/dist/es/render/dom/value-types/number.mjs
  var numberValueTypes = {
    ...browserNumberValueTypes,
    ...transformValueTypes,
    zIndex: int,
    size: px,
    // SVG
    fillOpacity: alpha,
    strokeOpacity: alpha,
    numOctaves: int
  };

  // ../../../node_modules/framer-motion/dist/es/render/html/utils/build-transform.mjs
  var translateAlias = {
    x: "translateX",
    y: "translateY",
    z: "translateZ",
    transformPerspective: "perspective"
  };
  var numTransforms = transformPropOrder.length;
  function buildTransform(latestValues, transform, transformTemplate) {
    let transformString = "";
    let transformIsDefault = true;
    for (let i = 0; i < numTransforms; i++) {
      const key = transformPropOrder[i];
      const value = latestValues[key];
      if (value === void 0)
        continue;
      let valueIsDefault = true;
      if (typeof value === "number") {
        valueIsDefault = value === (key.startsWith("scale") ? 1 : 0);
      } else {
        valueIsDefault = parseFloat(value) === 0;
      }
      if (!valueIsDefault || transformTemplate) {
        const valueAsType = getValueAsType(value, numberValueTypes[key]);
        if (!valueIsDefault) {
          transformIsDefault = false;
          const transformName = translateAlias[key] || key;
          transformString += `${transformName}(${valueAsType}) `;
        }
        if (transformTemplate) {
          transform[key] = valueAsType;
        }
      }
    }
    transformString = transformString.trim();
    if (transformTemplate) {
      transformString = transformTemplate(transform, transformIsDefault ? "" : transformString);
    } else if (transformIsDefault) {
      transformString = "none";
    }
    return transformString;
  }

  // ../../../node_modules/framer-motion/dist/es/render/html/utils/build-styles.mjs
  function buildHTMLStyles(state, latestValues, transformTemplate) {
    const { style, vars, transformOrigin } = state;
    let hasTransform2 = false;
    let hasTransformOrigin = false;
    for (const key in latestValues) {
      const value = latestValues[key];
      if (transformProps.has(key)) {
        hasTransform2 = true;
        continue;
      } else if (isCSSVariableName(key)) {
        vars[key] = value;
        continue;
      } else {
        const valueAsType = getValueAsType(value, numberValueTypes[key]);
        if (key.startsWith("origin")) {
          hasTransformOrigin = true;
          transformOrigin[key] = valueAsType;
        } else {
          style[key] = valueAsType;
        }
      }
    }
    if (!latestValues.transform) {
      if (hasTransform2 || transformTemplate) {
        style.transform = buildTransform(latestValues, state.transform, transformTemplate);
      } else if (style.transform) {
        style.transform = "none";
      }
    }
    if (hasTransformOrigin) {
      const { originX = "50%", originY = "50%", originZ = 0 } = transformOrigin;
      style.transformOrigin = `${originX} ${originY} ${originZ}`;
    }
  }

  // ../../../node_modules/framer-motion/dist/es/render/svg/utils/path.mjs
  var dashKeys = {
    offset: "stroke-dashoffset",
    array: "stroke-dasharray"
  };
  var camelKeys = {
    offset: "strokeDashoffset",
    array: "strokeDasharray"
  };
  function buildSVGPath(attrs, length, spacing3 = 1, offset = 0, useDashCase = true) {
    attrs.pathLength = 1;
    const keys = useDashCase ? dashKeys : camelKeys;
    attrs[keys.offset] = px.transform(-offset);
    const pathLength = px.transform(length);
    const pathSpacing = px.transform(spacing3);
    attrs[keys.array] = `${pathLength} ${pathSpacing}`;
  }

  // ../../../node_modules/framer-motion/dist/es/render/svg/utils/transform-origin.mjs
  function calcOrigin(origin, offset, size) {
    return typeof origin === "string" ? origin : px.transform(offset + size * origin);
  }
  function calcSVGTransformOrigin(dimensions, originX, originY) {
    const pxOriginX = calcOrigin(originX, dimensions.x, dimensions.width);
    const pxOriginY = calcOrigin(originY, dimensions.y, dimensions.height);
    return `${pxOriginX} ${pxOriginY}`;
  }

  // ../../../node_modules/framer-motion/dist/es/render/svg/utils/build-attrs.mjs
  function buildSVGAttrs(state, {
    attrX,
    attrY,
    attrScale,
    originX,
    originY,
    pathLength,
    pathSpacing = 1,
    pathOffset = 0,
    // This is object creation, which we try to avoid per-frame.
    ...latest
  }, isSVGTag2, transformTemplate) {
    buildHTMLStyles(state, latest, transformTemplate);
    if (isSVGTag2) {
      if (state.style.viewBox) {
        state.attrs.viewBox = state.style.viewBox;
      }
      return;
    }
    state.attrs = state.style;
    state.style = {};
    const { attrs, style, dimensions } = state;
    if (attrs.transform) {
      if (dimensions)
        style.transform = attrs.transform;
      delete attrs.transform;
    }
    if (dimensions && (originX !== void 0 || originY !== void 0 || style.transform)) {
      style.transformOrigin = calcSVGTransformOrigin(dimensions, originX !== void 0 ? originX : 0.5, originY !== void 0 ? originY : 0.5);
    }
    if (attrX !== void 0)
      attrs.x = attrX;
    if (attrY !== void 0)
      attrs.y = attrY;
    if (attrScale !== void 0)
      attrs.scale = attrScale;
    if (pathLength !== void 0) {
      buildSVGPath(attrs, pathLength, pathSpacing, pathOffset, false);
    }
  }

  // ../../../node_modules/framer-motion/dist/es/render/html/utils/create-render-state.mjs
  var createHtmlRenderState = () => ({
    style: {},
    transform: {},
    transformOrigin: {},
    vars: {}
  });

  // ../../../node_modules/framer-motion/dist/es/render/svg/utils/create-render-state.mjs
  var createSvgRenderState = () => ({
    ...createHtmlRenderState(),
    attrs: {}
  });

  // ../../../node_modules/framer-motion/dist/es/render/svg/utils/is-svg-tag.mjs
  var isSVGTag = (tag) => typeof tag === "string" && tag.toLowerCase() === "svg";

  // ../../../node_modules/framer-motion/dist/es/render/html/utils/render.mjs
  function renderHTML(element, { style, vars }, styleProp, projection) {
    Object.assign(element.style, style, projection && projection.getProjectionStyles(styleProp));
    for (const key in vars) {
      element.style.setProperty(key, vars[key]);
    }
  }

  // ../../../node_modules/framer-motion/dist/es/render/svg/utils/camel-case-attrs.mjs
  var camelCaseAttributes = /* @__PURE__ */ new Set([
    "baseFrequency",
    "diffuseConstant",
    "kernelMatrix",
    "kernelUnitLength",
    "keySplines",
    "keyTimes",
    "limitingConeAngle",
    "markerHeight",
    "markerWidth",
    "numOctaves",
    "targetX",
    "targetY",
    "surfaceScale",
    "specularConstant",
    "specularExponent",
    "stdDeviation",
    "tableValues",
    "viewBox",
    "gradientTransform",
    "pathLength",
    "startOffset",
    "textLength",
    "lengthAdjust"
  ]);

  // ../../../node_modules/framer-motion/dist/es/render/svg/utils/render.mjs
  function renderSVG(element, renderState, _styleProp, projection) {
    renderHTML(element, renderState, void 0, projection);
    for (const key in renderState.attrs) {
      element.setAttribute(!camelCaseAttributes.has(key) ? camelToDash(key) : key, renderState.attrs[key]);
    }
  }

  // ../../../node_modules/framer-motion/dist/es/projection/styles/scale-correction.mjs
  var scaleCorrectors = {};
  function addScaleCorrector(correctors) {
    Object.assign(scaleCorrectors, correctors);
  }

  // ../../../node_modules/framer-motion/dist/es/motion/utils/is-forced-motion-value.mjs
  function isForcedMotionValue(key, { layout: layout2, layoutId }) {
    return transformProps.has(key) || key.startsWith("origin") || (layout2 || layoutId !== void 0) && (!!scaleCorrectors[key] || key === "opacity");
  }

  // ../../../node_modules/framer-motion/dist/es/render/html/utils/scrape-motion-values.mjs
  function scrapeMotionValuesFromProps(props, prevProps, visualElement) {
    var _a;
    const { style } = props;
    const newValues = {};
    for (const key in style) {
      if (isMotionValue(style[key]) || prevProps.style && isMotionValue(prevProps.style[key]) || isForcedMotionValue(key, props) || ((_a = visualElement === null || visualElement === void 0 ? void 0 : visualElement.getValue(key)) === null || _a === void 0 ? void 0 : _a.liveStyle) !== void 0) {
        newValues[key] = style[key];
      }
    }
    return newValues;
  }

  // ../../../node_modules/framer-motion/dist/es/render/svg/utils/scrape-motion-values.mjs
  function scrapeMotionValuesFromProps2(props, prevProps, visualElement) {
    const newValues = scrapeMotionValuesFromProps(props, prevProps, visualElement);
    for (const key in props) {
      if (isMotionValue(props[key]) || isMotionValue(prevProps[key])) {
        const targetKey = transformPropOrder.indexOf(key) !== -1 ? "attr" + key.charAt(0).toUpperCase() + key.substring(1) : key;
        newValues[targetKey] = props[key];
      }
    }
    return newValues;
  }

  // ../../../node_modules/framer-motion/dist/es/render/svg/config-motion.mjs
  function updateSVGDimensions(instance, renderState) {
    try {
      renderState.dimensions = typeof instance.getBBox === "function" ? instance.getBBox() : instance.getBoundingClientRect();
    } catch (e) {
      renderState.dimensions = {
        x: 0,
        y: 0,
        width: 0,
        height: 0
      };
    }
  }
  var layoutProps = ["x", "y", "width", "height", "cx", "cy", "r"];
  var svgMotionConfig = {
    useVisualState: makeUseVisualState({
      scrapeMotionValuesFromProps: scrapeMotionValuesFromProps2,
      createRenderState: createSvgRenderState,
      onUpdate: ({ props, prevProps, current, renderState, latestValues }) => {
        if (!current)
          return;
        let hasTransform2 = !!props.drag;
        if (!hasTransform2) {
          for (const key in latestValues) {
            if (transformProps.has(key)) {
              hasTransform2 = true;
              break;
            }
          }
        }
        if (!hasTransform2)
          return;
        let needsMeasure = !prevProps;
        if (prevProps) {
          for (let i = 0; i < layoutProps.length; i++) {
            const key = layoutProps[i];
            if (props[key] !== prevProps[key]) {
              needsMeasure = true;
            }
          }
        }
        if (!needsMeasure)
          return;
        frame.read(() => {
          updateSVGDimensions(current, renderState);
          frame.render(() => {
            buildSVGAttrs(renderState, latestValues, isSVGTag(current.tagName), props.transformTemplate);
            renderSVG(current, renderState);
          });
        });
      }
    })
  };

  // ../../../node_modules/framer-motion/dist/es/render/html/config-motion.mjs
  var htmlMotionConfig = {
    useVisualState: makeUseVisualState({
      scrapeMotionValuesFromProps,
      createRenderState: createHtmlRenderState
    })
  };

  // ../../../node_modules/framer-motion/dist/es/render/html/use-props.mjs
  function copyRawValuesOnly(target, source, props) {
    for (const key in source) {
      if (!isMotionValue(source[key]) && !isForcedMotionValue(key, props)) {
        target[key] = source[key];
      }
    }
  }
  function useInitialMotionValues({ transformTemplate }, visualState) {
    return useMemo(() => {
      const state = createHtmlRenderState();
      buildHTMLStyles(state, visualState, transformTemplate);
      return Object.assign({}, state.vars, state.style);
    }, [visualState]);
  }
  function useStyle(props, visualState) {
    const styleProp = props.style || {};
    const style = {};
    copyRawValuesOnly(style, styleProp, props);
    Object.assign(style, useInitialMotionValues(props, visualState));
    return style;
  }
  function useHTMLProps(props, visualState) {
    const htmlProps = {};
    const style = useStyle(props, visualState);
    if (props.drag && props.dragListener !== false) {
      htmlProps.draggable = false;
      style.userSelect = style.WebkitUserSelect = style.WebkitTouchCallout = "none";
      style.touchAction = props.drag === true ? "none" : `pan-${props.drag === "x" ? "y" : "x"}`;
    }
    if (props.tabIndex === void 0 && (props.onTap || props.onTapStart || props.whileTap)) {
      htmlProps.tabIndex = 0;
    }
    htmlProps.style = style;
    return htmlProps;
  }

  // ../../../node_modules/framer-motion/dist/es/render/svg/use-props.mjs
  function useSVGProps(props, visualState, _isStatic, Component2) {
    const visualProps = useMemo(() => {
      const state = createSvgRenderState();
      buildSVGAttrs(state, visualState, isSVGTag(Component2), props.transformTemplate);
      return {
        ...state.attrs,
        style: { ...state.style }
      };
    }, [visualState]);
    if (props.style) {
      const rawStyles = {};
      copyRawValuesOnly(rawStyles, props.style, props);
      visualProps.style = { ...rawStyles, ...visualProps.style };
    }
    return visualProps;
  }

  // ../../../node_modules/framer-motion/dist/es/render/dom/use-render.mjs
  function createUseRender(forwardMotionProps = false) {
    const useRender = (Component2, props, ref, { latestValues }, isStatic) => {
      const useVisualProps = isSVGComponent(Component2) ? useSVGProps : useHTMLProps;
      const visualProps = useVisualProps(props, latestValues, isStatic, Component2);
      const filteredProps = filterProps(props, typeof Component2 === "string", forwardMotionProps);
      const elementProps = Component2 !== Fragment ? { ...filteredProps, ...visualProps, ref } : {};
      const { children } = props;
      const renderedChildren = useMemo(() => isMotionValue(children) ? children.get() : children, [children]);
      return createElement(Component2, {
        ...elementProps,
        children: renderedChildren
      });
    };
    return useRender;
  }

  // ../../../node_modules/framer-motion/dist/es/render/components/create-factory.mjs
  function createMotionComponentFactory(preloadedFeatures, createVisualElement) {
    return function createMotionComponent2(Component2, { forwardMotionProps } = { forwardMotionProps: false }) {
      const baseConfig = isSVGComponent(Component2) ? svgMotionConfig : htmlMotionConfig;
      const config = {
        ...baseConfig,
        preloadedFeatures,
        useRender: createUseRender(forwardMotionProps),
        createVisualElement,
        Component: Component2
      };
      return createRendererMotionComponent(config);
    };
  }

  // ../../../node_modules/framer-motion/dist/es/utils/shallow-compare.mjs
  function shallowCompare(next, prev) {
    if (!Array.isArray(prev))
      return false;
    const prevLength = prev.length;
    if (prevLength !== next.length)
      return false;
    for (let i = 0; i < prevLength; i++) {
      if (prev[i] !== next[i])
        return false;
    }
    return true;
  }

  // ../../../node_modules/framer-motion/dist/es/render/utils/resolve-dynamic-variants.mjs
  function resolveVariant(visualElement, definition, custom) {
    const props = visualElement.getProps();
    return resolveVariantFromProps(props, definition, custom !== void 0 ? custom : props.custom, visualElement);
  }

  // ../../../node_modules/motion-dom/dist/es/utils/supports/scroll-timeline.mjs
  var supportsScrollTimeline = memo2(() => window.ScrollTimeline !== void 0);

  // ../../../node_modules/motion-dom/dist/es/animation/controls/BaseGroup.mjs
  var BaseGroupPlaybackControls = class {
    constructor(animations2) {
      this.stop = () => this.runAll("stop");
      this.animations = animations2.filter(Boolean);
    }
    get finished() {
      return Promise.all(this.animations.map((animation3) => "finished" in animation3 ? animation3.finished : animation3));
    }
    /**
     * TODO: Filter out cancelled or stopped animations before returning
     */
    getAll(propName) {
      return this.animations[0][propName];
    }
    setAll(propName, newValue) {
      for (let i = 0; i < this.animations.length; i++) {
        this.animations[i][propName] = newValue;
      }
    }
    attachTimeline(timeline, fallback) {
      const subscriptions = this.animations.map((animation3) => {
        if (supportsScrollTimeline() && animation3.attachTimeline) {
          return animation3.attachTimeline(timeline);
        } else if (typeof fallback === "function") {
          return fallback(animation3);
        }
      });
      return () => {
        subscriptions.forEach((cancel, i) => {
          cancel && cancel();
          this.animations[i].stop();
        });
      };
    }
    get time() {
      return this.getAll("time");
    }
    set time(time2) {
      this.setAll("time", time2);
    }
    get speed() {
      return this.getAll("speed");
    }
    set speed(speed) {
      this.setAll("speed", speed);
    }
    get startTime() {
      return this.getAll("startTime");
    }
    get duration() {
      let max = 0;
      for (let i = 0; i < this.animations.length; i++) {
        max = Math.max(max, this.animations[i].duration);
      }
      return max;
    }
    runAll(methodName) {
      this.animations.forEach((controls) => controls[methodName]());
    }
    flatten() {
      this.runAll("flatten");
    }
    play() {
      this.runAll("play");
    }
    pause() {
      this.runAll("pause");
    }
    cancel() {
      this.runAll("cancel");
    }
    complete() {
      this.runAll("complete");
    }
  };

  // ../../../node_modules/motion-dom/dist/es/animation/controls/Group.mjs
  var GroupPlaybackControls = class extends BaseGroupPlaybackControls {
    then(onResolve, onReject) {
      return Promise.all(this.animations).then(onResolve).catch(onReject);
    }
  };

  // ../../../node_modules/motion-dom/dist/es/animation/utils/get-value-transition.mjs
  function getValueTransition(transition, key) {
    return transition ? transition[key] || transition["default"] || transition : void 0;
  }

  // ../../../node_modules/motion-dom/dist/es/animation/generators/utils/calc-duration.mjs
  var maxGeneratorDuration = 2e4;
  function calcGeneratorDuration(generator) {
    let duration = 0;
    const timeStep = 50;
    let state = generator.next(duration);
    while (!state.done && duration < maxGeneratorDuration) {
      duration += timeStep;
      state = generator.next(duration);
    }
    return duration >= maxGeneratorDuration ? Infinity : duration;
  }

  // ../../../node_modules/motion-dom/dist/es/animation/generators/utils/is-generator.mjs
  function isGenerator(type) {
    return typeof type === "function";
  }

  // ../../../node_modules/motion-dom/dist/es/animation/waapi/utils/attach-timeline.mjs
  function attachTimeline(animation3, timeline) {
    animation3.timeline = timeline;
    animation3.onfinish = null;
  }

  // ../../../node_modules/motion-dom/dist/es/utils/is-bezier-definition.mjs
  var isBezierDefinition = (easing) => Array.isArray(easing) && typeof easing[0] === "number";

  // ../../../node_modules/motion-dom/dist/es/utils/supports/flags.mjs
  var supportsFlags = {
    linearEasing: void 0
  };

  // ../../../node_modules/motion-dom/dist/es/utils/supports/memo.mjs
  function memoSupports(callback, supportsFlag) {
    const memoized = memo2(callback);
    return () => {
      var _a;
      return (_a = supportsFlags[supportsFlag]) !== null && _a !== void 0 ? _a : memoized();
    };
  }

  // ../../../node_modules/motion-dom/dist/es/utils/supports/linear-easing.mjs
  var supportsLinearEasing = /* @__PURE__ */ memoSupports(() => {
    try {
      document.createElement("div").animate({ opacity: 0 }, { easing: "linear(0, 1)" });
    } catch (e) {
      return false;
    }
    return true;
  }, "linearEasing");

  // ../../../node_modules/motion-dom/dist/es/animation/waapi/utils/linear.mjs
  var generateLinearEasing = (easing, duration, resolution = 10) => {
    let points = "";
    const numPoints = Math.max(Math.round(duration / resolution), 2);
    for (let i = 0; i < numPoints; i++) {
      points += easing(progress(0, numPoints - 1, i)) + ", ";
    }
    return `linear(${points.substring(0, points.length - 2)})`;
  };

  // ../../../node_modules/motion-dom/dist/es/animation/waapi/utils/easing.mjs
  function isWaapiSupportedEasing(easing) {
    return Boolean(typeof easing === "function" && supportsLinearEasing() || !easing || typeof easing === "string" && (easing in supportedWaapiEasing || supportsLinearEasing()) || isBezierDefinition(easing) || Array.isArray(easing) && easing.every(isWaapiSupportedEasing));
  }
  var cubicBezierAsString = ([a, b, c, d]) => `cubic-bezier(${a}, ${b}, ${c}, ${d})`;
  var supportedWaapiEasing = {
    linear: "linear",
    ease: "ease",
    easeIn: "ease-in",
    easeOut: "ease-out",
    easeInOut: "ease-in-out",
    circIn: /* @__PURE__ */ cubicBezierAsString([0, 0.65, 0.55, 1]),
    circOut: /* @__PURE__ */ cubicBezierAsString([0.55, 0, 1, 0.45]),
    backIn: /* @__PURE__ */ cubicBezierAsString([0.31, 0.01, 0.66, -0.59]),
    backOut: /* @__PURE__ */ cubicBezierAsString([0.33, 1.53, 0.69, 0.99])
  };
  function mapEasingToNativeEasing(easing, duration) {
    if (!easing) {
      return void 0;
    } else if (typeof easing === "function" && supportsLinearEasing()) {
      return generateLinearEasing(easing, duration);
    } else if (isBezierDefinition(easing)) {
      return cubicBezierAsString(easing);
    } else if (Array.isArray(easing)) {
      return easing.map((segmentEasing) => mapEasingToNativeEasing(segmentEasing, duration) || supportedWaapiEasing.easeOut);
    } else {
      return supportedWaapiEasing[easing];
    }
  }

  // ../../../node_modules/motion-dom/dist/es/gestures/drag/state/is-active.mjs
  var isDragging = {
    x: false,
    y: false
  };
  function isDragActive() {
    return isDragging.x || isDragging.y;
  }

  // ../../../node_modules/motion-dom/dist/es/utils/resolve-elements.mjs
  function resolveElements(elementOrSelector, scope, selectorCache) {
    var _a;
    if (elementOrSelector instanceof Element) {
      return [elementOrSelector];
    } else if (typeof elementOrSelector === "string") {
      let root = document;
      if (scope) {
        root = scope.current;
      }
      const elements = (_a = selectorCache === null || selectorCache === void 0 ? void 0 : selectorCache[elementOrSelector]) !== null && _a !== void 0 ? _a : root.querySelectorAll(elementOrSelector);
      return elements ? Array.from(elements) : [];
    }
    return Array.from(elementOrSelector);
  }

  // ../../../node_modules/motion-dom/dist/es/gestures/utils/setup.mjs
  function setupGesture(elementOrSelector, options) {
    const elements = resolveElements(elementOrSelector);
    const gestureAbortController = new AbortController();
    const eventOptions = {
      passive: true,
      ...options,
      signal: gestureAbortController.signal
    };
    const cancel = () => gestureAbortController.abort();
    return [elements, eventOptions, cancel];
  }

  // ../../../node_modules/motion-dom/dist/es/gestures/hover.mjs
  function filterEvents(callback) {
    return (event) => {
      if (event.pointerType === "touch" || isDragActive())
        return;
      callback(event);
    };
  }
  function hover(elementOrSelector, onHoverStart, options = {}) {
    const [elements, eventOptions, cancel] = setupGesture(elementOrSelector, options);
    const onPointerEnter = filterEvents((enterEvent) => {
      const { target } = enterEvent;
      const onHoverEnd = onHoverStart(enterEvent);
      if (typeof onHoverEnd !== "function" || !target)
        return;
      const onPointerLeave = filterEvents((leaveEvent) => {
        onHoverEnd(leaveEvent);
        target.removeEventListener("pointerleave", onPointerLeave);
      });
      target.addEventListener("pointerleave", onPointerLeave, eventOptions);
    });
    elements.forEach((element) => {
      element.addEventListener("pointerenter", onPointerEnter, eventOptions);
    });
    return cancel;
  }

  // ../../../node_modules/motion-dom/dist/es/gestures/utils/is-node-or-child.mjs
  var isNodeOrChild = (parent, child) => {
    if (!child) {
      return false;
    } else if (parent === child) {
      return true;
    } else {
      return isNodeOrChild(parent, child.parentElement);
    }
  };

  // ../../../node_modules/motion-dom/dist/es/gestures/utils/is-primary-pointer.mjs
  var isPrimaryPointer = (event) => {
    if (event.pointerType === "mouse") {
      return typeof event.button !== "number" || event.button <= 0;
    } else {
      return event.isPrimary !== false;
    }
  };

  // ../../../node_modules/motion-dom/dist/es/gestures/press/utils/is-keyboard-accessible.mjs
  var focusableElements = /* @__PURE__ */ new Set([
    "BUTTON",
    "INPUT",
    "SELECT",
    "TEXTAREA",
    "A"
  ]);
  function isElementKeyboardAccessible(element) {
    return focusableElements.has(element.tagName) || element.tabIndex !== -1;
  }

  // ../../../node_modules/motion-dom/dist/es/gestures/press/utils/state.mjs
  var isPressing = /* @__PURE__ */ new WeakSet();

  // ../../../node_modules/motion-dom/dist/es/gestures/press/utils/keyboard.mjs
  function filterEvents2(callback) {
    return (event) => {
      if (event.key !== "Enter")
        return;
      callback(event);
    };
  }
  function firePointerEvent(target, type) {
    target.dispatchEvent(new PointerEvent("pointer" + type, { isPrimary: true, bubbles: true }));
  }
  var enableKeyboardPress = (focusEvent, eventOptions) => {
    const element = focusEvent.currentTarget;
    if (!element)
      return;
    const handleKeydown = filterEvents2(() => {
      if (isPressing.has(element))
        return;
      firePointerEvent(element, "down");
      const handleKeyup = filterEvents2(() => {
        firePointerEvent(element, "up");
      });
      const handleBlur = () => firePointerEvent(element, "cancel");
      element.addEventListener("keyup", handleKeyup, eventOptions);
      element.addEventListener("blur", handleBlur, eventOptions);
    });
    element.addEventListener("keydown", handleKeydown, eventOptions);
    element.addEventListener("blur", () => element.removeEventListener("keydown", handleKeydown), eventOptions);
  };

  // ../../../node_modules/motion-dom/dist/es/gestures/press/index.mjs
  function isValidPressEvent(event) {
    return isPrimaryPointer(event) && !isDragActive();
  }
  function press(elementOrSelector, onPressStart, options = {}) {
    const [elements, eventOptions, cancelEvents] = setupGesture(elementOrSelector, options);
    const startPress = (startEvent) => {
      const element = startEvent.currentTarget;
      if (!isValidPressEvent(startEvent) || isPressing.has(element))
        return;
      isPressing.add(element);
      const onPressEnd = onPressStart(startEvent);
      const onPointerEnd = (endEvent, success) => {
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerCancel);
        if (!isValidPressEvent(endEvent) || !isPressing.has(element)) {
          return;
        }
        isPressing.delete(element);
        if (typeof onPressEnd === "function") {
          onPressEnd(endEvent, { success });
        }
      };
      const onPointerUp = (upEvent) => {
        onPointerEnd(upEvent, options.useGlobalTarget || isNodeOrChild(element, upEvent.target));
      };
      const onPointerCancel = (cancelEvent) => {
        onPointerEnd(cancelEvent, false);
      };
      window.addEventListener("pointerup", onPointerUp, eventOptions);
      window.addEventListener("pointercancel", onPointerCancel, eventOptions);
    };
    elements.forEach((element) => {
      if (!isElementKeyboardAccessible(element) && element.getAttribute("tabindex") === null) {
        element.tabIndex = 0;
      }
      const target = options.useGlobalTarget ? window : element;
      target.addEventListener("pointerdown", startPress, eventOptions);
      element.addEventListener("focus", (event) => enableKeyboardPress(event, eventOptions), eventOptions);
    });
    return cancelEvents;
  }

  // ../../../node_modules/motion-dom/dist/es/gestures/drag/state/set-active.mjs
  function setDragLock(axis) {
    if (axis === "x" || axis === "y") {
      if (isDragging[axis]) {
        return null;
      } else {
        isDragging[axis] = true;
        return () => {
          isDragging[axis] = false;
        };
      }
    } else {
      if (isDragging.x || isDragging.y) {
        return null;
      } else {
        isDragging.x = isDragging.y = true;
        return () => {
          isDragging.x = isDragging.y = false;
        };
      }
    }
  }

  // ../../../node_modules/framer-motion/dist/es/render/html/utils/keys-position.mjs
  var positionalKeys = /* @__PURE__ */ new Set([
    "width",
    "height",
    "top",
    "left",
    "right",
    "bottom",
    ...transformPropOrder
  ]);

  // ../../../node_modules/framer-motion/dist/es/frameloop/sync-time.mjs
  var now;
  function clearTime() {
    now = void 0;
  }
  var time = {
    now: () => {
      if (now === void 0) {
        time.set(frameData.isProcessing || MotionGlobalConfig.useManualTiming ? frameData.timestamp : performance.now());
      }
      return now;
    },
    set: (newTime) => {
      now = newTime;
      queueMicrotask(clearTime);
    }
  };

  // ../../../node_modules/framer-motion/dist/es/utils/array.mjs
  function addUniqueItem(arr, item) {
    if (arr.indexOf(item) === -1)
      arr.push(item);
  }
  function removeItem(arr, item) {
    const index = arr.indexOf(item);
    if (index > -1)
      arr.splice(index, 1);
  }

  // ../../../node_modules/framer-motion/dist/es/utils/subscription-manager.mjs
  var SubscriptionManager = class {
    constructor() {
      this.subscriptions = [];
    }
    add(handler) {
      addUniqueItem(this.subscriptions, handler);
      return () => removeItem(this.subscriptions, handler);
    }
    notify(a, b, c) {
      const numSubscriptions = this.subscriptions.length;
      if (!numSubscriptions)
        return;
      if (numSubscriptions === 1) {
        this.subscriptions[0](a, b, c);
      } else {
        for (let i = 0; i < numSubscriptions; i++) {
          const handler = this.subscriptions[i];
          handler && handler(a, b, c);
        }
      }
    }
    getSize() {
      return this.subscriptions.length;
    }
    clear() {
      this.subscriptions.length = 0;
    }
  };

  // ../../../node_modules/framer-motion/dist/es/utils/velocity-per-second.mjs
  function velocityPerSecond(velocity, frameDuration) {
    return frameDuration ? velocity * (1e3 / frameDuration) : 0;
  }

  // ../../../node_modules/framer-motion/dist/es/value/index.mjs
  var MAX_VELOCITY_DELTA = 30;
  var isFloat = (value) => {
    return !isNaN(parseFloat(value));
  };
  var collectMotionValues = {
    current: void 0
  };
  var MotionValue = class {
    /**
     * @param init - The initiating value
     * @param config - Optional configuration options
     *
     * -  `transformer`: A function to transform incoming values with.
     *
     * @internal
     */
    constructor(init, options = {}) {
      this.version = "11.18.2";
      this.canTrackVelocity = null;
      this.events = {};
      this.updateAndNotify = (v, render = true) => {
        const currentTime = time.now();
        if (this.updatedAt !== currentTime) {
          this.setPrevFrameValue();
        }
        this.prev = this.current;
        this.setCurrent(v);
        if (this.current !== this.prev && this.events.change) {
          this.events.change.notify(this.current);
        }
        if (render && this.events.renderRequest) {
          this.events.renderRequest.notify(this.current);
        }
      };
      this.hasAnimated = false;
      this.setCurrent(init);
      this.owner = options.owner;
    }
    setCurrent(current) {
      this.current = current;
      this.updatedAt = time.now();
      if (this.canTrackVelocity === null && current !== void 0) {
        this.canTrackVelocity = isFloat(this.current);
      }
    }
    setPrevFrameValue(prevFrameValue = this.current) {
      this.prevFrameValue = prevFrameValue;
      this.prevUpdatedAt = this.updatedAt;
    }
    /**
     * Adds a function that will be notified when the `MotionValue` is updated.
     *
     * It returns a function that, when called, will cancel the subscription.
     *
     * When calling `onChange` inside a React component, it should be wrapped with the
     * `useEffect` hook. As it returns an unsubscribe function, this should be returned
     * from the `useEffect` function to ensure you don't add duplicate subscribers..
     *
     * ```jsx
     * export const MyComponent = () => {
     *   const x = useMotionValue(0)
     *   const y = useMotionValue(0)
     *   const opacity = useMotionValue(1)
     *
     *   useEffect(() => {
     *     function updateOpacity() {
     *       const maxXY = Math.max(x.get(), y.get())
     *       const newOpacity = transform(maxXY, [0, 100], [1, 0])
     *       opacity.set(newOpacity)
     *     }
     *
     *     const unsubscribeX = x.on("change", updateOpacity)
     *     const unsubscribeY = y.on("change", updateOpacity)
     *
     *     return () => {
     *       unsubscribeX()
     *       unsubscribeY()
     *     }
     *   }, [])
     *
     *   return <motion.div style={{ x }} />
     * }
     * ```
     *
     * @param subscriber - A function that receives the latest value.
     * @returns A function that, when called, will cancel this subscription.
     *
     * @deprecated
     */
    onChange(subscription) {
      if (true) {
        warnOnce(false, `value.onChange(callback) is deprecated. Switch to value.on("change", callback).`);
      }
      return this.on("change", subscription);
    }
    on(eventName, callback) {
      if (!this.events[eventName]) {
        this.events[eventName] = new SubscriptionManager();
      }
      const unsubscribe = this.events[eventName].add(callback);
      if (eventName === "change") {
        return () => {
          unsubscribe();
          frame.read(() => {
            if (!this.events.change.getSize()) {
              this.stop();
            }
          });
        };
      }
      return unsubscribe;
    }
    clearListeners() {
      for (const eventManagers in this.events) {
        this.events[eventManagers].clear();
      }
    }
    /**
     * Attaches a passive effect to the `MotionValue`.
     *
     * @internal
     */
    attach(passiveEffect, stopPassiveEffect) {
      this.passiveEffect = passiveEffect;
      this.stopPassiveEffect = stopPassiveEffect;
    }
    /**
     * Sets the state of the `MotionValue`.
     *
     * @remarks
     *
     * ```jsx
     * const x = useMotionValue(0)
     * x.set(10)
     * ```
     *
     * @param latest - Latest value to set.
     * @param render - Whether to notify render subscribers. Defaults to `true`
     *
     * @public
     */
    set(v, render = true) {
      if (!render || !this.passiveEffect) {
        this.updateAndNotify(v, render);
      } else {
        this.passiveEffect(v, this.updateAndNotify);
      }
    }
    setWithVelocity(prev, current, delta) {
      this.set(current);
      this.prev = void 0;
      this.prevFrameValue = prev;
      this.prevUpdatedAt = this.updatedAt - delta;
    }
    /**
     * Set the state of the `MotionValue`, stopping any active animations,
     * effects, and resets velocity to `0`.
     */
    jump(v, endAnimation = true) {
      this.updateAndNotify(v);
      this.prev = v;
      this.prevUpdatedAt = this.prevFrameValue = void 0;
      endAnimation && this.stop();
      if (this.stopPassiveEffect)
        this.stopPassiveEffect();
    }
    /**
     * Returns the latest state of `MotionValue`
     *
     * @returns - The latest state of `MotionValue`
     *
     * @public
     */
    get() {
      if (collectMotionValues.current) {
        collectMotionValues.current.push(this);
      }
      return this.current;
    }
    /**
     * @public
     */
    getPrevious() {
      return this.prev;
    }
    /**
     * Returns the latest velocity of `MotionValue`
     *
     * @returns - The latest velocity of `MotionValue`. Returns `0` if the state is non-numerical.
     *
     * @public
     */
    getVelocity() {
      const currentTime = time.now();
      if (!this.canTrackVelocity || this.prevFrameValue === void 0 || currentTime - this.updatedAt > MAX_VELOCITY_DELTA) {
        return 0;
      }
      const delta = Math.min(this.updatedAt - this.prevUpdatedAt, MAX_VELOCITY_DELTA);
      return velocityPerSecond(parseFloat(this.current) - parseFloat(this.prevFrameValue), delta);
    }
    /**
     * Registers a new animation to control this `MotionValue`. Only one
     * animation can drive a `MotionValue` at one time.
     *
     * ```jsx
     * value.start()
     * ```
     *
     * @param animation - A function that starts the provided animation
     *
     * @internal
     */
    start(startAnimation) {
      this.stop();
      return new Promise((resolve) => {
        this.hasAnimated = true;
        this.animation = startAnimation(resolve);
        if (this.events.animationStart) {
          this.events.animationStart.notify();
        }
      }).then(() => {
        if (this.events.animationComplete) {
          this.events.animationComplete.notify();
        }
        this.clearAnimation();
      });
    }
    /**
     * Stop the currently active animation.
     *
     * @public
     */
    stop() {
      if (this.animation) {
        this.animation.stop();
        if (this.events.animationCancel) {
          this.events.animationCancel.notify();
        }
      }
      this.clearAnimation();
    }
    /**
     * Returns `true` if this value is currently animating.
     *
     * @public
     */
    isAnimating() {
      return !!this.animation;
    }
    clearAnimation() {
      delete this.animation;
    }
    /**
     * Destroy and clean up subscribers to this `MotionValue`.
     *
     * The `MotionValue` hooks like `useMotionValue` and `useTransform` automatically
     * handle the lifecycle of the returned `MotionValue`, so this method is only necessary if you've manually
     * created a `MotionValue` via the `motionValue` function.
     *
     * @public
     */
    destroy() {
      this.clearListeners();
      this.stop();
      if (this.stopPassiveEffect) {
        this.stopPassiveEffect();
      }
    }
  };
  function motionValue(init, options) {
    return new MotionValue(init, options);
  }

  // ../../../node_modules/framer-motion/dist/es/render/utils/setters.mjs
  function setMotionValue(visualElement, key, value) {
    if (visualElement.hasValue(key)) {
      visualElement.getValue(key).set(value);
    } else {
      visualElement.addValue(key, motionValue(value));
    }
  }
  function setTarget(visualElement, definition) {
    const resolved = resolveVariant(visualElement, definition);
    let { transitionEnd = {}, transition = {}, ...target } = resolved || {};
    target = { ...target, ...transitionEnd };
    for (const key in target) {
      const value = resolveFinalValueInKeyframes(target[key]);
      setMotionValue(visualElement, key, value);
    }
  }

  // ../../../node_modules/framer-motion/dist/es/value/use-will-change/is.mjs
  function isWillChangeMotionValue(value) {
    return Boolean(isMotionValue(value) && value.add);
  }

  // ../../../node_modules/framer-motion/dist/es/value/use-will-change/add-will-change.mjs
  function addValueToWillChange(visualElement, key) {
    const willChange = visualElement.getValue("willChange");
    if (isWillChangeMotionValue(willChange)) {
      return willChange.add(key);
    }
  }

  // ../../../node_modules/framer-motion/dist/es/animation/optimized-appear/get-appear-id.mjs
  function getOptimisedAppearId(visualElement) {
    return visualElement.props[optimizedAppearDataAttribute];
  }

  // ../../../node_modules/framer-motion/dist/es/utils/use-instant-transition-state.mjs
  var instantAnimationState = {
    current: false
  };

  // ../../../node_modules/framer-motion/dist/es/easing/cubic-bezier.mjs
  var calcBezier = (t, a1, a2) => (((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t + 3 * a1) * t;
  var subdivisionPrecision = 1e-7;
  var subdivisionMaxIterations = 12;
  function binarySubdivide(x, lowerBound, upperBound, mX1, mX2) {
    let currentX;
    let currentT;
    let i = 0;
    do {
      currentT = lowerBound + (upperBound - lowerBound) / 2;
      currentX = calcBezier(currentT, mX1, mX2) - x;
      if (currentX > 0) {
        upperBound = currentT;
      } else {
        lowerBound = currentT;
      }
    } while (Math.abs(currentX) > subdivisionPrecision && ++i < subdivisionMaxIterations);
    return currentT;
  }
  function cubicBezier(mX1, mY1, mX2, mY2) {
    if (mX1 === mY1 && mX2 === mY2)
      return noop;
    const getTForX = (aX) => binarySubdivide(aX, 0, 1, mX1, mX2);
    return (t) => t === 0 || t === 1 ? t : calcBezier(getTForX(t), mY1, mY2);
  }

  // ../../../node_modules/framer-motion/dist/es/easing/modifiers/mirror.mjs
  var mirrorEasing = (easing) => (p) => p <= 0.5 ? easing(2 * p) / 2 : (2 - easing(2 * (1 - p))) / 2;

  // ../../../node_modules/framer-motion/dist/es/easing/modifiers/reverse.mjs
  var reverseEasing = (easing) => (p) => 1 - easing(1 - p);

  // ../../../node_modules/framer-motion/dist/es/easing/back.mjs
  var backOut = /* @__PURE__ */ cubicBezier(0.33, 1.53, 0.69, 0.99);
  var backIn = /* @__PURE__ */ reverseEasing(backOut);
  var backInOut = /* @__PURE__ */ mirrorEasing(backIn);

  // ../../../node_modules/framer-motion/dist/es/easing/anticipate.mjs
  var anticipate = (p) => (p *= 2) < 1 ? 0.5 * backIn(p) : 0.5 * (2 - Math.pow(2, -10 * (p - 1)));

  // ../../../node_modules/framer-motion/dist/es/easing/circ.mjs
  var circIn = (p) => 1 - Math.sin(Math.acos(p));
  var circOut = reverseEasing(circIn);
  var circInOut = mirrorEasing(circIn);

  // ../../../node_modules/framer-motion/dist/es/utils/is-zero-value-string.mjs
  var isZeroValueString = (v) => /^0[^.\s]+$/u.test(v);

  // ../../../node_modules/framer-motion/dist/es/animation/utils/is-none.mjs
  function isNone(value) {
    if (typeof value === "number") {
      return value === 0;
    } else if (value !== null) {
      return value === "none" || value === "0" || isZeroValueString(value);
    } else {
      return true;
    }
  }

  // ../../../node_modules/framer-motion/dist/es/value/types/utils/sanitize.mjs
  var sanitize = (v) => Math.round(v * 1e5) / 1e5;

  // ../../../node_modules/framer-motion/dist/es/value/types/utils/float-regex.mjs
  var floatRegex = /-?(?:\d+(?:\.\d+)?|\.\d+)/gu;

  // ../../../node_modules/framer-motion/dist/es/value/types/utils/is-nullish.mjs
  function isNullish(v) {
    return v == null;
  }

  // ../../../node_modules/framer-motion/dist/es/value/types/utils/single-color-regex.mjs
  var singleColorRegex = /^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))$/iu;

  // ../../../node_modules/framer-motion/dist/es/value/types/color/utils.mjs
  var isColorString = (type, testProp) => (v) => {
    return Boolean(typeof v === "string" && singleColorRegex.test(v) && v.startsWith(type) || testProp && !isNullish(v) && Object.prototype.hasOwnProperty.call(v, testProp));
  };
  var splitColor = (aName, bName, cName) => (v) => {
    if (typeof v !== "string")
      return v;
    const [a, b, c, alpha2] = v.match(floatRegex);
    return {
      [aName]: parseFloat(a),
      [bName]: parseFloat(b),
      [cName]: parseFloat(c),
      alpha: alpha2 !== void 0 ? parseFloat(alpha2) : 1
    };
  };

  // ../../../node_modules/framer-motion/dist/es/value/types/color/rgba.mjs
  var clampRgbUnit = (v) => clamp(0, 255, v);
  var rgbUnit = {
    ...number,
    transform: (v) => Math.round(clampRgbUnit(v))
  };
  var rgba = {
    test: /* @__PURE__ */ isColorString("rgb", "red"),
    parse: /* @__PURE__ */ splitColor("red", "green", "blue"),
    transform: ({ red, green, blue, alpha: alpha$1 = 1 }) => "rgba(" + rgbUnit.transform(red) + ", " + rgbUnit.transform(green) + ", " + rgbUnit.transform(blue) + ", " + sanitize(alpha.transform(alpha$1)) + ")"
  };

  // ../../../node_modules/framer-motion/dist/es/value/types/color/hex.mjs
  function parseHex(v) {
    let r2 = "";
    let g = "";
    let b = "";
    let a = "";
    if (v.length > 5) {
      r2 = v.substring(1, 3);
      g = v.substring(3, 5);
      b = v.substring(5, 7);
      a = v.substring(7, 9);
    } else {
      r2 = v.substring(1, 2);
      g = v.substring(2, 3);
      b = v.substring(3, 4);
      a = v.substring(4, 5);
      r2 += r2;
      g += g;
      b += b;
      a += a;
    }
    return {
      red: parseInt(r2, 16),
      green: parseInt(g, 16),
      blue: parseInt(b, 16),
      alpha: a ? parseInt(a, 16) / 255 : 1
    };
  }
  var hex = {
    test: /* @__PURE__ */ isColorString("#"),
    parse: parseHex,
    transform: rgba.transform
  };

  // ../../../node_modules/framer-motion/dist/es/value/types/color/hsla.mjs
  var hsla = {
    test: /* @__PURE__ */ isColorString("hsl", "hue"),
    parse: /* @__PURE__ */ splitColor("hue", "saturation", "lightness"),
    transform: ({ hue, saturation, lightness, alpha: alpha$1 = 1 }) => {
      return "hsla(" + Math.round(hue) + ", " + percent.transform(sanitize(saturation)) + ", " + percent.transform(sanitize(lightness)) + ", " + sanitize(alpha.transform(alpha$1)) + ")";
    }
  };

  // ../../../node_modules/framer-motion/dist/es/value/types/color/index.mjs
  var color = {
    test: (v) => rgba.test(v) || hex.test(v) || hsla.test(v),
    parse: (v) => {
      if (rgba.test(v)) {
        return rgba.parse(v);
      } else if (hsla.test(v)) {
        return hsla.parse(v);
      } else {
        return hex.parse(v);
      }
    },
    transform: (v) => {
      return typeof v === "string" ? v : v.hasOwnProperty("red") ? rgba.transform(v) : hsla.transform(v);
    }
  };

  // ../../../node_modules/framer-motion/dist/es/value/types/utils/color-regex.mjs
  var colorRegex = /(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))/giu;

  // ../../../node_modules/framer-motion/dist/es/value/types/complex/index.mjs
  function test(v) {
    var _a, _b;
    return isNaN(v) && typeof v === "string" && (((_a = v.match(floatRegex)) === null || _a === void 0 ? void 0 : _a.length) || 0) + (((_b = v.match(colorRegex)) === null || _b === void 0 ? void 0 : _b.length) || 0) > 0;
  }
  var NUMBER_TOKEN = "number";
  var COLOR_TOKEN = "color";
  var VAR_TOKEN = "var";
  var VAR_FUNCTION_TOKEN = "var(";
  var SPLIT_TOKEN = "${}";
  var complexRegex = /var\s*\(\s*--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)|#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\)|-?(?:\d+(?:\.\d+)?|\.\d+)/giu;
  function analyseComplexValue(value) {
    const originalValue = value.toString();
    const values = [];
    const indexes = {
      color: [],
      number: [],
      var: []
    };
    const types = [];
    let i = 0;
    const tokenised = originalValue.replace(complexRegex, (parsedValue) => {
      if (color.test(parsedValue)) {
        indexes.color.push(i);
        types.push(COLOR_TOKEN);
        values.push(color.parse(parsedValue));
      } else if (parsedValue.startsWith(VAR_FUNCTION_TOKEN)) {
        indexes.var.push(i);
        types.push(VAR_TOKEN);
        values.push(parsedValue);
      } else {
        indexes.number.push(i);
        types.push(NUMBER_TOKEN);
        values.push(parseFloat(parsedValue));
      }
      ++i;
      return SPLIT_TOKEN;
    });
    const split = tokenised.split(SPLIT_TOKEN);
    return { values, split, indexes, types };
  }
  function parseComplexValue(v) {
    return analyseComplexValue(v).values;
  }
  function createTransformer(source) {
    const { split, types } = analyseComplexValue(source);
    const numSections = split.length;
    return (v) => {
      let output = "";
      for (let i = 0; i < numSections; i++) {
        output += split[i];
        if (v[i] !== void 0) {
          const type = types[i];
          if (type === NUMBER_TOKEN) {
            output += sanitize(v[i]);
          } else if (type === COLOR_TOKEN) {
            output += color.transform(v[i]);
          } else {
            output += v[i];
          }
        }
      }
      return output;
    };
  }
  var convertNumbersToZero = (v) => typeof v === "number" ? 0 : v;
  function getAnimatableNone(v) {
    const parsed = parseComplexValue(v);
    const transformer = createTransformer(v);
    return transformer(parsed.map(convertNumbersToZero));
  }
  var complex = {
    test,
    parse: parseComplexValue,
    createTransformer,
    getAnimatableNone
  };

  // ../../../node_modules/framer-motion/dist/es/value/types/complex/filter.mjs
  var maxDefaults = /* @__PURE__ */ new Set(["brightness", "contrast", "saturate", "opacity"]);
  function applyDefaultFilter(v) {
    const [name, value] = v.slice(0, -1).split("(");
    if (name === "drop-shadow")
      return v;
    const [number2] = value.match(floatRegex) || [];
    if (!number2)
      return v;
    const unit = value.replace(number2, "");
    let defaultValue = maxDefaults.has(name) ? 1 : 0;
    if (number2 !== value)
      defaultValue *= 100;
    return name + "(" + defaultValue + unit + ")";
  }
  var functionRegex = /\b([a-z-]*)\(.*?\)/gu;
  var filter = {
    ...complex,
    getAnimatableNone: (v) => {
      const functions = v.match(functionRegex);
      return functions ? functions.map(applyDefaultFilter).join(" ") : v;
    }
  };

  // ../../../node_modules/framer-motion/dist/es/render/dom/value-types/defaults.mjs
  var defaultValueTypes = {
    ...numberValueTypes,
    // Color props
    color,
    backgroundColor: color,
    outlineColor: color,
    fill: color,
    stroke: color,
    // Border props
    borderColor: color,
    borderTopColor: color,
    borderRightColor: color,
    borderBottomColor: color,
    borderLeftColor: color,
    filter,
    WebkitFilter: filter
  };
  var getDefaultValueType = (key) => defaultValueTypes[key];

  // ../../../node_modules/framer-motion/dist/es/render/dom/value-types/animatable-none.mjs
  function getAnimatableNone2(key, value) {
    let defaultValueType = getDefaultValueType(key);
    if (defaultValueType !== filter)
      defaultValueType = complex;
    return defaultValueType.getAnimatableNone ? defaultValueType.getAnimatableNone(value) : void 0;
  }

  // ../../../node_modules/framer-motion/dist/es/render/html/utils/make-none-animatable.mjs
  var invalidTemplates = /* @__PURE__ */ new Set(["auto", "none", "0"]);
  function makeNoneKeyframesAnimatable(unresolvedKeyframes, noneKeyframeIndexes, name) {
    let i = 0;
    let animatableTemplate = void 0;
    while (i < unresolvedKeyframes.length && !animatableTemplate) {
      const keyframe = unresolvedKeyframes[i];
      if (typeof keyframe === "string" && !invalidTemplates.has(keyframe) && analyseComplexValue(keyframe).values.length) {
        animatableTemplate = unresolvedKeyframes[i];
      }
      i++;
    }
    if (animatableTemplate && name) {
      for (const noneIndex of noneKeyframeIndexes) {
        unresolvedKeyframes[noneIndex] = getAnimatableNone2(name, animatableTemplate);
      }
    }
  }

  // ../../../node_modules/framer-motion/dist/es/render/dom/utils/unit-conversion.mjs
  var isNumOrPxType = (v) => v === number || v === px;
  var getPosFromMatrix = (matrix, pos) => parseFloat(matrix.split(", ")[pos]);
  var getTranslateFromMatrix = (pos2, pos3) => (_bbox, { transform }) => {
    if (transform === "none" || !transform)
      return 0;
    const matrix3d = transform.match(/^matrix3d\((.+)\)$/u);
    if (matrix3d) {
      return getPosFromMatrix(matrix3d[1], pos3);
    } else {
      const matrix = transform.match(/^matrix\((.+)\)$/u);
      if (matrix) {
        return getPosFromMatrix(matrix[1], pos2);
      } else {
        return 0;
      }
    }
  };
  var transformKeys = /* @__PURE__ */ new Set(["x", "y", "z"]);
  var nonTranslationalTransformKeys = transformPropOrder.filter((key) => !transformKeys.has(key));
  function removeNonTranslationalTransform(visualElement) {
    const removedTransforms = [];
    nonTranslationalTransformKeys.forEach((key) => {
      const value = visualElement.getValue(key);
      if (value !== void 0) {
        removedTransforms.push([key, value.get()]);
        value.set(key.startsWith("scale") ? 1 : 0);
      }
    });
    return removedTransforms;
  }
  var positionalValues = {
    // Dimensions
    width: ({ x }, { paddingLeft = "0", paddingRight = "0" }) => x.max - x.min - parseFloat(paddingLeft) - parseFloat(paddingRight),
    height: ({ y }, { paddingTop = "0", paddingBottom = "0" }) => y.max - y.min - parseFloat(paddingTop) - parseFloat(paddingBottom),
    top: (_bbox, { top }) => parseFloat(top),
    left: (_bbox, { left }) => parseFloat(left),
    bottom: ({ y }, { top }) => parseFloat(top) + (y.max - y.min),
    right: ({ x }, { left }) => parseFloat(left) + (x.max - x.min),
    // Transform
    x: getTranslateFromMatrix(4, 13),
    y: getTranslateFromMatrix(5, 14)
  };
  positionalValues.translateX = positionalValues.x;
  positionalValues.translateY = positionalValues.y;

  // ../../../node_modules/framer-motion/dist/es/render/utils/KeyframesResolver.mjs
  var toResolve = /* @__PURE__ */ new Set();
  var isScheduled = false;
  var anyNeedsMeasurement = false;
  function measureAllKeyframes() {
    if (anyNeedsMeasurement) {
      const resolversToMeasure = Array.from(toResolve).filter((resolver) => resolver.needsMeasurement);
      const elementsToMeasure = new Set(resolversToMeasure.map((resolver) => resolver.element));
      const transformsToRestore = /* @__PURE__ */ new Map();
      elementsToMeasure.forEach((element) => {
        const removedTransforms = removeNonTranslationalTransform(element);
        if (!removedTransforms.length)
          return;
        transformsToRestore.set(element, removedTransforms);
        element.render();
      });
      resolversToMeasure.forEach((resolver) => resolver.measureInitialState());
      elementsToMeasure.forEach((element) => {
        element.render();
        const restore = transformsToRestore.get(element);
        if (restore) {
          restore.forEach(([key, value]) => {
            var _a;
            (_a = element.getValue(key)) === null || _a === void 0 ? void 0 : _a.set(value);
          });
        }
      });
      resolversToMeasure.forEach((resolver) => resolver.measureEndState());
      resolversToMeasure.forEach((resolver) => {
        if (resolver.suspendedScrollY !== void 0) {
          window.scrollTo(0, resolver.suspendedScrollY);
        }
      });
    }
    anyNeedsMeasurement = false;
    isScheduled = false;
    toResolve.forEach((resolver) => resolver.complete());
    toResolve.clear();
  }
  function readAllKeyframes() {
    toResolve.forEach((resolver) => {
      resolver.readKeyframes();
      if (resolver.needsMeasurement) {
        anyNeedsMeasurement = true;
      }
    });
  }
  function flushKeyframeResolvers() {
    readAllKeyframes();
    measureAllKeyframes();
  }
  var KeyframeResolver = class {
    constructor(unresolvedKeyframes, onComplete, name, motionValue2, element, isAsync = false) {
      this.isComplete = false;
      this.isAsync = false;
      this.needsMeasurement = false;
      this.isScheduled = false;
      this.unresolvedKeyframes = [...unresolvedKeyframes];
      this.onComplete = onComplete;
      this.name = name;
      this.motionValue = motionValue2;
      this.element = element;
      this.isAsync = isAsync;
    }
    scheduleResolve() {
      this.isScheduled = true;
      if (this.isAsync) {
        toResolve.add(this);
        if (!isScheduled) {
          isScheduled = true;
          frame.read(readAllKeyframes);
          frame.resolveKeyframes(measureAllKeyframes);
        }
      } else {
        this.readKeyframes();
        this.complete();
      }
    }
    readKeyframes() {
      const { unresolvedKeyframes, name, element, motionValue: motionValue2 } = this;
      for (let i = 0; i < unresolvedKeyframes.length; i++) {
        if (unresolvedKeyframes[i] === null) {
          if (i === 0) {
            const currentValue = motionValue2 === null || motionValue2 === void 0 ? void 0 : motionValue2.get();
            const finalKeyframe = unresolvedKeyframes[unresolvedKeyframes.length - 1];
            if (currentValue !== void 0) {
              unresolvedKeyframes[0] = currentValue;
            } else if (element && name) {
              const valueAsRead = element.readValue(name, finalKeyframe);
              if (valueAsRead !== void 0 && valueAsRead !== null) {
                unresolvedKeyframes[0] = valueAsRead;
              }
            }
            if (unresolvedKeyframes[0] === void 0) {
              unresolvedKeyframes[0] = finalKeyframe;
            }
            if (motionValue2 && currentValue === void 0) {
              motionValue2.set(unresolvedKeyframes[0]);
            }
          } else {
            unresolvedKeyframes[i] = unresolvedKeyframes[i - 1];
          }
        }
      }
    }
    setFinalKeyframe() {
    }
    measureInitialState() {
    }
    renderEndStyles() {
    }
    measureEndState() {
    }
    complete() {
      this.isComplete = true;
      this.onComplete(this.unresolvedKeyframes, this.finalKeyframe);
      toResolve.delete(this);
    }
    cancel() {
      if (!this.isComplete) {
        this.isScheduled = false;
        toResolve.delete(this);
      }
    }
    resume() {
      if (!this.isComplete)
        this.scheduleResolve();
    }
  };

  // ../../../node_modules/framer-motion/dist/es/utils/is-numerical-string.mjs
  var isNumericalString = (v) => /^-?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(v);

  // ../../../node_modules/framer-motion/dist/es/render/dom/utils/css-variables-conversion.mjs
  var splitCSSVariableRegex = (
    // eslint-disable-next-line redos-detector/no-unsafe-regex -- false positive, as it can match a lot of words
    /^var\(--(?:([\w-]+)|([\w-]+), ?([a-zA-Z\d ()%#.,-]+))\)/u
  );
  function parseCSSVariable(current) {
    const match = splitCSSVariableRegex.exec(current);
    if (!match)
      return [,];
    const [, token1, token2, fallback] = match;
    return [`--${token1 !== null && token1 !== void 0 ? token1 : token2}`, fallback];
  }
  var maxDepth = 4;
  function getVariableValue(current, element, depth = 1) {
    invariant(depth <= maxDepth, `Max CSS variable fallback depth detected in property "${current}". This may indicate a circular fallback dependency.`);
    const [token, fallback] = parseCSSVariable(current);
    if (!token)
      return;
    const resolved = window.getComputedStyle(element).getPropertyValue(token);
    if (resolved) {
      const trimmed = resolved.trim();
      return isNumericalString(trimmed) ? parseFloat(trimmed) : trimmed;
    }
    return isCSSVariableToken(fallback) ? getVariableValue(fallback, element, depth + 1) : fallback;
  }

  // ../../../node_modules/framer-motion/dist/es/render/dom/value-types/test.mjs
  var testValueType = (v) => (type) => type.test(v);

  // ../../../node_modules/framer-motion/dist/es/render/dom/value-types/type-auto.mjs
  var auto = {
    test: (v) => v === "auto",
    parse: (v) => v
  };

  // ../../../node_modules/framer-motion/dist/es/render/dom/value-types/dimensions.mjs
  var dimensionValueTypes = [number, px, percent, degrees, vw, vh, auto];
  var findDimensionValueType = (v) => dimensionValueTypes.find(testValueType(v));

  // ../../../node_modules/framer-motion/dist/es/render/dom/DOMKeyframesResolver.mjs
  var DOMKeyframesResolver = class extends KeyframeResolver {
    constructor(unresolvedKeyframes, onComplete, name, motionValue2, element) {
      super(unresolvedKeyframes, onComplete, name, motionValue2, element, true);
    }
    readKeyframes() {
      const { unresolvedKeyframes, element, name } = this;
      if (!element || !element.current)
        return;
      super.readKeyframes();
      for (let i = 0; i < unresolvedKeyframes.length; i++) {
        let keyframe = unresolvedKeyframes[i];
        if (typeof keyframe === "string") {
          keyframe = keyframe.trim();
          if (isCSSVariableToken(keyframe)) {
            const resolved = getVariableValue(keyframe, element.current);
            if (resolved !== void 0) {
              unresolvedKeyframes[i] = resolved;
            }
            if (i === unresolvedKeyframes.length - 1) {
              this.finalKeyframe = keyframe;
            }
          }
        }
      }
      this.resolveNoneKeyframes();
      if (!positionalKeys.has(name) || unresolvedKeyframes.length !== 2) {
        return;
      }
      const [origin, target] = unresolvedKeyframes;
      const originType = findDimensionValueType(origin);
      const targetType = findDimensionValueType(target);
      if (originType === targetType)
        return;
      if (isNumOrPxType(originType) && isNumOrPxType(targetType)) {
        for (let i = 0; i < unresolvedKeyframes.length; i++) {
          const value = unresolvedKeyframes[i];
          if (typeof value === "string") {
            unresolvedKeyframes[i] = parseFloat(value);
          }
        }
      } else {
        this.needsMeasurement = true;
      }
    }
    resolveNoneKeyframes() {
      const { unresolvedKeyframes, name } = this;
      const noneKeyframeIndexes = [];
      for (let i = 0; i < unresolvedKeyframes.length; i++) {
        if (isNone(unresolvedKeyframes[i])) {
          noneKeyframeIndexes.push(i);
        }
      }
      if (noneKeyframeIndexes.length) {
        makeNoneKeyframesAnimatable(unresolvedKeyframes, noneKeyframeIndexes, name);
      }
    }
    measureInitialState() {
      const { element, unresolvedKeyframes, name } = this;
      if (!element || !element.current)
        return;
      if (name === "height") {
        this.suspendedScrollY = window.pageYOffset;
      }
      this.measuredOrigin = positionalValues[name](element.measureViewportBox(), window.getComputedStyle(element.current));
      unresolvedKeyframes[0] = this.measuredOrigin;
      const measureKeyframe = unresolvedKeyframes[unresolvedKeyframes.length - 1];
      if (measureKeyframe !== void 0) {
        element.getValue(name, measureKeyframe).jump(measureKeyframe, false);
      }
    }
    measureEndState() {
      var _a;
      const { element, name, unresolvedKeyframes } = this;
      if (!element || !element.current)
        return;
      const value = element.getValue(name);
      value && value.jump(this.measuredOrigin, false);
      const finalKeyframeIndex = unresolvedKeyframes.length - 1;
      const finalKeyframe = unresolvedKeyframes[finalKeyframeIndex];
      unresolvedKeyframes[finalKeyframeIndex] = positionalValues[name](element.measureViewportBox(), window.getComputedStyle(element.current));
      if (finalKeyframe !== null && this.finalKeyframe === void 0) {
        this.finalKeyframe = finalKeyframe;
      }
      if ((_a = this.removedTransforms) === null || _a === void 0 ? void 0 : _a.length) {
        this.removedTransforms.forEach(([unsetTransformName, unsetTransformValue]) => {
          element.getValue(unsetTransformName).set(unsetTransformValue);
        });
      }
      this.resolveNoneKeyframes();
    }
  };

  // ../../../node_modules/framer-motion/dist/es/animation/utils/is-animatable.mjs
  var isAnimatable = (value, name) => {
    if (name === "zIndex")
      return false;
    if (typeof value === "number" || Array.isArray(value))
      return true;
    if (typeof value === "string" && // It's animatable if we have a string
    (complex.test(value) || value === "0") && // And it contains numbers and/or colors
    !value.startsWith("url(")) {
      return true;
    }
    return false;
  };

  // ../../../node_modules/framer-motion/dist/es/animation/animators/utils/can-animate.mjs
  function hasKeyframesChanged(keyframes2) {
    const current = keyframes2[0];
    if (keyframes2.length === 1)
      return true;
    for (let i = 0; i < keyframes2.length; i++) {
      if (keyframes2[i] !== current)
        return true;
    }
  }
  function canAnimate(keyframes2, name, type, velocity) {
    const originKeyframe = keyframes2[0];
    if (originKeyframe === null)
      return false;
    if (name === "display" || name === "visibility")
      return true;
    const targetKeyframe = keyframes2[keyframes2.length - 1];
    const isOriginAnimatable = isAnimatable(originKeyframe, name);
    const isTargetAnimatable = isAnimatable(targetKeyframe, name);
    warning(isOriginAnimatable === isTargetAnimatable, `You are trying to animate ${name} from "${originKeyframe}" to "${targetKeyframe}". ${originKeyframe} is not an animatable value - to enable this animation set ${originKeyframe} to a value animatable to ${targetKeyframe} via the \`style\` property.`);
    if (!isOriginAnimatable || !isTargetAnimatable) {
      return false;
    }
    return hasKeyframesChanged(keyframes2) || (type === "spring" || isGenerator(type)) && velocity;
  }

  // ../../../node_modules/framer-motion/dist/es/animation/animators/waapi/utils/get-final-keyframe.mjs
  var isNotNull = (value) => value !== null;
  function getFinalKeyframe(keyframes2, { repeat, repeatType = "loop" }, finalKeyframe) {
    const resolvedKeyframes = keyframes2.filter(isNotNull);
    const index = repeat && repeatType !== "loop" && repeat % 2 === 1 ? 0 : resolvedKeyframes.length - 1;
    return !index || finalKeyframe === void 0 ? resolvedKeyframes[index] : finalKeyframe;
  }

  // ../../../node_modules/framer-motion/dist/es/animation/animators/BaseAnimation.mjs
  var MAX_RESOLVE_DELAY = 40;
  var BaseAnimation = class {
    constructor({ autoplay = true, delay: delay2 = 0, type = "keyframes", repeat = 0, repeatDelay = 0, repeatType = "loop", ...options }) {
      this.isStopped = false;
      this.hasAttemptedResolve = false;
      this.createdAt = time.now();
      this.options = {
        autoplay,
        delay: delay2,
        type,
        repeat,
        repeatDelay,
        repeatType,
        ...options
      };
      this.updateFinishedPromise();
    }
    /**
     * This method uses the createdAt and resolvedAt to calculate the
     * animation startTime. *Ideally*, we would use the createdAt time as t=0
     * as the following frame would then be the first frame of the animation in
     * progress, which would feel snappier.
     *
     * However, if there's a delay (main thread work) between the creation of
     * the animation and the first commited frame, we prefer to use resolvedAt
     * to avoid a sudden jump into the animation.
     */
    calcStartTime() {
      if (!this.resolvedAt)
        return this.createdAt;
      return this.resolvedAt - this.createdAt > MAX_RESOLVE_DELAY ? this.resolvedAt : this.createdAt;
    }
    /**
     * A getter for resolved data. If keyframes are not yet resolved, accessing
     * this.resolved will synchronously flush all pending keyframe resolvers.
     * This is a deoptimisation, but at its worst still batches read/writes.
     */
    get resolved() {
      if (!this._resolved && !this.hasAttemptedResolve) {
        flushKeyframeResolvers();
      }
      return this._resolved;
    }
    /**
     * A method to be called when the keyframes resolver completes. This method
     * will check if its possible to run the animation and, if not, skip it.
     * Otherwise, it will call initPlayback on the implementing class.
     */
    onKeyframesResolved(keyframes2, finalKeyframe) {
      this.resolvedAt = time.now();
      this.hasAttemptedResolve = true;
      const { name, type, velocity, delay: delay2, onComplete, onUpdate, isGenerator: isGenerator2 } = this.options;
      if (!isGenerator2 && !canAnimate(keyframes2, name, type, velocity)) {
        if (instantAnimationState.current || !delay2) {
          onUpdate && onUpdate(getFinalKeyframe(keyframes2, this.options, finalKeyframe));
          onComplete && onComplete();
          this.resolveFinishedPromise();
          return;
        } else {
          this.options.duration = 0;
        }
      }
      const resolvedAnimation = this.initPlayback(keyframes2, finalKeyframe);
      if (resolvedAnimation === false)
        return;
      this._resolved = {
        keyframes: keyframes2,
        finalKeyframe,
        ...resolvedAnimation
      };
      this.onPostResolved();
    }
    onPostResolved() {
    }
    /**
     * Allows the returned animation to be awaited or promise-chained. Currently
     * resolves when the animation finishes at all but in a future update could/should
     * reject if its cancels.
     */
    then(resolve, reject) {
      return this.currentFinishedPromise.then(resolve, reject);
    }
    flatten() {
      this.options.type = "keyframes";
      this.options.ease = "linear";
    }
    updateFinishedPromise() {
      this.currentFinishedPromise = new Promise((resolve) => {
        this.resolveFinishedPromise = resolve;
      });
    }
  };

  // ../../../node_modules/framer-motion/dist/es/utils/mix/number.mjs
  var mixNumber = (from, to, progress2) => {
    return from + (to - from) * progress2;
  };

  // ../../../node_modules/framer-motion/dist/es/utils/hsla-to-rgba.mjs
  function hueToRgb(p, q, t) {
    if (t < 0)
      t += 1;
    if (t > 1)
      t -= 1;
    if (t < 1 / 6)
      return p + (q - p) * 6 * t;
    if (t < 1 / 2)
      return q;
    if (t < 2 / 3)
      return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  function hslaToRgba({ hue, saturation, lightness, alpha: alpha2 }) {
    hue /= 360;
    saturation /= 100;
    lightness /= 100;
    let red = 0;
    let green = 0;
    let blue = 0;
    if (!saturation) {
      red = green = blue = lightness;
    } else {
      const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
      const p = 2 * lightness - q;
      red = hueToRgb(p, q, hue + 1 / 3);
      green = hueToRgb(p, q, hue);
      blue = hueToRgb(p, q, hue - 1 / 3);
    }
    return {
      red: Math.round(red * 255),
      green: Math.round(green * 255),
      blue: Math.round(blue * 255),
      alpha: alpha2
    };
  }

  // ../../../node_modules/framer-motion/dist/es/utils/mix/immediate.mjs
  function mixImmediate(a, b) {
    return (p) => p > 0 ? b : a;
  }

  // ../../../node_modules/framer-motion/dist/es/utils/mix/color.mjs
  var mixLinearColor = (from, to, v) => {
    const fromExpo = from * from;
    const expo = v * (to * to - fromExpo) + fromExpo;
    return expo < 0 ? 0 : Math.sqrt(expo);
  };
  var colorTypes = [hex, rgba, hsla];
  var getColorType = (v) => colorTypes.find((type) => type.test(v));
  function asRGBA(color2) {
    const type = getColorType(color2);
    warning(Boolean(type), `'${color2}' is not an animatable color. Use the equivalent color code instead.`);
    if (!Boolean(type))
      return false;
    let model = type.parse(color2);
    if (type === hsla) {
      model = hslaToRgba(model);
    }
    return model;
  }
  var mixColor = (from, to) => {
    const fromRGBA = asRGBA(from);
    const toRGBA = asRGBA(to);
    if (!fromRGBA || !toRGBA) {
      return mixImmediate(from, to);
    }
    const blended = { ...fromRGBA };
    return (v) => {
      blended.red = mixLinearColor(fromRGBA.red, toRGBA.red, v);
      blended.green = mixLinearColor(fromRGBA.green, toRGBA.green, v);
      blended.blue = mixLinearColor(fromRGBA.blue, toRGBA.blue, v);
      blended.alpha = mixNumber(fromRGBA.alpha, toRGBA.alpha, v);
      return rgba.transform(blended);
    };
  };

  // ../../../node_modules/framer-motion/dist/es/utils/pipe.mjs
  var combineFunctions = (a, b) => (v) => b(a(v));
  var pipe = (...transformers) => transformers.reduce(combineFunctions);

  // ../../../node_modules/framer-motion/dist/es/utils/mix/visibility.mjs
  var invisibleValues = /* @__PURE__ */ new Set(["none", "hidden"]);
  function mixVisibility(origin, target) {
    if (invisibleValues.has(origin)) {
      return (p) => p <= 0 ? origin : target;
    } else {
      return (p) => p >= 1 ? target : origin;
    }
  }

  // ../../../node_modules/framer-motion/dist/es/utils/mix/complex.mjs
  function mixNumber2(a, b) {
    return (p) => mixNumber(a, b, p);
  }
  function getMixer(a) {
    if (typeof a === "number") {
      return mixNumber2;
    } else if (typeof a === "string") {
      return isCSSVariableToken(a) ? mixImmediate : color.test(a) ? mixColor : mixComplex;
    } else if (Array.isArray(a)) {
      return mixArray;
    } else if (typeof a === "object") {
      return color.test(a) ? mixColor : mixObject;
    }
    return mixImmediate;
  }
  function mixArray(a, b) {
    const output = [...a];
    const numValues = output.length;
    const blendValue = a.map((v, i) => getMixer(v)(v, b[i]));
    return (p) => {
      for (let i = 0; i < numValues; i++) {
        output[i] = blendValue[i](p);
      }
      return output;
    };
  }
  function mixObject(a, b) {
    const output = { ...a, ...b };
    const blendValue = {};
    for (const key in output) {
      if (a[key] !== void 0 && b[key] !== void 0) {
        blendValue[key] = getMixer(a[key])(a[key], b[key]);
      }
    }
    return (v) => {
      for (const key in blendValue) {
        output[key] = blendValue[key](v);
      }
      return output;
    };
  }
  function matchOrder(origin, target) {
    var _a;
    const orderedOrigin = [];
    const pointers = { color: 0, var: 0, number: 0 };
    for (let i = 0; i < target.values.length; i++) {
      const type = target.types[i];
      const originIndex = origin.indexes[type][pointers[type]];
      const originValue = (_a = origin.values[originIndex]) !== null && _a !== void 0 ? _a : 0;
      orderedOrigin[i] = originValue;
      pointers[type]++;
    }
    return orderedOrigin;
  }
  var mixComplex = (origin, target) => {
    const template = complex.createTransformer(target);
    const originStats = analyseComplexValue(origin);
    const targetStats = analyseComplexValue(target);
    const canInterpolate = originStats.indexes.var.length === targetStats.indexes.var.length && originStats.indexes.color.length === targetStats.indexes.color.length && originStats.indexes.number.length >= targetStats.indexes.number.length;
    if (canInterpolate) {
      if (invisibleValues.has(origin) && !targetStats.values.length || invisibleValues.has(target) && !originStats.values.length) {
        return mixVisibility(origin, target);
      }
      return pipe(mixArray(matchOrder(originStats, targetStats), targetStats.values), template);
    } else {
      warning(true, `Complex values '${origin}' and '${target}' too different to mix. Ensure all colors are of the same type, and that each contains the same quantity of number and color values. Falling back to instant transition.`);
      return mixImmediate(origin, target);
    }
  };

  // ../../../node_modules/framer-motion/dist/es/utils/mix/index.mjs
  function mix(from, to, p) {
    if (typeof from === "number" && typeof to === "number" && typeof p === "number") {
      return mixNumber(from, to, p);
    }
    const mixer = getMixer(from);
    return mixer(from, to);
  }

  // ../../../node_modules/framer-motion/dist/es/animation/generators/utils/velocity.mjs
  var velocitySampleDuration = 5;
  function calcGeneratorVelocity(resolveValue, t, current) {
    const prevT = Math.max(t - velocitySampleDuration, 0);
    return velocityPerSecond(current - resolveValue(prevT), t - prevT);
  }

  // ../../../node_modules/framer-motion/dist/es/animation/generators/spring/defaults.mjs
  var springDefaults = {
    // Default spring physics
    stiffness: 100,
    damping: 10,
    mass: 1,
    velocity: 0,
    // Default duration/bounce-based options
    duration: 800,
    // in ms
    bounce: 0.3,
    visualDuration: 0.3,
    // in seconds
    // Rest thresholds
    restSpeed: {
      granular: 0.01,
      default: 2
    },
    restDelta: {
      granular: 5e-3,
      default: 0.5
    },
    // Limits
    minDuration: 0.01,
    // in seconds
    maxDuration: 10,
    // in seconds
    minDamping: 0.05,
    maxDamping: 1
  };

  // ../../../node_modules/framer-motion/dist/es/animation/generators/spring/find.mjs
  var safeMin = 1e-3;
  function findSpring({ duration = springDefaults.duration, bounce = springDefaults.bounce, velocity = springDefaults.velocity, mass = springDefaults.mass }) {
    let envelope;
    let derivative;
    warning(duration <= secondsToMilliseconds(springDefaults.maxDuration), "Spring duration must be 10 seconds or less");
    let dampingRatio = 1 - bounce;
    dampingRatio = clamp(springDefaults.minDamping, springDefaults.maxDamping, dampingRatio);
    duration = clamp(springDefaults.minDuration, springDefaults.maxDuration, millisecondsToSeconds(duration));
    if (dampingRatio < 1) {
      envelope = (undampedFreq2) => {
        const exponentialDecay = undampedFreq2 * dampingRatio;
        const delta = exponentialDecay * duration;
        const a = exponentialDecay - velocity;
        const b = calcAngularFreq(undampedFreq2, dampingRatio);
        const c = Math.exp(-delta);
        return safeMin - a / b * c;
      };
      derivative = (undampedFreq2) => {
        const exponentialDecay = undampedFreq2 * dampingRatio;
        const delta = exponentialDecay * duration;
        const d = delta * velocity + velocity;
        const e = Math.pow(dampingRatio, 2) * Math.pow(undampedFreq2, 2) * duration;
        const f = Math.exp(-delta);
        const g = calcAngularFreq(Math.pow(undampedFreq2, 2), dampingRatio);
        const factor = -envelope(undampedFreq2) + safeMin > 0 ? -1 : 1;
        return factor * ((d - e) * f) / g;
      };
    } else {
      envelope = (undampedFreq2) => {
        const a = Math.exp(-undampedFreq2 * duration);
        const b = (undampedFreq2 - velocity) * duration + 1;
        return -safeMin + a * b;
      };
      derivative = (undampedFreq2) => {
        const a = Math.exp(-undampedFreq2 * duration);
        const b = (velocity - undampedFreq2) * (duration * duration);
        return a * b;
      };
    }
    const initialGuess = 5 / duration;
    const undampedFreq = approximateRoot(envelope, derivative, initialGuess);
    duration = secondsToMilliseconds(duration);
    if (isNaN(undampedFreq)) {
      return {
        stiffness: springDefaults.stiffness,
        damping: springDefaults.damping,
        duration
      };
    } else {
      const stiffness = Math.pow(undampedFreq, 2) * mass;
      return {
        stiffness,
        damping: dampingRatio * 2 * Math.sqrt(mass * stiffness),
        duration
      };
    }
  }
  var rootIterations = 12;
  function approximateRoot(envelope, derivative, initialGuess) {
    let result = initialGuess;
    for (let i = 1; i < rootIterations; i++) {
      result = result - envelope(result) / derivative(result);
    }
    return result;
  }
  function calcAngularFreq(undampedFreq, dampingRatio) {
    return undampedFreq * Math.sqrt(1 - dampingRatio * dampingRatio);
  }

  // ../../../node_modules/framer-motion/dist/es/animation/generators/spring/index.mjs
  var durationKeys = ["duration", "bounce"];
  var physicsKeys = ["stiffness", "damping", "mass"];
  function isSpringType(options, keys) {
    return keys.some((key) => options[key] !== void 0);
  }
  function getSpringOptions(options) {
    let springOptions = {
      velocity: springDefaults.velocity,
      stiffness: springDefaults.stiffness,
      damping: springDefaults.damping,
      mass: springDefaults.mass,
      isResolvedFromDuration: false,
      ...options
    };
    if (!isSpringType(options, physicsKeys) && isSpringType(options, durationKeys)) {
      if (options.visualDuration) {
        const visualDuration = options.visualDuration;
        const root = 2 * Math.PI / (visualDuration * 1.2);
        const stiffness = root * root;
        const damping = 2 * clamp(0.05, 1, 1 - (options.bounce || 0)) * Math.sqrt(stiffness);
        springOptions = {
          ...springOptions,
          mass: springDefaults.mass,
          stiffness,
          damping
        };
      } else {
        const derived = findSpring(options);
        springOptions = {
          ...springOptions,
          ...derived,
          mass: springDefaults.mass
        };
        springOptions.isResolvedFromDuration = true;
      }
    }
    return springOptions;
  }
  function spring(optionsOrVisualDuration = springDefaults.visualDuration, bounce = springDefaults.bounce) {
    const options = typeof optionsOrVisualDuration !== "object" ? {
      visualDuration: optionsOrVisualDuration,
      keyframes: [0, 1],
      bounce
    } : optionsOrVisualDuration;
    let { restSpeed, restDelta } = options;
    const origin = options.keyframes[0];
    const target = options.keyframes[options.keyframes.length - 1];
    const state = { done: false, value: origin };
    const { stiffness, damping, mass, duration, velocity, isResolvedFromDuration } = getSpringOptions({
      ...options,
      velocity: -millisecondsToSeconds(options.velocity || 0)
    });
    const initialVelocity = velocity || 0;
    const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass));
    const initialDelta = target - origin;
    const undampedAngularFreq = millisecondsToSeconds(Math.sqrt(stiffness / mass));
    const isGranularScale = Math.abs(initialDelta) < 5;
    restSpeed || (restSpeed = isGranularScale ? springDefaults.restSpeed.granular : springDefaults.restSpeed.default);
    restDelta || (restDelta = isGranularScale ? springDefaults.restDelta.granular : springDefaults.restDelta.default);
    let resolveSpring;
    if (dampingRatio < 1) {
      const angularFreq = calcAngularFreq(undampedAngularFreq, dampingRatio);
      resolveSpring = (t) => {
        const envelope = Math.exp(-dampingRatio * undampedAngularFreq * t);
        return target - envelope * ((initialVelocity + dampingRatio * undampedAngularFreq * initialDelta) / angularFreq * Math.sin(angularFreq * t) + initialDelta * Math.cos(angularFreq * t));
      };
    } else if (dampingRatio === 1) {
      resolveSpring = (t) => target - Math.exp(-undampedAngularFreq * t) * (initialDelta + (initialVelocity + undampedAngularFreq * initialDelta) * t);
    } else {
      const dampedAngularFreq = undampedAngularFreq * Math.sqrt(dampingRatio * dampingRatio - 1);
      resolveSpring = (t) => {
        const envelope = Math.exp(-dampingRatio * undampedAngularFreq * t);
        const freqForT = Math.min(dampedAngularFreq * t, 300);
        return target - envelope * ((initialVelocity + dampingRatio * undampedAngularFreq * initialDelta) * Math.sinh(freqForT) + dampedAngularFreq * initialDelta * Math.cosh(freqForT)) / dampedAngularFreq;
      };
    }
    const generator = {
      calculatedDuration: isResolvedFromDuration ? duration || null : null,
      next: (t) => {
        const current = resolveSpring(t);
        if (!isResolvedFromDuration) {
          let currentVelocity = 0;
          if (dampingRatio < 1) {
            currentVelocity = t === 0 ? secondsToMilliseconds(initialVelocity) : calcGeneratorVelocity(resolveSpring, t, current);
          }
          const isBelowVelocityThreshold = Math.abs(currentVelocity) <= restSpeed;
          const isBelowDisplacementThreshold = Math.abs(target - current) <= restDelta;
          state.done = isBelowVelocityThreshold && isBelowDisplacementThreshold;
        } else {
          state.done = t >= duration;
        }
        state.value = state.done ? target : current;
        return state;
      },
      toString: () => {
        const calculatedDuration = Math.min(calcGeneratorDuration(generator), maxGeneratorDuration);
        const easing = generateLinearEasing((progress2) => generator.next(calculatedDuration * progress2).value, calculatedDuration, 30);
        return calculatedDuration + "ms " + easing;
      }
    };
    return generator;
  }

  // ../../../node_modules/framer-motion/dist/es/animation/generators/inertia.mjs
  function inertia({ keyframes: keyframes2, velocity = 0, power = 0.8, timeConstant = 325, bounceDamping = 10, bounceStiffness = 500, modifyTarget, min, max, restDelta = 0.5, restSpeed }) {
    const origin = keyframes2[0];
    const state = {
      done: false,
      value: origin
    };
    const isOutOfBounds = (v) => min !== void 0 && v < min || max !== void 0 && v > max;
    const nearestBoundary = (v) => {
      if (min === void 0)
        return max;
      if (max === void 0)
        return min;
      return Math.abs(min - v) < Math.abs(max - v) ? min : max;
    };
    let amplitude = power * velocity;
    const ideal = origin + amplitude;
    const target = modifyTarget === void 0 ? ideal : modifyTarget(ideal);
    if (target !== ideal)
      amplitude = target - origin;
    const calcDelta = (t) => -amplitude * Math.exp(-t / timeConstant);
    const calcLatest = (t) => target + calcDelta(t);
    const applyFriction = (t) => {
      const delta = calcDelta(t);
      const latest = calcLatest(t);
      state.done = Math.abs(delta) <= restDelta;
      state.value = state.done ? target : latest;
    };
    let timeReachedBoundary;
    let spring$1;
    const checkCatchBoundary = (t) => {
      if (!isOutOfBounds(state.value))
        return;
      timeReachedBoundary = t;
      spring$1 = spring({
        keyframes: [state.value, nearestBoundary(state.value)],
        velocity: calcGeneratorVelocity(calcLatest, t, state.value),
        // TODO: This should be passing * 1000
        damping: bounceDamping,
        stiffness: bounceStiffness,
        restDelta,
        restSpeed
      });
    };
    checkCatchBoundary(0);
    return {
      calculatedDuration: null,
      next: (t) => {
        let hasUpdatedFrame = false;
        if (!spring$1 && timeReachedBoundary === void 0) {
          hasUpdatedFrame = true;
          applyFriction(t);
          checkCatchBoundary(t);
        }
        if (timeReachedBoundary !== void 0 && t >= timeReachedBoundary) {
          return spring$1.next(t - timeReachedBoundary);
        } else {
          !hasUpdatedFrame && applyFriction(t);
          return state;
        }
      }
    };
  }

  // ../../../node_modules/framer-motion/dist/es/easing/ease.mjs
  var easeIn = /* @__PURE__ */ cubicBezier(0.42, 0, 1, 1);
  var easeOut = /* @__PURE__ */ cubicBezier(0, 0, 0.58, 1);
  var easeInOut = /* @__PURE__ */ cubicBezier(0.42, 0, 0.58, 1);

  // ../../../node_modules/framer-motion/dist/es/easing/utils/is-easing-array.mjs
  var isEasingArray = (ease2) => {
    return Array.isArray(ease2) && typeof ease2[0] !== "number";
  };

  // ../../../node_modules/framer-motion/dist/es/easing/utils/map.mjs
  var easingLookup = {
    linear: noop,
    easeIn,
    easeInOut,
    easeOut,
    circIn,
    circInOut,
    circOut,
    backIn,
    backInOut,
    backOut,
    anticipate
  };
  var easingDefinitionToFunction = (definition) => {
    if (isBezierDefinition(definition)) {
      invariant(definition.length === 4, `Cubic bezier arrays must contain four numerical values.`);
      const [x1, y1, x2, y2] = definition;
      return cubicBezier(x1, y1, x2, y2);
    } else if (typeof definition === "string") {
      invariant(easingLookup[definition] !== void 0, `Invalid easing type '${definition}'`);
      return easingLookup[definition];
    }
    return definition;
  };

  // ../../../node_modules/framer-motion/dist/es/utils/interpolate.mjs
  function createMixers(output, ease2, customMixer) {
    const mixers = [];
    const mixerFactory = customMixer || mix;
    const numMixers = output.length - 1;
    for (let i = 0; i < numMixers; i++) {
      let mixer = mixerFactory(output[i], output[i + 1]);
      if (ease2) {
        const easingFunction = Array.isArray(ease2) ? ease2[i] || noop : ease2;
        mixer = pipe(easingFunction, mixer);
      }
      mixers.push(mixer);
    }
    return mixers;
  }
  function interpolate(input, output, { clamp: isClamp = true, ease: ease2, mixer } = {}) {
    const inputLength = input.length;
    invariant(inputLength === output.length, "Both input and output ranges must be the same length");
    if (inputLength === 1)
      return () => output[0];
    if (inputLength === 2 && output[0] === output[1])
      return () => output[1];
    const isZeroDeltaRange = input[0] === input[1];
    if (input[0] > input[inputLength - 1]) {
      input = [...input].reverse();
      output = [...output].reverse();
    }
    const mixers = createMixers(output, ease2, mixer);
    const numMixers = mixers.length;
    const interpolator = (v) => {
      if (isZeroDeltaRange && v < input[0])
        return output[0];
      let i = 0;
      if (numMixers > 1) {
        for (; i < input.length - 2; i++) {
          if (v < input[i + 1])
            break;
        }
      }
      const progressInRange = progress(input[i], input[i + 1], v);
      return mixers[i](progressInRange);
    };
    return isClamp ? (v) => interpolator(clamp(input[0], input[inputLength - 1], v)) : interpolator;
  }

  // ../../../node_modules/framer-motion/dist/es/utils/offsets/fill.mjs
  function fillOffset(offset, remaining) {
    const min = offset[offset.length - 1];
    for (let i = 1; i <= remaining; i++) {
      const offsetProgress = progress(0, remaining, i);
      offset.push(mixNumber(min, 1, offsetProgress));
    }
  }

  // ../../../node_modules/framer-motion/dist/es/utils/offsets/default.mjs
  function defaultOffset(arr) {
    const offset = [0];
    fillOffset(offset, arr.length - 1);
    return offset;
  }

  // ../../../node_modules/framer-motion/dist/es/utils/offsets/time.mjs
  function convertOffsetToTimes(offset, duration) {
    return offset.map((o) => o * duration);
  }

  // ../../../node_modules/framer-motion/dist/es/animation/generators/keyframes.mjs
  function defaultEasing(values, easing) {
    return values.map(() => easing || easeInOut).splice(0, values.length - 1);
  }
  function keyframes({ duration = 300, keyframes: keyframeValues, times, ease: ease2 = "easeInOut" }) {
    const easingFunctions = isEasingArray(ease2) ? ease2.map(easingDefinitionToFunction) : easingDefinitionToFunction(ease2);
    const state = {
      done: false,
      value: keyframeValues[0]
    };
    const absoluteTimes = convertOffsetToTimes(
      // Only use the provided offsets if they're the correct length
      // TODO Maybe we should warn here if there's a length mismatch
      times && times.length === keyframeValues.length ? times : defaultOffset(keyframeValues),
      duration
    );
    const mapTimeToKeyframe = interpolate(absoluteTimes, keyframeValues, {
      ease: Array.isArray(easingFunctions) ? easingFunctions : defaultEasing(keyframeValues, easingFunctions)
    });
    return {
      calculatedDuration: duration,
      next: (t) => {
        state.value = mapTimeToKeyframe(t);
        state.done = t >= duration;
        return state;
      }
    };
  }

  // ../../../node_modules/framer-motion/dist/es/animation/animators/drivers/driver-frameloop.mjs
  var frameloopDriver = (update) => {
    const passTimestamp = ({ timestamp }) => update(timestamp);
    return {
      start: () => frame.update(passTimestamp, true),
      stop: () => cancelFrame(passTimestamp),
      /**
       * If we're processing this frame we can use the
       * framelocked timestamp to keep things in sync.
       */
      now: () => frameData.isProcessing ? frameData.timestamp : time.now()
    };
  };

  // ../../../node_modules/framer-motion/dist/es/animation/animators/MainThreadAnimation.mjs
  var generators = {
    decay: inertia,
    inertia,
    tween: keyframes,
    keyframes,
    spring
  };
  var percentToProgress = (percent2) => percent2 / 100;
  var MainThreadAnimation = class extends BaseAnimation {
    constructor(options) {
      super(options);
      this.holdTime = null;
      this.cancelTime = null;
      this.currentTime = 0;
      this.playbackSpeed = 1;
      this.pendingPlayState = "running";
      this.startTime = null;
      this.state = "idle";
      this.stop = () => {
        this.resolver.cancel();
        this.isStopped = true;
        if (this.state === "idle")
          return;
        this.teardown();
        const { onStop } = this.options;
        onStop && onStop();
      };
      const { name, motionValue: motionValue2, element, keyframes: keyframes2 } = this.options;
      const KeyframeResolver$1 = (element === null || element === void 0 ? void 0 : element.KeyframeResolver) || KeyframeResolver;
      const onResolved = (resolvedKeyframes, finalKeyframe) => this.onKeyframesResolved(resolvedKeyframes, finalKeyframe);
      this.resolver = new KeyframeResolver$1(keyframes2, onResolved, name, motionValue2, element);
      this.resolver.scheduleResolve();
    }
    flatten() {
      super.flatten();
      if (this._resolved) {
        Object.assign(this._resolved, this.initPlayback(this._resolved.keyframes));
      }
    }
    initPlayback(keyframes$1) {
      const { type = "keyframes", repeat = 0, repeatDelay = 0, repeatType, velocity = 0 } = this.options;
      const generatorFactory = isGenerator(type) ? type : generators[type] || keyframes;
      let mapPercentToKeyframes;
      let mirroredGenerator;
      if (generatorFactory !== keyframes && typeof keyframes$1[0] !== "number") {
        if (true) {
          invariant(keyframes$1.length === 2, `Only two keyframes currently supported with spring and inertia animations. Trying to animate ${keyframes$1}`);
        }
        mapPercentToKeyframes = pipe(percentToProgress, mix(keyframes$1[0], keyframes$1[1]));
        keyframes$1 = [0, 100];
      }
      const generator = generatorFactory({ ...this.options, keyframes: keyframes$1 });
      if (repeatType === "mirror") {
        mirroredGenerator = generatorFactory({
          ...this.options,
          keyframes: [...keyframes$1].reverse(),
          velocity: -velocity
        });
      }
      if (generator.calculatedDuration === null) {
        generator.calculatedDuration = calcGeneratorDuration(generator);
      }
      const { calculatedDuration } = generator;
      const resolvedDuration = calculatedDuration + repeatDelay;
      const totalDuration = resolvedDuration * (repeat + 1) - repeatDelay;
      return {
        generator,
        mirroredGenerator,
        mapPercentToKeyframes,
        calculatedDuration,
        resolvedDuration,
        totalDuration
      };
    }
    onPostResolved() {
      const { autoplay = true } = this.options;
      this.play();
      if (this.pendingPlayState === "paused" || !autoplay) {
        this.pause();
      } else {
        this.state = this.pendingPlayState;
      }
    }
    tick(timestamp, sample = false) {
      const { resolved } = this;
      if (!resolved) {
        const { keyframes: keyframes3 } = this.options;
        return { done: true, value: keyframes3[keyframes3.length - 1] };
      }
      const { finalKeyframe, generator, mirroredGenerator, mapPercentToKeyframes, keyframes: keyframes2, calculatedDuration, totalDuration, resolvedDuration } = resolved;
      if (this.startTime === null)
        return generator.next(0);
      const { delay: delay2, repeat, repeatType, repeatDelay, onUpdate } = this.options;
      if (this.speed > 0) {
        this.startTime = Math.min(this.startTime, timestamp);
      } else if (this.speed < 0) {
        this.startTime = Math.min(timestamp - totalDuration / this.speed, this.startTime);
      }
      if (sample) {
        this.currentTime = timestamp;
      } else if (this.holdTime !== null) {
        this.currentTime = this.holdTime;
      } else {
        this.currentTime = Math.round(timestamp - this.startTime) * this.speed;
      }
      const timeWithoutDelay = this.currentTime - delay2 * (this.speed >= 0 ? 1 : -1);
      const isInDelayPhase = this.speed >= 0 ? timeWithoutDelay < 0 : timeWithoutDelay > totalDuration;
      this.currentTime = Math.max(timeWithoutDelay, 0);
      if (this.state === "finished" && this.holdTime === null) {
        this.currentTime = totalDuration;
      }
      let elapsed = this.currentTime;
      let frameGenerator = generator;
      if (repeat) {
        const progress2 = Math.min(this.currentTime, totalDuration) / resolvedDuration;
        let currentIteration = Math.floor(progress2);
        let iterationProgress = progress2 % 1;
        if (!iterationProgress && progress2 >= 1) {
          iterationProgress = 1;
        }
        iterationProgress === 1 && currentIteration--;
        currentIteration = Math.min(currentIteration, repeat + 1);
        const isOddIteration = Boolean(currentIteration % 2);
        if (isOddIteration) {
          if (repeatType === "reverse") {
            iterationProgress = 1 - iterationProgress;
            if (repeatDelay) {
              iterationProgress -= repeatDelay / resolvedDuration;
            }
          } else if (repeatType === "mirror") {
            frameGenerator = mirroredGenerator;
          }
        }
        elapsed = clamp(0, 1, iterationProgress) * resolvedDuration;
      }
      const state = isInDelayPhase ? { done: false, value: keyframes2[0] } : frameGenerator.next(elapsed);
      if (mapPercentToKeyframes) {
        state.value = mapPercentToKeyframes(state.value);
      }
      let { done } = state;
      if (!isInDelayPhase && calculatedDuration !== null) {
        done = this.speed >= 0 ? this.currentTime >= totalDuration : this.currentTime <= 0;
      }
      const isAnimationFinished = this.holdTime === null && (this.state === "finished" || this.state === "running" && done);
      if (isAnimationFinished && finalKeyframe !== void 0) {
        state.value = getFinalKeyframe(keyframes2, this.options, finalKeyframe);
      }
      if (onUpdate) {
        onUpdate(state.value);
      }
      if (isAnimationFinished) {
        this.finish();
      }
      return state;
    }
    get duration() {
      const { resolved } = this;
      return resolved ? millisecondsToSeconds(resolved.calculatedDuration) : 0;
    }
    get time() {
      return millisecondsToSeconds(this.currentTime);
    }
    set time(newTime) {
      newTime = secondsToMilliseconds(newTime);
      this.currentTime = newTime;
      if (this.holdTime !== null || this.speed === 0) {
        this.holdTime = newTime;
      } else if (this.driver) {
        this.startTime = this.driver.now() - newTime / this.speed;
      }
    }
    get speed() {
      return this.playbackSpeed;
    }
    set speed(newSpeed) {
      const hasChanged = this.playbackSpeed !== newSpeed;
      this.playbackSpeed = newSpeed;
      if (hasChanged) {
        this.time = millisecondsToSeconds(this.currentTime);
      }
    }
    play() {
      if (!this.resolver.isScheduled) {
        this.resolver.resume();
      }
      if (!this._resolved) {
        this.pendingPlayState = "running";
        return;
      }
      if (this.isStopped)
        return;
      const { driver = frameloopDriver, onPlay, startTime } = this.options;
      if (!this.driver) {
        this.driver = driver((timestamp) => this.tick(timestamp));
      }
      onPlay && onPlay();
      const now2 = this.driver.now();
      if (this.holdTime !== null) {
        this.startTime = now2 - this.holdTime;
      } else if (!this.startTime) {
        this.startTime = startTime !== null && startTime !== void 0 ? startTime : this.calcStartTime();
      } else if (this.state === "finished") {
        this.startTime = now2;
      }
      if (this.state === "finished") {
        this.updateFinishedPromise();
      }
      this.cancelTime = this.startTime;
      this.holdTime = null;
      this.state = "running";
      this.driver.start();
    }
    pause() {
      var _a;
      if (!this._resolved) {
        this.pendingPlayState = "paused";
        return;
      }
      this.state = "paused";
      this.holdTime = (_a = this.currentTime) !== null && _a !== void 0 ? _a : 0;
    }
    complete() {
      if (this.state !== "running") {
        this.play();
      }
      this.pendingPlayState = this.state = "finished";
      this.holdTime = null;
    }
    finish() {
      this.teardown();
      this.state = "finished";
      const { onComplete } = this.options;
      onComplete && onComplete();
    }
    cancel() {
      if (this.cancelTime !== null) {
        this.tick(this.cancelTime);
      }
      this.teardown();
      this.updateFinishedPromise();
    }
    teardown() {
      this.state = "idle";
      this.stopDriver();
      this.resolveFinishedPromise();
      this.updateFinishedPromise();
      this.startTime = this.cancelTime = null;
      this.resolver.cancel();
    }
    stopDriver() {
      if (!this.driver)
        return;
      this.driver.stop();
      this.driver = void 0;
    }
    sample(time2) {
      this.startTime = 0;
      return this.tick(time2, true);
    }
  };

  // ../../../node_modules/framer-motion/dist/es/animation/animators/utils/accelerated-values.mjs
  var acceleratedValues = /* @__PURE__ */ new Set([
    "opacity",
    "clipPath",
    "filter",
    "transform"
    // TODO: Can be accelerated but currently disabled until https://issues.chromium.org/issues/41491098 is resolved
    // or until we implement support for linear() easing.
    // "background-color"
  ]);

  // ../../../node_modules/framer-motion/dist/es/animation/animators/waapi/index.mjs
  function startWaapiAnimation(element, valueName, keyframes2, { delay: delay2 = 0, duration = 300, repeat = 0, repeatType = "loop", ease: ease2 = "easeInOut", times } = {}) {
    const keyframeOptions = { [valueName]: keyframes2 };
    if (times)
      keyframeOptions.offset = times;
    const easing = mapEasingToNativeEasing(ease2, duration);
    if (Array.isArray(easing))
      keyframeOptions.easing = easing;
    return element.animate(keyframeOptions, {
      delay: delay2,
      duration,
      easing: !Array.isArray(easing) ? easing : "linear",
      fill: "both",
      iterations: repeat + 1,
      direction: repeatType === "reverse" ? "alternate" : "normal"
    });
  }

  // ../../../node_modules/framer-motion/dist/es/animation/animators/waapi/utils/supports-waapi.mjs
  var supportsWaapi = /* @__PURE__ */ memo2(() => Object.hasOwnProperty.call(Element.prototype, "animate"));

  // ../../../node_modules/framer-motion/dist/es/animation/animators/AcceleratedAnimation.mjs
  var sampleDelta = 10;
  var maxDuration = 2e4;
  function requiresPregeneratedKeyframes(options) {
    return isGenerator(options.type) || options.type === "spring" || !isWaapiSupportedEasing(options.ease);
  }
  function pregenerateKeyframes(keyframes2, options) {
    const sampleAnimation = new MainThreadAnimation({
      ...options,
      keyframes: keyframes2,
      repeat: 0,
      delay: 0,
      isGenerator: true
    });
    let state = { done: false, value: keyframes2[0] };
    const pregeneratedKeyframes = [];
    let t = 0;
    while (!state.done && t < maxDuration) {
      state = sampleAnimation.sample(t);
      pregeneratedKeyframes.push(state.value);
      t += sampleDelta;
    }
    return {
      times: void 0,
      keyframes: pregeneratedKeyframes,
      duration: t - sampleDelta,
      ease: "linear"
    };
  }
  var unsupportedEasingFunctions = {
    anticipate,
    backInOut,
    circInOut
  };
  function isUnsupportedEase(key) {
    return key in unsupportedEasingFunctions;
  }
  var AcceleratedAnimation = class extends BaseAnimation {
    constructor(options) {
      super(options);
      const { name, motionValue: motionValue2, element, keyframes: keyframes2 } = this.options;
      this.resolver = new DOMKeyframesResolver(keyframes2, (resolvedKeyframes, finalKeyframe) => this.onKeyframesResolved(resolvedKeyframes, finalKeyframe), name, motionValue2, element);
      this.resolver.scheduleResolve();
    }
    initPlayback(keyframes2, finalKeyframe) {
      let { duration = 300, times, ease: ease2, type, motionValue: motionValue2, name, startTime } = this.options;
      if (!motionValue2.owner || !motionValue2.owner.current) {
        return false;
      }
      if (typeof ease2 === "string" && supportsLinearEasing() && isUnsupportedEase(ease2)) {
        ease2 = unsupportedEasingFunctions[ease2];
      }
      if (requiresPregeneratedKeyframes(this.options)) {
        const { onComplete, onUpdate, motionValue: motionValue3, element, ...options } = this.options;
        const pregeneratedAnimation = pregenerateKeyframes(keyframes2, options);
        keyframes2 = pregeneratedAnimation.keyframes;
        if (keyframes2.length === 1) {
          keyframes2[1] = keyframes2[0];
        }
        duration = pregeneratedAnimation.duration;
        times = pregeneratedAnimation.times;
        ease2 = pregeneratedAnimation.ease;
        type = "keyframes";
      }
      const animation3 = startWaapiAnimation(motionValue2.owner.current, name, keyframes2, { ...this.options, duration, times, ease: ease2 });
      animation3.startTime = startTime !== null && startTime !== void 0 ? startTime : this.calcStartTime();
      if (this.pendingTimeline) {
        attachTimeline(animation3, this.pendingTimeline);
        this.pendingTimeline = void 0;
      } else {
        animation3.onfinish = () => {
          const { onComplete } = this.options;
          motionValue2.set(getFinalKeyframe(keyframes2, this.options, finalKeyframe));
          onComplete && onComplete();
          this.cancel();
          this.resolveFinishedPromise();
        };
      }
      return {
        animation: animation3,
        duration,
        times,
        type,
        ease: ease2,
        keyframes: keyframes2
      };
    }
    get duration() {
      const { resolved } = this;
      if (!resolved)
        return 0;
      const { duration } = resolved;
      return millisecondsToSeconds(duration);
    }
    get time() {
      const { resolved } = this;
      if (!resolved)
        return 0;
      const { animation: animation3 } = resolved;
      return millisecondsToSeconds(animation3.currentTime || 0);
    }
    set time(newTime) {
      const { resolved } = this;
      if (!resolved)
        return;
      const { animation: animation3 } = resolved;
      animation3.currentTime = secondsToMilliseconds(newTime);
    }
    get speed() {
      const { resolved } = this;
      if (!resolved)
        return 1;
      const { animation: animation3 } = resolved;
      return animation3.playbackRate;
    }
    set speed(newSpeed) {
      const { resolved } = this;
      if (!resolved)
        return;
      const { animation: animation3 } = resolved;
      animation3.playbackRate = newSpeed;
    }
    get state() {
      const { resolved } = this;
      if (!resolved)
        return "idle";
      const { animation: animation3 } = resolved;
      return animation3.playState;
    }
    get startTime() {
      const { resolved } = this;
      if (!resolved)
        return null;
      const { animation: animation3 } = resolved;
      return animation3.startTime;
    }
    /**
     * Replace the default DocumentTimeline with another AnimationTimeline.
     * Currently used for scroll animations.
     */
    attachTimeline(timeline) {
      if (!this._resolved) {
        this.pendingTimeline = timeline;
      } else {
        const { resolved } = this;
        if (!resolved)
          return noop;
        const { animation: animation3 } = resolved;
        attachTimeline(animation3, timeline);
      }
      return noop;
    }
    play() {
      if (this.isStopped)
        return;
      const { resolved } = this;
      if (!resolved)
        return;
      const { animation: animation3 } = resolved;
      if (animation3.playState === "finished") {
        this.updateFinishedPromise();
      }
      animation3.play();
    }
    pause() {
      const { resolved } = this;
      if (!resolved)
        return;
      const { animation: animation3 } = resolved;
      animation3.pause();
    }
    stop() {
      this.resolver.cancel();
      this.isStopped = true;
      if (this.state === "idle")
        return;
      this.resolveFinishedPromise();
      this.updateFinishedPromise();
      const { resolved } = this;
      if (!resolved)
        return;
      const { animation: animation3, keyframes: keyframes2, duration, type, ease: ease2, times } = resolved;
      if (animation3.playState === "idle" || animation3.playState === "finished") {
        return;
      }
      if (this.time) {
        const { motionValue: motionValue2, onUpdate, onComplete, element, ...options } = this.options;
        const sampleAnimation = new MainThreadAnimation({
          ...options,
          keyframes: keyframes2,
          duration,
          type,
          ease: ease2,
          times,
          isGenerator: true
        });
        const sampleTime = secondsToMilliseconds(this.time);
        motionValue2.setWithVelocity(sampleAnimation.sample(sampleTime - sampleDelta).value, sampleAnimation.sample(sampleTime).value, sampleDelta);
      }
      const { onStop } = this.options;
      onStop && onStop();
      this.cancel();
    }
    complete() {
      const { resolved } = this;
      if (!resolved)
        return;
      resolved.animation.finish();
    }
    cancel() {
      const { resolved } = this;
      if (!resolved)
        return;
      resolved.animation.cancel();
    }
    static supports(options) {
      const { motionValue: motionValue2, name, repeatDelay, repeatType, damping, type } = options;
      if (!motionValue2 || !motionValue2.owner || !(motionValue2.owner.current instanceof HTMLElement)) {
        return false;
      }
      const { onUpdate, transformTemplate } = motionValue2.owner.getProps();
      return supportsWaapi() && name && acceleratedValues.has(name) && /**
       * If we're outputting values to onUpdate then we can't use WAAPI as there's
       * no way to read the value from WAAPI every frame.
       */
      !onUpdate && !transformTemplate && !repeatDelay && repeatType !== "mirror" && damping !== 0 && type !== "inertia";
    }
  };

  // ../../../node_modules/framer-motion/dist/es/animation/utils/default-transitions.mjs
  var underDampedSpring = {
    type: "spring",
    stiffness: 500,
    damping: 25,
    restSpeed: 10
  };
  var criticallyDampedSpring = (target) => ({
    type: "spring",
    stiffness: 550,
    damping: target === 0 ? 2 * Math.sqrt(550) : 30,
    restSpeed: 10
  });
  var keyframesTransition = {
    type: "keyframes",
    duration: 0.8
  };
  var ease = {
    type: "keyframes",
    ease: [0.25, 0.1, 0.35, 1],
    duration: 0.3
  };
  var getDefaultTransition = (valueKey, { keyframes: keyframes2 }) => {
    if (keyframes2.length > 2) {
      return keyframesTransition;
    } else if (transformProps.has(valueKey)) {
      return valueKey.startsWith("scale") ? criticallyDampedSpring(keyframes2[1]) : underDampedSpring;
    }
    return ease;
  };

  // ../../../node_modules/framer-motion/dist/es/animation/utils/is-transition-defined.mjs
  function isTransitionDefined({ when, delay: _delay, delayChildren, staggerChildren, staggerDirection, repeat, repeatType, repeatDelay, from, elapsed, ...transition }) {
    return !!Object.keys(transition).length;
  }

  // ../../../node_modules/framer-motion/dist/es/animation/interfaces/motion-value.mjs
  var animateMotionValue = (name, value, target, transition = {}, element, isHandoff) => (onComplete) => {
    const valueTransition = getValueTransition(transition, name) || {};
    const delay2 = valueTransition.delay || transition.delay || 0;
    let { elapsed = 0 } = transition;
    elapsed = elapsed - secondsToMilliseconds(delay2);
    let options = {
      keyframes: Array.isArray(target) ? target : [null, target],
      ease: "easeOut",
      velocity: value.getVelocity(),
      ...valueTransition,
      delay: -elapsed,
      onUpdate: (v) => {
        value.set(v);
        valueTransition.onUpdate && valueTransition.onUpdate(v);
      },
      onComplete: () => {
        onComplete();
        valueTransition.onComplete && valueTransition.onComplete();
      },
      name,
      motionValue: value,
      element: isHandoff ? void 0 : element
    };
    if (!isTransitionDefined(valueTransition)) {
      options = {
        ...options,
        ...getDefaultTransition(name, options)
      };
    }
    if (options.duration) {
      options.duration = secondsToMilliseconds(options.duration);
    }
    if (options.repeatDelay) {
      options.repeatDelay = secondsToMilliseconds(options.repeatDelay);
    }
    if (options.from !== void 0) {
      options.keyframes[0] = options.from;
    }
    let shouldSkip = false;
    if (options.type === false || options.duration === 0 && !options.repeatDelay) {
      options.duration = 0;
      if (options.delay === 0) {
        shouldSkip = true;
      }
    }
    if (instantAnimationState.current || MotionGlobalConfig.skipAnimations) {
      shouldSkip = true;
      options.duration = 0;
      options.delay = 0;
    }
    if (shouldSkip && !isHandoff && value.get() !== void 0) {
      const finalKeyframe = getFinalKeyframe(options.keyframes, valueTransition);
      if (finalKeyframe !== void 0) {
        frame.update(() => {
          options.onUpdate(finalKeyframe);
          options.onComplete();
        });
        return new GroupPlaybackControls([]);
      }
    }
    if (!isHandoff && AcceleratedAnimation.supports(options)) {
      return new AcceleratedAnimation(options);
    } else {
      return new MainThreadAnimation(options);
    }
  };

  // ../../../node_modules/framer-motion/dist/es/animation/interfaces/visual-element-target.mjs
  function shouldBlockAnimation({ protectedKeys, needsAnimating }, key) {
    const shouldBlock = protectedKeys.hasOwnProperty(key) && needsAnimating[key] !== true;
    needsAnimating[key] = false;
    return shouldBlock;
  }
  function animateTarget(visualElement, targetAndTransition, { delay: delay2 = 0, transitionOverride, type } = {}) {
    var _a;
    let { transition = visualElement.getDefaultTransition(), transitionEnd, ...target } = targetAndTransition;
    if (transitionOverride)
      transition = transitionOverride;
    const animations2 = [];
    const animationTypeState = type && visualElement.animationState && visualElement.animationState.getState()[type];
    for (const key in target) {
      const value = visualElement.getValue(key, (_a = visualElement.latestValues[key]) !== null && _a !== void 0 ? _a : null);
      const valueTarget = target[key];
      if (valueTarget === void 0 || animationTypeState && shouldBlockAnimation(animationTypeState, key)) {
        continue;
      }
      const valueTransition = {
        delay: delay2,
        ...getValueTransition(transition || {}, key)
      };
      let isHandoff = false;
      if (window.MotionHandoffAnimation) {
        const appearId = getOptimisedAppearId(visualElement);
        if (appearId) {
          const startTime = window.MotionHandoffAnimation(appearId, key, frame);
          if (startTime !== null) {
            valueTransition.startTime = startTime;
            isHandoff = true;
          }
        }
      }
      addValueToWillChange(visualElement, key);
      value.start(animateMotionValue(key, value, valueTarget, visualElement.shouldReduceMotion && positionalKeys.has(key) ? { type: false } : valueTransition, visualElement, isHandoff));
      const animation3 = value.animation;
      if (animation3) {
        animations2.push(animation3);
      }
    }
    if (transitionEnd) {
      Promise.all(animations2).then(() => {
        frame.update(() => {
          transitionEnd && setTarget(visualElement, transitionEnd);
        });
      });
    }
    return animations2;
  }

  // ../../../node_modules/framer-motion/dist/es/animation/interfaces/visual-element-variant.mjs
  function animateVariant(visualElement, variant, options = {}) {
    var _a;
    const resolved = resolveVariant(visualElement, variant, options.type === "exit" ? (_a = visualElement.presenceContext) === null || _a === void 0 ? void 0 : _a.custom : void 0);
    let { transition = visualElement.getDefaultTransition() || {} } = resolved || {};
    if (options.transitionOverride) {
      transition = options.transitionOverride;
    }
    const getAnimation = resolved ? () => Promise.all(animateTarget(visualElement, resolved, options)) : () => Promise.resolve();
    const getChildAnimations = visualElement.variantChildren && visualElement.variantChildren.size ? (forwardDelay = 0) => {
      const { delayChildren = 0, staggerChildren, staggerDirection } = transition;
      return animateChildren(visualElement, variant, delayChildren + forwardDelay, staggerChildren, staggerDirection, options);
    } : () => Promise.resolve();
    const { when } = transition;
    if (when) {
      const [first, last] = when === "beforeChildren" ? [getAnimation, getChildAnimations] : [getChildAnimations, getAnimation];
      return first().then(() => last());
    } else {
      return Promise.all([getAnimation(), getChildAnimations(options.delay)]);
    }
  }
  function animateChildren(visualElement, variant, delayChildren = 0, staggerChildren = 0, staggerDirection = 1, options) {
    const animations2 = [];
    const maxStaggerDuration = (visualElement.variantChildren.size - 1) * staggerChildren;
    const generateStaggerDuration = staggerDirection === 1 ? (i = 0) => i * staggerChildren : (i = 0) => maxStaggerDuration - i * staggerChildren;
    Array.from(visualElement.variantChildren).sort(sortByTreeOrder).forEach((child, i) => {
      child.notify("AnimationStart", variant);
      animations2.push(animateVariant(child, variant, {
        ...options,
        delay: delayChildren + generateStaggerDuration(i)
      }).then(() => child.notify("AnimationComplete", variant)));
    });
    return Promise.all(animations2);
  }
  function sortByTreeOrder(a, b) {
    return a.sortNodePosition(b);
  }

  // ../../../node_modules/framer-motion/dist/es/animation/interfaces/visual-element.mjs
  function animateVisualElement(visualElement, definition, options = {}) {
    visualElement.notify("AnimationStart", definition);
    let animation3;
    if (Array.isArray(definition)) {
      const animations2 = definition.map((variant) => animateVariant(visualElement, variant, options));
      animation3 = Promise.all(animations2);
    } else if (typeof definition === "string") {
      animation3 = animateVariant(visualElement, definition, options);
    } else {
      const resolvedDefinition = typeof definition === "function" ? resolveVariant(visualElement, definition, options.custom) : definition;
      animation3 = Promise.all(animateTarget(visualElement, resolvedDefinition, options));
    }
    return animation3.then(() => {
      visualElement.notify("AnimationComplete", definition);
    });
  }

  // ../../../node_modules/framer-motion/dist/es/render/utils/get-variant-context.mjs
  var numVariantProps = variantProps.length;
  function getVariantContext(visualElement) {
    if (!visualElement)
      return void 0;
    if (!visualElement.isControllingVariants) {
      const context2 = visualElement.parent ? getVariantContext(visualElement.parent) || {} : {};
      if (visualElement.props.initial !== void 0) {
        context2.initial = visualElement.props.initial;
      }
      return context2;
    }
    const context = {};
    for (let i = 0; i < numVariantProps; i++) {
      const name = variantProps[i];
      const prop = visualElement.props[name];
      if (isVariantLabel(prop) || prop === false) {
        context[name] = prop;
      }
    }
    return context;
  }

  // ../../../node_modules/framer-motion/dist/es/render/utils/animation-state.mjs
  var reversePriorityOrder = [...variantPriorityOrder].reverse();
  var numAnimationTypes = variantPriorityOrder.length;
  function animateList(visualElement) {
    return (animations2) => Promise.all(animations2.map(({ animation: animation3, options }) => animateVisualElement(visualElement, animation3, options)));
  }
  function createAnimationState(visualElement) {
    let animate = animateList(visualElement);
    let state = createState();
    let isInitialRender = true;
    const buildResolvedTypeValues = (type) => (acc, definition) => {
      var _a;
      const resolved = resolveVariant(visualElement, definition, type === "exit" ? (_a = visualElement.presenceContext) === null || _a === void 0 ? void 0 : _a.custom : void 0);
      if (resolved) {
        const { transition, transitionEnd, ...target } = resolved;
        acc = { ...acc, ...target, ...transitionEnd };
      }
      return acc;
    };
    function setAnimateFunction(makeAnimator) {
      animate = makeAnimator(visualElement);
    }
    function animateChanges(changedActiveType) {
      const { props } = visualElement;
      const context = getVariantContext(visualElement.parent) || {};
      const animations2 = [];
      const removedKeys = /* @__PURE__ */ new Set();
      let encounteredKeys = {};
      let removedVariantIndex = Infinity;
      for (let i = 0; i < numAnimationTypes; i++) {
        const type = reversePriorityOrder[i];
        const typeState = state[type];
        const prop = props[type] !== void 0 ? props[type] : context[type];
        const propIsVariant = isVariantLabel(prop);
        const activeDelta = type === changedActiveType ? typeState.isActive : null;
        if (activeDelta === false)
          removedVariantIndex = i;
        let isInherited = prop === context[type] && prop !== props[type] && propIsVariant;
        if (isInherited && isInitialRender && visualElement.manuallyAnimateOnMount) {
          isInherited = false;
        }
        typeState.protectedKeys = { ...encounteredKeys };
        if (
          // If it isn't active and hasn't *just* been set as inactive
          !typeState.isActive && activeDelta === null || // If we didn't and don't have any defined prop for this animation type
          !prop && !typeState.prevProp || // Or if the prop doesn't define an animation
          isAnimationControls(prop) || typeof prop === "boolean"
        ) {
          continue;
        }
        const variantDidChange = checkVariantsDidChange(typeState.prevProp, prop);
        let shouldAnimateType = variantDidChange || // If we're making this variant active, we want to always make it active
        type === changedActiveType && typeState.isActive && !isInherited && propIsVariant || // If we removed a higher-priority variant (i is in reverse order)
        i > removedVariantIndex && propIsVariant;
        let handledRemovedValues = false;
        const definitionList = Array.isArray(prop) ? prop : [prop];
        let resolvedValues = definitionList.reduce(buildResolvedTypeValues(type), {});
        if (activeDelta === false)
          resolvedValues = {};
        const { prevResolvedValues = {} } = typeState;
        const allKeys = {
          ...prevResolvedValues,
          ...resolvedValues
        };
        const markToAnimate = (key) => {
          shouldAnimateType = true;
          if (removedKeys.has(key)) {
            handledRemovedValues = true;
            removedKeys.delete(key);
          }
          typeState.needsAnimating[key] = true;
          const motionValue2 = visualElement.getValue(key);
          if (motionValue2)
            motionValue2.liveStyle = false;
        };
        for (const key in allKeys) {
          const next = resolvedValues[key];
          const prev = prevResolvedValues[key];
          if (encounteredKeys.hasOwnProperty(key))
            continue;
          let valueHasChanged = false;
          if (isKeyframesTarget(next) && isKeyframesTarget(prev)) {
            valueHasChanged = !shallowCompare(next, prev);
          } else {
            valueHasChanged = next !== prev;
          }
          if (valueHasChanged) {
            if (next !== void 0 && next !== null) {
              markToAnimate(key);
            } else {
              removedKeys.add(key);
            }
          } else if (next !== void 0 && removedKeys.has(key)) {
            markToAnimate(key);
          } else {
            typeState.protectedKeys[key] = true;
          }
        }
        typeState.prevProp = prop;
        typeState.prevResolvedValues = resolvedValues;
        if (typeState.isActive) {
          encounteredKeys = { ...encounteredKeys, ...resolvedValues };
        }
        if (isInitialRender && visualElement.blockInitialAnimation) {
          shouldAnimateType = false;
        }
        const willAnimateViaParent = isInherited && variantDidChange;
        const needsAnimating = !willAnimateViaParent || handledRemovedValues;
        if (shouldAnimateType && needsAnimating) {
          animations2.push(...definitionList.map((animation3) => ({
            animation: animation3,
            options: { type }
          })));
        }
      }
      if (removedKeys.size) {
        const fallbackAnimation = {};
        removedKeys.forEach((key) => {
          const fallbackTarget = visualElement.getBaseTarget(key);
          const motionValue2 = visualElement.getValue(key);
          if (motionValue2)
            motionValue2.liveStyle = true;
          fallbackAnimation[key] = fallbackTarget !== null && fallbackTarget !== void 0 ? fallbackTarget : null;
        });
        animations2.push({ animation: fallbackAnimation });
      }
      let shouldAnimate = Boolean(animations2.length);
      if (isInitialRender && (props.initial === false || props.initial === props.animate) && !visualElement.manuallyAnimateOnMount) {
        shouldAnimate = false;
      }
      isInitialRender = false;
      return shouldAnimate ? animate(animations2) : Promise.resolve();
    }
    function setActive(type, isActive) {
      var _a;
      if (state[type].isActive === isActive)
        return Promise.resolve();
      (_a = visualElement.variantChildren) === null || _a === void 0 ? void 0 : _a.forEach((child) => {
        var _a2;
        return (_a2 = child.animationState) === null || _a2 === void 0 ? void 0 : _a2.setActive(type, isActive);
      });
      state[type].isActive = isActive;
      const animations2 = animateChanges(type);
      for (const key in state) {
        state[key].protectedKeys = {};
      }
      return animations2;
    }
    return {
      animateChanges,
      setActive,
      setAnimateFunction,
      getState: () => state,
      reset: () => {
        state = createState();
        isInitialRender = true;
      }
    };
  }
  function checkVariantsDidChange(prev, next) {
    if (typeof next === "string") {
      return next !== prev;
    } else if (Array.isArray(next)) {
      return !shallowCompare(next, prev);
    }
    return false;
  }
  function createTypeState(isActive = false) {
    return {
      isActive,
      protectedKeys: {},
      needsAnimating: {},
      prevResolvedValues: {}
    };
  }
  function createState() {
    return {
      animate: createTypeState(true),
      whileInView: createTypeState(),
      whileHover: createTypeState(),
      whileTap: createTypeState(),
      whileDrag: createTypeState(),
      whileFocus: createTypeState(),
      exit: createTypeState()
    };
  }

  // ../../../node_modules/framer-motion/dist/es/motion/features/Feature.mjs
  var Feature = class {
    constructor(node) {
      this.isMounted = false;
      this.node = node;
    }
    update() {
    }
  };

  // ../../../node_modules/framer-motion/dist/es/motion/features/animation/index.mjs
  var AnimationFeature = class extends Feature {
    /**
     * We dynamically generate the AnimationState manager as it contains a reference
     * to the underlying animation library. We only want to load that if we load this,
     * so people can optionally code split it out using the `m` component.
     */
    constructor(node) {
      super(node);
      node.animationState || (node.animationState = createAnimationState(node));
    }
    updateAnimationControlsSubscription() {
      const { animate } = this.node.getProps();
      if (isAnimationControls(animate)) {
        this.unmountControls = animate.subscribe(this.node);
      }
    }
    /**
     * Subscribe any provided AnimationControls to the component's VisualElement
     */
    mount() {
      this.updateAnimationControlsSubscription();
    }
    update() {
      const { animate } = this.node.getProps();
      const { animate: prevAnimate } = this.node.prevProps || {};
      if (animate !== prevAnimate) {
        this.updateAnimationControlsSubscription();
      }
    }
    unmount() {
      var _a;
      this.node.animationState.reset();
      (_a = this.unmountControls) === null || _a === void 0 ? void 0 : _a.call(this);
    }
  };

  // ../../../node_modules/framer-motion/dist/es/motion/features/animation/exit.mjs
  var id = 0;
  var ExitAnimationFeature = class extends Feature {
    constructor() {
      super(...arguments);
      this.id = id++;
    }
    update() {
      if (!this.node.presenceContext)
        return;
      const { isPresent, onExitComplete } = this.node.presenceContext;
      const { isPresent: prevIsPresent } = this.node.prevPresenceContext || {};
      if (!this.node.animationState || isPresent === prevIsPresent) {
        return;
      }
      const exitAnimation = this.node.animationState.setActive("exit", !isPresent);
      if (onExitComplete && !isPresent) {
        exitAnimation.then(() => onExitComplete(this.id));
      }
    }
    mount() {
      const { register } = this.node.presenceContext || {};
      if (register) {
        this.unmount = register(this.id);
      }
    }
    unmount() {
    }
  };

  // ../../../node_modules/framer-motion/dist/es/motion/features/animations.mjs
  var animations = {
    animation: {
      Feature: AnimationFeature
    },
    exit: {
      Feature: ExitAnimationFeature
    }
  };

  // ../../../node_modules/framer-motion/dist/es/events/add-dom-event.mjs
  function addDomEvent(target, eventName, handler, options = { passive: true }) {
    target.addEventListener(eventName, handler, options);
    return () => target.removeEventListener(eventName, handler);
  }

  // ../../../node_modules/framer-motion/dist/es/events/event-info.mjs
  function extractEventInfo(event) {
    return {
      point: {
        x: event.pageX,
        y: event.pageY
      }
    };
  }
  var addPointerInfo = (handler) => {
    return (event) => isPrimaryPointer(event) && handler(event, extractEventInfo(event));
  };

  // ../../../node_modules/framer-motion/dist/es/events/add-pointer-event.mjs
  function addPointerEvent(target, eventName, handler, options) {
    return addDomEvent(target, eventName, addPointerInfo(handler), options);
  }

  // ../../../node_modules/framer-motion/dist/es/utils/distance.mjs
  var distance = (a, b) => Math.abs(a - b);
  function distance2D(a, b) {
    const xDelta = distance(a.x, b.x);
    const yDelta = distance(a.y, b.y);
    return Math.sqrt(xDelta ** 2 + yDelta ** 2);
  }

  // ../../../node_modules/framer-motion/dist/es/gestures/pan/PanSession.mjs
  var PanSession = class {
    constructor(event, handlers, { transformPagePoint, contextWindow, dragSnapToOrigin = false } = {}) {
      this.startEvent = null;
      this.lastMoveEvent = null;
      this.lastMoveEventInfo = null;
      this.handlers = {};
      this.contextWindow = window;
      this.updatePoint = () => {
        if (!(this.lastMoveEvent && this.lastMoveEventInfo))
          return;
        const info2 = getPanInfo(this.lastMoveEventInfo, this.history);
        const isPanStarted = this.startEvent !== null;
        const isDistancePastThreshold = distance2D(info2.offset, { x: 0, y: 0 }) >= 3;
        if (!isPanStarted && !isDistancePastThreshold)
          return;
        const { point: point2 } = info2;
        const { timestamp: timestamp2 } = frameData;
        this.history.push({ ...point2, timestamp: timestamp2 });
        const { onStart, onMove } = this.handlers;
        if (!isPanStarted) {
          onStart && onStart(this.lastMoveEvent, info2);
          this.startEvent = this.lastMoveEvent;
        }
        onMove && onMove(this.lastMoveEvent, info2);
      };
      this.handlePointerMove = (event2, info2) => {
        this.lastMoveEvent = event2;
        this.lastMoveEventInfo = transformPoint(info2, this.transformPagePoint);
        frame.update(this.updatePoint, true);
      };
      this.handlePointerUp = (event2, info2) => {
        this.end();
        const { onEnd, onSessionEnd, resumeAnimation } = this.handlers;
        if (this.dragSnapToOrigin)
          resumeAnimation && resumeAnimation();
        if (!(this.lastMoveEvent && this.lastMoveEventInfo))
          return;
        const panInfo = getPanInfo(event2.type === "pointercancel" ? this.lastMoveEventInfo : transformPoint(info2, this.transformPagePoint), this.history);
        if (this.startEvent && onEnd) {
          onEnd(event2, panInfo);
        }
        onSessionEnd && onSessionEnd(event2, panInfo);
      };
      if (!isPrimaryPointer(event))
        return;
      this.dragSnapToOrigin = dragSnapToOrigin;
      this.handlers = handlers;
      this.transformPagePoint = transformPagePoint;
      this.contextWindow = contextWindow || window;
      const info = extractEventInfo(event);
      const initialInfo = transformPoint(info, this.transformPagePoint);
      const { point } = initialInfo;
      const { timestamp } = frameData;
      this.history = [{ ...point, timestamp }];
      const { onSessionStart } = handlers;
      onSessionStart && onSessionStart(event, getPanInfo(initialInfo, this.history));
      this.removeListeners = pipe(addPointerEvent(this.contextWindow, "pointermove", this.handlePointerMove), addPointerEvent(this.contextWindow, "pointerup", this.handlePointerUp), addPointerEvent(this.contextWindow, "pointercancel", this.handlePointerUp));
    }
    updateHandlers(handlers) {
      this.handlers = handlers;
    }
    end() {
      this.removeListeners && this.removeListeners();
      cancelFrame(this.updatePoint);
    }
  };
  function transformPoint(info, transformPagePoint) {
    return transformPagePoint ? { point: transformPagePoint(info.point) } : info;
  }
  function subtractPoint(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
  }
  function getPanInfo({ point }, history) {
    return {
      point,
      delta: subtractPoint(point, lastDevicePoint(history)),
      offset: subtractPoint(point, startDevicePoint(history)),
      velocity: getVelocity(history, 0.1)
    };
  }
  function startDevicePoint(history) {
    return history[0];
  }
  function lastDevicePoint(history) {
    return history[history.length - 1];
  }
  function getVelocity(history, timeDelta) {
    if (history.length < 2) {
      return { x: 0, y: 0 };
    }
    let i = history.length - 1;
    let timestampedPoint = null;
    const lastPoint = lastDevicePoint(history);
    while (i >= 0) {
      timestampedPoint = history[i];
      if (lastPoint.timestamp - timestampedPoint.timestamp > secondsToMilliseconds(timeDelta)) {
        break;
      }
      i--;
    }
    if (!timestampedPoint) {
      return { x: 0, y: 0 };
    }
    const time2 = millisecondsToSeconds(lastPoint.timestamp - timestampedPoint.timestamp);
    if (time2 === 0) {
      return { x: 0, y: 0 };
    }
    const currentVelocity = {
      x: (lastPoint.x - timestampedPoint.x) / time2,
      y: (lastPoint.y - timestampedPoint.y) / time2
    };
    if (currentVelocity.x === Infinity) {
      currentVelocity.x = 0;
    }
    if (currentVelocity.y === Infinity) {
      currentVelocity.y = 0;
    }
    return currentVelocity;
  }

  // ../../../node_modules/framer-motion/dist/es/projection/geometry/delta-calc.mjs
  var SCALE_PRECISION = 1e-4;
  var SCALE_MIN = 1 - SCALE_PRECISION;
  var SCALE_MAX = 1 + SCALE_PRECISION;
  var TRANSLATE_PRECISION = 0.01;
  var TRANSLATE_MIN = 0 - TRANSLATE_PRECISION;
  var TRANSLATE_MAX = 0 + TRANSLATE_PRECISION;
  function calcLength(axis) {
    return axis.max - axis.min;
  }
  function isNear(value, target, maxDistance) {
    return Math.abs(value - target) <= maxDistance;
  }
  function calcAxisDelta(delta, source, target, origin = 0.5) {
    delta.origin = origin;
    delta.originPoint = mixNumber(source.min, source.max, delta.origin);
    delta.scale = calcLength(target) / calcLength(source);
    delta.translate = mixNumber(target.min, target.max, delta.origin) - delta.originPoint;
    if (delta.scale >= SCALE_MIN && delta.scale <= SCALE_MAX || isNaN(delta.scale)) {
      delta.scale = 1;
    }
    if (delta.translate >= TRANSLATE_MIN && delta.translate <= TRANSLATE_MAX || isNaN(delta.translate)) {
      delta.translate = 0;
    }
  }
  function calcBoxDelta(delta, source, target, origin) {
    calcAxisDelta(delta.x, source.x, target.x, origin ? origin.originX : void 0);
    calcAxisDelta(delta.y, source.y, target.y, origin ? origin.originY : void 0);
  }
  function calcRelativeAxis(target, relative, parent) {
    target.min = parent.min + relative.min;
    target.max = target.min + calcLength(relative);
  }
  function calcRelativeBox(target, relative, parent) {
    calcRelativeAxis(target.x, relative.x, parent.x);
    calcRelativeAxis(target.y, relative.y, parent.y);
  }
  function calcRelativeAxisPosition(target, layout2, parent) {
    target.min = layout2.min - parent.min;
    target.max = target.min + calcLength(layout2);
  }
  function calcRelativePosition(target, layout2, parent) {
    calcRelativeAxisPosition(target.x, layout2.x, parent.x);
    calcRelativeAxisPosition(target.y, layout2.y, parent.y);
  }

  // ../../../node_modules/framer-motion/dist/es/gestures/drag/utils/constraints.mjs
  function applyConstraints(point, { min, max }, elastic) {
    if (min !== void 0 && point < min) {
      point = elastic ? mixNumber(min, point, elastic.min) : Math.max(point, min);
    } else if (max !== void 0 && point > max) {
      point = elastic ? mixNumber(max, point, elastic.max) : Math.min(point, max);
    }
    return point;
  }
  function calcRelativeAxisConstraints(axis, min, max) {
    return {
      min: min !== void 0 ? axis.min + min : void 0,
      max: max !== void 0 ? axis.max + max - (axis.max - axis.min) : void 0
    };
  }
  function calcRelativeConstraints(layoutBox, { top, left, bottom, right }) {
    return {
      x: calcRelativeAxisConstraints(layoutBox.x, left, right),
      y: calcRelativeAxisConstraints(layoutBox.y, top, bottom)
    };
  }
  function calcViewportAxisConstraints(layoutAxis, constraintsAxis) {
    let min = constraintsAxis.min - layoutAxis.min;
    let max = constraintsAxis.max - layoutAxis.max;
    if (constraintsAxis.max - constraintsAxis.min < layoutAxis.max - layoutAxis.min) {
      [min, max] = [max, min];
    }
    return { min, max };
  }
  function calcViewportConstraints(layoutBox, constraintsBox) {
    return {
      x: calcViewportAxisConstraints(layoutBox.x, constraintsBox.x),
      y: calcViewportAxisConstraints(layoutBox.y, constraintsBox.y)
    };
  }
  function calcOrigin2(source, target) {
    let origin = 0.5;
    const sourceLength = calcLength(source);
    const targetLength = calcLength(target);
    if (targetLength > sourceLength) {
      origin = progress(target.min, target.max - sourceLength, source.min);
    } else if (sourceLength > targetLength) {
      origin = progress(source.min, source.max - targetLength, target.min);
    }
    return clamp(0, 1, origin);
  }
  function rebaseAxisConstraints(layout2, constraints) {
    const relativeConstraints = {};
    if (constraints.min !== void 0) {
      relativeConstraints.min = constraints.min - layout2.min;
    }
    if (constraints.max !== void 0) {
      relativeConstraints.max = constraints.max - layout2.min;
    }
    return relativeConstraints;
  }
  var defaultElastic = 0.35;
  function resolveDragElastic(dragElastic = defaultElastic) {
    if (dragElastic === false) {
      dragElastic = 0;
    } else if (dragElastic === true) {
      dragElastic = defaultElastic;
    }
    return {
      x: resolveAxisElastic(dragElastic, "left", "right"),
      y: resolveAxisElastic(dragElastic, "top", "bottom")
    };
  }
  function resolveAxisElastic(dragElastic, minLabel, maxLabel) {
    return {
      min: resolvePointElastic(dragElastic, minLabel),
      max: resolvePointElastic(dragElastic, maxLabel)
    };
  }
  function resolvePointElastic(dragElastic, label) {
    return typeof dragElastic === "number" ? dragElastic : dragElastic[label] || 0;
  }

  // ../../../node_modules/framer-motion/dist/es/projection/geometry/models.mjs
  var createAxisDelta = () => ({
    translate: 0,
    scale: 1,
    origin: 0,
    originPoint: 0
  });
  var createDelta = () => ({
    x: createAxisDelta(),
    y: createAxisDelta()
  });
  var createAxis = () => ({ min: 0, max: 0 });
  var createBox = () => ({
    x: createAxis(),
    y: createAxis()
  });

  // ../../../node_modules/framer-motion/dist/es/projection/utils/each-axis.mjs
  function eachAxis(callback) {
    return [callback("x"), callback("y")];
  }

  // ../../../node_modules/framer-motion/dist/es/projection/geometry/conversion.mjs
  function convertBoundingBoxToBox({ top, left, right, bottom }) {
    return {
      x: { min: left, max: right },
      y: { min: top, max: bottom }
    };
  }
  function convertBoxToBoundingBox({ x, y }) {
    return { top: y.min, right: x.max, bottom: y.max, left: x.min };
  }
  function transformBoxPoints(point, transformPoint2) {
    if (!transformPoint2)
      return point;
    const topLeft = transformPoint2({ x: point.left, y: point.top });
    const bottomRight = transformPoint2({ x: point.right, y: point.bottom });
    return {
      top: topLeft.y,
      left: topLeft.x,
      bottom: bottomRight.y,
      right: bottomRight.x
    };
  }

  // ../../../node_modules/framer-motion/dist/es/projection/utils/has-transform.mjs
  function isIdentityScale(scale2) {
    return scale2 === void 0 || scale2 === 1;
  }
  function hasScale({ scale: scale2, scaleX, scaleY }) {
    return !isIdentityScale(scale2) || !isIdentityScale(scaleX) || !isIdentityScale(scaleY);
  }
  function hasTransform(values) {
    return hasScale(values) || has2DTranslate(values) || values.z || values.rotate || values.rotateX || values.rotateY || values.skewX || values.skewY;
  }
  function has2DTranslate(values) {
    return is2DTranslate(values.x) || is2DTranslate(values.y);
  }
  function is2DTranslate(value) {
    return value && value !== "0%";
  }

  // ../../../node_modules/framer-motion/dist/es/projection/geometry/delta-apply.mjs
  function scalePoint(point, scale2, originPoint) {
    const distanceFromOrigin = point - originPoint;
    const scaled = scale2 * distanceFromOrigin;
    return originPoint + scaled;
  }
  function applyPointDelta(point, translate, scale2, originPoint, boxScale) {
    if (boxScale !== void 0) {
      point = scalePoint(point, boxScale, originPoint);
    }
    return scalePoint(point, scale2, originPoint) + translate;
  }
  function applyAxisDelta(axis, translate = 0, scale2 = 1, originPoint, boxScale) {
    axis.min = applyPointDelta(axis.min, translate, scale2, originPoint, boxScale);
    axis.max = applyPointDelta(axis.max, translate, scale2, originPoint, boxScale);
  }
  function applyBoxDelta(box, { x, y }) {
    applyAxisDelta(box.x, x.translate, x.scale, x.originPoint);
    applyAxisDelta(box.y, y.translate, y.scale, y.originPoint);
  }
  var TREE_SCALE_SNAP_MIN = 0.999999999999;
  var TREE_SCALE_SNAP_MAX = 1.0000000000001;
  function applyTreeDeltas(box, treeScale, treePath, isSharedTransition = false) {
    const treeLength = treePath.length;
    if (!treeLength)
      return;
    treeScale.x = treeScale.y = 1;
    let node;
    let delta;
    for (let i = 0; i < treeLength; i++) {
      node = treePath[i];
      delta = node.projectionDelta;
      const { visualElement } = node.options;
      if (visualElement && visualElement.props.style && visualElement.props.style.display === "contents") {
        continue;
      }
      if (isSharedTransition && node.options.layoutScroll && node.scroll && node !== node.root) {
        transformBox(box, {
          x: -node.scroll.offset.x,
          y: -node.scroll.offset.y
        });
      }
      if (delta) {
        treeScale.x *= delta.x.scale;
        treeScale.y *= delta.y.scale;
        applyBoxDelta(box, delta);
      }
      if (isSharedTransition && hasTransform(node.latestValues)) {
        transformBox(box, node.latestValues);
      }
    }
    if (treeScale.x < TREE_SCALE_SNAP_MAX && treeScale.x > TREE_SCALE_SNAP_MIN) {
      treeScale.x = 1;
    }
    if (treeScale.y < TREE_SCALE_SNAP_MAX && treeScale.y > TREE_SCALE_SNAP_MIN) {
      treeScale.y = 1;
    }
  }
  function translateAxis(axis, distance2) {
    axis.min = axis.min + distance2;
    axis.max = axis.max + distance2;
  }
  function transformAxis(axis, axisTranslate, axisScale, boxScale, axisOrigin = 0.5) {
    const originPoint = mixNumber(axis.min, axis.max, axisOrigin);
    applyAxisDelta(axis, axisTranslate, axisScale, originPoint, boxScale);
  }
  function transformBox(box, transform) {
    transformAxis(box.x, transform.x, transform.scaleX, transform.scale, transform.originX);
    transformAxis(box.y, transform.y, transform.scaleY, transform.scale, transform.originY);
  }

  // ../../../node_modules/framer-motion/dist/es/projection/utils/measure.mjs
  function measureViewportBox(instance, transformPoint2) {
    return convertBoundingBoxToBox(transformBoxPoints(instance.getBoundingClientRect(), transformPoint2));
  }
  function measurePageBox(element, rootProjectionNode2, transformPagePoint) {
    const viewportBox = measureViewportBox(element, transformPagePoint);
    const { scroll } = rootProjectionNode2;
    if (scroll) {
      translateAxis(viewportBox.x, scroll.offset.x);
      translateAxis(viewportBox.y, scroll.offset.y);
    }
    return viewportBox;
  }

  // ../../../node_modules/framer-motion/dist/es/utils/get-context-window.mjs
  var getContextWindow = ({ current }) => {
    return current ? current.ownerDocument.defaultView : null;
  };

  // ../../../node_modules/framer-motion/dist/es/gestures/drag/VisualElementDragControls.mjs
  var elementDragControls = /* @__PURE__ */ new WeakMap();
  var VisualElementDragControls = class {
    constructor(visualElement) {
      this.openDragLock = null;
      this.isDragging = false;
      this.currentDirection = null;
      this.originPoint = { x: 0, y: 0 };
      this.constraints = false;
      this.hasMutatedConstraints = false;
      this.elastic = createBox();
      this.visualElement = visualElement;
    }
    start(originEvent, { snapToCursor = false } = {}) {
      const { presenceContext } = this.visualElement;
      if (presenceContext && presenceContext.isPresent === false)
        return;
      const onSessionStart = (event) => {
        const { dragSnapToOrigin: dragSnapToOrigin2 } = this.getProps();
        dragSnapToOrigin2 ? this.pauseAnimation() : this.stopAnimation();
        if (snapToCursor) {
          this.snapToCursor(extractEventInfo(event).point);
        }
      };
      const onStart = (event, info) => {
        const { drag: drag2, dragPropagation, onDragStart } = this.getProps();
        if (drag2 && !dragPropagation) {
          if (this.openDragLock)
            this.openDragLock();
          this.openDragLock = setDragLock(drag2);
          if (!this.openDragLock)
            return;
        }
        this.isDragging = true;
        this.currentDirection = null;
        this.resolveConstraints();
        if (this.visualElement.projection) {
          this.visualElement.projection.isAnimationBlocked = true;
          this.visualElement.projection.target = void 0;
        }
        eachAxis((axis) => {
          let current = this.getAxisMotionValue(axis).get() || 0;
          if (percent.test(current)) {
            const { projection } = this.visualElement;
            if (projection && projection.layout) {
              const measuredAxis = projection.layout.layoutBox[axis];
              if (measuredAxis) {
                const length = calcLength(measuredAxis);
                current = length * (parseFloat(current) / 100);
              }
            }
          }
          this.originPoint[axis] = current;
        });
        if (onDragStart) {
          frame.postRender(() => onDragStart(event, info));
        }
        addValueToWillChange(this.visualElement, "transform");
        const { animationState } = this.visualElement;
        animationState && animationState.setActive("whileDrag", true);
      };
      const onMove = (event, info) => {
        const { dragPropagation, dragDirectionLock, onDirectionLock, onDrag } = this.getProps();
        if (!dragPropagation && !this.openDragLock)
          return;
        const { offset } = info;
        if (dragDirectionLock && this.currentDirection === null) {
          this.currentDirection = getCurrentDirection(offset);
          if (this.currentDirection !== null) {
            onDirectionLock && onDirectionLock(this.currentDirection);
          }
          return;
        }
        this.updateAxis("x", info.point, offset);
        this.updateAxis("y", info.point, offset);
        this.visualElement.render();
        onDrag && onDrag(event, info);
      };
      const onSessionEnd = (event, info) => this.stop(event, info);
      const resumeAnimation = () => eachAxis((axis) => {
        var _a;
        return this.getAnimationState(axis) === "paused" && ((_a = this.getAxisMotionValue(axis).animation) === null || _a === void 0 ? void 0 : _a.play());
      });
      const { dragSnapToOrigin } = this.getProps();
      this.panSession = new PanSession(originEvent, {
        onSessionStart,
        onStart,
        onMove,
        onSessionEnd,
        resumeAnimation
      }, {
        transformPagePoint: this.visualElement.getTransformPagePoint(),
        dragSnapToOrigin,
        contextWindow: getContextWindow(this.visualElement)
      });
    }
    stop(event, info) {
      const isDragging2 = this.isDragging;
      this.cancel();
      if (!isDragging2)
        return;
      const { velocity } = info;
      this.startAnimation(velocity);
      const { onDragEnd } = this.getProps();
      if (onDragEnd) {
        frame.postRender(() => onDragEnd(event, info));
      }
    }
    cancel() {
      this.isDragging = false;
      const { projection, animationState } = this.visualElement;
      if (projection) {
        projection.isAnimationBlocked = false;
      }
      this.panSession && this.panSession.end();
      this.panSession = void 0;
      const { dragPropagation } = this.getProps();
      if (!dragPropagation && this.openDragLock) {
        this.openDragLock();
        this.openDragLock = null;
      }
      animationState && animationState.setActive("whileDrag", false);
    }
    updateAxis(axis, _point, offset) {
      const { drag: drag2 } = this.getProps();
      if (!offset || !shouldDrag(axis, drag2, this.currentDirection))
        return;
      const axisValue = this.getAxisMotionValue(axis);
      let next = this.originPoint[axis] + offset[axis];
      if (this.constraints && this.constraints[axis]) {
        next = applyConstraints(next, this.constraints[axis], this.elastic[axis]);
      }
      axisValue.set(next);
    }
    resolveConstraints() {
      var _a;
      const { dragConstraints, dragElastic } = this.getProps();
      const layout2 = this.visualElement.projection && !this.visualElement.projection.layout ? this.visualElement.projection.measure(false) : (_a = this.visualElement.projection) === null || _a === void 0 ? void 0 : _a.layout;
      const prevConstraints = this.constraints;
      if (dragConstraints && isRefObject(dragConstraints)) {
        if (!this.constraints) {
          this.constraints = this.resolveRefConstraints();
        }
      } else {
        if (dragConstraints && layout2) {
          this.constraints = calcRelativeConstraints(layout2.layoutBox, dragConstraints);
        } else {
          this.constraints = false;
        }
      }
      this.elastic = resolveDragElastic(dragElastic);
      if (prevConstraints !== this.constraints && layout2 && this.constraints && !this.hasMutatedConstraints) {
        eachAxis((axis) => {
          if (this.constraints !== false && this.getAxisMotionValue(axis)) {
            this.constraints[axis] = rebaseAxisConstraints(layout2.layoutBox[axis], this.constraints[axis]);
          }
        });
      }
    }
    resolveRefConstraints() {
      const { dragConstraints: constraints, onMeasureDragConstraints } = this.getProps();
      if (!constraints || !isRefObject(constraints))
        return false;
      const constraintsElement = constraints.current;
      invariant(constraintsElement !== null, "If `dragConstraints` is set as a React ref, that ref must be passed to another component's `ref` prop.");
      const { projection } = this.visualElement;
      if (!projection || !projection.layout)
        return false;
      const constraintsBox = measurePageBox(constraintsElement, projection.root, this.visualElement.getTransformPagePoint());
      let measuredConstraints = calcViewportConstraints(projection.layout.layoutBox, constraintsBox);
      if (onMeasureDragConstraints) {
        const userConstraints = onMeasureDragConstraints(convertBoxToBoundingBox(measuredConstraints));
        this.hasMutatedConstraints = !!userConstraints;
        if (userConstraints) {
          measuredConstraints = convertBoundingBoxToBox(userConstraints);
        }
      }
      return measuredConstraints;
    }
    startAnimation(velocity) {
      const { drag: drag2, dragMomentum, dragElastic, dragTransition, dragSnapToOrigin, onDragTransitionEnd } = this.getProps();
      const constraints = this.constraints || {};
      const momentumAnimations = eachAxis((axis) => {
        if (!shouldDrag(axis, drag2, this.currentDirection)) {
          return;
        }
        let transition = constraints && constraints[axis] || {};
        if (dragSnapToOrigin)
          transition = { min: 0, max: 0 };
        const bounceStiffness = dragElastic ? 200 : 1e6;
        const bounceDamping = dragElastic ? 40 : 1e7;
        const inertia2 = {
          type: "inertia",
          velocity: dragMomentum ? velocity[axis] : 0,
          bounceStiffness,
          bounceDamping,
          timeConstant: 750,
          restDelta: 1,
          restSpeed: 10,
          ...dragTransition,
          ...transition
        };
        return this.startAxisValueAnimation(axis, inertia2);
      });
      return Promise.all(momentumAnimations).then(onDragTransitionEnd);
    }
    startAxisValueAnimation(axis, transition) {
      const axisValue = this.getAxisMotionValue(axis);
      addValueToWillChange(this.visualElement, axis);
      return axisValue.start(animateMotionValue(axis, axisValue, 0, transition, this.visualElement, false));
    }
    stopAnimation() {
      eachAxis((axis) => this.getAxisMotionValue(axis).stop());
    }
    pauseAnimation() {
      eachAxis((axis) => {
        var _a;
        return (_a = this.getAxisMotionValue(axis).animation) === null || _a === void 0 ? void 0 : _a.pause();
      });
    }
    getAnimationState(axis) {
      var _a;
      return (_a = this.getAxisMotionValue(axis).animation) === null || _a === void 0 ? void 0 : _a.state;
    }
    /**
     * Drag works differently depending on which props are provided.
     *
     * - If _dragX and _dragY are provided, we output the gesture delta directly to those motion values.
     * - Otherwise, we apply the delta to the x/y motion values.
     */
    getAxisMotionValue(axis) {
      const dragKey = `_drag${axis.toUpperCase()}`;
      const props = this.visualElement.getProps();
      const externalMotionValue = props[dragKey];
      return externalMotionValue ? externalMotionValue : this.visualElement.getValue(axis, (props.initial ? props.initial[axis] : void 0) || 0);
    }
    snapToCursor(point) {
      eachAxis((axis) => {
        const { drag: drag2 } = this.getProps();
        if (!shouldDrag(axis, drag2, this.currentDirection))
          return;
        const { projection } = this.visualElement;
        const axisValue = this.getAxisMotionValue(axis);
        if (projection && projection.layout) {
          const { min, max } = projection.layout.layoutBox[axis];
          axisValue.set(point[axis] - mixNumber(min, max, 0.5));
        }
      });
    }
    /**
     * When the viewport resizes we want to check if the measured constraints
     * have changed and, if so, reposition the element within those new constraints
     * relative to where it was before the resize.
     */
    scalePositionWithinConstraints() {
      if (!this.visualElement.current)
        return;
      const { drag: drag2, dragConstraints } = this.getProps();
      const { projection } = this.visualElement;
      if (!isRefObject(dragConstraints) || !projection || !this.constraints)
        return;
      this.stopAnimation();
      const boxProgress = { x: 0, y: 0 };
      eachAxis((axis) => {
        const axisValue = this.getAxisMotionValue(axis);
        if (axisValue && this.constraints !== false) {
          const latest = axisValue.get();
          boxProgress[axis] = calcOrigin2({ min: latest, max: latest }, this.constraints[axis]);
        }
      });
      const { transformTemplate } = this.visualElement.getProps();
      this.visualElement.current.style.transform = transformTemplate ? transformTemplate({}, "") : "none";
      projection.root && projection.root.updateScroll();
      projection.updateLayout();
      this.resolveConstraints();
      eachAxis((axis) => {
        if (!shouldDrag(axis, drag2, null))
          return;
        const axisValue = this.getAxisMotionValue(axis);
        const { min, max } = this.constraints[axis];
        axisValue.set(mixNumber(min, max, boxProgress[axis]));
      });
    }
    addListeners() {
      if (!this.visualElement.current)
        return;
      elementDragControls.set(this.visualElement, this);
      const element = this.visualElement.current;
      const stopPointerListener = addPointerEvent(element, "pointerdown", (event) => {
        const { drag: drag2, dragListener = true } = this.getProps();
        drag2 && dragListener && this.start(event);
      });
      const measureDragConstraints = () => {
        const { dragConstraints } = this.getProps();
        if (isRefObject(dragConstraints) && dragConstraints.current) {
          this.constraints = this.resolveRefConstraints();
        }
      };
      const { projection } = this.visualElement;
      const stopMeasureLayoutListener = projection.addEventListener("measure", measureDragConstraints);
      if (projection && !projection.layout) {
        projection.root && projection.root.updateScroll();
        projection.updateLayout();
      }
      frame.read(measureDragConstraints);
      const stopResizeListener = addDomEvent(window, "resize", () => this.scalePositionWithinConstraints());
      const stopLayoutUpdateListener = projection.addEventListener("didUpdate", (({ delta, hasLayoutChanged }) => {
        if (this.isDragging && hasLayoutChanged) {
          eachAxis((axis) => {
            const motionValue2 = this.getAxisMotionValue(axis);
            if (!motionValue2)
              return;
            this.originPoint[axis] += delta[axis].translate;
            motionValue2.set(motionValue2.get() + delta[axis].translate);
          });
          this.visualElement.render();
        }
      }));
      return () => {
        stopResizeListener();
        stopPointerListener();
        stopMeasureLayoutListener();
        stopLayoutUpdateListener && stopLayoutUpdateListener();
      };
    }
    getProps() {
      const props = this.visualElement.getProps();
      const { drag: drag2 = false, dragDirectionLock = false, dragPropagation = false, dragConstraints = false, dragElastic = defaultElastic, dragMomentum = true } = props;
      return {
        ...props,
        drag: drag2,
        dragDirectionLock,
        dragPropagation,
        dragConstraints,
        dragElastic,
        dragMomentum
      };
    }
  };
  function shouldDrag(direction, drag2, currentDirection) {
    return (drag2 === true || drag2 === direction) && (currentDirection === null || currentDirection === direction);
  }
  function getCurrentDirection(offset, lockThreshold = 10) {
    let direction = null;
    if (Math.abs(offset.y) > lockThreshold) {
      direction = "y";
    } else if (Math.abs(offset.x) > lockThreshold) {
      direction = "x";
    }
    return direction;
  }

  // ../../../node_modules/framer-motion/dist/es/gestures/drag/index.mjs
  var DragGesture = class extends Feature {
    constructor(node) {
      super(node);
      this.removeGroupControls = noop;
      this.removeListeners = noop;
      this.controls = new VisualElementDragControls(node);
    }
    mount() {
      const { dragControls } = this.node.getProps();
      if (dragControls) {
        this.removeGroupControls = dragControls.subscribe(this.controls);
      }
      this.removeListeners = this.controls.addListeners() || noop;
    }
    unmount() {
      this.removeGroupControls();
      this.removeListeners();
    }
  };

  // ../../../node_modules/framer-motion/dist/es/gestures/pan/index.mjs
  var asyncHandler = (handler) => (event, info) => {
    if (handler) {
      frame.postRender(() => handler(event, info));
    }
  };
  var PanGesture = class extends Feature {
    constructor() {
      super(...arguments);
      this.removePointerDownListener = noop;
    }
    onPointerDown(pointerDownEvent) {
      this.session = new PanSession(pointerDownEvent, this.createPanHandlers(), {
        transformPagePoint: this.node.getTransformPagePoint(),
        contextWindow: getContextWindow(this.node)
      });
    }
    createPanHandlers() {
      const { onPanSessionStart, onPanStart, onPan, onPanEnd } = this.node.getProps();
      return {
        onSessionStart: asyncHandler(onPanSessionStart),
        onStart: asyncHandler(onPanStart),
        onMove: onPan,
        onEnd: (event, info) => {
          delete this.session;
          if (onPanEnd) {
            frame.postRender(() => onPanEnd(event, info));
          }
        }
      };
    }
    mount() {
      this.removePointerDownListener = addPointerEvent(this.node.current, "pointerdown", (event) => this.onPointerDown(event));
    }
    update() {
      this.session && this.session.updateHandlers(this.createPanHandlers());
    }
    unmount() {
      this.removePointerDownListener();
      this.session && this.session.end();
    }
  };

  // ../../../node_modules/framer-motion/dist/es/projection/node/state.mjs
  var globalProjectionState = {
    /**
     * Global flag as to whether the tree has animated since the last time
     * we resized the window
     */
    hasAnimatedSinceResize: true,
    /**
     * We set this to true once, on the first update. Any nodes added to the tree beyond that
     * update will be given a `data-projection-id` attribute.
     */
    hasEverUpdated: false
  };

  // ../../../node_modules/framer-motion/dist/es/projection/styles/scale-border-radius.mjs
  function pixelsToPercent(pixels, axis) {
    if (axis.max === axis.min)
      return 0;
    return pixels / (axis.max - axis.min) * 100;
  }
  var correctBorderRadius = {
    correct: (latest, node) => {
      if (!node.target)
        return latest;
      if (typeof latest === "string") {
        if (px.test(latest)) {
          latest = parseFloat(latest);
        } else {
          return latest;
        }
      }
      const x = pixelsToPercent(latest, node.target.x);
      const y = pixelsToPercent(latest, node.target.y);
      return `${x}% ${y}%`;
    }
  };

  // ../../../node_modules/framer-motion/dist/es/projection/styles/scale-box-shadow.mjs
  var correctBoxShadow = {
    correct: (latest, { treeScale, projectionDelta }) => {
      const original = latest;
      const shadow = complex.parse(latest);
      if (shadow.length > 5)
        return original;
      const template = complex.createTransformer(latest);
      const offset = typeof shadow[0] !== "number" ? 1 : 0;
      const xScale = projectionDelta.x.scale * treeScale.x;
      const yScale = projectionDelta.y.scale * treeScale.y;
      shadow[0 + offset] /= xScale;
      shadow[1 + offset] /= yScale;
      const averageScale = mixNumber(xScale, yScale, 0.5);
      if (typeof shadow[2 + offset] === "number")
        shadow[2 + offset] /= averageScale;
      if (typeof shadow[3 + offset] === "number")
        shadow[3 + offset] /= averageScale;
      return template(shadow);
    }
  };

  // ../../../node_modules/framer-motion/dist/es/motion/features/layout/MeasureLayout.mjs
  var MeasureLayoutWithContext = class extends Component {
    /**
     * This only mounts projection nodes for components that
     * need measuring, we might want to do it for all components
     * in order to incorporate transforms
     */
    componentDidMount() {
      const { visualElement, layoutGroup, switchLayoutGroup, layoutId } = this.props;
      const { projection } = visualElement;
      addScaleCorrector(defaultScaleCorrectors);
      if (projection) {
        if (layoutGroup.group)
          layoutGroup.group.add(projection);
        if (switchLayoutGroup && switchLayoutGroup.register && layoutId) {
          switchLayoutGroup.register(projection);
        }
        projection.root.didUpdate();
        projection.addEventListener("animationComplete", () => {
          this.safeToRemove();
        });
        projection.setOptions({
          ...projection.options,
          onExitComplete: () => this.safeToRemove()
        });
      }
      globalProjectionState.hasEverUpdated = true;
    }
    getSnapshotBeforeUpdate(prevProps) {
      const { layoutDependency, visualElement, drag: drag2, isPresent } = this.props;
      const projection = visualElement.projection;
      if (!projection)
        return null;
      projection.isPresent = isPresent;
      if (drag2 || prevProps.layoutDependency !== layoutDependency || layoutDependency === void 0) {
        projection.willUpdate();
      } else {
        this.safeToRemove();
      }
      if (prevProps.isPresent !== isPresent) {
        if (isPresent) {
          projection.promote();
        } else if (!projection.relegate()) {
          frame.postRender(() => {
            const stack = projection.getStack();
            if (!stack || !stack.members.length) {
              this.safeToRemove();
            }
          });
        }
      }
      return null;
    }
    componentDidUpdate() {
      const { projection } = this.props.visualElement;
      if (projection) {
        projection.root.didUpdate();
        microtask.postRender(() => {
          if (!projection.currentAnimation && projection.isLead()) {
            this.safeToRemove();
          }
        });
      }
    }
    componentWillUnmount() {
      const { visualElement, layoutGroup, switchLayoutGroup: promoteContext } = this.props;
      const { projection } = visualElement;
      if (projection) {
        projection.scheduleCheckAfterUnmount();
        if (layoutGroup && layoutGroup.group)
          layoutGroup.group.remove(projection);
        if (promoteContext && promoteContext.deregister)
          promoteContext.deregister(projection);
      }
    }
    safeToRemove() {
      const { safeToRemove } = this.props;
      safeToRemove && safeToRemove();
    }
    render() {
      return null;
    }
  };
  function MeasureLayout(props) {
    const [isPresent, safeToRemove] = usePresence();
    const layoutGroup = useContext(LayoutGroupContext);
    return jsx(MeasureLayoutWithContext, { ...props, layoutGroup, switchLayoutGroup: useContext(SwitchLayoutGroupContext), isPresent, safeToRemove });
  }
  var defaultScaleCorrectors = {
    borderRadius: {
      ...correctBorderRadius,
      applyTo: [
        "borderTopLeftRadius",
        "borderTopRightRadius",
        "borderBottomLeftRadius",
        "borderBottomRightRadius"
      ]
    },
    borderTopLeftRadius: correctBorderRadius,
    borderTopRightRadius: correctBorderRadius,
    borderBottomLeftRadius: correctBorderRadius,
    borderBottomRightRadius: correctBorderRadius,
    boxShadow: correctBoxShadow
  };

  // ../../../node_modules/framer-motion/dist/es/animation/animate/single-value.mjs
  function animateSingleValue(value, keyframes2, options) {
    const motionValue$1 = isMotionValue(value) ? value : motionValue(value);
    motionValue$1.start(animateMotionValue("", motionValue$1, keyframes2, options));
    return motionValue$1.animation;
  }

  // ../../../node_modules/framer-motion/dist/es/render/dom/utils/is-svg-element.mjs
  function isSVGElement(element) {
    return element instanceof SVGElement && element.tagName !== "svg";
  }

  // ../../../node_modules/framer-motion/dist/es/render/utils/compare-by-depth.mjs
  var compareByDepth = (a, b) => a.depth - b.depth;

  // ../../../node_modules/framer-motion/dist/es/render/utils/flat-tree.mjs
  var FlatTree = class {
    constructor() {
      this.children = [];
      this.isDirty = false;
    }
    add(child) {
      addUniqueItem(this.children, child);
      this.isDirty = true;
    }
    remove(child) {
      removeItem(this.children, child);
      this.isDirty = true;
    }
    forEach(callback) {
      this.isDirty && this.children.sort(compareByDepth);
      this.isDirty = false;
      this.children.forEach(callback);
    }
  };

  // ../../../node_modules/framer-motion/dist/es/utils/delay.mjs
  function delay(callback, timeout) {
    const start = time.now();
    const checkElapsed = ({ timestamp }) => {
      const elapsed = timestamp - start;
      if (elapsed >= timeout) {
        cancelFrame(checkElapsed);
        callback(elapsed - timeout);
      }
    };
    frame.read(checkElapsed, true);
    return () => cancelFrame(checkElapsed);
  }

  // ../../../node_modules/framer-motion/dist/es/projection/animation/mix-values.mjs
  var borders = ["TopLeft", "TopRight", "BottomLeft", "BottomRight"];
  var numBorders = borders.length;
  var asNumber = (value) => typeof value === "string" ? parseFloat(value) : value;
  var isPx = (value) => typeof value === "number" || px.test(value);
  function mixValues(target, follow, lead, progress2, shouldCrossfadeOpacity, isOnlyMember) {
    if (shouldCrossfadeOpacity) {
      target.opacity = mixNumber(
        0,
        // TODO Reinstate this if only child
        lead.opacity !== void 0 ? lead.opacity : 1,
        easeCrossfadeIn(progress2)
      );
      target.opacityExit = mixNumber(follow.opacity !== void 0 ? follow.opacity : 1, 0, easeCrossfadeOut(progress2));
    } else if (isOnlyMember) {
      target.opacity = mixNumber(follow.opacity !== void 0 ? follow.opacity : 1, lead.opacity !== void 0 ? lead.opacity : 1, progress2);
    }
    for (let i = 0; i < numBorders; i++) {
      const borderLabel = `border${borders[i]}Radius`;
      let followRadius = getRadius(follow, borderLabel);
      let leadRadius = getRadius(lead, borderLabel);
      if (followRadius === void 0 && leadRadius === void 0)
        continue;
      followRadius || (followRadius = 0);
      leadRadius || (leadRadius = 0);
      const canMix = followRadius === 0 || leadRadius === 0 || isPx(followRadius) === isPx(leadRadius);
      if (canMix) {
        target[borderLabel] = Math.max(mixNumber(asNumber(followRadius), asNumber(leadRadius), progress2), 0);
        if (percent.test(leadRadius) || percent.test(followRadius)) {
          target[borderLabel] += "%";
        }
      } else {
        target[borderLabel] = leadRadius;
      }
    }
    if (follow.rotate || lead.rotate) {
      target.rotate = mixNumber(follow.rotate || 0, lead.rotate || 0, progress2);
    }
  }
  function getRadius(values, radiusName) {
    return values[radiusName] !== void 0 ? values[radiusName] : values.borderRadius;
  }
  var easeCrossfadeIn = /* @__PURE__ */ compress(0, 0.5, circOut);
  var easeCrossfadeOut = /* @__PURE__ */ compress(0.5, 0.95, noop);
  function compress(min, max, easing) {
    return (p) => {
      if (p < min)
        return 0;
      if (p > max)
        return 1;
      return easing(progress(min, max, p));
    };
  }

  // ../../../node_modules/framer-motion/dist/es/projection/geometry/copy.mjs
  function copyAxisInto(axis, originAxis) {
    axis.min = originAxis.min;
    axis.max = originAxis.max;
  }
  function copyBoxInto(box, originBox) {
    copyAxisInto(box.x, originBox.x);
    copyAxisInto(box.y, originBox.y);
  }
  function copyAxisDeltaInto(delta, originDelta) {
    delta.translate = originDelta.translate;
    delta.scale = originDelta.scale;
    delta.originPoint = originDelta.originPoint;
    delta.origin = originDelta.origin;
  }

  // ../../../node_modules/framer-motion/dist/es/projection/geometry/delta-remove.mjs
  function removePointDelta(point, translate, scale2, originPoint, boxScale) {
    point -= translate;
    point = scalePoint(point, 1 / scale2, originPoint);
    if (boxScale !== void 0) {
      point = scalePoint(point, 1 / boxScale, originPoint);
    }
    return point;
  }
  function removeAxisDelta(axis, translate = 0, scale2 = 1, origin = 0.5, boxScale, originAxis = axis, sourceAxis = axis) {
    if (percent.test(translate)) {
      translate = parseFloat(translate);
      const relativeProgress = mixNumber(sourceAxis.min, sourceAxis.max, translate / 100);
      translate = relativeProgress - sourceAxis.min;
    }
    if (typeof translate !== "number")
      return;
    let originPoint = mixNumber(originAxis.min, originAxis.max, origin);
    if (axis === originAxis)
      originPoint -= translate;
    axis.min = removePointDelta(axis.min, translate, scale2, originPoint, boxScale);
    axis.max = removePointDelta(axis.max, translate, scale2, originPoint, boxScale);
  }
  function removeAxisTransforms(axis, transforms, [key, scaleKey, originKey], origin, sourceAxis) {
    removeAxisDelta(axis, transforms[key], transforms[scaleKey], transforms[originKey], transforms.scale, origin, sourceAxis);
  }
  var xKeys = ["x", "scaleX", "originX"];
  var yKeys = ["y", "scaleY", "originY"];
  function removeBoxTransforms(box, transforms, originBox, sourceBox) {
    removeAxisTransforms(box.x, transforms, xKeys, originBox ? originBox.x : void 0, sourceBox ? sourceBox.x : void 0);
    removeAxisTransforms(box.y, transforms, yKeys, originBox ? originBox.y : void 0, sourceBox ? sourceBox.y : void 0);
  }

  // ../../../node_modules/framer-motion/dist/es/projection/geometry/utils.mjs
  function isAxisDeltaZero(delta) {
    return delta.translate === 0 && delta.scale === 1;
  }
  function isDeltaZero(delta) {
    return isAxisDeltaZero(delta.x) && isAxisDeltaZero(delta.y);
  }
  function axisEquals(a, b) {
    return a.min === b.min && a.max === b.max;
  }
  function boxEquals(a, b) {
    return axisEquals(a.x, b.x) && axisEquals(a.y, b.y);
  }
  function axisEqualsRounded(a, b) {
    return Math.round(a.min) === Math.round(b.min) && Math.round(a.max) === Math.round(b.max);
  }
  function boxEqualsRounded(a, b) {
    return axisEqualsRounded(a.x, b.x) && axisEqualsRounded(a.y, b.y);
  }
  function aspectRatio(box) {
    return calcLength(box.x) / calcLength(box.y);
  }
  function axisDeltaEquals(a, b) {
    return a.translate === b.translate && a.scale === b.scale && a.originPoint === b.originPoint;
  }

  // ../../../node_modules/framer-motion/dist/es/projection/shared/stack.mjs
  var NodeStack = class {
    constructor() {
      this.members = [];
    }
    add(node) {
      addUniqueItem(this.members, node);
      node.scheduleRender();
    }
    remove(node) {
      removeItem(this.members, node);
      if (node === this.prevLead) {
        this.prevLead = void 0;
      }
      if (node === this.lead) {
        const prevLead = this.members[this.members.length - 1];
        if (prevLead) {
          this.promote(prevLead);
        }
      }
    }
    relegate(node) {
      const indexOfNode = this.members.findIndex((member) => node === member);
      if (indexOfNode === 0)
        return false;
      let prevLead;
      for (let i = indexOfNode; i >= 0; i--) {
        const member = this.members[i];
        if (member.isPresent !== false) {
          prevLead = member;
          break;
        }
      }
      if (prevLead) {
        this.promote(prevLead);
        return true;
      } else {
        return false;
      }
    }
    promote(node, preserveFollowOpacity) {
      const prevLead = this.lead;
      if (node === prevLead)
        return;
      this.prevLead = prevLead;
      this.lead = node;
      node.show();
      if (prevLead) {
        prevLead.instance && prevLead.scheduleRender();
        node.scheduleRender();
        node.resumeFrom = prevLead;
        if (preserveFollowOpacity) {
          node.resumeFrom.preserveOpacity = true;
        }
        if (prevLead.snapshot) {
          node.snapshot = prevLead.snapshot;
          node.snapshot.latestValues = prevLead.animationValues || prevLead.latestValues;
        }
        if (node.root && node.root.isUpdating) {
          node.isLayoutDirty = true;
        }
        const { crossfade } = node.options;
        if (crossfade === false) {
          prevLead.hide();
        }
      }
    }
    exitAnimationComplete() {
      this.members.forEach((node) => {
        const { options, resumingFrom } = node;
        options.onExitComplete && options.onExitComplete();
        if (resumingFrom) {
          resumingFrom.options.onExitComplete && resumingFrom.options.onExitComplete();
        }
      });
    }
    scheduleRender() {
      this.members.forEach((node) => {
        node.instance && node.scheduleRender(false);
      });
    }
    /**
     * Clear any leads that have been removed this render to prevent them from being
     * used in future animations and to prevent memory leaks
     */
    removeLeadSnapshot() {
      if (this.lead && this.lead.snapshot) {
        this.lead.snapshot = void 0;
      }
    }
  };

  // ../../../node_modules/framer-motion/dist/es/projection/styles/transform.mjs
  function buildProjectionTransform(delta, treeScale, latestTransform) {
    let transform = "";
    const xTranslate = delta.x.translate / treeScale.x;
    const yTranslate = delta.y.translate / treeScale.y;
    const zTranslate = (latestTransform === null || latestTransform === void 0 ? void 0 : latestTransform.z) || 0;
    if (xTranslate || yTranslate || zTranslate) {
      transform = `translate3d(${xTranslate}px, ${yTranslate}px, ${zTranslate}px) `;
    }
    if (treeScale.x !== 1 || treeScale.y !== 1) {
      transform += `scale(${1 / treeScale.x}, ${1 / treeScale.y}) `;
    }
    if (latestTransform) {
      const { transformPerspective, rotate, rotateX, rotateY, skewX, skewY } = latestTransform;
      if (transformPerspective)
        transform = `perspective(${transformPerspective}px) ${transform}`;
      if (rotate)
        transform += `rotate(${rotate}deg) `;
      if (rotateX)
        transform += `rotateX(${rotateX}deg) `;
      if (rotateY)
        transform += `rotateY(${rotateY}deg) `;
      if (skewX)
        transform += `skewX(${skewX}deg) `;
      if (skewY)
        transform += `skewY(${skewY}deg) `;
    }
    const elementScaleX = delta.x.scale * treeScale.x;
    const elementScaleY = delta.y.scale * treeScale.y;
    if (elementScaleX !== 1 || elementScaleY !== 1) {
      transform += `scale(${elementScaleX}, ${elementScaleY})`;
    }
    return transform || "none";
  }

  // ../../../node_modules/framer-motion/dist/es/projection/node/create-projection-node.mjs
  var metrics = {
    type: "projectionFrame",
    totalNodes: 0,
    resolvedTargetDeltas: 0,
    recalculatedProjection: 0
  };
  var isDebug = typeof window !== "undefined" && window.MotionDebug !== void 0;
  var transformAxes = ["", "X", "Y", "Z"];
  var hiddenVisibility = { visibility: "hidden" };
  var animationTarget = 1e3;
  var id2 = 0;
  function resetDistortingTransform(key, visualElement, values, sharedAnimationValues) {
    const { latestValues } = visualElement;
    if (latestValues[key]) {
      values[key] = latestValues[key];
      visualElement.setStaticValue(key, 0);
      if (sharedAnimationValues) {
        sharedAnimationValues[key] = 0;
      }
    }
  }
  function cancelTreeOptimisedTransformAnimations(projectionNode) {
    projectionNode.hasCheckedOptimisedAppear = true;
    if (projectionNode.root === projectionNode)
      return;
    const { visualElement } = projectionNode.options;
    if (!visualElement)
      return;
    const appearId = getOptimisedAppearId(visualElement);
    if (window.MotionHasOptimisedAnimation(appearId, "transform")) {
      const { layout: layout2, layoutId } = projectionNode.options;
      window.MotionCancelOptimisedAnimation(appearId, "transform", frame, !(layout2 || layoutId));
    }
    const { parent } = projectionNode;
    if (parent && !parent.hasCheckedOptimisedAppear) {
      cancelTreeOptimisedTransformAnimations(parent);
    }
  }
  function createProjectionNode2({ attachResizeListener, defaultParent, measureScroll, checkIsScrollRoot, resetTransform }) {
    return class ProjectionNode {
      constructor(latestValues = {}, parent = defaultParent === null || defaultParent === void 0 ? void 0 : defaultParent()) {
        this.id = id2++;
        this.animationId = 0;
        this.children = /* @__PURE__ */ new Set();
        this.options = {};
        this.isTreeAnimating = false;
        this.isAnimationBlocked = false;
        this.isLayoutDirty = false;
        this.isProjectionDirty = false;
        this.isSharedProjectionDirty = false;
        this.isTransformDirty = false;
        this.updateManuallyBlocked = false;
        this.updateBlockedByResize = false;
        this.isUpdating = false;
        this.isSVG = false;
        this.needsReset = false;
        this.shouldResetTransform = false;
        this.hasCheckedOptimisedAppear = false;
        this.treeScale = { x: 1, y: 1 };
        this.eventHandlers = /* @__PURE__ */ new Map();
        this.hasTreeAnimated = false;
        this.updateScheduled = false;
        this.scheduleUpdate = () => this.update();
        this.projectionUpdateScheduled = false;
        this.checkUpdateFailed = () => {
          if (this.isUpdating) {
            this.isUpdating = false;
            this.clearAllSnapshots();
          }
        };
        this.updateProjection = () => {
          this.projectionUpdateScheduled = false;
          if (isDebug) {
            metrics.totalNodes = metrics.resolvedTargetDeltas = metrics.recalculatedProjection = 0;
          }
          this.nodes.forEach(propagateDirtyNodes);
          this.nodes.forEach(resolveTargetDelta);
          this.nodes.forEach(calcProjection);
          this.nodes.forEach(cleanDirtyNodes);
          if (isDebug) {
            window.MotionDebug.record(metrics);
          }
        };
        this.resolvedRelativeTargetAt = 0;
        this.hasProjected = false;
        this.isVisible = true;
        this.animationProgress = 0;
        this.sharedNodes = /* @__PURE__ */ new Map();
        this.latestValues = latestValues;
        this.root = parent ? parent.root || parent : this;
        this.path = parent ? [...parent.path, parent] : [];
        this.parent = parent;
        this.depth = parent ? parent.depth + 1 : 0;
        for (let i = 0; i < this.path.length; i++) {
          this.path[i].shouldResetTransform = true;
        }
        if (this.root === this)
          this.nodes = new FlatTree();
      }
      addEventListener(name, handler) {
        if (!this.eventHandlers.has(name)) {
          this.eventHandlers.set(name, new SubscriptionManager());
        }
        return this.eventHandlers.get(name).add(handler);
      }
      notifyListeners(name, ...args) {
        const subscriptionManager = this.eventHandlers.get(name);
        subscriptionManager && subscriptionManager.notify(...args);
      }
      hasListeners(name) {
        return this.eventHandlers.has(name);
      }
      /**
       * Lifecycles
       */
      mount(instance, isLayoutDirty = this.root.hasTreeAnimated) {
        if (this.instance)
          return;
        this.isSVG = isSVGElement(instance);
        this.instance = instance;
        const { layoutId, layout: layout2, visualElement } = this.options;
        if (visualElement && !visualElement.current) {
          visualElement.mount(instance);
        }
        this.root.nodes.add(this);
        this.parent && this.parent.children.add(this);
        if (isLayoutDirty && (layout2 || layoutId)) {
          this.isLayoutDirty = true;
        }
        if (attachResizeListener) {
          let cancelDelay;
          const resizeUnblockUpdate = () => this.root.updateBlockedByResize = false;
          attachResizeListener(instance, () => {
            this.root.updateBlockedByResize = true;
            cancelDelay && cancelDelay();
            cancelDelay = delay(resizeUnblockUpdate, 250);
            if (globalProjectionState.hasAnimatedSinceResize) {
              globalProjectionState.hasAnimatedSinceResize = false;
              this.nodes.forEach(finishAnimation);
            }
          });
        }
        if (layoutId) {
          this.root.registerSharedNode(layoutId, this);
        }
        if (this.options.animate !== false && visualElement && (layoutId || layout2)) {
          this.addEventListener("didUpdate", ({ delta, hasLayoutChanged, hasRelativeTargetChanged, layout: newLayout }) => {
            if (this.isTreeAnimationBlocked()) {
              this.target = void 0;
              this.relativeTarget = void 0;
              return;
            }
            const layoutTransition = this.options.transition || visualElement.getDefaultTransition() || defaultLayoutTransition;
            const { onLayoutAnimationStart, onLayoutAnimationComplete } = visualElement.getProps();
            const targetChanged = !this.targetLayout || !boxEqualsRounded(this.targetLayout, newLayout) || hasRelativeTargetChanged;
            const hasOnlyRelativeTargetChanged = !hasLayoutChanged && hasRelativeTargetChanged;
            if (this.options.layoutRoot || this.resumeFrom && this.resumeFrom.instance || hasOnlyRelativeTargetChanged || hasLayoutChanged && (targetChanged || !this.currentAnimation)) {
              if (this.resumeFrom) {
                this.resumingFrom = this.resumeFrom;
                this.resumingFrom.resumingFrom = void 0;
              }
              this.setAnimationOrigin(delta, hasOnlyRelativeTargetChanged);
              const animationOptions = {
                ...getValueTransition(layoutTransition, "layout"),
                onPlay: onLayoutAnimationStart,
                onComplete: onLayoutAnimationComplete
              };
              if (visualElement.shouldReduceMotion || this.options.layoutRoot) {
                animationOptions.delay = 0;
                animationOptions.type = false;
              }
              this.startAnimation(animationOptions);
            } else {
              if (!hasLayoutChanged) {
                finishAnimation(this);
              }
              if (this.isLead() && this.options.onExitComplete) {
                this.options.onExitComplete();
              }
            }
            this.targetLayout = newLayout;
          });
        }
      }
      unmount() {
        this.options.layoutId && this.willUpdate();
        this.root.nodes.remove(this);
        const stack = this.getStack();
        stack && stack.remove(this);
        this.parent && this.parent.children.delete(this);
        this.instance = void 0;
        cancelFrame(this.updateProjection);
      }
      // only on the root
      blockUpdate() {
        this.updateManuallyBlocked = true;
      }
      unblockUpdate() {
        this.updateManuallyBlocked = false;
      }
      isUpdateBlocked() {
        return this.updateManuallyBlocked || this.updateBlockedByResize;
      }
      isTreeAnimationBlocked() {
        return this.isAnimationBlocked || this.parent && this.parent.isTreeAnimationBlocked() || false;
      }
      // Note: currently only running on root node
      startUpdate() {
        if (this.isUpdateBlocked())
          return;
        this.isUpdating = true;
        this.nodes && this.nodes.forEach(resetSkewAndRotation);
        this.animationId++;
      }
      getTransformTemplate() {
        const { visualElement } = this.options;
        return visualElement && visualElement.getProps().transformTemplate;
      }
      willUpdate(shouldNotifyListeners = true) {
        this.root.hasTreeAnimated = true;
        if (this.root.isUpdateBlocked()) {
          this.options.onExitComplete && this.options.onExitComplete();
          return;
        }
        if (window.MotionCancelOptimisedAnimation && !this.hasCheckedOptimisedAppear) {
          cancelTreeOptimisedTransformAnimations(this);
        }
        !this.root.isUpdating && this.root.startUpdate();
        if (this.isLayoutDirty)
          return;
        this.isLayoutDirty = true;
        for (let i = 0; i < this.path.length; i++) {
          const node = this.path[i];
          node.shouldResetTransform = true;
          node.updateScroll("snapshot");
          if (node.options.layoutRoot) {
            node.willUpdate(false);
          }
        }
        const { layoutId, layout: layout2 } = this.options;
        if (layoutId === void 0 && !layout2)
          return;
        const transformTemplate = this.getTransformTemplate();
        this.prevTransformTemplateValue = transformTemplate ? transformTemplate(this.latestValues, "") : void 0;
        this.updateSnapshot();
        shouldNotifyListeners && this.notifyListeners("willUpdate");
      }
      update() {
        this.updateScheduled = false;
        const updateWasBlocked = this.isUpdateBlocked();
        if (updateWasBlocked) {
          this.unblockUpdate();
          this.clearAllSnapshots();
          this.nodes.forEach(clearMeasurements);
          return;
        }
        if (!this.isUpdating) {
          this.nodes.forEach(clearIsLayoutDirty);
        }
        this.isUpdating = false;
        this.nodes.forEach(resetTransformStyle);
        this.nodes.forEach(updateLayout);
        this.nodes.forEach(notifyLayoutUpdate);
        this.clearAllSnapshots();
        const now2 = time.now();
        frameData.delta = clamp(0, 1e3 / 60, now2 - frameData.timestamp);
        frameData.timestamp = now2;
        frameData.isProcessing = true;
        frameSteps.update.process(frameData);
        frameSteps.preRender.process(frameData);
        frameSteps.render.process(frameData);
        frameData.isProcessing = false;
      }
      didUpdate() {
        if (!this.updateScheduled) {
          this.updateScheduled = true;
          microtask.read(this.scheduleUpdate);
        }
      }
      clearAllSnapshots() {
        this.nodes.forEach(clearSnapshot);
        this.sharedNodes.forEach(removeLeadSnapshots);
      }
      scheduleUpdateProjection() {
        if (!this.projectionUpdateScheduled) {
          this.projectionUpdateScheduled = true;
          frame.preRender(this.updateProjection, false, true);
        }
      }
      scheduleCheckAfterUnmount() {
        frame.postRender(() => {
          if (this.isLayoutDirty) {
            this.root.didUpdate();
          } else {
            this.root.checkUpdateFailed();
          }
        });
      }
      /**
       * Update measurements
       */
      updateSnapshot() {
        if (this.snapshot || !this.instance)
          return;
        this.snapshot = this.measure();
      }
      updateLayout() {
        if (!this.instance)
          return;
        this.updateScroll();
        if (!(this.options.alwaysMeasureLayout && this.isLead()) && !this.isLayoutDirty) {
          return;
        }
        if (this.resumeFrom && !this.resumeFrom.instance) {
          for (let i = 0; i < this.path.length; i++) {
            const node = this.path[i];
            node.updateScroll();
          }
        }
        const prevLayout = this.layout;
        this.layout = this.measure(false);
        this.layoutCorrected = createBox();
        this.isLayoutDirty = false;
        this.projectionDelta = void 0;
        this.notifyListeners("measure", this.layout.layoutBox);
        const { visualElement } = this.options;
        visualElement && visualElement.notify("LayoutMeasure", this.layout.layoutBox, prevLayout ? prevLayout.layoutBox : void 0);
      }
      updateScroll(phase = "measure") {
        let needsMeasurement = Boolean(this.options.layoutScroll && this.instance);
        if (this.scroll && this.scroll.animationId === this.root.animationId && this.scroll.phase === phase) {
          needsMeasurement = false;
        }
        if (needsMeasurement) {
          const isRoot = checkIsScrollRoot(this.instance);
          this.scroll = {
            animationId: this.root.animationId,
            phase,
            isRoot,
            offset: measureScroll(this.instance),
            wasRoot: this.scroll ? this.scroll.isRoot : isRoot
          };
        }
      }
      resetTransform() {
        if (!resetTransform)
          return;
        const isResetRequested = this.isLayoutDirty || this.shouldResetTransform || this.options.alwaysMeasureLayout;
        const hasProjection = this.projectionDelta && !isDeltaZero(this.projectionDelta);
        const transformTemplate = this.getTransformTemplate();
        const transformTemplateValue = transformTemplate ? transformTemplate(this.latestValues, "") : void 0;
        const transformTemplateHasChanged = transformTemplateValue !== this.prevTransformTemplateValue;
        if (isResetRequested && (hasProjection || hasTransform(this.latestValues) || transformTemplateHasChanged)) {
          resetTransform(this.instance, transformTemplateValue);
          this.shouldResetTransform = false;
          this.scheduleRender();
        }
      }
      measure(removeTransform = true) {
        const pageBox = this.measurePageBox();
        let layoutBox = this.removeElementScroll(pageBox);
        if (removeTransform) {
          layoutBox = this.removeTransform(layoutBox);
        }
        roundBox(layoutBox);
        return {
          animationId: this.root.animationId,
          measuredBox: pageBox,
          layoutBox,
          latestValues: {},
          source: this.id
        };
      }
      measurePageBox() {
        var _a;
        const { visualElement } = this.options;
        if (!visualElement)
          return createBox();
        const box = visualElement.measureViewportBox();
        const wasInScrollRoot = ((_a = this.scroll) === null || _a === void 0 ? void 0 : _a.wasRoot) || this.path.some(checkNodeWasScrollRoot);
        if (!wasInScrollRoot) {
          const { scroll } = this.root;
          if (scroll) {
            translateAxis(box.x, scroll.offset.x);
            translateAxis(box.y, scroll.offset.y);
          }
        }
        return box;
      }
      removeElementScroll(box) {
        var _a;
        const boxWithoutScroll = createBox();
        copyBoxInto(boxWithoutScroll, box);
        if ((_a = this.scroll) === null || _a === void 0 ? void 0 : _a.wasRoot) {
          return boxWithoutScroll;
        }
        for (let i = 0; i < this.path.length; i++) {
          const node = this.path[i];
          const { scroll, options } = node;
          if (node !== this.root && scroll && options.layoutScroll) {
            if (scroll.wasRoot) {
              copyBoxInto(boxWithoutScroll, box);
            }
            translateAxis(boxWithoutScroll.x, scroll.offset.x);
            translateAxis(boxWithoutScroll.y, scroll.offset.y);
          }
        }
        return boxWithoutScroll;
      }
      applyTransform(box, transformOnly = false) {
        const withTransforms = createBox();
        copyBoxInto(withTransforms, box);
        for (let i = 0; i < this.path.length; i++) {
          const node = this.path[i];
          if (!transformOnly && node.options.layoutScroll && node.scroll && node !== node.root) {
            transformBox(withTransforms, {
              x: -node.scroll.offset.x,
              y: -node.scroll.offset.y
            });
          }
          if (!hasTransform(node.latestValues))
            continue;
          transformBox(withTransforms, node.latestValues);
        }
        if (hasTransform(this.latestValues)) {
          transformBox(withTransforms, this.latestValues);
        }
        return withTransforms;
      }
      removeTransform(box) {
        const boxWithoutTransform = createBox();
        copyBoxInto(boxWithoutTransform, box);
        for (let i = 0; i < this.path.length; i++) {
          const node = this.path[i];
          if (!node.instance)
            continue;
          if (!hasTransform(node.latestValues))
            continue;
          hasScale(node.latestValues) && node.updateSnapshot();
          const sourceBox = createBox();
          const nodeBox = node.measurePageBox();
          copyBoxInto(sourceBox, nodeBox);
          removeBoxTransforms(boxWithoutTransform, node.latestValues, node.snapshot ? node.snapshot.layoutBox : void 0, sourceBox);
        }
        if (hasTransform(this.latestValues)) {
          removeBoxTransforms(boxWithoutTransform, this.latestValues);
        }
        return boxWithoutTransform;
      }
      setTargetDelta(delta) {
        this.targetDelta = delta;
        this.root.scheduleUpdateProjection();
        this.isProjectionDirty = true;
      }
      setOptions(options) {
        this.options = {
          ...this.options,
          ...options,
          crossfade: options.crossfade !== void 0 ? options.crossfade : true
        };
      }
      clearMeasurements() {
        this.scroll = void 0;
        this.layout = void 0;
        this.snapshot = void 0;
        this.prevTransformTemplateValue = void 0;
        this.targetDelta = void 0;
        this.target = void 0;
        this.isLayoutDirty = false;
      }
      forceRelativeParentToResolveTarget() {
        if (!this.relativeParent)
          return;
        if (this.relativeParent.resolvedRelativeTargetAt !== frameData.timestamp) {
          this.relativeParent.resolveTargetDelta(true);
        }
      }
      resolveTargetDelta(forceRecalculation = false) {
        var _a;
        const lead = this.getLead();
        this.isProjectionDirty || (this.isProjectionDirty = lead.isProjectionDirty);
        this.isTransformDirty || (this.isTransformDirty = lead.isTransformDirty);
        this.isSharedProjectionDirty || (this.isSharedProjectionDirty = lead.isSharedProjectionDirty);
        const isShared = Boolean(this.resumingFrom) || this !== lead;
        const canSkip = !(forceRecalculation || isShared && this.isSharedProjectionDirty || this.isProjectionDirty || ((_a = this.parent) === null || _a === void 0 ? void 0 : _a.isProjectionDirty) || this.attemptToResolveRelativeTarget || this.root.updateBlockedByResize);
        if (canSkip)
          return;
        const { layout: layout2, layoutId } = this.options;
        if (!this.layout || !(layout2 || layoutId))
          return;
        this.resolvedRelativeTargetAt = frameData.timestamp;
        if (!this.targetDelta && !this.relativeTarget) {
          const relativeParent = this.getClosestProjectingParent();
          if (relativeParent && relativeParent.layout && this.animationProgress !== 1) {
            this.relativeParent = relativeParent;
            this.forceRelativeParentToResolveTarget();
            this.relativeTarget = createBox();
            this.relativeTargetOrigin = createBox();
            calcRelativePosition(this.relativeTargetOrigin, this.layout.layoutBox, relativeParent.layout.layoutBox);
            copyBoxInto(this.relativeTarget, this.relativeTargetOrigin);
          } else {
            this.relativeParent = this.relativeTarget = void 0;
          }
        }
        if (!this.relativeTarget && !this.targetDelta)
          return;
        if (!this.target) {
          this.target = createBox();
          this.targetWithTransforms = createBox();
        }
        if (this.relativeTarget && this.relativeTargetOrigin && this.relativeParent && this.relativeParent.target) {
          this.forceRelativeParentToResolveTarget();
          calcRelativeBox(this.target, this.relativeTarget, this.relativeParent.target);
        } else if (this.targetDelta) {
          if (Boolean(this.resumingFrom)) {
            this.target = this.applyTransform(this.layout.layoutBox);
          } else {
            copyBoxInto(this.target, this.layout.layoutBox);
          }
          applyBoxDelta(this.target, this.targetDelta);
        } else {
          copyBoxInto(this.target, this.layout.layoutBox);
        }
        if (this.attemptToResolveRelativeTarget) {
          this.attemptToResolveRelativeTarget = false;
          const relativeParent = this.getClosestProjectingParent();
          if (relativeParent && Boolean(relativeParent.resumingFrom) === Boolean(this.resumingFrom) && !relativeParent.options.layoutScroll && relativeParent.target && this.animationProgress !== 1) {
            this.relativeParent = relativeParent;
            this.forceRelativeParentToResolveTarget();
            this.relativeTarget = createBox();
            this.relativeTargetOrigin = createBox();
            calcRelativePosition(this.relativeTargetOrigin, this.target, relativeParent.target);
            copyBoxInto(this.relativeTarget, this.relativeTargetOrigin);
          } else {
            this.relativeParent = this.relativeTarget = void 0;
          }
        }
        if (isDebug) {
          metrics.resolvedTargetDeltas++;
        }
      }
      getClosestProjectingParent() {
        if (!this.parent || hasScale(this.parent.latestValues) || has2DTranslate(this.parent.latestValues)) {
          return void 0;
        }
        if (this.parent.isProjecting()) {
          return this.parent;
        } else {
          return this.parent.getClosestProjectingParent();
        }
      }
      isProjecting() {
        return Boolean((this.relativeTarget || this.targetDelta || this.options.layoutRoot) && this.layout);
      }
      calcProjection() {
        var _a;
        const lead = this.getLead();
        const isShared = Boolean(this.resumingFrom) || this !== lead;
        let canSkip = true;
        if (this.isProjectionDirty || ((_a = this.parent) === null || _a === void 0 ? void 0 : _a.isProjectionDirty)) {
          canSkip = false;
        }
        if (isShared && (this.isSharedProjectionDirty || this.isTransformDirty)) {
          canSkip = false;
        }
        if (this.resolvedRelativeTargetAt === frameData.timestamp) {
          canSkip = false;
        }
        if (canSkip)
          return;
        const { layout: layout2, layoutId } = this.options;
        this.isTreeAnimating = Boolean(this.parent && this.parent.isTreeAnimating || this.currentAnimation || this.pendingAnimation);
        if (!this.isTreeAnimating) {
          this.targetDelta = this.relativeTarget = void 0;
        }
        if (!this.layout || !(layout2 || layoutId))
          return;
        copyBoxInto(this.layoutCorrected, this.layout.layoutBox);
        const prevTreeScaleX = this.treeScale.x;
        const prevTreeScaleY = this.treeScale.y;
        applyTreeDeltas(this.layoutCorrected, this.treeScale, this.path, isShared);
        if (lead.layout && !lead.target && (this.treeScale.x !== 1 || this.treeScale.y !== 1)) {
          lead.target = lead.layout.layoutBox;
          lead.targetWithTransforms = createBox();
        }
        const { target } = lead;
        if (!target) {
          if (this.prevProjectionDelta) {
            this.createProjectionDeltas();
            this.scheduleRender();
          }
          return;
        }
        if (!this.projectionDelta || !this.prevProjectionDelta) {
          this.createProjectionDeltas();
        } else {
          copyAxisDeltaInto(this.prevProjectionDelta.x, this.projectionDelta.x);
          copyAxisDeltaInto(this.prevProjectionDelta.y, this.projectionDelta.y);
        }
        calcBoxDelta(this.projectionDelta, this.layoutCorrected, target, this.latestValues);
        if (this.treeScale.x !== prevTreeScaleX || this.treeScale.y !== prevTreeScaleY || !axisDeltaEquals(this.projectionDelta.x, this.prevProjectionDelta.x) || !axisDeltaEquals(this.projectionDelta.y, this.prevProjectionDelta.y)) {
          this.hasProjected = true;
          this.scheduleRender();
          this.notifyListeners("projectionUpdate", target);
        }
        if (isDebug) {
          metrics.recalculatedProjection++;
        }
      }
      hide() {
        this.isVisible = false;
      }
      show() {
        this.isVisible = true;
      }
      scheduleRender(notifyAll = true) {
        var _a;
        (_a = this.options.visualElement) === null || _a === void 0 ? void 0 : _a.scheduleRender();
        if (notifyAll) {
          const stack = this.getStack();
          stack && stack.scheduleRender();
        }
        if (this.resumingFrom && !this.resumingFrom.instance) {
          this.resumingFrom = void 0;
        }
      }
      createProjectionDeltas() {
        this.prevProjectionDelta = createDelta();
        this.projectionDelta = createDelta();
        this.projectionDeltaWithTransform = createDelta();
      }
      setAnimationOrigin(delta, hasOnlyRelativeTargetChanged = false) {
        const snapshot = this.snapshot;
        const snapshotLatestValues = snapshot ? snapshot.latestValues : {};
        const mixedValues = { ...this.latestValues };
        const targetDelta = createDelta();
        if (!this.relativeParent || !this.relativeParent.options.layoutRoot) {
          this.relativeTarget = this.relativeTargetOrigin = void 0;
        }
        this.attemptToResolveRelativeTarget = !hasOnlyRelativeTargetChanged;
        const relativeLayout = createBox();
        const snapshotSource = snapshot ? snapshot.source : void 0;
        const layoutSource = this.layout ? this.layout.source : void 0;
        const isSharedLayoutAnimation = snapshotSource !== layoutSource;
        const stack = this.getStack();
        const isOnlyMember = !stack || stack.members.length <= 1;
        const shouldCrossfadeOpacity = Boolean(isSharedLayoutAnimation && !isOnlyMember && this.options.crossfade === true && !this.path.some(hasOpacityCrossfade));
        this.animationProgress = 0;
        let prevRelativeTarget;
        this.mixTargetDelta = (latest) => {
          const progress2 = latest / 1e3;
          mixAxisDelta(targetDelta.x, delta.x, progress2);
          mixAxisDelta(targetDelta.y, delta.y, progress2);
          this.setTargetDelta(targetDelta);
          if (this.relativeTarget && this.relativeTargetOrigin && this.layout && this.relativeParent && this.relativeParent.layout) {
            calcRelativePosition(relativeLayout, this.layout.layoutBox, this.relativeParent.layout.layoutBox);
            mixBox(this.relativeTarget, this.relativeTargetOrigin, relativeLayout, progress2);
            if (prevRelativeTarget && boxEquals(this.relativeTarget, prevRelativeTarget)) {
              this.isProjectionDirty = false;
            }
            if (!prevRelativeTarget)
              prevRelativeTarget = createBox();
            copyBoxInto(prevRelativeTarget, this.relativeTarget);
          }
          if (isSharedLayoutAnimation) {
            this.animationValues = mixedValues;
            mixValues(mixedValues, snapshotLatestValues, this.latestValues, progress2, shouldCrossfadeOpacity, isOnlyMember);
          }
          this.root.scheduleUpdateProjection();
          this.scheduleRender();
          this.animationProgress = progress2;
        };
        this.mixTargetDelta(this.options.layoutRoot ? 1e3 : 0);
      }
      startAnimation(options) {
        this.notifyListeners("animationStart");
        this.currentAnimation && this.currentAnimation.stop();
        if (this.resumingFrom && this.resumingFrom.currentAnimation) {
          this.resumingFrom.currentAnimation.stop();
        }
        if (this.pendingAnimation) {
          cancelFrame(this.pendingAnimation);
          this.pendingAnimation = void 0;
        }
        this.pendingAnimation = frame.update(() => {
          globalProjectionState.hasAnimatedSinceResize = true;
          this.currentAnimation = animateSingleValue(0, animationTarget, {
            ...options,
            onUpdate: (latest) => {
              this.mixTargetDelta(latest);
              options.onUpdate && options.onUpdate(latest);
            },
            onComplete: () => {
              options.onComplete && options.onComplete();
              this.completeAnimation();
            }
          });
          if (this.resumingFrom) {
            this.resumingFrom.currentAnimation = this.currentAnimation;
          }
          this.pendingAnimation = void 0;
        });
      }
      completeAnimation() {
        if (this.resumingFrom) {
          this.resumingFrom.currentAnimation = void 0;
          this.resumingFrom.preserveOpacity = void 0;
        }
        const stack = this.getStack();
        stack && stack.exitAnimationComplete();
        this.resumingFrom = this.currentAnimation = this.animationValues = void 0;
        this.notifyListeners("animationComplete");
      }
      finishAnimation() {
        if (this.currentAnimation) {
          this.mixTargetDelta && this.mixTargetDelta(animationTarget);
          this.currentAnimation.stop();
        }
        this.completeAnimation();
      }
      applyTransformsToTarget() {
        const lead = this.getLead();
        let { targetWithTransforms, target, layout: layout2, latestValues } = lead;
        if (!targetWithTransforms || !target || !layout2)
          return;
        if (this !== lead && this.layout && layout2 && shouldAnimatePositionOnly(this.options.animationType, this.layout.layoutBox, layout2.layoutBox)) {
          target = this.target || createBox();
          const xLength = calcLength(this.layout.layoutBox.x);
          target.x.min = lead.target.x.min;
          target.x.max = target.x.min + xLength;
          const yLength = calcLength(this.layout.layoutBox.y);
          target.y.min = lead.target.y.min;
          target.y.max = target.y.min + yLength;
        }
        copyBoxInto(targetWithTransforms, target);
        transformBox(targetWithTransforms, latestValues);
        calcBoxDelta(this.projectionDeltaWithTransform, this.layoutCorrected, targetWithTransforms, latestValues);
      }
      registerSharedNode(layoutId, node) {
        if (!this.sharedNodes.has(layoutId)) {
          this.sharedNodes.set(layoutId, new NodeStack());
        }
        const stack = this.sharedNodes.get(layoutId);
        stack.add(node);
        const config = node.options.initialPromotionConfig;
        node.promote({
          transition: config ? config.transition : void 0,
          preserveFollowOpacity: config && config.shouldPreserveFollowOpacity ? config.shouldPreserveFollowOpacity(node) : void 0
        });
      }
      isLead() {
        const stack = this.getStack();
        return stack ? stack.lead === this : true;
      }
      getLead() {
        var _a;
        const { layoutId } = this.options;
        return layoutId ? ((_a = this.getStack()) === null || _a === void 0 ? void 0 : _a.lead) || this : this;
      }
      getPrevLead() {
        var _a;
        const { layoutId } = this.options;
        return layoutId ? (_a = this.getStack()) === null || _a === void 0 ? void 0 : _a.prevLead : void 0;
      }
      getStack() {
        const { layoutId } = this.options;
        if (layoutId)
          return this.root.sharedNodes.get(layoutId);
      }
      promote({ needsReset, transition, preserveFollowOpacity } = {}) {
        const stack = this.getStack();
        if (stack)
          stack.promote(this, preserveFollowOpacity);
        if (needsReset) {
          this.projectionDelta = void 0;
          this.needsReset = true;
        }
        if (transition)
          this.setOptions({ transition });
      }
      relegate() {
        const stack = this.getStack();
        if (stack) {
          return stack.relegate(this);
        } else {
          return false;
        }
      }
      resetSkewAndRotation() {
        const { visualElement } = this.options;
        if (!visualElement)
          return;
        let hasDistortingTransform = false;
        const { latestValues } = visualElement;
        if (latestValues.z || latestValues.rotate || latestValues.rotateX || latestValues.rotateY || latestValues.rotateZ || latestValues.skewX || latestValues.skewY) {
          hasDistortingTransform = true;
        }
        if (!hasDistortingTransform)
          return;
        const resetValues = {};
        if (latestValues.z) {
          resetDistortingTransform("z", visualElement, resetValues, this.animationValues);
        }
        for (let i = 0; i < transformAxes.length; i++) {
          resetDistortingTransform(`rotate${transformAxes[i]}`, visualElement, resetValues, this.animationValues);
          resetDistortingTransform(`skew${transformAxes[i]}`, visualElement, resetValues, this.animationValues);
        }
        visualElement.render();
        for (const key in resetValues) {
          visualElement.setStaticValue(key, resetValues[key]);
          if (this.animationValues) {
            this.animationValues[key] = resetValues[key];
          }
        }
        visualElement.scheduleRender();
      }
      getProjectionStyles(styleProp) {
        var _a, _b;
        if (!this.instance || this.isSVG)
          return void 0;
        if (!this.isVisible) {
          return hiddenVisibility;
        }
        const styles = {
          visibility: ""
        };
        const transformTemplate = this.getTransformTemplate();
        if (this.needsReset) {
          this.needsReset = false;
          styles.opacity = "";
          styles.pointerEvents = resolveMotionValue(styleProp === null || styleProp === void 0 ? void 0 : styleProp.pointerEvents) || "";
          styles.transform = transformTemplate ? transformTemplate(this.latestValues, "") : "none";
          return styles;
        }
        const lead = this.getLead();
        if (!this.projectionDelta || !this.layout || !lead.target) {
          const emptyStyles = {};
          if (this.options.layoutId) {
            emptyStyles.opacity = this.latestValues.opacity !== void 0 ? this.latestValues.opacity : 1;
            emptyStyles.pointerEvents = resolveMotionValue(styleProp === null || styleProp === void 0 ? void 0 : styleProp.pointerEvents) || "";
          }
          if (this.hasProjected && !hasTransform(this.latestValues)) {
            emptyStyles.transform = transformTemplate ? transformTemplate({}, "") : "none";
            this.hasProjected = false;
          }
          return emptyStyles;
        }
        const valuesToRender = lead.animationValues || lead.latestValues;
        this.applyTransformsToTarget();
        styles.transform = buildProjectionTransform(this.projectionDeltaWithTransform, this.treeScale, valuesToRender);
        if (transformTemplate) {
          styles.transform = transformTemplate(valuesToRender, styles.transform);
        }
        const { x, y } = this.projectionDelta;
        styles.transformOrigin = `${x.origin * 100}% ${y.origin * 100}% 0`;
        if (lead.animationValues) {
          styles.opacity = lead === this ? (_b = (_a = valuesToRender.opacity) !== null && _a !== void 0 ? _a : this.latestValues.opacity) !== null && _b !== void 0 ? _b : 1 : this.preserveOpacity ? this.latestValues.opacity : valuesToRender.opacityExit;
        } else {
          styles.opacity = lead === this ? valuesToRender.opacity !== void 0 ? valuesToRender.opacity : "" : valuesToRender.opacityExit !== void 0 ? valuesToRender.opacityExit : 0;
        }
        for (const key in scaleCorrectors) {
          if (valuesToRender[key] === void 0)
            continue;
          const { correct, applyTo } = scaleCorrectors[key];
          const corrected = styles.transform === "none" ? valuesToRender[key] : correct(valuesToRender[key], lead);
          if (applyTo) {
            const num = applyTo.length;
            for (let i = 0; i < num; i++) {
              styles[applyTo[i]] = corrected;
            }
          } else {
            styles[key] = corrected;
          }
        }
        if (this.options.layoutId) {
          styles.pointerEvents = lead === this ? resolveMotionValue(styleProp === null || styleProp === void 0 ? void 0 : styleProp.pointerEvents) || "" : "none";
        }
        return styles;
      }
      clearSnapshot() {
        this.resumeFrom = this.snapshot = void 0;
      }
      // Only run on root
      resetTree() {
        this.root.nodes.forEach((node) => {
          var _a;
          return (_a = node.currentAnimation) === null || _a === void 0 ? void 0 : _a.stop();
        });
        this.root.nodes.forEach(clearMeasurements);
        this.root.sharedNodes.clear();
      }
    };
  }
  function updateLayout(node) {
    node.updateLayout();
  }
  function notifyLayoutUpdate(node) {
    var _a;
    const snapshot = ((_a = node.resumeFrom) === null || _a === void 0 ? void 0 : _a.snapshot) || node.snapshot;
    if (node.isLead() && node.layout && snapshot && node.hasListeners("didUpdate")) {
      const { layoutBox: layout2, measuredBox: measuredLayout } = node.layout;
      const { animationType } = node.options;
      const isShared = snapshot.source !== node.layout.source;
      if (animationType === "size") {
        eachAxis((axis) => {
          const axisSnapshot = isShared ? snapshot.measuredBox[axis] : snapshot.layoutBox[axis];
          const length = calcLength(axisSnapshot);
          axisSnapshot.min = layout2[axis].min;
          axisSnapshot.max = axisSnapshot.min + length;
        });
      } else if (shouldAnimatePositionOnly(animationType, snapshot.layoutBox, layout2)) {
        eachAxis((axis) => {
          const axisSnapshot = isShared ? snapshot.measuredBox[axis] : snapshot.layoutBox[axis];
          const length = calcLength(layout2[axis]);
          axisSnapshot.max = axisSnapshot.min + length;
          if (node.relativeTarget && !node.currentAnimation) {
            node.isProjectionDirty = true;
            node.relativeTarget[axis].max = node.relativeTarget[axis].min + length;
          }
        });
      }
      const layoutDelta = createDelta();
      calcBoxDelta(layoutDelta, layout2, snapshot.layoutBox);
      const visualDelta = createDelta();
      if (isShared) {
        calcBoxDelta(visualDelta, node.applyTransform(measuredLayout, true), snapshot.measuredBox);
      } else {
        calcBoxDelta(visualDelta, layout2, snapshot.layoutBox);
      }
      const hasLayoutChanged = !isDeltaZero(layoutDelta);
      let hasRelativeTargetChanged = false;
      if (!node.resumeFrom) {
        const relativeParent = node.getClosestProjectingParent();
        if (relativeParent && !relativeParent.resumeFrom) {
          const { snapshot: parentSnapshot, layout: parentLayout } = relativeParent;
          if (parentSnapshot && parentLayout) {
            const relativeSnapshot = createBox();
            calcRelativePosition(relativeSnapshot, snapshot.layoutBox, parentSnapshot.layoutBox);
            const relativeLayout = createBox();
            calcRelativePosition(relativeLayout, layout2, parentLayout.layoutBox);
            if (!boxEqualsRounded(relativeSnapshot, relativeLayout)) {
              hasRelativeTargetChanged = true;
            }
            if (relativeParent.options.layoutRoot) {
              node.relativeTarget = relativeLayout;
              node.relativeTargetOrigin = relativeSnapshot;
              node.relativeParent = relativeParent;
            }
          }
        }
      }
      node.notifyListeners("didUpdate", {
        layout: layout2,
        snapshot,
        delta: visualDelta,
        layoutDelta,
        hasLayoutChanged,
        hasRelativeTargetChanged
      });
    } else if (node.isLead()) {
      const { onExitComplete } = node.options;
      onExitComplete && onExitComplete();
    }
    node.options.transition = void 0;
  }
  function propagateDirtyNodes(node) {
    if (isDebug) {
      metrics.totalNodes++;
    }
    if (!node.parent)
      return;
    if (!node.isProjecting()) {
      node.isProjectionDirty = node.parent.isProjectionDirty;
    }
    node.isSharedProjectionDirty || (node.isSharedProjectionDirty = Boolean(node.isProjectionDirty || node.parent.isProjectionDirty || node.parent.isSharedProjectionDirty));
    node.isTransformDirty || (node.isTransformDirty = node.parent.isTransformDirty);
  }
  function cleanDirtyNodes(node) {
    node.isProjectionDirty = node.isSharedProjectionDirty = node.isTransformDirty = false;
  }
  function clearSnapshot(node) {
    node.clearSnapshot();
  }
  function clearMeasurements(node) {
    node.clearMeasurements();
  }
  function clearIsLayoutDirty(node) {
    node.isLayoutDirty = false;
  }
  function resetTransformStyle(node) {
    const { visualElement } = node.options;
    if (visualElement && visualElement.getProps().onBeforeLayoutMeasure) {
      visualElement.notify("BeforeLayoutMeasure");
    }
    node.resetTransform();
  }
  function finishAnimation(node) {
    node.finishAnimation();
    node.targetDelta = node.relativeTarget = node.target = void 0;
    node.isProjectionDirty = true;
  }
  function resolveTargetDelta(node) {
    node.resolveTargetDelta();
  }
  function calcProjection(node) {
    node.calcProjection();
  }
  function resetSkewAndRotation(node) {
    node.resetSkewAndRotation();
  }
  function removeLeadSnapshots(stack) {
    stack.removeLeadSnapshot();
  }
  function mixAxisDelta(output, delta, p) {
    output.translate = mixNumber(delta.translate, 0, p);
    output.scale = mixNumber(delta.scale, 1, p);
    output.origin = delta.origin;
    output.originPoint = delta.originPoint;
  }
  function mixAxis(output, from, to, p) {
    output.min = mixNumber(from.min, to.min, p);
    output.max = mixNumber(from.max, to.max, p);
  }
  function mixBox(output, from, to, p) {
    mixAxis(output.x, from.x, to.x, p);
    mixAxis(output.y, from.y, to.y, p);
  }
  function hasOpacityCrossfade(node) {
    return node.animationValues && node.animationValues.opacityExit !== void 0;
  }
  var defaultLayoutTransition = {
    duration: 0.45,
    ease: [0.4, 0, 0.1, 1]
  };
  var userAgentContains = (string) => typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().includes(string);
  var roundPoint = userAgentContains("applewebkit/") && !userAgentContains("chrome/") ? Math.round : noop;
  function roundAxis(axis) {
    axis.min = roundPoint(axis.min);
    axis.max = roundPoint(axis.max);
  }
  function roundBox(box) {
    roundAxis(box.x);
    roundAxis(box.y);
  }
  function shouldAnimatePositionOnly(animationType, snapshot, layout2) {
    return animationType === "position" || animationType === "preserve-aspect" && !isNear(aspectRatio(snapshot), aspectRatio(layout2), 0.2);
  }
  function checkNodeWasScrollRoot(node) {
    var _a;
    return node !== node.root && ((_a = node.scroll) === null || _a === void 0 ? void 0 : _a.wasRoot);
  }

  // ../../../node_modules/framer-motion/dist/es/projection/node/DocumentProjectionNode.mjs
  var DocumentProjectionNode = createProjectionNode2({
    attachResizeListener: (ref, notify) => addDomEvent(ref, "resize", notify),
    measureScroll: () => ({
      x: document.documentElement.scrollLeft || document.body.scrollLeft,
      y: document.documentElement.scrollTop || document.body.scrollTop
    }),
    checkIsScrollRoot: () => true
  });

  // ../../../node_modules/framer-motion/dist/es/projection/node/HTMLProjectionNode.mjs
  var rootProjectionNode = {
    current: void 0
  };
  var HTMLProjectionNode = createProjectionNode2({
    measureScroll: (instance) => ({
      x: instance.scrollLeft,
      y: instance.scrollTop
    }),
    defaultParent: () => {
      if (!rootProjectionNode.current) {
        const documentNode = new DocumentProjectionNode({});
        documentNode.mount(window);
        documentNode.setOptions({ layoutScroll: true });
        rootProjectionNode.current = documentNode;
      }
      return rootProjectionNode.current;
    },
    resetTransform: (instance, value) => {
      instance.style.transform = value !== void 0 ? value : "none";
    },
    checkIsScrollRoot: (instance) => Boolean(window.getComputedStyle(instance).position === "fixed")
  });

  // ../../../node_modules/framer-motion/dist/es/motion/features/drag.mjs
  var drag = {
    pan: {
      Feature: PanGesture
    },
    drag: {
      Feature: DragGesture,
      ProjectionNode: HTMLProjectionNode,
      MeasureLayout
    }
  };

  // ../../../node_modules/framer-motion/dist/es/gestures/hover.mjs
  function handleHoverEvent(node, event, lifecycle) {
    const { props } = node;
    if (node.animationState && props.whileHover) {
      node.animationState.setActive("whileHover", lifecycle === "Start");
    }
    const eventName = "onHover" + lifecycle;
    const callback = props[eventName];
    if (callback) {
      frame.postRender(() => callback(event, extractEventInfo(event)));
    }
  }
  var HoverGesture = class extends Feature {
    mount() {
      const { current } = this.node;
      if (!current)
        return;
      this.unmount = hover(current, (startEvent) => {
        handleHoverEvent(this.node, startEvent, "Start");
        return (endEvent) => handleHoverEvent(this.node, endEvent, "End");
      });
    }
    unmount() {
    }
  };

  // ../../../node_modules/framer-motion/dist/es/gestures/focus.mjs
  var FocusGesture = class extends Feature {
    constructor() {
      super(...arguments);
      this.isActive = false;
    }
    onFocus() {
      let isFocusVisible = false;
      try {
        isFocusVisible = this.node.current.matches(":focus-visible");
      } catch (e) {
        isFocusVisible = true;
      }
      if (!isFocusVisible || !this.node.animationState)
        return;
      this.node.animationState.setActive("whileFocus", true);
      this.isActive = true;
    }
    onBlur() {
      if (!this.isActive || !this.node.animationState)
        return;
      this.node.animationState.setActive("whileFocus", false);
      this.isActive = false;
    }
    mount() {
      this.unmount = pipe(addDomEvent(this.node.current, "focus", () => this.onFocus()), addDomEvent(this.node.current, "blur", () => this.onBlur()));
    }
    unmount() {
    }
  };

  // ../../../node_modules/framer-motion/dist/es/gestures/press.mjs
  function handlePressEvent(node, event, lifecycle) {
    const { props } = node;
    if (node.animationState && props.whileTap) {
      node.animationState.setActive("whileTap", lifecycle === "Start");
    }
    const eventName = "onTap" + (lifecycle === "End" ? "" : lifecycle);
    const callback = props[eventName];
    if (callback) {
      frame.postRender(() => callback(event, extractEventInfo(event)));
    }
  }
  var PressGesture = class extends Feature {
    mount() {
      const { current } = this.node;
      if (!current)
        return;
      this.unmount = press(current, (startEvent) => {
        handlePressEvent(this.node, startEvent, "Start");
        return (endEvent, { success }) => handlePressEvent(this.node, endEvent, success ? "End" : "Cancel");
      }, { useGlobalTarget: this.node.props.globalTapTarget });
    }
    unmount() {
    }
  };

  // ../../../node_modules/framer-motion/dist/es/motion/features/viewport/observers.mjs
  var observerCallbacks = /* @__PURE__ */ new WeakMap();
  var observers = /* @__PURE__ */ new WeakMap();
  var fireObserverCallback = (entry) => {
    const callback = observerCallbacks.get(entry.target);
    callback && callback(entry);
  };
  var fireAllObserverCallbacks = (entries) => {
    entries.forEach(fireObserverCallback);
  };
  function initIntersectionObserver({ root, ...options }) {
    const lookupRoot = root || document;
    if (!observers.has(lookupRoot)) {
      observers.set(lookupRoot, {});
    }
    const rootObservers = observers.get(lookupRoot);
    const key = JSON.stringify(options);
    if (!rootObservers[key]) {
      rootObservers[key] = new IntersectionObserver(fireAllObserverCallbacks, { root, ...options });
    }
    return rootObservers[key];
  }
  function observeIntersection(element, options, callback) {
    const rootInteresectionObserver = initIntersectionObserver(options);
    observerCallbacks.set(element, callback);
    rootInteresectionObserver.observe(element);
    return () => {
      observerCallbacks.delete(element);
      rootInteresectionObserver.unobserve(element);
    };
  }

  // ../../../node_modules/framer-motion/dist/es/motion/features/viewport/index.mjs
  var thresholdNames = {
    some: 0,
    all: 1
  };
  var InViewFeature = class extends Feature {
    constructor() {
      super(...arguments);
      this.hasEnteredView = false;
      this.isInView = false;
    }
    startObserver() {
      this.unmount();
      const { viewport = {} } = this.node.getProps();
      const { root, margin: rootMargin, amount = "some", once } = viewport;
      const options = {
        root: root ? root.current : void 0,
        rootMargin,
        threshold: typeof amount === "number" ? amount : thresholdNames[amount]
      };
      const onIntersectionUpdate = (entry) => {
        const { isIntersecting } = entry;
        if (this.isInView === isIntersecting)
          return;
        this.isInView = isIntersecting;
        if (once && !isIntersecting && this.hasEnteredView) {
          return;
        } else if (isIntersecting) {
          this.hasEnteredView = true;
        }
        if (this.node.animationState) {
          this.node.animationState.setActive("whileInView", isIntersecting);
        }
        const { onViewportEnter, onViewportLeave } = this.node.getProps();
        const callback = isIntersecting ? onViewportEnter : onViewportLeave;
        callback && callback(entry);
      };
      return observeIntersection(this.node.current, options, onIntersectionUpdate);
    }
    mount() {
      this.startObserver();
    }
    update() {
      if (typeof IntersectionObserver === "undefined")
        return;
      const { props, prevProps } = this.node;
      const hasOptionsChanged = ["amount", "margin", "root"].some(hasViewportOptionChanged(props, prevProps));
      if (hasOptionsChanged) {
        this.startObserver();
      }
    }
    unmount() {
    }
  };
  function hasViewportOptionChanged({ viewport = {} }, { viewport: prevViewport = {} } = {}) {
    return (name) => viewport[name] !== prevViewport[name];
  }

  // ../../../node_modules/framer-motion/dist/es/motion/features/gestures.mjs
  var gestureAnimations = {
    inView: {
      Feature: InViewFeature
    },
    tap: {
      Feature: PressGesture
    },
    focus: {
      Feature: FocusGesture
    },
    hover: {
      Feature: HoverGesture
    }
  };

  // ../../../node_modules/framer-motion/dist/es/motion/features/layout.mjs
  var layout = {
    layout: {
      ProjectionNode: HTMLProjectionNode,
      MeasureLayout
    }
  };

  // ../../../node_modules/framer-motion/dist/es/utils/reduced-motion/state.mjs
  var prefersReducedMotion = { current: null };
  var hasReducedMotionListener = { current: false };

  // ../../../node_modules/framer-motion/dist/es/utils/reduced-motion/index.mjs
  function initPrefersReducedMotion() {
    hasReducedMotionListener.current = true;
    if (!isBrowser)
      return;
    if (window.matchMedia) {
      const motionMediaQuery = window.matchMedia("(prefers-reduced-motion)");
      const setReducedMotionPreferences = () => prefersReducedMotion.current = motionMediaQuery.matches;
      motionMediaQuery.addListener(setReducedMotionPreferences);
      setReducedMotionPreferences();
    } else {
      prefersReducedMotion.current = false;
    }
  }

  // ../../../node_modules/framer-motion/dist/es/render/dom/value-types/find.mjs
  var valueTypes = [...dimensionValueTypes, color, complex];
  var findValueType = (v) => valueTypes.find(testValueType(v));

  // ../../../node_modules/framer-motion/dist/es/render/store.mjs
  var visualElementStore = /* @__PURE__ */ new WeakMap();

  // ../../../node_modules/framer-motion/dist/es/render/utils/motion-values.mjs
  function updateMotionValuesFromProps(element, next, prev) {
    for (const key in next) {
      const nextValue = next[key];
      const prevValue = prev[key];
      if (isMotionValue(nextValue)) {
        element.addValue(key, nextValue);
        if (true) {
          warnOnce(nextValue.version === "11.18.2", `Attempting to mix Motion versions ${nextValue.version} with 11.18.2 may not work as expected.`);
        }
      } else if (isMotionValue(prevValue)) {
        element.addValue(key, motionValue(nextValue, { owner: element }));
      } else if (prevValue !== nextValue) {
        if (element.hasValue(key)) {
          const existingValue = element.getValue(key);
          if (existingValue.liveStyle === true) {
            existingValue.jump(nextValue);
          } else if (!existingValue.hasAnimated) {
            existingValue.set(nextValue);
          }
        } else {
          const latestValue = element.getStaticValue(key);
          element.addValue(key, motionValue(latestValue !== void 0 ? latestValue : nextValue, { owner: element }));
        }
      }
    }
    for (const key in prev) {
      if (next[key] === void 0)
        element.removeValue(key);
    }
    return next;
  }

  // ../../../node_modules/framer-motion/dist/es/render/VisualElement.mjs
  var propEventHandlers = [
    "AnimationStart",
    "AnimationComplete",
    "Update",
    "BeforeLayoutMeasure",
    "LayoutMeasure",
    "LayoutAnimationStart",
    "LayoutAnimationComplete"
  ];
  var VisualElement = class {
    /**
     * This method takes React props and returns found MotionValues. For example, HTML
     * MotionValues will be found within the style prop, whereas for Three.js within attribute arrays.
     *
     * This isn't an abstract method as it needs calling in the constructor, but it is
     * intended to be one.
     */
    scrapeMotionValuesFromProps(_props, _prevProps, _visualElement) {
      return {};
    }
    constructor({ parent, props, presenceContext, reducedMotionConfig, blockInitialAnimation, visualState }, options = {}) {
      this.current = null;
      this.children = /* @__PURE__ */ new Set();
      this.isVariantNode = false;
      this.isControllingVariants = false;
      this.shouldReduceMotion = null;
      this.values = /* @__PURE__ */ new Map();
      this.KeyframeResolver = KeyframeResolver;
      this.features = {};
      this.valueSubscriptions = /* @__PURE__ */ new Map();
      this.prevMotionValues = {};
      this.events = {};
      this.propEventSubscriptions = {};
      this.notifyUpdate = () => this.notify("Update", this.latestValues);
      this.render = () => {
        if (!this.current)
          return;
        this.triggerBuild();
        this.renderInstance(this.current, this.renderState, this.props.style, this.projection);
      };
      this.renderScheduledAt = 0;
      this.scheduleRender = () => {
        const now2 = time.now();
        if (this.renderScheduledAt < now2) {
          this.renderScheduledAt = now2;
          frame.render(this.render, false, true);
        }
      };
      const { latestValues, renderState, onUpdate } = visualState;
      this.onUpdate = onUpdate;
      this.latestValues = latestValues;
      this.baseTarget = { ...latestValues };
      this.initialValues = props.initial ? { ...latestValues } : {};
      this.renderState = renderState;
      this.parent = parent;
      this.props = props;
      this.presenceContext = presenceContext;
      this.depth = parent ? parent.depth + 1 : 0;
      this.reducedMotionConfig = reducedMotionConfig;
      this.options = options;
      this.blockInitialAnimation = Boolean(blockInitialAnimation);
      this.isControllingVariants = isControllingVariants(props);
      this.isVariantNode = isVariantNode(props);
      if (this.isVariantNode) {
        this.variantChildren = /* @__PURE__ */ new Set();
      }
      this.manuallyAnimateOnMount = Boolean(parent && parent.current);
      const { willChange, ...initialMotionValues } = this.scrapeMotionValuesFromProps(props, {}, this);
      for (const key in initialMotionValues) {
        const value = initialMotionValues[key];
        if (latestValues[key] !== void 0 && isMotionValue(value)) {
          value.set(latestValues[key], false);
        }
      }
    }
    mount(instance) {
      this.current = instance;
      visualElementStore.set(instance, this);
      if (this.projection && !this.projection.instance) {
        this.projection.mount(instance);
      }
      if (this.parent && this.isVariantNode && !this.isControllingVariants) {
        this.removeFromVariantTree = this.parent.addVariantChild(this);
      }
      this.values.forEach((value, key) => this.bindToMotionValue(key, value));
      if (!hasReducedMotionListener.current) {
        initPrefersReducedMotion();
      }
      this.shouldReduceMotion = this.reducedMotionConfig === "never" ? false : this.reducedMotionConfig === "always" ? true : prefersReducedMotion.current;
      if (true) {
        warnOnce(this.shouldReduceMotion !== true, "You have Reduced Motion enabled on your device. Animations may not appear as expected.");
      }
      if (this.parent)
        this.parent.children.add(this);
      this.update(this.props, this.presenceContext);
    }
    unmount() {
      visualElementStore.delete(this.current);
      this.projection && this.projection.unmount();
      cancelFrame(this.notifyUpdate);
      cancelFrame(this.render);
      this.valueSubscriptions.forEach((remove) => remove());
      this.valueSubscriptions.clear();
      this.removeFromVariantTree && this.removeFromVariantTree();
      this.parent && this.parent.children.delete(this);
      for (const key in this.events) {
        this.events[key].clear();
      }
      for (const key in this.features) {
        const feature = this.features[key];
        if (feature) {
          feature.unmount();
          feature.isMounted = false;
        }
      }
      this.current = null;
    }
    bindToMotionValue(key, value) {
      if (this.valueSubscriptions.has(key)) {
        this.valueSubscriptions.get(key)();
      }
      const valueIsTransform = transformProps.has(key);
      const removeOnChange = value.on("change", (latestValue) => {
        this.latestValues[key] = latestValue;
        this.props.onUpdate && frame.preRender(this.notifyUpdate);
        if (valueIsTransform && this.projection) {
          this.projection.isTransformDirty = true;
        }
      });
      const removeOnRenderRequest = value.on("renderRequest", this.scheduleRender);
      let removeSyncCheck;
      if (window.MotionCheckAppearSync) {
        removeSyncCheck = window.MotionCheckAppearSync(this, key, value);
      }
      this.valueSubscriptions.set(key, () => {
        removeOnChange();
        removeOnRenderRequest();
        if (removeSyncCheck)
          removeSyncCheck();
        if (value.owner)
          value.stop();
      });
    }
    sortNodePosition(other) {
      if (!this.current || !this.sortInstanceNodePosition || this.type !== other.type) {
        return 0;
      }
      return this.sortInstanceNodePosition(this.current, other.current);
    }
    updateFeatures() {
      let key = "animation";
      for (key in featureDefinitions) {
        const featureDefinition = featureDefinitions[key];
        if (!featureDefinition)
          continue;
        const { isEnabled, Feature: FeatureConstructor } = featureDefinition;
        if (!this.features[key] && FeatureConstructor && isEnabled(this.props)) {
          this.features[key] = new FeatureConstructor(this);
        }
        if (this.features[key]) {
          const feature = this.features[key];
          if (feature.isMounted) {
            feature.update();
          } else {
            feature.mount();
            feature.isMounted = true;
          }
        }
      }
    }
    triggerBuild() {
      this.build(this.renderState, this.latestValues, this.props);
    }
    /**
     * Measure the current viewport box with or without transforms.
     * Only measures axis-aligned boxes, rotate and skew must be manually
     * removed with a re-render to work.
     */
    measureViewportBox() {
      return this.current ? this.measureInstanceViewportBox(this.current, this.props) : createBox();
    }
    getStaticValue(key) {
      return this.latestValues[key];
    }
    setStaticValue(key, value) {
      this.latestValues[key] = value;
    }
    /**
     * Update the provided props. Ensure any newly-added motion values are
     * added to our map, old ones removed, and listeners updated.
     */
    update(props, presenceContext) {
      if (props.transformTemplate || this.props.transformTemplate) {
        this.scheduleRender();
      }
      this.prevProps = this.props;
      this.props = props;
      this.prevPresenceContext = this.presenceContext;
      this.presenceContext = presenceContext;
      for (let i = 0; i < propEventHandlers.length; i++) {
        const key = propEventHandlers[i];
        if (this.propEventSubscriptions[key]) {
          this.propEventSubscriptions[key]();
          delete this.propEventSubscriptions[key];
        }
        const listenerName = "on" + key;
        const listener = props[listenerName];
        if (listener) {
          this.propEventSubscriptions[key] = this.on(key, listener);
        }
      }
      this.prevMotionValues = updateMotionValuesFromProps(this, this.scrapeMotionValuesFromProps(props, this.prevProps, this), this.prevMotionValues);
      if (this.handleChildMotionValue) {
        this.handleChildMotionValue();
      }
      this.onUpdate && this.onUpdate(this);
    }
    getProps() {
      return this.props;
    }
    /**
     * Returns the variant definition with a given name.
     */
    getVariant(name) {
      return this.props.variants ? this.props.variants[name] : void 0;
    }
    /**
     * Returns the defined default transition on this component.
     */
    getDefaultTransition() {
      return this.props.transition;
    }
    getTransformPagePoint() {
      return this.props.transformPagePoint;
    }
    getClosestVariantNode() {
      return this.isVariantNode ? this : this.parent ? this.parent.getClosestVariantNode() : void 0;
    }
    /**
     * Add a child visual element to our set of children.
     */
    addVariantChild(child) {
      const closestVariantNode = this.getClosestVariantNode();
      if (closestVariantNode) {
        closestVariantNode.variantChildren && closestVariantNode.variantChildren.add(child);
        return () => closestVariantNode.variantChildren.delete(child);
      }
    }
    /**
     * Add a motion value and bind it to this visual element.
     */
    addValue(key, value) {
      const existingValue = this.values.get(key);
      if (value !== existingValue) {
        if (existingValue)
          this.removeValue(key);
        this.bindToMotionValue(key, value);
        this.values.set(key, value);
        this.latestValues[key] = value.get();
      }
    }
    /**
     * Remove a motion value and unbind any active subscriptions.
     */
    removeValue(key) {
      this.values.delete(key);
      const unsubscribe = this.valueSubscriptions.get(key);
      if (unsubscribe) {
        unsubscribe();
        this.valueSubscriptions.delete(key);
      }
      delete this.latestValues[key];
      this.removeValueFromRenderState(key, this.renderState);
    }
    /**
     * Check whether we have a motion value for this key
     */
    hasValue(key) {
      return this.values.has(key);
    }
    getValue(key, defaultValue) {
      if (this.props.values && this.props.values[key]) {
        return this.props.values[key];
      }
      let value = this.values.get(key);
      if (value === void 0 && defaultValue !== void 0) {
        value = motionValue(defaultValue === null ? void 0 : defaultValue, { owner: this });
        this.addValue(key, value);
      }
      return value;
    }
    /**
     * If we're trying to animate to a previously unencountered value,
     * we need to check for it in our state and as a last resort read it
     * directly from the instance (which might have performance implications).
     */
    readValue(key, target) {
      var _a;
      let value = this.latestValues[key] !== void 0 || !this.current ? this.latestValues[key] : (_a = this.getBaseTargetFromProps(this.props, key)) !== null && _a !== void 0 ? _a : this.readValueFromInstance(this.current, key, this.options);
      if (value !== void 0 && value !== null) {
        if (typeof value === "string" && (isNumericalString(value) || isZeroValueString(value))) {
          value = parseFloat(value);
        } else if (!findValueType(value) && complex.test(target)) {
          value = getAnimatableNone2(key, target);
        }
        this.setBaseTarget(key, isMotionValue(value) ? value.get() : value);
      }
      return isMotionValue(value) ? value.get() : value;
    }
    /**
     * Set the base target to later animate back to. This is currently
     * only hydrated on creation and when we first read a value.
     */
    setBaseTarget(key, value) {
      this.baseTarget[key] = value;
    }
    /**
     * Find the base target for a value thats been removed from all animation
     * props.
     */
    getBaseTarget(key) {
      var _a;
      const { initial } = this.props;
      let valueFromInitial;
      if (typeof initial === "string" || typeof initial === "object") {
        const variant = resolveVariantFromProps(this.props, initial, (_a = this.presenceContext) === null || _a === void 0 ? void 0 : _a.custom);
        if (variant) {
          valueFromInitial = variant[key];
        }
      }
      if (initial && valueFromInitial !== void 0) {
        return valueFromInitial;
      }
      const target = this.getBaseTargetFromProps(this.props, key);
      if (target !== void 0 && !isMotionValue(target))
        return target;
      return this.initialValues[key] !== void 0 && valueFromInitial === void 0 ? void 0 : this.baseTarget[key];
    }
    on(eventName, callback) {
      if (!this.events[eventName]) {
        this.events[eventName] = new SubscriptionManager();
      }
      return this.events[eventName].add(callback);
    }
    notify(eventName, ...args) {
      if (this.events[eventName]) {
        this.events[eventName].notify(...args);
      }
    }
  };

  // ../../../node_modules/framer-motion/dist/es/render/dom/DOMVisualElement.mjs
  var DOMVisualElement = class extends VisualElement {
    constructor() {
      super(...arguments);
      this.KeyframeResolver = DOMKeyframesResolver;
    }
    sortInstanceNodePosition(a, b) {
      return a.compareDocumentPosition(b) & 2 ? 1 : -1;
    }
    getBaseTargetFromProps(props, key) {
      return props.style ? props.style[key] : void 0;
    }
    removeValueFromRenderState(key, { vars, style }) {
      delete vars[key];
      delete style[key];
    }
    handleChildMotionValue() {
      if (this.childSubscription) {
        this.childSubscription();
        delete this.childSubscription;
      }
      const { children } = this.props;
      if (isMotionValue(children)) {
        this.childSubscription = children.on("change", (latest) => {
          if (this.current) {
            this.current.textContent = `${latest}`;
          }
        });
      }
    }
  };

  // ../../../node_modules/framer-motion/dist/es/render/html/HTMLVisualElement.mjs
  function getComputedStyle(element) {
    return window.getComputedStyle(element);
  }
  var HTMLVisualElement = class extends DOMVisualElement {
    constructor() {
      super(...arguments);
      this.type = "html";
      this.renderInstance = renderHTML;
    }
    readValueFromInstance(instance, key) {
      if (transformProps.has(key)) {
        const defaultType = getDefaultValueType(key);
        return defaultType ? defaultType.default || 0 : 0;
      } else {
        const computedStyle = getComputedStyle(instance);
        const value = (isCSSVariableName(key) ? computedStyle.getPropertyValue(key) : computedStyle[key]) || 0;
        return typeof value === "string" ? value.trim() : value;
      }
    }
    measureInstanceViewportBox(instance, { transformPagePoint }) {
      return measureViewportBox(instance, transformPagePoint);
    }
    build(renderState, latestValues, props) {
      buildHTMLStyles(renderState, latestValues, props.transformTemplate);
    }
    scrapeMotionValuesFromProps(props, prevProps, visualElement) {
      return scrapeMotionValuesFromProps(props, prevProps, visualElement);
    }
  };

  // ../../../node_modules/framer-motion/dist/es/render/svg/SVGVisualElement.mjs
  var SVGVisualElement = class extends DOMVisualElement {
    constructor() {
      super(...arguments);
      this.type = "svg";
      this.isSVGTag = false;
      this.measureInstanceViewportBox = createBox;
    }
    getBaseTargetFromProps(props, key) {
      return props[key];
    }
    readValueFromInstance(instance, key) {
      if (transformProps.has(key)) {
        const defaultType = getDefaultValueType(key);
        return defaultType ? defaultType.default || 0 : 0;
      }
      key = !camelCaseAttributes.has(key) ? camelToDash(key) : key;
      return instance.getAttribute(key);
    }
    scrapeMotionValuesFromProps(props, prevProps, visualElement) {
      return scrapeMotionValuesFromProps2(props, prevProps, visualElement);
    }
    build(renderState, latestValues, props) {
      buildSVGAttrs(renderState, latestValues, this.isSVGTag, props.transformTemplate);
    }
    renderInstance(instance, renderState, styleProp, projection) {
      renderSVG(instance, renderState, styleProp, projection);
    }
    mount(instance) {
      this.isSVGTag = isSVGTag(instance.tagName);
      super.mount(instance);
    }
  };

  // ../../../node_modules/framer-motion/dist/es/render/dom/create-visual-element.mjs
  var createDomVisualElement = (Component2, options) => {
    return isSVGComponent(Component2) ? new SVGVisualElement(options) : new HTMLVisualElement(options, {
      allowProjection: Component2 !== Fragment
    });
  };

  // ../../../node_modules/framer-motion/dist/es/render/components/motion/create.mjs
  var createMotionComponent = /* @__PURE__ */ createMotionComponentFactory({
    ...animations,
    ...gestureAnimations,
    ...drag,
    ...layout
  }, createDomVisualElement);

  // ../../../node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs
  var motion = /* @__PURE__ */ createDOMMotionComponentProxy(createMotionComponent);

  // ../../../node_modules/clsx/dist/clsx.mjs
  function r(e) {
    var t, f, n = "";
    if ("string" == typeof e || "number" == typeof e) n += e;
    else if ("object" == typeof e) if (Array.isArray(e)) {
      var o = e.length;
      for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
    } else for (f in e) e[f] && (n && (n += " "), n += f);
    return n;
  }
  function clsx() {
    for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
    return n;
  }

  // ../../../node_modules/tailwind-merge/dist/bundle-mjs.mjs
  var CLASS_PART_SEPARATOR = "-";
  var createClassGroupUtils = (config) => {
    const classMap = createClassMap(config);
    const {
      conflictingClassGroups,
      conflictingClassGroupModifiers
    } = config;
    const getClassGroupId = (className) => {
      const classParts = className.split(CLASS_PART_SEPARATOR);
      if (classParts[0] === "" && classParts.length !== 1) {
        classParts.shift();
      }
      return getGroupRecursive(classParts, classMap) || getGroupIdForArbitraryProperty(className);
    };
    const getConflictingClassGroupIds = (classGroupId, hasPostfixModifier) => {
      const conflicts = conflictingClassGroups[classGroupId] || [];
      if (hasPostfixModifier && conflictingClassGroupModifiers[classGroupId]) {
        return [...conflicts, ...conflictingClassGroupModifiers[classGroupId]];
      }
      return conflicts;
    };
    return {
      getClassGroupId,
      getConflictingClassGroupIds
    };
  };
  var getGroupRecursive = (classParts, classPartObject) => {
    if (classParts.length === 0) {
      return classPartObject.classGroupId;
    }
    const currentClassPart = classParts[0];
    const nextClassPartObject = classPartObject.nextPart.get(currentClassPart);
    const classGroupFromNextClassPart = nextClassPartObject ? getGroupRecursive(classParts.slice(1), nextClassPartObject) : void 0;
    if (classGroupFromNextClassPart) {
      return classGroupFromNextClassPart;
    }
    if (classPartObject.validators.length === 0) {
      return void 0;
    }
    const classRest = classParts.join(CLASS_PART_SEPARATOR);
    return classPartObject.validators.find(({
      validator
    }) => validator(classRest))?.classGroupId;
  };
  var arbitraryPropertyRegex = /^\[(.+)\]$/;
  var getGroupIdForArbitraryProperty = (className) => {
    if (arbitraryPropertyRegex.test(className)) {
      const arbitraryPropertyClassName = arbitraryPropertyRegex.exec(className)[1];
      const property = arbitraryPropertyClassName?.substring(0, arbitraryPropertyClassName.indexOf(":"));
      if (property) {
        return "arbitrary.." + property;
      }
    }
  };
  var createClassMap = (config) => {
    const {
      theme: theme2,
      prefix
    } = config;
    const classMap = {
      nextPart: /* @__PURE__ */ new Map(),
      validators: []
    };
    const prefixedClassGroupEntries = getPrefixedClassGroupEntries(Object.entries(config.classGroups), prefix);
    prefixedClassGroupEntries.forEach(([classGroupId, classGroup]) => {
      processClassesRecursively(classGroup, classMap, classGroupId, theme2);
    });
    return classMap;
  };
  var processClassesRecursively = (classGroup, classPartObject, classGroupId, theme2) => {
    classGroup.forEach((classDefinition) => {
      if (typeof classDefinition === "string") {
        const classPartObjectToEdit = classDefinition === "" ? classPartObject : getPart(classPartObject, classDefinition);
        classPartObjectToEdit.classGroupId = classGroupId;
        return;
      }
      if (typeof classDefinition === "function") {
        if (isThemeGetter(classDefinition)) {
          processClassesRecursively(classDefinition(theme2), classPartObject, classGroupId, theme2);
          return;
        }
        classPartObject.validators.push({
          validator: classDefinition,
          classGroupId
        });
        return;
      }
      Object.entries(classDefinition).forEach(([key, classGroup2]) => {
        processClassesRecursively(classGroup2, getPart(classPartObject, key), classGroupId, theme2);
      });
    });
  };
  var getPart = (classPartObject, path) => {
    let currentClassPartObject = classPartObject;
    path.split(CLASS_PART_SEPARATOR).forEach((pathPart) => {
      if (!currentClassPartObject.nextPart.has(pathPart)) {
        currentClassPartObject.nextPart.set(pathPart, {
          nextPart: /* @__PURE__ */ new Map(),
          validators: []
        });
      }
      currentClassPartObject = currentClassPartObject.nextPart.get(pathPart);
    });
    return currentClassPartObject;
  };
  var isThemeGetter = (func) => func.isThemeGetter;
  var getPrefixedClassGroupEntries = (classGroupEntries, prefix) => {
    if (!prefix) {
      return classGroupEntries;
    }
    return classGroupEntries.map(([classGroupId, classGroup]) => {
      const prefixedClassGroup = classGroup.map((classDefinition) => {
        if (typeof classDefinition === "string") {
          return prefix + classDefinition;
        }
        if (typeof classDefinition === "object") {
          return Object.fromEntries(Object.entries(classDefinition).map(([key, value]) => [prefix + key, value]));
        }
        return classDefinition;
      });
      return [classGroupId, prefixedClassGroup];
    });
  };
  var createLruCache = (maxCacheSize) => {
    if (maxCacheSize < 1) {
      return {
        get: () => void 0,
        set: () => {
        }
      };
    }
    let cacheSize = 0;
    let cache = /* @__PURE__ */ new Map();
    let previousCache = /* @__PURE__ */ new Map();
    const update = (key, value) => {
      cache.set(key, value);
      cacheSize++;
      if (cacheSize > maxCacheSize) {
        cacheSize = 0;
        previousCache = cache;
        cache = /* @__PURE__ */ new Map();
      }
    };
    return {
      get(key) {
        let value = cache.get(key);
        if (value !== void 0) {
          return value;
        }
        if ((value = previousCache.get(key)) !== void 0) {
          update(key, value);
          return value;
        }
      },
      set(key, value) {
        if (cache.has(key)) {
          cache.set(key, value);
        } else {
          update(key, value);
        }
      }
    };
  };
  var IMPORTANT_MODIFIER = "!";
  var createParseClassName = (config) => {
    const {
      separator,
      experimentalParseClassName
    } = config;
    const isSeparatorSingleCharacter = separator.length === 1;
    const firstSeparatorCharacter = separator[0];
    const separatorLength = separator.length;
    const parseClassName = (className) => {
      const modifiers = [];
      let bracketDepth = 0;
      let modifierStart = 0;
      let postfixModifierPosition;
      for (let index = 0; index < className.length; index++) {
        let currentCharacter = className[index];
        if (bracketDepth === 0) {
          if (currentCharacter === firstSeparatorCharacter && (isSeparatorSingleCharacter || className.slice(index, index + separatorLength) === separator)) {
            modifiers.push(className.slice(modifierStart, index));
            modifierStart = index + separatorLength;
            continue;
          }
          if (currentCharacter === "/") {
            postfixModifierPosition = index;
            continue;
          }
        }
        if (currentCharacter === "[") {
          bracketDepth++;
        } else if (currentCharacter === "]") {
          bracketDepth--;
        }
      }
      const baseClassNameWithImportantModifier = modifiers.length === 0 ? className : className.substring(modifierStart);
      const hasImportantModifier = baseClassNameWithImportantModifier.startsWith(IMPORTANT_MODIFIER);
      const baseClassName = hasImportantModifier ? baseClassNameWithImportantModifier.substring(1) : baseClassNameWithImportantModifier;
      const maybePostfixModifierPosition = postfixModifierPosition && postfixModifierPosition > modifierStart ? postfixModifierPosition - modifierStart : void 0;
      return {
        modifiers,
        hasImportantModifier,
        baseClassName,
        maybePostfixModifierPosition
      };
    };
    if (experimentalParseClassName) {
      return (className) => experimentalParseClassName({
        className,
        parseClassName
      });
    }
    return parseClassName;
  };
  var sortModifiers = (modifiers) => {
    if (modifiers.length <= 1) {
      return modifiers;
    }
    const sortedModifiers = [];
    let unsortedModifiers = [];
    modifiers.forEach((modifier) => {
      const isArbitraryVariant = modifier[0] === "[";
      if (isArbitraryVariant) {
        sortedModifiers.push(...unsortedModifiers.sort(), modifier);
        unsortedModifiers = [];
      } else {
        unsortedModifiers.push(modifier);
      }
    });
    sortedModifiers.push(...unsortedModifiers.sort());
    return sortedModifiers;
  };
  var createConfigUtils = (config) => ({
    cache: createLruCache(config.cacheSize),
    parseClassName: createParseClassName(config),
    ...createClassGroupUtils(config)
  });
  var SPLIT_CLASSES_REGEX = /\s+/;
  var mergeClassList = (classList, configUtils) => {
    const {
      parseClassName,
      getClassGroupId,
      getConflictingClassGroupIds
    } = configUtils;
    const classGroupsInConflict = [];
    const classNames = classList.trim().split(SPLIT_CLASSES_REGEX);
    let result = "";
    for (let index = classNames.length - 1; index >= 0; index -= 1) {
      const originalClassName = classNames[index];
      const {
        modifiers,
        hasImportantModifier,
        baseClassName,
        maybePostfixModifierPosition
      } = parseClassName(originalClassName);
      let hasPostfixModifier = Boolean(maybePostfixModifierPosition);
      let classGroupId = getClassGroupId(hasPostfixModifier ? baseClassName.substring(0, maybePostfixModifierPosition) : baseClassName);
      if (!classGroupId) {
        if (!hasPostfixModifier) {
          result = originalClassName + (result.length > 0 ? " " + result : result);
          continue;
        }
        classGroupId = getClassGroupId(baseClassName);
        if (!classGroupId) {
          result = originalClassName + (result.length > 0 ? " " + result : result);
          continue;
        }
        hasPostfixModifier = false;
      }
      const variantModifier = sortModifiers(modifiers).join(":");
      const modifierId = hasImportantModifier ? variantModifier + IMPORTANT_MODIFIER : variantModifier;
      const classId = modifierId + classGroupId;
      if (classGroupsInConflict.includes(classId)) {
        continue;
      }
      classGroupsInConflict.push(classId);
      const conflictGroups = getConflictingClassGroupIds(classGroupId, hasPostfixModifier);
      for (let i = 0; i < conflictGroups.length; ++i) {
        const group = conflictGroups[i];
        classGroupsInConflict.push(modifierId + group);
      }
      result = originalClassName + (result.length > 0 ? " " + result : result);
    }
    return result;
  };
  function twJoin() {
    let index = 0;
    let argument;
    let resolvedValue;
    let string = "";
    while (index < arguments.length) {
      if (argument = arguments[index++]) {
        if (resolvedValue = toValue(argument)) {
          string && (string += " ");
          string += resolvedValue;
        }
      }
    }
    return string;
  }
  var toValue = (mix2) => {
    if (typeof mix2 === "string") {
      return mix2;
    }
    let resolvedValue;
    let string = "";
    for (let k = 0; k < mix2.length; k++) {
      if (mix2[k]) {
        if (resolvedValue = toValue(mix2[k])) {
          string && (string += " ");
          string += resolvedValue;
        }
      }
    }
    return string;
  };
  function createTailwindMerge(createConfigFirst, ...createConfigRest) {
    let configUtils;
    let cacheGet;
    let cacheSet;
    let functionToCall = initTailwindMerge;
    function initTailwindMerge(classList) {
      const config = createConfigRest.reduce((previousConfig, createConfigCurrent) => createConfigCurrent(previousConfig), createConfigFirst());
      configUtils = createConfigUtils(config);
      cacheGet = configUtils.cache.get;
      cacheSet = configUtils.cache.set;
      functionToCall = tailwindMerge;
      return tailwindMerge(classList);
    }
    function tailwindMerge(classList) {
      const cachedResult = cacheGet(classList);
      if (cachedResult) {
        return cachedResult;
      }
      const result = mergeClassList(classList, configUtils);
      cacheSet(classList, result);
      return result;
    }
    return function callTailwindMerge() {
      return functionToCall(twJoin.apply(null, arguments));
    };
  }
  var fromTheme = (key) => {
    const themeGetter = (theme2) => theme2[key] || [];
    themeGetter.isThemeGetter = true;
    return themeGetter;
  };
  var arbitraryValueRegex = /^\[(?:([a-z-]+):)?(.+)\]$/i;
  var fractionRegex = /^\d+\/\d+$/;
  var stringLengths = /* @__PURE__ */ new Set(["px", "full", "screen"]);
  var tshirtUnitRegex = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/;
  var lengthUnitRegex = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/;
  var colorFunctionRegex = /^(rgba?|hsla?|hwb|(ok)?(lab|lch))\(.+\)$/;
  var shadowRegex = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/;
  var imageRegex = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/;
  var isLength = (value) => isNumber(value) || stringLengths.has(value) || fractionRegex.test(value);
  var isArbitraryLength = (value) => getIsArbitraryValue(value, "length", isLengthOnly);
  var isNumber = (value) => Boolean(value) && !Number.isNaN(Number(value));
  var isArbitraryNumber = (value) => getIsArbitraryValue(value, "number", isNumber);
  var isInteger = (value) => Boolean(value) && Number.isInteger(Number(value));
  var isPercent = (value) => value.endsWith("%") && isNumber(value.slice(0, -1));
  var isArbitraryValue = (value) => arbitraryValueRegex.test(value);
  var isTshirtSize = (value) => tshirtUnitRegex.test(value);
  var sizeLabels = /* @__PURE__ */ new Set(["length", "size", "percentage"]);
  var isArbitrarySize = (value) => getIsArbitraryValue(value, sizeLabels, isNever);
  var isArbitraryPosition = (value) => getIsArbitraryValue(value, "position", isNever);
  var imageLabels = /* @__PURE__ */ new Set(["image", "url"]);
  var isArbitraryImage = (value) => getIsArbitraryValue(value, imageLabels, isImage);
  var isArbitraryShadow = (value) => getIsArbitraryValue(value, "", isShadow);
  var isAny = () => true;
  var getIsArbitraryValue = (value, label, testValue) => {
    const result = arbitraryValueRegex.exec(value);
    if (result) {
      if (result[1]) {
        return typeof label === "string" ? result[1] === label : label.has(result[1]);
      }
      return testValue(result[2]);
    }
    return false;
  };
  var isLengthOnly = (value) => (
    // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
    // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
    // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
    lengthUnitRegex.test(value) && !colorFunctionRegex.test(value)
  );
  var isNever = () => false;
  var isShadow = (value) => shadowRegex.test(value);
  var isImage = (value) => imageRegex.test(value);
  var getDefaultConfig = () => {
    const colors3 = fromTheme("colors");
    const spacing3 = fromTheme("spacing");
    const blur = fromTheme("blur");
    const brightness = fromTheme("brightness");
    const borderColor = fromTheme("borderColor");
    const borderRadius3 = fromTheme("borderRadius");
    const borderSpacing = fromTheme("borderSpacing");
    const borderWidth = fromTheme("borderWidth");
    const contrast = fromTheme("contrast");
    const grayscale = fromTheme("grayscale");
    const hueRotate = fromTheme("hueRotate");
    const invert = fromTheme("invert");
    const gap = fromTheme("gap");
    const gradientColorStops = fromTheme("gradientColorStops");
    const gradientColorStopPositions = fromTheme("gradientColorStopPositions");
    const inset = fromTheme("inset");
    const margin = fromTheme("margin");
    const opacity = fromTheme("opacity");
    const padding = fromTheme("padding");
    const saturate = fromTheme("saturate");
    const scale2 = fromTheme("scale");
    const sepia = fromTheme("sepia");
    const skew = fromTheme("skew");
    const space = fromTheme("space");
    const translate = fromTheme("translate");
    const getOverscroll = () => ["auto", "contain", "none"];
    const getOverflow = () => ["auto", "hidden", "clip", "visible", "scroll"];
    const getSpacingWithAutoAndArbitrary = () => ["auto", isArbitraryValue, spacing3];
    const getSpacingWithArbitrary = () => [isArbitraryValue, spacing3];
    const getLengthWithEmptyAndArbitrary = () => ["", isLength, isArbitraryLength];
    const getNumberWithAutoAndArbitrary = () => ["auto", isNumber, isArbitraryValue];
    const getPositions = () => ["bottom", "center", "left", "left-bottom", "left-top", "right", "right-bottom", "right-top", "top"];
    const getLineStyles = () => ["solid", "dashed", "dotted", "double", "none"];
    const getBlendModes = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"];
    const getAlign = () => ["start", "end", "center", "between", "around", "evenly", "stretch"];
    const getZeroAndEmpty = () => ["", "0", isArbitraryValue];
    const getBreaks = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"];
    const getNumberAndArbitrary = () => [isNumber, isArbitraryValue];
    return {
      cacheSize: 500,
      separator: ":",
      theme: {
        colors: [isAny],
        spacing: [isLength, isArbitraryLength],
        blur: ["none", "", isTshirtSize, isArbitraryValue],
        brightness: getNumberAndArbitrary(),
        borderColor: [colors3],
        borderRadius: ["none", "", "full", isTshirtSize, isArbitraryValue],
        borderSpacing: getSpacingWithArbitrary(),
        borderWidth: getLengthWithEmptyAndArbitrary(),
        contrast: getNumberAndArbitrary(),
        grayscale: getZeroAndEmpty(),
        hueRotate: getNumberAndArbitrary(),
        invert: getZeroAndEmpty(),
        gap: getSpacingWithArbitrary(),
        gradientColorStops: [colors3],
        gradientColorStopPositions: [isPercent, isArbitraryLength],
        inset: getSpacingWithAutoAndArbitrary(),
        margin: getSpacingWithAutoAndArbitrary(),
        opacity: getNumberAndArbitrary(),
        padding: getSpacingWithArbitrary(),
        saturate: getNumberAndArbitrary(),
        scale: getNumberAndArbitrary(),
        sepia: getZeroAndEmpty(),
        skew: getNumberAndArbitrary(),
        space: getSpacingWithArbitrary(),
        translate: getSpacingWithArbitrary()
      },
      classGroups: {
        // Layout
        /**
         * Aspect Ratio
         * @see https://tailwindcss.com/docs/aspect-ratio
         */
        aspect: [{
          aspect: ["auto", "square", "video", isArbitraryValue]
        }],
        /**
         * Container
         * @see https://tailwindcss.com/docs/container
         */
        container: ["container"],
        /**
         * Columns
         * @see https://tailwindcss.com/docs/columns
         */
        columns: [{
          columns: [isTshirtSize]
        }],
        /**
         * Break After
         * @see https://tailwindcss.com/docs/break-after
         */
        "break-after": [{
          "break-after": getBreaks()
        }],
        /**
         * Break Before
         * @see https://tailwindcss.com/docs/break-before
         */
        "break-before": [{
          "break-before": getBreaks()
        }],
        /**
         * Break Inside
         * @see https://tailwindcss.com/docs/break-inside
         */
        "break-inside": [{
          "break-inside": ["auto", "avoid", "avoid-page", "avoid-column"]
        }],
        /**
         * Box Decoration Break
         * @see https://tailwindcss.com/docs/box-decoration-break
         */
        "box-decoration": [{
          "box-decoration": ["slice", "clone"]
        }],
        /**
         * Box Sizing
         * @see https://tailwindcss.com/docs/box-sizing
         */
        box: [{
          box: ["border", "content"]
        }],
        /**
         * Display
         * @see https://tailwindcss.com/docs/display
         */
        display: ["block", "inline-block", "inline", "flex", "inline-flex", "table", "inline-table", "table-caption", "table-cell", "table-column", "table-column-group", "table-footer-group", "table-header-group", "table-row-group", "table-row", "flow-root", "grid", "inline-grid", "contents", "list-item", "hidden"],
        /**
         * Floats
         * @see https://tailwindcss.com/docs/float
         */
        float: [{
          float: ["right", "left", "none", "start", "end"]
        }],
        /**
         * Clear
         * @see https://tailwindcss.com/docs/clear
         */
        clear: [{
          clear: ["left", "right", "both", "none", "start", "end"]
        }],
        /**
         * Isolation
         * @see https://tailwindcss.com/docs/isolation
         */
        isolation: ["isolate", "isolation-auto"],
        /**
         * Object Fit
         * @see https://tailwindcss.com/docs/object-fit
         */
        "object-fit": [{
          object: ["contain", "cover", "fill", "none", "scale-down"]
        }],
        /**
         * Object Position
         * @see https://tailwindcss.com/docs/object-position
         */
        "object-position": [{
          object: [...getPositions(), isArbitraryValue]
        }],
        /**
         * Overflow
         * @see https://tailwindcss.com/docs/overflow
         */
        overflow: [{
          overflow: getOverflow()
        }],
        /**
         * Overflow X
         * @see https://tailwindcss.com/docs/overflow
         */
        "overflow-x": [{
          "overflow-x": getOverflow()
        }],
        /**
         * Overflow Y
         * @see https://tailwindcss.com/docs/overflow
         */
        "overflow-y": [{
          "overflow-y": getOverflow()
        }],
        /**
         * Overscroll Behavior
         * @see https://tailwindcss.com/docs/overscroll-behavior
         */
        overscroll: [{
          overscroll: getOverscroll()
        }],
        /**
         * Overscroll Behavior X
         * @see https://tailwindcss.com/docs/overscroll-behavior
         */
        "overscroll-x": [{
          "overscroll-x": getOverscroll()
        }],
        /**
         * Overscroll Behavior Y
         * @see https://tailwindcss.com/docs/overscroll-behavior
         */
        "overscroll-y": [{
          "overscroll-y": getOverscroll()
        }],
        /**
         * Position
         * @see https://tailwindcss.com/docs/position
         */
        position: ["static", "fixed", "absolute", "relative", "sticky"],
        /**
         * Top / Right / Bottom / Left
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        inset: [{
          inset: [inset]
        }],
        /**
         * Right / Left
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        "inset-x": [{
          "inset-x": [inset]
        }],
        /**
         * Top / Bottom
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        "inset-y": [{
          "inset-y": [inset]
        }],
        /**
         * Start
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        start: [{
          start: [inset]
        }],
        /**
         * End
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        end: [{
          end: [inset]
        }],
        /**
         * Top
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        top: [{
          top: [inset]
        }],
        /**
         * Right
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        right: [{
          right: [inset]
        }],
        /**
         * Bottom
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        bottom: [{
          bottom: [inset]
        }],
        /**
         * Left
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        left: [{
          left: [inset]
        }],
        /**
         * Visibility
         * @see https://tailwindcss.com/docs/visibility
         */
        visibility: ["visible", "invisible", "collapse"],
        /**
         * Z-Index
         * @see https://tailwindcss.com/docs/z-index
         */
        z: [{
          z: ["auto", isInteger, isArbitraryValue]
        }],
        // Flexbox and Grid
        /**
         * Flex Basis
         * @see https://tailwindcss.com/docs/flex-basis
         */
        basis: [{
          basis: getSpacingWithAutoAndArbitrary()
        }],
        /**
         * Flex Direction
         * @see https://tailwindcss.com/docs/flex-direction
         */
        "flex-direction": [{
          flex: ["row", "row-reverse", "col", "col-reverse"]
        }],
        /**
         * Flex Wrap
         * @see https://tailwindcss.com/docs/flex-wrap
         */
        "flex-wrap": [{
          flex: ["wrap", "wrap-reverse", "nowrap"]
        }],
        /**
         * Flex
         * @see https://tailwindcss.com/docs/flex
         */
        flex: [{
          flex: ["1", "auto", "initial", "none", isArbitraryValue]
        }],
        /**
         * Flex Grow
         * @see https://tailwindcss.com/docs/flex-grow
         */
        grow: [{
          grow: getZeroAndEmpty()
        }],
        /**
         * Flex Shrink
         * @see https://tailwindcss.com/docs/flex-shrink
         */
        shrink: [{
          shrink: getZeroAndEmpty()
        }],
        /**
         * Order
         * @see https://tailwindcss.com/docs/order
         */
        order: [{
          order: ["first", "last", "none", isInteger, isArbitraryValue]
        }],
        /**
         * Grid Template Columns
         * @see https://tailwindcss.com/docs/grid-template-columns
         */
        "grid-cols": [{
          "grid-cols": [isAny]
        }],
        /**
         * Grid Column Start / End
         * @see https://tailwindcss.com/docs/grid-column
         */
        "col-start-end": [{
          col: ["auto", {
            span: ["full", isInteger, isArbitraryValue]
          }, isArbitraryValue]
        }],
        /**
         * Grid Column Start
         * @see https://tailwindcss.com/docs/grid-column
         */
        "col-start": [{
          "col-start": getNumberWithAutoAndArbitrary()
        }],
        /**
         * Grid Column End
         * @see https://tailwindcss.com/docs/grid-column
         */
        "col-end": [{
          "col-end": getNumberWithAutoAndArbitrary()
        }],
        /**
         * Grid Template Rows
         * @see https://tailwindcss.com/docs/grid-template-rows
         */
        "grid-rows": [{
          "grid-rows": [isAny]
        }],
        /**
         * Grid Row Start / End
         * @see https://tailwindcss.com/docs/grid-row
         */
        "row-start-end": [{
          row: ["auto", {
            span: [isInteger, isArbitraryValue]
          }, isArbitraryValue]
        }],
        /**
         * Grid Row Start
         * @see https://tailwindcss.com/docs/grid-row
         */
        "row-start": [{
          "row-start": getNumberWithAutoAndArbitrary()
        }],
        /**
         * Grid Row End
         * @see https://tailwindcss.com/docs/grid-row
         */
        "row-end": [{
          "row-end": getNumberWithAutoAndArbitrary()
        }],
        /**
         * Grid Auto Flow
         * @see https://tailwindcss.com/docs/grid-auto-flow
         */
        "grid-flow": [{
          "grid-flow": ["row", "col", "dense", "row-dense", "col-dense"]
        }],
        /**
         * Grid Auto Columns
         * @see https://tailwindcss.com/docs/grid-auto-columns
         */
        "auto-cols": [{
          "auto-cols": ["auto", "min", "max", "fr", isArbitraryValue]
        }],
        /**
         * Grid Auto Rows
         * @see https://tailwindcss.com/docs/grid-auto-rows
         */
        "auto-rows": [{
          "auto-rows": ["auto", "min", "max", "fr", isArbitraryValue]
        }],
        /**
         * Gap
         * @see https://tailwindcss.com/docs/gap
         */
        gap: [{
          gap: [gap]
        }],
        /**
         * Gap X
         * @see https://tailwindcss.com/docs/gap
         */
        "gap-x": [{
          "gap-x": [gap]
        }],
        /**
         * Gap Y
         * @see https://tailwindcss.com/docs/gap
         */
        "gap-y": [{
          "gap-y": [gap]
        }],
        /**
         * Justify Content
         * @see https://tailwindcss.com/docs/justify-content
         */
        "justify-content": [{
          justify: ["normal", ...getAlign()]
        }],
        /**
         * Justify Items
         * @see https://tailwindcss.com/docs/justify-items
         */
        "justify-items": [{
          "justify-items": ["start", "end", "center", "stretch"]
        }],
        /**
         * Justify Self
         * @see https://tailwindcss.com/docs/justify-self
         */
        "justify-self": [{
          "justify-self": ["auto", "start", "end", "center", "stretch"]
        }],
        /**
         * Align Content
         * @see https://tailwindcss.com/docs/align-content
         */
        "align-content": [{
          content: ["normal", ...getAlign(), "baseline"]
        }],
        /**
         * Align Items
         * @see https://tailwindcss.com/docs/align-items
         */
        "align-items": [{
          items: ["start", "end", "center", "baseline", "stretch"]
        }],
        /**
         * Align Self
         * @see https://tailwindcss.com/docs/align-self
         */
        "align-self": [{
          self: ["auto", "start", "end", "center", "stretch", "baseline"]
        }],
        /**
         * Place Content
         * @see https://tailwindcss.com/docs/place-content
         */
        "place-content": [{
          "place-content": [...getAlign(), "baseline"]
        }],
        /**
         * Place Items
         * @see https://tailwindcss.com/docs/place-items
         */
        "place-items": [{
          "place-items": ["start", "end", "center", "baseline", "stretch"]
        }],
        /**
         * Place Self
         * @see https://tailwindcss.com/docs/place-self
         */
        "place-self": [{
          "place-self": ["auto", "start", "end", "center", "stretch"]
        }],
        // Spacing
        /**
         * Padding
         * @see https://tailwindcss.com/docs/padding
         */
        p: [{
          p: [padding]
        }],
        /**
         * Padding X
         * @see https://tailwindcss.com/docs/padding
         */
        px: [{
          px: [padding]
        }],
        /**
         * Padding Y
         * @see https://tailwindcss.com/docs/padding
         */
        py: [{
          py: [padding]
        }],
        /**
         * Padding Start
         * @see https://tailwindcss.com/docs/padding
         */
        ps: [{
          ps: [padding]
        }],
        /**
         * Padding End
         * @see https://tailwindcss.com/docs/padding
         */
        pe: [{
          pe: [padding]
        }],
        /**
         * Padding Top
         * @see https://tailwindcss.com/docs/padding
         */
        pt: [{
          pt: [padding]
        }],
        /**
         * Padding Right
         * @see https://tailwindcss.com/docs/padding
         */
        pr: [{
          pr: [padding]
        }],
        /**
         * Padding Bottom
         * @see https://tailwindcss.com/docs/padding
         */
        pb: [{
          pb: [padding]
        }],
        /**
         * Padding Left
         * @see https://tailwindcss.com/docs/padding
         */
        pl: [{
          pl: [padding]
        }],
        /**
         * Margin
         * @see https://tailwindcss.com/docs/margin
         */
        m: [{
          m: [margin]
        }],
        /**
         * Margin X
         * @see https://tailwindcss.com/docs/margin
         */
        mx: [{
          mx: [margin]
        }],
        /**
         * Margin Y
         * @see https://tailwindcss.com/docs/margin
         */
        my: [{
          my: [margin]
        }],
        /**
         * Margin Start
         * @see https://tailwindcss.com/docs/margin
         */
        ms: [{
          ms: [margin]
        }],
        /**
         * Margin End
         * @see https://tailwindcss.com/docs/margin
         */
        me: [{
          me: [margin]
        }],
        /**
         * Margin Top
         * @see https://tailwindcss.com/docs/margin
         */
        mt: [{
          mt: [margin]
        }],
        /**
         * Margin Right
         * @see https://tailwindcss.com/docs/margin
         */
        mr: [{
          mr: [margin]
        }],
        /**
         * Margin Bottom
         * @see https://tailwindcss.com/docs/margin
         */
        mb: [{
          mb: [margin]
        }],
        /**
         * Margin Left
         * @see https://tailwindcss.com/docs/margin
         */
        ml: [{
          ml: [margin]
        }],
        /**
         * Space Between X
         * @see https://tailwindcss.com/docs/space
         */
        "space-x": [{
          "space-x": [space]
        }],
        /**
         * Space Between X Reverse
         * @see https://tailwindcss.com/docs/space
         */
        "space-x-reverse": ["space-x-reverse"],
        /**
         * Space Between Y
         * @see https://tailwindcss.com/docs/space
         */
        "space-y": [{
          "space-y": [space]
        }],
        /**
         * Space Between Y Reverse
         * @see https://tailwindcss.com/docs/space
         */
        "space-y-reverse": ["space-y-reverse"],
        // Sizing
        /**
         * Width
         * @see https://tailwindcss.com/docs/width
         */
        w: [{
          w: ["auto", "min", "max", "fit", "svw", "lvw", "dvw", isArbitraryValue, spacing3]
        }],
        /**
         * Min-Width
         * @see https://tailwindcss.com/docs/min-width
         */
        "min-w": [{
          "min-w": [isArbitraryValue, spacing3, "min", "max", "fit"]
        }],
        /**
         * Max-Width
         * @see https://tailwindcss.com/docs/max-width
         */
        "max-w": [{
          "max-w": [isArbitraryValue, spacing3, "none", "full", "min", "max", "fit", "prose", {
            screen: [isTshirtSize]
          }, isTshirtSize]
        }],
        /**
         * Height
         * @see https://tailwindcss.com/docs/height
         */
        h: [{
          h: [isArbitraryValue, spacing3, "auto", "min", "max", "fit", "svh", "lvh", "dvh"]
        }],
        /**
         * Min-Height
         * @see https://tailwindcss.com/docs/min-height
         */
        "min-h": [{
          "min-h": [isArbitraryValue, spacing3, "min", "max", "fit", "svh", "lvh", "dvh"]
        }],
        /**
         * Max-Height
         * @see https://tailwindcss.com/docs/max-height
         */
        "max-h": [{
          "max-h": [isArbitraryValue, spacing3, "min", "max", "fit", "svh", "lvh", "dvh"]
        }],
        /**
         * Size
         * @see https://tailwindcss.com/docs/size
         */
        size: [{
          size: [isArbitraryValue, spacing3, "auto", "min", "max", "fit"]
        }],
        // Typography
        /**
         * Font Size
         * @see https://tailwindcss.com/docs/font-size
         */
        "font-size": [{
          text: ["base", isTshirtSize, isArbitraryLength]
        }],
        /**
         * Font Smoothing
         * @see https://tailwindcss.com/docs/font-smoothing
         */
        "font-smoothing": ["antialiased", "subpixel-antialiased"],
        /**
         * Font Style
         * @see https://tailwindcss.com/docs/font-style
         */
        "font-style": ["italic", "not-italic"],
        /**
         * Font Weight
         * @see https://tailwindcss.com/docs/font-weight
         */
        "font-weight": [{
          font: ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black", isArbitraryNumber]
        }],
        /**
         * Font Family
         * @see https://tailwindcss.com/docs/font-family
         */
        "font-family": [{
          font: [isAny]
        }],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-normal": ["normal-nums"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-ordinal": ["ordinal"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-slashed-zero": ["slashed-zero"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-figure": ["lining-nums", "oldstyle-nums"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-spacing": ["proportional-nums", "tabular-nums"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-fraction": ["diagonal-fractions", "stacked-fractions"],
        /**
         * Letter Spacing
         * @see https://tailwindcss.com/docs/letter-spacing
         */
        tracking: [{
          tracking: ["tighter", "tight", "normal", "wide", "wider", "widest", isArbitraryValue]
        }],
        /**
         * Line Clamp
         * @see https://tailwindcss.com/docs/line-clamp
         */
        "line-clamp": [{
          "line-clamp": ["none", isNumber, isArbitraryNumber]
        }],
        /**
         * Line Height
         * @see https://tailwindcss.com/docs/line-height
         */
        leading: [{
          leading: ["none", "tight", "snug", "normal", "relaxed", "loose", isLength, isArbitraryValue]
        }],
        /**
         * List Style Image
         * @see https://tailwindcss.com/docs/list-style-image
         */
        "list-image": [{
          "list-image": ["none", isArbitraryValue]
        }],
        /**
         * List Style Type
         * @see https://tailwindcss.com/docs/list-style-type
         */
        "list-style-type": [{
          list: ["none", "disc", "decimal", isArbitraryValue]
        }],
        /**
         * List Style Position
         * @see https://tailwindcss.com/docs/list-style-position
         */
        "list-style-position": [{
          list: ["inside", "outside"]
        }],
        /**
         * Placeholder Color
         * @deprecated since Tailwind CSS v3.0.0
         * @see https://tailwindcss.com/docs/placeholder-color
         */
        "placeholder-color": [{
          placeholder: [colors3]
        }],
        /**
         * Placeholder Opacity
         * @see https://tailwindcss.com/docs/placeholder-opacity
         */
        "placeholder-opacity": [{
          "placeholder-opacity": [opacity]
        }],
        /**
         * Text Alignment
         * @see https://tailwindcss.com/docs/text-align
         */
        "text-alignment": [{
          text: ["left", "center", "right", "justify", "start", "end"]
        }],
        /**
         * Text Color
         * @see https://tailwindcss.com/docs/text-color
         */
        "text-color": [{
          text: [colors3]
        }],
        /**
         * Text Opacity
         * @see https://tailwindcss.com/docs/text-opacity
         */
        "text-opacity": [{
          "text-opacity": [opacity]
        }],
        /**
         * Text Decoration
         * @see https://tailwindcss.com/docs/text-decoration
         */
        "text-decoration": ["underline", "overline", "line-through", "no-underline"],
        /**
         * Text Decoration Style
         * @see https://tailwindcss.com/docs/text-decoration-style
         */
        "text-decoration-style": [{
          decoration: [...getLineStyles(), "wavy"]
        }],
        /**
         * Text Decoration Thickness
         * @see https://tailwindcss.com/docs/text-decoration-thickness
         */
        "text-decoration-thickness": [{
          decoration: ["auto", "from-font", isLength, isArbitraryLength]
        }],
        /**
         * Text Underline Offset
         * @see https://tailwindcss.com/docs/text-underline-offset
         */
        "underline-offset": [{
          "underline-offset": ["auto", isLength, isArbitraryValue]
        }],
        /**
         * Text Decoration Color
         * @see https://tailwindcss.com/docs/text-decoration-color
         */
        "text-decoration-color": [{
          decoration: [colors3]
        }],
        /**
         * Text Transform
         * @see https://tailwindcss.com/docs/text-transform
         */
        "text-transform": ["uppercase", "lowercase", "capitalize", "normal-case"],
        /**
         * Text Overflow
         * @see https://tailwindcss.com/docs/text-overflow
         */
        "text-overflow": ["truncate", "text-ellipsis", "text-clip"],
        /**
         * Text Wrap
         * @see https://tailwindcss.com/docs/text-wrap
         */
        "text-wrap": [{
          text: ["wrap", "nowrap", "balance", "pretty"]
        }],
        /**
         * Text Indent
         * @see https://tailwindcss.com/docs/text-indent
         */
        indent: [{
          indent: getSpacingWithArbitrary()
        }],
        /**
         * Vertical Alignment
         * @see https://tailwindcss.com/docs/vertical-align
         */
        "vertical-align": [{
          align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", isArbitraryValue]
        }],
        /**
         * Whitespace
         * @see https://tailwindcss.com/docs/whitespace
         */
        whitespace: [{
          whitespace: ["normal", "nowrap", "pre", "pre-line", "pre-wrap", "break-spaces"]
        }],
        /**
         * Word Break
         * @see https://tailwindcss.com/docs/word-break
         */
        break: [{
          break: ["normal", "words", "all", "keep"]
        }],
        /**
         * Hyphens
         * @see https://tailwindcss.com/docs/hyphens
         */
        hyphens: [{
          hyphens: ["none", "manual", "auto"]
        }],
        /**
         * Content
         * @see https://tailwindcss.com/docs/content
         */
        content: [{
          content: ["none", isArbitraryValue]
        }],
        // Backgrounds
        /**
         * Background Attachment
         * @see https://tailwindcss.com/docs/background-attachment
         */
        "bg-attachment": [{
          bg: ["fixed", "local", "scroll"]
        }],
        /**
         * Background Clip
         * @see https://tailwindcss.com/docs/background-clip
         */
        "bg-clip": [{
          "bg-clip": ["border", "padding", "content", "text"]
        }],
        /**
         * Background Opacity
         * @deprecated since Tailwind CSS v3.0.0
         * @see https://tailwindcss.com/docs/background-opacity
         */
        "bg-opacity": [{
          "bg-opacity": [opacity]
        }],
        /**
         * Background Origin
         * @see https://tailwindcss.com/docs/background-origin
         */
        "bg-origin": [{
          "bg-origin": ["border", "padding", "content"]
        }],
        /**
         * Background Position
         * @see https://tailwindcss.com/docs/background-position
         */
        "bg-position": [{
          bg: [...getPositions(), isArbitraryPosition]
        }],
        /**
         * Background Repeat
         * @see https://tailwindcss.com/docs/background-repeat
         */
        "bg-repeat": [{
          bg: ["no-repeat", {
            repeat: ["", "x", "y", "round", "space"]
          }]
        }],
        /**
         * Background Size
         * @see https://tailwindcss.com/docs/background-size
         */
        "bg-size": [{
          bg: ["auto", "cover", "contain", isArbitrarySize]
        }],
        /**
         * Background Image
         * @see https://tailwindcss.com/docs/background-image
         */
        "bg-image": [{
          bg: ["none", {
            "gradient-to": ["t", "tr", "r", "br", "b", "bl", "l", "tl"]
          }, isArbitraryImage]
        }],
        /**
         * Background Color
         * @see https://tailwindcss.com/docs/background-color
         */
        "bg-color": [{
          bg: [colors3]
        }],
        /**
         * Gradient Color Stops From Position
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-from-pos": [{
          from: [gradientColorStopPositions]
        }],
        /**
         * Gradient Color Stops Via Position
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-via-pos": [{
          via: [gradientColorStopPositions]
        }],
        /**
         * Gradient Color Stops To Position
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-to-pos": [{
          to: [gradientColorStopPositions]
        }],
        /**
         * Gradient Color Stops From
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-from": [{
          from: [gradientColorStops]
        }],
        /**
         * Gradient Color Stops Via
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-via": [{
          via: [gradientColorStops]
        }],
        /**
         * Gradient Color Stops To
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-to": [{
          to: [gradientColorStops]
        }],
        // Borders
        /**
         * Border Radius
         * @see https://tailwindcss.com/docs/border-radius
         */
        rounded: [{
          rounded: [borderRadius3]
        }],
        /**
         * Border Radius Start
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-s": [{
          "rounded-s": [borderRadius3]
        }],
        /**
         * Border Radius End
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-e": [{
          "rounded-e": [borderRadius3]
        }],
        /**
         * Border Radius Top
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-t": [{
          "rounded-t": [borderRadius3]
        }],
        /**
         * Border Radius Right
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-r": [{
          "rounded-r": [borderRadius3]
        }],
        /**
         * Border Radius Bottom
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-b": [{
          "rounded-b": [borderRadius3]
        }],
        /**
         * Border Radius Left
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-l": [{
          "rounded-l": [borderRadius3]
        }],
        /**
         * Border Radius Start Start
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-ss": [{
          "rounded-ss": [borderRadius3]
        }],
        /**
         * Border Radius Start End
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-se": [{
          "rounded-se": [borderRadius3]
        }],
        /**
         * Border Radius End End
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-ee": [{
          "rounded-ee": [borderRadius3]
        }],
        /**
         * Border Radius End Start
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-es": [{
          "rounded-es": [borderRadius3]
        }],
        /**
         * Border Radius Top Left
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-tl": [{
          "rounded-tl": [borderRadius3]
        }],
        /**
         * Border Radius Top Right
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-tr": [{
          "rounded-tr": [borderRadius3]
        }],
        /**
         * Border Radius Bottom Right
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-br": [{
          "rounded-br": [borderRadius3]
        }],
        /**
         * Border Radius Bottom Left
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-bl": [{
          "rounded-bl": [borderRadius3]
        }],
        /**
         * Border Width
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w": [{
          border: [borderWidth]
        }],
        /**
         * Border Width X
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-x": [{
          "border-x": [borderWidth]
        }],
        /**
         * Border Width Y
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-y": [{
          "border-y": [borderWidth]
        }],
        /**
         * Border Width Start
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-s": [{
          "border-s": [borderWidth]
        }],
        /**
         * Border Width End
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-e": [{
          "border-e": [borderWidth]
        }],
        /**
         * Border Width Top
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-t": [{
          "border-t": [borderWidth]
        }],
        /**
         * Border Width Right
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-r": [{
          "border-r": [borderWidth]
        }],
        /**
         * Border Width Bottom
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-b": [{
          "border-b": [borderWidth]
        }],
        /**
         * Border Width Left
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-l": [{
          "border-l": [borderWidth]
        }],
        /**
         * Border Opacity
         * @see https://tailwindcss.com/docs/border-opacity
         */
        "border-opacity": [{
          "border-opacity": [opacity]
        }],
        /**
         * Border Style
         * @see https://tailwindcss.com/docs/border-style
         */
        "border-style": [{
          border: [...getLineStyles(), "hidden"]
        }],
        /**
         * Divide Width X
         * @see https://tailwindcss.com/docs/divide-width
         */
        "divide-x": [{
          "divide-x": [borderWidth]
        }],
        /**
         * Divide Width X Reverse
         * @see https://tailwindcss.com/docs/divide-width
         */
        "divide-x-reverse": ["divide-x-reverse"],
        /**
         * Divide Width Y
         * @see https://tailwindcss.com/docs/divide-width
         */
        "divide-y": [{
          "divide-y": [borderWidth]
        }],
        /**
         * Divide Width Y Reverse
         * @see https://tailwindcss.com/docs/divide-width
         */
        "divide-y-reverse": ["divide-y-reverse"],
        /**
         * Divide Opacity
         * @see https://tailwindcss.com/docs/divide-opacity
         */
        "divide-opacity": [{
          "divide-opacity": [opacity]
        }],
        /**
         * Divide Style
         * @see https://tailwindcss.com/docs/divide-style
         */
        "divide-style": [{
          divide: getLineStyles()
        }],
        /**
         * Border Color
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color": [{
          border: [borderColor]
        }],
        /**
         * Border Color X
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-x": [{
          "border-x": [borderColor]
        }],
        /**
         * Border Color Y
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-y": [{
          "border-y": [borderColor]
        }],
        /**
         * Border Color S
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-s": [{
          "border-s": [borderColor]
        }],
        /**
         * Border Color E
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-e": [{
          "border-e": [borderColor]
        }],
        /**
         * Border Color Top
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-t": [{
          "border-t": [borderColor]
        }],
        /**
         * Border Color Right
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-r": [{
          "border-r": [borderColor]
        }],
        /**
         * Border Color Bottom
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-b": [{
          "border-b": [borderColor]
        }],
        /**
         * Border Color Left
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-l": [{
          "border-l": [borderColor]
        }],
        /**
         * Divide Color
         * @see https://tailwindcss.com/docs/divide-color
         */
        "divide-color": [{
          divide: [borderColor]
        }],
        /**
         * Outline Style
         * @see https://tailwindcss.com/docs/outline-style
         */
        "outline-style": [{
          outline: ["", ...getLineStyles()]
        }],
        /**
         * Outline Offset
         * @see https://tailwindcss.com/docs/outline-offset
         */
        "outline-offset": [{
          "outline-offset": [isLength, isArbitraryValue]
        }],
        /**
         * Outline Width
         * @see https://tailwindcss.com/docs/outline-width
         */
        "outline-w": [{
          outline: [isLength, isArbitraryLength]
        }],
        /**
         * Outline Color
         * @see https://tailwindcss.com/docs/outline-color
         */
        "outline-color": [{
          outline: [colors3]
        }],
        /**
         * Ring Width
         * @see https://tailwindcss.com/docs/ring-width
         */
        "ring-w": [{
          ring: getLengthWithEmptyAndArbitrary()
        }],
        /**
         * Ring Width Inset
         * @see https://tailwindcss.com/docs/ring-width
         */
        "ring-w-inset": ["ring-inset"],
        /**
         * Ring Color
         * @see https://tailwindcss.com/docs/ring-color
         */
        "ring-color": [{
          ring: [colors3]
        }],
        /**
         * Ring Opacity
         * @see https://tailwindcss.com/docs/ring-opacity
         */
        "ring-opacity": [{
          "ring-opacity": [opacity]
        }],
        /**
         * Ring Offset Width
         * @see https://tailwindcss.com/docs/ring-offset-width
         */
        "ring-offset-w": [{
          "ring-offset": [isLength, isArbitraryLength]
        }],
        /**
         * Ring Offset Color
         * @see https://tailwindcss.com/docs/ring-offset-color
         */
        "ring-offset-color": [{
          "ring-offset": [colors3]
        }],
        // Effects
        /**
         * Box Shadow
         * @see https://tailwindcss.com/docs/box-shadow
         */
        shadow: [{
          shadow: ["", "inner", "none", isTshirtSize, isArbitraryShadow]
        }],
        /**
         * Box Shadow Color
         * @see https://tailwindcss.com/docs/box-shadow-color
         */
        "shadow-color": [{
          shadow: [isAny]
        }],
        /**
         * Opacity
         * @see https://tailwindcss.com/docs/opacity
         */
        opacity: [{
          opacity: [opacity]
        }],
        /**
         * Mix Blend Mode
         * @see https://tailwindcss.com/docs/mix-blend-mode
         */
        "mix-blend": [{
          "mix-blend": [...getBlendModes(), "plus-lighter", "plus-darker"]
        }],
        /**
         * Background Blend Mode
         * @see https://tailwindcss.com/docs/background-blend-mode
         */
        "bg-blend": [{
          "bg-blend": getBlendModes()
        }],
        // Filters
        /**
         * Filter
         * @deprecated since Tailwind CSS v3.0.0
         * @see https://tailwindcss.com/docs/filter
         */
        filter: [{
          filter: ["", "none"]
        }],
        /**
         * Blur
         * @see https://tailwindcss.com/docs/blur
         */
        blur: [{
          blur: [blur]
        }],
        /**
         * Brightness
         * @see https://tailwindcss.com/docs/brightness
         */
        brightness: [{
          brightness: [brightness]
        }],
        /**
         * Contrast
         * @see https://tailwindcss.com/docs/contrast
         */
        contrast: [{
          contrast: [contrast]
        }],
        /**
         * Drop Shadow
         * @see https://tailwindcss.com/docs/drop-shadow
         */
        "drop-shadow": [{
          "drop-shadow": ["", "none", isTshirtSize, isArbitraryValue]
        }],
        /**
         * Grayscale
         * @see https://tailwindcss.com/docs/grayscale
         */
        grayscale: [{
          grayscale: [grayscale]
        }],
        /**
         * Hue Rotate
         * @see https://tailwindcss.com/docs/hue-rotate
         */
        "hue-rotate": [{
          "hue-rotate": [hueRotate]
        }],
        /**
         * Invert
         * @see https://tailwindcss.com/docs/invert
         */
        invert: [{
          invert: [invert]
        }],
        /**
         * Saturate
         * @see https://tailwindcss.com/docs/saturate
         */
        saturate: [{
          saturate: [saturate]
        }],
        /**
         * Sepia
         * @see https://tailwindcss.com/docs/sepia
         */
        sepia: [{
          sepia: [sepia]
        }],
        /**
         * Backdrop Filter
         * @deprecated since Tailwind CSS v3.0.0
         * @see https://tailwindcss.com/docs/backdrop-filter
         */
        "backdrop-filter": [{
          "backdrop-filter": ["", "none"]
        }],
        /**
         * Backdrop Blur
         * @see https://tailwindcss.com/docs/backdrop-blur
         */
        "backdrop-blur": [{
          "backdrop-blur": [blur]
        }],
        /**
         * Backdrop Brightness
         * @see https://tailwindcss.com/docs/backdrop-brightness
         */
        "backdrop-brightness": [{
          "backdrop-brightness": [brightness]
        }],
        /**
         * Backdrop Contrast
         * @see https://tailwindcss.com/docs/backdrop-contrast
         */
        "backdrop-contrast": [{
          "backdrop-contrast": [contrast]
        }],
        /**
         * Backdrop Grayscale
         * @see https://tailwindcss.com/docs/backdrop-grayscale
         */
        "backdrop-grayscale": [{
          "backdrop-grayscale": [grayscale]
        }],
        /**
         * Backdrop Hue Rotate
         * @see https://tailwindcss.com/docs/backdrop-hue-rotate
         */
        "backdrop-hue-rotate": [{
          "backdrop-hue-rotate": [hueRotate]
        }],
        /**
         * Backdrop Invert
         * @see https://tailwindcss.com/docs/backdrop-invert
         */
        "backdrop-invert": [{
          "backdrop-invert": [invert]
        }],
        /**
         * Backdrop Opacity
         * @see https://tailwindcss.com/docs/backdrop-opacity
         */
        "backdrop-opacity": [{
          "backdrop-opacity": [opacity]
        }],
        /**
         * Backdrop Saturate
         * @see https://tailwindcss.com/docs/backdrop-saturate
         */
        "backdrop-saturate": [{
          "backdrop-saturate": [saturate]
        }],
        /**
         * Backdrop Sepia
         * @see https://tailwindcss.com/docs/backdrop-sepia
         */
        "backdrop-sepia": [{
          "backdrop-sepia": [sepia]
        }],
        // Tables
        /**
         * Border Collapse
         * @see https://tailwindcss.com/docs/border-collapse
         */
        "border-collapse": [{
          border: ["collapse", "separate"]
        }],
        /**
         * Border Spacing
         * @see https://tailwindcss.com/docs/border-spacing
         */
        "border-spacing": [{
          "border-spacing": [borderSpacing]
        }],
        /**
         * Border Spacing X
         * @see https://tailwindcss.com/docs/border-spacing
         */
        "border-spacing-x": [{
          "border-spacing-x": [borderSpacing]
        }],
        /**
         * Border Spacing Y
         * @see https://tailwindcss.com/docs/border-spacing
         */
        "border-spacing-y": [{
          "border-spacing-y": [borderSpacing]
        }],
        /**
         * Table Layout
         * @see https://tailwindcss.com/docs/table-layout
         */
        "table-layout": [{
          table: ["auto", "fixed"]
        }],
        /**
         * Caption Side
         * @see https://tailwindcss.com/docs/caption-side
         */
        caption: [{
          caption: ["top", "bottom"]
        }],
        // Transitions and Animation
        /**
         * Tranisition Property
         * @see https://tailwindcss.com/docs/transition-property
         */
        transition: [{
          transition: ["none", "all", "", "colors", "opacity", "shadow", "transform", isArbitraryValue]
        }],
        /**
         * Transition Duration
         * @see https://tailwindcss.com/docs/transition-duration
         */
        duration: [{
          duration: getNumberAndArbitrary()
        }],
        /**
         * Transition Timing Function
         * @see https://tailwindcss.com/docs/transition-timing-function
         */
        ease: [{
          ease: ["linear", "in", "out", "in-out", isArbitraryValue]
        }],
        /**
         * Transition Delay
         * @see https://tailwindcss.com/docs/transition-delay
         */
        delay: [{
          delay: getNumberAndArbitrary()
        }],
        /**
         * Animation
         * @see https://tailwindcss.com/docs/animation
         */
        animate: [{
          animate: ["none", "spin", "ping", "pulse", "bounce", isArbitraryValue]
        }],
        // Transforms
        /**
         * Transform
         * @see https://tailwindcss.com/docs/transform
         */
        transform: [{
          transform: ["", "gpu", "none"]
        }],
        /**
         * Scale
         * @see https://tailwindcss.com/docs/scale
         */
        scale: [{
          scale: [scale2]
        }],
        /**
         * Scale X
         * @see https://tailwindcss.com/docs/scale
         */
        "scale-x": [{
          "scale-x": [scale2]
        }],
        /**
         * Scale Y
         * @see https://tailwindcss.com/docs/scale
         */
        "scale-y": [{
          "scale-y": [scale2]
        }],
        /**
         * Rotate
         * @see https://tailwindcss.com/docs/rotate
         */
        rotate: [{
          rotate: [isInteger, isArbitraryValue]
        }],
        /**
         * Translate X
         * @see https://tailwindcss.com/docs/translate
         */
        "translate-x": [{
          "translate-x": [translate]
        }],
        /**
         * Translate Y
         * @see https://tailwindcss.com/docs/translate
         */
        "translate-y": [{
          "translate-y": [translate]
        }],
        /**
         * Skew X
         * @see https://tailwindcss.com/docs/skew
         */
        "skew-x": [{
          "skew-x": [skew]
        }],
        /**
         * Skew Y
         * @see https://tailwindcss.com/docs/skew
         */
        "skew-y": [{
          "skew-y": [skew]
        }],
        /**
         * Transform Origin
         * @see https://tailwindcss.com/docs/transform-origin
         */
        "transform-origin": [{
          origin: ["center", "top", "top-right", "right", "bottom-right", "bottom", "bottom-left", "left", "top-left", isArbitraryValue]
        }],
        // Interactivity
        /**
         * Accent Color
         * @see https://tailwindcss.com/docs/accent-color
         */
        accent: [{
          accent: ["auto", colors3]
        }],
        /**
         * Appearance
         * @see https://tailwindcss.com/docs/appearance
         */
        appearance: [{
          appearance: ["none", "auto"]
        }],
        /**
         * Cursor
         * @see https://tailwindcss.com/docs/cursor
         */
        cursor: [{
          cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", isArbitraryValue]
        }],
        /**
         * Caret Color
         * @see https://tailwindcss.com/docs/just-in-time-mode#caret-color-utilities
         */
        "caret-color": [{
          caret: [colors3]
        }],
        /**
         * Pointer Events
         * @see https://tailwindcss.com/docs/pointer-events
         */
        "pointer-events": [{
          "pointer-events": ["none", "auto"]
        }],
        /**
         * Resize
         * @see https://tailwindcss.com/docs/resize
         */
        resize: [{
          resize: ["none", "y", "x", ""]
        }],
        /**
         * Scroll Behavior
         * @see https://tailwindcss.com/docs/scroll-behavior
         */
        "scroll-behavior": [{
          scroll: ["auto", "smooth"]
        }],
        /**
         * Scroll Margin
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-m": [{
          "scroll-m": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin X
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mx": [{
          "scroll-mx": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Y
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-my": [{
          "scroll-my": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Start
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-ms": [{
          "scroll-ms": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin End
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-me": [{
          "scroll-me": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Top
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mt": [{
          "scroll-mt": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Right
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mr": [{
          "scroll-mr": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Bottom
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mb": [{
          "scroll-mb": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Left
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-ml": [{
          "scroll-ml": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-p": [{
          "scroll-p": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding X
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-px": [{
          "scroll-px": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Y
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-py": [{
          "scroll-py": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Start
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-ps": [{
          "scroll-ps": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding End
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pe": [{
          "scroll-pe": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Top
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pt": [{
          "scroll-pt": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Right
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pr": [{
          "scroll-pr": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Bottom
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pb": [{
          "scroll-pb": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Left
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pl": [{
          "scroll-pl": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Snap Align
         * @see https://tailwindcss.com/docs/scroll-snap-align
         */
        "snap-align": [{
          snap: ["start", "end", "center", "align-none"]
        }],
        /**
         * Scroll Snap Stop
         * @see https://tailwindcss.com/docs/scroll-snap-stop
         */
        "snap-stop": [{
          snap: ["normal", "always"]
        }],
        /**
         * Scroll Snap Type
         * @see https://tailwindcss.com/docs/scroll-snap-type
         */
        "snap-type": [{
          snap: ["none", "x", "y", "both"]
        }],
        /**
         * Scroll Snap Type Strictness
         * @see https://tailwindcss.com/docs/scroll-snap-type
         */
        "snap-strictness": [{
          snap: ["mandatory", "proximity"]
        }],
        /**
         * Touch Action
         * @see https://tailwindcss.com/docs/touch-action
         */
        touch: [{
          touch: ["auto", "none", "manipulation"]
        }],
        /**
         * Touch Action X
         * @see https://tailwindcss.com/docs/touch-action
         */
        "touch-x": [{
          "touch-pan": ["x", "left", "right"]
        }],
        /**
         * Touch Action Y
         * @see https://tailwindcss.com/docs/touch-action
         */
        "touch-y": [{
          "touch-pan": ["y", "up", "down"]
        }],
        /**
         * Touch Action Pinch Zoom
         * @see https://tailwindcss.com/docs/touch-action
         */
        "touch-pz": ["touch-pinch-zoom"],
        /**
         * User Select
         * @see https://tailwindcss.com/docs/user-select
         */
        select: [{
          select: ["none", "text", "all", "auto"]
        }],
        /**
         * Will Change
         * @see https://tailwindcss.com/docs/will-change
         */
        "will-change": [{
          "will-change": ["auto", "scroll", "contents", "transform", isArbitraryValue]
        }],
        // SVG
        /**
         * Fill
         * @see https://tailwindcss.com/docs/fill
         */
        fill: [{
          fill: [colors3, "none"]
        }],
        /**
         * Stroke Width
         * @see https://tailwindcss.com/docs/stroke-width
         */
        "stroke-w": [{
          stroke: [isLength, isArbitraryLength, isArbitraryNumber]
        }],
        /**
         * Stroke
         * @see https://tailwindcss.com/docs/stroke
         */
        stroke: [{
          stroke: [colors3, "none"]
        }],
        // Accessibility
        /**
         * Screen Readers
         * @see https://tailwindcss.com/docs/screen-readers
         */
        sr: ["sr-only", "not-sr-only"],
        /**
         * Forced Color Adjust
         * @see https://tailwindcss.com/docs/forced-color-adjust
         */
        "forced-color-adjust": [{
          "forced-color-adjust": ["auto", "none"]
        }]
      },
      conflictingClassGroups: {
        overflow: ["overflow-x", "overflow-y"],
        overscroll: ["overscroll-x", "overscroll-y"],
        inset: ["inset-x", "inset-y", "start", "end", "top", "right", "bottom", "left"],
        "inset-x": ["right", "left"],
        "inset-y": ["top", "bottom"],
        flex: ["basis", "grow", "shrink"],
        gap: ["gap-x", "gap-y"],
        p: ["px", "py", "ps", "pe", "pt", "pr", "pb", "pl"],
        px: ["pr", "pl"],
        py: ["pt", "pb"],
        m: ["mx", "my", "ms", "me", "mt", "mr", "mb", "ml"],
        mx: ["mr", "ml"],
        my: ["mt", "mb"],
        size: ["w", "h"],
        "font-size": ["leading"],
        "fvn-normal": ["fvn-ordinal", "fvn-slashed-zero", "fvn-figure", "fvn-spacing", "fvn-fraction"],
        "fvn-ordinal": ["fvn-normal"],
        "fvn-slashed-zero": ["fvn-normal"],
        "fvn-figure": ["fvn-normal"],
        "fvn-spacing": ["fvn-normal"],
        "fvn-fraction": ["fvn-normal"],
        "line-clamp": ["display", "overflow"],
        rounded: ["rounded-s", "rounded-e", "rounded-t", "rounded-r", "rounded-b", "rounded-l", "rounded-ss", "rounded-se", "rounded-ee", "rounded-es", "rounded-tl", "rounded-tr", "rounded-br", "rounded-bl"],
        "rounded-s": ["rounded-ss", "rounded-es"],
        "rounded-e": ["rounded-se", "rounded-ee"],
        "rounded-t": ["rounded-tl", "rounded-tr"],
        "rounded-r": ["rounded-tr", "rounded-br"],
        "rounded-b": ["rounded-br", "rounded-bl"],
        "rounded-l": ["rounded-tl", "rounded-bl"],
        "border-spacing": ["border-spacing-x", "border-spacing-y"],
        "border-w": ["border-w-s", "border-w-e", "border-w-t", "border-w-r", "border-w-b", "border-w-l"],
        "border-w-x": ["border-w-r", "border-w-l"],
        "border-w-y": ["border-w-t", "border-w-b"],
        "border-color": ["border-color-s", "border-color-e", "border-color-t", "border-color-r", "border-color-b", "border-color-l"],
        "border-color-x": ["border-color-r", "border-color-l"],
        "border-color-y": ["border-color-t", "border-color-b"],
        "scroll-m": ["scroll-mx", "scroll-my", "scroll-ms", "scroll-me", "scroll-mt", "scroll-mr", "scroll-mb", "scroll-ml"],
        "scroll-mx": ["scroll-mr", "scroll-ml"],
        "scroll-my": ["scroll-mt", "scroll-mb"],
        "scroll-p": ["scroll-px", "scroll-py", "scroll-ps", "scroll-pe", "scroll-pt", "scroll-pr", "scroll-pb", "scroll-pl"],
        "scroll-px": ["scroll-pr", "scroll-pl"],
        "scroll-py": ["scroll-pt", "scroll-pb"],
        touch: ["touch-x", "touch-y", "touch-pz"],
        "touch-x": ["touch"],
        "touch-y": ["touch"],
        "touch-pz": ["touch"]
      },
      conflictingClassGroupModifiers: {
        "font-size": ["leading"]
      }
    };
  };
  var twMerge = /* @__PURE__ */ createTailwindMerge(getDefaultConfig);

  // ../../ui/dist/index.js
  function cn(...inputs) {
    return twMerge(clsx(inputs));
  }
  function prefersReducedMotion2() {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  var variantStyles = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-brand-sm hover:shadow-brand-md",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    outline: "border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-blue-200 hover:text-blue-600",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    destructive: "bg-red-600 text-white hover:bg-red-700"
  };
  var sizeStyles = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-base",
    lg: "h-12 px-6 text-lg"
  };
  var Spinner = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      className: "animate-spin -ml-1 mr-2 h-4 w-4",
      fill: "none",
      viewBox: "0 0 24 24",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ jsx(
          "circle",
          {
            className: "opacity-25",
            cx: "12",
            cy: "12",
            r: "10",
            stroke: "currentColor",
            strokeWidth: "4"
          }
        ),
        /* @__PURE__ */ jsx(
          "path",
          {
            className: "opacity-75",
            fill: "currentColor",
            d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          }
        )
      ]
    }
  );
  var Button = forwardRef(
    ({
      variant = "primary",
      size = "md",
      loading = false,
      className,
      children,
      disabled,
      ...props
    }, ref) => {
      const reducedMotion = prefersReducedMotion2();
      return /* @__PURE__ */ jsxs(
        motion.button,
        {
          ref,
          whileHover: reducedMotion ? void 0 : { scale: 1.02 },
          whileTap: reducedMotion ? void 0 : { scale: 0.98 },
          transition: { duration: 0.15 },
          className: cn(
            // Base styles
            "inline-flex items-center justify-center font-medium rounded-full",
            "transition-all duration-fast",
            // Focus styles
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            // Disabled styles
            "disabled:opacity-50 disabled:pointer-events-none",
            // Variant styles
            variantStyles[variant],
            // Size styles
            sizeStyles[size],
            className
          ),
          disabled: disabled || loading,
          "aria-busy": loading,
          ...props,
          children: [
            loading && /* @__PURE__ */ jsx(Spinner, {}),
            children
          ]
        }
      );
    }
  );
  Button.displayName = "Button";
  var aspectRatioStyles = {
    square: "aspect-square",
    portrait: "aspect-[4/5]",
    landscape: "aspect-video"
  };
  var badgeStyles = {
    NEW: "bg-blue-50 text-blue-600",
    SALE: "bg-red-50 text-red-600",
    HOT: "bg-orange-50 text-orange-600"
  };
  var ProductCard = forwardRef(
    ({
      image,
      title,
      description,
      price,
      originalPrice,
      badge,
      aspectRatio: aspectRatio2 = "portrait",
      currency = "\xA5",
      onAddToCart,
      className,
      ...props
    }, ref) => {
      const reducedMotion = prefersReducedMotion2();
      return /* @__PURE__ */ jsxs(
        motion.div,
        {
          ref,
          initial: reducedMotion ? void 0 : { opacity: 0, y: 20 },
          whileInView: reducedMotion ? void 0 : { opacity: 1, y: 0 },
          viewport: { once: true },
          whileHover: reducedMotion ? void 0 : { y: -8 },
          transition: { duration: 0.3, ease: [0, 0, 0.2, 1] },
          className: cn("group cursor-pointer", className),
          ...props,
          children: [
            /* @__PURE__ */ jsxs(
              "div",
              {
                className: cn(
                  "bg-slate-50 rounded-2xl mb-4 overflow-hidden relative",
                  "shadow-sm transition-all duration-normal",
                  "group-hover:shadow-card-hover",
                  "border border-transparent group-hover:border-blue-100",
                  aspectRatioStyles[aspectRatio2]
                ),
                children: [
                  image ? /* @__PURE__ */ jsx(
                    "img",
                    {
                      src: image,
                      alt: title,
                      className: "w-full h-full object-cover transition-transform duration-slow group-hover:scale-105"
                    }
                  ) : /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-gradient-to-tr from-slate-100 to-white" }),
                  badge && /* @__PURE__ */ jsx(
                    "div",
                    {
                      className: cn(
                        "absolute top-3 right-3",
                        "bg-white/90 backdrop-blur px-2.5 py-1 rounded-full",
                        "text-xs font-bold shadow-sm",
                        badgeStyles[badge]
                      ),
                      children: badge
                    }
                  ),
                  /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-normal" })
                ]
              }
            ),
            /* @__PURE__ */ jsx("h3", { className: "text-base font-semibold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors line-clamp-2", children: title }),
            description && /* @__PURE__ */ jsx("p", { className: "text-slate-500 text-sm mb-2 line-clamp-2", children: description }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mt-2", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsxs("span", { className: "text-lg font-bold text-slate-900", children: [
                  currency,
                  price.toLocaleString()
                ] }),
                originalPrice && /* @__PURE__ */ jsxs("span", { className: "text-sm text-slate-400 line-through", children: [
                  currency,
                  originalPrice.toLocaleString()
                ] })
              ] }),
              onAddToCart && /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: (e) => {
                    e.stopPropagation();
                    onAddToCart();
                  },
                  className: cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    "bg-blue-50 text-blue-600",
                    "hover:bg-blue-600 hover:text-white",
                    "transition-all duration-fast shadow-sm hover:shadow-brand-sm",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  ),
                  "aria-label": `Add ${title} to cart`,
                  children: /* @__PURE__ */ jsx("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4v16m8-8H4" }) })
                }
              )
            ] })
          ]
        }
      );
    }
  );
  ProductCard.displayName = "ProductCard";
  var Input = forwardRef(
    ({
      label,
      error,
      hint,
      prefixIcon,
      suffixIcon,
      className,
      id: id3,
      disabled,
      ...props
    }, ref) => {
      const generatedId = useId();
      const inputId = id3 || generatedId;
      const errorId = `${inputId}-error`;
      const hintId = `${inputId}-hint`;
      const hasError = !!error;
      return /* @__PURE__ */ jsxs("div", { className: "w-full", children: [
        label && /* @__PURE__ */ jsx(
          "label",
          {
            htmlFor: inputId,
            className: "block text-sm font-medium text-slate-700 mb-1.5",
            children: label
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          prefixIcon && /* @__PURE__ */ jsx("div", { className: "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none", children: prefixIcon }),
          /* @__PURE__ */ jsx(
            "input",
            {
              ref,
              id: inputId,
              className: cn(
                // Base styles
                "w-full h-10 px-4 rounded-lg border bg-white",
                "text-slate-900 placeholder:text-slate-400",
                "transition-all duration-fast",
                // Focus styles
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                // Error styles
                hasError ? "border-red-500 focus:ring-red-500" : "border-slate-200 hover:border-slate-300",
                // Disabled styles
                disabled && "bg-slate-50 text-slate-500 cursor-not-allowed",
                // Icon padding
                prefixIcon && "pl-10",
                suffixIcon && "pr-10",
                className
              ),
              disabled,
              "aria-invalid": hasError ? "true" : void 0,
              "aria-describedby": hasError ? errorId : hint ? hintId : void 0,
              ...props
            }
          ),
          suffixIcon && /* @__PURE__ */ jsx("div", { className: "absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none", children: suffixIcon })
        ] }),
        hasError && /* @__PURE__ */ jsxs(
          "p",
          {
            id: errorId,
            className: "mt-1.5 text-sm text-red-600 flex items-center gap-1",
            role: "alert",
            children: [
              /* @__PURE__ */ jsx("svg", { className: "w-4 h-4 flex-shrink-0", fill: "currentColor", viewBox: "0 0 20 20", children: /* @__PURE__ */ jsx(
                "path",
                {
                  fillRule: "evenodd",
                  d: "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z",
                  clipRule: "evenodd"
                }
              ) }),
              error
            ]
          }
        ),
        hint && !hasError && /* @__PURE__ */ jsx("p", { id: hintId, className: "mt-1.5 text-sm text-slate-500", children: hint })
      ] });
    }
  );
  Input.displayName = "Input";
  function Navigation({ logo, items, actions, className }) {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const reducedMotion = prefersReducedMotion2();
    useEffect(() => {
      const handleScroll = () => setScrolled(window.scrollY > 0);
      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => window.removeEventListener("scroll", handleScroll);
    }, []);
    useEffect(() => {
      const handleResize = () => {
        if (window.innerWidth >= 768) {
          setMobileMenuOpen(false);
        }
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);
    return /* @__PURE__ */ jsxs(
      "nav",
      {
        className: cn(
          "sticky top-0 z-50 h-16 bg-white/90 backdrop-blur-md transition-all duration-normal",
          scrolled && "border-b border-slate-100 shadow-sm",
          className
        ),
        children: [
          /* @__PURE__ */ jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between", children: [
            /* @__PURE__ */ jsx("div", { className: "flex-shrink-0", children: logo }),
            /* @__PURE__ */ jsx("div", { className: "hidden md:flex gap-8 text-sm font-medium", children: items.map((item) => /* @__PURE__ */ jsx(
              "a",
              {
                href: item.href,
                className: cn(
                  "transition-colors duration-fast",
                  item.active ? "text-blue-600 font-semibold" : "text-slate-500 hover:text-blue-600"
                ),
                "aria-current": item.active ? "page" : void 0,
                children: item.label
              },
              item.href
            )) }),
            /* @__PURE__ */ jsx("div", { className: "hidden md:flex items-center gap-4", children: actions }),
            /* @__PURE__ */ jsx(
              "button",
              {
                className: cn(
                  "md:hidden p-2 -mr-2 rounded-lg",
                  "text-slate-600 hover:bg-slate-100",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                ),
                onClick: () => setMobileMenuOpen(!mobileMenuOpen),
                "aria-label": mobileMenuOpen ? "Close menu" : "Open menu",
                "aria-expanded": mobileMenuOpen,
                "aria-controls": "mobile-menu",
                children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: mobileMenuOpen ? /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M6 18L18 6M6 6l12 12" }) : /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M4 6h16M4 12h16M4 18h16" }) })
              }
            )
          ] }),
          /* @__PURE__ */ jsx(AnimatePresence, { children: mobileMenuOpen && /* @__PURE__ */ jsx(
            motion.div,
            {
              id: "mobile-menu",
              initial: reducedMotion ? { opacity: 1 } : { opacity: 0, height: 0 },
              animate: reducedMotion ? { opacity: 1 } : { opacity: 1, height: "auto" },
              exit: reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 },
              transition: { duration: 0.2 },
              className: "md:hidden bg-white border-t border-slate-100 overflow-hidden",
              children: /* @__PURE__ */ jsxs("div", { className: "py-4 px-4 sm:px-6 space-y-1", children: [
                items.map((item) => /* @__PURE__ */ jsx(
                  "a",
                  {
                    href: item.href,
                    className: cn(
                      "block py-2.5 px-3 rounded-lg text-base transition-colors",
                      item.active ? "text-blue-600 font-semibold bg-blue-50" : "text-slate-600 hover:bg-slate-50"
                    ),
                    onClick: () => setMobileMenuOpen(false),
                    children: item.label
                  },
                  item.href
                )),
                actions && /* @__PURE__ */ jsx("div", { className: "mt-4 pt-4 border-t border-slate-100", children: actions })
              ] })
            }
          ) })
        ]
      }
    );
  }
  Navigation.displayName = "Navigation";
  var gapStyles = {
    sm: "gap-4",
    md: "gap-6",
    lg: "gap-8"
  };
  function ProductGrid({
    children,
    columns = { sm: 2, md: 3, lg: 4 },
    gap = "md",
    className
  }) {
    const columnClasses = cn(
      "grid-cols-1",
      columns.sm && `sm:grid-cols-${columns.sm}`,
      columns.md && `md:grid-cols-${columns.md}`,
      columns.lg && `lg:grid-cols-${columns.lg}`,
      columns.xl && `xl:grid-cols-${columns.xl}`
    );
    return /* @__PURE__ */ jsx(
      "div",
      {
        className: cn(
          "grid",
          columnClasses,
          gapStyles[gap],
          className
        ),
        children
      }
    );
  }
  ProductGrid.displayName = "ProductGrid";

  // ../default/src/components/NotFound.tsx
  function NotFound({ route, message, onGoHome }) {
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 px-4", children: /* @__PURE__ */ jsxs("div", { className: "text-center max-w-md w-full", children: [
      /* @__PURE__ */ jsx("div", { className: "mb-8", children: /* @__PURE__ */ jsx("h1", { className: "text-7xl sm:text-9xl font-bold text-gray-200 dark:text-slate-700", children: "404" }) }),
      /* @__PURE__ */ jsx("h2", { className: "text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4", children: "Page Not Found" }),
      /* @__PURE__ */ jsx("p", { className: "text-gray-500 dark:text-gray-400 mb-8 text-sm sm:text-base", children: message || `Sorry, we couldn't find the page${route ? ` "${route}"` : ""} you're looking for.` }),
      /* @__PURE__ */ jsxs(Button, { onClick: onGoHome, size: "lg", className: "w-full sm:w-auto", children: [
        /* @__PURE__ */ jsx(House, { className: "h-5 w-5 mr-2" }),
        "Back to Home"
      ] }),
      /* @__PURE__ */ jsx("p", { className: "mt-8 text-sm text-gray-400 dark:text-gray-500", children: "If you believe this is an error, please contact our support team." })
    ] }) });
  }

  // ../default/src/components/OrderCancelledPage.tsx
  function OrderCancelledPage({
    config,
    onReturnToCart,
    onContinueShopping,
    onContactSupport
  }) {
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-gray-50 dark:bg-slate-900", children: /* @__PURE__ */ jsx("div", { className: "container mx-auto px-4 py-12 sm:py-16", children: /* @__PURE__ */ jsxs("div", { className: "max-w-3xl mx-auto text-center", children: [
      /* @__PURE__ */ jsx("div", { className: "mb-8", children: /* @__PURE__ */ jsx("div", { className: "w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 flex items-center justify-center mx-auto shadow-sm", children: /* @__PURE__ */ jsx(CircleX, { className: "h-12 w-12 sm:h-14 sm:w-14 text-yellow-600 dark:text-yellow-400" }) }) }),
      /* @__PURE__ */ jsxs("div", { className: "mb-8 sm:mb-12", children: [
        /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-full mb-4", children: [
          /* @__PURE__ */ jsx("div", { className: "w-2 h-2 bg-yellow-600 dark:bg-yellow-400 rounded-full" }),
          /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-widest", children: "PAYMENT CANCELLED" })
        ] }),
        /* @__PURE__ */ jsx("h1", { className: "text-3xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight", children: "Payment Cancelled" }),
        /* @__PURE__ */ jsx("p", { className: "text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider", children: "NO CHARGES WERE MADE TO YOUR ACCOUNT" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 sm:p-8 mb-6 sm:mb-8", children: /* @__PURE__ */ jsxs("div", { className: "space-y-4 text-left", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800", children: [
          /* @__PURE__ */ jsx("div", { className: "w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0", children: /* @__PURE__ */ jsx(ShoppingCart, { className: "h-5 w-5 text-blue-600 dark:text-blue-400" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider mb-1", children: "CART SAVED" }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-gray-600 dark:text-gray-400", children: "All items remain in your cart and you can complete your purchase anytime" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-100 dark:border-purple-800", children: [
          /* @__PURE__ */ jsx("div", { className: "w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0", children: /* @__PURE__ */ jsx(CircleHelp, { className: "h-5 w-5 text-purple-600 dark:text-purple-400" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider mb-1", children: "NEED HELP?" }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-gray-600 dark:text-gray-400", children: "If you encountered any issues during checkout, please contact our support team" })
          ] })
        ] })
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 sm:p-8 mb-6 sm:mb-8", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-6 justify-center", children: [
          /* @__PURE__ */ jsx("div", { className: "h-4 w-1 bg-blue-600 rounded-full" }),
          /* @__PURE__ */ jsx("h2", { className: "text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest", children: "WHAT HAPPENED" })
        ] }),
        /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-600 dark:text-gray-400 text-left mb-4", children: "You cancelled the payment process before completing your order. This could happen if you:" }),
        /* @__PURE__ */ jsxs("ul", { className: "text-left text-sm text-gray-600 dark:text-gray-400 space-y-2", children: [
          /* @__PURE__ */ jsxs("li", { className: "flex items-start gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-blue-600 dark:text-blue-400 mt-1", children: "\u2022" }),
            /* @__PURE__ */ jsx("span", { children: "Clicked the back button during checkout" })
          ] }),
          /* @__PURE__ */ jsxs("li", { className: "flex items-start gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-blue-600 dark:text-blue-400 mt-1", children: "\u2022" }),
            /* @__PURE__ */ jsx("span", { children: "Closed the payment window" })
          ] }),
          /* @__PURE__ */ jsxs("li", { className: "flex items-start gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-blue-600 dark:text-blue-400 mt-1", children: "\u2022" }),
            /* @__PURE__ */ jsx("span", { children: "Decided to review your order again" })
          ] }),
          /* @__PURE__ */ jsxs("li", { className: "flex items-start gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-blue-600 dark:text-blue-400 mt-1", children: "\u2022" }),
            /* @__PURE__ */ jsx("span", { children: "Encountered a technical issue" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row gap-4 justify-center mb-6 sm:mb-8", children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: onReturnToCart,
            className: "h-12 px-8 rounded-xl font-semibold text-sm shadow-md shadow-blue-100 dark:shadow-none bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center justify-center gap-2",
            children: [
              /* @__PURE__ */ jsx(ShoppingCart, { className: "h-4 w-4" }),
              "RETURN TO CART"
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: onContinueShopping,
            className: "h-12 px-8 rounded-xl border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold text-sm text-gray-700 dark:text-gray-300 transition-all flex items-center justify-center gap-2 uppercase tracking-wider",
            children: [
              /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
              "CONTINUE SHOPPING"
            ]
          }
        )
      ] }),
      onContactSupport && /* @__PURE__ */ jsx("div", { className: "text-xs text-gray-500 dark:text-gray-400", children: /* @__PURE__ */ jsxs("p", { children: [
        "NEED ASSISTANCE?",
        " ",
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: onContactSupport,
            className: "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold uppercase tracking-wider",
            children: "CONTACT SUPPORT"
          }
        )
      ] }) })
    ] }) }) });
  }

  // ../default/src/components/ProfilePage.tsx
  var ProfilePage = react_default.memo(function ProfilePage2({
    user,
    isLoading,
    isAuthenticated,
    config,
    onNavigateToSettings,
    onNavigateToOrders,
    onNavigateToLogin
  }) {
    if (!isAuthenticated || !user) {
      return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center px-4", children: /* @__PURE__ */ jsx("div", { className: "w-full max-w-md", children: /* @__PURE__ */ jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm p-8 sm:p-12 text-center", children: [
        /* @__PURE__ */ jsx("div", { className: "w-20 h-20 mx-auto mb-6 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center", children: /* @__PURE__ */ jsx(User, { className: "w-10 h-10 text-blue-600 dark:text-blue-400" }) }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-3 mb-8", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-2xl font-bold text-gray-900 dark:text-white", children: "Access Denied" }),
          /* @__PURE__ */ jsx("p", { className: "text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider", children: "PLEASE LOG IN TO VIEW YOUR PROFILE" })
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: onNavigateToLogin,
            className: "w-full h-12 rounded-xl font-semibold text-sm shadow-md shadow-blue-100 dark:shadow-none bg-blue-600 hover:bg-blue-700 text-white transition-all",
            children: "GO TO LOGIN"
          }
        )
      ] }) }) });
    }
    if (isLoading) {
      return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center", children: /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
        /* @__PURE__ */ jsx("div", { className: "w-12 h-12 border-4 border-gray-100 dark:border-slate-700 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" }),
        /* @__PURE__ */ jsx("p", { className: "text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest", children: "LOADING PROFILE..." })
      ] }) });
    }
    const userInitial = user.name?.charAt(0).toUpperCase() || "U";
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-gray-50 dark:bg-slate-900", children: /* @__PURE__ */ jsx("div", { className: "container mx-auto px-4 py-8 sm:py-12", children: /* @__PURE__ */ jsxs("div", { className: "max-w-5xl mx-auto space-y-6 sm:space-y-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden", children: [
        /* @__PURE__ */ jsx("div", { className: "h-24 sm:h-32 bg-gray-50 dark:bg-slate-700 border-b border-gray-100 dark:border-slate-600" }),
        /* @__PURE__ */ jsxs("div", { className: "px-6 sm:px-8 pb-6 sm:pb-8 flex flex-col sm:flex-row items-end gap-6 sm:gap-8 -mt-12 sm:-mt-16 relative z-10", children: [
          /* @__PURE__ */ jsx("div", { className: "w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-white dark:bg-slate-800 p-1 shadow-xl ring-1 ring-gray-100 dark:ring-slate-700 flex-shrink-0", children: user.avatar ? /* @__PURE__ */ jsx(
            "img",
            {
              src: user.avatar,
              alt: user.name,
              className: "w-full h-full object-cover rounded-xl"
            }
          ) : /* @__PURE__ */ jsx("div", { className: "w-full h-full bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-3xl sm:text-4xl font-bold text-blue-600 dark:text-blue-400", children: userInitial }) }),
          /* @__PURE__ */ jsxs("div", { className: "flex-1 pb-2 space-y-3 text-center sm:text-left", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 flex-wrap justify-center sm:justify-start", children: [
              /* @__PURE__ */ jsx("h1", { className: "text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight leading-none", children: user.name }),
              /* @__PURE__ */ jsx("span", { className: "bg-gray-900 dark:bg-slate-700 text-white text-[10px] font-bold uppercase tracking-widest h-5 px-3 rounded-full flex items-center", children: "MEMBER" })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-4 sm:gap-6 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest justify-center sm:justify-start", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsx("div", { className: "w-1 h-1 bg-blue-500 rounded-full" }),
                user.email
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsx("div", { className: "w-1 h-1 bg-blue-500 rounded-full" }),
                "JOINED ",
                new Date(user.createdAt).toLocaleDateString()
              ] })
            ] })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 gap-6", children: /* @__PURE__ */ jsxs(
        "div",
        {
          onClick: onNavigateToOrders,
          className: "bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm p-6 sm:p-8 cursor-pointer hover:shadow-md transition-all",
          children: [
            /* @__PURE__ */ jsx("div", { className: "flex items-center justify-between mb-6", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx("div", { className: "w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center", children: /* @__PURE__ */ jsx(ShoppingBag, { className: "w-6 h-6 text-blue-600 dark:text-blue-400" }) }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-1", children: [
                  /* @__PURE__ */ jsx("div", { className: "h-3 w-0.5 bg-blue-600 rounded-full" }),
                  /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest", children: "ORDERS" })
                ] }),
                /* @__PURE__ */ jsx("h3", { className: "text-lg font-bold text-gray-900 dark:text-white", children: "Order History" })
              ] })
            ] }) }),
            /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed", children: "View and manage your orders" }),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: (e) => {
                  e.stopPropagation();
                  onNavigateToOrders();
                },
                className: "w-full h-11 rounded-xl border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold text-sm text-gray-700 dark:text-gray-300 transition-all uppercase tracking-wider",
                children: "VIEW ORDERS"
              }
            )
          ]
        }
      ) }),
      /* @__PURE__ */ jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm p-6 sm:p-8", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-6", children: [
          /* @__PURE__ */ jsx("div", { className: "h-4 w-1 bg-blue-600 rounded-full" }),
          /* @__PURE__ */ jsx("h3", { className: "text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest", children: "ACCOUNT INFORMATION" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2", children: "EMAIL ADDRESS" }),
            /* @__PURE__ */ jsx("p", { className: "font-bold text-gray-900 dark:text-white", children: user.email })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2", children: "MEMBER SINCE" }),
            /* @__PURE__ */ jsx("p", { className: "font-bold text-gray-900 dark:text-white", children: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A" })
          ] })
        ] })
      ] })
    ] }) }) });
  });

  // src/site.ts
  function resolveBokmooSiteConfig(config) {
    const brandName = config?.brand?.name?.trim() || "BOKMOO";
    const siteConfig = config?.site || {};
    return {
      brandName,
      eyebrow: siteConfig.eyebrow?.trim() || "BOKMOO eSIM Card",
      headline: siteConfig.headline?.trim() || "One Card.\nGlobal Connection.",
      subheadline: siteConfig.subheadline?.trim() || `Use multiple eSIM profiles on your ${brandName} card. Stay connected in 200+ countries.`,
      supportEmail: siteConfig.supportEmail?.trim() || "support@bokmoo.com",
      primaryCtaLabel: siteConfig.primaryCtaLabel?.trim() || "Shop eSIM Plans",
      primaryCtaHref: siteConfig.primaryCtaHref?.trim() || "/products",
      secondaryCtaLabel: siteConfig.secondaryCtaLabel?.trim() || "How it works",
      secondaryCtaHref: siteConfig.secondaryCtaHref?.trim() || "/#how-it-works",
      apiBaseUrl: siteConfig.apiBaseUrl?.trim() || "https://api.bokmoo.com"
    };
  }
  function isExternalHref(href) {
    if (!href) return false;
    return /^(https?:)?\/\//.test(href);
  }

  // src/components/AuthCallbackPage.tsx
  var FOCUS_VISIBLE_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bokmoo-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bokmoo-bg)]";
  function AuthCallbackPage({
    isLoading,
    error,
    config,
    onRetry,
    onNavigateToHome
  }) {
    const site = resolveBokmooSiteConfig(config);
    return /* @__PURE__ */ jsxs("div", { className: "relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bokmoo-bg)] px-4 py-12 text-[var(--bokmoo-ink)]", children: [
      /* @__PURE__ */ jsxs("div", { className: "pointer-events-none absolute inset-0", children: [
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent),transparent_26%),linear-gradient(180deg,var(--bokmoo-bg),color-mix(in_oklab,var(--bokmoo-bg)_84%,black))]" }),
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 opacity-40 [background-image:var(--bokmoo-grid)] [background-size:72px_72px]" })
      ] }),
      /* @__PURE__ */ jsx("section", { className: "relative w-full max-w-[30rem] rounded-[1.45rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,transparent)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_94%,white),var(--bokmoo-bg-elevated))] p-5 shadow-[var(--bokmoo-shadow)] sm:p-7", children: /* @__PURE__ */ jsxs("div", { className: "rounded-[1.1rem] border border-[var(--bokmoo-line)] bg-[color:oklch(0.055_0.006_75_/_0.78)] p-6 text-center", children: [
        /* @__PURE__ */ jsx("div", { className: "mx-auto flex h-16 w-16 items-center justify-center rounded-[1rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent)] text-[var(--bokmoo-gold)]", children: error ? /* @__PURE__ */ jsx(TriangleAlert, { className: "h-7 w-7" }) : isLoading ? /* @__PURE__ */ jsx(LoaderCircle, { className: "h-7 w-7 animate-spin" }) : /* @__PURE__ */ jsx(ShieldCheck, { className: "h-7 w-7" }) }),
        /* @__PURE__ */ jsxs("p", { className: "mt-6 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--bokmoo-gold)]", children: [
          site.brandName.toUpperCase(),
          " account"
        ] }),
        /* @__PURE__ */ jsx("h1", { className: "mt-3 text-3xl font-semibold leading-none tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: error ? "Authentication failed" : "Completing sign in" }),
        /* @__PURE__ */ jsx("p", { className: "mt-4 text-sm leading-6 text-[var(--bokmoo-copy)]", children: error || "Securing your session and returning you to the BOKMOO storefront." }),
        /* @__PURE__ */ jsxs("div", { className: "mt-7 grid gap-3 sm:grid-cols-2", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: onRetry,
              className: `inline-flex min-h-12 items-center justify-center rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_86%,black)] px-4 text-sm font-semibold text-[var(--bokmoo-ink)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING}`,
              children: "Back to sign in"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: onNavigateToHome,
              className: `inline-flex min-h-12 items-center justify-center rounded-[0.95rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_88%,white),color-mix(in_oklab,var(--bokmoo-gold)_64%,black))] px-4 text-sm font-black uppercase tracking-[0.16em] text-[var(--bokmoo-bg)] ${FOCUS_VISIBLE_RING}`,
              children: "Home"
            }
          )
        ] })
      ] }) })
    ] });
  }

  // ../../ui/src/utils/cn.ts
  function cn2(...inputs) {
    return twMerge(clsx(inputs));
  }

  // ../../ui/src/utils/a11y.ts
  function prefersReducedMotion3() {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // ../../ui/src/components/Button/Button.tsx
  var variantStyles2 = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-brand-sm hover:shadow-brand-md",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    outline: "border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-blue-200 hover:text-blue-600",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    destructive: "bg-red-600 text-white hover:bg-red-700"
  };
  var sizeStyles2 = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-base",
    lg: "h-12 px-6 text-lg"
  };
  var Spinner2 = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      className: "animate-spin -ml-1 mr-2 h-4 w-4",
      fill: "none",
      viewBox: "0 0 24 24",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ jsx(
          "circle",
          {
            className: "opacity-25",
            cx: "12",
            cy: "12",
            r: "10",
            stroke: "currentColor",
            strokeWidth: "4"
          }
        ),
        /* @__PURE__ */ jsx(
          "path",
          {
            className: "opacity-75",
            fill: "currentColor",
            d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          }
        )
      ]
    }
  );
  var Button2 = forwardRef(
    ({
      variant = "primary",
      size = "md",
      loading = false,
      className,
      children,
      disabled,
      ...props
    }, ref) => {
      const reducedMotion = prefersReducedMotion3();
      return /* @__PURE__ */ jsxs(
        motion.button,
        {
          ref,
          whileHover: reducedMotion ? void 0 : { scale: 1.02 },
          whileTap: reducedMotion ? void 0 : { scale: 0.98 },
          transition: { duration: 0.15 },
          className: cn2(
            // Base styles
            "inline-flex items-center justify-center font-medium rounded-full",
            "transition-all duration-fast",
            // Focus styles
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            // Disabled styles
            "disabled:opacity-50 disabled:pointer-events-none",
            // Variant styles
            variantStyles2[variant],
            // Size styles
            sizeStyles2[size],
            className
          ),
          disabled: disabled || loading,
          "aria-busy": loading,
          ...props,
          children: [
            loading && /* @__PURE__ */ jsx(Spinner2, {}),
            children
          ]
        }
      );
    }
  );
  Button2.displayName = "Button";

  // ../../ui/src/components/Card/ProductCard.tsx
  var aspectRatioStyles2 = {
    square: "aspect-square",
    portrait: "aspect-[4/5]",
    landscape: "aspect-video"
  };
  var badgeStyles2 = {
    NEW: "bg-blue-50 text-blue-600",
    SALE: "bg-red-50 text-red-600",
    HOT: "bg-orange-50 text-orange-600"
  };
  var ProductCard2 = forwardRef(
    ({
      image,
      title,
      description,
      price,
      originalPrice,
      badge,
      aspectRatio: aspectRatio2 = "portrait",
      currency = "\xA5",
      onAddToCart,
      className,
      ...props
    }, ref) => {
      const reducedMotion = prefersReducedMotion3();
      return /* @__PURE__ */ jsxs(
        motion.div,
        {
          ref,
          initial: reducedMotion ? void 0 : { opacity: 0, y: 20 },
          whileInView: reducedMotion ? void 0 : { opacity: 1, y: 0 },
          viewport: { once: true },
          whileHover: reducedMotion ? void 0 : { y: -8 },
          transition: { duration: 0.3, ease: [0, 0, 0.2, 1] },
          className: cn2("group cursor-pointer", className),
          ...props,
          children: [
            /* @__PURE__ */ jsxs(
              "div",
              {
                className: cn2(
                  "bg-slate-50 rounded-2xl mb-4 overflow-hidden relative",
                  "shadow-sm transition-all duration-normal",
                  "group-hover:shadow-card-hover",
                  "border border-transparent group-hover:border-blue-100",
                  aspectRatioStyles2[aspectRatio2]
                ),
                children: [
                  image ? /* @__PURE__ */ jsx(
                    "img",
                    {
                      src: image,
                      alt: title,
                      className: "w-full h-full object-cover transition-transform duration-slow group-hover:scale-105"
                    }
                  ) : /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-gradient-to-tr from-slate-100 to-white" }),
                  badge && /* @__PURE__ */ jsx(
                    "div",
                    {
                      className: cn2(
                        "absolute top-3 right-3",
                        "bg-white/90 backdrop-blur px-2.5 py-1 rounded-full",
                        "text-xs font-bold shadow-sm",
                        badgeStyles2[badge]
                      ),
                      children: badge
                    }
                  ),
                  /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-normal" })
                ]
              }
            ),
            /* @__PURE__ */ jsx("h3", { className: "text-base font-semibold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors line-clamp-2", children: title }),
            description && /* @__PURE__ */ jsx("p", { className: "text-slate-500 text-sm mb-2 line-clamp-2", children: description }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mt-2", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsxs("span", { className: "text-lg font-bold text-slate-900", children: [
                  currency,
                  price.toLocaleString()
                ] }),
                originalPrice && /* @__PURE__ */ jsxs("span", { className: "text-sm text-slate-400 line-through", children: [
                  currency,
                  originalPrice.toLocaleString()
                ] })
              ] }),
              onAddToCart && /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: (e) => {
                    e.stopPropagation();
                    onAddToCart();
                  },
                  className: cn2(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    "bg-blue-50 text-blue-600",
                    "hover:bg-blue-600 hover:text-white",
                    "transition-all duration-fast shadow-sm hover:shadow-brand-sm",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  ),
                  "aria-label": `Add ${title} to cart`,
                  children: /* @__PURE__ */ jsx("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4v16m8-8H4" }) })
                }
              )
            ] })
          ]
        }
      );
    }
  );
  ProductCard2.displayName = "ProductCard";

  // ../../ui/src/components/Input/Input.tsx
  var Input2 = forwardRef(
    ({
      label,
      error,
      hint,
      prefixIcon,
      suffixIcon,
      className,
      id: id3,
      disabled,
      ...props
    }, ref) => {
      const generatedId = useId();
      const inputId = id3 || generatedId;
      const errorId = `${inputId}-error`;
      const hintId = `${inputId}-hint`;
      const hasError = !!error;
      return /* @__PURE__ */ jsxs("div", { className: "w-full", children: [
        label && /* @__PURE__ */ jsx(
          "label",
          {
            htmlFor: inputId,
            className: "block text-sm font-medium text-slate-700 mb-1.5",
            children: label
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          prefixIcon && /* @__PURE__ */ jsx("div", { className: "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none", children: prefixIcon }),
          /* @__PURE__ */ jsx(
            "input",
            {
              ref,
              id: inputId,
              className: cn2(
                // Base styles
                "w-full h-10 px-4 rounded-lg border bg-white",
                "text-slate-900 placeholder:text-slate-400",
                "transition-all duration-fast",
                // Focus styles
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                // Error styles
                hasError ? "border-red-500 focus:ring-red-500" : "border-slate-200 hover:border-slate-300",
                // Disabled styles
                disabled && "bg-slate-50 text-slate-500 cursor-not-allowed",
                // Icon padding
                prefixIcon && "pl-10",
                suffixIcon && "pr-10",
                className
              ),
              disabled,
              "aria-invalid": hasError ? "true" : void 0,
              "aria-describedby": hasError ? errorId : hint ? hintId : void 0,
              ...props
            }
          ),
          suffixIcon && /* @__PURE__ */ jsx("div", { className: "absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none", children: suffixIcon })
        ] }),
        hasError && /* @__PURE__ */ jsxs(
          "p",
          {
            id: errorId,
            className: "mt-1.5 text-sm text-red-600 flex items-center gap-1",
            role: "alert",
            children: [
              /* @__PURE__ */ jsx("svg", { className: "w-4 h-4 flex-shrink-0", fill: "currentColor", viewBox: "0 0 20 20", children: /* @__PURE__ */ jsx(
                "path",
                {
                  fillRule: "evenodd",
                  d: "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z",
                  clipRule: "evenodd"
                }
              ) }),
              error
            ]
          }
        ),
        hint && !hasError && /* @__PURE__ */ jsx("p", { id: hintId, className: "mt-1.5 text-sm text-slate-500", children: hint })
      ] });
    }
  );
  Input2.displayName = "Input";

  // ../../ui/src/components/Navigation/Navigation.tsx
  function Navigation2({ logo, items, actions, className }) {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const reducedMotion = prefersReducedMotion3();
    useEffect(() => {
      const handleScroll = () => setScrolled(window.scrollY > 0);
      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => window.removeEventListener("scroll", handleScroll);
    }, []);
    useEffect(() => {
      const handleResize = () => {
        if (window.innerWidth >= 768) {
          setMobileMenuOpen(false);
        }
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);
    return /* @__PURE__ */ jsxs(
      "nav",
      {
        className: cn2(
          "sticky top-0 z-50 h-16 bg-white/90 backdrop-blur-md transition-all duration-normal",
          scrolled && "border-b border-slate-100 shadow-sm",
          className
        ),
        children: [
          /* @__PURE__ */ jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between", children: [
            /* @__PURE__ */ jsx("div", { className: "flex-shrink-0", children: logo }),
            /* @__PURE__ */ jsx("div", { className: "hidden md:flex gap-8 text-sm font-medium", children: items.map((item) => /* @__PURE__ */ jsx(
              "a",
              {
                href: item.href,
                className: cn2(
                  "transition-colors duration-fast",
                  item.active ? "text-blue-600 font-semibold" : "text-slate-500 hover:text-blue-600"
                ),
                "aria-current": item.active ? "page" : void 0,
                children: item.label
              },
              item.href
            )) }),
            /* @__PURE__ */ jsx("div", { className: "hidden md:flex items-center gap-4", children: actions }),
            /* @__PURE__ */ jsx(
              "button",
              {
                className: cn2(
                  "md:hidden p-2 -mr-2 rounded-lg",
                  "text-slate-600 hover:bg-slate-100",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                ),
                onClick: () => setMobileMenuOpen(!mobileMenuOpen),
                "aria-label": mobileMenuOpen ? "Close menu" : "Open menu",
                "aria-expanded": mobileMenuOpen,
                "aria-controls": "mobile-menu",
                children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: mobileMenuOpen ? /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M6 18L18 6M6 6l12 12" }) : /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M4 6h16M4 12h16M4 18h16" }) })
              }
            )
          ] }),
          /* @__PURE__ */ jsx(AnimatePresence, { children: mobileMenuOpen && /* @__PURE__ */ jsx(
            motion.div,
            {
              id: "mobile-menu",
              initial: reducedMotion ? { opacity: 1 } : { opacity: 0, height: 0 },
              animate: reducedMotion ? { opacity: 1 } : { opacity: 1, height: "auto" },
              exit: reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 },
              transition: { duration: 0.2 },
              className: "md:hidden bg-white border-t border-slate-100 overflow-hidden",
              children: /* @__PURE__ */ jsxs("div", { className: "py-4 px-4 sm:px-6 space-y-1", children: [
                items.map((item) => /* @__PURE__ */ jsx(
                  "a",
                  {
                    href: item.href,
                    className: cn2(
                      "block py-2.5 px-3 rounded-lg text-base transition-colors",
                      item.active ? "text-blue-600 font-semibold bg-blue-50" : "text-slate-600 hover:bg-slate-50"
                    ),
                    onClick: () => setMobileMenuOpen(false),
                    children: item.label
                  },
                  item.href
                )),
                actions && /* @__PURE__ */ jsx("div", { className: "mt-4 pt-4 border-t border-slate-100", children: actions })
              ] })
            }
          ) })
        ]
      }
    );
  }
  Navigation2.displayName = "Navigation";

  // ../../ui/src/components/Grid/ProductGrid.tsx
  var gapStyles2 = {
    sm: "gap-4",
    md: "gap-6",
    lg: "gap-8"
  };
  function ProductGrid2({
    children,
    columns = { sm: 2, md: 3, lg: 4 },
    gap = "md",
    className
  }) {
    const columnClasses = cn2(
      "grid-cols-1",
      columns.sm && `sm:grid-cols-${columns.sm}`,
      columns.md && `md:grid-cols-${columns.md}`,
      columns.lg && `lg:grid-cols-${columns.lg}`,
      columns.xl && `xl:grid-cols-${columns.xl}`
    );
    return /* @__PURE__ */ jsx(
      "div",
      {
        className: cn2(
          "grid",
          columnClasses,
          gapStyles2[gap],
          className
        ),
        children
      }
    );
  }
  ProductGrid2.displayName = "ProductGrid";

  // src/components/CartPage.tsx
  var CartPage = react_default.memo(function CartPage2({
    cart,
    isLoading,
    onUpdateQuantity,
    onRemoveItem,
    onCheckout,
    onCheckoutSelected,
    selectedItemIds,
    selectedItemCount,
    onToggleItemSelection,
    onSelectAllItems,
    onDeselectAllItems,
    onContinueShopping
  }) {
    const supportsSelection = Boolean(
      onCheckoutSelected && onToggleItemSelection && onSelectAllItems && onDeselectAllItems
    );
    const effectiveSelectedIds = supportsSelection ? selectedItemIds || [] : cart.items.map((item) => item.id);
    const selectedIdSet = new Set(effectiveSelectedIds);
    const selectedItems = supportsSelection ? cart.items.filter((item) => selectedIdSet.has(item.id)) : cart.items;
    const selectedSubtotal = selectedItems.reduce((sum, item) => sum + item.subtotal, 0);
    const ratio = cart.subtotal > 0 ? selectedSubtotal / cart.subtotal : 0;
    const selectedTax = Number(((cart.tax || 0) * ratio).toFixed(2));
    const selectedShipping = Number(((cart.shipping || 0) * ratio).toFixed(2));
    const selectedDiscount = Number(((cart.discount || 0) * ratio).toFixed(2));
    const selectedTotal = Number((selectedSubtotal + selectedTax + selectedShipping - selectedDiscount).toFixed(2));
    const selectedQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
    const allSelected = cart.items.length > 0 && effectiveSelectedIds.length === cart.items.length;
    const hasSelection = effectiveSelectedIds.length > 0;
    if (cart.items.length === 0) {
      return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-[960px]", children: /* @__PURE__ */ jsxs("div", { className: "rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-6 py-16 text-center shadow-[var(--bokmoo-shadow)] sm:px-10", children: [
        /* @__PURE__ */ jsx("div", { className: "mx-auto flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(ShoppingBag, { className: "h-10 w-10" }) }),
        /* @__PURE__ */ jsx("h1", { className: "mt-6 text-[clamp(2.2rem,4vw,4rem)] leading-[0.98] tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: "Your cart is empty." }),
        /* @__PURE__ */ jsx("p", { className: "mx-auto mt-4 max-w-xl text-base leading-7 text-[var(--bokmoo-copy)]", children: "Add a destination or regional plan to prepare your connectivity before departure." }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: onContinueShopping,
            className: "mt-8 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-bg)]",
            type: "button",
            children: [
              /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
              "Continue browsing"
            ]
          }
        )
      ] }) }) });
    }
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1280px]", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: onContinueShopping,
            className: "flex h-10 w-10 items-center justify-center rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] text-[var(--bokmoo-copy)]",
            type: "button",
            children: /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" })
          }
        ),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold tracking-[0.2em] text-[var(--bokmoo-copy-soft)]", children: "Travel Cart" }),
          /* @__PURE__ */ jsx("h1", { className: "mt-1 text-[clamp(2rem,4vw,3.6rem)] leading-[0.98] tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: "Review your selected plans." })
        ] })
      ] }),
      supportsSelection ? /* @__PURE__ */ jsxs("div", { className: "mt-5 flex items-center justify-between rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-4 shadow-[var(--bokmoo-shadow)]", children: [
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
            className: "inline-flex items-center gap-2 text-sm font-medium text-[var(--bokmoo-copy)]",
            children: [
              /* @__PURE__ */ jsx(
                "span",
                {
                  className: cn2(
                    "flex h-5 w-5 items-center justify-center rounded-md border",
                    allSelected ? "border-[var(--bokmoo-gold)] bg-[var(--bokmoo-gold)] text-[var(--bokmoo-bg)]" : "border-[var(--bokmoo-line-strong)] bg-[var(--bokmoo-bg)] text-transparent"
                  ),
                  children: /* @__PURE__ */ jsx(Check, { className: "h-3.5 w-3.5" })
                }
              ),
              allSelected ? "Deselect all" : "Select all"
            ]
          }
        ),
        /* @__PURE__ */ jsxs("span", { className: "text-xs font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: [
          selectedItemCount ?? effectiveSelectedIds.length,
          " selected"
        ] })
      ] }) : null,
      /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.98fr)_minmax(22rem,0.72fr)]", children: [
        /* @__PURE__ */ jsx("section", { className: "space-y-4", children: cart.items.map((item) => /* @__PURE__ */ jsx(
          "article",
          {
            className: "rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-5 shadow-[var(--bokmoo-shadow)]",
            children: /* @__PURE__ */ jsxs("div", { className: "flex gap-4", children: [
              supportsSelection ? /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => onToggleItemSelection?.(item.id),
                  className: cn2(
                    "mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors",
                    selectedIdSet.has(item.id) ? "border-[var(--bokmoo-gold)] bg-[var(--bokmoo-gold)] text-[var(--bokmoo-bg)]" : "border-[var(--bokmoo-line-strong)] bg-[var(--bokmoo-bg)] text-transparent"
                  ),
                  "aria-label": selectedIdSet.has(item.id) ? "Deselect item" : "Select item",
                  children: /* @__PURE__ */ jsx(Check, { className: "h-3.5 w-3.5" })
                }
              ) : null,
              /* @__PURE__ */ jsx("div", { className: "relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[linear-gradient(155deg,color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent),transparent_55%),var(--bokmoo-bg)]", children: item.productImage ? /* @__PURE__ */ jsx("img", { src: item.productImage, alt: item.productName, className: "h-full w-full object-cover" }) : /* @__PURE__ */ jsx("div", { className: "flex h-full items-end p-3 text-[10px] tracking-[0.16em] text-[var(--bokmoo-gold)]", children: "BOKMOO" }) }),
              /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                /* @__PURE__ */ jsx("h2", { className: "text-lg font-medium text-[var(--bokmoo-ink)]", children: item.productName }),
                item.variantName ? /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs tracking-[0.16em] text-[var(--bokmoo-copy-soft)]", children: item.variantName }) : null,
                /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm text-[var(--bokmoo-copy)]", children: "Instant eSIM delivery with activation instructions included." }),
                /* @__PURE__ */ jsxs("div", { className: "mt-4 flex items-center gap-3", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-2 py-1", children: [
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => onUpdateQuantity(item.id, item.quantity - 1),
                        disabled: isLoading || item.quantity <= 1,
                        className: "flex h-8 w-8 items-center justify-center rounded-full text-[var(--bokmoo-copy)] disabled:opacity-40",
                        type: "button",
                        children: /* @__PURE__ */ jsx(Minus, { className: "h-4 w-4" })
                      }
                    ),
                    /* @__PURE__ */ jsx("span", { className: "min-w-[2rem] text-center text-sm font-medium text-[var(--bokmoo-ink)]", children: item.quantity }),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => onUpdateQuantity(item.id, item.quantity + 1),
                        disabled: isLoading || item.quantity >= item.maxQuantity,
                        className: "flex h-8 w-8 items-center justify-center rounded-full text-[var(--bokmoo-copy)] disabled:opacity-40",
                        type: "button",
                        children: /* @__PURE__ */ jsx(Plus, { className: "h-4 w-4" })
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      onClick: () => onRemoveItem(item.id),
                      disabled: isLoading,
                      className: "flex h-10 w-10 items-center justify-center rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] text-[var(--bokmoo-copy)] transition-colors hover:text-[var(--bokmoo-danger)] disabled:opacity-40",
                      title: "Remove",
                      type: "button",
                      children: /* @__PURE__ */ jsx(Trash2, { className: "h-4 w-4" })
                    }
                  )
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "text-right", children: [
                /* @__PURE__ */ jsx("p", { className: "text-[10px] tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Subtotal" }),
                /* @__PURE__ */ jsxs("p", { className: "mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: [
                  "$",
                  item.subtotal.toFixed(2)
                ] })
              ] })
            ] })
          },
          item.id
        )) }),
        /* @__PURE__ */ jsx("aside", { className: "lg:col-span-1", children: /* @__PURE__ */ jsxs("div", { className: "sticky top-24 rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)]", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Summary" }),
          /* @__PURE__ */ jsxs("div", { className: "mt-6 space-y-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-sm", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[var(--bokmoo-copy)]", children: "Selected items" }),
              /* @__PURE__ */ jsx("span", { className: "text-[var(--bokmoo-ink)]", children: supportsSelection ? selectedQuantity : cart.itemCount })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-sm", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[var(--bokmoo-copy)]", children: "Subtotal" }),
              /* @__PURE__ */ jsxs("span", { className: "text-[var(--bokmoo-ink)]", children: [
                "$",
                selectedSubtotal.toFixed(2)
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-sm", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[var(--bokmoo-copy)]", children: "Tax" }),
              /* @__PURE__ */ jsxs("span", { className: "text-[var(--bokmoo-ink)]", children: [
                "$",
                selectedTax.toFixed(2)
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-sm", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[var(--bokmoo-copy)]", children: "Shipping" }),
              /* @__PURE__ */ jsx("span", { className: "text-[var(--bokmoo-ink)]", children: selectedShipping === 0 ? "No shipping required" : `$${selectedShipping.toFixed(2)}` })
            ] }),
            selectedDiscount > 0 ? /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-sm text-[var(--bokmoo-success)]", children: [
              /* @__PURE__ */ jsx("span", { children: "Discount" }),
              /* @__PURE__ */ jsxs("span", { children: [
                "-$",
                selectedDiscount.toFixed(2)
              ] })
            ] }) : null,
            /* @__PURE__ */ jsx("div", { className: "border-t border-[var(--bokmoo-line)] pt-4", children: /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-lg", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[var(--bokmoo-ink)]", children: "Total" }),
              /* @__PURE__ */ jsxs("span", { className: "font-semibold text-[var(--bokmoo-ink)]", children: [
                "$",
                selectedTotal.toFixed(2)
              ] })
            ] }) })
          ] }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                if (supportsSelection && hasSelection) {
                  onCheckoutSelected?.(effectiveSelectedIds);
                  return;
                }
                onCheckout();
              },
              disabled: supportsSelection && !hasSelection,
              className: "mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-5 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--bokmoo-bg)] disabled:cursor-not-allowed disabled:opacity-50",
              type: "button",
              children: "Secure Checkout"
            }
          )
        ] }) })
      ] })
    ] }) });
  });

  // src/components/CategoriesPage.tsx
  var CategoriesPage = react_default.memo(function CategoriesPage2({
    categories,
    isLoading,
    error,
    onCategoryClick,
    onNavigateToHome
  }) {
    if (isLoading) {
      return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)]" });
    }
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1280px]", children: [
      /* @__PURE__ */ jsx("section", { className: "rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4", children: [
        /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(Earth, { className: "h-6 w-6" }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Region Collections" }),
          /* @__PURE__ */ jsx("h1", { className: "mt-2 text-[clamp(2.2rem,5vw,4rem)] leading-[0.94] tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: "Browse BOKMOO plans by destination and travel region." })
        ] })
      ] }) }),
      error ? /* @__PURE__ */ jsx("div", { className: "mt-6 rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 text-[var(--bokmoo-copy)] shadow-[var(--bokmoo-shadow)]", children: error }) : null,
      /* @__PURE__ */ jsx("section", { className: "mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3", children: categories.map((category) => /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => onCategoryClick(category.id),
          className: "group rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 text-left shadow-[var(--bokmoo-shadow)] transition-transform duration-300 hover:-translate-y-1",
          type: "button",
          children: [
            /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-gold)]", children: [
              category.productCount,
              " plans"
            ] }),
            /* @__PURE__ */ jsx("h2", { className: "mt-4 text-2xl leading-[1.02] tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: category.name }),
            /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--bokmoo-copy)]", children: category.description || "Group destination-ready plans into clearer regional entry points." }),
            /* @__PURE__ */ jsxs("span", { className: "mt-4 inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-gold)]", children: [
              "View category",
              /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" })
            ] })
          ]
        },
        category.id
      )) }),
      categories.length === 0 ? /* @__PURE__ */ jsx("div", { className: "mt-6 rounded-[var(--bokmoo-radius-xl)] border border-dashed border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-16 text-center text-[var(--bokmoo-copy)]", children: "No region collections are available yet." }) : null,
      onNavigateToHome ? /* @__PURE__ */ jsx("div", { className: "mt-8", children: /* @__PURE__ */ jsx(
        "button",
        {
          onClick: onNavigateToHome,
          className: "rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)]",
          type: "button",
          children: "Back home"
        }
      ) }) : null
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
    const countriesRequireStatePostalSet = react_default.useMemo(() => {
      const source = countriesRequireStatePostal && countriesRequireStatePostal.length > 0 ? countriesRequireStatePostal : ["US", "CA", "AU", "CN", "GB"];
      return new Set(source.map((item) => item.trim().toUpperCase()));
    }, [countriesRequireStatePostal]);
    const paymentMethods = react_default.useMemo(() => availablePaymentMethods || [], [availablePaymentMethods]);
    const [formData, setFormData] = react_default.useState({
      email: currentUserEmail || "",
      firstName: "",
      lastName: "",
      addressLine1: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      phone: "",
      paymentMethod: paymentMethods[0]?.name || ""
    });
    const [errors, setErrors] = react_default.useState({});
    react_default.useEffect(() => {
      if (!currentUserEmail) return;
      setFormData((prev) => ({ ...prev, email: prev.email || currentUserEmail }));
    }, [currentUserEmail]);
    react_default.useEffect(() => {
      if (!paymentMethods.length) return;
      if (paymentMethods.some((item) => item.name === formData.paymentMethod)) return;
      setFormData((prev) => ({ ...prev, paymentMethod: paymentMethods[0].name }));
    }, [formData.paymentMethod, paymentMethods]);
    const hasShippingInput = react_default.useMemo(
      () => [
        formData.firstName,
        formData.lastName,
        formData.phone,
        formData.addressLine1,
        formData.city,
        formData.state,
        formData.postalCode,
        formData.country
      ].some((value) => value.trim()),
      [formData]
    );
    const shouldCollectShipping = Boolean(requireShippingAddress || hasShippingInput);
    const normalizedCountry = formData.country.trim().toUpperCase() === "UK" ? "GB" : formData.country.trim().toUpperCase();
    const statePostalRequired = shouldCollectShipping && countriesRequireStatePostalSet.has(normalizedCountry);
    const inputClassName = (field) => cn2(
      "h-12 w-full rounded-[0.95rem] border bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none placeholder:text-[var(--bokmoo-copy-soft)]",
      errors[field] ? "border-[var(--bokmoo-danger)]" : "border-[var(--bokmoo-line)]"
    );
    const handleChange = (event) => {
      const { name, value } = event.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      setErrors((prev) => {
        if (!prev[name]) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });
    };
    const validate = () => {
      const nextErrors = {};
      if (!formData.email.trim()) nextErrors.email = "Email is required";
      if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) nextErrors.email = "Invalid email address";
      if (shouldCollectShipping) {
        if (!formData.firstName.trim()) nextErrors.firstName = "First name is required";
        if (!formData.lastName.trim()) nextErrors.lastName = "Last name is required";
        if (!formData.addressLine1.trim()) nextErrors.addressLine1 = "Address is required";
        if (!formData.city.trim()) nextErrors.city = "City is required";
        if (!formData.country.trim()) nextErrors.country = "Country is required";
        if (!formData.phone.trim()) nextErrors.phone = "Phone number is required";
        if (statePostalRequired) {
          if (!formData.state.trim()) nextErrors.state = "State is required";
          if (!formData.postalCode.trim()) nextErrors.postalCode = "Postal code is required";
        }
      }
      setErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    };
    const handleSubmit = async (event) => {
      event.preventDefault();
      if (!validate()) return;
      await onSubmit(formData);
    };
    const paymentIcon = (name) => {
      const normalized = name.toLowerCase();
      return normalized.includes("card") || normalized.includes("stripe") ? CreditCard : Wallet;
    };
    if (isLoading) {
      return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)]" });
    }
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--bokmoo-gold)_9%,transparent),transparent_34%),var(--bokmoo-bg)] px-4 pb-24 pt-8 sm:px-6 sm:pt-10 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[980px]", children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: onBack,
          className: "inline-flex items-center gap-2 text-sm text-[var(--bokmoo-copy-soft)] hover:text-[var(--bokmoo-ink)]",
          type: "button",
          children: [
            /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
            "Back"
          ]
        }
      ),
      /* @__PURE__ */ jsx("div", { className: "mt-5 rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,var(--bokmoo-line))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_80%,black),color-mix(in_oklab,var(--bokmoo-bg-elevated)_92%,black))] p-3 shadow-[var(--bokmoo-shadow)] sm:rounded-[1.55rem] sm:p-5", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]", children: [
        /* @__PURE__ */ jsxs("aside", { className: "rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4", children: [
          /* @__PURE__ */ jsx("p", { className: "text-lg font-medium text-[var(--bokmoo-ink)]", children: "Order Summary" }),
          /* @__PURE__ */ jsx("div", { className: "mt-4 space-y-3", children: cart.items.map((item) => /* @__PURE__ */ jsx("div", { className: "rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_84%,black)] p-3", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
            /* @__PURE__ */ jsx("div", { className: "h-14 w-16 overflow-hidden rounded-[0.8rem] bg-[linear-gradient(160deg,#924a57_0%,#261922_44%,#0f1115_100%)]" }),
            /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
              /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[var(--bokmoo-ink)]", children: item.productName }),
              /* @__PURE__ */ jsxs("p", { className: "mt-1 text-xs text-[var(--bokmoo-copy-soft)]", children: [
                "Qty ",
                item.quantity,
                item.variantName ? ` \xB7 ${item.variantName}` : ""
              ] })
            ] }),
            /* @__PURE__ */ jsxs("span", { className: "text-sm text-[var(--bokmoo-copy)]", children: [
              "$",
              Number(item.subtotal || 0).toFixed(2)
            ] })
          ] }) }, item.id)) }),
          /* @__PURE__ */ jsxs("div", { className: "mt-5 space-y-3 border-t border-[var(--bokmoo-line)] pt-4 text-sm", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between text-[var(--bokmoo-copy)]", children: [
              /* @__PURE__ */ jsx("span", { children: "Subtotal" }),
              /* @__PURE__ */ jsxs("span", { children: [
                "$",
                Number(cart.subtotal || 0).toFixed(2)
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between text-[var(--bokmoo-copy)]", children: [
              /* @__PURE__ */ jsx("span", { children: "Total" }),
              /* @__PURE__ */ jsxs("span", { className: "font-semibold text-[var(--bokmoo-ink)]", children: [
                "$",
                Number(cart.total || 0).toFixed(2)
              ] })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("form", { id: "bokmoo-checkout-form", onSubmit: handleSubmit, className: "space-y-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-[0.9rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(Mail, { className: "h-5 w-5" }) }),
              /* @__PURE__ */ jsx("p", { className: "text-lg font-medium text-[var(--bokmoo-ink)]", children: "Contact Information" })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "mt-4 space-y-3", children: [
              /* @__PURE__ */ jsx(
                "input",
                {
                  name: "email",
                  type: "email",
                  value: formData.email,
                  onChange: handleChange,
                  className: inputClassName("email"),
                  placeholder: "Enter your email"
                }
              ),
              errors.email ? /* @__PURE__ */ jsx("p", { className: "text-xs text-[var(--bokmoo-danger)]", children: errors.email }) : null,
              /* @__PURE__ */ jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      name: "firstName",
                      value: formData.firstName,
                      onChange: handleChange,
                      className: inputClassName("firstName"),
                      placeholder: "First name"
                    }
                  ),
                  errors.firstName ? /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs text-[var(--bokmoo-danger)]", children: errors.firstName }) : null
                ] }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      name: "lastName",
                      value: formData.lastName,
                      onChange: handleChange,
                      className: inputClassName("lastName"),
                      placeholder: "Last name"
                    }
                  ),
                  errors.lastName ? /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs text-[var(--bokmoo-danger)]", children: errors.lastName }) : null
                ] })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4", children: [
            /* @__PURE__ */ jsx("p", { className: "text-lg font-medium text-[var(--bokmoo-ink)]", children: "Payment Method" }),
            /* @__PURE__ */ jsx("div", { className: "mt-4 grid gap-3", children: paymentMethods.map((method) => {
              const Icon2 = paymentIcon(method.name);
              const isSelected = formData.paymentMethod === method.name;
              return /* @__PURE__ */ jsxs(
                "label",
                {
                  className: cn2(
                    "flex cursor-pointer items-center justify-between rounded-[0.95rem] border px-4 py-4 transition-colors",
                    isSelected ? "border-[var(--bokmoo-line-strong)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)]" : "border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_86%,black)]"
                  ),
                  children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                      /* @__PURE__ */ jsx("div", { className: "flex h-9 w-9 items-center justify-center rounded-full bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(Icon2, { className: "h-4 w-4" }) }),
                      /* @__PURE__ */ jsxs("div", { children: [
                        /* @__PURE__ */ jsx("p", { className: "text-sm text-[var(--bokmoo-ink)]", children: method.displayName }),
                        /* @__PURE__ */ jsx("p", { className: "text-xs text-[var(--bokmoo-copy-soft)]", children: method.name })
                      ] })
                    ] }),
                    /* @__PURE__ */ jsx(
                      "input",
                      {
                        type: "radio",
                        name: "paymentMethod",
                        value: method.name,
                        checked: isSelected,
                        onChange: handleChange
                      }
                    )
                  ]
                },
                method.name
              );
            }) })
          ] }),
          shouldCollectShipping ? /* @__PURE__ */ jsxs("div", { className: "rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4", children: [
            /* @__PURE__ */ jsx("p", { className: "text-lg font-medium text-[var(--bokmoo-ink)]", children: "Billing Details" }),
            /* @__PURE__ */ jsxs("div", { className: "mt-4 grid gap-3 sm:grid-cols-2", children: [
              /* @__PURE__ */ jsx("div", { className: "sm:col-span-2", children: /* @__PURE__ */ jsx(
                "input",
                {
                  name: "addressLine1",
                  value: formData.addressLine1,
                  onChange: handleChange,
                  className: inputClassName("addressLine1"),
                  placeholder: "Address"
                }
              ) }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  name: "city",
                  value: formData.city,
                  onChange: handleChange,
                  className: inputClassName("city"),
                  placeholder: "City"
                }
              ),
              /* @__PURE__ */ jsx(
                "input",
                {
                  name: "country",
                  value: formData.country,
                  onChange: handleChange,
                  className: inputClassName("country"),
                  placeholder: "Country"
                }
              ),
              /* @__PURE__ */ jsx(
                "input",
                {
                  name: "state",
                  value: formData.state,
                  onChange: handleChange,
                  className: inputClassName("state"),
                  placeholder: "State / Province"
                }
              ),
              /* @__PURE__ */ jsx(
                "input",
                {
                  name: "postalCode",
                  value: formData.postalCode,
                  onChange: handleChange,
                  className: inputClassName("postalCode"),
                  placeholder: "Postal code"
                }
              )
            ] })
          ] }) : null,
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "submit",
              form: "bokmoo-checkout-form",
              disabled: isProcessing,
              className: "flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.95rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-5 text-sm font-semibold text-[var(--bokmoo-bg)] disabled:cursor-not-allowed disabled:opacity-50",
              children: [
                /* @__PURE__ */ jsx(ShieldCheck, { className: "h-4 w-4" }),
                isProcessing ? "Processing..." : "Continue to Payment"
              ]
            }
          )
        ] })
      ] }) })
    ] }) });
  });

  // src/lib/api.ts
  var BokmooApiError = class extends Error {
    constructor(status, code, message, requestId) {
      super(message);
      this.name = "BokmooApiError";
      this.status = status;
      this.code = code;
      this.requestId = requestId;
    }
  };
  function getProductIdFromLocation() {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const queryId = params.get("productId") || params.get("id");
    if (queryId) return queryId;
    const segments = window.location.pathname.split("/").filter(Boolean);
    const productsIndex = segments.lastIndexOf("products");
    if (productsIndex >= 0 && segments[productsIndex + 1]) {
      return decodeURIComponent(segments[productsIndex + 1]);
    }
    return null;
  }
  function getOrderIdFromLocation() {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const queryId = params.get("orderId") || params.get("id");
    if (queryId) return queryId;
    const segments = window.location.pathname.split("/").filter(Boolean);
    const ordersIndex = segments.lastIndexOf("orders");
    if (ordersIndex >= 0 && segments[ordersIndex + 1]) {
      return decodeURIComponent(segments[ordersIndex + 1]);
    }
    return null;
  }
  function getClientToken() {
    if (typeof window === "undefined") return null;
    try {
      const localStorageToken = window.localStorage.getItem("auth_token");
      if (localStorageToken) return localStorageToken;
    } catch {
    }
    const cookieValue = `; ${document.cookie}`;
    const parts = cookieValue.split("; auth_token=");
    if (parts.length === 2) {
      return parts.pop()?.split(";").shift() || null;
    }
    return null;
  }
  function normalizeResponse(payload) {
    if (payload && typeof payload === "object" && "data" in payload && payload.data !== void 0) {
      return payload.data;
    }
    return payload;
  }
  function asRecord(value) {
    return value && typeof value === "object" ? value : {};
  }
  function readString(source, keys) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return void 0;
  }
  function readNullableString(source, keys) {
    for (const key of keys) {
      const value = source[key];
      if (value === null) return null;
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return void 0;
  }
  function normalizeInstructions(value) {
    if (!value) return {};
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return {};
      try {
        return normalizeInstructions(JSON.parse(trimmed));
      } catch {
        return { general: [trimmed] };
      }
    }
    if (Array.isArray(value)) {
      return { general: value.filter((item) => typeof item === "string" && item.trim().length > 0) };
    }
    const source = asRecord(value);
    return {
      ios: Array.isArray(source.ios) ? source.ios.filter((item) => typeof item === "string" && item.trim().length > 0) : [],
      android: Array.isArray(source.android) ? source.android.filter((item) => typeof item === "string" && item.trim().length > 0) : [],
      general: Array.isArray(source.general) ? source.general.filter((item) => typeof item === "string" && item.trim().length > 0) : []
    };
  }
  function normalizeSupport(value, source) {
    const support = asRecord(value);
    return {
      email: readString(support, ["email"]) || readString(source, ["supportEmail", "support_email"]),
      phone: readString(support, ["phone"]) || readString(source, ["supportPhone", "support_phone"])
    };
  }
  async function requestEnvelope(config, endpoint, method = "GET", body) {
    const headers = {
      Accept: "application/json"
    };
    if (body !== void 0) {
      headers["Content-Type"] = "application/json";
    }
    const resolvedToken = config.token === void 0 ? getClientToken() : config.token;
    if (resolvedToken) {
      headers.Authorization = `Bearer ${resolvedToken}`;
    }
    const url = `${config.baseUrl.replace(/\/$/, "")}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers,
      body: body !== void 0 ? JSON.stringify(body) : void 0,
      cache: "no-store"
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = json.error;
      throw new BokmooApiError(
        response.status,
        error?.code || "API_ERROR",
        error?.message || `Request failed with status ${response.status}`,
        error?.requestId
      );
    }
    if (json && typeof json === "object" && "data" in json && json.data !== void 0) {
      return json;
    }
    return { data: json };
  }
  async function request(config, endpoint, method = "GET", body) {
    const envelope = await requestEnvelope(config, endpoint, method, body);
    return normalizeResponse(envelope);
  }
  function buildEsimSummary(source) {
    const data = source?.data?.gb ? `${source.data.gb}GB` : "Flexible data";
    const validity = source?.validityDays ? `${source.validityDays} Days` : "Flexible validity";
    return `${data} / ${validity}`;
  }
  function buildTechnologyLabel(source) {
    const technology = source?.networks?.technology?.filter(Boolean) || [];
    return technology.length ? `${technology.join("/")} High Speed` : "4G/5G High Speed";
  }
  function mapVariant(variant) {
    const esim = variant.attributes?.esim;
    return {
      id: variant.id,
      name: variant.name,
      value: buildEsimSummary(esim),
      type: "STYLE",
      price: variant.salePrice,
      inventory: variant.isActive === false ? 0 : 99
    };
  }
  function mapBokmooApiProductToThemeProduct(product) {
    const esim = product.typeData?.esim;
    const imageUrl = product.images?.[0]?.url || product.image;
    const regionTag = esim?.region || esim?.country || "Travel";
    const technology = buildTechnologyLabel(esim);
    return {
      id: product.id,
      name: product.name,
      description: product.description || `${product.name} travel connectivity package`,
      price: Number(product.price || 0),
      sku: product.slug || product.id,
      category: {
        id: esim?.region || "esim",
        name: esim?.region || "eSIM Plans",
        slug: (esim?.region || "esim").toLowerCase().replace(/\s+/g, "-"),
        level: 1,
        isActive: true,
        productCount: 0
      },
      tags: [regionTag, esim?.carrier || "Carrier", technology].filter(Boolean),
      images: imageUrl ? [
        {
          id: `${product.id}-image`,
          url: imageUrl,
          alt: product.name,
          order: 0,
          isMain: true
        }
      ] : [],
      variants: (product.variants || []).map(mapVariant),
      inventory: {
        quantity: 99,
        reserved: 0,
        available: 99,
        lowStockThreshold: 5,
        isInStock: true,
        isLowStock: false,
        trackInventory: false
      },
      specifications: [
        { name: "Coverage", value: esim?.country || esim?.region || "Global" },
        { name: "Data", value: esim?.data?.gb ? `${esim.data.gb}GB` : "Flexible" },
        { name: "Validity", value: esim?.validityDays ? `${esim.validityDays} Days` : "Flexible" },
        { name: "Carrier", value: esim?.carrier || "Local carrier" },
        { name: "Network", value: technology }
      ],
      isActive: true,
      isFeatured: true,
      rating: 4.9,
      reviewCount: 1200,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  function mapBokmooApiOrderToThemeOrder(order) {
    return {
      id: order.id,
      userId: "",
      status: order.status || order.fulfillmentStatus || order.paymentStatus || "PROCESSING",
      paymentStatus: order.paymentStatus || "PAID",
      totalAmount: Number(order.totalAmount || 0),
      currency: order.currency || "USD",
      shippingAddress: null,
      shipments: [],
      items: (order.items || []).map((item) => {
        const quantity = Number(item.quantity || 1);
        const unitPrice = Number(item.unitPrice ?? item.totalPrice ?? 0);
        const totalPrice = Number(item.totalPrice ?? unitPrice * quantity);
        return {
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          variantId: item.variantId || "",
          quantity,
          unitPrice,
          totalPrice,
          fulfillmentStatus: item.fulfillmentStatus || null,
          fulfillmentData: item.fulfillmentData || null
        };
      }),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt || order.createdAt,
      cancelReason: null,
      cancelledAt: null
    };
  }
  function normalizeProductForTheme(product) {
    const candidate = product;
    if (candidate && typeof candidate === "object" && Array.isArray(candidate.images) && Array.isArray(candidate.variants) && candidate.category && candidate.inventory) {
      return candidate;
    }
    return mapBokmooApiProductToThemeProduct(product);
  }
  function normalizeInstallSession(session) {
    const source = asRecord(session);
    const matchingId = readString(source, ["matchingId", "matching_id", "activationCode", "activation_code"]);
    const activationCode = readString(source, ["activationCode", "activation_code", "matchingId", "matching_id"]);
    const smdpAddress = readString(source, ["smdpAddress", "smdp_address", "smdpServer", "smdp_server", "smdp"]);
    const lpaString = readString(source, ["lpaString", "lpa_string", "lpa", "qrCodeContent", "qr_code_content"]) || (smdpAddress && (matchingId || activationCode) ? `LPA:1$${smdpAddress}$${matchingId || activationCode}` : "");
    const qrCode = readString(source, ["qrCode", "qr_code", "qrCodeUrl", "qr_code_url", "qrCodeContent", "qr_code_content"]) || lpaString;
    const instructions = normalizeInstructions(source.instructions);
    return {
      ...session,
      orderId: readString(source, ["orderId", "order_id"]) || session.orderId || "",
      orderNumber: readString(source, ["orderNumber", "order_number"]) || session.orderNumber || "",
      status: readString(source, ["status"]) || session.status || "processing",
      packageTitle: readString(source, ["packageTitle", "package_title"]) || session.packageTitle || "BOKMOO eSIM",
      qrCode,
      activationCode: activationCode || "",
      matchingId: matchingId || "",
      lpaString,
      smdpAddress,
      confirmationCode: readNullableString(source, ["confirmationCode", "confirmation_code", "confirmCode", "confirm_code"]) ?? null,
      instructions: {
        ios: instructions.ios || [],
        android: instructions.android || [],
        general: instructions.general || []
      },
      support: normalizeSupport(source.support, source)
    };
  }
  async function getBokmooProducts(config, params = {}) {
    const search = new URLSearchParams();
    search.set("page", String(params.page || 1));
    search.set("limit", String(params.limit || 12));
    search.set("locale", params.locale || "en");
    search.set("type", params.type || "esim");
    if (params.country) search.set("country", params.country);
    const envelope = await requestEnvelope(config, `/api/products?${search.toString()}`);
    const meta = envelope.meta || {};
    const data = envelope.data;
    const items = Array.isArray(data) ? data : data.items || [];
    const page = Number(meta.page || (!Array.isArray(data) ? data.page : void 0) || params.page || 1);
    const limit = Number(meta.limit || (!Array.isArray(data) ? data.limit : void 0) || params.limit || 12);
    const total = Number(meta.total || (!Array.isArray(data) ? data.total : void 0) || items.length);
    return {
      ...Array.isArray(data) ? {} : data,
      items,
      page,
      limit,
      total
    };
  }
  async function getBokmooProduct(config, productId, locale = "en") {
    return request(config, `/api/products/${productId}?locale=${locale}`);
  }
  async function getBokmooOrder(config, orderId) {
    return request(config, `/api/orders/${orderId}`);
  }
  async function getBokmooOrders(config, params = {}) {
    const search = new URLSearchParams();
    search.set("page", String(params.page || 1));
    search.set("limit", String(params.limit || 10));
    if (params.status) search.set("status", params.status);
    const envelope = await requestEnvelope(config, `/api/orders?${search.toString()}`);
    const meta = envelope.meta || {};
    const data = envelope.data;
    const items = Array.isArray(data) ? data : data.items || [];
    const page = Number(meta.page || (!Array.isArray(data) ? data.page : void 0) || params.page || 1);
    const limit = Number(meta.limit || (!Array.isArray(data) ? data.limit : void 0) || params.limit || 10);
    const total = Number(meta.total || (!Array.isArray(data) ? data.total : void 0) || items.length);
    return {
      ...Array.isArray(data) ? {} : data,
      items,
      page,
      limit,
      total
    };
  }
  async function getBokmooInstallSession(config, orderId) {
    const session = await request(config, `/api/orders/${orderId}/install-session`);
    return normalizeInstallSession(session);
  }

  // src/lib/digital-fulfillment.ts
  function toRecord(input) {
    if (!input) return {};
    if (typeof input === "string") {
      try {
        const parsed = JSON.parse(input);
        return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    }
    return typeof input === "object" && !Array.isArray(input) ? input : {};
  }
  function normalizeWords(input) {
    return input.replace(/[_-]+/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim();
  }
  function titleCase(input) {
    return normalizeWords(input).split(" ").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  }
  function valueToText(value) {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return "";
  }
  function looksLikeUrl(value) {
    return /^https?:\/\//i.test(value);
  }
  function hasKeyword(source, keywords) {
    return keywords.some((keyword) => source.includes(keyword));
  }
  function buildSearchText(product) {
    if (!product) return "";
    const specs = (product.specifications || []).map((item) => `${item.name} ${item.value}`).join(" ");
    return [
      product.name,
      product.description,
      product.category?.name,
      ...product.tags || [],
      specs
    ].filter(Boolean).join(" ").toLowerCase();
  }
  function findSpecificationValue(product, keywords) {
    if (!product?.specifications?.length) return "";
    const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());
    const match = product.specifications.find((spec) => {
      const haystack = `${spec.name} ${spec.group || ""}`.toLowerCase();
      return normalizedKeywords.some((keyword) => haystack.includes(keyword));
    });
    return match?.value?.trim() || "";
  }
  function extractByRegex(source, pattern) {
    const match = source.match(pattern);
    return match?.[1]?.trim() || match?.[0]?.trim() || "";
  }
  function pickCoverage(product, source) {
    return findSpecificationValue(product, ["coverage", "country", "countries", "destination", "region", "\u5730\u533A", "\u56FD\u5BB6", "\u8986\u76D6"]) || product?.category?.name || (product?.tags || []).find((tag) => !hasKeyword(tag.toLowerCase(), ["esim", "travel", "trip"])) || "200+ destinations";
  }
  function pickPlan(product, source) {
    return findSpecificationValue(product, ["data", "allowance", "plan", "package", "bundle", "\u6D41\u91CF", "\u5957\u9910"]) || extractByRegex(source, /\b(unlimited|\d+(?:\.\d+)?\s?(?:gb|mb|tb))\b/i) || "Flexible data bundle";
  }
  function pickDuration(product, source) {
    return findSpecificationValue(product, ["validity", "duration", "days", "period", "\u6709\u6548\u671F", "\u5929", "\u65E5"]) || extractByRegex(source, /\b(\d+\s?(?:day|days|week|weeks|month|months))\b/i) || "Flexible trip validity";
  }
  function pickNetwork(product, source) {
    const matchedSpeed = extractByRegex(source, /\b(5g|4g|lte)\b/i).toUpperCase();
    return findSpecificationValue(product, ["network", "speed", "carrier", "band", "\u7F51\u7EDC", "\u901F\u7387"]) || (matchedSpeed ? `${matchedSpeed} local carrier access` : "") || "Priority local carrier access";
  }
  function pickActivation(product, source) {
    if (hasKeyword(source, ["qr", "scan", "\u626B\u7801", "\u6FC0\u6D3B"])) {
      return "Install in seconds via QR";
    }
    return findSpecificationValue(product, ["activation", "delivery", "install", "setup", "\u6FC0\u6D3B", "\u5B89\u88C5", "\u4EA4\u4ED8"]) || "Instant eSIM delivery after payment";
  }
  function pickCompatibility(product) {
    return findSpecificationValue(product, ["compatibility", "device", "supported devices", "\u517C\u5BB9", "\u8BBE\u5907"]) || "Unlocked iPhone and Android devices with eSIM support";
  }
  function pickPlanBadge(planLabel) {
    if (/unlimited|无限/i.test(planLabel)) return "Unlimited";
    if (/\b\d+(?:\.\d+)?\s?(?:gb|mb|tb)\b/i.test(planLabel)) return planLabel;
    return "Travel bundle";
  }
  function getBokmooTravelProfile(product) {
    const source = buildSearchText(product);
    const coverageLabel = pickCoverage(product, source);
    const planLabel = pickPlan(product, source);
    const durationLabel = pickDuration(product, source);
    const networkLabel = pickNetwork(product, source);
    const activationLabel = pickActivation(product, source);
    const compatibilityLabel = pickCompatibility(product);
    const deliveryLabel = "Instant delivery via eSIM";
    const planBadge = pickPlanBadge(planLabel);
    const cardEyebrow = /global|world|europe|asia|全球|欧洲|亚洲/i.test(coverageLabel) ? "Global Plan" : "Destination eSIM";
    const specRows = [
      { label: "Coverage", value: coverageLabel },
      { label: "Plan", value: planLabel },
      { label: "Validity", value: durationLabel },
      { label: "Network", value: networkLabel },
      { label: "Activation", value: activationLabel },
      { label: "Compatibility", value: compatibilityLabel }
    ];
    return {
      coverageLabel,
      planLabel,
      durationLabel,
      networkLabel,
      activationLabel,
      compatibilityLabel,
      deliveryLabel,
      planBadge,
      cardEyebrow,
      summary: `${coverageLabel} \xB7 ${planLabel} \xB7 ${durationLabel}`,
      highlights: [planLabel, durationLabel, networkLabel],
      promises: [
        "Instant QR or eSIM profile delivery",
        "Keep your primary SIM in place",
        "Check compatibility before departure"
      ],
      specRows
    };
  }
  function flattenRecord(input, prefix = "") {
    const rows = [];
    for (const [rawKey, value] of Object.entries(input)) {
      if (value === null || value === void 0) continue;
      const key = prefix ? `${prefix}.${rawKey}` : rawKey;
      if (Array.isArray(value)) {
        rows.push({ key, value });
        continue;
      }
      if (typeof value === "object") {
        rows.push(...flattenRecord(value, key));
        continue;
      }
      rows.push({ key, value });
    }
    return rows;
  }
  function extractDeliverySections(fulfillmentData) {
    const data = toRecord(fulfillmentData);
    const sections3 = {
      codes: [],
      credentials: [],
      links: [],
      meta: [],
      notes: []
    };
    for (const row of flattenRecord(data)) {
      const { key, value } = row;
      if (value === null || value === void 0) continue;
      if (Array.isArray(value)) {
        if (value.every((item) => typeof item === "string")) {
          sections3.notes.push(...value.map((item) => String(item).trim()).filter(Boolean));
        }
        continue;
      }
      const text = valueToText(value);
      if (!text) continue;
      const normalizedKey = key.toLowerCase();
      const label = titleCase(key.split(".").slice(-1)[0] || key);
      if (looksLikeUrl(text)) {
        sections3.links.push({
          label,
          value: text,
          href: text,
          kind: "link"
        });
        continue;
      }
      if (hasKeyword(normalizedKey, ["instruction", "note", "remark", "hint"])) {
        sections3.notes.push(text);
        continue;
      }
      if (hasKeyword(normalizedKey, ["password", "secret", "username", "account", "login", "email"])) {
        sections3.credentials.push({
          label,
          value: text,
          kind: "credential",
          sensitive: hasKeyword(normalizedKey, ["password", "secret"])
        });
        continue;
      }
      if (hasKeyword(normalizedKey, ["code", "pin", "license", "serial", "token", "voucher", "redeem", "giftcard", "qr"])) {
        sections3.codes.push({
          label,
          value: text,
          kind: "code"
        });
        continue;
      }
      sections3.meta.push({
        label,
        value: text,
        kind: "meta"
      });
    }
    return sections3;
  }
  function getDeliveredArtifactCount(fulfillmentData) {
    const sections3 = extractDeliverySections(fulfillmentData);
    return sections3.codes.length + sections3.credentials.length + sections3.links.length;
  }

  // src/components/ProductsPage.tsx
  var CATALOG_FILTERS = ["All", "Popular", "Local", "Regional", "Global"];
  function getProductImage(product) {
    if (!product?.images?.length) return null;
    const primary = product.images.find((image) => image.isMain) || product.images[0];
    return primary?.url || null;
  }
  function productText(product) {
    const esim = product.typeData?.esim;
    return [product.name, product.description, esim?.country, esim?.region, esim?.carrier].filter(Boolean).join(" ").toLowerCase();
  }
  function matchesCatalogFilter(product, filter2) {
    const esim = product.typeData?.esim;
    const region = (esim?.region || "").toLowerCase();
    const country = (esim?.country || "").toLowerCase();
    if (filter2 === "All" || filter2 === "Popular") return true;
    if (filter2 === "Global") return region.includes("global") || country.includes("global");
    if (filter2 === "Regional") return Boolean(region && !region.includes("global") && region !== country);
    if (filter2 === "Local") return Boolean(country && (!region || region === country || !region.includes("global")));
    return true;
  }
  function ProductMedia({ product }) {
    const image = getProductImage(product);
    const profile = getBokmooTravelProfile(product);
    if (image) {
      return /* @__PURE__ */ jsx(
        "img",
        {
          src: image,
          alt: product.name,
          className: "h-full w-full object-cover"
        }
      );
    }
    return /* @__PURE__ */ jsxs("div", { className: "flex h-full w-full flex-col justify-between bg-[linear-gradient(160deg,color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent),transparent_55%),linear-gradient(180deg,var(--bokmoo-bg-soft),var(--bokmoo-bg))] p-5", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
        /* @__PURE__ */ jsx("span", { className: "rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] tracking-[0.2em] text-[var(--bokmoo-gold)]", children: profile.cardEyebrow }),
        /* @__PURE__ */ jsx("span", { className: "rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] tracking-[0.16em] text-[var(--bokmoo-copy)]", children: profile.planBadge })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-sm tracking-[0.22em] text-[var(--bokmoo-copy-soft)]", children: "BOKMOO" }),
        /* @__PURE__ */ jsx("p", { className: "mt-3 text-2xl leading-[0.98] tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: profile.coverageLabel })
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
    onSortChange,
    onViewModeChange,
    onPageChange,
    onAddToCart,
    onProductClick,
    onSearch,
    config,
    locale
  }) {
    const [searchQuery, setSearchQuery] = react_default.useState("");
    const [activeSearch, setActiveSearch] = react_default.useState("");
    const [remoteProducts, setRemoteProducts] = react_default.useState([]);
    const [remoteTotal, setRemoteTotal] = react_default.useState(0);
    const [remoteTotalPages, setRemoteTotalPages] = react_default.useState(1);
    const [remoteLoading, setRemoteLoading] = react_default.useState(false);
    const [remoteError, setRemoteError] = react_default.useState("");
    const [selectedFilter, setSelectedFilter] = react_default.useState("All");
    const site = resolveBokmooSiteConfig(config);
    const normalizedProducts = react_default.useMemo(
      () => (remoteProducts.length > 0 ? remoteProducts : products).map(
        (product) => normalizeProductForTheme(product)
      ),
      [products, remoteProducts]
    );
    const submitSearch = (event) => {
      event.preventDefault();
      if (onSearch) {
        onSearch(searchQuery.trim());
        return;
      }
      setActiveSearch(searchQuery.trim());
    };
    const loadRemoteProducts = react_default.useCallback(
      async (search = "") => {
        setRemoteLoading(true);
        setRemoteError("");
        try {
          const response = await getBokmooProducts(
            {
              baseUrl: site.apiBaseUrl
            },
            {
              page: currentPage || 1,
              limit: 12,
              locale: locale || "en",
              type: "esim"
            }
          );
          const filteredItems = search ? response.items.filter(
            (item) => productText(item).includes(search.toLowerCase())
          ) : response.items;
          const scopedItems = filteredItems.filter((item) => matchesCatalogFilter(item, selectedFilter));
          const isLocalScope = Boolean(search || selectedFilter !== "All");
          setRemoteProducts(scopedItems.map(mapBokmooApiProductToThemeProduct));
          setRemoteTotal(isLocalScope ? scopedItems.length : Number(response.total || scopedItems.length || 0));
          setRemoteTotalPages(Math.max(1, Math.ceil((isLocalScope ? scopedItems.length : Number(response.total || scopedItems.length || 0)) / 12)));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to load Bokmoo plans.";
          setRemoteError(message);
          setRemoteProducts([]);
          setRemoteTotal(0);
          setRemoteTotalPages(1);
        } finally {
          setRemoteLoading(false);
        }
      },
      [currentPage, locale, selectedFilter, site.apiBaseUrl]
    );
    react_default.useEffect(() => {
      if (products.length > 0) return;
      void loadRemoteProducts(activeSearch);
    }, [activeSearch, loadRemoteProducts, products.length]);
    if (isLoading || remoteLoading && normalizedProducts.length === 0) {
      return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)]" });
    }
    const displayTotal = remoteProducts.length > 0 ? remoteTotal : totalProducts;
    const displayTotalPages = remoteProducts.length > 0 ? remoteTotalPages : totalPages;
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent),transparent_34%),var(--bokmoo-bg)] px-4 pb-24 pt-16 sm:px-6 sm:pt-20 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1280px]", children: [
      /* @__PURE__ */ jsxs("section", { className: "rounded-[1.45rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_20%,var(--bokmoo-line))] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent),transparent_34%),color-mix(in_oklab,var(--bokmoo-bg-elevated)_76%,black)] p-5 shadow-[var(--bokmoo-shadow)] sm:rounded-[var(--bokmoo-radius-xl)] sm:p-8", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between", children: [
          /* @__PURE__ */ jsxs("div", { className: "max-w-2xl", children: [
            /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--bokmoo-copy)]", children: [
              /* @__PURE__ */ jsx(ShieldCheck, { className: "h-4 w-4 text-[var(--bokmoo-gold)]" }),
              "Plan Collection"
            ] }),
            /* @__PURE__ */ jsx("h1", { className: "mt-5 text-[clamp(2.3rem,5vw,4.6rem)] leading-[0.95] tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: "eSIM plans built for every journey." }),
            /* @__PURE__ */ jsx("p", { className: "mt-4 text-base leading-7 text-[var(--bokmoo-copy)]", children: "Explore destination-ready profiles, regional bundles, and premium data options with the clarity of a product catalog." })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "grid gap-3 sm:grid-cols-[minmax(16rem,1fr)_auto_auto] lg:min-w-[34rem]", children: [
            /* @__PURE__ */ jsxs("form", { onSubmit: submitSearch, className: "relative", children: [
              /* @__PURE__ */ jsx(Search, { className: "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  value: searchQuery,
                  onChange: (event) => setSearchQuery(event.target.value),
                  placeholder: "Search destinations or bundles...",
                  className: "h-12 w-full rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] pl-11 pr-4 text-sm text-[var(--bokmoo-ink)] outline-none placeholder:text-[var(--bokmoo-copy-soft)] sm:rounded-full"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: sortBy,
                onChange: (event) => onSortChange(event.target.value),
                className: "h-12 rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 text-sm font-medium text-[var(--bokmoo-ink)] outline-none sm:rounded-full",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "createdAt", children: "Newest" }),
                  /* @__PURE__ */ jsx("option", { value: "price", children: "Price" }),
                  /* @__PURE__ */ jsx("option", { value: "name", children: "Name" })
                ]
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-1 sm:rounded-full", children: [
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => onViewModeChange("grid"),
                  className: cn2(
                    "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                    viewMode === "grid" ? "bg-[var(--bokmoo-gold)] text-[var(--bokmoo-bg)]" : "text-[var(--bokmoo-copy)]"
                  ),
                  type: "button",
                  children: /* @__PURE__ */ jsx(Grid3x3, { className: "h-4 w-4" })
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => onViewModeChange("list"),
                  className: cn2(
                    "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                    viewMode === "list" ? "bg-[var(--bokmoo-gold)] text-[var(--bokmoo-bg)]" : "text-[var(--bokmoo-copy)]"
                  ),
                  type: "button",
                  children: /* @__PURE__ */ jsx(List, { className: "h-4 w-4" })
                }
              )
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between", children: [
          /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", children: CATALOG_FILTERS.map((filter2) => /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setSelectedFilter(filter2),
              className: cn2(
                "rounded-[0.8rem] border px-4 py-2 text-[11px] font-semibold transition-colors",
                selectedFilter === filter2 ? "border-[var(--bokmoo-line-strong)] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_88%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] text-[var(--bokmoo-bg)]" : "border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] text-[var(--bokmoo-copy)]"
              ),
              type: "button",
              children: filter2
            },
            filter2
          )) }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
            /* @__PURE__ */ jsxs("span", { className: "rounded-[0.8rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 py-2 text-[11px] font-semibold text-[var(--bokmoo-copy)]", children: [
              displayTotal,
              " plans"
            ] }),
            /* @__PURE__ */ jsx("span", { className: "rounded-[0.8rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 py-2 text-[11px] font-semibold text-[var(--bokmoo-copy)]", children: "Instant eSIM delivery" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx("section", { className: "mt-8", children: remoteError && normalizedProducts.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-10 text-center shadow-[var(--bokmoo-shadow)]", children: [
        /* @__PURE__ */ jsx("p", { className: "text-xl font-semibold text-[var(--bokmoo-ink)]", children: "Plans are unavailable right now." }),
        /* @__PURE__ */ jsx("p", { className: "mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--bokmoo-copy)]", children: remoteError }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => void loadRemoteProducts(searchQuery.trim()),
            className: "mt-6 min-h-11 rounded-[0.9rem] bg-[var(--bokmoo-gold)] px-5 text-sm font-semibold text-[var(--bokmoo-bg)]",
            type: "button",
            children: "Try Again"
          }
        )
      ] }) : normalizedProducts.length === 0 ? /* @__PURE__ */ jsx("div", { className: "rounded-[var(--bokmoo-radius-xl)] border border-dashed border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-16 text-center text-[var(--bokmoo-copy)]", children: "No plans matched the current search." }) : /* @__PURE__ */ jsx(
        "div",
        {
          className: cn2(
            "grid gap-3 sm:gap-4",
            viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
          ),
          children: normalizedProducts.map((product) => {
            const profile = getBokmooTravelProfile(product);
            return /* @__PURE__ */ jsxs(
              "article",
              {
                className: cn2(
                  "overflow-hidden rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg-elevated)_82%,black)] shadow-[var(--bokmoo-shadow)] transition-transform duration-300 hover:-translate-y-1 sm:rounded-[var(--bokmoo-radius-xl)]",
                  viewMode === "list" && "grid gap-4 p-4 md:grid-cols-[14rem_minmax(0,1fr)_12rem] md:items-center md:gap-5 md:p-5"
                ),
                children: [
                  /* @__PURE__ */ jsxs(
                    "button",
                    {
                      onClick: () => onProductClick(product.id),
                      className: cn2(viewMode === "grid" ? "block text-left" : "contents"),
                      type: "button",
                      children: [
                        /* @__PURE__ */ jsx(
                          "div",
                          {
                            className: cn2(
                              "overflow-hidden border-[var(--bokmoo-line)]",
                              viewMode === "grid" ? "aspect-[1.28/1] border-b sm:aspect-[1.18/1]" : "aspect-[1.45/1] rounded-[1rem] border md:aspect-auto md:h-full md:rounded-[var(--bokmoo-radius-lg)]"
                            ),
                            children: /* @__PURE__ */ jsx(ProductMedia, { product })
                          }
                        ),
                        /* @__PURE__ */ jsxs("div", { className: cn2(viewMode === "grid" ? "p-5" : "min-w-0"), children: [
                          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
                            /* @__PURE__ */ jsx("span", { className: "rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] tracking-[0.18em] text-[var(--bokmoo-gold)]", children: profile.cardEyebrow }),
                            /* @__PURE__ */ jsx("span", { className: "rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] tracking-[0.18em] text-[var(--bokmoo-copy)]", children: profile.deliveryLabel })
                          ] }),
                          /* @__PURE__ */ jsx("h2", { className: "mt-4 text-[clamp(1.7rem,2vw,2.4rem)] leading-[1] tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: product.name }),
                          /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--bokmoo-copy)]", children: product.description || profile.summary }),
                          /* @__PURE__ */ jsx("div", { className: "mt-5 grid gap-2 sm:grid-cols-3", children: [
                            ["Coverage", profile.coverageLabel],
                            ["Plan", profile.planLabel],
                            ["Validity", profile.durationLabel]
                          ].map(([label, value]) => /* @__PURE__ */ jsxs(
                            "div",
                            {
                              className: "rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-3 py-3",
                              children: [
                                /* @__PURE__ */ jsx("p", { className: "text-[10px] tracking-[0.16em] text-[var(--bokmoo-copy-soft)]", children: label }),
                                /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm font-medium text-[var(--bokmoo-ink)]", children: value })
                              ]
                            },
                            label
                          )) })
                        ] })
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsx("div", { className: cn2(viewMode === "grid" ? "px-5 pb-5" : "md:w-[12rem]"), children: /* @__PURE__ */ jsxs("div", { className: "rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_90%,black)] p-4", children: [
                    /* @__PURE__ */ jsx("p", { className: "text-[10px] tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Starting at" }),
                    /* @__PURE__ */ jsxs("p", { className: "mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: [
                      "$",
                      Number(product.price || 0).toFixed(2)
                    ] }),
                    /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs text-[var(--bokmoo-copy)]", children: profile.planBadge }),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => onAddToCart(product.id),
                        className: "mt-4 w-full rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-bg)]",
                        type: "button",
                        children: "Buy Now"
                      }
                    )
                  ] }) })
                ]
              },
              product.id
            );
          })
        }
      ) }),
      displayTotalPages > 1 ? /* @__PURE__ */ jsxs("nav", { className: "mt-10 flex items-center justify-center gap-2", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => onPageChange(Math.max(1, currentPage - 1)),
            disabled: currentPage <= 1,
            className: "flex h-11 w-11 items-center justify-center rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] text-[var(--bokmoo-ink)] disabled:opacity-40",
            type: "button",
            children: /* @__PURE__ */ jsx(ChevronLeft, { className: "h-4 w-4" })
          }
        ),
        /* @__PURE__ */ jsxs("span", { className: "rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-5 py-3 text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy)]", children: [
          "Page ",
          currentPage,
          " / ",
          displayTotalPages
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => onPageChange(Math.min(displayTotalPages, currentPage + 1)),
            disabled: currentPage >= displayTotalPages,
            className: "flex h-11 w-11 items-center justify-center rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] text-[var(--bokmoo-ink)] disabled:opacity-40",
            type: "button",
            children: /* @__PURE__ */ jsx(ChevronRight, { className: "h-4 w-4" })
          }
        )
      ] }) : null
    ] }) });
  });

  // src/components/CollectionPages.tsx
  var BestsellersPage = (props) => /* @__PURE__ */ jsx(
    ProductsPage,
    {
      ...props,
      totalProducts: props.totalProducts ?? props.products?.length ?? 0,
      currentPage: props.currentPage ?? 1,
      totalPages: props.totalPages ?? 1,
      viewMode: "grid",
      onViewModeChange: () => void 0,
      onSearch: () => void 0
    }
  );
  var NewArrivalsPage = (props) => /* @__PURE__ */ jsx(
    ProductsPage,
    {
      ...props,
      totalProducts: props.totalProducts ?? props.products?.length ?? 0,
      currentPage: props.currentPage ?? 1,
      totalPages: props.totalPages ?? 1,
      viewMode: "grid",
      onViewModeChange: () => void 0,
      onSearch: () => void 0
    }
  );
  var DealsPage = (props) => /* @__PURE__ */ jsx(
    ProductsPage,
    {
      products: props.products,
      isLoading: props.isLoading,
      totalProducts: props.products?.length ?? 0,
      currentPage: 1,
      totalPages: 1,
      sortBy: "createdAt",
      viewMode: "grid",
      config: props.config,
      locale: props.locale,
      t: props.t,
      onSortChange: () => void 0,
      onViewModeChange: () => void 0,
      onPageChange: () => void 0,
      onAddToCart: props.onAddToCart,
      onProductClick: props.onProductClick,
      onSearch: () => void 0
    }
  );
  var SearchPage = (props) => /* @__PURE__ */ jsx(
    ProductsPage,
    {
      products: props.products,
      isLoading: props.isLoading,
      totalProducts: props.products?.length ?? 0,
      currentPage: 1,
      totalPages: 1,
      sortBy: props.sortBy,
      viewMode: props.viewMode,
      config: props.config,
      locale: props.locale,
      t: props.t,
      onSortChange: props.onSortChange,
      onViewModeChange: props.onViewModeChange,
      onPageChange: () => void 0,
      onAddToCart: props.onAddToCart,
      onProductClick: props.onProductClick,
      onSearch: () => void 0
    }
  );

  // src/components/ContactPage.tsx
  var ContactPage = react_default.memo(function ContactPage2({ config }) {
    const site = resolveBokmooSiteConfig(config);
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--bokmoo-gold)_9%,transparent),transparent_34%),var(--bokmoo-bg)] px-4 pb-24 pt-8 sm:px-6 sm:pt-10 lg:px-8", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-[980px]", children: /* @__PURE__ */ jsx("div", { className: "overflow-hidden rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,var(--bokmoo-line))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_80%,black),color-mix(in_oklab,var(--bokmoo-bg-elevated)_92%,black))] shadow-[var(--bokmoo-shadow)] sm:rounded-[1.6rem]", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-7 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_20rem]", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]", children: "About BOKMOO" }),
        /* @__PURE__ */ jsx("h1", { className: "mt-4 text-[clamp(2.2rem,4vw,3.6rem)] font-semibold leading-[0.96] tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: "BOKMOO is built for global travelers." }),
        /* @__PURE__ */ jsx("p", { className: "mt-5 max-w-2xl text-base leading-8 text-[var(--bokmoo-copy)]", children: "Our mission is to make connectivity simple, affordable, and reliable anywhere in the world." }),
        /* @__PURE__ */ jsx(
          "a",
          {
            href: `mailto:${site.supportEmail}`,
            className: "mt-6 inline-flex min-h-11 items-center justify-center rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-5 text-sm font-medium text-[var(--bokmoo-ink)]",
            children: site.supportEmail
          }
        ),
        /* @__PURE__ */ jsx("div", { className: "mt-8 grid gap-4 sm:grid-cols-3", children: [
          ["200+", "Countries"],
          ["1M+", "Happy Users"],
          ["99.9%", "Uptime"]
        ].map(([value, label]) => /* @__PURE__ */ jsxs(
          "div",
          {
            className: "rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 py-5",
            children: [
              /* @__PURE__ */ jsx("p", { className: "text-3xl font-semibold tracking-[-0.05em] text-[var(--bokmoo-gold)]", children: value }),
              /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-[var(--bokmoo-copy-soft)]", children: label })
            ]
          },
          label
        )) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "relative min-h-[15rem] overflow-hidden rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_20%,var(--bokmoo-line))] bg-[linear-gradient(160deg,#30261c_0%,#141210_56%,#0a0a0b_100%)] sm:min-h-[19rem] sm:rounded-[1.4rem]", children: [
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_58%_42%,rgba(215,178,61,0.34),transparent_26%)]" }),
        /* @__PURE__ */ jsx("div", { className: "absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)]" }),
        /* @__PURE__ */ jsx("div", { className: "absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)]" })
      ] })
    ] }) }) }) });
  });

  // src/components/Footer.tsx
  var Footer = react_default.memo(function Footer2({
    locale,
    config,
    onNavigate,
    onNavigateToProducts,
    onNavigateToCategories,
    onNavigateToHelp,
    onNavigateToContact,
    onNavigateToPrivacy,
    onNavigateToTerms
  }) {
    const site = resolveBokmooSiteConfig(config);
    const year = (/* @__PURE__ */ new Date()).getFullYear();
    const isZhHant = locale === "zh-Hant";
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
    return /* @__PURE__ */ jsxs("footer", { className: "border-t border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_72%,black),var(--bokmoo-bg))] px-4 pb-28 pt-14 sm:px-6 sm:pb-16 lg:px-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1280px]", children: [
        /* @__PURE__ */ jsxs("div", { className: "grid gap-9 rounded-[1.5rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_84%,black)] p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.9fr)]", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,var(--bokmoo-line))] bg-[var(--bokmoo-bg)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]", children: [
              /* @__PURE__ */ jsx(ShieldCheck, { className: "h-4 w-4" }),
              isZhHant ? "\u5168\u7403 eSIM \u57FA\u790E\u8A2D\u65BD" : "Global eSIM Infrastructure"
            ] }),
            /* @__PURE__ */ jsx("h2", { className: "mt-6 text-[clamp(2.4rem,4vw,4.4rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-[var(--bokmoo-ink)]", children: isZhHant ? "\u51FA\u767C\u524D\u5B8C\u6210\u65C5\u904A\u9023\u7DDA\u8A2D\u5B9A\uFF0C\u843D\u5730\u5373\u53EF\u4F7F\u7528\u3002" : "Build your travel setup before departure, not after landing." }),
            /* @__PURE__ */ jsx("p", { className: "mt-4 max-w-2xl text-base leading-8 text-[var(--bokmoo-copy)]", children: isZhHant ? "\u63A2\u7D22\u9069\u7528\u65BC\u5404\u76EE\u7684\u5730\u7684 eSIM \u65B9\u6848\u3001\u5373\u6642\u555F\u7528\u8A2D\u5B9A\u6A94\uFF0C\u4E26\u96C6\u4E2D\u7BA1\u7406\u4E0B\u4E00\u8D9F\u65C5\u7A0B\u3002" : "Explore destination-ready eSIM plans, activate profiles instantly, and manage your next trip from one premium control surface." }),
            /* @__PURE__ */ jsxs("div", { className: "mt-8 flex flex-col gap-3 sm:flex-row", children: [
              /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => openHref(site.primaryCtaHref),
                  className: "inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-6 text-sm font-semibold text-[var(--bokmoo-bg)]",
                  type: "button",
                  children: [
                    site.primaryCtaLabel,
                    /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4" })
                  ]
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => openHref(site.secondaryCtaHref),
                  className: "inline-flex min-h-12 items-center justify-center rounded-[0.9rem] border border-[var(--bokmoo-line)] px-6 text-sm font-medium text-[var(--bokmoo-ink)]",
                  type: "button",
                  children: site.secondaryCtaLabel
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "grid gap-6 sm:grid-cols-3", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("div", { className: "mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: [
                /* @__PURE__ */ jsx(Earth, { className: "h-4 w-4 text-[var(--bokmoo-gold)]" }),
                isZhHant ? "\u7522\u54C1" : "Product"
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "grid gap-2 text-sm", children: [
                /* @__PURE__ */ jsx("button", { onClick: onNavigateToProducts, className: "rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]", type: "button", children: isZhHant ? "eSIM \u65B9\u6848" : "eSIM Plans" }),
                /* @__PURE__ */ jsx("button", { onClick: onNavigateToCategories, className: "rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]", type: "button", children: isZhHant ? "eUICC \u5361" : "eUICC Cards" }),
                /* @__PURE__ */ jsx("button", { onClick: onNavigateToHelp, className: "rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]", type: "button", children: isZhHant ? "\u4F7F\u7528\u65B9\u5F0F" : "How It Works" })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("div", { className: "mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: [
                /* @__PURE__ */ jsx(Smartphone, { className: "h-4 w-4 text-[var(--bokmoo-gold)]" }),
                isZhHant ? "\u516C\u53F8" : "Company"
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "grid gap-2 text-sm", children: [
                /* @__PURE__ */ jsx("button", { onClick: onNavigateToContact, className: "rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]", type: "button", children: isZhHant ? "\u652F\u63F4" : "Support" }),
                /* @__PURE__ */ jsx("button", { onClick: onNavigateToPrivacy, className: "rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]", type: "button", children: isZhHant ? "\u96B1\u79C1\u6B0A" : "Privacy" }),
                /* @__PURE__ */ jsx("button", { onClick: onNavigateToTerms, className: "rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]", type: "button", children: isZhHant ? "\u670D\u52D9\u689D\u6B3E" : "Terms" })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: isZhHant ? "\u806F\u7D61\u6211\u5011" : "Contact" }),
              /* @__PURE__ */ jsx(
                "a",
                {
                  href: `mailto:${site.supportEmail}`,
                  className: "text-sm text-[var(--bokmoo-ink)] underline decoration-[var(--bokmoo-line)] underline-offset-4",
                  children: site.supportEmail
                }
              ),
              /* @__PURE__ */ jsx("p", { className: "mt-4 text-sm leading-7 text-[var(--bokmoo-copy)]", children: isZhHant ? "\u5168\u5929\u5019\u63D0\u4F9B\u555F\u7528\u3001\u76F8\u5BB9\u6027\u8207\u65C5\u904A\u8A2D\u5B9A\u6A94\u7BA1\u7406\u652F\u63F4\u3002" : "24/7 global support for activation, compatibility, and travel profile management." })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-8 flex flex-col gap-3 border-t border-[var(--bokmoo-line)] pt-6 text-sm text-[var(--bokmoo-copy)] sm:mt-12 sm:flex-row sm:items-center sm:justify-between", children: [
          /* @__PURE__ */ jsxs("p", { children: [
            "\xA9 ",
            year,
            " ",
            site.brandName.toUpperCase(),
            ". ",
            isZhHant ? "\u5B98\u65B9\u5168\u7403 eSIM \u5546\u5E97\u3002" : "Official global eSIM storefront."
          ] }),
          /* @__PURE__ */ jsx("p", { children: isZhHant ? "\u7121\u754C\u9023\u7DDA\u3001\u5B89\u5168\u555F\u7528\u8207\u512A\u8CEA\u65C5\u904A\u6578\u64DA\u7BA1\u7406\u3002" : "Boundless connectivity, secure activation, and premium travel data management." })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "fixed inset-x-0 bottom-0 z-40 border-t border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,var(--bokmoo-line))] bg-[color:oklch(0.07_0.01_75_/_0.96)] px-3 pb-[calc(0.65rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-18px_50px_rgba(0,0,0,0.36)] backdrop-blur-xl sm:hidden", children: /* @__PURE__ */ jsx("div", { className: "mx-auto grid max-w-[420px] grid-cols-5 gap-1", children: [
        { label: isZhHant ? "\u9996\u9801" : "Home", icon: House, onClick: () => onNavigate?.("/") },
        { label: isZhHant ? "\u5546\u5E97" : "Store", icon: LayoutGrid, onClick: onNavigateToProducts },
        { label: isZhHant ? "\u8A02\u55AE" : "Orders", icon: ReceiptText, onClick: () => onNavigate?.("/orders") },
        { label: isZhHant ? "\u652F\u63F4" : "Support", icon: LifeBuoy, onClick: onNavigateToHelp },
        { label: isZhHant ? "\u9078\u55AE" : "Menu", icon: Smartphone, onClick: onNavigateToCategories }
      ].map(({ label, icon: Icon2, onClick }) => /* @__PURE__ */ jsxs(
        "button",
        {
          onClick,
          className: "flex flex-col items-center justify-center gap-1 rounded-[0.85rem] border border-transparent px-2 py-2 text-[11px] text-[var(--bokmoo-copy-soft)] transition-colors hover:border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent)] hover:bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_8%,transparent)] hover:text-[var(--bokmoo-gold)]",
          type: "button",
          children: [
            /* @__PURE__ */ jsx(Icon2, { className: "h-4 w-4" }),
            /* @__PURE__ */ jsx("span", { children: label })
          ]
        },
        label
      )) }) })
    ] });
  });

  // src/components/Header.tsx
  var FOCUS_VISIBLE_RING2 = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bokmoo-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bokmoo-bg)]";
  function BokmooLogoMark() {
    return /* @__PURE__ */ jsxs(
      "svg",
      {
        className: "h-7 w-[4.7rem] shrink-0 drop-shadow-[0_10px_22px_color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] transition-transform duration-300 group-hover:-translate-y-0.5 sm:h-8 sm:w-[5.35rem] xl:h-9 xl:w-24",
        viewBox: "0 38 134 50",
        fill: "none",
        "aria-hidden": "true",
        children: [
          /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsxs("linearGradient", { id: "bokmoo-mark-gold", x1: "4", y1: "43", x2: "126", y2: "94", gradientUnits: "userSpaceOnUse", children: [
            /* @__PURE__ */ jsx("stop", { stopColor: "#F4CD63" }),
            /* @__PURE__ */ jsx("stop", { offset: "0.52", stopColor: "var(--bokmoo-gold)" }),
            /* @__PURE__ */ jsx("stop", { offset: "1", stopColor: "#C99B3E" })
          ] }) }),
          /* @__PURE__ */ jsx(
            "path",
            {
              d: "M1 85C1 61.25 17.65 42 38.2 42C58.75 42 75.4 61.25 75.4 85H57.3C57.3 72.85 48.75 63 38.2 63C27.65 63 19.1 72.85 19.1 85H1Z",
              fill: "url(#bokmoo-mark-gold)"
            }
          ),
          /* @__PURE__ */ jsx(
            "path",
            {
              d: "M56.2 85C56.2 61.25 73.35 42 94.5 42C115.65 42 132.8 61.25 132.8 85H114.2C114.2 72.85 105.38 63 94.5 63C83.62 63 74.8 72.85 74.8 85H56.2Z",
              fill: "url(#bokmoo-mark-gold)"
            }
          ),
          /* @__PURE__ */ jsx(
            "path",
            {
              d: "M27.3 85C27.3 78.08 32.18 72.48 38.2 72.48C44.22 72.48 49.1 78.08 49.1 85H27.3Z",
              fill: "url(#bokmoo-mark-gold)"
            }
          ),
          /* @__PURE__ */ jsx(
            "path",
            {
              d: "M83.25 85C83.25 78.08 88.29 72.48 94.5 72.48C100.71 72.48 105.75 78.08 105.75 85H83.25Z",
              fill: "url(#bokmoo-mark-gold)"
            }
          )
        ]
      }
    );
  }
  var Header = react_default.memo(function Header2({
    locale,
    isAuthenticated,
    user,
    cartItemCount,
    config,
    onNavigate,
    onLogout,
    onNavigateToCart,
    onNavigateToProfile,
    onNavigateToLogin,
    onNavigateToRegister,
    onNavigateToHome,
    onNavigateToProducts
  }) {
    const [isMenuOpen, setIsMenuOpen] = react_default.useState(false);
    const site = resolveBokmooSiteConfig(config);
    const mobileMenuId = "bokmoo-mobile-menu";
    const isZhHant = locale === "zh-Hant";
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
    const navItems = [
      { label: isZhHant ? "\u5546\u5E97" : "Store", onClick: onNavigateToProducts },
      { label: isZhHant ? "\u670D\u52D9\u7BC4\u570D" : "Coverage", onClick: onNavigateToProducts },
      { label: isZhHant ? "\u4F7F\u7528\u65B9\u5F0F" : "How It Works", onClick: () => openHref("/#how-it-works") },
      { label: isZhHant ? "\u95DC\u65BC\u6211\u5011" : "About Us", onClick: () => openHref("/contact") },
      { label: isZhHant ? "\u652F\u63F4" : "Support", onClick: () => openHref("/help") }
    ];
    return /* @__PURE__ */ jsxs("header", { className: "sticky top-0 z-50 border-b border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent)] bg-[radial-gradient(circle_at_8%_-24%,color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent),transparent_34%),linear-gradient(180deg,oklch(0.055_0.007_75_/_0.98),oklch(0.028_0.004_75_/_0.96))] shadow-[0_18px_52px_rgba(0,0,0,0.3)] backdrop-blur-2xl", children: [
      /* @__PURE__ */ jsxs("div", { className: "mx-auto flex max-w-[107rem] items-center gap-3 px-4 py-2.5 sm:px-6 xl:min-h-[4.35rem] xl:gap-5 xl:px-0", children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: onNavigateToHome,
            className: `group flex shrink-0 items-center gap-2.5 rounded-[0.95rem] text-left sm:gap-3 ${FOCUS_VISIBLE_RING2}`,
            type: "button",
            "aria-label": `${site.brandName} home`,
            children: [
              /* @__PURE__ */ jsx(BokmooLogoMark, {}),
              /* @__PURE__ */ jsx("span", { className: "text-[0.98rem] font-bold tracking-[0.16em] text-[var(--bokmoo-ink)] drop-shadow-[0_0_14px_color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)] sm:text-[1.08rem] xl:text-[1.18rem] xl:tracking-[0.18em]", children: site.brandName.toUpperCase() })
            ]
          }
        ),
        /* @__PURE__ */ jsx("nav", { className: "ml-8 hidden items-center gap-8 xl:flex 2xl:ml-14 2xl:gap-10", children: navItems.map((item) => /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => {
              item.onClick();
              setIsMenuOpen(false);
            },
            className: `group relative rounded-[0.75rem] px-1 py-2.5 text-[0.95rem] font-medium tracking-[-0.01em] text-[color:color-mix(in_oklab,var(--bokmoo-copy)_88%,white)] transition-colors duration-300 hover:text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING2}`,
            type: "button",
            children: [
              /* @__PURE__ */ jsx("span", { className: "absolute inset-x-0 bottom-1 h-px origin-left scale-x-0 bg-[linear-gradient(90deg,var(--bokmoo-gold),transparent)] transition-transform duration-300 group-hover:scale-x-100" }),
              item.label
            ]
          },
          item.label
        )) }),
        /* @__PURE__ */ jsxs("div", { className: "ml-auto hidden items-center gap-3 xl:flex", children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              className: `inline-flex min-h-[2.75rem] items-center gap-2 rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_20%,transparent)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.012))] px-4 text-sm text-[var(--bokmoo-copy)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-[color:color-mix(in_oklab,var(--bokmoo-gold)_48%,transparent)] hover:text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING2}`,
              type: "button",
              children: [
                /* @__PURE__ */ jsx(Earth, { className: "h-4 w-4 text-[var(--bokmoo-gold)]" }),
                isZhHant ? "\u7E41\u9AD4\u4E2D\u6587" : "English",
                /* @__PURE__ */ jsx(ChevronDown, { className: "h-4 w-4" })
              ]
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: isAuthenticated ? onNavigateToProfile : onNavigateToLogin,
              className: `inline-flex min-h-[2.75rem] items-center justify-center rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_28%,transparent)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.16))] px-5 text-sm font-medium text-[var(--bokmoo-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING2}`,
              type: "button",
              children: isAuthenticated ? user?.firstName || (isZhHant ? "\u5E33\u6236" : "Account") : isZhHant ? "\u767B\u5165" : "Log In"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: isAuthenticated ? onNavigateToProfile : onNavigateToRegister,
              className: `inline-flex min-h-[2.75rem] items-center justify-center rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_46%,white)] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_88%,white),color-mix(in_oklab,var(--bokmoo-gold)_64%,black))] px-6 text-sm font-bold tracking-[0.01em] text-[var(--bokmoo-bg)] shadow-[0_14px_30px_color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent),inset_0_1px_0_rgba(255,255,255,0.34)] transition-transform duration-300 hover:-translate-y-0.5 ${FOCUS_VISIBLE_RING2}`,
              type: "button",
              children: isAuthenticated ? isZhHant ? "\u63A7\u5236\u53F0" : "Dashboard" : isZhHant ? "\u7ACB\u5373\u958B\u59CB" : "Get Started"
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: onNavigateToCart,
              className: `relative inline-flex h-[2.75rem] w-[2.75rem] items-center justify-center rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(0,0,0,0.18))] text-[var(--bokmoo-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING2}`,
              "aria-label": isZhHant ? "\u958B\u555F\u8CFC\u7269\u8ECA" : "Open cart",
              type: "button",
              children: [
                /* @__PURE__ */ jsx(ShoppingBag, { className: "h-4 w-4" }),
                cartItemCount > 0 ? /* @__PURE__ */ jsx("span", { className: "absolute -right-1 -top-1 flex min-h-[1.2rem] min-w-[1.2rem] items-center justify-center rounded-full bg-[var(--bokmoo-gold)] px-1 text-[10px] font-bold text-[var(--bokmoo-bg)]", children: cartItemCount > 99 ? "99+" : cartItemCount }) : null
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => setIsMenuOpen((value) => !value),
            className: `ml-auto flex h-11 w-11 items-center justify-center rounded-[0.8rem] border border-[var(--bokmoo-line)] text-[var(--bokmoo-ink)] xl:hidden ${FOCUS_VISIBLE_RING2}`,
            "aria-controls": mobileMenuId,
            "aria-expanded": isMenuOpen,
            "aria-label": isMenuOpen ? isZhHant ? "\u95DC\u9589\u9078\u55AE" : "Close menu" : isZhHant ? "\u958B\u555F\u9078\u55AE" : "Open menu",
            type: "button",
            children: isMenuOpen ? /* @__PURE__ */ jsx(X, { className: "h-5 w-5" }) : /* @__PURE__ */ jsx(Menu, { className: "h-5 w-5" })
          }
        )
      ] }),
      isMenuOpen ? /* @__PURE__ */ jsx("div", { id: mobileMenuId, className: "border-t border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 py-4 xl:hidden", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-2", children: [
        navItems.map((item) => /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => {
              item.onClick();
              setIsMenuOpen(false);
            },
            className: `rounded-[0.9rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING2}`,
            type: "button",
            children: item.label
          },
          item.label
        )),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => {
              onNavigateToCart();
              setIsMenuOpen(false);
            },
            className: `rounded-[0.9rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING2}`,
            type: "button",
            children: isZhHant ? "\u8CFC\u7269\u8ECA" : "Cart"
          }
        ),
        isAuthenticated ? /* @__PURE__ */ jsxs(Fragment2, { children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                onNavigateToProfile();
                setIsMenuOpen(false);
              },
              className: `rounded-[0.9rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING2}`,
              type: "button",
              children: isZhHant ? "\u5E33\u6236" : "Account"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                onLogout();
                setIsMenuOpen(false);
              },
              className: `rounded-[0.9rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-copy)] ${FOCUS_VISIBLE_RING2}`,
              type: "button",
              children: isZhHant ? "\u767B\u51FA" : "Log Out"
            }
          )
        ] }) : /* @__PURE__ */ jsxs(Fragment2, { children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                onNavigateToLogin();
                setIsMenuOpen(false);
              },
              className: `rounded-[0.9rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING2}`,
              type: "button",
              children: isZhHant ? "\u767B\u5165" : "Log In"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                onNavigateToRegister();
                setIsMenuOpen(false);
              },
              className: `rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-4 py-3 text-left text-sm font-semibold text-[var(--bokmoo-bg)] ${FOCUS_VISIBLE_RING2}`,
              type: "button",
              children: isZhHant ? "\u7ACB\u5373\u958B\u59CB" : "Get Started"
            }
          )
        ] })
      ] }) }) : null
    ] });
  });

  // src/components/HelpPage.tsx
  var topics = [
    {
      title: "How to install eSIM",
      subtitle: "Step-by-step guide",
      icon: QrCode
    },
    {
      title: "How eSIM works",
      subtitle: "Learn the basics",
      icon: Earth
    },
    {
      title: "Supported devices",
      subtitle: "Check compatibility",
      icon: ShieldCheck
    },
    {
      title: "Top up & Data plans",
      subtitle: "Manage your plan",
      icon: Signal
    }
  ];
  var HelpPage = react_default.memo(function HelpPage2({ onNavigateToContact }) {
    const [query, setQuery] = react_default.useState("");
    const filtered = topics.filter(
      (topic) => !query ? true : `${topic.title} ${topic.subtitle}`.toLowerCase().includes(query.toLowerCase())
    );
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--bokmoo-gold)_9%,transparent),transparent_34%),var(--bokmoo-bg)] px-4 pb-24 pt-8 sm:px-6 sm:pt-10 lg:px-8", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-[980px]", children: /* @__PURE__ */ jsxs("div", { className: "rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,var(--bokmoo-line))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_80%,black),color-mix(in_oklab,var(--bokmoo-bg-elevated)_92%,black))] p-5 shadow-[var(--bokmoo-shadow)] sm:rounded-[1.6rem] sm:p-8", children: [
      /* @__PURE__ */ jsx("div", { className: "flex items-center justify-between gap-4", children: /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]", children: "BOKMOO" }),
        /* @__PURE__ */ jsx("h1", { className: "mt-3 text-[clamp(2.2rem,4vw,3.6rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: "Help Center" })
      ] }) }),
      /* @__PURE__ */ jsx("div", { className: "mt-6", children: /* @__PURE__ */ jsx(
        "input",
        {
          value: query,
          onChange: (event) => setQuery(event.target.value),
          placeholder: "Search for help...",
          className: "h-12 w-full rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none placeholder:text-[var(--bokmoo-copy-soft)]"
        }
      ) }),
      /* @__PURE__ */ jsxs("div", { className: "mt-8", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Popular Topics" }),
        /* @__PURE__ */ jsx("div", { className: "mt-4 grid gap-3", children: filtered.map(({ title, subtitle, icon: Icon2 }) => /* @__PURE__ */ jsxs(
          "button",
          {
            className: "flex items-center justify-between rounded-[1rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 py-4 text-left transition-colors hover:border-[color:color-mix(in_oklab,var(--bokmoo-gold)_32%,var(--bokmoo-line))] hover:bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_82%,black)]",
            type: "button",
            children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                /* @__PURE__ */ jsx("div", { className: "flex h-11 w-11 items-center justify-center rounded-[0.9rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(Icon2, { className: "h-5 w-5" }) }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[var(--bokmoo-ink)]", children: title }),
                  /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-[var(--bokmoo-copy-soft)]", children: subtitle })
                ] })
              ] }),
              /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4 text-[var(--bokmoo-copy-soft)]" })
            ]
          },
          title
        )) })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => onNavigateToContact?.(),
          className: "mt-8 inline-flex min-h-12 items-center justify-center rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-6 text-sm font-semibold text-[var(--bokmoo-bg)]",
          type: "button",
          children: "Contact Support"
        }
      )
    ] }) }) });
  });

  // src/components/HomePage.tsx
  var BOKMOO_HERO_CARD_SRC = "/theme-assets/bokmoo/bokmoo-hero-card-product.png?v=20260716";
  var FOCUS_VISIBLE_RING3 = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bokmoo-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bokmoo-bg)]";
  function HeroPillar({ className }) {
    return /* @__PURE__ */ jsx(
      "div",
      {
        className: `absolute w-px bg-[linear-gradient(180deg,transparent,color-mix(in_oklab,var(--bokmoo-gold)_82%,transparent),transparent)] shadow-[0_0_52px_color-mix(in_oklab,var(--bokmoo-gold)_48%,transparent)] ${className}`
      }
    );
  }
  function WorldGlobe() {
    const dots = [
      [22, 44],
      [29, 36],
      [38, 51],
      [47, 32],
      [52, 45],
      [59, 39],
      [68, 50],
      [73, 35],
      [81, 43]
    ];
    return /* @__PURE__ */ jsxs("div", { className: "absolute -right-[24%] top-[-5%] hidden h-[58rem] w-[92rem] opacity-100 lg:block xl:-right-[21%] 2xl:-right-[16%] 2xl:top-[-8%]", children: [
      /* @__PURE__ */ jsx("div", { className: "absolute inset-[-8%] rounded-full bg-[radial-gradient(circle_at_52%_52%,color-mix(in_oklab,var(--bokmoo-gold)_58%,transparent),transparent_58%)] blur-3xl" }),
      /* @__PURE__ */ jsxs("svg", { className: "absolute inset-0 h-full w-full", viewBox: "0 0 760 520", "aria-hidden": "true", children: [
        /* @__PURE__ */ jsxs("defs", { children: [
          /* @__PURE__ */ jsxs("radialGradient", { id: "bokmooGlobeGlow", cx: "54%", cy: "52%", r: "48%", children: [
            /* @__PURE__ */ jsx("stop", { offset: "0%", stopColor: "rgba(226,188,94,0.58)" }),
            /* @__PURE__ */ jsx("stop", { offset: "58%", stopColor: "rgba(226,188,94,0.24)" }),
            /* @__PURE__ */ jsx("stop", { offset: "100%", stopColor: "rgba(226,188,94,0)" })
          ] }),
          /* @__PURE__ */ jsxs("linearGradient", { id: "bokmooGlobeLine", x1: "0", x2: "1", y1: "0", y2: "1", children: [
            /* @__PURE__ */ jsx("stop", { offset: "0%", stopColor: "rgba(244,203,111,0)" }),
            /* @__PURE__ */ jsx("stop", { offset: "48%", stopColor: "rgba(244,203,111,0.88)" }),
            /* @__PURE__ */ jsx("stop", { offset: "100%", stopColor: "rgba(244,203,111,0)" })
          ] })
        ] }),
        /* @__PURE__ */ jsx("ellipse", { cx: "430", cy: "260", rx: "310", ry: "180", fill: "url(#bokmooGlobeGlow)" }),
        /* @__PURE__ */ jsx("ellipse", { cx: "430", cy: "260", rx: "318", ry: "182", fill: "none", stroke: "rgba(226,188,94,0.52)", strokeWidth: "1.6" }),
        /* @__PURE__ */ jsx("ellipse", { cx: "430", cy: "260", rx: "245", ry: "126", fill: "none", stroke: "rgba(226,188,94,0.36)", strokeWidth: "1.2" }),
        /* @__PURE__ */ jsx("ellipse", { cx: "430", cy: "260", rx: "150", ry: "78", fill: "none", stroke: "rgba(226,188,94,0.28)", strokeWidth: "1.1" }),
        /* @__PURE__ */ jsx("path", { d: "M150 264 C270 210 410 208 548 248 C604 264 664 258 714 226", fill: "none", stroke: "url(#bokmooGlobeLine)", strokeWidth: "2.6" }),
        /* @__PURE__ */ jsx("path", { d: "M168 310 C286 260 390 286 498 322 C572 346 640 334 710 292", fill: "none", stroke: "rgba(226,188,94,0.46)", strokeWidth: "1.7" }),
        /* @__PURE__ */ jsx("path", { d: "M202 220 C316 178 468 172 612 214", fill: "none", stroke: "rgba(226,188,94,0.34)", strokeWidth: "1.35" }),
        /* @__PURE__ */ jsx("path", { d: "M300 120 C342 212 342 316 302 404", fill: "none", stroke: "rgba(226,188,94,0.34)", strokeWidth: "1.2" }),
        /* @__PURE__ */ jsx("path", { d: "M430 84 C410 198 412 322 456 432", fill: "none", stroke: "rgba(226,188,94,0.4)", strokeWidth: "1.3" }),
        /* @__PURE__ */ jsx("path", { d: "M570 128 C530 220 528 320 592 410", fill: "none", stroke: "rgba(226,188,94,0.32)", strokeWidth: "1.2" }),
        dots.map(([x, y]) => /* @__PURE__ */ jsx(
          "circle",
          {
            cx: x / 100 * 760,
            cy: y / 100 * 520,
            r: "4.6",
            fill: "rgba(244,203,111,0.96)",
            filter: "drop-shadow(0 0 14px rgba(244,203,111,0.82))"
          },
          `${x}-${y}`
        ))
      ] })
    ] });
  }
  function DestinationScene({ scene }) {
    const waterGradientId = react_default.useId().replace(/:/g, "");
    const skyByScene = {
      japan: "from-[#d77365] via-[#344d81] to-[#080b12]",
      usa: "from-[#7390c8] via-[#34506d] to-[#07101a]",
      europe: "from-[#d99d7a] via-[#5c4051] to-[#100d12]",
      "hong-kong": "from-[#234f78] via-[#142c45] to-[#060910]",
      thailand: "from-[#b9906c] via-[#56405b] to-[#09070d]",
      singapore: "from-[#4f89a4] via-[#173b4a] to-[#071012]",
      korea: "from-[#7b8fc9] via-[#353c65] to-[#0d0b12]",
      malaysia: "from-[#6b8c66] via-[#2e493a] to-[#071009]",
      uk: "from-[#7789a5] via-[#333c4c] to-[#0c0d12]",
      italy: "from-[#d49b72] via-[#634034] to-[#100c0b]",
      canada: "from-[#8598af] via-[#394b5d] to-[#0a0d11]",
      mexico: "from-[#b18a58] via-[#514028] to-[#100c09]",
      global: "from-[#80613b] via-[#292019] to-[#070605]"
    };
    return /* @__PURE__ */ jsxs("div", { className: `absolute inset-0 bg-gradient-to-br ${skyByScene[scene]}`, children: [
      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_24%_16%,rgba(255,210,132,0.58),transparent_15%),radial-gradient(circle_at_70%_12%,rgba(255,196,104,0.2),transparent_22%)]" }),
      /* @__PURE__ */ jsxs("svg", { className: "absolute inset-0 h-full w-full", viewBox: "0 0 420 260", preserveAspectRatio: "none", "aria-hidden": "true", children: [
        /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsxs("linearGradient", { id: waterGradientId, x1: "0", x2: "1", y1: "0", y2: "1", children: [
          /* @__PURE__ */ jsx("stop", { offset: "0%", stopColor: "rgba(255,255,255,0.16)" }),
          /* @__PURE__ */ jsx("stop", { offset: "100%", stopColor: "rgba(255,255,255,0)" })
        ] }) }),
        /* @__PURE__ */ jsx("path", { d: "M0 206 C78 184 143 197 202 182 C276 162 338 174 420 150 L420 260 L0 260 Z", fill: "rgba(4,5,8,0.58)" }),
        /* @__PURE__ */ jsx("path", { d: "M0 220 C82 204 160 212 232 198 C306 184 362 194 420 178", fill: "none", stroke: `url(#${waterGradientId})`, strokeWidth: "2" }),
        scene === "japan" ? /* @__PURE__ */ jsxs(Fragment2, { children: [
          /* @__PURE__ */ jsx("path", { d: "M230 172 L285 80 L344 172 Z", fill: "rgba(248,238,220,0.78)" }),
          /* @__PURE__ */ jsx("path", { d: "M250 172 L285 112 L322 172 Z", fill: "rgba(82,102,142,0.7)" }),
          /* @__PURE__ */ jsxs("g", { fill: "rgba(29,16,15,0.88)", children: [
            /* @__PURE__ */ jsx("path", { d: "M42 118 L112 118 L98 132 L56 132 Z" }),
            /* @__PURE__ */ jsx("rect", { x: "58", y: "132", width: "38", height: "44", rx: "2" }),
            /* @__PURE__ */ jsx("path", { d: "M46 152 L108 152 L96 164 L58 164 Z" }),
            /* @__PURE__ */ jsx("rect", { x: "63", y: "164", width: "28", height: "44", rx: "2" })
          ] })
        ] }) : null,
        scene === "usa" ? /* @__PURE__ */ jsxs("g", { fill: "rgba(215,225,218,0.74)", children: [
          /* @__PURE__ */ jsx("path", { d: "M102 74 L122 74 L126 188 L98 188 Z" }),
          /* @__PURE__ */ jsx("path", { d: "M92 190 L132 190 L142 218 L82 218 Z" }),
          /* @__PURE__ */ jsx("path", { d: "M105 62 L119 42 L129 62 Z" }),
          /* @__PURE__ */ jsx("path", { d: "M123 100 L162 86 L164 100 L125 116 Z" })
        ] }) : null,
        scene === "europe" ? /* @__PURE__ */ jsxs("g", { fill: "rgba(33,22,24,0.78)", stroke: "rgba(246,203,126,0.2)", strokeWidth: "2", children: [
          /* @__PURE__ */ jsx("path", { d: "M214 54 L244 218 L186 218 Z" }),
          /* @__PURE__ */ jsx("path", { d: "M198 118 L234 118 L248 142 L184 142 Z" }),
          /* @__PURE__ */ jsx("path", { d: "M188 178 L246 178 L262 218 L172 218 Z" })
        ] }) : null,
        scene === "hong-kong" || scene === "singapore" ? /* @__PURE__ */ jsxs("g", { fill: "rgba(12,14,20,0.9)", children: [
          /* @__PURE__ */ jsx("rect", { x: "36", y: "134", width: "34", height: "84", rx: "3" }),
          /* @__PURE__ */ jsx("rect", { x: "82", y: "104", width: "42", height: "114", rx: "3" }),
          /* @__PURE__ */ jsx("rect", { x: "142", y: "128", width: "48", height: "90", rx: "3" }),
          /* @__PURE__ */ jsx("rect", { x: "214", y: "84", width: "36", height: "134", rx: "3" }),
          /* @__PURE__ */ jsx("rect", { x: "272", y: "116", width: "54", height: "102", rx: "3" }),
          /* @__PURE__ */ jsx("rect", { x: "342", y: "96", width: "32", height: "122", rx: "3" })
        ] }) : null,
        scene === "thailand" ? /* @__PURE__ */ jsxs("g", { fill: "rgba(38,23,16,0.86)", stroke: "rgba(244,203,111,0.2)", strokeWidth: "2", children: [
          /* @__PURE__ */ jsx("path", { d: "M82 110 L118 72 L154 110 Z" }),
          /* @__PURE__ */ jsx("rect", { x: "94", y: "110", width: "48", height: "82", rx: "3" }),
          /* @__PURE__ */ jsx("path", { d: "M184 124 L222 78 L260 124 Z" }),
          /* @__PURE__ */ jsx("rect", { x: "198", y: "124", width: "48", height: "76", rx: "3" }),
          /* @__PURE__ */ jsx("path", { d: "M288 132 L324 90 L360 132 Z" }),
          /* @__PURE__ */ jsx("rect", { x: "302", y: "132", width: "44", height: "68", rx: "3" })
        ] }) : null,
        ["korea", "malaysia", "uk", "italy", "canada", "mexico", "global"].includes(scene) ? /* @__PURE__ */ jsxs("g", { fill: "rgba(14,16,18,0.82)", children: [
          /* @__PURE__ */ jsx("path", { d: "M0 190 C60 140 102 164 148 126 C196 88 255 132 306 96 C354 66 382 98 420 76 L420 260 L0 260 Z" }),
          /* @__PURE__ */ jsx("path", { d: "M82 138 L118 106 L154 138 Z", fill: "rgba(237,202,132,0.12)" }),
          /* @__PURE__ */ jsx("path", { d: "M260 122 L296 80 L332 122 Z", fill: "rgba(237,202,132,0.14)" })
        ] }) : null
      ] }),
      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[linear-gradient(180deg,rgba(4,5,8,0.02),rgba(4,5,8,0.42)_58%,rgba(4,5,8,0.78))]" })
    ] });
  }
  function PlanCard({
    plan,
    onClick,
    isZhHant
  }) {
    return /* @__PURE__ */ jsxs("article", { className: "group overflow-hidden rounded-[1.1rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] shadow-[var(--bokmoo-shadow)]", children: [
      /* @__PURE__ */ jsxs("div", { className: `relative aspect-[1.28/0.76] overflow-hidden border-b border-[var(--bokmoo-line)] ${plan.art}`, children: [
        /* @__PURE__ */ jsx(DestinationScene, { scene: plan.scene }),
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(6,6,7,0.08)_48%,rgba(6,6,7,0.7))]" }),
        plan.badge ? /* @__PURE__ */ jsx("span", { className: "absolute left-3 top-3 inline-flex rounded-full bg-[var(--bokmoo-gold)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-bg)]", children: plan.badge }) : null,
        /* @__PURE__ */ jsxs("div", { className: "absolute inset-x-0 bottom-0 p-4", children: [
          /* @__PURE__ */ jsx("p", { className: "text-2xl font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: plan.country }),
          /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-[color:color-mix(in_oklab,var(--bokmoo-copy)_88%,white)]", children: plan.allowance }),
          /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs uppercase tracking-[0.12em] text-[var(--bokmoo-copy-soft)]", children: plan.speed })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "p-4", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-4", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-[1.85rem] font-semibold tracking-[-0.05em] text-[var(--bokmoo-gold)]", children: plan.price }),
          /* @__PURE__ */ jsx("p", { className: "text-xs text-[var(--bokmoo-copy-soft)]", children: isZhHant ? "\u8D85\u503C\u65C5\u904A\u7D44\u5408" : "Best-value travel bundle" })
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick,
            className: "inline-flex min-h-11 items-center justify-center rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_66%,black))] px-5 text-sm font-semibold text-[var(--bokmoo-bg)] transition-transform duration-300 group-hover:-translate-y-0.5",
            type: "button",
            children: isZhHant ? "\u7ACB\u5373\u8CFC\u8CB7" : "Buy Now"
          }
        )
      ] }) })
    ] });
  }
  var HomePage = react_default.memo(function HomePage2({ locale, config, onNavigate }) {
    const site = resolveBokmooSiteConfig(config);
    const [activeCategory, setActiveCategory] = react_default.useState("Popular");
    const isZhHant = locale === "zh-Hant";
    const openHref = react_default.useCallback(
      (href) => {
        if (isExternalHref(href)) {
          window.open(href, "_blank", "noopener,noreferrer");
          return;
        }
        const hashTarget = href.startsWith("/#") ? href.slice(2) : href.startsWith("#") ? href.slice(1) : "";
        if (hashTarget) {
          onNavigate?.(href);
          window.setTimeout(() => {
            document.getElementById(hashTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 0);
          return;
        }
        onNavigate?.(href);
      },
      [onNavigate]
    );
    const planDecks = react_default.useMemo(
      () => ({
        Popular: [
          {
            country: "Japan",
            allowance: "10GB / 7 Days",
            speed: "4G/5G High Speed",
            price: "$12.00",
            badge: "Hot",
            art: "bg-[linear-gradient(160deg,#93a4db_0%,#4d6d9f_45%,#11151e_100%)]",
            scene: "japan"
          },
          {
            country: "United States",
            allowance: "20GB / 15 Days",
            speed: "4G/5G High Speed",
            price: "$19.00",
            art: "bg-[linear-gradient(160deg,#5878a7_0%,#2e425b_48%,#0e1117_100%)]",
            scene: "usa"
          },
          {
            country: "Europe",
            allowance: "10GB / 15 Days",
            speed: "4G/5G High Speed",
            price: "$18.50",
            art: "bg-[linear-gradient(160deg,#d09c8c_0%,#7a5160_46%,#161116_100%)]",
            scene: "europe"
          },
          {
            country: "Hong Kong",
            allowance: "5GB / 7 Days",
            speed: "4G/5G High Speed",
            price: "$8.50",
            art: "bg-[linear-gradient(160deg,#355a80_0%,#1f3347_54%,#0c1018_100%)]",
            scene: "hong-kong"
          },
          {
            country: "Thailand",
            allowance: "15GB / 10 Days",
            speed: "4G/5G High Speed",
            price: "$11.00",
            art: "bg-[linear-gradient(160deg,#8579b6_0%,#4e3953_56%,#110f16_100%)]",
            scene: "thailand"
          }
        ],
        Asia: [
          {
            country: "Singapore",
            allowance: "8GB / 7 Days",
            speed: "4G/5G High Speed",
            price: "$9.50",
            art: "bg-[linear-gradient(160deg,#4d7485_0%,#233642_56%,#0d1114_100%)]",
            scene: "singapore"
          },
          {
            country: "Korea",
            allowance: "12GB / 10 Days",
            speed: "4G/5G High Speed",
            price: "$10.50",
            art: "bg-[linear-gradient(160deg,#6c80b5_0%,#2d3451_56%,#110f14_100%)]",
            scene: "korea"
          },
          {
            country: "Malaysia",
            allowance: "10GB / 8 Days",
            speed: "4G/5G High Speed",
            price: "$8.00",
            art: "bg-[linear-gradient(160deg,#54705f_0%,#243129_56%,#0f1310_100%)]",
            scene: "malaysia"
          }
        ],
        Europe: [
          {
            country: "Europe 33",
            allowance: "20GB / 30 Days",
            speed: "4G/5G High Speed",
            price: "$24.00",
            badge: "Best",
            art: "bg-[linear-gradient(160deg,#cb977f_0%,#67484b_52%,#151013_100%)]",
            scene: "europe"
          },
          {
            country: "United Kingdom",
            allowance: "12GB / 14 Days",
            speed: "4G/5G High Speed",
            price: "$15.00",
            art: "bg-[linear-gradient(160deg,#7181a1_0%,#323947_54%,#131216_100%)]",
            scene: "uk"
          },
          {
            country: "Italy",
            allowance: "10GB / 10 Days",
            speed: "4G/5G High Speed",
            price: "$13.50",
            art: "bg-[linear-gradient(160deg,#9d6d59_0%,#49322e_54%,#140f10_100%)]",
            scene: "italy"
          }
        ],
        "North America": [
          {
            country: "United States",
            allowance: "20GB / 15 Days",
            speed: "4G/5G High Speed",
            price: "$19.00",
            art: "bg-[linear-gradient(160deg,#5878a7_0%,#2e425b_48%,#0e1117_100%)]",
            scene: "usa"
          },
          {
            country: "Canada",
            allowance: "12GB / 15 Days",
            speed: "4G/5G High Speed",
            price: "$16.00",
            art: "bg-[linear-gradient(160deg,#7c8ca7_0%,#353d4d_52%,#121419_100%)]",
            scene: "canada"
          },
          {
            country: "Mexico",
            allowance: "8GB / 7 Days",
            speed: "4G/5G High Speed",
            price: "$9.00",
            art: "bg-[linear-gradient(160deg,#7b6f59_0%,#42392a_54%,#15120f_100%)]",
            scene: "mexico"
          }
        ],
        Global: [
          {
            country: "Global Pass",
            allowance: "25GB / 30 Days",
            speed: "Priority Multi-Network",
            price: "$39.00",
            badge: "Pro",
            art: "bg-[linear-gradient(160deg,#6e5d3f_0%,#2a231a_48%,#0e0d0b_100%)]",
            scene: "global"
          },
          {
            country: "Business Global",
            allowance: "50GB / 45 Days",
            speed: "Priority Multi-Network",
            price: "$69.00",
            art: "bg-[linear-gradient(160deg,#4b3f6c_0%,#241d33_50%,#0f0d13_100%)]",
            scene: "global"
          }
        ]
      }),
      []
    );
    const reasonCards = [
      {
        title: "Global Coverage",
        body: "Access data in 200+ countries and regions with local rates.",
        icon: Earth
      },
      {
        title: "Instant Activation",
        body: "Install your eSIM profile in seconds, anytime, anywhere.",
        icon: Zap
      },
      {
        title: "Secure & Private",
        body: "Your data and privacy are protected with top-tier security.",
        icon: ShieldCheck
      },
      {
        title: "24/7 Support",
        body: "Our global support team is here to help, anytime.",
        icon: Headphones
      }
    ];
    const heroBadges = [
      { icon: Earth, title: "200+ Countries", body: "Coverage" },
      { icon: WalletCards, title: "Instant Delivery", body: "via eSIM" },
      { icon: ShieldCheck, title: "Secure & Trusted", body: "Platform" },
      { icon: Headphones, title: "24/7 Global", body: "Support" }
    ];
    const steps = [
      {
        title: "Get Your Card",
        body: "Purchase a BOKMOO eUICC card and receive it securely.",
        icon: CreditCard
      },
      {
        title: "Install Profile",
        body: "Scan QR code or enter activation details to install your eSIM profile.",
        icon: QrCode
      },
      {
        title: "Stay Connected",
        body: "Enjoy fast, reliable data wherever you go.",
        icon: Smartphone
      }
    ];
    const euiccFeatures = [
      {
        title: "Multiple Profiles",
        body: "Manage multiple eSIM profiles on one card.",
        icon: WalletCards
      },
      {
        title: "Easy Switch",
        body: "Switch between profiles easily in our app.",
        icon: Sparkles
      },
      {
        title: "Wide Compatibility",
        body: "Works with most eSIM-compatible devices.",
        icon: Signal
      }
    ];
    const metrics2 = [
      { value: "200+", label: "Countries & Regions" },
      { value: "1M+", label: "Happy Users" },
      { value: "10M+", label: "eSIM Profiles Delivered" },
      { value: "99.9%", label: "Uptime Guarantee" }
    ];
    const activePlans = planDecks[activeCategory];
    const heroTitleLines = react_default.useMemo(() => {
      const lines = site.headline.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      return lines.length > 0 ? lines : ["One Card.", "Global Connection."];
    }, [site.headline]);
    return /* @__PURE__ */ jsxs("div", { className: "bg-[var(--bokmoo-bg)] text-[var(--bokmoo-ink)]", children: [
      /* @__PURE__ */ jsxs("section", { className: "relative overflow-hidden border-b border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] px-5 pb-12 pt-12 sm:px-8 lg:min-h-[calc(100vh-5.25rem)] lg:px-0 lg:pb-8 lg:pt-14 xl:min-h-[calc(100vh-6.75rem)] xl:pt-16 2xl:pt-[4.5rem]", children: [
        /* @__PURE__ */ jsxs("div", { className: "pointer-events-none absolute inset-0", children: [
          /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_78%_32%,color-mix(in_oklab,var(--bokmoo-gold)_48%,transparent),transparent_36%),radial-gradient(circle_at_93%_12%,color-mix(in_oklab,var(--bokmoo-gold)_32%,transparent),transparent_24%),radial-gradient(circle_at_63%_86%,color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent),transparent_25%),linear-gradient(90deg,var(--bokmoo-bg)_0%,var(--bokmoo-bg)_34%,color-mix(in_oklab,var(--bokmoo-gold)_12%,var(--bokmoo-bg))_69%,var(--bokmoo-bg)_100%)]" }),
          /* @__PURE__ */ jsx("div", { className: "absolute left-[41%] top-[-6%] hidden h-[104%] w-[76%] rounded-full bg-[var(--bokmoo-orbit-glow)] opacity-100 blur-3xl lg:block" }),
          /* @__PURE__ */ jsx("div", { className: "absolute right-[-18%] top-0 hidden h-full w-[82%] bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--bokmoo-gold)_27%,transparent)_44%,transparent)] lg:block" }),
          /* @__PURE__ */ jsx(WorldGlobe, {}),
          /* @__PURE__ */ jsx(HeroPillar, { className: "left-[55%] top-[5%] hidden h-[72%] lg:block" }),
          /* @__PURE__ */ jsx(HeroPillar, { className: "left-[63%] top-[-4%] hidden h-[82%] lg:block" }),
          /* @__PURE__ */ jsx(HeroPillar, { className: "left-[72%] top-[5%] hidden h-[78%] lg:block" }),
          /* @__PURE__ */ jsx(HeroPillar, { className: "left-[82%] top-[10%] hidden h-[64%] lg:block" }),
          /* @__PURE__ */ jsx(HeroPillar, { className: "left-[92%] top-[18%] hidden h-[48%] lg:block" }),
          /* @__PURE__ */ jsx("div", { className: "absolute right-[-19%] top-[12%] hidden h-[58%] w-[72%] rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_54%,transparent)] opacity-70 blur-[1px] lg:block" }),
          /* @__PURE__ */ jsx("div", { className: "absolute bottom-[-18%] right-[-4%] h-[34rem] w-[34rem] rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_50%,transparent)] lg:h-[42rem] lg:w-[42rem]" }),
          /* @__PURE__ */ jsx("div", { className: "absolute bottom-[-1%] right-[6%] h-72 w-72 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_36%,transparent)] lg:h-96 lg:w-96" })
        ] }),
        /* @__PURE__ */ jsx(
          "img",
          {
            src: BOKMOO_HERO_CARD_SRC,
            alt: "",
            className: "pointer-events-none absolute right-[-108%] top-[22.5rem] z-0 block h-[33rem] w-[44rem] max-w-none select-none object-contain opacity-35 mix-blend-multiply [mask-image:radial-gradient(ellipse_82%_76%_at_52%_48%,black_52%,rgba(0,0,0,0.72)_72%,transparent_100%)] sm:right-[-58%] sm:top-[21rem] sm:h-[36rem] sm:w-[48rem] lg:hidden",
            draggable: false,
            "aria-hidden": "true"
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "relative mx-auto flex w-full max-w-[107rem] flex-col lg:min-h-[calc(100vh-13.25rem)] xl:min-h-[calc(100vh-14.75rem)]", children: [
          /* @__PURE__ */ jsxs("div", { className: "grid flex-1 gap-8 lg:grid-cols-[minmax(0,0.98fr)_minmax(25rem,1.02fr)] lg:items-center xl:grid-cols-[minmax(0,0.96fr)_minmax(32rem,1.04fr)] 2xl:grid-cols-[minmax(0,0.94fr)_minmax(38rem,1.06fr)]", children: [
            /* @__PURE__ */ jsxs("div", { className: "relative z-20 max-w-[68rem] pt-2", children: [
              /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-3 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,transparent)] bg-[color:oklch(0.065_0.007_75_/_0.7)] px-5 py-2.5 text-[0.78rem] font-bold uppercase tracking-[0.28em] text-[var(--bokmoo-gold)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.025)]", children: [
                /* @__PURE__ */ jsx(Sparkles, { className: "h-4 w-4" }),
                site.eyebrow
              ] }),
              /* @__PURE__ */ jsx("h1", { className: "mt-8 max-w-full text-[clamp(2.85rem,11.2vw,4.55rem)] font-black leading-[0.94] tracking-[-0.052em] text-[color:oklch(0.985_0.004_86)] sm:max-w-[16ch] lg:mt-9 lg:max-w-[17.5ch] lg:text-[clamp(4.3rem,5.45vw,6.2rem)] lg:leading-[0.92] xl:text-[clamp(5.1rem,5.45vw,7.35rem)] 2xl:text-[clamp(5.6rem,5.25vw,8rem)]", children: heroTitleLines.map((line) => /* @__PURE__ */ jsx("span", { className: "block [text-wrap:balance]", children: line }, line)) }),
              /* @__PURE__ */ jsx("p", { className: "mt-7 max-w-[43rem] text-[clamp(1.08rem,1.35vw,1.42rem)] leading-[1.58] text-[color:color-mix(in_oklab,var(--bokmoo-copy)_94%,white)] lg:mt-8", children: site.subheadline }),
              /* @__PURE__ */ jsxs("div", { className: "mt-9 flex flex-col gap-4 sm:flex-row", children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => openHref(site.primaryCtaHref),
                    className: `inline-flex min-h-[4.15rem] items-center justify-center rounded-[1.05rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_88%,white),color-mix(in_oklab,var(--bokmoo-gold)_62%,black))] px-11 text-lg font-black text-[var(--bokmoo-bg)] shadow-[0_22px_54px_color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent)] transition-transform duration-300 hover:-translate-y-0.5 ${FOCUS_VISIBLE_RING3}`,
                    type: "button",
                    children: site.primaryCtaLabel
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => openHref(site.secondaryCtaHref),
                    className: `inline-flex min-h-[4.15rem] items-center justify-center rounded-[1.05rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)] bg-[color:oklch(0.045_0.006_75_/_0.66)] px-11 text-lg font-medium text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING3}`,
                    type: "button",
                    children: site.secondaryCtaLabel
                  }
                )
              ] }),
              /* @__PURE__ */ jsx("div", { className: "mt-10 grid max-w-[48rem] grid-cols-2 gap-4 xl:grid-cols-4", children: heroBadges.map(({ icon: Icon2, title, body }) => /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4 rounded-[1.1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] bg-[color:oklch(0.058_0.007_75_/_0.68)] px-4 py-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.018)]", children: [
                /* @__PURE__ */ jsx("div", { className: "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_17%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(Icon2, { className: "h-5 w-5" }) }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("p", { className: "text-[1.02rem] font-medium leading-tight text-[var(--bokmoo-ink)]", children: title }),
                  /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm leading-tight text-[var(--bokmoo-copy-soft)]", children: body })
                ] })
              ] }, title)) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "pointer-events-none relative mx-auto hidden h-[27rem] w-full max-w-[37rem] sm:h-[35rem] sm:max-w-[48rem] lg:mx-0 lg:block lg:h-[36rem] lg:max-w-[47rem] lg:justify-self-end xl:h-[42rem] xl:max-w-[56rem] 2xl:h-[48rem] 2xl:max-w-[64rem]", children: [
              /* @__PURE__ */ jsx("div", { className: "absolute inset-[5%_-3%_1%_2%] z-0 bg-[radial-gradient(ellipse_at_58%_52%,color-mix(in_oklab,var(--bokmoo-gold)_28%,transparent),transparent_68%)] blur-2xl" }),
              /* @__PURE__ */ jsx("div", { className: "absolute bottom-[8%] left-[8%] right-[3%] h-28 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--bokmoo-gold)_70%,transparent),transparent_70%)] blur-2xl lg:h-40" }),
              /* @__PURE__ */ jsx("div", { className: "absolute bottom-[9%] left-[7%] right-[2%] h-36 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_54%,transparent)] opacity-80 lg:h-52" }),
              /* @__PURE__ */ jsx("div", { className: "absolute bottom-[3%] left-[-2%] right-[-8%] h-52 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_30%,transparent)] opacity-70 lg:h-72" }),
              /* @__PURE__ */ jsx(
                "img",
                {
                  src: BOKMOO_HERO_CARD_SRC,
                  alt: "BOKMOO eUICC card",
                  className: "relative z-10 h-full w-full select-none object-contain object-center opacity-95 mix-blend-multiply contrast-[1.04] saturate-[0.94] [mask-image:radial-gradient(ellipse_88%_92%_at_56%_50%,black_56%,rgba(0,0,0,0.92)_72%,rgba(0,0,0,0.42)_88%,transparent_100%)] drop-shadow-[0_44px_90px_rgba(0,0,0,0.68)] lg:object-right",
                  draggable: false
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "mt-10 overflow-hidden rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_20%,transparent)] bg-[linear-gradient(90deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018))] px-5 py-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.018),0_22px_70px_rgba(0,0,0,0.36)] sm:rounded-full sm:px-7 sm:py-3.5 lg:mt-auto", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4 text-sm sm:items-center sm:text-base", children: [
              /* @__PURE__ */ jsx("span", { className: "shrink-0 rounded-full bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]", children: isZhHant ? "\u516C\u544A" : "Notice" }),
              /* @__PURE__ */ jsx("span", { className: "text-[color:color-mix(in_oklab,var(--bokmoo-copy)_92%,white)]", children: isZhHant ? "BOKMOO Pro eUICC \u5361\u73FE\u5DF2\u63A8\u51FA\uFF0C\u8F15\u9B06\u7BA1\u7406\u591A\u500B eSIM \u8A2D\u5B9A\u6A94\u3002" : "BOKMOO Pro eUICC Card is now available! Manage multiple eSIM profiles with ease." })
            ] }),
            /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => openHref("/products"),
                className: `inline-flex shrink-0 items-center gap-3 rounded-full px-2 py-1 text-sm font-semibold text-[var(--bokmoo-gold)] sm:text-base ${FOCUS_VISIBLE_RING3}`,
                type: "button",
                children: [
                  isZhHant ? "\u77AD\u89E3\u66F4\u591A" : "Learn more",
                  /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4" })
                ]
              }
            )
          ] }) })
        ] })
      ] }),
      /* @__PURE__ */ jsx("section", { className: "px-4 py-6 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1280px] space-y-6", children: [
        /* @__PURE__ */ jsxs("div", { id: "how-it-works", className: "scroll-mt-24 rounded-[1.5rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8 lg:scroll-mt-32", children: [
          /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
            /* @__PURE__ */ jsx("h2", { className: "text-[clamp(2.2rem,4vw,3.4rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: isZhHant ? "\u70BA\u4EC0\u9EBC\u9078\u64C7 BOKMOO\uFF1F" : "Why Choose BOKMOO?" }),
            /* @__PURE__ */ jsx("p", { className: "mt-3 text-base text-[var(--bokmoo-copy)]", children: isZhHant ? "\u7531\u60A8\u5168\u9762\u638C\u63A7\u7684\u65B0\u4E16\u4EE3 eSIM \u5E73\u53F0\u3002" : "The next generation eSIM platform that puts you in control." })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4", children: reasonCards.map(({ title, body, icon: Icon2 }) => /* @__PURE__ */ jsxs(
            "article",
            {
              className: "rounded-[1.2rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] px-5 py-6",
              children: [
                /* @__PURE__ */ jsx("div", { className: "mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_40%,transparent)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(Icon2, { className: "h-6 w-6" }) }),
                /* @__PURE__ */ jsx("h3", { className: "mt-5 text-center text-xl font-medium text-[var(--bokmoo-ink)]", children: title }),
                /* @__PURE__ */ jsx("p", { className: "mt-3 text-center text-sm leading-7 text-[var(--bokmoo-copy)]", children: body })
              ]
            },
            title
          )) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "rounded-[1.5rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 border-b border-[var(--bokmoo-line)] pb-5 sm:flex-row sm:items-end sm:justify-between", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("h2", { className: "text-[clamp(2rem,3.4vw,3rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: isZhHant ? "\u9069\u5408\u6BCF\u8D9F\u65C5\u7A0B\u7684 eSIM \u65B9\u6848" : "eSIM Plans for Every Journey" }),
              /* @__PURE__ */ jsx("div", { className: "mt-4 flex flex-wrap gap-2", children: ["Popular", "Asia", "Europe", "North America", "Global"].map((category) => /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => setActiveCategory(category),
                  className: `rounded-full px-4 py-2 text-sm transition-colors ${activeCategory === category ? "bg-[var(--bokmoo-gold)] text-[var(--bokmoo-bg)]" : "text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]"} ${FOCUS_VISIBLE_RING3}`,
                  type: "button",
                  children: isZhHant ? { Popular: "\u71B1\u9580", Asia: "\u4E9E\u6D32", Europe: "\u6B50\u6D32", "North America": "\u5317\u7F8E\u6D32", Global: "\u5168\u7403" }[category] : category
                },
                category
              )) })
            ] }),
            /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => openHref("/products"),
                className: `inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm font-medium text-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING3}`,
                type: "button",
                children: [
                  isZhHant ? "\u67E5\u770B\u6240\u6709\u65B9\u6848" : "View all plans",
                  /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsx("div", { className: "mt-6 grid gap-4 xl:grid-cols-5", children: activePlans.map((plan) => /* @__PURE__ */ jsx(PlanCard, { plan, onClick: () => openHref("/products"), isZhHant }, `${activeCategory}-${plan.country}`)) })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "rounded-[1.5rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h2", { className: "text-[clamp(2rem,3.2vw,2.8rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: isZhHant ? "\u4F7F\u7528\u65B9\u5F0F" : "How It Works" }),
            /* @__PURE__ */ jsx("div", { className: "mt-6 grid gap-5 md:grid-cols-3", children: steps.map(({ title, body, icon: Icon2 }) => /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
              /* @__PURE__ */ jsx("div", { className: "mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--bokmoo-line-strong)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(Icon2, { className: "h-7 w-7" }) }),
              /* @__PURE__ */ jsx("h3", { className: "mt-5 text-lg font-medium text-[var(--bokmoo-ink)]", children: title }),
              /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-7 text-[var(--bokmoo-copy)]", children: body })
            ] }, title)) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "relative overflow-hidden rounded-[1.25rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(160deg,#7c6244_0%,#25211c_55%,#0d0d0d_100%)] p-5", children: [
            /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_65%_18%,rgba(255,215,138,0.4),transparent_18%),linear-gradient(180deg,transparent,rgba(0,0,0,0.28))]" }),
            /* @__PURE__ */ jsx("div", { className: "absolute left-10 top-12 h-5 w-5 rounded-full bg-[rgba(255,219,162,0.32)] blur-[1px]" }),
            /* @__PURE__ */ jsx("div", { className: "absolute left-20 top-20 h-3 w-3 rounded-full bg-[rgba(255,219,162,0.24)] blur-[1px]" }),
            /* @__PURE__ */ jsx("div", { className: "absolute left-[36%] top-16 h-6 w-6 rounded-full bg-[rgba(255,219,162,0.28)] blur-[1px]" }),
            /* @__PURE__ */ jsxs("div", { className: "relative ml-auto w-[11rem] rounded-[1.05rem] border border-[rgba(255,255,255,0.14)] bg-[rgba(12,12,14,0.7)] p-4 backdrop-blur-xl", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-0.5", children: [
                    /* @__PURE__ */ jsx("span", { className: "h-2.5 w-2.5 rounded-tl-[999px] rounded-tr-[999px] bg-[var(--bokmoo-gold)]" }),
                    /* @__PURE__ */ jsx("span", { className: "h-2.5 w-2.5 rounded-tl-[999px] rounded-tr-[999px] bg-[var(--bokmoo-gold)]" }),
                    /* @__PURE__ */ jsx("span", { className: "h-2.5 w-2.5 rounded-bl-[999px] rounded-br-[999px] bg-[var(--bokmoo-gold)]" }),
                    /* @__PURE__ */ jsx("span", { className: "h-2.5 w-2.5 rounded-bl-[999px] rounded-br-[999px] bg-[var(--bokmoo-gold)]" })
                  ] }),
                  /* @__PURE__ */ jsx("span", { className: "text-xs font-semibold text-[var(--bokmoo-ink)]", children: "BOKMOO Pro" })
                ] }),
                /* @__PURE__ */ jsx("span", { className: "text-[10px] font-semibold text-emerald-300", children: isZhHant ? "\u4F7F\u7528\u4E2D" : "Active" })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "mt-4", children: [
                /* @__PURE__ */ jsx("p", { className: "text-[11px] text-[var(--bokmoo-copy-soft)]", children: isZhHant ? "\u6578\u64DA\u7528\u91CF" : "Data Usage" }),
                /* @__PURE__ */ jsxs("p", { className: "mt-1 text-2xl font-semibold text-[var(--bokmoo-ink)]", children: [
                  "12.45 ",
                  /* @__PURE__ */ jsx("span", { className: "text-sm font-medium text-[var(--bokmoo-copy)]", children: "GB / 20 GB" })
                ] }),
                /* @__PURE__ */ jsx("div", { className: "mt-3 h-2 rounded-full bg-[rgba(255,255,255,0.08)]", children: /* @__PURE__ */ jsx("div", { className: "h-full w-[62%] rounded-full bg-[linear-gradient(90deg,var(--bokmoo-gold),color-mix(in_oklab,var(--bokmoo-gold)_72%,white))]" }) }),
                /* @__PURE__ */ jsx("p", { className: "mt-4 text-[11px] text-[var(--bokmoo-copy-soft)]", children: isZhHant ? "\u6709\u6548\u671F\u9650" : "Valid Until" }),
                /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm font-medium text-[var(--bokmoo-ink)]", children: "2025-06-30" })
              ] })
            ] })
          ] })
        ] }) }),
        /* @__PURE__ */ jsx("div", { className: "overflow-hidden rounded-[1.5rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(135deg,#1b1610,#0c0b09_45%,#19130e)] shadow-[var(--bokmoo-shadow)]", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-8 px-6 py-8 lg:grid-cols-[minmax(0,0.86fr)_22rem] lg:px-8", children: [
          /* @__PURE__ */ jsxs("div", { className: "relative", children: [
            /* @__PURE__ */ jsx("div", { className: "absolute -bottom-28 left-[28%] h-72 w-72 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)] opacity-60" }),
            /* @__PURE__ */ jsx("div", { className: "absolute -bottom-36 left-[24%] h-96 w-96 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] opacity-50" }),
            /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]", children: "BOKMOO eUICC Card" }),
            /* @__PURE__ */ jsx("h2", { className: "mt-3 text-[clamp(2.2rem,4vw,3.8rem)] font-semibold leading-[0.95] tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: isZhHant ? "\u4E00\u5361\u5728\u624B\uFF0C\u7121\u9650\u53EF\u80FD\u3002" : "One Card. Unlimited Possibilities." }),
            /* @__PURE__ */ jsxs("ul", { className: "mt-6 space-y-3 text-base text-[var(--bokmoo-copy)]", children: [
              /* @__PURE__ */ jsx("li", { children: isZhHant ? "\u5132\u5B58\u591A\u500B eSIM \u8A2D\u5B9A\u6A94" : "Store multiple eSIM profiles" }),
              /* @__PURE__ */ jsx("li", { children: isZhHant ? "\u900F\u904E BOKMOO App \u8F15\u9B06\u7BA1\u7406" : "Easy management via BOKMOO App" }),
              /* @__PURE__ */ jsx("li", { children: isZhHant ? "\u76F8\u5BB9 iOS \u8207 Android" : "Compatible with iOS & Android" })
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => openHref(site.secondaryCtaHref),
                className: `mt-8 inline-flex min-h-12 items-center justify-center rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_84%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-7 text-sm font-semibold text-[var(--bokmoo-bg)] ${FOCUS_VISIBLE_RING3}`,
                type: "button",
                children: isZhHant ? "\u7ACB\u5373\u9078\u8CFC" : "Shop Now"
              }
            )
          ] }),
          /* @__PURE__ */ jsx("div", { className: "grid gap-4", children: euiccFeatures.map(({ title, body, icon: Icon2 }) => /* @__PURE__ */ jsx(
            "article",
            {
              className: "rounded-[1.1rem] border border-[var(--bokmoo-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4",
              children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
                /* @__PURE__ */ jsx("div", { className: "flex h-11 w-11 items-center justify-center rounded-[0.95rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(Icon2, { className: "h-5 w-5" }) }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("h3", { className: "text-lg font-medium text-[var(--bokmoo-ink)]", children: title }),
                  /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm leading-7 text-[var(--bokmoo-copy)]", children: body })
                ] })
              ] })
            },
            title
          )) })
        ] }) }),
        /* @__PURE__ */ jsx("div", { className: "grid gap-4 rounded-[1.35rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] p-5 shadow-[var(--bokmoo-shadow)] sm:grid-cols-2 xl:grid-cols-4", children: metrics2.map((metric) => /* @__PURE__ */ jsxs("div", { className: "border-b border-[var(--bokmoo-line)] pb-4 last:border-none sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4 sm:last:border-r-0", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[clamp(2rem,3vw,2.8rem)] font-semibold tracking-[-0.06em] text-[var(--bokmoo-ink)]", children: metric.value }),
          /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-[var(--bokmoo-copy-soft)]", children: metric.label })
        ] }, metric.label)) })
      ] }) })
    ] });
  });

  // src/components/LoginPage.tsx
  var FOCUS_VISIBLE_RING4 = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bokmoo-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bokmoo-bg)]";
  function LoginPage({
    isLoading,
    error,
    config,
    onSubmit,
    onOAuthClick,
    onAppleOAuthClick,
    onNavigateToRegister,
    onNavigateToForgotPassword
  }) {
    const site = resolveBokmooSiteConfig(config);
    const [email, setEmail] = react_default.useState("");
    const [password, setPassword] = react_default.useState("");
    const [showPassword, setShowPassword] = react_default.useState(false);
    const emailRef = react_default.useRef(null);
    const passwordRef = react_default.useRef(null);
    const handleAutofill = (setter) => (event) => {
      if (event.animationName === "onAutoFillStart") {
        setter(event.currentTarget.value);
      }
    };
    const handleSubmit = async (event) => {
      event.preventDefault();
      const emailValue = emailRef.current?.value || email;
      const passwordValue = passwordRef.current?.value || password;
      if (!emailValue || !passwordValue) return;
      await onSubmit(emailValue, passwordValue);
    };
    return /* @__PURE__ */ jsxs("div", { className: "relative min-h-screen overflow-hidden bg-[var(--bokmoo-bg)] px-4 py-12 text-[var(--bokmoo-ink)] sm:px-6 lg:px-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "pointer-events-none absolute inset-0", children: [
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent),transparent_24%),radial-gradient(circle_at_16%_78%,color-mix(in_oklab,var(--bokmoo-gold)_8%,transparent),transparent_24%),linear-gradient(180deg,var(--bokmoo-bg),color-mix(in_oklab,var(--bokmoo-bg)_86%,black))]" }),
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 opacity-40 [background-image:var(--bokmoo-grid)] [background-size:72px_72px]" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "relative mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1180px] items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(24rem,0.62fr)]", children: [
        /* @__PURE__ */ jsxs("section", { className: "hidden lg:block", children: [
          /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-3 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)] bg-[color:oklch(0.065_0.007_75_/_0.72)] px-5 py-2.5 text-[0.72rem] font-bold uppercase tracking-[0.28em] text-[var(--bokmoo-gold)]", children: [
            /* @__PURE__ */ jsx(ShieldCheck, { className: "h-4 w-4" }),
            "Secure account access"
          ] }),
          /* @__PURE__ */ jsx("h1", { className: "mt-7 max-w-3xl text-[clamp(3.5rem,7vw,6.4rem)] font-semibold leading-[0.92] tracking-[-0.065em] text-[var(--bokmoo-ink)]", children: "Sign in before your next border." }),
          /* @__PURE__ */ jsx("p", { className: "mt-7 max-w-2xl text-lg leading-8 text-[var(--bokmoo-copy)]", children: "Manage BOKMOO eSIM profiles, orders, and activation details from the same black-and-gold travel control surface." }),
          /* @__PURE__ */ jsx("div", { className: "mt-10 grid max-w-2xl gap-3 sm:grid-cols-3", children: [
            ["Orders", "Track purchases"],
            ["Profiles", "Manage eSIMs"],
            ["Support", "Get help fast"]
          ].map(([title, body]) => /* @__PURE__ */ jsxs(
            "div",
            {
              className: "rounded-[1.15rem] border border-[var(--bokmoo-line)] bg-[color:oklch(0.07_0.008_75_/_0.76)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
              children: [
                /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold text-[var(--bokmoo-gold)]", children: title }),
                /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs leading-5 text-[var(--bokmoo-copy-soft)]", children: body })
              ]
            },
            title
          )) })
        ] }),
        /* @__PURE__ */ jsx("section", { className: "mx-auto w-full max-w-[30rem] rounded-[1.45rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,transparent)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_94%,white),var(--bokmoo-bg-elevated))] p-5 shadow-[var(--bokmoo-shadow)] sm:p-7", children: /* @__PURE__ */ jsxs("div", { className: "rounded-[1.1rem] border border-[var(--bokmoo-line)] bg-[color:oklch(0.055_0.006_75_/_0.78)] p-5 sm:p-6", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--bokmoo-gold)]", children: [
              site.brandName.toUpperCase(),
              " account"
            ] }),
            /* @__PURE__ */ jsx("h2", { className: "mt-3 text-3xl font-semibold leading-none tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: "Welcome back" }),
            /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--bokmoo-copy)]", children: "Continue to your orders, profiles, and activation workspace." })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-7 grid gap-3 sm:grid-cols-2", children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => onOAuthClick("google"),
                className: `inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_86%,black)] px-4 text-sm font-semibold text-[var(--bokmoo-ink)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_VISIBLE_RING4}`,
                disabled: isLoading,
                children: [
                  /* @__PURE__ */ jsx(Chrome, { className: "h-4 w-4" }),
                  "Google"
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => onAppleOAuthClick?.(),
                className: `inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_86%,black)] px-4 text-sm font-semibold text-[var(--bokmoo-ink)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_VISIBLE_RING4}`,
                disabled: isLoading || !onAppleOAuthClick,
                children: [
                  /* @__PURE__ */ jsx(Apple, { className: "h-4 w-4" }),
                  "Apple"
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-6 flex items-center gap-3", children: [
            /* @__PURE__ */ jsx("div", { className: "h-px flex-1 bg-[var(--bokmoo-line)]" }),
            /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--bokmoo-copy-soft)]", children: "or email" }),
            /* @__PURE__ */ jsx("div", { className: "h-px flex-1 bg-[var(--bokmoo-line)]" })
          ] }),
          /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, className: "mt-7 space-y-5", children: [
            error ? /* @__PURE__ */ jsx("div", { className: "rounded-[0.95rem] border border-[color:color-mix(in_oklab,var(--bokmoo-danger)_48%,transparent)] bg-[color:color-mix(in_oklab,var(--bokmoo-danger)_12%,transparent)] p-4 text-sm leading-6 text-[var(--bokmoo-ink)]", children: error }) : null,
            /* @__PURE__ */ jsxs("label", { className: "block", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Email" }),
              /* @__PURE__ */ jsxs("span", { className: "relative mt-2 block", children: [
                /* @__PURE__ */ jsx(Mail, { className: "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    ref: emailRef,
                    type: "email",
                    value: email,
                    onChange: (event) => setEmail(event.target.value),
                    onAnimationStart: handleAutofill(setEmail),
                    placeholder: "you@example.com",
                    className: `h-13 w-full rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] py-3 pl-11 pr-4 text-sm font-medium text-[var(--bokmoo-ink)] outline-none placeholder:text-[var(--bokmoo-copy-soft)] transition-colors focus:border-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING4}`,
                    disabled: isLoading,
                    autoComplete: "email"
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "block", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Password" }),
              /* @__PURE__ */ jsxs("span", { className: "relative mt-2 block", children: [
                /* @__PURE__ */ jsx(LockKeyhole, { className: "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    ref: passwordRef,
                    type: showPassword ? "text" : "password",
                    value: password,
                    onChange: (event) => setPassword(event.target.value),
                    onAnimationStart: handleAutofill(setPassword),
                    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
                    className: `h-13 w-full rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] py-3 pl-11 pr-12 text-sm font-medium text-[var(--bokmoo-ink)] outline-none placeholder:text-[var(--bokmoo-copy-soft)] transition-colors focus:border-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING4}`,
                    disabled: isLoading,
                    autoComplete: "current-password"
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => setShowPassword((value) => !value),
                    className: `absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[0.8rem] text-[var(--bokmoo-copy-soft)] hover:text-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING4}`,
                    disabled: isLoading,
                    "aria-label": showPassword ? "Hide password" : "Show password",
                    children: showPassword ? /* @__PURE__ */ jsx(EyeOff, { className: "h-4 w-4" }) : /* @__PURE__ */ jsx(Eye, { className: "h-4 w-4" })
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "flex items-center justify-between gap-4", children: /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: onNavigateToForgotPassword,
                className: `text-sm font-medium text-[var(--bokmoo-copy)] underline decoration-[var(--bokmoo-line)] underline-offset-4 hover:text-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING4}`,
                disabled: isLoading,
                children: "Forgot password"
              }
            ) }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "submit",
                disabled: isLoading,
                className: `inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-[1rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_88%,white),color-mix(in_oklab,var(--bokmoo-gold)_64%,black))] px-5 text-sm font-black uppercase tracking-[0.2em] text-[var(--bokmoo-bg)] shadow-[0_18px_42px_color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] transition-transform duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_VISIBLE_RING4}`,
                children: isLoading ? /* @__PURE__ */ jsxs(Fragment2, { children: [
                  /* @__PURE__ */ jsx(LoaderCircle, { className: "h-4 w-4 animate-spin" }),
                  "Signing in"
                ] }) : "Sign in"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-7 border-t border-[var(--bokmoo-line)] pt-6 text-center", children: [
            /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: [
              "New to ",
              site.brandName.toUpperCase(),
              "?"
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: onNavigateToRegister,
                className: `mt-3 text-sm font-semibold text-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold-strong)] ${FOCUS_VISIBLE_RING4}`,
                disabled: isLoading,
                children: "Create account"
              }
            )
          ] })
        ] }) })
      ] })
    ] });
  }

  // src/components/InstallSessionPanel.tsx
  function copyToClipboard(value) {
    if (!value || typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(value).catch(() => void 0);
  }
  function getQrImageSrc(value) {
    if (!value) return null;
    if (/^data:image\//i.test(value)) return value;
    if (/^https?:\/\//i.test(value)) return value;
    return null;
  }
  var InstallSessionPanel = react_default.memo(function InstallSessionPanel2({
    session,
    className = "",
    title = "Install Details"
  }) {
    const qrImageSrc = getQrImageSrc(session.qrCode);
    const qrPayload = session.qrCode || session.lpaString || "";
    const fields = [
      ["SM-DP+", session.smdpAddress || "\u2014"],
      ["Matching ID", session.matchingId || "\u2014"],
      ["Activation Code", session.activationCode || "\u2014"],
      ["Confirmation Code", session.confirmationCode || "\u2014"]
    ];
    return /* @__PURE__ */ jsxs(
      "div",
      {
        className: `rounded-[1.1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-4 text-left ${className}`,
        children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
            /* @__PURE__ */ jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-[0.9rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(QrCode, { className: "h-5 w-5" }) }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[var(--bokmoo-ink)]", children: title }),
              /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-[var(--bokmoo-copy-soft)]", children: session.packageTitle })
            ] })
          ] }),
          qrPayload ? /* @__PURE__ */ jsx("div", { className: "mt-4 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(160deg,color-mix(in_oklab,var(--bokmoo-gold)_9%,transparent),transparent_52%),var(--bokmoo-bg-elevated)] p-4", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center", children: [
            /* @__PURE__ */ jsx("div", { className: "flex aspect-square items-center justify-center rounded-[0.9rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-3", children: qrImageSrc ? /* @__PURE__ */ jsx("img", { src: qrImageSrc, alt: "BOKMOO eSIM install QR code", className: "h-full w-full object-contain" }) : /* @__PURE__ */ jsxs("div", { className: "flex h-full w-full flex-col items-center justify-center gap-3 text-center text-[var(--bokmoo-copy)]", children: [
              /* @__PURE__ */ jsx(QrCode, { className: "h-11 w-11 text-[var(--bokmoo-gold)]" }),
              /* @__PURE__ */ jsx("span", { className: "text-xs leading-5", children: "QR payload ready" })
            ] }) }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[var(--bokmoo-ink)]", children: "Scan or install manually" }),
              /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs leading-5 text-[var(--bokmoo-copy)]", children: "If the QR image is not provided by the backend, use the manual fields below or copy the LPA payload." }),
              /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => copyToClipboard(qrPayload),
                  className: "mt-4 inline-flex min-h-10 items-center gap-2 rounded-[0.8rem] border border-[var(--bokmoo-line)] px-4 text-sm font-medium text-[var(--bokmoo-ink)]",
                  type: "button",
                  children: [
                    /* @__PURE__ */ jsx(Copy, { className: "h-4 w-4 text-[var(--bokmoo-gold)]" }),
                    "Copy QR Payload"
                  ]
                }
              )
            ] })
          ] }) }) : null,
          /* @__PURE__ */ jsx("div", { className: "mt-4 grid gap-3 md:grid-cols-2", children: fields.map(([label, value]) => /* @__PURE__ */ jsxs(
            "div",
            {
              className: "flex items-center justify-between gap-3 rounded-[0.9rem] border border-[var(--bokmoo-line)] px-3 py-3",
              children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("p", { className: "text-[11px] uppercase tracking-[0.14em] text-[var(--bokmoo-copy-soft)]", children: label }),
                  /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-[var(--bokmoo-ink)]", children: value })
                ] }),
                value !== "\u2014" ? /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => copyToClipboard(String(value)),
                    className: "text-[var(--bokmoo-gold)]",
                    type: "button",
                    children: /* @__PURE__ */ jsx(Copy, { className: "h-4 w-4" })
                  }
                ) : null
              ]
            },
            `${label}-${value}`
          )) }),
          session.lpaString ? /* @__PURE__ */ jsx("div", { className: "mt-3 rounded-[0.9rem] border border-[var(--bokmoo-line)] px-3 py-3", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-[11px] uppercase tracking-[0.14em] text-[var(--bokmoo-copy-soft)]", children: "LPA String" }),
              /* @__PURE__ */ jsx("p", { className: "mt-1 break-all text-sm text-[var(--bokmoo-ink)]", children: session.lpaString })
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => copyToClipboard(session.lpaString || ""),
                className: "text-[var(--bokmoo-gold)]",
                type: "button",
                children: /* @__PURE__ */ jsx(Copy, { className: "h-4 w-4" })
              }
            )
          ] }) }) : null,
          session.instructions?.ios?.length || session.instructions?.android?.length || session.instructions?.general?.length ? /* @__PURE__ */ jsxs("div", { className: "mt-4 space-y-3", children: [
            session.instructions?.ios?.length ? /* @__PURE__ */ jsxs("div", { className: "rounded-[0.9rem] border border-[var(--bokmoo-line)] px-3 py-3", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[11px] uppercase tracking-[0.14em] text-[var(--bokmoo-copy-soft)]", children: "iOS" }),
              /* @__PURE__ */ jsx("ul", { className: "mt-2 space-y-2 text-sm text-[var(--bokmoo-copy)]", children: session.instructions.ios.map((item) => /* @__PURE__ */ jsx("li", { children: item }, item)) })
            ] }) : null,
            session.instructions?.android?.length ? /* @__PURE__ */ jsxs("div", { className: "rounded-[0.9rem] border border-[var(--bokmoo-line)] px-3 py-3", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[11px] uppercase tracking-[0.14em] text-[var(--bokmoo-copy-soft)]", children: "Android" }),
              /* @__PURE__ */ jsx("ul", { className: "mt-2 space-y-2 text-sm text-[var(--bokmoo-copy)]", children: session.instructions.android.map((item) => /* @__PURE__ */ jsx("li", { children: item }, item)) })
            ] }) : null,
            session.instructions?.general?.length ? /* @__PURE__ */ jsxs("div", { className: "rounded-[0.9rem] border border-[var(--bokmoo-line)] px-3 py-3", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[11px] uppercase tracking-[0.14em] text-[var(--bokmoo-copy-soft)]", children: "General Notes" }),
              /* @__PURE__ */ jsx("ul", { className: "mt-2 space-y-2 text-sm text-[var(--bokmoo-copy)]", children: session.instructions.general.map((item) => /* @__PURE__ */ jsx("li", { children: item }, item)) })
            ] }) : null
          ] }) : null,
          session.support?.email || session.support?.phone ? /* @__PURE__ */ jsxs("div", { className: "mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--bokmoo-copy)]", children: [
            session.support?.email ? /* @__PURE__ */ jsx("a", { className: "inline-flex items-center gap-2 text-[var(--bokmoo-ink)] underline", href: `mailto:${session.support.email}`, children: session.support.email }) : null,
            session.support?.phone ? /* @__PURE__ */ jsx("a", { className: "inline-flex items-center gap-2 text-[var(--bokmoo-ink)] underline", href: `tel:${session.support.phone}`, children: session.support.phone }) : null
          ] }) : null
        ]
      }
    );
  });

  // src/components/OrderDetailPage.tsx
  function copyToClipboard2(value) {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(value).catch(() => void 0);
  }
  function statusTone(status) {
    const normalized = status.toUpperCase();
    if (normalized === "DELIVERED" || normalized === "COMPLETED") return "bg-[color:color-mix(in_oklab,var(--bokmoo-success)_18%,white)] text-[var(--bokmoo-ink)]";
    if (normalized === "PENDING" || normalized === "PAID" || normalized === "PROCESSING") return "bg-[color:color-mix(in_oklab,var(--bokmoo-warning)_18%,white)] text-[var(--bokmoo-ink)]";
    if (normalized === "CANCELLED" || normalized === "REFUNDED") return "bg-[color:color-mix(in_oklab,var(--bokmoo-danger)_14%,white)] text-[var(--bokmoo-ink)]";
    return "bg-[var(--bokmoo-primary-soft)] text-[var(--bokmoo-primary-strong)]";
  }
  function renderField(label, value, action) {
    return /* @__PURE__ */ jsxs("div", { className: "rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold tracking-[0.16em] text-[var(--bokmoo-copy-soft)]", children: label }),
        action
      ] }),
      /* @__PURE__ */ jsx("p", { className: "mt-3 break-all text-sm font-semibold text-[var(--bokmoo-ink)]", children: value })
    ] });
  }
  var OrderDetailPage = react_default.memo(function OrderDetailPage2({
    order,
    isLoading,
    config,
    onBack,
    onBackToOrders,
    onCancelOrder
  }) {
    const handleBack = onBack || onBackToOrders;
    const site = resolveBokmooSiteConfig(config);
    const [remoteOrder, setRemoteOrder] = react_default.useState(null);
    const [installSession, setInstallSession] = react_default.useState(null);
    const effectiveOrder = order || remoteOrder;
    react_default.useEffect(() => {
      if (order?.id) return;
      const orderId = getOrderIdFromLocation();
      if (!orderId) return;
      let cancelled = false;
      void getBokmooOrder(
        {
          baseUrl: site.apiBaseUrl
        },
        orderId
      ).then((response) => {
        if (!cancelled) {
          setRemoteOrder(mapBokmooApiOrderToThemeOrder(response));
        }
      }).catch(() => void 0);
      return () => {
        cancelled = true;
      };
    }, [order?.id, site.apiBaseUrl]);
    react_default.useEffect(() => {
      if (!effectiveOrder?.id) return;
      let cancelled = false;
      void getBokmooInstallSession(
        {
          baseUrl: site.apiBaseUrl
        },
        effectiveOrder.id
      ).then((session) => {
        if (!cancelled) {
          setInstallSession(session);
        }
      }).catch(() => void 0);
      return () => {
        cancelled = true;
      };
    }, [effectiveOrder?.id, site.apiBaseUrl]);
    if (isLoading) {
      return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)]" });
    }
    if (!effectiveOrder) {
      return /* @__PURE__ */ jsx("div", { className: "flex min-h-screen items-center justify-center bg-[var(--bokmoo-bg)] px-4", children: /* @__PURE__ */ jsxs("div", { className: "rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-10 text-center shadow-[var(--bokmoo-shadow)]", children: [
        /* @__PURE__ */ jsx("h1", { className: "text-3xl font-black tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: "Order not found" }),
        handleBack ? /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: handleBack,
            className: "mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--bokmoo-primary)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white",
            children: [
              /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
              "Back to orders"
            ]
          }
        ) : null
      ] }) });
    }
    const artifactCount = effectiveOrder.items.reduce(
      (sum, item) => sum + getDeliveredArtifactCount(item.fulfillmentData),
      0
    );
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1280px]", children: [
      handleBack ? /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: handleBack,
          className: "inline-flex items-center gap-2 rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)]",
          children: [
            /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
            "Back to orders"
          ]
        }
      ) : null,
      /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(20rem,0.7fr)]", children: [
        /* @__PURE__ */ jsxs("section", { className: "space-y-4", children: [
          /* @__PURE__ */ jsx("div", { className: "rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 md:flex-row md:items-end md:justify-between", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
                /* @__PURE__ */ jsx("span", { className: cn2("rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.16em]", statusTone(effectiveOrder.status)), children: effectiveOrder.status }),
                /* @__PURE__ */ jsxs("span", { className: "rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-[var(--bokmoo-copy)]", children: [
                  artifactCount,
                  " delivered item",
                  artifactCount === 1 ? "" : "s"
                ] })
              ] }),
              /* @__PURE__ */ jsxs("h1", { className: "mt-5 text-[clamp(2.2rem,4vw,4rem)] font-black tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: [
                "Order #",
                effectiveOrder.id.slice(-8).toUpperCase()
              ] }),
              /* @__PURE__ */ jsxs("p", { className: "mt-3 text-sm leading-6 text-[var(--bokmoo-copy)]", children: [
                "Created ",
                new Date(effectiveOrder.createdAt).toLocaleString(),
                " \xB7 payment ",
                effectiveOrder.paymentStatus
              ] })
            ] }),
            onCancelOrder && ["PENDING", "PAID"].includes(effectiveOrder.status.toUpperCase()) ? /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => onCancelOrder(),
                className: "inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)]",
                children: "Cancel order"
              }
            ) : null
          ] }) }),
          installSession ? /* @__PURE__ */ jsx(
            InstallSessionPanel,
            {
              title: "Install Session",
              session: installSession,
              className: "border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)]"
            }
          ) : null,
          effectiveOrder.items.map((item) => {
            const sections3 = extractDeliverySections(item.fulfillmentData);
            const installLike = (() => {
              const data = item.fulfillmentData;
              if (!data || typeof data !== "object") return null;
              if (!("qrCode" in data || "qr_code" in data || "qrCodeContent" in data || "qr_code_content" in data || "lpaString" in data || "lpa" in data || "lpa_string" in data || "smdpAddress" in data || "smdp_address" in data || "smdp" in data || "matchingId" in data || "matching_id" in data || "activationCode" in data || "activation_code" in data)) {
                return null;
              }
              return normalizeInstallSession({
                ...data,
                orderId: effectiveOrder.id,
                orderNumber: effectiveOrder.id,
                status: "ready",
                packageTitle: item.productName
              });
            })();
            const hasContent = sections3.codes.length + sections3.credentials.length + sections3.links.length + sections3.meta.length + sections3.notes.length > 0;
            return /* @__PURE__ */ jsxs(
              "article",
              {
                className: "rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8",
                children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between", children: [
                    /* @__PURE__ */ jsxs("div", { children: [
                      /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold tracking-[0.16em] text-[var(--bokmoo-copy-soft)]", children: "Item delivery" }),
                      /* @__PURE__ */ jsx("h2", { className: "mt-3 text-2xl font-black tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: item.productName }),
                      /* @__PURE__ */ jsxs("p", { className: "mt-2 text-sm text-[var(--bokmoo-copy)]", children: [
                        "Qty ",
                        item.quantity,
                        item.variantName ? ` \xB7 ${item.variantName}` : ""
                      ] })
                    ] }),
                    /* @__PURE__ */ jsx("span", { className: cn2("rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.16em]", statusTone(item.fulfillmentStatus || effectiveOrder.status)), children: item.fulfillmentStatus || effectiveOrder.status })
                  ] }),
                  hasContent ? /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-4", children: [
                    installLike ? /* @__PURE__ */ jsx("div", { className: "grid gap-3 md:grid-cols-2", children: [
                      ["SM-DP+", installLike.smdpAddress || "\u2014"],
                      ["Matching ID", installLike.matchingId || "\u2014"],
                      ["Activation Code", installLike.activationCode || "\u2014"],
                      ["Confirmation Code", installLike.confirmationCode || "\u2014"]
                    ].map(([label, value]) => /* @__PURE__ */ jsx("div", { children: renderField(
                      label,
                      String(value),
                      value !== "\u2014" ? /* @__PURE__ */ jsxs(
                        "button",
                        {
                          onClick: () => copyToClipboard2(String(value)),
                          className: "inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--bokmoo-primary)]",
                          children: [
                            /* @__PURE__ */ jsx(Copy, { className: "h-3.5 w-3.5" }),
                            "Copy"
                          ]
                        }
                      ) : void 0
                    ) }, `${label}-${value}`)) }) : null,
                    sections3.codes.length ? /* @__PURE__ */ jsx("div", { className: "grid gap-3 md:grid-cols-2", children: sections3.codes.map((field) => /* @__PURE__ */ jsx("div", { children: renderField(
                      field.label,
                      field.value,
                      /* @__PURE__ */ jsxs(
                        "button",
                        {
                          onClick: () => copyToClipboard2(field.value),
                          className: "inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--bokmoo-primary)]",
                          children: [
                            /* @__PURE__ */ jsx(Copy, { className: "h-3.5 w-3.5" }),
                            "Copy"
                          ]
                        }
                      )
                    ) }, `${item.id}-${field.label}-${field.value}`)) }) : null,
                    sections3.credentials.length ? /* @__PURE__ */ jsx("div", { className: "grid gap-3 md:grid-cols-2", children: sections3.credentials.map((field) => /* @__PURE__ */ jsx("div", { children: renderField(
                      field.label,
                      field.value,
                      /* @__PURE__ */ jsxs(
                        "button",
                        {
                          onClick: () => copyToClipboard2(field.value),
                          className: "inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--bokmoo-primary)]",
                          children: [
                            /* @__PURE__ */ jsx(Copy, { className: "h-3.5 w-3.5" }),
                            "Copy"
                          ]
                        }
                      )
                    ) }, `${item.id}-${field.label}-${field.value}`)) }) : null,
                    sections3.links.length ? /* @__PURE__ */ jsx("div", { className: "grid gap-3", children: sections3.links.map(
                      (field) => renderField(
                        field.label,
                        field.value,
                        /* @__PURE__ */ jsxs(
                          "a",
                          {
                            href: field.href,
                            target: "_blank",
                            rel: "noreferrer",
                            className: "inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--bokmoo-primary)]",
                            children: [
                              /* @__PURE__ */ jsx(ExternalLink, { className: "h-3.5 w-3.5" }),
                              "Open"
                            ]
                          }
                        )
                      )
                    ) }) : null,
                    sections3.meta.length ? /* @__PURE__ */ jsx("div", { className: "grid gap-3 md:grid-cols-2", children: sections3.meta.map((field) => /* @__PURE__ */ jsx("div", { children: renderField(field.label, field.value) }, `${item.id}-${field.label}-${field.value}`)) }) : null,
                    sections3.notes.length ? /* @__PURE__ */ jsxs("div", { className: "rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-5", children: [
                      /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--bokmoo-copy-soft)]", children: "Notes" }),
                      /* @__PURE__ */ jsx("div", { className: "mt-3 space-y-2", children: sections3.notes.map((note) => /* @__PURE__ */ jsx("p", { className: "text-sm leading-6 text-[var(--bokmoo-copy)]", children: note }, note)) })
                    ] }) : null
                  ] }) : /* @__PURE__ */ jsx("div", { className: "mt-6 rounded-[var(--bokmoo-radius-md)] border border-dashed border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-5 text-sm leading-6 text-[var(--bokmoo-copy)]", children: "This order is still waiting for fulfillment details. Refresh later or reopen it from the order archive." })
                ]
              },
              item.id
            );
          })
        ] }),
        /* @__PURE__ */ jsxs("aside", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-6 shadow-[var(--bokmoo-shadow)]", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx("div", { className: "flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[var(--bokmoo-primary-soft)] text-[var(--bokmoo-primary)]", children: /* @__PURE__ */ jsx(PackageCheck, { className: "h-5 w-5" }) }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Order total" }),
                /* @__PURE__ */ jsxs("p", { className: "mt-1 text-3xl font-black tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: [
                  "$",
                  Number(effectiveOrder.totalAmount || 0).toFixed(2)
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "mt-6 space-y-3 text-sm text-[var(--bokmoo-copy)]", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                /* @__PURE__ */ jsx("span", { children: "Currency" }),
                /* @__PURE__ */ jsx("span", { className: "font-semibold text-[var(--bokmoo-ink)]", children: effectiveOrder.currency })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                /* @__PURE__ */ jsx("span", { children: "Payment" }),
                /* @__PURE__ */ jsx("span", { className: "font-semibold text-[var(--bokmoo-ink)]", children: effectiveOrder.paymentStatus })
              ] }),
              effectiveOrder.cancelReason ? /* @__PURE__ */ jsxs("div", { className: "rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-4", children: [
                /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold tracking-[0.16em] text-[var(--bokmoo-copy-soft)]", children: "Cancel reason" }),
                /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-[var(--bokmoo-copy)]", children: effectiveOrder.cancelReason })
              ] }) : null
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-6 shadow-[var(--bokmoo-shadow)]", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
            /* @__PURE__ */ jsx("div", { className: "flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[var(--bokmoo-primary-soft)] text-[var(--bokmoo-primary)]", children: /* @__PURE__ */ jsx(ShieldCheck, { className: "h-5 w-5" }) }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Access reminder" }),
              /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm leading-6 text-[var(--bokmoo-copy)]", children: "Keep a copy of any sensitive credentials in your own password manager or secure notes after claiming the order." })
            ] })
          ] }) })
        ] })
      ] })
    ] }) });
  });

  // src/components/OrdersPage.tsx
  function getStatusTone(status) {
    const normalized = status.toUpperCase();
    if (normalized === "DELIVERED" || normalized === "COMPLETED") return "bg-[color:color-mix(in_oklab,var(--bokmoo-success)_18%,white)] text-[var(--bokmoo-ink)]";
    if (normalized === "PENDING" || normalized === "PAID" || normalized === "PROCESSING") return "bg-[color:color-mix(in_oklab,var(--bokmoo-warning)_18%,white)] text-[var(--bokmoo-ink)]";
    if (normalized === "CANCELLED" || normalized === "REFUNDED") return "bg-[color:color-mix(in_oklab,var(--bokmoo-danger)_14%,white)] text-[var(--bokmoo-ink)]";
    return "bg-[var(--bokmoo-primary-soft)] text-[var(--bokmoo-primary-strong)]";
  }
  var OrdersPage = react_default.memo(function OrdersPage2({
    orders,
    isLoading,
    error,
    currentPage,
    totalPages,
    config,
    onPageChange,
    onOrderClick,
    onCancelOrder
  }) {
    const site = resolveBokmooSiteConfig(config);
    const [remoteOrders, setRemoteOrders] = react_default.useState([]);
    const [remoteTotalPages, setRemoteTotalPages] = react_default.useState(1);
    const [remoteLoading, setRemoteLoading] = react_default.useState(false);
    const [remoteError, setRemoteError] = react_default.useState("");
    react_default.useEffect(() => {
      if (orders.length > 0) return;
      let cancelled = false;
      setRemoteLoading(true);
      setRemoteError("");
      void getBokmooOrders(
        {
          baseUrl: site.apiBaseUrl
        },
        {
          page: currentPage || 1,
          limit: 10
        }
      ).then((response) => {
        if (cancelled) return;
        setRemoteOrders(response.items.map(mapBokmooApiOrderToThemeOrder));
        setRemoteTotalPages(Math.max(1, Math.ceil(Number(response.total || response.items.length || 0) / 10)));
      }).catch((loadError) => {
        if (cancelled) return;
        const message = loadError instanceof Error ? loadError.message : "Unable to load orders.";
        setRemoteError(message);
        setRemoteOrders([]);
        setRemoteTotalPages(1);
      }).finally(() => {
        if (!cancelled) {
          setRemoteLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [currentPage, orders.length, site.apiBaseUrl]);
    const effectiveOrders = remoteOrders.length > 0 ? remoteOrders : orders;
    const displayError = error || remoteError;
    const displayTotalPages = remoteOrders.length > 0 ? remoteTotalPages : totalPages;
    if (isLoading || remoteLoading && effectiveOrders.length === 0) {
      return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)]" });
    }
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1280px]", children: [
      /* @__PURE__ */ jsx("section", { className: "rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 md:flex-row md:items-end md:justify-between", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-2 text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy)]", children: [
            /* @__PURE__ */ jsx(ShieldCheck, { className: "h-4 w-4 text-[var(--bokmoo-primary)]" }),
            "Order archive"
          ] }),
          /* @__PURE__ */ jsx("h1", { className: "mt-5 text-[clamp(2.2rem,5vw,4.2rem)] font-black leading-[0.94] tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: "Every purchase stays readable after checkout." })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-sm text-[var(--bokmoo-copy)]", children: "Keep status, delivery details, and activation notes visible after checkout." })
      ] }) }),
      displayError ? /* @__PURE__ */ jsx("div", { className: "mt-6 rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-8 text-[var(--bokmoo-copy)] shadow-[var(--bokmoo-shadow)]", children: displayError }) : null,
      /* @__PURE__ */ jsx("section", { className: "mt-6 grid gap-4", children: effectiveOrders.length === 0 ? /* @__PURE__ */ jsx("div", { className: "rounded-[var(--bokmoo-radius-lg)] border border-dashed border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-16 text-center text-[var(--bokmoo-copy)]", children: "No travel orders yet." }) : effectiveOrders.map((order) => {
        const artifactCount = order.items.reduce(
          (sum, item) => sum + getDeliveredArtifactCount(item.fulfillmentData),
          0
        );
        const canCancel = Boolean(onCancelOrder) && ["PENDING", "PAID"].includes(order.status.toUpperCase());
        return /* @__PURE__ */ jsx(
          "article",
          {
            className: "rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-5 shadow-[var(--bokmoo-shadow)]",
            children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between", children: [
              /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
                  /* @__PURE__ */ jsx("span", { className: cn2("rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.16em]", getStatusTone(order.status)), children: order.status }),
                  /* @__PURE__ */ jsxs("span", { className: "rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-[var(--bokmoo-copy)]", children: [
                    artifactCount,
                    " delivered item",
                    artifactCount === 1 ? "" : "s"
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("h2", { className: "mt-4 text-2xl font-black tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: [
                  "Order #",
                  order.id.slice(-8).toUpperCase()
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "mt-3 flex flex-wrap gap-4 text-sm text-[var(--bokmoo-copy)]", children: [
                  /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-2", children: [
                    /* @__PURE__ */ jsx(Clock3, { className: "h-4 w-4" }),
                    new Date(order.createdAt).toLocaleString()
                  ] }),
                  /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-2", children: [
                    /* @__PURE__ */ jsx(Package2, { className: "h-4 w-4" }),
                    order.items.length,
                    " item",
                    order.items.length === 1 ? "" : "s"
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center", children: [
                /* @__PURE__ */ jsxs("div", { className: "rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-right", children: [
                  /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold tracking-[0.16em] text-[var(--bokmoo-copy-soft)]", children: "Total" }),
                  /* @__PURE__ */ jsxs("p", { className: "mt-1 text-2xl font-black tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: [
                    "$",
                    Number(order.totalAmount || 0).toFixed(2)
                  ] })
                ] }),
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    onClick: () => onOrderClick(order.id),
                    className: "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--bokmoo-primary)] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white",
                    children: [
                      "Open order",
                      /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4" })
                    ]
                  }
                ),
                canCancel ? /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => onCancelOrder(order.id),
                    className: "inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)]",
                    children: "Cancel order"
                  }
                ) : null
              ] })
            ] })
          },
          order.id
        );
      }) }),
      displayTotalPages > 1 ? /* @__PURE__ */ jsxs("div", { className: "mt-10 flex items-center justify-center gap-3", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => onPageChange(Math.max(1, currentPage - 1)),
            disabled: currentPage <= 1,
            className: "rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)] disabled:opacity-40",
            children: "Previous"
          }
        ),
        /* @__PURE__ */ jsxs("span", { className: "rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] px-5 py-3 text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy)]", children: [
          "Page ",
          currentPage,
          " / ",
          displayTotalPages
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => onPageChange(Math.min(displayTotalPages, currentPage + 1)),
            disabled: currentPage >= displayTotalPages,
            className: "rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)] disabled:opacity-40",
            children: "Next"
          }
        )
      ] }) : null
    ] }) });
  });

  // src/components/OrderSuccessPage.tsx
  function copyToClipboard3(value) {
    if (!value || typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(value).catch(() => void 0);
  }
  function getPollDelay(attempt) {
    if (attempt < 10) return 3e3;
    if (attempt < 22) return 1e4;
    return 0;
  }
  var OrderSuccessPage = react_default.memo(function OrderSuccessPage2({
    orderNumber,
    isVerifying,
    onContinueShopping,
    onViewOrders,
    config,
    order
  }) {
    const site = resolveBokmooSiteConfig(config);
    const orderId = order?.id || getOrderIdFromLocation() || "";
    const [installSession, setInstallSession] = react_default.useState(null);
    const [status, setStatus] = react_default.useState(
      isVerifying ? "processing" : "idle"
    );
    const [errorMessage, setErrorMessage] = react_default.useState("");
    const [attempt, setAttempt] = react_default.useState(0);
    const loadInstallSession = react_default.useCallback(async () => {
      if (!orderId) return;
      try {
        const session = await getBokmooInstallSession(
          {
            baseUrl: site.apiBaseUrl
          },
          orderId
        );
        setInstallSession(session);
        setStatus(session.status);
        setErrorMessage("");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load install session.";
        setErrorMessage(message);
        setStatus("failed");
      }
    }, [orderId, site.apiBaseUrl]);
    react_default.useEffect(() => {
      if (!orderId) return;
      void loadInstallSession();
    }, [loadInstallSession, orderId]);
    react_default.useEffect(() => {
      if (!orderId) return;
      if (status !== "processing" && status !== "idle") return;
      const delay2 = getPollDelay(attempt);
      if (delay2 <= 0) {
        setErrorMessage("Fulfillment is taking longer than expected. Please refresh or contact support.");
        return;
      }
      const timer = window.setTimeout(() => {
        setAttempt((current) => current + 1);
        void loadInstallSession();
      }, delay2);
      return () => window.clearTimeout(timer);
    }, [attempt, loadInstallSession, orderId, status]);
    const isReady = status === "ready" || status === "installed";
    const isPendingPayment = status === "pending_payment";
    const supportEmail = installSession?.support?.email || site.supportEmail;
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-24 pt-10 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-[520px]", children: /* @__PURE__ */ jsxs("div", { className: "rounded-[1.6rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] p-6 text-center shadow-[var(--bokmoo-shadow)] sm:p-8", children: [
      /* @__PURE__ */ jsx("div", { className: "mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_36%,transparent)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)] text-[var(--bokmoo-gold)]", children: status === "failed" || status === "expired" || isPendingPayment ? /* @__PURE__ */ jsx(TriangleAlert, { className: "h-11 w-11" }) : status === "processing" || isVerifying ? /* @__PURE__ */ jsx(LoaderCircle, { className: "h-11 w-11 animate-spin" }) : /* @__PURE__ */ jsx(CircleCheck, { className: "h-11 w-11" }) }),
      /* @__PURE__ */ jsx("h1", { className: "mt-8 text-[clamp(2.2rem,4vw,3.6rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: status === "failed" ? "Fulfillment Needs Attention" : isPendingPayment ? "Payment Pending" : status === "expired" ? "Activation Expired" : status === "processing" || isVerifying ? "Preparing your eSIM..." : "Payment Successful!" }),
      /* @__PURE__ */ jsx("p", { className: "mt-4 text-base leading-8 text-[var(--bokmoo-copy)]", children: status === "failed" ? errorMessage || "We could not prepare your install session yet." : isPendingPayment ? "Complete payment to unlock your eSIM install details." : status === "expired" ? "Your activation session expired before installation completed." : status === "processing" || isVerifying ? "Your order is paid. We are preparing the install session now." : "Your eSIM is ready to use." }),
      installSession?.packageTitle ? /* @__PURE__ */ jsx("div", { className: "mx-auto mt-8 max-w-[320px] rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-4 text-left", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
        /* @__PURE__ */ jsx("div", { className: "h-16 w-20 overflow-hidden rounded-[0.8rem] bg-[linear-gradient(160deg,#924a57_0%,#261922_44%,#0f1115_100%)]" }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[var(--bokmoo-ink)]", children: installSession.packageTitle }),
          /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-[var(--bokmoo-copy-soft)]", children: installSession.smdpAddress || "eSIM activation" }),
          /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-[var(--bokmoo-copy-soft)]", children: installSession.expiresAt ? `Expires ${new Date(installSession.expiresAt).toLocaleDateString()}` : "Ready to install" })
        ] })
      ] }) }) : null,
      isReady && installSession ? /* @__PURE__ */ jsx(InstallSessionPanel, { className: "mt-8", session: installSession }) : null,
      /* @__PURE__ */ jsxs("div", { className: "mt-8 space-y-3", children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: isReady ? onViewOrders : () => void loadInstallSession(),
            className: "flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.95rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-5 text-sm font-semibold text-[var(--bokmoo-bg)]",
            type: "button",
            children: [
              isReady ? "View eSIM Details" : "Refresh Status",
              !isReady ? /* @__PURE__ */ jsx(RefreshCw, { className: "h-4 w-4" }) : null
            ]
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: onContinueShopping,
            className: "flex min-h-12 w-full items-center justify-center rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-5 text-sm font-medium text-[var(--bokmoo-ink)]",
            type: "button",
            children: "Back to Store"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-6 space-y-2 text-sm text-[var(--bokmoo-copy-soft)]", children: [
        /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 rounded-full border border-[var(--bokmoo-line)] px-4 py-2", children: [
          "Order reference",
          /* @__PURE__ */ jsx("code", { className: "font-semibold text-[var(--bokmoo-ink)]", children: orderNumber }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => copyToClipboard3(orderNumber),
              className: "text-[var(--bokmoo-gold)]",
              type: "button",
              children: /* @__PURE__ */ jsx(Copy, { className: "h-3.5 w-3.5" })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("p", { children: [
          "Support: ",
          /* @__PURE__ */ jsx("a", { className: "text-[var(--bokmoo-ink)] underline", href: `mailto:${supportEmail}`, children: supportEmail })
        ] })
      ] })
    ] }) }) });
  });

  // src/components/PrivacyPage.tsx
  var sections = [
    ["Information We Collect", "We collect information you provide directly to us, such as when you create an account or make a purchase."],
    ["How We Use Information", "We use the information to provide, maintain, and improve our services."],
    ["Data Protection", "We implement appropriate security measures to protect your data."],
    ["Your Rights", "You have the right to access, update, or delete your personal information."]
  ];
  var PrivacyPage = react_default.memo(function PrivacyPage2(_props) {
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-24 pt-10 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[980px] rounded-[1.6rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8", children: [
      /* @__PURE__ */ jsx("h1", { className: "text-[clamp(2.2rem,4vw,3.5rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: "Privacy Policy" }),
      /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm text-[var(--bokmoo-copy-soft)]", children: "Last updated: April 15, 2024" }),
      /* @__PURE__ */ jsx("div", { className: "mt-8 space-y-5", children: sections.map(([title, body], index) => /* @__PURE__ */ jsxs(
        "section",
        {
          className: "rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-5",
          children: [
            /* @__PURE__ */ jsxs("p", { className: "text-base font-medium text-[var(--bokmoo-ink)]", children: [
              index + 1,
              ". ",
              title
            ] }),
            /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-7 text-[var(--bokmoo-copy)]", children: body })
          ]
        },
        title
      )) })
    ] }) });
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
      return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)]" });
    }
    if (!isAuthenticated || !user) {
      return /* @__PURE__ */ jsx("div", { className: "flex min-h-screen items-center justify-center bg-[var(--bokmoo-bg)] px-4", children: /* @__PURE__ */ jsxs("div", { className: "rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-10 text-center shadow-[var(--bokmoo-shadow)]", children: [
        /* @__PURE__ */ jsx("h1", { className: "text-3xl leading-[1] tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: "Sign in to manage your account" }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: onNavigateToLogin,
            className: "mt-6 rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-bg)]",
            type: "button",
            children: "Log In"
          }
        )
      ] }) });
    }
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1080px]", children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: onNavigateBack,
          className: "inline-flex items-center gap-2 rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)]",
          type: "button",
          children: [
            /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
            "Back"
          ]
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-6 lg:grid-cols-2", children: [
        /* @__PURE__ */ jsxs("section", { className: "rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4", children: [
            /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(UserRound, { className: "h-6 w-6" }) }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Traveler profile" }),
              /* @__PURE__ */ jsx("h1", { className: "mt-2 text-3xl leading-[1] tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: "Keep your BOKMOO account ready for the next trip." })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-4 sm:grid-cols-2", children: [
            /* @__PURE__ */ jsxs("label", { className: "grid gap-2 sm:col-span-2", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Email" }),
              /* @__PURE__ */ jsx("input", { value: user.email, readOnly: true, className: "h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-copy)] outline-none" })
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "grid gap-2 sm:col-span-2", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Name" }),
              /* @__PURE__ */ jsx("input", { value: profile.name, onChange: (event) => setProfile((prev) => ({ ...prev, name: event.target.value })), className: "h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" })
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Phone" }),
              /* @__PURE__ */ jsx("input", { value: profile.phone, onChange: (event) => setProfile((prev) => ({ ...prev, phone: event.target.value })), className: "h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" })
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Date of birth" }),
              /* @__PURE__ */ jsx("input", { value: profile.dateOfBirth, onChange: (event) => setProfile((prev) => ({ ...prev, dateOfBirth: event.target.value })), className: "h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" })
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Language" }),
              /* @__PURE__ */ jsx("input", { value: profile.preferredLanguage, onChange: (event) => setProfile((prev) => ({ ...prev, preferredLanguage: event.target.value })), className: "h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" })
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Timezone" }),
              /* @__PURE__ */ jsx("input", { value: profile.timezone, onChange: (event) => setProfile((prev) => ({ ...prev, timezone: event.target.value })), className: "h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: async () => {
                setSavingProfile(true);
                try {
                  await onSaveProfile(profile);
                } finally {
                  setSavingProfile(false);
                }
              },
              className: "mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-5 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-bg)]",
              disabled: savingProfile,
              type: "button",
              children: [
                /* @__PURE__ */ jsx(Save, { className: "h-4 w-4" }),
                savingProfile ? "Saving..." : "Save profile"
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("section", { className: "rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4", children: [
            /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(LockKeyhole, { className: "h-6 w-6" }) }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Password" }),
              /* @__PURE__ */ jsx("h2", { className: "mt-2 text-3xl leading-[1] tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: "Keep access secure between trips." })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-4", children: [
            /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Current password" }),
              /* @__PURE__ */ jsx("input", { type: "password", value: password.currentPassword, onChange: (event) => setPassword((prev) => ({ ...prev, currentPassword: event.target.value })), className: "h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" })
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "New password" }),
              /* @__PURE__ */ jsx("input", { type: "password", value: password.newPassword, onChange: (event) => setPassword((prev) => ({ ...prev, newPassword: event.target.value })), className: "h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: async () => {
                setSavingPassword(true);
                try {
                  await onChangePassword(password.currentPassword, password.newPassword);
                  setPassword({ currentPassword: "", newPassword: "" });
                } finally {
                  setSavingPassword(false);
                }
              },
              className: "mt-6 inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--bokmoo-line-strong)] bg-[var(--bokmoo-bg)] px-5 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-ink)]",
              disabled: savingPassword,
              type: "button",
              children: [
                /* @__PURE__ */ jsx(LockKeyhole, { className: "h-4 w-4 text-[var(--bokmoo-gold)]" }),
                savingPassword ? "Updating..." : "Change password"
              ]
            }
          )
        ] })
      ] })
    ] }) });
  });

  // src/components/RegisterPage.tsx
  var FOCUS_VISIBLE_RING5 = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bokmoo-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bokmoo-bg)]";
  function RegisterPage({
    isLoading,
    error,
    config,
    onSubmit,
    onOAuthClick,
    onAppleOAuthClick,
    onNavigateToLogin
  }) {
    const site = resolveBokmooSiteConfig(config);
    const [formData, setFormData] = react_default.useState({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: ""
    });
    const [showPassword, setShowPassword] = react_default.useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = react_default.useState(false);
    const passwordsMatch = formData.password === formData.confirmPassword;
    const canSubmit = formData.firstName && formData.lastName && formData.email && formData.password && formData.confirmPassword && passwordsMatch;
    const updateField = (field) => (event) => setFormData((current) => ({ ...current, [field]: event.target.value }));
    const handleSubmit = async (event) => {
      event.preventDefault();
      if (!canSubmit) return;
      await onSubmit(formData);
    };
    const inputClassName = `h-13 w-full rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] py-3 pl-11 pr-4 text-sm font-medium text-[var(--bokmoo-ink)] outline-none placeholder:text-[var(--bokmoo-copy-soft)] transition-colors focus:border-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING5}`;
    return /* @__PURE__ */ jsxs("div", { className: "relative min-h-screen overflow-hidden bg-[var(--bokmoo-bg)] px-4 py-12 text-[var(--bokmoo-ink)] sm:px-6 lg:px-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "pointer-events-none absolute inset-0", children: [
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_80%_18%,color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent),transparent_25%),radial-gradient(circle_at_12%_76%,color-mix(in_oklab,var(--bokmoo-gold)_8%,transparent),transparent_26%),linear-gradient(180deg,var(--bokmoo-bg),color-mix(in_oklab,var(--bokmoo-bg)_86%,black))]" }),
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 opacity-40 [background-image:var(--bokmoo-grid)] [background-size:72px_72px]" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "relative mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1180px] items-center gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(24rem,0.68fr)]", children: [
        /* @__PURE__ */ jsxs("section", { className: "hidden lg:block", children: [
          /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-3 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)] bg-[color:oklch(0.065_0.007_75_/_0.72)] px-5 py-2.5 text-[0.72rem] font-bold uppercase tracking-[0.28em] text-[var(--bokmoo-gold)]", children: [
            /* @__PURE__ */ jsx(ShieldCheck, { className: "h-4 w-4" }),
            "Protected traveler identity"
          ] }),
          /* @__PURE__ */ jsx("h1", { className: "mt-7 max-w-3xl text-[clamp(3.4rem,7vw,6.1rem)] font-semibold leading-[0.92] tracking-[-0.065em] text-[var(--bokmoo-ink)]", children: "Create the account your eSIMs follow." }),
          /* @__PURE__ */ jsx("p", { className: "mt-7 max-w-2xl text-lg leading-8 text-[var(--bokmoo-copy)]", children: "Keep orders, activation codes, profile history, and support cases attached to one BOKMOO identity." })
        ] }),
        /* @__PURE__ */ jsx("section", { className: "mx-auto w-full max-w-[32rem] rounded-[1.45rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,transparent)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_94%,white),var(--bokmoo-bg-elevated))] p-5 shadow-[var(--bokmoo-shadow)] sm:p-7", children: /* @__PURE__ */ jsxs("div", { className: "rounded-[1.1rem] border border-[var(--bokmoo-line)] bg-[color:oklch(0.055_0.006_75_/_0.78)] p-5 sm:p-6", children: [
          /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--bokmoo-gold)]", children: [
            site.brandName.toUpperCase(),
            " account"
          ] }),
          /* @__PURE__ */ jsx("h2", { className: "mt-3 text-3xl font-semibold leading-none tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: "Create account" }),
          /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--bokmoo-copy)]", children: "Start with a secure profile for purchases and global activation support." }),
          /* @__PURE__ */ jsxs("div", { className: "mt-7 grid gap-3 sm:grid-cols-2", children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => onOAuthClick("google"),
                className: `inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_86%,black)] px-4 text-sm font-semibold text-[var(--bokmoo-ink)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_VISIBLE_RING5}`,
                disabled: isLoading,
                children: [
                  /* @__PURE__ */ jsx(Chrome, { className: "h-4 w-4" }),
                  "Google"
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => onAppleOAuthClick?.(),
                className: `inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_86%,black)] px-4 text-sm font-semibold text-[var(--bokmoo-ink)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_VISIBLE_RING5}`,
                disabled: isLoading || !onAppleOAuthClick,
                children: [
                  /* @__PURE__ */ jsx(Apple, { className: "h-4 w-4" }),
                  "Apple"
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-6 flex items-center gap-3", children: [
            /* @__PURE__ */ jsx("div", { className: "h-px flex-1 bg-[var(--bokmoo-line)]" }),
            /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--bokmoo-copy-soft)]", children: "or email" }),
            /* @__PURE__ */ jsx("div", { className: "h-px flex-1 bg-[var(--bokmoo-line)]" })
          ] }),
          /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, className: "mt-7 space-y-5", children: [
            error ? /* @__PURE__ */ jsx("div", { className: "rounded-[0.95rem] border border-[color:color-mix(in_oklab,var(--bokmoo-danger)_48%,transparent)] bg-[color:color-mix(in_oklab,var(--bokmoo-danger)_12%,transparent)] p-4 text-sm leading-6 text-[var(--bokmoo-ink)]", children: error }) : null,
            /* @__PURE__ */ jsx("div", { className: "grid gap-4 sm:grid-cols-2", children: ["firstName", "lastName"].map((field) => /* @__PURE__ */ jsxs("label", { className: "block", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: field === "firstName" ? "First name" : "Last name" }),
              /* @__PURE__ */ jsxs("span", { className: "relative mt-2 block", children: [
                /* @__PURE__ */ jsx(UserRound, { className: "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    value: formData[field],
                    onChange: updateField(field),
                    placeholder: field === "firstName" ? "Ada" : "Lovelace",
                    className: inputClassName,
                    disabled: isLoading,
                    autoComplete: field === "firstName" ? "given-name" : "family-name"
                  }
                )
              ] })
            ] }, field)) }),
            /* @__PURE__ */ jsxs("label", { className: "block", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Email" }),
              /* @__PURE__ */ jsxs("span", { className: "relative mt-2 block", children: [
                /* @__PURE__ */ jsx(Mail, { className: "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "email",
                    value: formData.email,
                    onChange: updateField("email"),
                    placeholder: "you@example.com",
                    className: inputClassName,
                    disabled: isLoading,
                    autoComplete: "email"
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
              /* @__PURE__ */ jsxs("label", { className: "block", children: [
                /* @__PURE__ */ jsx("span", { className: "text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Password" }),
                /* @__PURE__ */ jsxs("span", { className: "relative mt-2 block", children: [
                  /* @__PURE__ */ jsx(LockKeyhole, { className: "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" }),
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: showPassword ? "text" : "password",
                      value: formData.password,
                      onChange: updateField("password"),
                      placeholder: "........",
                      className: `${inputClassName} pr-12`,
                      disabled: isLoading,
                      autoComplete: "new-password"
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: () => setShowPassword((value) => !value),
                      className: `absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[0.8rem] text-[var(--bokmoo-copy-soft)] hover:text-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING5}`,
                      disabled: isLoading,
                      "aria-label": showPassword ? "Hide password" : "Show password",
                      children: showPassword ? /* @__PURE__ */ jsx(EyeOff, { className: "h-4 w-4" }) : /* @__PURE__ */ jsx(Eye, { className: "h-4 w-4" })
                    }
                  )
                ] })
              ] }),
              /* @__PURE__ */ jsxs("label", { className: "block", children: [
                /* @__PURE__ */ jsx("span", { className: "text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Confirm" }),
                /* @__PURE__ */ jsxs("span", { className: "relative mt-2 block", children: [
                  /* @__PURE__ */ jsx(LockKeyhole, { className: "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" }),
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: showConfirmPassword ? "text" : "password",
                      value: formData.confirmPassword,
                      onChange: updateField("confirmPassword"),
                      placeholder: "........",
                      className: `${inputClassName} pr-12 ${formData.confirmPassword && !passwordsMatch ? "border-[var(--bokmoo-danger)]" : ""}`,
                      disabled: isLoading,
                      autoComplete: "new-password"
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: () => setShowConfirmPassword((value) => !value),
                      className: `absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[0.8rem] text-[var(--bokmoo-copy-soft)] hover:text-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING5}`,
                      disabled: isLoading,
                      "aria-label": showConfirmPassword ? "Hide password" : "Show password",
                      children: showConfirmPassword ? /* @__PURE__ */ jsx(EyeOff, { className: "h-4 w-4" }) : /* @__PURE__ */ jsx(Eye, { className: "h-4 w-4" })
                    }
                  )
                ] }),
                formData.confirmPassword && !passwordsMatch ? /* @__PURE__ */ jsx("span", { className: "mt-2 block text-xs text-[var(--bokmoo-danger)]", children: "Passwords do not match" }) : null
              ] })
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "submit",
                disabled: isLoading || !canSubmit,
                className: `inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-[1rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_88%,white),color-mix(in_oklab,var(--bokmoo-gold)_64%,black))] px-5 text-sm font-black uppercase tracking-[0.2em] text-[var(--bokmoo-bg)] shadow-[0_18px_42px_color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] transition-transform duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_VISIBLE_RING5}`,
                children: isLoading ? /* @__PURE__ */ jsxs(Fragment2, { children: [
                  /* @__PURE__ */ jsx(LoaderCircle, { className: "h-4 w-4 animate-spin" }),
                  "Creating"
                ] }) : "Create account"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-7 border-t border-[var(--bokmoo-line)] pt-6 text-center", children: [
            /* @__PURE__ */ jsx("p", { className: "text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Already have an account?" }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: onNavigateToLogin,
                className: `mt-3 text-sm font-semibold text-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold-strong)] ${FOCUS_VISIBLE_RING5}`,
                disabled: isLoading,
                children: "Sign in"
              }
            )
          ] })
        ] }) })
      ] })
    ] });
  }

  // src/components/ProductDetailPage.tsx
  function getProductImage2(product) {
    if (!product?.images?.length) return null;
    const primary = product.images.find((image) => image.isMain) || product.images[0];
    return primary?.url || null;
  }
  function getVariantLabel(variant) {
    return variant.name || variant.value || variant.sku || "Default option";
  }
  var ProductDetailPage = react_default.memo(function ProductDetailPage2({
    product,
    isLoading,
    selectedVariant,
    quantity,
    onVariantChange,
    onQuantityChange,
    onAddToCart,
    onBack,
    config,
    locale
  }) {
    const site = resolveBokmooSiteConfig(config);
    const [remoteProduct, setRemoteProduct] = react_default.useState(null);
    const [remoteLoading, setRemoteLoading] = react_default.useState(false);
    const normalizedProduct = react_default.useMemo(
      () => product ? normalizeProductForTheme(product) : remoteProduct,
      [product, remoteProduct]
    );
    const profile = react_default.useMemo(() => getBokmooTravelProfile(normalizedProduct), [normalizedProduct]);
    const effectiveSelectedVariant = selectedVariant || normalizedProduct?.variants?.[0]?.id || null;
    const currentVariant = react_default.useMemo(() => {
      if (!normalizedProduct?.variants?.length || !effectiveSelectedVariant) return null;
      return normalizedProduct.variants.find((variant) => variant.id === effectiveSelectedVariant) || null;
    }, [effectiveSelectedVariant, normalizedProduct]);
    const stockValue = Number(currentVariant?.inventory ?? normalizedProduct?.inventory?.available ?? 0);
    const priceValue = Number(currentVariant?.price ?? normalizedProduct?.price ?? 0);
    const maxQuantity = Math.max(1, Math.min(stockValue || 1, 10));
    const image = getProductImage2(normalizedProduct);
    react_default.useEffect(() => {
      if (product) return;
      const productId = getProductIdFromLocation();
      if (!productId) return;
      let cancelled = false;
      setRemoteLoading(true);
      void getBokmooProduct(
        {
          baseUrl: site.apiBaseUrl
        },
        productId,
        locale || "en"
      ).then((response) => {
        if (!cancelled) {
          setRemoteProduct(mapBokmooApiProductToThemeProduct(response));
        }
      }).catch(() => void 0).finally(() => {
        if (!cancelled) {
          setRemoteLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [locale, product, site.apiBaseUrl]);
    react_default.useEffect(() => {
      if (selectedVariant || !normalizedProduct?.variants?.length) return;
      onVariantChange(normalizedProduct.variants[0].id);
    }, [normalizedProduct?.variants, onVariantChange, selectedVariant]);
    if (isLoading || remoteLoading && !normalizedProduct) {
      return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)]" });
    }
    if (!normalizedProduct) {
      return /* @__PURE__ */ jsx("div", { className: "flex min-h-screen items-center justify-center bg-[var(--bokmoo-bg)] px-4", children: /* @__PURE__ */ jsxs("div", { className: "rounded-[1.5rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-10 text-center shadow-[var(--bokmoo-shadow)]", children: [
        /* @__PURE__ */ jsx("h1", { className: "text-3xl font-semibold tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: "Plan not found" }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: onBack,
            className: "mt-6 inline-flex min-h-11 items-center gap-2 rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-5 text-sm font-semibold text-[var(--bokmoo-bg)]",
            type: "button",
            children: [
              /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
              "Back to store"
            ]
          }
        )
      ] }) });
    }
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--bokmoo-gold)_9%,transparent),transparent_34%),var(--bokmoo-bg)] px-4 pb-24 pt-8 sm:px-6 sm:pt-10 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[980px]", children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: onBack,
          className: "inline-flex items-center gap-2 text-sm text-[var(--bokmoo-copy-soft)] hover:text-[var(--bokmoo-ink)]",
          type: "button",
          children: [
            /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
            "Back to Store"
          ]
        }
      ),
      /* @__PURE__ */ jsx("div", { className: "mt-5 rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,var(--bokmoo-line))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_80%,black),color-mix(in_oklab,var(--bokmoo-bg-elevated)_92%,black))] p-3 shadow-[var(--bokmoo-shadow)] sm:rounded-[1.55rem] sm:p-5", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-6 lg:grid-cols-[minmax(0,0.96fr)_22rem]", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { className: "overflow-hidden rounded-[1.05rem] border border-[var(--bokmoo-line)] sm:rounded-[1.2rem]", children: image ? /* @__PURE__ */ jsx("img", { src: image, alt: normalizedProduct.name, className: "aspect-[1.28/1] h-full w-full object-cover sm:aspect-[1.6/1]" }) : /* @__PURE__ */ jsx("div", { className: "aspect-[1.28/1] bg-[linear-gradient(160deg,#924a57_0%,#261922_44%,#0f1115_100%)] sm:aspect-[1.6/1]" }) }),
          /* @__PURE__ */ jsxs("div", { className: "mt-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("h1", { className: "text-[clamp(2.2rem,4vw,3.4rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: normalizedProduct.name }),
              /* @__PURE__ */ jsx("p", { className: "mt-2 text-lg text-[var(--bokmoo-copy)]", children: profile.networkLabel })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "sm:text-right", children: /* @__PURE__ */ jsxs("p", { className: "text-[2.3rem] font-semibold tracking-[-0.05em] text-[var(--bokmoo-gold)]", children: [
              "$",
              priceValue.toFixed(2)
            ] }) })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "mt-5 grid gap-3 sm:grid-cols-3", children: [
            { label: "Data", value: profile.planLabel },
            { label: "Validity", value: profile.durationLabel },
            { label: "Network", value: profile.networkLabel }
          ].map((item) => /* @__PURE__ */ jsxs(
            "div",
            {
              className: "rounded-[1rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 py-4",
              children: [
                /* @__PURE__ */ jsx("p", { className: "text-[11px] uppercase tracking-[0.16em] text-[var(--bokmoo-copy-soft)]", children: item.label }),
                /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm font-medium text-[var(--bokmoo-ink)]", children: item.value })
              ]
            },
            item.label
          )) }),
          /* @__PURE__ */ jsx("div", { className: "mt-6 space-y-3", children: [
            "High-speed 4G/5G data",
            "Stay connected in major cities and more",
            "No roaming charges"
          ].map((item) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 text-sm text-[var(--bokmoo-copy)]", children: [
            /* @__PURE__ */ jsx(Check, { className: "h-4 w-4 text-[var(--bokmoo-gold)]" }),
            /* @__PURE__ */ jsx("span", { children: item })
          ] }, item)) }),
          /* @__PURE__ */ jsx("div", { className: "mt-6 rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[var(--bokmoo-ink)]", children: "Coverage" }),
              /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-[var(--bokmoo-copy-soft)]", children: profile.coverageLabel })
            ] }),
            /* @__PURE__ */ jsx("button", { className: "text-sm text-[var(--bokmoo-gold)]", type: "button", children: "View Details" })
          ] }) })
        ] }),
        /* @__PURE__ */ jsxs("aside", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4", children: [
            /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[var(--bokmoo-ink)]", children: "Quick Facts" }),
            /* @__PURE__ */ jsx("div", { className: "mt-4 grid gap-3", children: [
              { icon: Signal, label: "Activation", value: "Instant via QR" },
              { icon: Smartphone, label: "Compatibility", value: profile.compatibilityLabel },
              { icon: ShieldCheck, label: "Support", value: "24/7 Global Team" }
            ].map(({ icon: Icon2, label, value }) => /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
              /* @__PURE__ */ jsx("div", { className: "mt-0.5 flex h-9 w-9 items-center justify-center rounded-[0.85rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(Icon2, { className: "h-4 w-4" }) }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("p", { className: "text-xs uppercase tracking-[0.14em] text-[var(--bokmoo-copy-soft)]", children: label }),
                /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-[var(--bokmoo-ink)]", children: value })
              ] })
            ] }, label)) })
          ] }),
          normalizedProduct.variants?.length ? /* @__PURE__ */ jsxs("div", { className: "rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4", children: [
            /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[var(--bokmoo-ink)]", children: "Choose an option" }),
            /* @__PURE__ */ jsx("div", { className: "mt-4 flex flex-wrap gap-2", children: normalizedProduct.variants.map((variant) => {
              const isActive = effectiveSelectedVariant === variant.id;
              return /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => onVariantChange(variant.id),
                  className: cn2(
                    "rounded-full border px-4 py-2 text-sm transition-colors",
                    isActive ? "border-[var(--bokmoo-line-strong)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] text-[var(--bokmoo-ink)]" : "border-[var(--bokmoo-line)] text-[var(--bokmoo-copy)]"
                  ),
                  type: "button",
                  children: getVariantLabel(variant)
                },
                variant.id
              );
            }) })
          ] }) : null,
          /* @__PURE__ */ jsxs("div", { className: "rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4", children: [
            /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[var(--bokmoo-ink)]", children: "Quantity" }),
            /* @__PURE__ */ jsxs("div", { className: "mt-4 flex items-center justify-between rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_86%,black)] px-3 py-2", children: [
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => onQuantityChange(Math.max(1, quantity - 1)),
                  className: "flex h-9 w-9 items-center justify-center rounded-full text-[var(--bokmoo-copy)]",
                  type: "button",
                  children: /* @__PURE__ */ jsx(Minus, { className: "h-4 w-4" })
                }
              ),
              /* @__PURE__ */ jsx("span", { className: "text-lg font-semibold text-[var(--bokmoo-ink)]", children: quantity }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => onQuantityChange(Math.min(maxQuantity, quantity + 1)),
                  className: "flex h-9 w-9 items-center justify-center rounded-full text-[var(--bokmoo-copy)]",
                  type: "button",
                  children: /* @__PURE__ */ jsx(Plus, { className: "h-4 w-4" })
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => onAddToCart(),
              disabled: stockValue <= 0,
              className: "flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.95rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-5 text-sm font-semibold text-[var(--bokmoo-bg)] disabled:cursor-not-allowed disabled:opacity-50",
              type: "button",
              children: [
                /* @__PURE__ */ jsx(ShoppingBag, { className: "h-4 w-4" }),
                "Add to Cart \u2014 $",
                priceValue.toFixed(2)
              ]
            }
          ),
          /* @__PURE__ */ jsx("div", { className: "rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-sm text-[var(--bokmoo-copy)]", children: [
            /* @__PURE__ */ jsx(Star, { className: "h-4 w-4 text-[var(--bokmoo-gold)]" }),
            "4.9 average traveler satisfaction"
          ] }) })
        ] })
      ] }) })
    ] }) });
  });

  // src/components/TermsPage.tsx
  var sections2 = [
    ["Acceptance of Terms", "By accessing or using the BOKMOO website and services, you agree to be bound by these Terms of Service."],
    ["Use of Services", "You agree to use our services only for lawful purposes and in accordance with these Terms."],
    ["Purchases and Payments", "All payments are final and non-refundable unless required by law."],
    ["Limitation of Liability", "BOKMOO is not liable for any indirect, incidental, or consequential damages."]
  ];
  var TermsPage = react_default.memo(function TermsPage2(_props) {
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-24 pt-10 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[980px] rounded-[1.6rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8", children: [
      /* @__PURE__ */ jsx("h1", { className: "text-[clamp(2.2rem,4vw,3.5rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: "Terms of Service" }),
      /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm text-[var(--bokmoo-copy-soft)]", children: "Last updated: April 15, 2024" }),
      /* @__PURE__ */ jsx("div", { className: "mt-8 space-y-5", children: sections2.map(([title, body], index) => /* @__PURE__ */ jsxs(
        "section",
        {
          className: "rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-5",
          children: [
            /* @__PURE__ */ jsxs("p", { className: "text-base font-medium text-[var(--bokmoo-ink)]", children: [
              index + 1,
              ". ",
              title
            ] }),
            /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-7 text-[var(--bokmoo-copy)]", children: body })
          ]
        },
        title
      )) })
    ] }) });
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
    defaultConfig: {
      brand: {
        name: "BOKMOO",
        primaryColor: "#d7b23d",
        secondaryColor: "#11100d",
        fontFamily: '"Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif'
      },
      layout: {
        headerSticky: true,
        showFooterLinks: true,
        maxWidth: "1280px"
      },
      features: {
        showWishlist: false,
        showRatings: false,
        enableQuickView: false
      },
      site: {
        archetype: "storefront",
        eyebrow: "BOKMOO eSIM Card",
        headline: "One Card.\nGlobal Connection.",
        subheadline: "Use multiple eSIM profiles on your BOKMOO card. Stay connected in 200+ countries.",
        primaryCtaLabel: "Shop eSIM Plans",
        primaryCtaHref: "/products",
        secondaryCtaLabel: "How it works",
        secondaryCtaHref: "/#how-it-works",
        demoHref: "/products",
        docsHref: "/help",
        supportEmail: "support@bokmoo.com"
      }
    }
  };
  var runtime_default = theme;

  // bokmoo-theme-runtime-entry.ts
  var tokenStyleId = "bokmoo-runtime-tokens";
  var tokenStyle = document.getElementById(tokenStyleId);
  if (!tokenStyle) {
    tokenStyle = document.createElement("style");
    tokenStyle.id = tokenStyleId;
    document.head.appendChild(tokenStyle);
  }
  tokenStyle.textContent = ':root {\n  --bokmoo-bg: oklch(0.055 0.006 75);\n  --bokmoo-bg-elevated: oklch(0.082 0.008 75);\n  --bokmoo-bg-soft: oklch(0.118 0.01 75);\n  --bokmoo-panel: oklch(0.095 0.009 75 / 0.96);\n  --bokmoo-panel-strong: oklch(0.14 0.013 75 / 0.98);\n  --bokmoo-surface: var(--bokmoo-bg-elevated);\n  --bokmoo-surface-alt: var(--bokmoo-bg-soft);\n  --bokmoo-ink: oklch(0.97 0.006 86);\n  --bokmoo-copy: oklch(0.78 0.011 82);\n  --bokmoo-copy-soft: oklch(0.57 0.01 82);\n  --bokmoo-line: oklch(0.29 0.019 78 / 0.34);\n  --bokmoo-line-strong: oklch(0.52 0.034 78 / 0.52);\n  --bokmoo-gold: oklch(0.76 0.105 80);\n  --bokmoo-gold-strong: oklch(0.86 0.11 82);\n  --bokmoo-gold-soft: oklch(0.2 0.042 79);\n  --bokmoo-primary: var(--bokmoo-gold);\n  --bokmoo-primary-strong: var(--bokmoo-gold-strong);\n  --bokmoo-primary-soft: var(--bokmoo-gold-soft);\n  --bokmoo-silver: oklch(0.86 0.01 255);\n  --bokmoo-success: oklch(0.77 0.09 150);\n  --bokmoo-warning: oklch(0.81 0.1 82);\n  --bokmoo-danger: oklch(0.66 0.19 28);\n  --bokmoo-shadow: 0 34px 110px -48px rgba(0, 0, 0, 0.92);\n  --bokmoo-shadow-glow: 0 0 58px color-mix(in oklab, var(--bokmoo-gold) 30%, transparent);\n  --bokmoo-orbit-glow: radial-gradient(circle, color-mix(in oklab, var(--bokmoo-gold) 54%, transparent) 0%, transparent 68%);\n  --bokmoo-hero-gold-field: color-mix(in oklab, var(--bokmoo-gold) 42%, transparent);\n  --bokmoo-card-edge: color-mix(in oklab, var(--bokmoo-gold) 52%, transparent);\n  --bokmoo-card-glow: 0 64px 180px rgba(0, 0, 0, 0.82), 0 0 90px color-mix(in oklab, var(--bokmoo-gold) 18%, transparent);\n  --bokmoo-radius-xl: 2rem;\n  --bokmoo-radius-lg: 1.5rem;\n  --bokmoo-radius-md: 1rem;\n  --bokmoo-radius-sm: 0.75rem;\n  --bokmoo-display: "Avenir Next", "Satoshi", "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif;\n  --bokmoo-sans: "Avenir Next", "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif;\n  --bokmoo-grid:\n    linear-gradient(to right, color-mix(in oklab, var(--bokmoo-line) 72%, transparent) 1px, transparent 1px),\n    linear-gradient(to bottom, color-mix(in oklab, var(--bokmoo-line) 72%, transparent) 1px, transparent 1px);\n\n  /* Compatibility aliases for reused shared components */\n  --vault-bg: var(--bokmoo-bg);\n  --vault-surface: var(--bokmoo-bg-elevated);\n  --vault-surface-alt: var(--bokmoo-bg-soft);\n  --vault-ink: var(--bokmoo-ink);\n  --vault-copy: var(--bokmoo-copy);\n  --vault-copy-soft: var(--bokmoo-copy-soft);\n  --vault-line: var(--bokmoo-line);\n  --vault-primary: var(--bokmoo-gold);\n  --vault-primary-strong: var(--bokmoo-gold-strong);\n  --vault-primary-soft: var(--bokmoo-gold-soft);\n  --vault-accent: var(--bokmoo-silver);\n  --vault-success: var(--bokmoo-success);\n  --vault-warning: var(--bokmoo-warning);\n  --vault-danger: var(--bokmoo-danger);\n  --vault-shadow: var(--bokmoo-shadow);\n  --vault-radius-lg: var(--bokmoo-radius-lg);\n  --vault-radius-md: var(--bokmoo-radius-md);\n  --vault-radius-sm: var(--bokmoo-radius-sm);\n  --vault-grid: var(--bokmoo-grid);\n}\n\nbody {\n  background:\n    radial-gradient(circle at 82% 8%, color-mix(in oklab, var(--bokmoo-gold) 13%, transparent), transparent 18%),\n    radial-gradient(circle at 75% 28%, color-mix(in oklab, var(--bokmoo-gold) 8%, transparent), transparent 24%),\n    radial-gradient(circle at 20% 80%, color-mix(in oklab, var(--bokmoo-gold) 4%, transparent), transparent 22%),\n    var(--bokmoo-bg);\n  color: var(--bokmoo-ink);\n  font-family: var(--bokmoo-sans);\n  letter-spacing: 0.01em;\n}\n\nh1,\nh2,\nh3,\nh4,\nh5,\nh6 {\n  font-family: var(--bokmoo-display);\n  font-weight: 700;\n}\n\n::selection {\n  background: color-mix(in oklab, var(--bokmoo-gold) 38%, transparent);\n  color: var(--bokmoo-ink);\n}\n';
  var existingMeta = runtime_default && typeof runtime_default === "object" && runtime_default.meta && typeof runtime_default.meta === "object" ? runtime_default.meta : {};
  window.__JIFFOO_THEME_RUNTIME__ = {
    ...runtime_default,
    meta: {
      ...existingMeta,
      slug: "bokmoo",
      version: "1.1.6",
      target: "shop"
    }
  };
})();
